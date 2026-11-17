// Ping pong del Ridotto: due personaggi, palla con effetto vero, telefono come racchetta.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { T, mkBall, step, predict, solve, copy } from './ball.js';
import { loadAvatarLibrary, makeAvatar, randomLook, savedProfile } from '../avatar/avatar.js';
const BOTS = [{ name: 'Topspin' }, { name: 'La Contessa' }, { name: 'Muro' }, { name: 'Nonna Pina' }, { name: 'Er Taglio' }];
import { hostRoom, randomCode } from '../net.js';

const Q = new URLSearchParams(location.search);
const DEBUG = Q.has('debug'), FAST = Q.has('fast');
const MOBILE = matchMedia('(pointer:coarse)').matches;
const $ = s => document.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ canvas: $('#gl'), antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, MOBILE ? 1.3 : 1.5));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0xeef2f8); scene.fog = new THREE.Fog(0xeef2f8, 14, 40);

const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 60);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new ShaderPass({ uniforms: { tDiffuse: { value: null } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); if (!(c.r == c.r) || !(c.g == c.g) || !(c.b == c.b)) c = vec4(0.0,0.0,0.0,1.0); gl_FragColor = vec4(clamp(c.rgb, 0.0, 60.0), 1.0); }' }));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.12, 0.3, 1.0));
composer.addPass(new OutputPass());
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); composer.setSize(w, h); camera.aspect = w / h; camera.fov = w < h ? 72 : 55; camera.updateProjectionMatrix(); }
addEventListener('resize', resize);
function ctex(w, h, draw, rep) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); } return t; }

// ---------- scena: palazzetto luminoso, niente pubblico ----------
function buildHall() {
  const top = ctex(512, 920, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#2d6fd6'); gr.addColorStop(1, '#2560c4'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * .025})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    g.fillStyle = '#fff'; const b = 9; g.fillRect(0, 0, w, b); g.fillRect(0, h - b, w, b); g.fillRect(0, 0, b, h); g.fillRect(w - b, 0, b, h); g.fillRect(w / 2 - 2, 0, 4, h);
  });
  const edge = new THREE.MeshStandardMaterial({ color: 0x1d4fa8, roughness: 0.5 });
  const table = new THREE.Mesh(new THREE.BoxGeometry(T.W, 0.03, T.L), [edge, edge, new THREE.MeshPhysicalMaterial({ map: top, roughness: 0.38, clearcoat: 0.35, clearcoatRoughness: 0.3 }), edge, edge, edge]);
  table.position.y = T.H - 0.015; table.receiveShadow = true; table.castShadow = true; scene.add(table);
  const frame = new THREE.MeshStandardMaterial({ color: 0x2b2f3a, metalness: 0.6, roughness: 0.35 });
  const under = new THREE.Mesh(new THREE.BoxGeometry(T.W - 0.2, 0.06, T.L - 0.3), frame); under.position.y = T.H - 0.07; scene.add(under);
  for (const sz of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, T.H - 0.1, 0.06), frame);
    for (const sx of [-1, 1]) { const l = leg.clone(); l.position.set(sx * (T.W / 2 - 0.2), (T.H - 0.1) / 2, sz * (T.L / 2 - 0.35)); l.castShadow = true; scene.add(l); }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(T.W - 0.4, 0.04, 0.04), frame); bar.position.set(0, 0.12, sz * (T.L / 2 - 0.35)); scene.add(bar);
    for (const sx of [-1, 1]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 14), new THREE.MeshStandardMaterial({ color: 0x111111 })); w.rotation.z = Math.PI / 2; w.position.set(sx * (T.W / 2 - 0.2), 0.05, sz * (T.L / 2 - 0.35)); scene.add(w); }
  }
  // rete
  const netTex = ctex(512, 64, (g, w, h) => { g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(30,34,48,.75)'; g.lineWidth = 1.2; for (let x = 0; x < w; x += 7) { g.beginPath(); g.moveTo(x, 6); g.lineTo(x, h); g.stroke(); } for (let y = 6; y < h; y += 7) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } g.fillStyle = '#f4f6fb'; g.fillRect(0, 0, w, 7); });
  const net = new THREE.Mesh(new THREE.PlaneGeometry(T.W + 0.3, T.net), new THREE.MeshStandardMaterial({ map: netTex, transparent: true, side: THREE.DoubleSide, roughness: 0.9, alphaTest: 0.05 }));
  net.position.set(0, T.H + T.net / 2, 0); scene.add(net);
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, T.net + 0.03, 10), new THREE.MeshStandardMaterial({ color: 0x1d2340, metalness: 0.5 })); p.position.set(s * (T.W / 2 + 0.15), T.H + T.net / 2, 0); scene.add(p); const c = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.08), p.material); c.position.set(s * (T.W / 2 + 0.13), T.H + 0.01, 0); scene.add(c); }
  // parquet chiaro con il campo azzurro
  const floorT = ctex(1024, 1024, (g, w, h) => { const n = 22; for (let i = 0; i < n; i++) { g.fillStyle = `hsl(${32 + Math.random() * 4},${45 + Math.random() * 10}%,${68 + Math.random() * 6}%)`; g.fillRect(i * w / n, 0, w / n, h); g.fillStyle = 'rgba(120,80,40,.25)'; g.fillRect(i * w / n, 0, 1.5, h); for (let k = 0; k < 6; k++) { const y = Math.random() * h; g.fillRect(i * w / n, y, w / n, 1.5); } } for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(120,80,40,${Math.random() * .05})`; g.fillRect(Math.random() * w, Math.random() * h, 1, 6 + Math.random() * 20); } }, [4, 4]);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshPhysicalMaterial({ map: floorT, roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.25 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const courtT = ctex(256, 512, (g, w, h) => { g.fillStyle = '#4aa3e0'; g.fillRect(0, 0, w, h); g.strokeStyle = '#fff'; g.lineWidth = 6; g.strokeRect(8, 8, w - 16, h - 16); });
  const court = new THREE.Mesh(new THREE.PlaneGeometry(6, 11), new THREE.MeshStandardMaterial({ map: courtT, roughness: 0.75 })); court.rotation.x = -Math.PI / 2; court.position.y = 0.003; court.receiveShadow = true; scene.add(court);
  // transenne basse blu con la scritta
  const barT = ctex(1024, 128, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#3d7bff'); gr.addColorStop(1, '#2a5fd6'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.font = '700 70px Fredoka, Arial'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; for (let x = 30; x < w; x += 512) g.fillText('PING PONG', x, h / 2 + 4); g.fillStyle = '#ffcf3a'; g.fillRect(0, h - 10, w, 10); });
  for (const [x, z, ry, len] of [[0, -5.5, 0, 6], [0, 5.5, Math.PI, 6], [-3, 0, Math.PI / 2, 11], [3, 0, -Math.PI / 2, 11]]) {
    const m = new THREE.MeshStandardMaterial({ map: barT.clone(), roughness: 0.5 }); m.map.wrapS = THREE.RepeatWrapping; m.map.repeat.set(len / 3, 1); m.map.needsUpdate = true;
    const b = new THREE.Mesh(new THREE.BoxGeometry(len, 0.55, 0.05), m); b.position.set(x, 0.275, z); b.rotation.y = ry; b.castShadow = true; scene.add(b);
  }
  // pareti chiare con grandi vetrate sul cielo
  const wallT = ctex(1024, 512, (g, w, h) => { g.fillStyle = '#eef2f8'; g.fillRect(0, 0, w, h); g.fillStyle = '#3d7bff'; g.fillRect(0, h * 0.78, w, h * 0.22); g.fillStyle = '#ffcf3a'; g.fillRect(0, h * 0.76, w, 8);
    for (let i = 0; i < 4; i++) { const x = 40 + i * 250, y = 60, ww = 200, hh = 250; const gr = g.createLinearGradient(0, y, 0, y + hh); gr.addColorStop(0, '#7ec3ff'); gr.addColorStop(1, '#d9efff'); g.fillStyle = gr; g.fillRect(x, y, ww, hh); g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.arc(x + 60 + i * 20, y + 80, 26, 0, 7); g.arc(x + 90 + i * 20, y + 70, 30, 0, 7); g.arc(x + 120 + i * 20, y + 84, 24, 0, 7); g.fill(); g.strokeStyle = '#c9d3e6'; g.lineWidth = 10; g.strokeRect(x, y, ww, hh); g.beginPath(); g.moveTo(x + ww / 2, y); g.lineTo(x + ww / 2, y + hh); g.stroke(); } });
  for (const [x, z, ry] of [[0, -12, 0], [0, 12, Math.PI], [-12, 0, Math.PI / 2], [12, 0, -Math.PI / 2]]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(24, 9), new THREE.MeshStandardMaterial({ map: wallT, roughness: 0.9 })); w.position.set(x, 4.5, z); w.rotation.y = ry; scene.add(w); }
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), new THREE.MeshStandardMaterial({ color: 0xdfe5ef })); ceil.rotation.x = Math.PI / 2; ceil.position.y = 9; scene.add(ceil);
  for (let i = -2; i <= 2; i++) for (const x of [-4, 0, 4]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), new THREE.MeshBasicMaterial({ color: 0xffffff })); p.rotation.x = Math.PI / 2; p.position.set(x, 8.98, i * 4); scene.add(p); }
  // panchina e borse a bordo campo (dettagli)
  const benchM = new THREE.MeshStandardMaterial({ color: 0xe8a33d, roughness: 0.6 });
  for (const s of [-1, 1]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 2), benchM); b.position.set(s * 4.2, 0.45, 0); b.castShadow = true; scene.add(b); for (const z of [-0.8, 0.8]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.45, 0.05), frame); l.position.set(s * 4.2, 0.22, z); scene.add(l); } const bag = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.4, 4, 10), new THREE.MeshStandardMaterial({ color: s > 0 ? 0xff5c9a : 0x2ec27e })); bag.rotation.z = Math.PI / 2; bag.position.set(s * 4.2, 0.62, 0.4); scene.add(bag); }
  // luci morbide
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd8c8b0, 1.1));
  const key = new THREE.DirectionalLight(0xfff4e6, 1.6); key.position.set(2.5, 7, 3); key.castShadow = true; Object.assign(key.shadow.camera, { left: -4, right: 4, top: 6, bottom: -6, near: 1, far: 20 }); key.shadow.mapSize.set(MOBILE ? 1024 : 2048, MOBILE ? 1024 : 2048); key.shadow.bias = -0.0005; key.shadow.normalBias = 0.02; scene.add(key);
  const fill = new THREE.DirectionalLight(0xdfe8ff, 0.5); fill.position.set(-4, 5, -3); scene.add(fill);
}

// racchetta (impugnatura lungo -y locale, piatto in alto)
function makeRacket(color) {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0xd9a86a, roughness: 0.55 });
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.017, 0.1, 12), wood); handle.scale.z = 0.75; handle.position.y = -0.05; g.add(handle);
  const flare = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.017, 0.03, 12), wood); flare.scale.z = 0.6; flare.position.y = 0.01; g.add(flare);
  const bladeG = new THREE.CylinderGeometry(0.075, 0.075, 0.006, 40);
  const blade = new THREE.Mesh(bladeG, wood); blade.rotation.x = Math.PI / 2; blade.scale.set(1, 1, 1.08); blade.position.y = 0.08; g.add(blade);
  const r1 = new THREE.Mesh(new THREE.CylinderGeometry(0.073, 0.073, 0.003, 40), new THREE.MeshStandardMaterial({ color, roughness: 0.7 })); r1.rotation.x = Math.PI / 2; r1.scale.set(1, 1, 1.08); r1.position.set(0, 0.08, 0.0045); g.add(r1);
  const r2 = new THREE.Mesh(r1.geometry, new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7 })); r2.rotation.x = Math.PI / 2; r2.scale.set(1, 1, 1.08); r2.position.set(0, 0.08, -0.0045); g.add(r2);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// ---------- palla ----------
// palla con una cucitura disegnata, così si vede girare; scia a nastro che si assottiglia; ombra sul tavolo
const ballTex = ctex(128, 64, (g, w, h) => { g.fillStyle = '#fbfbf6'; g.fillRect(0, 0, w, h); g.strokeStyle = '#f2a33a'; g.lineWidth = 5; g.beginPath(); for (let x = 0; x <= w; x += 2) g.lineTo(x, h / 2 + Math.sin(x / w * Math.PI * 4) * 10); g.stroke(); g.fillStyle = '#e8243c'; g.font = '700 16px Fredoka, Arial'; g.fillText('R', 20, 18); });
const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(T.r * 1.25, 24, 16), new THREE.MeshStandardMaterial({ map: ballTex, emissive: 0xffa060, emissiveIntensity: 0.12, roughness: 0.35 }));
ballMesh.castShadow = true; scene.add(ballMesh);
const shadowTex = ctex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 1, 32, 32, 30); gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
const ballShadow = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.12), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })); ballShadow.rotation.x = -Math.PI / 2; scene.add(ballShadow);
const TRAIL = 22;
const trailGeo = new THREE.BufferGeometry();
trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL * 2 * 3), 3));
trailGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(TRAIL * 2 * 3), 3));
{ const idx = []; for (let i = 0; i < TRAIL - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } trailGeo.setIndex(idx); }
const trail = new THREE.Mesh(trailGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
trail.frustumCulled = false; scene.add(trail);
const trailPts = [];
const _tv = new THREE.Vector3(), _td = new THREE.Vector3(), _ts = new THREE.Vector3();
function drawTrail(color) {
  const pos = trailGeo.attributes.position.array, col = trailGeo.attributes.color.array, n = trailPts.length / 3;
  for (let i = 0; i < TRAIL; i++) {
    const j = Math.min(i, n - 1); if (j < 0) break;
    const x = trailPts[j * 3], y = trailPts[j * 3 + 1], z = trailPts[j * 3 + 2];
    const k = n > 1 ? j / (n - 1) : 1; // 0 = coda, 1 = palla
    const jn = Math.min(n - 1, j + 1), jp = Math.max(0, j - 1);
    _td.set(trailPts[jn * 3] - trailPts[jp * 3], trailPts[jn * 3 + 1] - trailPts[jp * 3 + 1], trailPts[jn * 3 + 2] - trailPts[jp * 3 + 2]);
    _tv.set(x, y, z).sub(camera.position); _ts.crossVectors(_td, _tv).normalize().multiplyScalar(T.r * 0.75 * k);
    pos.set([x + _ts.x, y + _ts.y, z + _ts.z, x - _ts.x, y - _ts.y, z - _ts.z], i * 6);
    const c = k * k * 0.9; col.set([color.r * c, color.g * c, color.b * c, color.r * c, color.g * c, color.b * c], i * 6);
  }
  trailGeo.attributes.position.needsUpdate = true; trailGeo.attributes.color.needsUpdate = true; trailGeo.setDrawRange(0, Math.max(0, (Math.min(n, TRAIL) - 1) * 6));
}
// piccolo anello sul tavolo quando la palla rimbalza
const hitRings = [];
function bounceRing(x, y, z, color = 0xffffff) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.02, 0.035, 24), new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set(x, y + 0.002, z); scene.add(m); hitRings.push({ m, t: 0 });
}
function updateRings(dt) { for (let i = hitRings.length - 1; i >= 0; i--) { const r = hitRings[i]; r.t += dt; r.m.scale.setScalar(1 + r.t * 9); r.m.material.opacity = Math.max(0, 0.9 - r.t * 2.2); if (r.t > 0.45) { scene.remove(r.m); hitRings.splice(i, 1); } } }
const fireLight = new THREE.PointLight(0xff5a00, 0, 1.5, 2); scene.add(fireLight); // sempre presente: accenderla/spegnerla non ricompila i materiali
function updateCharge() { const c = G.charge || [0, 0]; for (const [i, id] of [[0, '#chA'], [1, '#chB']]) { const el = document.querySelector(id); if (el) { el.style.width = (c[i] * 100) + '%'; el.parentElement.classList.toggle('full', c[i] >= 1); } } }

// ---------- suoni ----------
let AC = null, master, noiseB;
function ac() { if (AC) return AC; try { AC = new (window.AudioContext || window.webkitAudioContext)(); master = AC.createGain(); master.gain.value = 0.8; master.connect(AC.destination); noiseB = AC.createBuffer(1, AC.sampleRate, AC.sampleRate); const d = noiseB.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } catch (e) { AC = null; } return AC; }
function snd(type, v = 1) {
  const c = ac(); if (!c) return; const t = c.currentTime;
  const tone = (f, dur, vol, at = 0, typ = 'sine', slide = 1) => { const o = c.createOscillator(), g = c.createGain(); o.type = typ; o.frequency.setValueAtTime(f, t + at); if (slide !== 1) o.frequency.exponentialRampToValueAtTime(f * slide, t + at + dur); g.gain.setValueAtTime(vol, t + at); g.gain.exponentialRampToValueAtTime(1e-4, t + at + dur); o.connect(g); g.connect(master); o.start(t + at); o.stop(t + at + dur + .02); };
  const noise = (dur, f, q, vol, at = 0, typ = 'bandpass') => { const s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain(); s.buffer = noiseB; s.loop = true; fl.type = typ; fl.frequency.value = f; fl.Q.value = q; g.gain.setValueAtTime(vol, t + at); g.gain.exponentialRampToValueAtTime(1e-4, t + at + dur); s.connect(fl); fl.connect(g); g.connect(master); s.start(t + at, Math.random()); s.stop(t + at + dur + .02); };
  const k = Math.min(1, v);
  if (type === 'hit') { tone(1400 + v * 300, 0.04, 0.3 + 0.2 * k, 0, 'triangle'); noise(0.03, 2500, 2, 0.25 + 0.2 * k); }
  else if (type === 'table') { tone(2200, 0.03, 0.22); tone(900, 0.04, 0.1); }
  else if (type === 'net') { noise(0.12, 400, 1, 0.3); }
  else if (type === 'floor') { tone(1700, 0.03, 0.12); }
  else if (type === 'swish') { noise(0.12, 900 + v * 600, 0.8, 0.12 * k); }
  else if (type === 'cheer') { noise(1.4, 900, 0.4, 0.22); noise(1.2, 2200, 0.6, 0.08, 0.1); }
  else if (type === 'aww') { tone(300, 0.7, 0.12, 0, 'sawtooth', 0.7); noise(0.8, 500, 0.5, 0.1); }
  else if (type === 'win') { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.4, 0.18, i * 0.12, 'triangle')); }
}

// ---------- stato ----------
const G = {
  phase: 'lobby', players: [], level: 1, target: 11, assist: true, score: [0, 0], server: 0, serves: 0, time: 0,
  ball: null, charge: [0, 0], fire: false, lastHitter: -1, bounces: [], ideal: null, pendingHit: null, serving: false, toss: null,
  camPos: new THREE.Vector3(0, 3, 5), camLook: new THREE.Vector3(0, 0.8, 0), crowd: null, stillT: 0,
};
// side: giocatore 0 = vicino (z>0), 1 = lontano (z<0)
const sideZ = i => i === 0 ? 1 : -1;
buildHall();

// personaggi del camerino; il giocatore vicino, se umano, gioca in prima persona
const avatars = [];
const FP_BASE = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.35, 0.5, -0.45)), _pq = new THREE.Quaternion(), _pq2 = new THREE.Quaternion(), _pe = new THREE.Euler(), _pv = new THREE.Vector3();
const fpRacket = makeRacket(0xe8243c); fpRacket.visible = false; camera.add(fpRacket); scene.add(camera);
function setupAvatars() {
  for (const a of avatars) a.av.dispose();
  avatars.length = 0;
  G.players.forEach((p, i) => {
    const av = makeAvatar({ ...(p.look || randomLook()), prop: "none" }, { height: 2.05 });
    av.root.traverse(o => { if (o.isMesh) o.castShadow = true; });
    av.root.rotation.y = i === 0 ? Math.PI : 0;
    av.root.position.set(0.3 * (i ? -1 : 1), 0, sideZ(i) * (T.L / 2 + 0.65));
    scene.add(av.root);
    const racket = makeRacket(i === 0 ? 0xe8243c : 0x2a5fd6); const hand = av.bones.handslotr || av.bones.wristr;
    hand.add(racket); racket.scale.setScalar(2.45 / 2.05 * 1.5); racket.rotation.set(0, Math.PI, 0); racket.position.set(0, 0.04, 0);
    av.play('Idle_B');
    avatars.push({ av, racket, x: av.root.position.x, vx: 0, swingT: -1, swingDir: 1, anim: 'Idle_B' });
  });
  const fp = G.view !== 'tv' && G.players[0] && G.players[0].kind !== 'cpu';
  if (avatars[0]) avatars[0].av.root.visible = !fp;
  fpRacket.visible = fp;
}
function animateAvatars(dt) {
  avatars.forEach((a, i) => {
    const s = sideZ(i);
    // si sposta verso il punto dove colpirà (con dolcezza: niente tremolii)
    let tx = 0.25 * (i === 0 ? 1 : -1);
    if (G.ideal && G.ideal.who === i) tx = G.ideal.x - 0.38 * (i === 0 ? 1 : -1);
    else if (G.serving && G.server === i) tx = 0.35 * (i === 0 ? 1 : -1);
    tx = clamp(tx, -1.3, 1.3);
    const want = Math.abs(tx - a.x) < 0.04 ? 0 : clamp((tx - a.x) * 6, -3.5, 3.5);
    a.vx += (want - a.vx) * Math.min(1, dt * 8); a.x += a.vx * dt;
    a.av.root.position.set(a.x, 0, s * (T.L / 2 + 0.65));
    // animazioni
    let anim = window.__idle || 'Block';
    if (a.pend) { a.pend.wait -= dt; if (a.pend.wait <= 0) { const pd = a.pend; a.pend = null; a.swingT = 0; a.swingDir = pd.side; a.up = pd.up; snd('swish', pd.p); a.anim = 'swing'; a.av.play('1H_Melee_Attack_Slice_Horizontal', { once: true, fade: 0.08, speed: 1.7 }); } }
    if (a.swingT >= 0) { a.swingT += dt; if (a.swingT > 0.55) a.swingT = -1; }
    else if (Math.abs(a.vx) > 0.6) anim = (a.vx * (i === 0 ? -1 : 1)) > 0 ? 'Running_Strafe_Right' : 'Running_Strafe_Left';
    if (a.swingT < 0 && !a.pend && anim !== a.anim) { a.anim = anim; a.av.play(anim, { fade: 0.15 }); }
    a.av.update(dt);
  });
  // racchetta in prima persona: si prepara dal lato dove arriva la palla (dritto a destra, rovescio a sinistra)
  // e colpisce con un gesto vero: dritto da destra a sinistra, rovescio da sinistra a destra
  if (fpRacket.visible) {
    const a = avatars[0]; if (!a) return;
    const ready = G.ideal && G.ideal.who === 0 ? sideOf(0, G.ideal) : 1;
    const side = a.swingT >= 0 ? a.swingDir : ready;
    a.fpSide = (a.fpSide ?? 1) + (side - (a.fpSide ?? 1)) * Math.min(1, dt * 8);
    const k = a.swingT >= 0 ? clamp(a.swingT / 0.28, 0, 1) : 0, e = Math.sin(k * Math.PI), up = a.up || 0;
    const fs = a.fpSide; // +1 dritto, -1 rovescio
    const x0 = fs > 0 ? 0.36 : -0.34, x1 = fs > 0 ? -0.28 : 0.3;
    _pv.set(x0 + (x1 - x0) * k, -0.3 + 0.1 * e + up * 0.1 * e - (k > 0 && k < 1 ? 0 : 0.02), -0.6 - 0.22 * e);
    fpRacket.position.lerp(_pv, Math.min(1, dt * 20));
    const ry0 = fs > 0 ? 0.55 : -1.0, ry1 = fs > 0 ? -0.9 : 0.7;
    _pe.set(-0.3 + up * 0.5 * e, ry0 + (ry1 - ry0) * k, (fs > 0 ? -0.45 : 0.5) + 0.4 * e * fs);
    _pq2.setFromEuler(_pe); fpRacket.quaternion.slerp(_pq2, Math.min(1, dt * 20));
  }
}

// ---------- rete: telefoni ----------
const CODE = (Q.get('code') || randomCode()).toUpperCase();
const ctrlUrl = () => new URL(`telecomando.html?r=${CODE}${Q.get('peer') ? '&peer=' + Q.get('peer') : ''}`, location.href).href;
let NET = null;
try {
  NET = hostRoom(CODE, {
    onOpen() { $('#net').textContent = 'Sala aperta: entra col telefono'; },
    onMsg: (id, m) => onPhone(id, m),
    onClose(id) { const p = G.players.find(p => p.conn === id); if (p) { p.online = false; renderLobby(); } },
    onError(t) { $('#net').textContent = 'Telefoni non disponibili (' + t + '): gioca qui con mouse o dito'; },
  });
} catch (e) { $('#net').textContent = 'Telefoni non disponibili'; }
const send = (p, m) => { if (p && p.kind === 'phone' && p.conn && NET) NET.send(p.conn, m); };
function onPhone(id, m) {
  if (m.t === 'ping') return;
  if (m.t === 'join') {
    let p = G.players.find(x => x.pid && x.pid === m.pid);
    if (!p) {
      const humans = G.players.filter(x => x.kind !== 'cpu');
      if (G.phase !== 'lobby' || humans.length >= 2) { NET.send(id, { t: 'full', text: G.phase !== 'lobby' ? 'Partita in corso: aspetta la prossima' : 'Ci sono già due giocatori' }); return; }
      p = { kind: 'phone', pid: m.pid, name: (m.name || 'Telefono').slice(0, 14), color: m.color, look: m.look || randomLook() };
      G.players = G.players.filter(x => x.kind !== 'cpu'); G.players.push(p);
    }
    p.conn = id; p.online = true; p.lat = 0.04;
    NET.send(id, { t: 'hi', name: p.name, color: p.color, game: 'pong' });
    renderLobby(); if (G.phase !== 'lobby') sendState();
    return;
  }
  const p = G.players.find(x => x.conn === id); if (!p) return;
  if (m.t === 'sync') { const rtt = (performance.now() - m.h) / 1000; if (rtt < 1) p.lat = p.lat * 0.7 + (rtt / 2) * 0.3; return; }
  if (m.t === 'pq') { const i = G.players.indexOf(p); G.pq = G.pq || []; G.pq[i] = m.q; return; }
  if (m.t === 'toss') { const i = G.players.indexOf(p); if (G.phase === 'serve' && G.server === i && !G.toss) toss(); return; }
  if (m.t === 'sw0') { const i = G.players.indexOf(p); swing(i, { time: G.time - (p.lat || 0.05) - (m.ago || 0) / 1000 }); return; }
  if (m.t === 'sw') {
    const i = G.players.indexOf(p);
    // la direzione viene da come è girata la racchetta (il telefono) in quel momento
    swing(i, { time: G.time - (p.lat || 0.04) - (m.ago || 0) / 1000, p: clamp(+m.p || 0.5, 0.05, 1.4), vert: clamp(+m.vert || 0, -1, 1), twist: clamp(+m.twist || 0, -1, 1), yaw: m.yaw || 0 });
  }
}
setInterval(() => { for (const p of G.players) if (p.kind === 'phone' && p.online) send(p, { t: 'sync', h: performance.now() }); }, 2000);
function sendState() {
  G.players.forEach((p, i) => send(p, { t: 'pong', serving: G.serving && G.server === i && G.phase === 'serve', score: [G.score[i], G.score[1 - i]], vs: G.players[1 - i]?.name || '' }));
}

// ---------- lobby ----------
const COLORS = ['#ff5a3d', '#38e8ff'];
function renderLobby() {
  const qr = qrcode(0, 'M'); qr.addData(ctrlUrl()); qr.make(); $('#qr').innerHTML = qr.createSvgTag({ cellSize: 5, margin: 1, scalable: true });
  $('#code').textContent = CODE; $('#url').textContent = ctrlUrl().replace(/^https?:\/\//, '');
  const humans = G.players.filter(p => p.kind !== 'cpu');
  $('#plist').innerHTML = humans.length ? humans.map((p, i) => `<div class="pp"><span class="dot" style="background:${COLORS[i]}"></span><b>${esc(p.name)}</b><small>${p.kind === 'phone' ? (p.online ? '📱 telefono' : '📱 scollegato') : '🖱 qui'}</small><button data-del="${i}">✕</button></div>`).join('') : '<p class="note">Entra col telefono o aggiungi un giocatore qui.</p>';
  $('#start').disabled = !humans.length;
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
document.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || $('#lobby').classList.contains('hide')) return;
  if (b.dataset.del != null) { const h = G.players.filter(p => p.kind !== 'cpu'); const p = h[+b.dataset.del]; send(p, { t: 'kicked' }); G.players.splice(G.players.indexOf(p), 1); renderLobby(); }
  const pick = (sel, el) => document.querySelectorAll(sel).forEach(x => x.classList.toggle('sel', x === el));
  if (b.dataset.l) { G.level = +b.dataset.l; pick('#levels .chip', b); }
  if (b.dataset.p) { G.target = +b.dataset.p; pick('#pts .chip', b); }
  if (b.dataset.a) { G.assist = b.dataset.a === '1'; pick('#assist .chip', b); }
});
$('#addLocal').onclick = () => { ac(); if (G.players.filter(p => p.kind === 'local').length >= 1 || G.players.filter(p => p.kind !== 'cpu').length >= 2) return; const n = $('#localName').value.trim() || 'Giocatore'; G.players = G.players.filter(x => x.kind !== 'cpu'); const pr = savedProfile(); G.players.unshift({ kind: 'local', name: n.slice(0, 14), look: pr ? pr.look : randomLook() }); renderLobby(); };
$('#start').onclick = () => { if (!$('#start').dataset.ready) return; ac(); startMatch(); };
$('#again').onclick = () => { $('#end').classList.add('hide'); startMatch(); };
$('#toLobby').onclick = () => { $('#end').classList.add('hide'); $('#hud').classList.add('hide'); $('#lobby').classList.remove('hide'); G.phase = 'lobby'; G.players = G.players.filter(p => p.kind !== 'cpu'); renderLobby(); sendState(); };
$('#menuBtn').onclick = () => { if (window.confirm('Tornare alla sala?')) $('#toLobby').onclick(); };

// ---------- partita ----------
function startMatch() {
  G.players = G.players.filter(p => p.kind !== 'cpu');
  if (G.players.length === 1) { const b = BOTS[Math.floor(Math.random() * BOTS.length)]; G.players.push({ kind: 'cpu', name: b.name, look: randomLook() }); }
  G.score = [0, 0]; G.server = Math.random() < 0.5 ? 0 : 1; G.serves = 0; G.charge = [0, 0]; G.fire = false; updateCharge();
  $('#lobby').classList.add('hide'); $('#hud').classList.remove('hide');
  $('#nA').textContent = G.players[0].name; $('#nB').textContent = G.players[1].name; $('#setInfo').textContent = 'a ' + G.target;
  G.view = G.players.filter(p => p.kind !== 'cpu').length === 2 ? 'tv' : 'behind';
  setupAvatars(); updateScore();
  big(`${G.players[G.server].name} batte`, 1300);
  setTimeout(beginServe, 1400);
}
function updateScore() { $('#ptA').textContent = G.score[0]; $('#ptB').textContent = G.score[1]; $('#srvA').classList.toggle('on', G.server === 0); $('#srvB').classList.toggle('on', G.server === 1); }
function beginServe() {
  G.phase = 'serve'; G.serving = true; G.lastHitter = -1; G.bounces = []; G.ideal = null; G.pendingHit = null; G.stillT = 0;
  const i = G.server, s = sideZ(i), a = avatars[i];
  G.ball = mkBall(a.x - 0.12 * s, 0.95, s * (T.L / 2 + 0.25)); G.toss = null; G.ball.held = true;
  trailPts.length = 0;
  const p = G.players[i];
  tip(p.kind === 'cpu' ? `${p.name} batte` : p.kind === 'phone' ? `${p.name}: premi LANCIA sul telefono, poi colpisci quando la palla scende` : 'Battuta: muovi il mouse veloce quando la palla scende (o premi spazio)');
  sendState();
  // il computer lancia subito; chi gioca lancia la palla col tasto (o dopo qualche secondo)
  const sv = G.serveId = (G.serveId || 0) + 1;
  setTimeout(() => { if (G.phase === 'serve' && G.serveId === sv && !G.toss) toss(); }, p.kind === 'cpu' ? 700 : 7000);
}
function toss() {
  const b = G.ball; b.held = false; b.vy = 2.3; G.toss = { t0: G.time };
  // momento ideale: quando ricade all'altezza di partenza + 10 cm
  G.ideal = { who: G.server, t: G.time + (2.3 + Math.sqrt(2.3 * 2.3 - 2 * 9.81 * 0.1)) / 9.81, x: b.x, y: 1.05, serve: true };
  if (G.players[G.server].kind === 'cpu') scheduleCpu(G.server);
}
function scheduleCpu(i) {
  const lv = [0.05, 0.03, 0.014][G.level], id = G.ideal; if (!id || id.who !== i) return;
  const dt = gauss() * lv * (id.serve ? 0.4 : 1);
  let p = rnd(0.45, 0.85), vert = rnd(0.2, 0.8), aim = rnd(-0.55, 0.55);
  if (!id.serve) {
    if ((G.charge || [0, 0])[i] >= 1 && G.level >= 1 && Math.random() < 0.7) { p = 1.05; vert = -0.5; }
    else if (id.y > 1.08 && G.level >= 1 && Math.random() < 0.55) { p = rnd(1.0, 1.15); vert = -0.6; }
    else if (G.incomingSpeed > 11 && Math.random() < 0.4) { p = rnd(0.25, 0.4); vert = 0.85; }
    else if (Math.random() < 0.12) { p = rnd(0.35, 0.6); vert = -0.5; }
    else if (Math.random() < 0.08 && G.level >= 1) { p = 0.12; vert = 0.1; }
  }
  G.cpuSwing = { who: i, at: id.t + HIT_BEST + dt, sw: { p, vert, twist: rnd(-0.2, 0.2), aim } };
}
// Colpo "alla Wii": conta l'INIZIO del gesto. Se parti in una finestra larga prima del momento giusto,
// la racchetta prende la palla nel punto giusto (il ritardo del Wi-Fi non conta più). Forza, alto/basso
// ed effetto arrivano dal gesto completo, se arriva in tempo.
const HIT_EARLY = 0.65, HIT_LATE = 0.12, HIT_BEST = -0.16;
function swing(i, sw) {
  const a = avatars[i]; if (!a) return;
  const t = sw.time ?? G.time;
  const ph = G.pendingHit;
  // dettagli di un gesto già iniziato: si aggiornano forza e direzione, non si rifà il colpo
  if (ph && ph.who === i && !ph.done && t - ph.t0 < 0.7) { Object.assign(ph.sw, sw.p != null ? { p: sw.p, vert: sw.vert ?? ph.sw.vert, twist: sw.twist ?? 0, yaw: sw.yaw ?? ph.sw.yaw } : {}); return; }
  if (G.phase !== 'serve' && G.phase !== 'rally') { startSwingAnim(i, sw); return; }
  if (G.serving && G.server === i && !G.toss) { toss(); return; } // senza tasto, il primo gesto lancia la palla
  const id = G.ideal; if (!id || id.who !== i) { startSwingAnim(i, sw); return; }
  const d = t - id.t;
  if (d < -HIT_EARLY || d > HIT_LATE) { startSwingAnim(i, sw); if (G.players[i].kind !== 'cpu') shotTip(d < 0 ? 'Troppo presto!' : 'Troppo tardi!'); return; }
  const W = HIT_EARLY;
  G.pendingHit = { who: i, at: Math.max(G.time, id.t), d: d - HIT_BEST, W, sw: { p: 0.65, vert: 0.2, twist: 0, yaw: 0, ...sw }, t0: t, side: sideOf(i, id) };
  // l'animazione parte in modo da arrivare sulla palla proprio al momento giusto
  startSwingAnim(i, sw, Math.max(0, id.t - G.time), G.pendingHit.side);
}
// dritto o rovescio: dipende da che lato del corpo arriva la palla (destrorso)
function sideOf(i, id) { const a = avatars[i]; if (!a || !id) return 1; const rel = (id.x - a.x) * (i === 0 ? 1 : -1); return rel >= -0.05 ? 1 : -1; }
function startSwingAnim(i, sw, lead = 0, side) {
  const a = avatars[i]; if (!a) return;
  if ((a.swingT >= 0 && a.swingT < 0.25) || a.pend) return;
  a.pend = { wait: Math.max(0, lead - 0.14), side: side ?? (G.ideal ? sideOf(i, G.ideal) : 1), up: sw.vert || 0, p: sw.p || 0.6 };
}

// colpo: dalla posizione attuale della palla verso il campo avversario
function doHit(h) {
  if (DEBUG) (G.log = G.log || []).push(`${G.time.toFixed(2)} HIT by ${h.who} d=${h.d.toFixed(3)} y=${G.ball.y.toFixed(2)} z=${G.ball.z.toFixed(2)}`);
  const i = h.who, s = sideZ(i), b = G.ball, sw = h.sw, q = 1 - Math.abs(h.d) / h.W;
  const left = i === 0 ? -1 : 1; // la sinistra di chi colpisce, in coordinate x
  let type = 'drive', p = sw.p, vert = sw.vert;
  if (G.serving) type = 'serve';
  else if (p >= 0.95 && vert < -0.15) type = 'smash';
  else if (vert > 0.5 && p < 0.5) type = 'lob';
  else if (vert < -0.3 && p < 0.75) type = 'chop';
  else if (p < 0.2) type = 'drop';
  const noise = 0.03 + (1 - q) * 0.16 + Math.max(0, p - 1.05) * 0.12 + (b.y < 0.85 && type === 'smash' ? 0.2 : 0);
  let tx = sw.aim != null ? sw.aim : (h.d / h.W) * 0.6 * left * -1 + b.x * 0.15;
  tx = clamp(tx + gauss() * noise, -0.78, 0.78);
  let depth, flight, spin = { wx: 0, wy: (sw.twist || 0) * 60, wz: 0 }, label;
  if (type === 'serve') {
    // battuta: rimbalzo sul proprio campo e poi di là
    return doServe(i, p, tx, q);
  } else if (type === 'smash') { depth = 0.95; flight = -1 * (14 + 5 * Math.min(p, 1.3)); spin.wx = -s * 70; label = 'Schiacciata!'; }
  else if (type === 'lob') { depth = 1.05; flight = 1.1 + (0.5 - p) * 0.4; spin.wx = -s * 30; label = 'Pallonetto'; }
  else if (type === 'chop') { depth = 0.8; flight = -1 * (4.5 + 3 * p); spin.wx = s * 110; label = 'Taglio'; }
  else if (type === 'drop') { depth = 0.35; flight = 0.8; spin.wx = s * 50; label = 'Smorzata'; }
  else { depth = 0.5 + 0.72 * Math.min(1, p) + Math.max(0, p - 1.05) * 1.6; flight = -1 * (5.5 + 9 * Math.min(p, 1.3)); spin.wx = -s * (40 + 110 * Math.max(0, vert)); label = vert > 0.5 ? 'Colpo carico' : 'Dritto'; }
  depth += gauss() * noise;
  const tz = -s * depth;
  // flight < 0 = velocità media: il tempo di volo dipende dalla distanza
  if (flight < 0) flight = Math.hypot(tx - b.x, tz - b.z) / -flight;
  // barra carica: i colpi a tempo la riempiono; piena + schiacciata (o colpo perfetto) = colpo di fuoco
  G.charge[i] = Math.min(1, G.charge[i] + (q > 0.8 ? 0.25 : 0.1));
  let fire = false;
  if (G.charge[i] >= 1 && (type === 'smash' || q > 0.85) && type !== 'lob' && type !== 'drop') { fire = true; G.charge[i] = 0; flight /= 1.35; spin.wx *= 1.4; label = '🔥 COLPO DI FUOCO'; big('🔥 Fuoco!', 900); snd('cheer'); }
  G.fire = fire; updateCharge();
  const v = solve({ x: b.x, y: b.y, z: b.z }, tx, tz, flight, spin);
  Object.assign(b, { vx: v.vx, vy: v.vy, vz: v.vz, wx: spin.wx, wy: spin.wy, wz: spin.wz });
  G.netHit = false; G.lastHitter = i; G.bounces = []; G.ideal = null; G.pendingHit = null; G.incomingSpeed = Math.hypot(v.vx, v.vy, v.vz);
  snd('hit', p);
  if (G.players[i].kind !== 'cpu') shotTip(`${label} · ${(G.incomingSpeed * 3.6).toFixed(0)} km/h` + (q > 0.8 ? ' · tempo perfetto' : ''));
  planReceive();
}
function doServe(i, p, tx, q) {
  const s = sideZ(i), b = G.ball;
  const tries = [];
  const fast = Math.min(p, 1);
  for (const z1 of [0.3, 0.4, 0.5]) for (const fl of [0.35, 0.4, 0.45, 0.5]) tries.push([z1, fl]);
  tries.sort((a, c) => (Math.abs(a[1] - (0.5 - fast * 0.15)) - Math.abs(c[1] - (0.5 - fast * 0.15))) + (Math.random() - 0.5) * 0.08);
  const err = (1 - q) * 0.25 + Math.max(0, p - 1.1) * 0.3;
  let chosen = null;
  for (const [z1, fl] of tries) {
    const spin = { wx: -s * (Math.random() < 0.6 ? 60 : 0), wy: rnd(-20, 20), wz: 0 };
    const v = solve({ x: b.x, y: b.y, z: b.z }, clamp(b.x * 0.5 + tx * 0.3, -0.6, 0.6), s * z1, fl, spin);
    const test = mkBall(b.x, b.y, b.z, v.vx, v.vy, v.vz, spin.wx, spin.wy, spin.wz), pr = predict(test, 2.5);
    const tb = pr.ev.filter(e => e.t === 'table');
    if (tb.length >= 2 && tb[0].side === s && tb[1].side === -s && !pr.ev.some(e => e.t === 'net' || e.t === 'cord')) { chosen = { v, spin }; break; }
  }
  if (!chosen) { const spin = { wx: -s * 40, wy: 0, wz: 0 }; chosen = { v: solve({ x: b.x, y: b.y, z: b.z }, 0, s * 0.7, 0.32, spin), spin }; }
  const v = chosen.v; v.vx += gauss() * err * 0.5; if (err > 0.18) v.vz *= 1 + gauss() * 0.06;
  Object.assign(b, { vx: v.vx, vy: v.vy, vz: v.vz, ...chosen.spin });
  G.netHit = false; G.lastHitter = i; G.bounces = []; G.ideal = null; G.pendingHit = null; G.toss = null; G.phase = 'rally';
  snd('hit', 0.6); planReceive();
}
// prevede dove e quando l'avversario potrà colpire
function planReceive() {
  const r = 1 - G.lastHitter, s = sideZ(r);
  const pr = predict(G.ball, 3);
  const tb = pr.ev.filter(e => e.t === 'table');
  const needed = G.serving ? 2 : 1;
  const bounce = tb[needed - 1];
  if (!bounce || bounce.side !== s || (G.serving && tb[0].side !== -s)) { G.ideal = null; if (DEBUG) (G.log = G.log || []).push(`${G.time.toFixed(2)} noplan ` + tb.map(e => e.side).join(',') + ' ' + pr.ev.map(e=>e.t).join(',')); return; }
  const after = pr.pts.filter(q => q.t > bounce.time);
  const second = tb[needed] ? tb[needed].time : 9;
  let hit = after.find(q => s * q.z > T.L / 2 + 0.12 && q.t < second) || after.find(q => q.vy < 0 && q.y < T.H + 0.3 && q.t < second - 0.04) || after[Math.floor(after.length * 0.3)];
  if (!hit) { G.ideal = null; return; }
  G.ideal = { who: r, t: G.time + hit.t, x: hit.x, y: hit.y, z: hit.z };
  if (DEBUG) (G.log = G.log || []).push(`${G.time.toFixed(2)} plan ${r} at ${G.ideal.t.toFixed(2)} y=${hit.y.toFixed(2)} z=${hit.z.toFixed(2)}`);
  if (G.players[r].kind === 'cpu') scheduleCpu(r);
}

// ---------- arbitro ----------
function onEvent(e) {
  const b = G.ball; if (DEBUG) (G.log = G.log || []).push(`${G.time.toFixed(2)} ev ${e.t}${e.side ?? ''} z=${(e.z ?? b.z).toFixed(2)} lh=${G.lastHitter} b=${G.bounces.join('')} srv=${G.serving}`);
  if (e.t === 'table') {
    snd('table'); bounceRing(e.x, T.H, e.z, G.fire ? 0xff7a2a : 0xffffff);
    const owner = e.side > 0 ? 0 : 1;
    G.bounces.push(owner);
    if (G.serving) {
      if (G.bounces.length === 1 && owner !== G.lastHitter) return point(1 - G.lastHitter, 'Battuta sbagliata');
      if (G.bounces.length === 2) { if (owner === G.lastHitter) return point(1 - G.lastHitter, 'Doppio rimbalzo'); G.serving = false; G.bounces = [owner]; }
      if (G.bounces.length === 2 && G.serving) return;
      return;
    }
    if (G.bounces.length === 1 && owner === G.lastHitter) return point(1 - G.lastHitter, G.netHit ? 'In rete!' : 'Sul tuo campo!');
    if (G.bounces.length >= 2) return point(G.lastHitter, 'Doppio rimbalzo');
  } else if (e.t === 'net') { snd('net'); G.netHit = true; }
  else if (e.t === 'cord') { snd('net'); if (G.serving) G.let = true; }
  else if (e.t === 'floor') {
    snd('floor');
    const opp = 1 - G.lastHitter;
    if (G.serving && G.bounces.length < 2) return point(opp, G.bounces.length ? 'Battuta fuori' : 'Fuori!');
    if (G.bounces.length === 0) return point(opp, G.netHit ? 'In rete!' : 'Fuori!');
    return point(G.lastHitter, G.bounces.length === 1 && G.ideal ? 'Imprendibile!' : 'Punto!');
  }
}
function point(w, why) {
  if (G.phase !== 'rally' && G.phase !== 'serve') return;
  if (G.let && why !== 'Fuori!') { G.let = false; }
  G.phase = 'point'; G.ideal = null; G.pendingHit = null; G.cpuSwing = null; G.fire = false;
  G.score[w]++; updateScore();
  const hum = G.players[w].kind !== 'cpu';
  big(`${why}`, 1400); tip(`Punto a ${G.players[w].name}`);
  snd(hum || G.view === 'tv' ? 'cheer' : 'aww');
  G.crowdJump = G.time;
  // fine partita?
  const [a, c] = G.score;
  if ((a >= G.target || c >= G.target) && Math.abs(a - c) >= 2) { setTimeout(endMatch, 1600); sendState(); return; }
  // cambio battuta ogni 2 punti (ogni punto ai vantaggi)
  G.serves++;
  const every = (a >= G.target - 1 && c >= G.target - 1) ? 1 : 2;
  if (G.serves >= every) { G.serves = 0; G.server = 1 - G.server; }
  updateScore(); sendState();
  setTimeout(beginServe, FAST ? 500 : 1700);
}
function endMatch() {
  G.phase = 'over'; const w = G.score[0] > G.score[1] ? 0 : 1;
  $('#final').innerHTML = `<div class="w">${esc(G.players[w].name)} vince!</div><div>${G.score[0]} — ${G.score[1]}</div>`;
  $('#end').classList.remove('hide'); snd('win');
  G.players.forEach((p, i) => send(p, { t: 'end', text: i === w ? 'Hai vinto!' : `Vince ${G.players[w].name}`, score: `${G.score[i]}-${G.score[1 - i]}` }));
}

// ---------- HUD ----------
let bigT = 0, shotT = 0;
function big(t, ms = 1300) { const el = $('#big'); el.textContent = t; el.classList.add('show'); clearTimeout(bigT); bigT = setTimeout(() => el.classList.remove('show'), ms); }
function tip(t) { $('#tip').textContent = t; }
function shotTip(t) { const el = $('#shot'); el.textContent = t; el.classList.add('show'); clearTimeout(shotT); shotT = setTimeout(() => el.classList.remove('show'), 1500); }

// ---------- comandi locali: il mouse (o il dito) come racchetta ----------
let mv = [];
function localIdx() { return G.players.findIndex(p => p.kind === 'local'); }
addEventListener('pointermove', e => {
  if (G.phase !== 'rally' && G.phase !== 'serve') return;
  const now = performance.now() / 1000; mv.push({ t: now, x: e.clientX, y: e.clientY }); while (mv.length > 2 && now - mv[0].t > 0.08) mv.shift();
  if (mv.length < 2) return;
  const a = mv[0], b = mv[mv.length - 1], dt = Math.max(0.008, b.t - a.t), H = innerHeight;
  const vx = (b.x - a.x) / dt / H, vy = (b.y - a.y) / dt / H, sp = Math.hypot(vx, vy);
  if (sp > 2.2 && (!G.lastLocalSw || now - G.lastLocalSw > 0.35)) {
    G.lastLocalSw = now;
    const i = localIdx(); if (i < 0) return;
    swing(i, { time: G.time, p: clamp(sp / 7.5, 0.1, 1.35), vert: clamp(-vy / sp, -1, 1), twist: 0, yaw: vx < 0 ? 1 : -1 });
  }
});
addEventListener('pointerdown', () => { ac(); const i = localIdx(); if (i >= 0 && G.phase === 'serve' && G.server === i && !G.toss) toss(); });
addEventListener('keydown', e => {
  const i = localIdx(); if (i < 0) return;
  if (e.code === 'Space') { e.preventDefault(); swing(i, { time: G.time, p: 0.65, vert: 0.4, twist: 0, yaw: 1 }); }
  if (e.code === 'KeyS') swing(i, { time: G.time, p: 1.1, vert: -0.6, twist: 0, yaw: 1 });
  if (e.code === 'KeyL') swing(i, { time: G.time, p: 0.3, vert: 0.9, twist: 0, yaw: 1 });
});

// ---------- ciclo ----------
const _p = new THREE.Vector3(), _l = new THREE.Vector3();
let last = performance.now(), acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000); last = now; if (FAST) dt *= 2;
  G.time += dt;
  if (G.ball && (G.phase === 'serve' || G.phase === 'rally' || G.phase === 'point')) {
    const b = G.ball;
    if (b.held) { const a = avatars[G.server]; b.x = a.x - 0.12 * sideZ(G.server); b.y = 0.95; }
    else {
      acc += dt; let n = 0;
      while (acc > 1 / 480 && n < 60) {
        const ev = []; step(b, 1 / 480, ev, G.time); acc -= 1 / 480; n++;
        if (G.phase !== 'point') for (const e of ev) onEvent(e);
        if (G.pendingHit && !G.pendingHit.done && G.time >= G.pendingHit.at) { G.pendingHit.done = true; doHit(G.pendingHit); }
        if (G.serving && G.toss && b.y < 0.75 && b.vy < 0 && G.phase === 'serve') { if (G.players[G.server].kind !== 'cpu') shotTip('Palla caduta: rilancio'); beginServe(); break; }
      }
      // palla ferma sul tavolo
      if (Math.hypot(b.vx, b.vy, b.vz) < 0.15 && G.phase === 'rally') { G.stillT += dt; if (G.stillT > 0.8) point(b.z > 0 ? 1 : 0, 'Palla morta'); } else G.stillT = 0;
      if (G.cpuSwing && G.time >= G.cpuSwing.at) { const c = G.cpuSwing; G.cpuSwing = null; swing(c.who, { ...c.sw, time: G.time, yaw: 1 }); }
    }
    ballMesh.position.set(b.x, b.y, b.z); ballMesh.visible = true;
    ballMesh.material.emissive.setHex(G.fire ? 0xff4400 : 0xffa060); ballMesh.material.emissiveIntensity = G.fire ? 1.6 : 0.12;
    fireLight.intensity = G.fire ? 3 : 0; fireLight.position.copy(ballMesh.position);
    // la palla gira davvero con la sua rotazione
    const wl = Math.hypot(b.wx, b.wy, b.wz); if (wl > 0.1) { ballMesh.rotateOnWorldAxis(_tv.set(b.wx / wl, b.wy / wl, b.wz / wl), Math.min(wl * dt * 0.25, 0.9)); }
    const over = Math.abs(b.x) <= T.W / 2 && Math.abs(b.z) <= T.L / 2 && b.y > T.H - 0.01, gy = over ? T.H + 0.002 : 0.004;
    ballShadow.visible = !b.held; ballShadow.position.set(b.x, gy, b.z); const hgt = Math.max(0, b.y - gy); ballShadow.scale.setScalar(0.6 + hgt * 1.2); ballShadow.material.opacity = Math.max(0.15, 1 - hgt * 1.5);
    if (!b.held) { trailPts.push(b.x, b.y, b.z); if (trailPts.length > TRAIL * 3) trailPts.splice(0, 3); }
    drawTrail(G.fire ? new THREE.Color(1.4, 0.55, 0.1) : new THREE.Color(0.75, 0.9, 1.25)); trail.visible = Math.hypot(b.vx, b.vy, b.vz) > 2.5 && !b.held;
  } else { ballMesh.visible = false; ballShadow.visible = false; trail.visible = false; }
  updateRings(dt);
  animateAvatars(dt);
  updateCamera(dt);
  composer.render();
}
function updateCamera(dt) {
  const b = G.ball;
  if (Q.has('cam')) { const c = Q.get('cam').split(',').map(Number); camera.position.set(c[0], c[1], c[2]); camera.lookAt(c[3], c[4], c[5]); return; }
  if (G.phase === 'lobby') { const t = G.time * 0.12; _p.set(Math.sin(t) * 4.2, 2.2, Math.cos(t) * 4.2); _l.set(0, 0.8, 0); }
  else if (G.view === 'tv') { _p.set(3.4, 2.3, (b ? b.z : 0) * 0.15); _l.set(0, 0.85, (b ? b.z : 0) * 0.25); }
  else { // prima persona: occhi del giocatore vicino, segue un po' la palla
    const ax = avatars[0] ? avatars[0].x : 0;
    _p.set(ax * 0.8 + 0.1, 1.42, T.L / 2 + 0.85);
    _l.set((b ? b.x : 0) * 0.35 + ax * 0.3, 0.86 + (b ? Math.max(0, b.y - 1) * 0.3 : 0), -0.8);
  }
  const k = 1 - Math.exp(-dt * (G.view === 'tv' ? 4 : 7)); G.camPos.lerp(_p, k); G.camLook.lerp(_l, k);
  camera.position.copy(G.camPos); camera.lookAt(G.camLook);
}

renderLobby(); resize(); requestAnimationFrame(frame);
await loadAvatarLibrary(); $('#start').dataset.ready = '1';
if (DEBUG) { window.__G = G; window.__swing = swing; window.__start = startMatch; window.__av = avatars; }
if (Q.has('auto')) {
  // prova: due computer
  G.players = [{ kind: 'cpu', name: 'Topspin', look: randomLook() }, { kind: 'cpu', name: 'La Contessa', look: randomLook() }];
  if (Q.has('nocos')) G.players.forEach(p => { p.look.costume = 'none'; });
  G.target = +(Q.get('pts') || 5);
  const orig = startMatch;
  G.players.forEach(p => p.kind = 'cpu');
  $('#lobby').classList.add('hide'); $('#hud').classList.remove('hide');
  G.score = [0, 0]; G.server = 0; G.serves = 0; $('#nA').textContent = G.players[0].name; $('#nB').textContent = G.players[1].name;
  G.view = Q.get('auto') === 'tv' ? 'tv' : 'behind'; if (Q.has('fp')) G.players[0].kind = 'local'; setupAvatars(); if (Q.has('fp')) G.players[0].kind = 'cpu'; updateScore(); setTimeout(beginServe, 500);
}
