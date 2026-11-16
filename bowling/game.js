// Bowling del Ridotto: sala, pista, flusso di gioco, telefoni come palla.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { L, SPECIALS, newBall, step as laneStep, pinSpots, heightAt } from './lane.js';
import * as Pins from './pins.js';
import * as Sc from './score.js';
import { hostRoom, randomCode } from '../net.js';

const Q = new URLSearchParams(location.search);
const DEBUG = Q.has('debug'), FAST = Q.has('fast');
const MOBILE = matchMedia('(pointer:coarse)').matches;
const $ = s => document.querySelector(s);
const COLORS = ['#ff3d9a', '#38e8ff', '#ffd166', '#7cff6b', '#b26bff', '#ff7b3d'];
const SPEC_ORDER = ['dossi', 'muri', 'stretta', 'salto', 'girandola'];

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ canvas: $('#gl'), antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, MOBILE ? 1.5 : 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x07060c); scene.fog = new THREE.Fog(0x07060c, 14, 34);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 80);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new ShaderPass({ uniforms: { tDiffuse: { value: null } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); if (!(c.r == c.r) || !(c.g == c.g) || !(c.b == c.b)) c = vec4(0.0,0.0,0.0,1.0); gl_FragColor = vec4(clamp(c.rgb, 0.0, 60.0), 1.0); }' }));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.5, 0.9));
composer.addPass(new OutputPass());
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); composer.setSize(w, h); camera.aspect = w / h; camera.fov = w < h ? 70 : 55; camera.updateProjectionMatrix(); }
addEventListener('resize', resize);

// ---------- texture ----------
function ctex(w, h, draw, rep) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); } return t; }
function laneTex() {
  return ctex(256, 2048, (g, w, h) => {
    const boards = 39, bw = w / boards;
    for (let i = 0; i < boards; i++) { g.fillStyle = `hsl(${32 + Math.random() * 6},${45 + Math.random() * 10}%,${58 + Math.random() * 8}%)`; g.fillRect(i * bw, 0, bw, h); g.fillStyle = 'rgba(80,40,10,.25)'; g.fillRect(i * bw, 0, 1, h); }
    for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(90,50,20,${Math.random() * .08})`; g.fillRect(Math.random() * w, Math.random() * h, 1, 6 + Math.random() * 30); }
    // frecce e punti di mira (a ~4,6 m e ~2 m dalla linea di fallo; texture: y=0 fondo pista)
    const yOf = z => h * (1 - z / 19.4);
    g.fillStyle = '#5a1a12';
    for (const b of [5, 10, 15, 20, 25, 30, 35]) { const x = b * bw, y = yOf(4.6 + Math.abs(b - 20) * 0.05); g.beginPath(); g.moveTo(x, y - 30); g.lineTo(x - 6, y + 10); g.lineTo(x + 6, y + 10); g.fill(); }
    for (const b of [3, 5, 8, 11, 14, 25, 28, 31, 34, 36]) { g.beginPath(); g.arc(b * bw, yOf(2.1), 3, 0, 7); g.fill(); }
  });
}
function ballTex(color) {
  return ctex(512, 256, (g, w, h) => {
    const c = new THREE.Color(color);
    g.fillStyle = color; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) {
      const k = Math.random(); g.strokeStyle = k < .5 ? '#' + c.clone().multiplyScalar(0.45).getHexString() : '#' + c.clone().lerp(new THREE.Color('#ffffff'), 0.45).getHexString();
      g.globalAlpha = 0.25 + Math.random() * 0.35; g.lineWidth = 3 + Math.random() * 14;
      g.beginPath(); let x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y);
      for (let s = 0; s < 4; s++) g.bezierCurveTo(x + Math.random() * 120 - 60, y + Math.random() * 80 - 40, x + Math.random() * 160 - 80, y + Math.random() * 80 - 40, x += Math.random() * 120 - 60, y += Math.random() * 60 - 30);
      g.stroke();
    }
    g.globalAlpha = 1;
    for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * .5})`; g.fillRect(Math.random() * w, Math.random() * h, 1, 1); }
    g.fillStyle = '#050505';
    for (const [u, v, r] of [[0.25, 0.22, 10], [0.235, 0.32, 9], [0.265, 0.32, 9]]) { g.beginPath(); g.ellipse(u * w, v * h, r, r * 0.9, 0, 0, 7); g.fill(); }
  });
}
function pinTex() {
  return ctex(64, 512, (g, w, h) => {
    g.fillStyle = '#f7f5f0'; g.fillRect(0, 0, w, h);
    const v = y => h * (1 - y / 0.381);
    g.fillStyle = '#d0141e'; g.fillRect(0, v(0.262), w, v(0.252) - v(0.262)); g.fillRect(0, v(0.243), w, v(0.233) - v(0.243));
  });
}

// ---------- sala ----------
const LANES_X = [-4.4, -2.2, 0, 2.2, 4.4];
const laneMat = new THREE.MeshPhysicalMaterial({ map: laneTex(), roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.04 });
const pinGeo = (() => {
  const prof = [[0, 0], [0.026, 0], [0.036, 0.008], [0.048, 0.04], [0.058, 0.08], [0.0605, 0.114], [0.057, 0.15], [0.045, 0.2], [0.03, 0.24], [0.0235, 0.26], [0.024, 0.28], [0.03, 0.31], [0.032, 0.33], [0.029, 0.355], [0.018, 0.374], [0, 0.381]];
  const pts = []; for (let i = 0; i <= 60; i++) { const y = i / 60 * 0.381; let k = 0; while (k < prof.length - 2 && prof[k + 1][1] < y) k++; const [r0, y0] = prof[k], [r1, y1] = prof[k + 1]; const r = r0 + (r1 - r0) * ((y - y0) / Math.max(1e-6, y1 - y0)); pts.push(new THREE.Vector2(Math.max(0.0001, r), y)); }
  const g = new THREE.LatheGeometry(pts, 28); g.translate(0, -Pins.PIN.com, 0); return g;
})();
const pinMat = new THREE.MeshPhysicalMaterial({ map: pinTex(), roughness: 0.25, clearcoat: 0.8, color: 0xdddddd });
function buildAlley() {
  const neonMats = [];
  for (const lx of LANES_X) {
    const grp = new THREE.Group(); grp.position.x = lx;
    const lane = new THREE.Mesh(new THREE.BoxGeometry(L.W, 0.06, 19.4), laneMat); lane.position.set(0, -0.03, -9.7 + 0.0); lane.receiveShadow = true; grp.add(lane);
    if (lx === 0) lane.userData.main = true;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(L.W, 0.06, 1.6), laneMat); deck.position.set(0, -0.03, -20.2 + 0.0); deck.receiveShadow = true; grp.add(deck);
    const appr = new THREE.Mesh(new THREE.BoxGeometry(L.W + 2 * L.gutter + 0.3, 0.06, 4.5), new THREE.MeshPhysicalMaterial({ map: laneMat.map, roughness: 0.3, clearcoat: 0.6, color: 0xd8c0a0 })); appr.position.set(0, -0.03, 2.25); appr.receiveShadow = true; grp.add(appr);
    const foul = new THREE.Mesh(new THREE.BoxGeometry(L.W + 2 * L.gutter, 0.002, 0.012), new THREE.MeshBasicMaterial({ color: 0x111111 })); foul.position.set(0, 0.001, 0); grp.add(foul);
    const gm = new THREE.MeshStandardMaterial({ color: 0x1b1b24, metalness: 0.6, roughness: 0.35, side: THREE.DoubleSide });
    for (const s of [-1, 1]) {
      const gut = new THREE.Mesh(new THREE.CylinderGeometry(L.gutter / 2, L.gutter / 2, 20.2, 16, 1, true, -Math.PI / 2, Math.PI), gm);
      gut.rotation.x = Math.PI / 2; gut.position.set(s * (L.half + L.gutter / 2), -0.005, -9.7); gut.receiveShadow = true; grp.add(gut);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 21), new THREE.MeshStandardMaterial({ color: 0x14121c, roughness: 0.5 })); cap.position.set(s * (L.half + L.gutter + 0.04), 0.0, -10); grp.add(cap);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 20), new THREE.MeshBasicMaterial({ color: lx === 0 ? 0xff3d9a : 0x38e8ff, toneMapped: false })); strip.position.set(s * (L.half + L.gutter + 0.06), 0.06, -10); grp.add(strip); neonMats.push(strip.material);
    }
    // fossa e mascherone
    const pit = new THREE.Mesh(new THREE.BoxGeometry(L.W + 2 * L.gutter + 0.2, 0.5, 1.4), new THREE.MeshStandardMaterial({ color: 0x050505 })); pit.position.set(0, -0.3, -21.7); grp.add(pit);
    const mask = new THREE.Mesh(new THREE.BoxGeometry(L.W + 2 * L.gutter + 0.24, 0.9, 0.3), new THREE.MeshStandardMaterial({ map: maskTex(lx), emissiveMap: maskTex(lx), emissive: 0xffffff, emissiveIntensity: 0.35 }));
    mask.position.set(0, 1.25, -19.9); grp.add(mask);
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 2.6), new THREE.MeshStandardMaterial({ color: 0x18122a, roughness: 0.6 })); side.position.set(-(L.half + L.gutter + 0.13), 0.35, -19.6); grp.add(side);
    const side2 = side.clone(); side2.position.x *= -1; grp.add(side2);
    if (lx !== 0) { for (const sp of pinSpots()) { const p = new THREE.Mesh(pinGeo, pinMat); p.position.set(sp.x, Pins.PIN.com, sp.z); grp.add(p); } }
    scene.add(grp);
  }
  // pavimento a moquette anni '80
  const carpet = ctex(512, 512, (g, w, h) => {
    g.fillStyle = '#120a24'; g.fillRect(0, 0, w, h);
    const cols = ['#ff3d9a', '#38e8ff', '#ffd166', '#7c4dff'];
    for (let i = 0; i < 70; i++) { g.strokeStyle = cols[i % 4]; g.lineWidth = 3; g.globalAlpha = .7; g.beginPath(); const x = Math.random() * w, y = Math.random() * h; if (i % 3) { g.arc(x, y, 8 + Math.random() * 14, 0, Math.PI * (1 + Math.random())); } else { g.moveTo(x, y); g.lineTo(x + 30, y + 10); g.lineTo(x + 10, y + 34); } g.stroke(); }
  }, [8, 8]);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 14), new THREE.MeshStandardMaterial({ map: carpet, roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, -0.061, 7); floor.receiveShadow = true; scene.add(floor);
  const darkFloor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ color: 0x0a0812 })); darkFloor.rotation.x = -Math.PI / 2; darkFloor.position.set(0, -0.07, -12); scene.add(darkFloor);
  // muri, soffitto
  const wall = new THREE.MeshStandardMaterial({ color: 0x120c1e, roughness: 0.9 });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(30, 6), wall); back.position.set(0, 3, -22.4); scene.add(back);
  const front = new THREE.Mesh(new THREE.PlaneGeometry(30, 6), wall); front.position.set(0, 3, 13); front.rotation.y = Math.PI; scene.add(front);
  for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(36, 6), wall); w.position.set(s * 7.5, 3, -4); w.rotation.y = -s * Math.PI / 2; scene.add(w); }
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(30, 36), new THREE.MeshStandardMaterial({ color: 0x0b0814 })); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 4.2, -4); scene.add(ceil);
  // insegna e fasce al neon sul soffitto
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.6), new THREE.MeshBasicMaterial({ map: ctex(1024, 192, (g, w, h) => { g.font = 'italic 700 120px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = '#ff3d9a'; g.shadowBlur = 30; g.fillStyle = '#ffd6ee'; g.fillText('Ridotto Bowling', w / 2, h / 2); }), transparent: true, toneMapped: false, color: 0x999999 }));
  sign.position.set(0, 2.9, -22.3); scene.add(sign);
  for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(13, 0.04, 0.06), new THREE.MeshBasicMaterial({ color: i % 2 ? 0x38e8ff : 0xff3d9a, toneMapped: false })); b.position.set(0, 4.15, 6 - i * 4.2); scene.add(b); }
  // panche e console dietro l'approccio
  const seat = new THREE.MeshStandardMaterial({ color: 0x6a1b4d, roughness: 0.5 });
  for (const lx of LANES_X) { const s = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.45, 0.6), seat); s.position.set(lx, 0.17, 6.4); scene.add(s); const bk = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 0.15), seat); bk.position.set(lx, 0.6, 6.7); scene.add(bk); }
  const ret = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.75, 1.0), new THREE.MeshStandardMaterial({ color: 0x2a2236, metalness: 0.5, roughness: 0.3 })); ret.position.set(1.1, 0.33, 4.6); scene.add(ret);
  // luci
  scene.add(new THREE.HemisphereLight(0x6650a0, 0x100820, 0.5));
  for (let i = 0; i < 5; i++) { const z = 2 - i * 4.8; const l = new THREE.SpotLight(0xfff0e0, 22, 9, 0.8, 0.7, 1.5); l.position.set(0, 4.0, z); l.target.position.set(0, 0, z - 1); if (i === 0 || i === 4) { l.castShadow = true; l.shadow.mapSize.set(1024, 1024); l.shadow.bias = -0.0005; } scene.add(l, l.target); }
  const pinLight = new THREE.SpotLight(0xfff4e8, 5, 6, 0.7, 0.5, 1.4); pinLight.position.set(0, 1.0, -18.0); pinLight.target.position.set(0, 0, -18.8); pinLight.castShadow = true; pinLight.shadow.mapSize.set(1024, 1024); scene.add(pinLight, pinLight.target);
  for (const lx of LANES_X) { const p = new THREE.PointLight(lx === 0 ? 0xff3d9a : 0x38e8ff, 1.2, 3, 2); p.position.set(lx, 1.4, -18.0); scene.add(p); }
}
function maskTex(lx) {
  return ctex(512, 160, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, w, 0); grd.addColorStop(0, '#2a0b3a'); grd.addColorStop(1, '#0b2a3a'); g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.font = '700 54px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = lx === 0 ? '#ff7cc0' : '#7ce9ff'; g.shadowColor = g.fillStyle; g.shadowBlur = 18;
    g.fillText(lx === 0 ? '★ PISTA 3 ★' : 'PISTA ' + (LANES_X.indexOf(lx) + 1), w / 2, h / 2);
  });
}

// ---------- pista speciale (ostacoli e gobbe) ----------
const specGroup = new THREE.Group(); scene.add(specGroup);
let specObjs = [];
function buildSpecial(key) {
  specGroup.clear(); specObjs = [];
  const mainLane = scene.children.find(o => o.isGroup && o.position.x === 0)?.children.find(c => c.userData.main);
  if (!key) { if (mainLane) mainLane.visible = true; return; }
  const spec = SPECIALS[key];
  if (mainLane) mainLane.visible = false;
  // superficie con le altezze
  const segs = 260, geo = new THREE.PlaneGeometry(L.W, 19.4, 8, segs); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) { const z = pos.getZ(i) - 9.7; pos.setZ(i, z); const hole = spec.hole && spec.hole(z); pos.setY(i, hole ? -2 : heightAt(spec, z)); }
  geo.computeVertexNormals();
  const surf = new THREE.Mesh(geo, laneMat); surf.receiveShadow = true; specGroup.add(surf);
  if (spec.hole) { const glow = new THREE.Mesh(new THREE.PlaneGeometry(L.W + 0.5, 2.2), new THREE.MeshBasicMaterial({ color: 0xff3d9a, transparent: true, opacity: 0.25, toneMapped: false })); glow.rotation.x = -Math.PI / 2; glow.position.set(0, -0.9, -9.3); specGroup.add(glow); }
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x38e8ff, emissive: 0x38e8ff, emissiveIntensity: 0.6, roughness: 0.3 });
  for (const o of spec.obstacles(0)) {
    const m = o.box ? new THREE.Mesh(new THREE.BoxGeometry(o.w, 0.3, o.d), wallMat) : new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.25, 1), new THREE.MeshStandardMaterial({ color: 0xff3d9a, emissive: 0xff3d9a, emissiveIntensity: 0.6 }));
    m.castShadow = true; specGroup.add(m); specObjs.push(m);
  }
  updateSpecial(0);
}
function updateSpecial(t) {
  if (!G.spec) return;
  const obs = SPECIALS[G.spec].obstacles(t);
  obs.forEach((o, i) => {
    const m = specObjs[i]; if (!m) return;
    if (o.box) m.position.set(o.cx, 0.15, o.cz);
    else { const dx = o.bx - o.ax, dz = o.bz - o.az, l = Math.hypot(dx, dz); m.scale.z = l; m.position.set((o.ax + o.bx) / 2, 0.12, (o.az + o.bz) / 2); m.rotation.y = Math.atan2(dx, dz); }
  });
}

// ---------- palla e birilli ----------
const ballGeo = new THREE.SphereGeometry(L.R, 40, 28);
const ballMesh = new THREE.Mesh(ballGeo, new THREE.MeshPhysicalMaterial({ roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 }));
ballMesh.castShadow = true; scene.add(ballMesh);
const ballTexCache = {};
function setBallColor(c) { ballMesh.material.map = ballTexCache[c] || (ballTexCache[c] = ballTex(c)); ballMesh.material.needsUpdate = true; }
const pinMeshes = pinSpots().map(() => { const m = new THREE.Mesh(pinGeo, pinMat); m.castShadow = true; m.receiveShadow = true; scene.add(m); return m; });
const rake = new THREE.Mesh(new THREE.BoxGeometry(L.W + 0.4, 0.12, 0.04), new THREE.MeshStandardMaterial({ color: 0x222, metalness: 0.7, roughness: 0.3 }));
rake.visible = false; scene.add(rake);

// ---------- suoni ----------
let AC = null, master, noiseB, rollGain = null;
function ac() {
  if (AC) return AC;
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)(); master = AC.createGain(); master.gain.value = 0.8; master.connect(AC.destination);
    noiseB = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate); const d = noiseB.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = AC.createBufferSource(); src.buffer = noiseB; src.loop = true; const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 180; rollGain = AC.createGain(); rollGain.gain.value = 0; src.connect(f); f.connect(rollGain); rollGain.connect(master); src.start();
  } catch (e) { AC = null; }
  return AC;
}
function snd(type, v = 1) {
  const c = ac(); if (!c) return; const t = c.currentTime;
  const tone = (f, dur, vol, at = 0, typ = 'sine', slide = 1) => { const o = c.createOscillator(), g = c.createGain(); o.type = typ; o.frequency.setValueAtTime(f, t + at); if (slide !== 1) o.frequency.exponentialRampToValueAtTime(f * slide, t + at + dur); g.gain.setValueAtTime(vol, t + at); g.gain.exponentialRampToValueAtTime(1e-4, t + at + dur); o.connect(g); g.connect(master); o.start(t + at); o.stop(t + at + dur + .02); };
  const noise = (dur, f, q, vol, at = 0, typ = 'bandpass') => { const s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain(); s.buffer = noiseB; fl.type = typ; fl.frequency.value = f; fl.Q.value = q; g.gain.setValueAtTime(vol, t + at); g.gain.exponentialRampToValueAtTime(1e-4, t + at + dur); s.connect(fl); fl.connect(g); g.connect(master); s.start(t + at, Math.random()); s.stop(t + at + dur + .02); };
  const k = Math.min(1, v);
  if (type === 'pin') { noise(0.09, 1800 + Math.random() * 900, 3, 0.4 * k); tone(900 + Math.random() * 300, 0.05, 0.15 * k, 0, 'triangle'); }
  else if (type === 'land') { tone(70, 0.2, 0.5 * k); noise(0.12, 200, 1, 0.4 * k, 0, 'lowpass'); }
  else if (type === 'wall') { tone(160, 0.12, 0.4 * k, 0, 'square', 0.5); noise(0.08, 600, 2, 0.3 * k); }
  else if (type === 'gutter') { tone(90, 0.3, 0.3, 0, 'sine', 0.7); }
  else if (type === 'strike') { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.5, 0.16, i * 0.08, 'sawtooth')); noise(1.2, 1200, 0.6, 0.25, 0.1); }
  else if (type === 'spare') { [659, 784, 988].forEach((f, i) => tone(f, 0.4, 0.15, i * 0.09, 'triangle')); }
  else if (type === 'boo') { tone(220, 0.6, 0.15, 0, 'sawtooth', 0.6); }
  else if (type === 'tick') tone(1500, 0.02, 0.06);
}

// ---------- stato ----------
const G = {
  phase: 'lobby', players: [], cur: 0, mode: 'classica', nFrames: 10, spec: null, ball: null, deck: null,
  aimX: 0.18, aimA: 0, swing: 0, time: 0, camPos: new THREE.Vector3(0, 2, 6), camLook: new THREE.Vector3(0, 0, -10), standing: [], throwInfo: null,
};
const deck = Pins.createDeck(); G.deck = deck;
for (const p of deck.pins) p.addEventListener('collide', e => { const v = Math.abs(e.contact.getImpactVelocityAlongNormal()); if (v > 0.8 && G.lastClack + 0.025 < G.time) { G.lastClack = G.time; snd('pin', v / 4); } });
G.lastClack = 0;

// ---------- rete: telefoni ----------
const CODE = (Q.get('code') || randomCode()).toUpperCase();
const ctrlUrl = () => new URL(`telecomando.html?r=${CODE}${Q.get('peer') ? '&peer=' + Q.get('peer') : ''}`, location.href).href;
let NET = null;
try {
  NET = hostRoom(CODE, {
    onOpen() { $('#net').textContent = 'Sala aperta: entra col telefono'; },
    onMsg: (id, m) => onPhone(id, m),
    onClose(id) { const p = G.players.find(p => p.conn === id); if (p) { p.online = false; renderLobby(); } },
    onError(t) { $('#net').textContent = 'Telefoni non disponibili (' + t + '): puoi giocare qui con mouse o dito'; },
  });
} catch (e) { $('#net').textContent = 'Telefoni non disponibili: gioca qui'; }
function send(p, m) { if (p.kind === 'phone' && p.conn && NET) NET.send(p.conn, m); }
function onPhone(id, m) {
  if (m.t === 'ping') return;
  if (m.t === 'join') {
    let p = G.players.find(x => x.pid && x.pid === m.pid);
    if (!p) {
      if (G.phase !== 'lobby') { NET.send(id, { t: 'full', text: 'Partita in corso: aspetta la prossima' }); return; }
      if (G.players.length >= 6) { NET.send(id, { t: 'full', text: 'Sala piena' }); return; }
      p = { kind: 'phone', pid: m.pid, name: (m.name || 'Telefono').slice(0, 14), color: m.color || COLORS[G.players.length % 6], sheet: null };
      G.players.push(p);
    }
    p.conn = id; p.online = true; if (m.name) p.name = m.name.slice(0, 14); if (m.color) p.color = m.color;
    NET.send(id, { t: 'hi', name: p.name, color: p.color, game: 'bowling' });
    renderLobby(); if (G.phase !== 'lobby') sendTurns();
    return;
  }
  const p = G.players.find(x => x.conn === id); if (!p) return;
  if (m.t === 'color') { p.color = m.color; renderLobby(); return; }
  if (G.players[G.cur] !== p) return;
  if (m.t === 'aim' && G.phase === 'aim') { G.aimX = clamp(+m.x || 0, -0.44, 0.44); G.aimA = clamp(+m.a || 0, -0.06, 0.06); }
  if (m.t === 'swing' && G.phase === 'aim') { G.swing = clamp(+m.th || 0, -1.6, 1.6); G.swingLive = G.time; }
  if (m.t === 'throw' && G.phase === 'aim') throwBall({ power: +m.power || 0, hook: +m.hook || 0, timing: +m.timing || 0, pull: +m.pull || 0 }, 'phone');
}
function sendTurns() {
  const cp = G.players[G.cur];
  for (const p of G.players) {
    if (p.kind !== 'phone') continue;
    if (p === cp && G.phase === 'aim') send(p, { t: 'turn', yours: true, frame: Sc.currentFrame(p.sheet) + 1, pins: G.standing.length, x: G.aimX, a: G.aimA, spec: G.spec ? SPECIALS[G.spec].name : '' });
    else send(p, { t: 'turn', yours: false, who: cp ? cp.name : '' });
  }
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------- lobby ----------
function renderLobby() {
  const qr = qrcode(0, 'M'); qr.addData(ctrlUrl()); qr.make(); $('#qr').innerHTML = qr.createSvgTag({ cellSize: 5, margin: 1, scalable: true });
  $('#code').textContent = CODE; $('#url').textContent = ctrlUrl().replace(/^https?:\/\//, '');
  $('#plist').innerHTML = G.players.length ? G.players.map((p, i) => `<div class="pp"><span class="dot" style="background:${p.color};box-shadow:0 0 10px ${p.color}"></span><b>${esc(p.name)}</b><small>${p.kind === 'phone' ? (p.online ? '📱 telefono' : '📱 scollegato') : p.kind === 'bot' ? '🤖 bot' : '🖱 qui'}</small><button data-del="${i}">✕</button></div>`).join('') : '<p class="note">Nessuno ancora. Entra col telefono o aggiungi un giocatore qui.</p>';
  $('#start').disabled = !G.players.length;
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const BOT_NAMES = ['Birillo', 'La Contessa', 'Strike Man', 'Nonna Pina', 'Er Canale'];
document.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || $('#lobby').classList.contains('hide')) return;
  if (b.dataset.del != null) { const p = G.players[+b.dataset.del]; if (p.kind === 'phone') send(p, { t: 'kicked' }); G.players.splice(+b.dataset.del, 1); renderLobby(); }
  if (b.dataset.m) { G.mode = b.dataset.m; document.querySelectorAll('#modes .opt').forEach(x => x.classList.toggle('sel', x === b)); }
  if (b.dataset.f) { G.nFrames = +b.dataset.f; document.querySelectorAll('#frames .chip').forEach(x => x.classList.toggle('sel', x === b)); }
});
$('#addLocal').onclick = () => { const n = $('#localName').value.trim() || 'Giocatore ' + (G.players.length + 1); G.players.push({ kind: 'local', name: n.slice(0, 14), color: COLORS[G.players.length % 6] }); $('#localName').value = ''; ac(); renderLobby(); };
$('#addBot').onclick = () => { const used = G.players.map(p => p.name); const n = BOT_NAMES.find(x => !used.includes(x)) || 'Bot'; G.players.push({ kind: 'bot', name: n, color: COLORS[G.players.length % 6] }); renderLobby(); };
$('#start').onclick = () => { ac(); startGame(); };
$('#again').onclick = () => { $('#end').classList.add('hide'); startGame(); };
$('#toLobby').onclick = () => { $('#end').classList.add('hide'); $('#hud').classList.add('hide'); $('#lobby').classList.remove('hide'); G.phase = 'lobby'; buildSpecial(null); G.spec = null; sendTurns(); };
$('#menuBtn').onclick = () => { if (confirmLeave()) $('#toLobby').onclick(); };
function confirmLeave() { return G.phase === 'lobby' || window.confirm('Tornare alla sala? La partita in corso si chiude.'); }

// ---------- partita ----------
function startGame() {
  for (const p of G.players) { p.sheet = Sc.newSheet(G.nFrames); p.lastX = 0.18; }
  G.cur = 0; G.phase = 'idle';
  $('#lobby').classList.add('hide'); $('#hud').classList.remove('hide');
  nextThrow(true);
}
function nextThrow(newFrame) {
  const p = G.players[G.cur], fi = Sc.currentFrame(p.sheet);
  if (newFrame || Sc.freshRack(p.sheet, fi)) { Pins.resetPins(deck); G.standing = pinSpots().map(s => s.n); }
  // pista speciale: cambia a ogni frame
  const want = G.mode === 'speciale' ? SPEC_ORDER[(fi + G.cur) % SPEC_ORDER.length] : null;
  if (want !== G.spec) { G.spec = want; buildSpecial(want); }
  G.aimX = p.lastX ?? 0.18; G.aimA = 0; G.swing = 0; G.ball = null; G.phase = 'aim'; G.aimT = 0;
  setBallColor(p.color);
  $('#who b').textContent = p.name; $('#who span').textContent = `Frame ${fi + 1} di ${p.sheet.frames.length}` + (G.spec ? ' · ' + SPECIALS[G.spec].name : '');
  const k = p.sheet.frames[fi].length;
  tip(p.kind === 'local' ? (MOBILE ? 'Premi sulla pista, trascina giù e poi su veloce, e lascia' : 'Clicca, tira giù il mouse e poi su veloce: lascia per lanciare') : p.kind === 'phone' ? `${p.name}: tieni premuto sul telefono e lancia` : `${p.name} si prepara…`);
  if (G.spec && k === 0) big(SPECIALS[G.spec].name, true, 1600);
  $('#aimbox').classList.toggle('hide', p.kind !== 'local');
  drawAim(); renderSheet(); sendTurns();
  if (p.kind === 'bot') botThrow();
}
function throwBall(inp, src) {
  if (G.phase !== 'aim') return;
  const p = G.players[G.cur];
  let speed = clamp(2.8 + inp.power * 6.7, 2.4, 10.8), hook = clamp(inp.hook, -1, 1), ang = G.aimA + clamp(inp.pull || 0, -0.05, 0.05), loft = 0, note = '';
  const tm = inp.timing ?? 0;
  if (tm < -0.45) { speed *= 0.8; ang += (Math.random() - .5) * 0.03; note = 'Lasciata troppo presto!'; }
  else if (tm > 1.0) { loft = Math.min(1, (tm - 1.0) * 1.5 + 0.3); ang += (Math.random() - .5) * 0.025; note = 'Volata! Lasciata troppo tardi'; }
  else if (Math.abs(tm - 0.1) < 0.25 && src !== 'bot') note = 'Rilascio perfetto';
  G.ball = newBall(G.aimX, ang, speed, hook, loft);
  G.ball.y = Math.max(G.ball.y, 0);
  p.lastX = G.aimX;
  G.phase = 'roll'; G.rollT = 0; G.swing = 0; G.throwInfo = { speed, hook, note };
  $('#aimbox').classList.add('hide');
  tip(`${(speed * 3.6).toFixed(0)} km/h` + (Math.abs(hook) > 0.15 ? ` · effetto ${hook < 0 ? 'a sinistra' : 'a destra'}` : '') + (note ? ' · ' + note : ''));
  if (loft) snd('land', 0.3);
  sendTurns();
}

// ---------- bot ----------
function botThrow() {
  const standing = G.standing.map(n => pinSpots()[n - 1]);
  const full = standing.length === 10;
  const targetX = full ? 0.06 : standing.reduce((a, s) => a + s.x, 0) / standing.length;
  const spec = G.spec ? SPECIALS[G.spec] : null;
  const hook = full && !spec ? -0.55 : full ? -0.3 : 0, x0 = full ? 0.22 : clamp(-targetX * 0.6, -0.3, 0.3);
  const t0 = G.time + 2.05; // il lancio parte tra ~2 secondi: gli ostacoli si muovono
  const sim = (a, speed) => { const b = newBall(x0, a, speed, hook); const ev = []; let t = 0; while (!b.done && !b.stopped && !b.fell && t < 6) { laneStep(b, 1 / 240, spec, t0 + t, ev); t += 1 / 240; } return { x: b.done ? b.x : 9, ok: b.done && !ev.some(e => e.t === 'wall') && !b.gutter }; };
  let best = null;
  for (const speed of spec ? [8, 9.4, 7, 6.2, 8.6, 7.5, 10] : [7.6 + Math.random() * 0.8]) {
    let a0 = -0.01, a1 = 0.01, f0 = sim(a0, speed).x - targetX, f1 = sim(a1, speed).x - targetX;
    for (let i = 0; i < 6 && Math.abs(f1) > 0.005 && f1 !== f0; i++) { const a2 = a1 - f1 * (a1 - a0) / (f1 - f0); a0 = a1; f0 = f1; a1 = clamp(a2, -0.08, 0.08); f1 = sim(a1, speed).x - targetX; }
    const r = sim(a1, speed);
    if (!best || (r.ok && !best.ok) || (r.ok === best.ok && Math.abs(f1) < Math.abs(best.err))) best = { a: a1, speed, ok: r.ok, err: f1 };
    if (best.ok && Math.abs(best.err) < 0.02) break;
  }
  const err = 0.0035;
  G.aimX = x0; G.aimA = best.a + (Math.random() + Math.random() - 1) * err;
  G.botSwing = { t: 0, speed: best.speed, hook: hook + (Math.random() - .5) * 0.1 };
}

// ---------- comandi locali (mouse/dito) ----------
const canvas = $('#gl');
let gest = null;
canvas.addEventListener('pointerdown', e => {
  ac(); const p = G.players[G.cur];
  if (G.phase !== 'aim' || !p || p.kind !== 'local') return;
  canvas.setPointerCapture(e.pointerId);
  gest = { y0: e.clientY, x0: e.clientX, hist: [{ t: performance.now(), x: e.clientX, y: e.clientY }] };
});
canvas.addEventListener('pointermove', e => {
  if (!gest) return; const now = performance.now();
  gest.hist.push({ t: now, x: e.clientX, y: e.clientY }); while (gest.hist.length > 2 && now - gest.hist[0].t > 160) gest.hist.shift();
  G.swing = clamp(-(e.clientY - gest.y0) / (innerHeight * 0.28) * 1.2, -1.5, 1.5);
});
canvas.addEventListener('pointerup', e => {
  if (!gest) return; const h = gest.hist, a = h[0], b = h[h.length - 1], dt = Math.max(0.016, (b.t - a.t) / 1000);
  const vy = -(b.y - a.y) / dt / innerHeight, vx = (b.x - a.x) / dt / innerHeight;
  const pulledBack = Math.max(...gest.hist.map(q => q.y)) > gest.y0 + 10 || G.swing < 0.2;
  const tm = -(e.clientY - gest.y0) / (innerHeight * 0.28);
  gest = null;
  if (vy < 0.4) { G.swing = 0; tip('Lancio annullato: tira giù e poi su veloce'); return; }
  throwBall({ power: clamp(vy / 3.4, 0, 1.25), hook: clamp(vx / 2.2, -1, 1), timing: pulledBack ? tm : 0, pull: 0 }, 'local');
});
// mira: trascina la palla sulla mini pista, rotella o tasti per l'angolo
const aimLane = $('#aimlane'); let aimDrag = false;
const aimFromEv = e => { const r = aimLane.getBoundingClientRect(); const f = (e.clientX - r.left) / r.width; G.aimX = clamp((f - 0.5) / 0.76 * L.W, -0.44, 0.44); drawAim(); };
aimLane.addEventListener('pointerdown', e => { aimLane.setPointerCapture(e.pointerId); aimDrag = true; aimFromEv(e); });
aimLane.addEventListener('pointermove', e => { if (aimDrag) aimFromEv(e); });
aimLane.addEventListener('pointerup', () => aimDrag = false);
aimLane.addEventListener('wheel', e => { G.aimA = clamp(G.aimA + Math.sign(e.deltaY) * 0.002, -0.06, 0.06); drawAim(); }, { passive: true });
$('#angL').onclick = () => { G.aimA = clamp(G.aimA - 0.003, -0.06, 0.06); drawAim(); };
$('#angR').onclick = () => { G.aimA = clamp(G.aimA + 0.003, -0.06, 0.06); drawAim(); };
addEventListener('keydown', e => {
  const p = G.players[G.cur]; if (G.phase !== 'aim' || !p || p.kind !== 'local') return;
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') G.aimX = clamp(G.aimX - 0.02, -0.44, 0.44);
  if (e.code === 'ArrowRight' || e.code === 'KeyD') G.aimX = clamp(G.aimX + 0.02, -0.44, 0.44);
  if (e.code === 'KeyQ') G.aimA = clamp(G.aimA - 0.003, -0.06, 0.06);
  if (e.code === 'KeyE') G.aimA = clamp(G.aimA + 0.003, -0.06, 0.06);
  drawAim();
});
function drawAim() {
  const f = 0.5 + G.aimX / L.W * 0.76; $('#aimlane .ball').style.left = (f * 100) + '%';
  const x1 = f * 110, x2 = x1 + Math.tan(G.aimA) * 19 / 0.0105 * 0.0105 * 110 / (L.W / 0.76) * 1.0;
  const l = $('#aimline'); l.setAttribute('x1', x1); l.setAttribute('x2', clamp(x2, -40, 150));
}

// ---------- HUD ----------
let bigT = 0;
function big(t, cyan, ms = 1500) { const el = $('#big'); el.textContent = t; el.classList.toggle('cyan', !!cyan); el.classList.add('show'); clearTimeout(bigT); bigT = setTimeout(() => el.classList.remove('show'), ms); }
function tip(t) { $('#tip').textContent = t; }
function renderSheet() {
  const n = G.players[0]?.sheet?.frames.length || 10;
  let h = '<table>';
  G.players.forEach((p, i) => {
    if (!p.sheet) return;
    const tt = Sc.totals(p.sheet);
    h += `<tr class="${i === G.cur ? 'cur' : ''}"><td class="nm" rowspan="2"><span style="color:${p.color}">●</span> ${esc(p.name)}</td>`;
    for (let f = 0; f < n; f++) h += `<td class="r">${Sc.marks(p.sheet, f).join(' ')}</td>`;
    h += `<td class="tot" rowspan="2">${Sc.total(p.sheet)}</td></tr><tr class="${i === G.cur ? 'cur' : ''}">`;
    for (let f = 0; f < n; f++) h += `<td class="t">${tt[f] ?? ''}</td>`;
    h += '</tr>';
  });
  $('#sheet').innerHTML = h + '</table>';
}

// ---------- risultato del tiro ----------
function finishThrow() {
  const p = G.players[G.cur], fi = Sc.currentFrame(p.sheet), f = p.sheet.frames[fi];
  const down = Pins.knocked(deck).filter(n => G.standing.includes(n));
  const n = G.ball && (G.ball.fell || G.ball.back) ? 0 : down.length;
  const wasFresh = G.standing.length === 10;
  G.throwFrame = fi;
  Sc.addRoll(p.sheet, n);
  G.standing = G.standing.filter(x => !down.includes(x));
  let text = '', cyan = false;
  if (wasFresh && n === 10) { text = 'STRIKE!'; snd('strike'); }
  else if (!wasFresh && G.standing.length === 0) { text = 'SPARE!'; cyan = true; snd('spare'); }
  else if (G.ball && G.ball.fell) { text = 'Nel vuoto!'; snd('boo'); }
  else if (G.ball && G.ball.back) { text = 'Torna indietro!'; snd('boo'); }
  else if (n === 0) { text = G.ball && G.ball.gutter ? 'Canale…' : 'Zero'; snd('boo'); }
  else if (wasFresh && headSplit(G.standing)) { text = `${n} · Split!`; cyan = true; }
  else { text = String(n); cyan = true; }
  big(text, cyan, 1700);
  renderSheet();
  send(p, { t: 'res', text, score: Sc.total(p.sheet) });
  G.phase = 'sweep'; G.sweepT = 0; G.sweepDown = down;
}
function headSplit(st) {
  if (st.includes(1) || st.length < 2) return false;
  const sp = pinSpots(), xs = st.map(n => sp[n - 1].x).sort((a, b) => a - b);
  for (let i = 1; i < xs.length; i++) if (xs[i] - xs[i - 1] > 0.31) return true;
  return false;
}
function afterSweep() {
  const p = G.players[G.cur];
  const fi = Sc.currentFrame(p.sheet);
  const frameOver = fi !== G.throwFrame;
  if (frameOver || Sc.finished(p.sheet)) {
    // tocca al prossimo giocatore
    const all = G.players.every(q => Sc.finished(q.sheet));
    if (all) return endGame();
    let k = G.cur;
    do { k = (k + 1) % G.players.length; } while (Sc.finished(G.players[k].sheet));
    G.cur = k;
    nextThrow(true);
  } else {
    // stesso frame: si tolgono i birilli caduti
    Pins.resetPins(deck, Sc.freshRack(p.sheet, fi) ? null : G.standing);
    if (Sc.freshRack(p.sheet, fi)) G.standing = pinSpots().map(s => s.n);
    nextThrow(false);
  }
}
function endGame() {
  G.phase = 'over';
  const rank = [...G.players].sort((a, b) => Sc.total(b.sheet) - Sc.total(a.sheet));
  $('#final').innerHTML = `<div class="w">${esc(rank[0].name)} vince!</div>` + rank.map((p, i) => `<div>${i + 1}. ${esc(p.name)} — <b>${Sc.total(p.sheet)}</b></div>`).join('');
  $('#end').classList.remove('hide'); snd('strike');
  for (const p of G.players) send(p, { t: 'end', text: `${rank[0].name} vince`, score: Sc.total(p.sheet) });
}

// ---------- ciclo ----------
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _q = new THREE.Quaternion(), _ax = new THREE.Vector3();
let last = performance.now(), acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000); last = now; if (FAST) dt *= 3;
  G.time += dt;
  updateSpecial(G.time);
  const spec = G.spec ? SPECIALS[G.spec] : null;
  if (G.phase === 'aim') {
    G.aimT += dt;
    if (G.botSwing) {
      const b = G.botSwing; b.t += dt;
      G.swing = b.t < 1 ? 0 : b.t < 1.7 ? -Math.sin((b.t - 1) / 0.7 * Math.PI / 2) * 1.2 : -1.2 + (b.t - 1.7) / 0.35 * 1.3;
      if (b.t > 2.05) { G.botSwing = null; throwBall({ power: (b.speed - 2.8) / 6.7, hook: b.hook, timing: 0.1 }, 'bot'); }
    }
    if (G.swingLive && G.time - G.swingLive > 1.5) { G.swing *= 0.9; }
  }
  if (G.phase === 'roll') {
    const b = G.ball, ev = []; acc += dt; let n = 0;
    while (acc > 1 / 480 && n < 400) { laneStep(b, 1 / 480, spec, G.time, ev); acc -= 1 / 480; n++; if (b.done || b.fell || b.stopped) break; }
    for (const e of ev) { if (e.t === 'wall') snd('wall', e.v / 4); if (e.t === 'land') snd('land', e.v / 3); if (e.t === 'gutter') snd('gutter'); }
    if (rollGain) rollGain.gain.value = b.air || b.fell ? 0 : Math.min(0.5, Math.hypot(b.vx, b.vz) / 18);
    G.rollT += dt;
    // rotazione visiva
    const w = Math.hypot(b.wx + b.sx, b.wz + b.sz); if (w > 0.01) { _ax.set((b.wx + b.sx) / w, 0, (b.wz + b.sz) / w); _q.setFromAxisAngle(_ax, w * dt); ballMesh.quaternion.premultiply(_q); }
    ballMesh.position.set(b.x, L.R + b.y + (b.gutter ? -0.07 : 0), b.z);
    if (b.done) { Pins.launchBall(deck, b); G.phase = 'deck'; }
    else if (b.fell || b.stopped || (b.back && b.z > 1) || G.rollT > 12) { G.phase = 'deck'; G.noDeck = true; G.deckT = 0; }
  }
  if (G.phase === 'deck') {
    if (rollGain) rollGain.gain.value = Math.max(0, rollGain.gain.value - dt);
    if (!G.noDeck) {
      Pins.stepDeck(deck, dt);
      const bb = deck.ball; if (bb) { ballMesh.position.copy(bb.position); ballMesh.quaternion.copy(bb.quaternion); }
      if (Pins.settled(deck)) finishThrow();
    } else { G.deckT += dt; if (G.ball.fell) ballMesh.position.y -= dt * 2; if (G.deckT > 1.4) { G.noDeck = false; finishThrow(); } }
  }
  if (G.phase === 'sweep') {
    G.sweepT += dt;
    const t = G.sweepT; rake.visible = t > 0.9 && t < 2.4;
    rake.position.set(0, t < 1.3 ? 0.6 - (t - 0.9) * 1.1 : 0.12, t < 1.3 ? -17.7 : -17.7 - (t - 1.3) * 1.8);
    if (t > 1.3) for (const p of deck.pins) if (!p.removed && G.sweepDown.includes(p.spot.n)) { p.position.z = Math.min(p.position.z, rake.position.z - 0.06); p.position.y = Math.max(-0.3, p.position.y - (p.position.z < -19.3 ? dt * 2 : 0)); }
    if (t > 2.5) { rake.visible = false; afterSweep(); }
  }
  // sincronizza i birilli
  deck.pins.forEach((p, i) => { const m = pinMeshes[i]; m.visible = !p.removed; m.position.copy(p.position); m.quaternion.copy(p.quaternion); });
  // palla in mano durante la mira (oscilla col braccio)
  if (G.phase === 'aim' || G.phase === 'lobby' || G.phase === 'idle') {
    const th = G.swing, sx = G.aimX + 0.2, sy = 1.25, sz = 0.9;
    ballMesh.position.set(sx, sy - Math.cos(th) * 0.68, sz - Math.sin(th) * 0.68);
  }
  updateCamera(dt);
  composer.render();
}
function updateCamera(dt) {
  const pos = _v, look = _w;
  if (G.phase === 'lobby') { const t = G.time * 0.1; pos.set(Math.sin(t) * 1.5, 1.6, 3.5); look.set(0, 0.4, -18); }
  else if (G.phase === 'aim' || G.phase === 'idle') { pos.set(G.aimX * 0.85 + 0.05, 1.55, 2.3); look.set(G.aimX * 0.3 + Math.tan(G.aimA) * 18, 0.1, -18.5); }
  else if (G.phase === 'roll') { const b = G.ball; const z = Math.max(-14.5, b.z + 2.6); pos.set(b.x * 0.6, 0.75 + Math.max(0, b.y) * 0.5, z); look.set(b.x * 0.4, 0.2 + b.y * 0.5, b.z - 4); }
  else { pos.set(0.7, 1.05, -15.6); look.set(0, 0.12, -18.7); }
  const k = 1 - Math.exp(-dt * (G.phase === 'roll' ? 8 : 3));
  G.camPos.lerp(pos, k); G.camLook.lerp(look, k);
  camera.position.copy(G.camPos); camera.lookAt(G.camLook);
}

// ---------- avvio ----------
buildAlley(); Pins.resetPins(deck); setBallColor(COLORS[0]); renderLobby(); resize(); requestAnimationFrame(frame);
if (DEBUG) { window.__G = G; window.__deck = deck; window.__throw = throwBall; window.__start = startGame; }
if (Q.has('auto')) {
  G.mode = Q.get('auto') === 'speciale' ? 'speciale' : 'classica'; G.nFrames = +(Q.get('frames') || 3);
  G.players.push({ kind: 'bot', name: 'Birillo', color: COLORS[0] }, { kind: 'bot', name: 'La Contessa', color: COLORS[1] });
  startGame();
}
