// Biliardo del Ridotto: grafica, comandi, turni.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import * as P from './physics.js';
import * as Ru from './rules.js';
import * as Bot from './bot.js';
import { CUES, SETS, FELTS, ballTexture, makeCue, feltTexture, woodTexture } from './looks.js';
import { hostRoom, joinRoom, randomCode } from '../net.js';

const { T } = P, R = T.R;
const Q = new URLSearchParams(location.search);
const DEBUG = Q.has('debug'), FAST = Q.has('fast');
const MOBILE = matchMedia('(pointer:coarse)').matches;
const $ = s => document.querySelector(s);

// ---------- impostazioni salvate ----------
const CFG = Object.assign({ caos: false, casa: false, mode: 'bot', level: 'medio', guide: 'corta', cue: 'classica', set: 'classiche', felt: 'verde', n0: '', n1: '' },
  (() => { try { return JSON.parse(localStorage.getItem('ridotto-pool')) || {}; } catch (e) { return {}; } })());
const saveCfg = () => { try { localStorage.setItem('ridotto-pool', JSON.stringify(CFG)); } catch (e) { } };

// ---------- renderer e scena ----------
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, MOBILE ? 1.6 : 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.88;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0705);
scene.fog = new THREE.Fog(0x0a0705, 6, 14);
const pmrem = new THREE.PMREMGenerator(renderer);
// riflessi presi dalla sala stessa (vedi fondo del file): niente luci da studio che fanno aloni
const camera = new THREE.PerspectiveCamera(50, 1, 0.02, 40);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
// alcuni driver producono pixel NaN (riflessi): li azzeriamo prima del bagliore, altrimenti anneriscono lo schermo
composer.addPass(new ShaderPass({ uniforms: { tDiffuse: { value: null } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); if (!(c.r == c.r) || !(c.g == c.g) || !(c.b == c.b)) c = vec4(0.0,0.0,0.0,1.0); gl_FragColor = vec4(clamp(c.rgb, 0.0, 60.0), 1.0); }' }));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.14, 0.35, 1.0);
composer.addPass(bloom);
composer.addPass(new OutputPass());

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false); composer.setSize(w, h);
  camera.aspect = w / h; camera.fov = w < h ? 64 : 50; camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

// ---------- costruzione del tavolo ----------
const POCK = P.pockets();
const tableGroup = new THREE.Group(); scene.add(tableGroup);
const feltMat = new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0 });
const cushionMat = new THREE.MeshStandardMaterial({ roughness: 0.9 });
const woodMat = new THREE.MeshPhysicalMaterial({ map: woodTexture('#5a2a12', '#2c1206'), roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.25 });
function applyFelt() {
  const f = FELTS.find(x => x.id === CFG.felt) || FELTS[0];
  feltMat.map?.dispose(); feltMat.map = feltTexture(f.c); feltMat.needsUpdate = true;
  cushionMat.map?.dispose(); cushionMat.map = feltTexture(f.c, 0.82); cushionMat.needsUpdate = true;
}

function unionPoly(hx, hz, circles, n = 900) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = i / n * Math.PI * 2, dx = Math.cos(t), dz = Math.sin(t);
    let d = Math.min(Math.abs(dx) > 1e-9 ? hx / Math.abs(dx) : 1e9, Math.abs(dz) > 1e-9 ? hz / Math.abs(dz) : 1e9);
    for (const c of circles) {
      const b = dx * c.x + dz * c.z, cc = c.x * c.x + c.z * c.z - c.r * c.r, disc = b * b - cc;
      if (disc < 0) continue; const s = Math.sqrt(disc), t0 = b - s, t1 = b + s;
      if (t1 > 0 && t0 <= d + 1e-6) d = Math.max(d, t1);
    }
    pts.push(new THREE.Vector2(dx * d, -dz * d));
  }
  return pts;
}
function flat(shape, depth, mat, y, bevel = 0) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 24 });
  const m = new THREE.Mesh(g, mat); m.rotation.x = -Math.PI / 2; m.position.y = y; m.receiveShadow = true; m.castShadow = true;
  return m;
}
function buildTable() {
  const { L, W, back } = T, rim = 0.022, wood = 0.115;
  const ring = POCK.map(p => ({ x: p.x, z: p.z, r: p.r + rim }));
  // panno con i fori delle buche
  const bed = new THREE.Shape(unionPoly(L / 2 + back, W / 2 + back, ring));
  for (const p of POCK) { const h = new THREE.Path(); h.absarc(p.x, -p.z, p.r, 0, Math.PI * 2, true); bed.holes.push(h); }
  const bedM = flat(bed, 0.03, feltMat, -0.03); bedM.castShadow = false; tableGroup.add(bedM);
  // sponde
  for (const poly of P.cushions().polys) {
    const s = new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, -z)));
    const m = flat(s, 0.038, cushionMat, 0); tableGroup.add(m);
  }
  // cornice di legno
  const ox = L / 2 + back + wood, oz = W / 2 + back + wood, rr = 0.06;
  const outer = new THREE.Shape();
  outer.moveTo(-ox + rr, -oz); outer.lineTo(ox - rr, -oz); outer.quadraticCurveTo(ox, -oz, ox, -oz + rr);
  outer.lineTo(ox, oz - rr); outer.quadraticCurveTo(ox, oz, ox - rr, oz); outer.lineTo(-ox + rr, oz);
  outer.quadraticCurveTo(-ox, oz, -ox, oz - rr); outer.lineTo(-ox, -oz + rr); outer.quadraticCurveTo(-ox, -oz, -ox + rr, -oz);
  outer.holes.push(new THREE.Path(unionPoly(L / 2 + back, W / 2 + back, ring)));
  const frame = flat(outer, 0.036, woodMat, 0.004, 0.008);
  frame.material = [woodMat, new THREE.MeshStandardMaterial({ color: 0x1c110a, roughness: 0.5 })]; tableGroup.add(frame);
  // bordi in pelle delle buche e interno
  const leather = new THREE.MeshStandardMaterial({ color: 0x1a0f08, roughness: 0.55 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x050403, roughness: 1, side: THREE.DoubleSide });
  for (const p of POCK) {
    const ringM = new THREE.Mesh(new THREE.RingGeometry(p.r, p.r + rim + 0.004, 48), leather);
    ringM.rotation.x = -Math.PI / 2; ringM.position.set(p.x, 0.0015, p.z); tableGroup.add(ringM);
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(p.r, p.r * 0.92, 0.017, 32, 1, true), dark);
    cup.position.set(p.x, -0.0085, p.z); tableGroup.add(cup);
    const bot = new THREE.Mesh(new THREE.CircleGeometry(p.r * 0.93, 24), new THREE.MeshBasicMaterial({ color: 0x020101 }));
    bot.rotation.x = -Math.PI / 2; bot.position.set(p.x, -0.0165, p.z); tableGroup.add(bot);
    // borchia di ottone sopra la buca
    const cap = new THREE.Mesh(new THREE.TorusGeometry(p.r + rim + 0.01, 0.006, 8, 40, Math.PI * (p.corner ? 1.0 : 1.0)), new THREE.MeshStandardMaterial({ color: 0xc9a24a, metalness: 1, roughness: 0.3 }));
    cap.rotation.x = -Math.PI / 2; cap.position.set(p.x, 0.046, p.z);
    const out = Math.atan2(p.z, p.x); cap.rotation.z = -out - Math.PI / 2;
    tableGroup.add(cap);
  }
  // diamanti
  const pearl = new THREE.MeshStandardMaterial({ color: 0xf4efe2, roughness: 0.25, metalness: 0.1, emissive: 0x221e18 });
  const dg = new THREE.CircleGeometry(0.008, 4);
  const addD = (x, z) => { const d = new THREE.Mesh(dg, pearl); d.rotation.x = -Math.PI / 2; d.position.set(x, 0.0495, z); tableGroup.add(d); };
  const rx = L / 2 + back + wood * 0.5, rz = W / 2 + back + wood * 0.5;
  for (let k = 1; k <= 3; k++) for (const s of [-1, 1]) { addD(s * k * L / 8, -rz); addD(s * k * L / 8, rz); }
  for (const z of [-W / 4, 0, W / 4]) { addD(-rx, z); addD(rx, z); }
  // dischetti
  const spotM = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 });
  for (const x of [L / 4, -L / 4]) { const s = new THREE.Mesh(new THREE.CircleGeometry(0.006, 16), spotM); s.rotation.x = -Math.PI / 2; s.position.set(x, 0.0008, 0); tableGroup.add(s); }
  // linea della zona di battuta (si vede solo con palla in mano dietro la linea)
  kitchenLine = new THREE.Mesh(new THREE.PlaneGeometry(0.004, W), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 }));
  kitchenLine.rotation.x = -Math.PI / 2; kitchenLine.position.set(-L / 4, 0.0008, 0); kitchenLine.visible = false; tableGroup.add(kitchenLine);
  // fascia sotto, gambe
  const apron = new THREE.Mesh(new THREE.BoxGeometry(2 * ox - 0.04, 0.16, 2 * oz - 0.04), woodMat);
  apron.position.y = -0.1; apron.castShadow = apron.receiveShadow = true; tableGroup.add(apron);
  const legG = new THREE.CylinderGeometry(0.07, 0.055, 0.62, 16);
  for (const sx of [-1, 0, 1]) for (const sz of [-1, 1]) {
    const leg = new THREE.Mesh(legG, woodMat); leg.position.set(sx * (ox - 0.16), -0.49, sz * (oz - 0.14)); leg.castShadow = true; tableGroup.add(leg);
  }
  tableGroup.position.y = 0.8;
}
let kitchenLine, lampObj;

// ---------- stanza ----------
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
function buildRoom() {
  const floorT = canvasTex(1024, 1024, (g, w, h) => {
    for (let i = 0; i < 8; i++) {
      const hue = 22 + Math.random() * 6, l = 16 + Math.random() * 6;
      g.fillStyle = `hsl(${hue},45%,${l}%)`; g.fillRect(0, i * h / 8, w, h / 8);
      for (let k = 0; k < 60; k++) { g.strokeStyle = `rgba(0,0,0,${Math.random() * .25})`; g.beginPath(); const y = i * h / 8 + Math.random() * h / 8; g.moveTo(0, y); g.bezierCurveTo(w / 3, y + Math.random() * 6 - 3, w * 2 / 3, y + Math.random() * 6 - 3, w, y); g.stroke(); }
      g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(0, i * h / 8, w, 2);
      g.fillRect(((i * 397) % 1000), i * h / 8, 2, h / 8);
    }
  });
  floorT.wrapS = floorT.wrapT = THREE.RepeatWrapping; floorT.repeat.set(4, 4);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), new THREE.MeshStandardMaterial({ map: floorT, roughness: 0.6 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const wallT = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#2b1416'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 32) { g.fillStyle = 'rgba(217,178,95,.06)'; g.fillRect(x, 0, 2, h); }
    for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * .08})`; g.fillRect(Math.random() * w, Math.random() * h, 20, 20); }
  });
  wallT.wrapS = wallT.wrapT = THREE.RepeatWrapping; wallT.repeat.set(6, 1.5);
  const wallM = new THREE.MeshStandardMaterial({ map: wallT, roughness: 0.85 });
  const wainM = new THREE.MeshStandardMaterial({ map: woodTexture('#3a1a0b', '#1b0b04'), roughness: 0.5 });
  const room = [[0, -5, 0], [0, 5, Math.PI], [-6, 0, Math.PI / 2], [6, 0, -Math.PI / 2]];
  for (const [x, z, ry] of room) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(12, 4), wallM); w.position.set(x, 2, z); w.rotation.y = ry; scene.add(w);
    const wa = new THREE.Mesh(new THREE.BoxGeometry(12, 1.0, 0.04), wainM); wa.position.set(x, 0.5, z); wa.rotation.y = ry; wa.translateZ(0.02); scene.add(wa);
  }
  // bancone con bottiglie in fondo
  const bar = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.1, 0.7), wainM); bar.position.set(0, 0.55, -4.4); bar.castShadow = true; scene.add(bar);
  const top = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.06, 0.8), woodMat); top.position.set(0, 1.13, -4.38); scene.add(top);
  for (let row = 0; row < 2; row++) {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.04, 0.25), woodMat); shelf.position.set(0, 1.55 + row * 0.5, -4.86); scene.add(shelf);
    for (let i = 0; i < 16; i++) {
      const hue = [30, 120, 0, 45, 200, 280][i % 6], h = 0.22 + Math.random() * 0.12;
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, h, 10), new THREE.MeshStandardMaterial({ color: new THREE.Color(`hsl(${hue},60%,30%)`), emissive: new THREE.Color(`hsl(${hue},80%,25%)`), emissiveIntensity: 0.35, roughness: 0.15, transparent: true, opacity: 0.85 }));
      b.position.set(-1.65 + i * 0.22, 1.57 + row * 0.5 + h / 2, -4.84); scene.add(b);
    }
  }
  // insegna al neon
  const neon = canvasTex(1024, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.font = 'italic 700 150px "Cormorant Garamond", Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = '#ff3d6e'; g.shadowBlur = 30; g.fillStyle = '#ffd1dc'; g.fillText('Biliardo', w / 2, h / 2 + 6);
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), new THREE.MeshBasicMaterial({ map: neon, transparent: true, toneMapped: false, color: 0xffffff }));
  sign.position.set(0, 2.95, -4.97); scene.add(sign);
  const glow = new THREE.PointLight(0xff3d6e, 2.5, 4, 2); glow.position.set(0, 2.9, -4.6); scene.add(glow);
  // quadri
  const frames = [[-6, 2.1, -1.5, Math.PI / 2, 'IL RIDOTTO', '#d9b25f'], [-6, 2.1, 1.6, Math.PI / 2, '8', '#f2c014'], [6, 2.1, 0, -Math.PI / 2, 'Torneo\nd\'inverno', '#c8432f']];
  for (const [x, y, z, ry, txt, col] of frames) {
    const t = canvasTex(256, 340, (g, w, h) => {
      g.fillStyle = '#16100b'; g.fillRect(0, 0, w, h); g.strokeStyle = col; g.lineWidth = 6; g.strokeRect(14, 14, w - 28, h - 28);
      g.fillStyle = col; g.textAlign = 'center'; g.font = (txt.length < 3 ? '700 170px' : 'italic 700 44px') + ' Georgia, serif';
      txt.split('\n').forEach((l, i, a) => g.fillText(l, w / 2, h / 2 + (i - (a.length - 1) / 2) * 50 + (txt.length < 3 ? 55 : 12)));
    });
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.82, 0.04), new THREE.MeshStandardMaterial({ color: 0x3a2412, roughness: .4, metalness: .3 }));
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.74), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }));
    pic.position.z = 0.021; f.add(pic); f.position.set(x, y, z); f.rotation.y = ry; f.translateZ(0.03); scene.add(f);
  }
  // portastecche al muro
  const rack = new THREE.Group();
  const rb = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.08, 0.1), woodMat); rb.position.y = 0.9; rack.add(rb);
  const rb2 = rb.clone(); rb2.position.y = 2.0; rack.add(rb2);
  CUES.forEach((c, i) => { const s = makeCue(c); s.position.set(-0.4 + i * 0.16, 0.25, 0.06); s.rotation.set(-Math.PI / 2 + 0.04, 0, 0); rack.add(s); });
  rack.position.set(5.92, 0, -2.6); rack.rotation.y = -Math.PI / 2; scene.add(rack);

  // lampada sopra il tavolo
  const lamp = new THREE.Group();
  const shadeM = new THREE.MeshStandardMaterial({ color: 0x0f3b26, roughness: 0.4, metalness: 0.3, side: THREE.DoubleSide });
  const brass = new THREE.MeshStandardMaterial({ color: 0xc9a24a, roughness: 0.3, metalness: 1 });
  const bar2 = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.03, 0.04), brass); bar2.position.y = 0.28; lamp.add(bar2);
  for (const x of [-0.62, 0, 0.62]) {
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.24, 0.2, 32, 1, true), shadeM); sh.position.set(x, 0.17, 0); lamp.add(sh);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfff1cf, toneMapped: false })); bulb.position.set(x, 0.12, 0); lamp.add(bulb);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.12), brass); rod.position.set(x, 0.24 + 0.04, 0); lamp.add(rod);
  }
  for (const x of [-0.8, 0.8]) { const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 1.9), brass); ch.position.set(x, 1.25, 0); lamp.add(ch); }
  lamp.position.set(0, 1.9, 0); scene.add(lamp); lampObj = lamp;
  for (const x of [-0.62, 0, 0.62]) {
    const s = new THREE.SpotLight(0xffe6bf, 4.0, 4, 0.95, 0.85, 1.4);
    s.position.set(x, 2.0, 0); s.target.position.set(x, 0.8, 0); scene.add(s, s.target);
    if (x !== 0) { s.castShadow = true; s.shadow.mapSize.set(MOBILE ? 1024 : 2048, MOBILE ? 1024 : 2048); s.shadow.bias = -0.0004; s.shadow.radius = 4; s.shadow.camera.near = 0.5; s.shadow.camera.far = 3; }
  }
  scene.add(new THREE.HemisphereLight(0x8a6a58, 0x1a1210, 0.55));
  // lampade a muro
  for (const [x, z] of [[-5.9, -3], [-5.9, 3], [5.9, 2.6], [-2, -4.95], [2, -4.95]]) {
    const l = new THREE.PointLight(0xffb36b, 1.4, 3.5, 2); l.position.set(x, 2.3, z); scene.add(l);
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffcf96, toneMapped: false })); b.position.copy(l.position); scene.add(b);
  }
}

// ---------- palle ----------
let balls = [], ballMeshes = new Map();
const ballGeo = new THREE.SphereGeometry(R, 40, 28);
function ballMaterial(id) {
  const set = SETS.find(s => s.id === CFG.set) || SETS[0];
  return new THREE.MeshPhysicalMaterial({ map: ballTexture(id, set), roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 0.9, emissiveMap: set.glow ? ballTexture(id, set) : null, emissive: set.glow ? 0xffffff : 0x000000, emissiveIntensity: set.glow ? 0.18 : 0 });
}
function syncBallMeshes() {
  for (const m of ballMeshes.values()) { tableGroup.remove(m); m.material.map?.dispose(); m.material.dispose(); }
  ballMeshes.clear();
  for (const b of balls) {
    const m = new THREE.Mesh(ballGeo, ballMaterial(b.id)); m.castShadow = true; m.receiveShadow = true;
    m.rotation.set(-Math.PI / 2 + (Math.random() - .5) * 0.5, 0, (Math.random() - .5) * 0.5);
    m.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 6.28));
    tableGroup.add(m); ballMeshes.set(b.id, m);
  }
  placeMeshes(0);
}
const _q = new THREE.Quaternion(), _ax = new THREE.Vector3();
function placeMeshes(dt) {
  for (const b of balls) {
    const m = ballMeshes.get(b.id); if (!m) continue;
    if (b.on) {
      m.visible = true; m.position.set(b.x, R, b.z);
      const w = Math.hypot(b.wx, b.wy, b.wz);
      if (w > 1e-4 && dt > 0) { _ax.set(b.wx / w, b.wy / w, b.wz / w); _q.setFromAxisAngle(_ax, w * dt); m.quaternion.premultiply(_q); }
    }
  }
}
const sinking = [];
function sinkBall(id, pocket) {
  const m = ballMeshes.get(id), p = POCK[pocket]; if (!m) return;
  sinking.push({ m, x0: m.position.x, z0: m.position.z, px: p.x, pz: p.z, t: 0 });
}
function updateSinking(dt) {
  for (let i = sinking.length - 1; i >= 0; i--) {
    const s = sinking[i]; s.t += dt;
    const k = Math.min(1, s.t / 0.28);
    s.m.position.x = s.x0 + (s.px - s.x0) * k; s.m.position.z = s.z0 + (s.pz - s.z0) * k;
    s.m.position.y = R - Math.max(0, s.t - 0.08) * 0.75;
    if (s.t > 0.45) { s.m.visible = false; sinking.splice(i, 1); }
  }
}

// ---------- stecca e guide ----------
let cueMesh = null;
const cueRig = new THREE.Group(); tableGroup.add(cueRig);
function setCue(id) {
  if (cueMesh) { cueRig.remove(cueMesh); }
  cueMesh = makeCue(CUES.find(c => c.id === id) || CUES[0]);
  cueRig.add(cueMesh);
}
const guideMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false });
const guideMat2 = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false });
const guides = new THREE.Group(); tableGroup.add(guides);
const gLine = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), guideMat), gObj = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), guideMat), gCue = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), guideMat2);
const gGhost = new THREE.Mesh(new THREE.RingGeometry(R - 0.0025, R, 40), guideMat);
const gBad = new THREE.Mesh(new THREE.RingGeometry(R * 0.35, R * 0.5, 4), new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.85, depthWrite: false }));
for (const m of [gLine, gObj, gCue, gGhost, gBad]) { m.rotation.x = -Math.PI / 2; m.renderOrder = 5; guides.add(m); }
function strip(m, x0, z0, x1, z1, w) {
  const dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz);
  m.visible = l > 0.002; m.scale.set(w, l, 1);
  m.position.set((x0 + x1) / 2, 0.0012, (z0 + z1) / 2);
  m.rotation.set(-Math.PI / 2, 0, Math.atan2(dx, dz) + Math.PI);
}

// ---------- suoni ----------
let AC = null, master = null, noiseB = null;
function ac() {
  if (AC) return AC;
  try { AC = new (window.AudioContext || window.webkitAudioContext)(); master = AC.createGain(); master.gain.value = 0.7; master.connect(AC.destination);
    noiseB = AC.createBuffer(1, AC.sampleRate, AC.sampleRate); const d = noiseB.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } catch (e) { }
  return AC;
}
function snd(type, v = 1) {
  const c = ac(); if (!c) return; const t = c.currentTime;
  const tone = (f, dur, vol, at = 0, typ = 'sine', slide = 0) => { const o = c.createOscillator(), g = c.createGain(); o.type = typ; o.frequency.setValueAtTime(f, t + at); if (slide) o.frequency.exponentialRampToValueAtTime(f * slide, t + at + dur); g.gain.setValueAtTime(vol, t + at); g.gain.exponentialRampToValueAtTime(1e-4, t + at + dur); o.connect(g); g.connect(master); o.start(t + at); o.stop(t + at + dur + .02); };
  const noise = (dur, f, q, vol, at = 0, typ = 'bandpass') => { const s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain(); s.buffer = noiseB; fl.type = typ; fl.frequency.value = f; fl.Q.value = q; g.gain.setValueAtTime(vol, t + at); g.gain.exponentialRampToValueAtTime(1e-4, t + at + dur); s.connect(fl); fl.connect(g); g.connect(master); s.start(t + at, Math.random() * .5); s.stop(t + at + dur + .02); };
  const k = Math.min(1, v);
  if (type === 'ball') { tone(2600 + Math.random() * 500, 0.035, 0.32 * k); noise(0.025, 4200, 1.2, 0.35 * k); tone(1300, 0.05, 0.08 * k); }
  else if (type === 'rail') { noise(0.09, 260, 0.8, 0.5 * k, 0, 'lowpass'); tone(110, 0.08, 0.25 * k); }
  else if (type === 'pot') { tone(95, 0.12, 0.4); noise(0.08, 700, 2, 0.3); for (let i = 1; i < 5; i++) { tone(140 - i * 8, 0.06, 0.18 / i, 0.09 + i * 0.07); noise(0.05, 500, 2, 0.12 / i, 0.09 + i * 0.07); } }
  else if (type === 'cue') { tone(900, 0.03, 0.35 * k + 0.08); noise(0.03, 2200, 1, 0.3 * k + 0.1); }
  else if (type === 'win') { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.35, 0.18, i * 0.12, 'triangle')); }
  else if (type === 'foul') { tone(220, 0.25, 0.2, 0, 'sawtooth', 0.6); }
  else if (type === 'tick') { tone(1800, 0.015, 0.05); }
}

// ---------- stato di gioco ----------
const G = {
  phase: 'menu', match: null, players: [], ang: 0, power: 0, spinA: 0, spinB: 0, view: 'fp',
  camDist: 1.05, camPitch: 0.42, events: [], shotStart: 0, botPlan: null, placing: false, potLog: [],
  camPos: new THREE.Vector3(0, 3, 3), camLook: new THREE.Vector3(0, 0, 0), follow: new THREE.Vector3(), lastShot: null,
};
const cueBall = () => balls.find(b => b.id === 0);
const cur = () => G.players[G.match.turn];
const isHumanTurn = () => G.match && !cur().bot;

function newGame(remote) {
  const online = !!G.net;
  balls = remote ? remote.balls.map(b => ({ ...P.makeBall(b.id, b.x, b.z) })) : P.rack();
  let names = [CFG.n0.trim() || 'Giocatore 1', CFG.mode === 'duo' ? (CFG.n1.trim() || 'Giocatore 2') : CFG.mode === 'bot' ? 'Il Banco' : '—'];
  if (online) names = remote ? remote.names : [CFG.n0.trim() || 'Giocatore 1', G.net.peerName || 'Ospite'];
  G.players = [{ name: names[0], bot: false }, { name: names[1], bot: !online && CFG.mode === 'bot' }];
  if (online) G.players[1 - G.net.local].remote = true;
  if (online && G.net.role === 'host') netSend({ t: 'start', names, balls: balls.map(b => ({ id: b.id, x: b.x, z: b.z })) });
  G.match = Ru.newMatch(names, { practice: CFG.mode === 'free', first: 0, casa: !!CFG.casa });
  G.potLog = []; G.spinA = G.spinB = 0; G.power = 0;
  clearTokens(); G.held = [[], []]; G.dizzy = [0, 0]; G.mods = null; if (CFG.caos && CFG.mode !== 'free' && !online) for (let i = 0; i < 3; i++) spawnToken();
  syncBallMeshes(); setCue(CFG.cue);
  G.ang = 0; G.view = 'fp';
  $('#hud').classList.remove('hide'); $('#menu').classList.add('hide'); $('#over').classList.add('hide');
  $('#p1').classList.toggle('hide', CFG.mode === 'free');
  updateHud();
  startTurn(true);
}

function startTurn(first) {
  const m = G.match, cue = cueBall();
  G.phase = 'aim'; G.power = 0; G.spinA = G.spinB = 0; setSpinDot();
  if (!cue.on) { cue.on = true; cue.x = -T.L / 4; cue.z = 0; cue.vx = cue.vz = cue.wx = cue.wy = cue.wz = 0; const m = ballMeshes.get(0); m.visible = true; }
  // mira iniziale: verso la palla legale più vicina
  const targets = Ru.legalTargets(m, balls);
  const near = balls.filter(b => b.on && targets.includes(b.id)).sort((a, b) => Math.hypot(a.x - cue.x, a.z - cue.z) - Math.hypot(b.x - cue.x, b.z - cue.z))[0];
  if (m.breakShot) G.ang = 0; else if (near) G.ang = Math.atan2(near.z - cue.z, near.x - cue.x);
  updateHud(); showPowers();
  if (CFG.caos && G.dizzy[m.turn] > 0 && !cur().bot) say(`${cur().name} è ancora stordito dalla mazzata! 😵`, true);
  if (cur().bot) { botTurn(); return; }
  if (cur().remote) { G.phase = 'remote'; G.placing = false; $('#place').classList.add('hide'); kitchenLine.visible = false; if (!first) say(`Tocca a ${cur().name}`); G.view = G.prefView || 'fp'; if (G.pendingShot) { const ps = G.pendingShot; G.pendingShot = null; applyShot(ps); } return; }
  if (m.ballInHand) {
    G.placing = true; kitchenLine.visible = !!m.kitchen;
    if (!first || !m.breakShot) say(m.kitchen ? 'Palla in mano: puoi spostare la bianca dietro la linea' : 'Palla in mano: trascina la bianca dove vuoi');
    else say(`${cur().name} apre. Puoi spostare la bianca dietro la linea`);
    G.view = 'top';
  } else { G.placing = false; kitchenLine.visible = false; if (!first) say(`Tocca a ${cur().name}`); G.view = G.prefView || 'fp'; }
  $('#place').classList.toggle('hide', !G.placing);
  if (CFG.mode === 'duo' && !first) hint(`Passa il telefono a ${cur().name}`);
}

function shoot(power) {
  if (G.phase !== 'aim' && G.phase !== 'botAim') return;
  if (G.dizzy) G.dizzy[G.match.turn] = 0; G.shooter = G.match.turn;
  G.placing = false; $('#place').classList.add('hide'); kitchenLine.visible = false;
  const speed = 0.25 + 7.8 * Math.pow(power, 1.6);
  G.phase = 'stroke'; G.strokeT = 0; G.strokePow = power; G.lastShot = { speed, a: G.spinA, b: G.spinB, ang: G.ang };
  if (G.net && !cur().remote) { const c = cueBall(); netSend({ t: 'shot', ...G.lastShot, p: power, cx: c.x, cz: c.z }); }
}
function doStrike() {
  const s = G.lastShot, cue = cueBall();
  P.strike(cue, s.ang, s.speed, s.a, s.b);
  snd('cue', s.speed / 6);
  G.events = []; G.simT = 0; G.phase = 'roll'; G.rollT = 0;
  G.follow.set(cue.x, 0, cue.z);
}

function endShot() {
  G.mods = null; showMods();
  if (G.net && G.net.role === 'guest') { G.phase = 'waitState'; tryState(); return; }
  if (CFG.caos) { while (G.tokens.length < 3 && Math.random() < 0.7) spawnToken(); }
  const m = G.match, ev = G.events;
  const r = Ru.judge(m, balls, ev);
  for (const id of r.potted || []) if (id !== 0) G.potLog.push(id);
  for (const id of r.respot || []) { const e = balls.find(b => b.id === id); if (!e || e.on) continue; e.on = true; e.x = T.L / 4; e.z = 0; while (!P.freeSpot(balls, e.x, e.z, e)) e.x += 0.012; ballMeshes.get(id).visible = true; ballMeshes.get(id).position.set(e.x, R, e.z); G.potLog = G.potLog.filter(x => x !== id); }
  if (r.respot8) { const e = balls.find(b => b.id === 8); e.on = true; e.x = T.L / 4; e.z = 0; while (!P.freeSpot(balls, e.x, e.z, e)) e.x += 0.01; ballMeshes.get(8).visible = true; ballMeshes.get(8).position.set(e.x, R, e.z); }
  if (r.msg) say(r.msg, r.foul);
  if (r.foul) snd('foul');
  updateHud();
  if (G.net && G.net.role === 'host') netSend({ t: 'state', balls: balls.map(b => ({ id: b.id, x: b.x, z: b.z, on: b.on })), match: m, msg: r.msg || '', foul: !!r.foul, end: !!r.end });
  if (r.end) { setTimeout(() => gameOver(r.msg), 1400); G.phase = 'over'; return; }
  setTimeout(() => startTurn(false), r.msg ? 900 : 350);
  G.phase = 'wait';
}

function gameOver(msg) {
  const m = G.match, w = m.winner;
  if (!G.players[w].bot) snd('win');
  $('#ovW').textContent = msg;
  $('#ovT').textContent = G.players[w].bot ? 'Ha vinto il Banco' : `Vince ${G.players[w].name}`;
  const st = $('#ovS'); st.innerHTML = '<div></div><b>' + esc(G.players[0].name) + '</b><b>' + esc(G.players[1].name) + '</b>' +
    `<div>Falli</div><div>${m.fouls[0]}</div><div>${m.fouls[1]}</div><div>Tiri totali</div><div colspan=2>${m.shots}</div><div></div>`;
  $('#over').classList.remove('hide');
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- bot ----------
function botTurn(again) {
  const m = G.match;
  G.phase = 'botThink'; if (!again) say(`${cur().name} studia il tavolo…`);
  setTimeout(() => {
    if (m.ballInHand) { Bot.placeCue(m, balls, m.kitchen); placeMeshes(0); }
    const lvl = CFG.mode === 'bot' ? CFG.level : 'medio';
    if (CFG.caos && G.held[m.turn].length && Math.random() < 0.65) { const k = G.held[m.turn][0]; if (usePower(k, true)) { if (G.phase === 'settle') G.afterSettle = () => botTurn(true); else setTimeout(() => botTurn(true), FAST ? 50 : 900); return; } }
    const s = Bot.chooseShot(m, balls, lvl);
    if (G.dizzy[m.turn] > 0) { G.dizzy[m.turn] = 0; s.ang += (Math.random() - 0.5) * 0.14; s.speed *= 0.8 + Math.random() * 0.5; }
    G.botPlan = { ...s, from: G.ang, t: 0 };
    G.spinA = s.a; G.spinB = s.b; setSpinDot();
    G.phase = 'botAim';
  }, FAST ? 30 : 650);
}

// ---------- HUD ----------
const COLORS = () => (SETS.find(s => s.id === CFG.set) || SETS[0]);
function miniBall(id, gone) {
  const set = COLORS(), c = set.colors[id] || '#fff';
  const stripe = id > 8;
  const bg = stripe ? `linear-gradient(${set.base} 0 28%, ${c} 28% 72%, ${set.base} 72%)` : c;
  return `<span class="mb${gone ? ' gone' : ''}" style="background:${bg}">${id}</span>`;
}
function updateHud() {
  const m = G.match; if (!m) return;
  [0, 1].forEach(i => {
    const el = $('#p' + i); el.classList.toggle('on', m.turn === i && !m.winner);
    el.querySelector('.nm').textContent = G.players[i].name;
    el.querySelector('.av').textContent = G.players[i].bot ? '♠' : (G.players[i].name[0] || '?').toUpperCase();
    const g = m.groups[i];
    let html = '';
    if (m.practice) html = '';
    else if (!g) html = '<span class="sub">tavolo aperto</span>';
    else {
      const ids = g === 'piene' ? [1, 2, 3, 4, 5, 6, 7] : [9, 10, 11, 12, 13, 14, 15];
      html = ids.map(id => miniBall(id, !balls.find(b => b.id === id).on)).join('');
      if (Ru.remaining(balls, g) === 0) html += miniBall(8, false);
    }
    el.querySelector('.grp').innerHTML = html;
    el.querySelector('.sub').textContent = m.practice ? `${m.shots} tiri` : g ? g : '';
  });
  $('#tray').innerHTML = m.practice ? G.potLog.map(id => miniBall(id)).join('') : '';
}
let msgTimer = 0;
function say(t, bad) { const el = $('#msg'); el.textContent = t; el.classList.add('show'); el.classList.toggle('foul', !!bad); clearTimeout(msgTimer); msgTimer = setTimeout(() => el.classList.remove('show'), 3200); }
let hintTimer = 0;
function hint(t) { const el = $('#hint'); el.textContent = t; el.classList.add('show'); clearTimeout(hintTimer); hintTimer = setTimeout(() => el.classList.remove('show'), 1800); }
function setSpinDot() { const d = $('#spin .dot'); d.style.left = (50 + G.spinA * 38) + '%'; d.style.top = (50 - G.spinB * 38) + '%'; }

// ---------- comandi ----------
const pw = $('#power'), pfill = $('#power .fill');
let pDrag = null;
pw.addEventListener('pointerdown', e => { if (!canAim()) return; ac(); pw.setPointerCapture(e.pointerId); pDrag = { y0: e.clientY, h: pw.clientHeight }; G.power = 0; });
pw.addEventListener('pointermove', e => { if (!pDrag) return; G.power = Math.max(0, Math.min(1, (e.clientY - pDrag.y0) / (pDrag.h * 0.85))); pfill.style.height = (G.power * 100) + '%'; });
const pEnd = () => { if (!pDrag) return; pDrag = null; const p = G.power; pfill.style.height = '0'; if (p > 0.02 && canAim()) shoot(p); else G.power = 0; };
pw.addEventListener('pointerup', pEnd); pw.addEventListener('pointercancel', () => { pDrag = null; G.power = 0; pfill.style.height = '0'; });

const sp = $('#spin');
let sDrag = false;
const setSpin = e => { const r = sp.getBoundingClientRect(); let a = (e.clientX - r.left) / r.width * 2 - 1, b = -((e.clientY - r.top) / r.height * 2 - 1); const l = Math.hypot(a, b); if (l > 1) { a /= l; b /= l; } G.spinA = a; G.spinB = b; setSpinDot(); };
sp.addEventListener('pointerdown', e => { if (!canAim()) return; sp.setPointerCapture(e.pointerId); sDrag = true; setSpin(e); });
sp.addEventListener('pointermove', e => { if (sDrag) setSpin(e); });
sp.addEventListener('pointerup', () => sDrag = false);
sp.addEventListener('dblclick', () => { G.spinA = G.spinB = 0; setSpinDot(); });

const fine = $('#fine');
let fDrag = null;
fine.addEventListener('pointerdown', e => { if (!canAim()) return; fine.setPointerCapture(e.pointerId); fDrag = e.clientX; });
fine.addEventListener('pointermove', e => { if (fDrag == null) return; const d = e.clientX - fDrag; fDrag = e.clientX; G.ang += d * 0.0007; fine.style.backgroundPositionX = (parseFloat(fine.style.backgroundPositionX || 0) + d) + 'px'; if (Math.abs(d) > 2) snd('tick'); });
fine.addEventListener('pointerup', () => fDrag = null);

const canAim = () => G.phase === 'aim' && isHumanTurn() && !cur().remote;
$('#place').onclick = () => { G.placing = false; $('#place').classList.add('hide'); kitchenLine.visible = false; G.view = G.prefView || 'fp'; };
$('#bView').onclick = () => { G.view = G.view === 'fp' ? 'top' : 'fp'; if (!G.placing) G.prefView = G.view; };
$('#bMenu').onclick = () => openMenu(true);

// trascinamento sul tavolo
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(0.8 + R));
function tablePoint(e) {
  ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  const p = new THREE.Vector3(); if (!ray.ray.intersectPlane(plane, p)) return null; return { x: p.x, z: p.z };
}
const pointers = new Map(); let drag = null, pinch0 = 0;
canvas.addEventListener('pointerdown', e => {
  ac(); canvas.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); drag = null; return; }
  if (!canAim()) { drag = { kind: 'look', x: e.clientX, y: e.clientY }; return; }
  const p = tablePoint(e), cue = cueBall();
  if (G.match.ballInHand && p && (G.placing || G.view === 'top') && Math.hypot(p.x - cue.x, p.z - cue.z) < 0.09) {
    G.placing = true; $('#place').classList.remove('hide'); drag = { kind: 'cue' }; return;
  }
  drag = { kind: G.view === 'top' ? 'aimTop' : 'aim', x: e.clientX, y: e.clientY };
  if (drag.kind === 'aimTop' && p) G.ang = Math.atan2(p.z - cue.z, p.x - cue.x);
});
canvas.addEventListener('pointermove', e => {
  if (!pointers.has(e.pointerId)) return;
  const prev = pointers.get(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) { const [a, b] = [...pointers.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch0) G.camDist = Math.max(0.35, Math.min(2.2, G.camDist * pinch0 / d)); pinch0 = d; return; }
  if (!drag) return;
  const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
  if (drag.kind === 'cue') {
    const p = tablePoint(e), cue = cueBall(); if (!p) return;
    let x = p.x, z = p.z; const lim = T.L / 2 - R - 0.001, limz = T.W / 2 - R - 0.001;
    x = Math.max(-lim, Math.min(G.match.kitchen ? -T.L / 4 : lim, x)); z = Math.max(-limz, Math.min(limz, z));
    if (P.freeSpot(balls, x, z, cue)) { cue.x = x; cue.z = z; }
  } else if (drag.kind === 'aimTop') {
    const p = tablePoint(e), cue = cueBall(); if (p && Math.hypot(p.x - cue.x, p.z - cue.z) > 0.03) G.ang = Math.atan2(p.z - cue.z, p.x - cue.x);
  } else if (drag.kind === 'aim') {
    // più lento se muovi piano: mira precisa
    const sp = Math.abs(dx); const k = sp < 3 ? 0.0011 : sp < 10 ? 0.0024 : 0.0042;
    G.ang += dx * k; G.camPitch = Math.max(0.08, Math.min(1.25, G.camPitch + dy * 0.004));
  } else if (drag.kind === 'look') {
    G.lookYaw = (G.lookYaw || 0) + dx * 0.004; G.camPitch = Math.max(0.08, Math.min(1.25, G.camPitch + dy * 0.004));
  }
});
const ptrEnd = e => { pointers.delete(e.pointerId); if (pointers.size < 2) pinch0 = 0; if (pointers.size === 0) drag = null; };
canvas.addEventListener('pointerup', ptrEnd); canvas.addEventListener('pointercancel', ptrEnd);
canvas.addEventListener('wheel', e => { G.camDist = Math.max(0.35, Math.min(2.2, G.camDist * (1 + Math.sign(e.deltaY) * 0.08))); }, { passive: true });
const keys = {};
addEventListener('keydown', e => {
  if ($('#menu').classList.contains('hide') === false) return;
  keys[e.code] = true;
  if (e.code === 'KeyV') $('#bView').click();
  if (e.code === 'Space' && canAim() && G.charge == null) { G.charge = 0; e.preventDefault(); }
  if (e.code === 'Escape') openMenu(true);
});
addEventListener('keyup', e => {
  keys[e.code] = false;
  if (e.code === 'Space' && G.charge != null) { const p = G.charge; G.charge = null; pfill.style.height = '0'; if (p > 0.02 && canAim()) shoot(p); }
});

// ---------- telecamera ----------
const _v = new THREE.Vector3(), _w = new THREE.Vector3();
function updateCamera(dt) {
  const cue = cueBall(), off = tableGroup.position.y;
  let pos = _v, look = _w;
  const portrait = innerHeight > innerWidth;
  if (G.phase === 'menu') {
    const t = performance.now() / 1000 * 0.06;
    pos.set(Math.cos(t) * 3.1, 1.9, Math.sin(t) * 2.4); look.set(0, 0.75, 0);
  } else if ((G.view === 'top' || G.placing) && G.phase !== 'roll' && G.phase !== 'stroke') {
    const fov = camera.fov * Math.PI / 180, a = camera.aspect;
    const needW = portrait ? T.W + 0.5 : T.L + 0.55, needH = portrait ? T.L + 0.55 : T.W + 0.5;
    const h = Math.max(needH / 2 / Math.tan(fov / 2), needW / 2 / (Math.tan(fov / 2) * a)) * 1.04;
    pos.set(0, off + h, 0.0001); look.set(0, off, 0);
    camera.up.set(portrait ? -1 : 0, 0, portrait ? 0 : -1);
  } else if (G.phase === 'roll' || G.phase === 'wait' || G.phase === 'over' || G.phase === 'settle') {
    // regia: segue l'azione dall'alto, alle spalle del tiro
    const moving = balls.filter(b => b.on && b.moving);
    if (moving.length) { let x = 0, z = 0; for (const b of moving) { x += b.x; z += b.z; } G.follow.lerp(new THREE.Vector3(x / moving.length, 0, z / moving.length), Math.min(1, dt * 1.5)); }
    const a = G.lastShot ? G.lastShot.ang : 0;
    pos.set(G.follow.x * 0.4 - Math.cos(a) * 1.5, off + 1.45, G.follow.z * 0.4 - Math.sin(a) * 1.5);
    look.set(G.follow.x * 0.7, off, G.follow.z * 0.7);
    camera.up.set(0, 1, 0);
  } else {
    const a = G.ang + (G.phase === 'aim' ? 0 : 0), d = G.camDist, ph = G.camPitch;
    pos.set(cue.x - Math.cos(a) * d * Math.cos(ph), off + R + 0.02 + d * Math.sin(ph), cue.z - Math.sin(a) * d * Math.cos(ph));
    look.set(cue.x + Math.cos(a) * 0.35, off + R, cue.z + Math.sin(a) * 0.35);
    camera.up.set(0, 1, 0);
  }
  if (lampObj) lampObj.visible = G.camPos.y < 2.45;
  const k = 1 - Math.exp(-dt * (G.phase === 'aim' || G.phase === 'botAim' ? 14 : 3.2));
  G.camPos.lerp(pos, k); G.camLook.lerp(look, k);
  camera.position.copy(G.camPos);
  if (G.shake > 0) { G.shake = Math.max(0, G.shake - dt); camera.position.x += (Math.random() - .5) * G.shake * 0.08; camera.position.y += (Math.random() - .5) * G.shake * 0.08; }
  camera.lookAt(G.camLook);
}

// ---------- disegno di stecca e linee ----------
function updateCueAndGuides(dt) {
  const cue = cueBall();
  const aiming = (G.phase === 'aim' && !G.placing) || G.phase === 'botAim' || G.phase === 'stroke' || G.phase === 'remote';
  cueRig.visible = aiming && cue.on;
  if (cueRig.visible) {
    let back = 0.03 + G.power * 0.28;
    if (G.charge != null) back = 0.03 + G.charge * 0.28;
    if (G.phase === 'aim' || G.phase === 'remote') back += Math.sin(performance.now() / 260) * 0.006;
    if (G.phase === 'stroke') {
      const t = G.strokeT, p = G.strokePow;
      back = t < 0.08 ? 0.03 + p * 0.28 : Math.max(-0.05, 0.03 + p * 0.28 - (t - 0.08) / 0.07 * (0.06 + p * 0.28));
    }
    const a = G.ang, el = 0.09;
    cueRig.position.set(cue.x - Math.cos(a) * (R + back), R + 0.004 + Math.sin(el) * (R + back) * 0.3, cue.z - Math.sin(a) * (R + back));
    cueRig.rotation.set(0, -a - Math.PI / 2, 0);
    cueMesh.rotation.set(-el, 0, 0);
    // posizione verticale/laterale del puntale secondo l'effetto
    cueMesh.position.set(G.spinA * R * 0.6, G.spinB * R * 0.6, 0);
  }
  const showG = CFG.guide !== 'niente' && (G.phase === 'aim' && isHumanTurn()) && cue.on;
  guides.visible = showG;
  if (showG) {
    const tr = P.aimTrace(balls, cue, G.ang), long = CFG.guide === 'lunga';
    const W1 = (G.view === 'top' || G.placing) ? 0.0055 : 0.0022, W2 = W1 * 0.75;
    strip(gLine, cue.x, cue.z, tr.gx, tr.gz, W1);
    gGhost.position.set(tr.gx, 0.0014, tr.gz); gGhost.visible = true;
    const legal = Ru.legalTargets(G.match, balls);
    gBad.visible = !!tr.ball && !legal.includes(tr.ball.id);
    gBad.position.set(tr.gx, 0.0016, tr.gz);
    if (tr.ball) {
      const lo = (long ? 0.9 : 0.32) * Math.max(0.15, tr.cut);
      strip(gObj, tr.ball.x, tr.ball.z, tr.ball.x + tr.ox * lo, tr.ball.z + tr.oz * lo, W1);
      const cl = Math.hypot(tr.cx, tr.cz), lc = (long ? 0.5 : 0.18) * cl;
      if (cl > 0.01) strip(gCue, tr.gx, tr.gz, tr.gx + tr.cx / cl * lc, tr.gz + tr.cz / cl * lc, W2); else gCue.visible = false;
    } else if (tr.rail) {
      gObj.visible = false; const l = long ? 0.5 : 0.18;
      strip(gCue, tr.gx, tr.gz, tr.gx + tr.rail.rx * l, tr.gz + tr.rail.rz * l, W2);
    } else { gObj.visible = gCue.visible = false; }
  }
}

// ---------- ciclo principale ----------
let last = performance.now(), simAcc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (FAST) dt *= 3;
  if (G.charge != null) { G.charge = Math.min(1, G.charge + dt * 0.75); pfill.style.height = (G.charge * 100) + '%'; }
  if (canAim() && G.dizzy && G.dizzy[G.match.turn] > 0) G.ang += Math.sin(performance.now() / 260) * dt * 0.5;
  if (canAim()) {
    const fineK = keys.ShiftLeft || keys.ShiftRight ? 0.08 : 0.6;
    if (keys.ArrowLeft) G.ang -= dt * fineK; if (keys.ArrowRight) G.ang += dt * fineK;
    if (keys.ArrowUp) G.camPitch = Math.min(1.25, G.camPitch + dt); if (keys.ArrowDown) G.camPitch = Math.max(0.08, G.camPitch - dt);
  }
  if (G.phase === 'botAim') {
    const b = G.botPlan; b.t += dt;
    let d = b.ang - b.from; d = Math.atan2(Math.sin(d), Math.cos(d));
    const k = Math.min(1, b.t / 1.1), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    G.ang = b.from + d * e;
    G.power = b.t > 1.2 ? Math.min(1, (b.t - 1.2) / 0.5) * Math.pow((b.speed - 0.25) / 7.8, 1 / 1.6) : 0;
    if (b.t > 1.9) { G.ang = b.ang; const p = Math.pow(Math.max(0, (b.speed - 0.25) / 7.8), 1 / 1.6); G.power = 0; shoot(p); }
  }
  if (G.phase === 'stroke') { G.strokeT += dt; if (G.strokeT >= 0.15) doStrike(); }
  if (G.phase === 'roll' || G.phase === 'settle') {
    simAcc += dt; let n = 0;
    while (simAcc >= P.DT && n < 200) {
      const before = G.events.length;
      P.step(balls, P.DT, G.events, G.simT, G.phase === 'roll' ? G.mods : null); G.simT += P.DT; simAcc -= P.DT; n++;
      if (G.phase === 'roll' && CFG.caos) pickTokens();
      for (let i = before; i < G.events.length; i++) {
        const e = G.events[i];
        if (e.t === 'ball') snd('ball', e.v / 3); else if (e.t === 'rail') snd('rail', e.v / 3); else if (e.t === 'pot') { snd('pot'); sinkBall(e.a, e.pocket); }
      }
    }
    G.rollT += dt;
    if (!P.anyMoving(balls) && sinking.length === 0) { if (G.phase === 'settle') endSettle(); else endShot(); }
  }
  netTick();
  placeMeshes(dt);
  updateSinking(dt);
  updateCueAndGuides(dt);
  updateCamera(dt);
  composer.render();
}


// ---------- modalità Caos: gettoni sul panno e poteri ----------
const POW = {
  bomba: { icon: '💣', name: 'Bomba', desc: 'fa saltare in aria le palle dell\'avversario' },
  larghe: { icon: '🕳️', name: 'Buche larghe', desc: 'per questo tiro le buche sono enormi' },
  calamita: { icon: '🧲', name: 'Calamita', desc: 'le tue palle vengono attirate dalle buche' },
  mazzata: { icon: '🏏', name: 'Mazzata', desc: 'stecca in testa all\'avversario: al prossimo tiro gli trema la mano' },
  fantasma: { icon: '👻', name: 'Fantasma', desc: 'la bianca attraversa le palle dell\'avversario' },
};
G.tokens = []; G.held = [[], []]; G.dizzy = [0, 0];
const tokenGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.004, 24);
function tokenTex(icon) { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#ffd166'; g.beginPath(); g.arc(64, 64, 62, 0, 7); g.fill(); g.fillStyle = '#7a1424'; g.beginPath(); g.arc(64, 64, 52, 0, 7); g.fill(); g.font = '64px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(icon, 64, 70); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
function spawnToken() {
  const kinds = Object.keys(POW), kind = kinds[Math.floor(Math.random() * kinds.length)];
  for (let k = 0; k < 40; k++) {
    const x = (Math.random() - .5) * (T.L - 0.3), z = (Math.random() - .5) * (T.W - 0.3);
    if (!P.freeSpot(balls, x, z) || G.tokens.some(t => Math.hypot(t.x - x, t.z - z) < 0.2)) continue;
    const m = new THREE.Mesh(tokenGeo, [new THREE.MeshStandardMaterial({ color: 0xd9b25f, metalness: 1, roughness: 0.3 }), new THREE.MeshStandardMaterial({ map: tokenTex(POW[kind].icon), emissive: 0x442200, emissiveMap: tokenTex(POW[kind].icon), emissiveIntensity: 0.6 }), new THREE.MeshStandardMaterial({ color: 0xd9b25f })]);
    m.position.set(x, 0.003, z); tableGroup.add(m);
    G.tokens.push({ x, z, kind, m }); return;
  }
}
function clearTokens() { for (const t of G.tokens || []) tableGroup.remove(t.m); G.tokens = []; }
function pickTokens() {
  const c = cueBall(); if (!c.on) return;
  for (let i = G.tokens.length - 1; i >= 0; i--) {
    const t = G.tokens[i]; if (Math.hypot(t.x - c.x, t.z - c.z) > 0.055) continue;
    tableGroup.remove(t.m); G.tokens.splice(i, 1);
    const who = G.shooter ?? G.match.turn;
    if (G.held[who].length < 2) { G.held[who].push(t.kind); say(`${G.players[who].name} prende ${POW[t.kind].icon} ${POW[t.kind].name}!`); snd('tick'); snd('cue', 0.3); }
  }
}
function opponentIds(turn) {
  const m = G.match, g = m.groups[1 - turn];
  if (!g) return balls.filter(b => b.on && b.id !== 0 && b.id !== 8).map(b => b.id);
  return balls.filter(b => b.on && Ru.groupOf(b.id) === g).map(b => b.id);
}
function myIds(turn) {
  const m = G.match, g = m.groups[turn];
  if (!g) return balls.filter(b => b.on && b.id !== 0 && b.id !== 8).map(b => b.id);
  const ids = balls.filter(b => b.on && Ru.groupOf(b.id) === g).map(b => b.id); return ids.length ? ids : [8];
}
function usePower(kind, byBot) {
  const m = G.match, turn = m.turn, i = G.held[turn].indexOf(kind);
  if (i < 0 || (G.phase !== 'aim' && G.phase !== 'botThink')) return false;
  G.held[turn].splice(i, 1);
  say(`${cur().name}: ${POW[kind].icon} ${POW[kind].name}!`);
  if (kind === 'bomba') {
    const opp = balls.filter(b => opponentIds(turn).includes(b.id)); if (!opp.length) return true;
    const cx = opp.reduce((a, b) => a + b.x, 0) / opp.length, cz = opp.reduce((a, b) => a + b.z, 0) / opp.length;
    const tgt = opp.sort((a, b) => Math.hypot(a.x - cx, a.z - cz) - Math.hypot(b.x - cx, b.z - cz))[0];
    for (const b of balls) { if (!b.on) continue; const dx = b.x - tgt.x, dz = b.z - tgt.z, d = Math.hypot(dx, dz); if (d > 0.45) continue; const k = 2.4 * (1 - d / 0.45), l = d || 1; const a = d < 1e-4 ? Math.random() * 6.28 : 0; b.vx += (d < 1e-4 ? Math.cos(a) : dx / l) * k; b.vz += (d < 1e-4 ? Math.sin(a) : dz / l) * k; b.moving = true; }
    boom(tgt.x, tgt.z);
    G.events = []; G.simT = 0; G.phase = 'settle'; G.afterSettle = byBot ? null : () => startTurn(true);
  } else if (kind === 'mazzata') {
    G.dizzy[1 - turn] = 1; whack();
  } else if (kind === 'larghe') { G.mods = { ...(G.mods || {}), pocketK: 1.7 }; }
  else if (kind === 'calamita') { G.mods = { ...(G.mods || {}), magnet: new Set(myIds(turn)) }; }
  else if (kind === 'fantasma') { G.mods = { ...(G.mods || {}), ghost: new Set(opponentIds(turn)) }; }
  showMods(); showPowers();
  return true;
}
function endSettle() {
  // le palle andate in buca con la bomba restano fuori (l'8 e la bianca tornano)
  const e8 = balls.find(b => b.id === 8);
  if (!e8.on) { e8.on = true; e8.x = T.L / 4; e8.z = 0; while (!P.freeSpot(balls, e8.x, e8.z, e8)) e8.x += 0.01; ballMeshes.get(8).visible = true; }
  const c = cueBall(); if (!c.on) { c.on = true; c.x = -T.L / 4; c.z = 0; while (!P.freeSpot(balls, c.x, c.z, c)) c.z += 0.01; ballMeshes.get(0).visible = true; }
  G.phase = 'aim'; updateHud();
  const f = G.afterSettle; G.afterSettle = null; if (f) f();
}
function boom(x, z) {
  snd('pot'); snd('foul');
  const fl = new THREE.PointLight(0xffa040, 6, 2); fl.position.set(x, 0.2, z); tableGroup.add(fl);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffc070, transparent: true, toneMapped: false })); ball.position.set(x, 0.03, z); tableGroup.add(ball);
  let t = 0; const iv = setInterval(() => { t += 0.03; ball.scale.setScalar(1 + t * 14); ball.material.opacity = Math.max(0, 1 - t * 2.2); fl.intensity = Math.max(0, 6 - t * 14); if (t > 0.5) { clearInterval(iv); tableGroup.remove(ball); tableGroup.remove(fl); } }, 30);
  G.shake = 0.5;
}
function whack() {
  const el = document.createElement('div'); el.textContent = '🏏'; el.style.cssText = 'position:fixed;font-size:160px;left:50%;top:40%;transform:translate(-50%,-50%) rotate(-80deg);transition:transform .25s cubic-bezier(.5,-0.5,.6,1.6);pointer-events:none;z-index:9';
  document.body.appendChild(el); requestAnimationFrame(() => { el.style.transform = 'translate(-50%,-50%) rotate(40deg)'; });
  setTimeout(() => { snd('rail', 1); snd('foul'); G.shake = 0.6; const o = $('#p' + (1 - G.match.turn)); o.style.transform = 'scale(1.15) rotate(-6deg)'; o.querySelector('.av').textContent = '😵'; setTimeout(() => { o.style.transform = ''; updateHud(); }, 900); }, 220);
  setTimeout(() => el.remove(), 700);
}
function showPowers() {
  const box = $('#powers'); if (!box) return;
  const m = G.match; if (!m || !CFG.caos || cur().bot) { box.innerHTML = ''; return; }
  box.innerHTML = G.held[m.turn].map(k => `<button class="pw" data-pw="${k}" title="${POW[k].desc}">${POW[k].icon}<span>${POW[k].name}</span></button>`).join('');
}
function showMods() {
  const el = $('#mods'); if (!el) return; const m = G.mods; if (!m) { el.textContent = ''; return; }
  el.textContent = [m.pocketK ? '🕳️ buche larghe' : '', m.magnet ? '🧲 calamita' : '', m.ghost ? '👻 fantasma' : ''].filter(Boolean).join(' · ');
}
document.addEventListener('click', e => { const b = e.target.closest('[data-pw]'); if (b && canAim()) usePower(b.dataset.pw); });


// ---------- partita online: ognuno sul suo telefono ----------
// Chi crea la partita fa da arbitro: decide i falli e manda la posizione esatta delle palle dopo ogni tiro.
G.net = null;
function netSend(m) { const n = G.net; if (!n) return; if (DEBUG) (G.sentlog = G.sentlog || []).push(m.t + (n.conn ? '' : '(noconn)')); if (n.role === 'host') { if (n.conn) n.room.send(n.conn, m); } else n.room.send(m); }
function onNet(m) {
  if (!m || m.t === 'ping') return;
  if (DEBUG) (G.netlog = G.netlog || []).push(m.t + '@' + G.phase);
  if (m.t === 'hello' && G.net.role === 'host') { G.net.peerName = (m.name || 'Ospite').slice(0, 14); $('#onlineState').textContent = `${G.net.peerName} è entrato: si gioca!`; setTimeout(() => newGame(), 700); return; }
  if (m.t === 'start' && G.net.role === 'guest') { newGame(m); return; }
  if (m.t === 'aim' && G.phase === 'remote') { G.ang = m.ang; G.spinA = m.a; G.spinB = m.b; setSpinDot(); G.power = m.p || 0; const c = cueBall(); if (m.cx != null && P.freeSpot(balls, m.cx, m.cz, c)) { c.x = m.cx; c.z = m.cz; } return; }
  if (m.t === 'shot') { if (G.phase !== 'remote') { G.pendingShot = m; return; } applyShot(m); return; }
  if (m.t === 'state') { G.pendingState = m; tryState(); return; }
  if (m.t === 'resync' && G.net.role === 'guest') {
    if (m.moving) return; // arriverà lo stato a fine tiro
    if (!G.match) newGame({ names: m.names, balls: m.balls });
    G.pendingState = { ...m, msg: '', foul: false, end: false }; G.phase = 'waitState'; tryState(); return;
  }
  if (m.t === 'again' && G.net.role === 'host') { newGame(); return; }
}
function applyShot(m) {
  {
    const c = cueBall(); c.on = true; c.x = m.cx; c.z = m.cz; ballMeshes.get(0).visible = true;
    G.ang = m.ang; G.spinA = m.a; G.spinB = m.b; G.power = 0; G.shooter = G.match.turn;
    G.phase = 'stroke'; G.strokeT = 0; G.strokePow = m.p; G.lastShot = { speed: m.speed, a: m.a, b: m.b, ang: m.ang };
  }
}
function tryState() {
  const st = G.pendingState; if (!st || G.phase !== 'waitState') return;
  G.pendingState = null;
  for (const b of st.balls) { const x = balls.find(q => q.id === b.id); Object.assign(x, { x: b.x, z: b.z, on: b.on, vx: 0, vz: 0, wx: 0, wy: 0, wz: 0, moving: false }); const mesh = ballMeshes.get(b.id); if (mesh) mesh.visible = b.on; }
  G.match = st.match; if (st.msg) say(st.msg, st.foul); if (st.foul) snd('foul');
  updateHud();
  if (st.end) { G.phase = 'over'; setTimeout(() => gameOver(st.msg), 1400); return; }
  G.phase = 'wait'; setTimeout(() => startTurn(false), st.msg ? 900 : 350);
}
let aimSent = 0;
function netTick() {
  if (!G.net || !G.match || cur().remote || (G.phase !== 'aim')) return;
  const now = performance.now(); if (now - aimSent < 90) return; aimSent = now;
  const c = cueBall(); netSend({ t: 'aim', ang: G.ang, a: G.spinA, b: G.spinB, p: G.charge != null ? G.charge : G.power, cx: c.x, cz: c.z });
}
function hostOnline() {
  const code = randomCode(); G.net = { role: 'host', local: 0, code };
  $('#onlineState').textContent = 'Apro la stanza…';
  G.net.room = hostRoom(code, {
    onOpen() { const url = new URL(`biliardo.html?join=${code}${Q.get('peer') ? '&peer=' + Q.get('peer') : ''}`, location.href).href; G.net.url = url; $('#onlineState').innerHTML = `Codice <b style="font-size:26px;letter-spacing:4px">${code}</b> · manda questo link al tuo amico:<br><a href="${url}" style="color:#ffd166;word-break:break-all">${url}</a>`; if (navigator.share) $('#shareBtn').classList.remove('hide'); },
    onMsg(id, m) {
      if (m && m.t === 'ping') { G.net.room.send(id, { t: 'pong' }); if (G.net.conn && G.net.conn !== id && !G.net.alive) G.net.conn = null; }
      if (!G.net.conn) { G.net.conn = id; if (G.match && G.players[1].remote) netSend({ t: 'resync', names: G.match.names, balls: balls.map(b => ({ id: b.id, x: b.x, z: b.z, on: b.on })), match: G.match, moving: G.phase === 'roll' || G.phase === 'stroke' }); }
      if (id === G.net.conn) { G.net.alive = true; onNet(m); }
    },
    onClose(id) { if (id === G.net.conn) { G.net.conn = null; G.net.alive = false; say('Il tuo amico si è scollegato: aspetto che rientri', true); } },
    onError(t) { $('#onlineState').textContent = 'Non riesco ad aprire la stanza (' + t + ')'; },
  });
}
function joinOnline(code) {
  G.net = { role: 'guest', local: 1, code };
  $('#onlineState').textContent = 'Mi collego…';
  G.net.room = joinRoom(code, {
    onState(s) { $('#onlineState').textContent = s === 'open' ? 'Collegato! Aspetto il tavolo…' : s === 'noroom' ? 'Non trovo la stanza: controlla il codice' : s === 'lost' ? 'Connessione persa, riprovo…' : 'Mi collego…'; if (s === 'open') G.net.room.send({ t: 'hello', name: CFG.n0.trim() || 'Ospite' }); },
    onMsg: onNet,
  });
}

// ---------- menu ----------
function openMenu(inGame) {
  $('#menu').classList.remove('hide'); $('#resume').classList.toggle('hide', !inGame || !G.match || G.phase === 'over');
  if (!inGame) G.phase = 'menu';
}
function fillMenu() {
  const sel = (sel, attr, val) => document.querySelectorAll(sel).forEach(b => b.classList.toggle('sel', b.dataset[attr] === val));
  sel('#modes .opt', 'm', CFG.mode); const cz = $('#caosBtn'); if (cz) { cz.classList.toggle('sel', CFG.caos); cz.classList.toggle('hide', CFG.mode === 'free'); } const ca = $('#casaBtn'); if (ca) { ca.classList.toggle('sel', CFG.casa); ca.classList.toggle('hide', CFG.mode === 'free'); } sel('#levels .chip', 'l', CFG.level); sel('#guides .chip', 'g', CFG.guide);
  $('#n1wrap').classList.toggle('hide', CFG.mode !== 'duo'); $('#onlineBox').classList.toggle('hide', CFG.mode !== 'online'); $('#go').classList.toggle('hide', CFG.mode === 'online'); $('#lvwrap').classList.toggle('hide', CFG.mode !== 'bot');
  $('#n0').value = CFG.n0; $('#n1').value = CFG.n1;
  $('#cues').innerHTML = CUES.map(c => `<button class="cuesw${c.id === CFG.cue ? ' sel' : ''}" data-c="${c.id}" style="background:${c.css}"><span>${c.name}</span></button>`).join('');
  $('#sets').innerHTML = SETS.map(s => `<button class="sw${s.id === CFG.set ? ' sel' : ''}" data-s="${s.id}" title="${s.name}" style="background:conic-gradient(${s.colors[1]} 0 25%,${s.colors[2]} 0 50%,${s.colors[3]} 0 75%,${s.colors[8]} 0)"></button>`).join('');
  $('#felts').innerHTML = FELTS.map(f => `<button class="sw${f.id === CFG.felt ? ' sel' : ''}" data-f="${f.id}" title="${f.name}" style="background:radial-gradient(circle at 40% 35%,${f.c},#000 140%)"></button>`).join('');
}
document.addEventListener('click', e => {
  const t = e.target.closest('button'); if (!t || $('#menu').classList.contains('hide')) return;
  if (t.dataset.m) CFG.mode = t.dataset.m;
  else if (t.dataset.l) CFG.level = t.dataset.l;
  else if (t.dataset.g) CFG.guide = t.dataset.g;
  else if (t.dataset.c) { CFG.cue = t.dataset.c; setCue(CFG.cue); }
  else if (t.dataset.s) { CFG.set = t.dataset.s; syncBallMeshes(); updateHud(); }
  else if (t.dataset.f) { CFG.felt = t.dataset.f; applyFelt(); }
  else if (t.dataset.caos != null) { CFG.caos = !CFG.caos; }
  else if (t.dataset.casa != null) { CFG.casa = !CFG.casa; }
  else return;
  saveCfg(); fillMenu();
});
$('#n0').oninput = e => { CFG.n0 = e.target.value; saveCfg(); };
$('#n1').oninput = e => { CFG.n1 = e.target.value; saveCfg(); };
$('#go').onclick = () => { ac(); saveCfg(); newGame(); };
$('#hostBtn').onclick = () => { ac(); saveCfg(); if (!G.net) hostOnline(); };
$('#joinBtn').onclick = () => { ac(); saveCfg(); const c = $('#joinCode').value.trim().toUpperCase(); if (c.length === 4 && !G.net) joinOnline(c); };
$('#shareBtn').onclick = () => { try { navigator.share({ title: 'Biliardo al Ridotto', text: 'Sfidami a biliardo!', url: G.net.url }); } catch (e) { } };
$('#resume').onclick = () => { $('#menu').classList.add('hide'); };
$('#again').onclick = () => { if (G.net && G.net.role === 'guest') { netSend({ t: 'again' }); $('#over').classList.add('hide'); } else newGame(); };
$('#toMenu').onclick = () => { $('#over').classList.add('hide'); $('#hud').classList.add('hide'); G.match = null; openMenu(false); };

// ---------- avvio ----------
applyFelt(); buildTable(); buildRoom();
balls = P.rack(); syncBallMeshes(); setCue(CFG.cue);
{ // riflessi morbidi: una stanza scura con due lampade calde sopra il tavolo (niente softbox da studio)
  const es = new THREE.Scene();
  es.add(new THREE.Mesh(new THREE.BoxGeometry(12, 6, 12), new THREE.MeshBasicMaterial({ color: 0x2a1c14, side: THREE.BackSide })));
  for (const x of [-0.9, 0.9]) { const l = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.5), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.7, 1.1), side: THREE.DoubleSide })); l.position.set(x, 2.2, 0); l.rotation.x = Math.PI / 2; es.add(l); }
  const floorL = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshBasicMaterial({ color: 0x120c08 })); floorL.rotation.x = -Math.PI / 2; floorL.position.y = -1.5; es.add(floorL);
  scene.environment = pmrem.fromScene(es, 0.04).texture;
}
fillMenu(); resize(); requestAnimationFrame(frame);
G.camPos.set(3, 2, 2);

if (Q.get('join')) { CFG.mode = 'online'; fillMenu(); $('#joinCode').value = Q.get('join').toUpperCase(); }
if (DEBUG) {
  window.__net = () => G.net; window.__scene = scene; window.__cueRig = cueRig; window.__guides = guides; window.__composer = composer; window.__G = G; window.__balls = () => balls; window.__CFG = CFG; window.__new = newGame; window.__shoot = shoot;
  window.__setView = v => { G.view = v; };
}
if (Q.has('auto')) {
  // test: entrambi i giocatori sono bot
  CFG.mode = Q.get('auto') || 'bot'; CFG.level = 'campione'; CFG.caos = Q.has('caos'); CFG.casa = Q.has('casa');
  newGame(); G.players[0].bot = true; G.players[1].bot = CFG.mode !== 'free'; startTurn(true);
}
