// Bowling (stile Switch Sports): sala luminosa, il tuo personaggio che lancia, telefono come palla.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { L, SPECIALS, newBall, step as laneStep, pinSpots, heightAt } from './lane.js';
import * as Pins from './pins.js';
import * as Sc from './score.js';
import { hostRoom, randomCode } from '../net.js';
import { loadAvatarLibrary, makeAvatar, randomLook, savedProfile } from '../avatar/avatar.js';

const Q = new URLSearchParams(location.search);
const DEBUG = Q.has('debug'), FAST = Q.has('fast');
const MOBILE = matchMedia('(pointer:coarse)').matches;
const $ = s => document.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const COLORS = ['#3d7bff', '#ff5c9a', '#ffb02e', '#2ec27e', '#9a5cff', '#ff6a3d'];
const SPEC_ORDER = ['dossi', 'muri', 'stretta', 'salto', 'girandola'];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ canvas: $('#gl'), antialias: true, powerPreference: 'high-performance' });
let PR = Math.min(devicePixelRatio, MOBILE ? 1.5 : 1.75); renderer.setPixelRatio(PR);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0b0d1c); scene.fog = new THREE.Fog(0x0b0d1c, 30, 60);
new RGBELoader().load('assets/hdr/ferndale_studio_04_1k.hdr', t => { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromEquirectangular(t).texture; t.dispose(); });
const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 90);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.45, 0.35, 1.0));
composer.addPass(new OutputPass());
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); composer.setSize(w, h); camera.aspect = w / h; camera.fov = w < h ? 68 : 50; camera.updateProjectionMatrix(); }
addEventListener('resize', resize);

// ---------- materiali e texture ----------
function ctex(w, h, draw, rep) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); } return t; }
const laneTex = ctex(256, 2048, (g, w, h) => {
  const boards = 39, bw = w / boards;
  for (let i = 0; i < boards; i++) { const l = 64 + Math.random() * 7; g.fillStyle = `hsl(${30 + Math.random() * 5},${58 + Math.random() * 10}%,${l}%)`; g.fillRect(i * bw, 0, bw, h); g.fillStyle = 'rgba(120,80,40,.18)'; g.fillRect(i * bw, 0, 1, h); }
  for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(150,100,50,${Math.random() * .07})`; g.fillRect(Math.random() * w, Math.random() * h, 1, 8 + Math.random() * 40); }
  const yOf = z => h * (1 - z / 19.4); g.fillStyle = '#3d7bff';
  for (const b of [5, 10, 15, 20, 25, 30, 35]) { const x = b * bw, y = yOf(4.6 + Math.abs(b - 20) * 0.05); g.beginPath(); g.moveTo(x, y - 34); g.lineTo(x - 6, y + 10); g.lineTo(x + 6, y + 10); g.fill(); }
  for (const b of [3, 5, 8, 11, 14, 25, 28, 31, 34, 36]) { g.beginPath(); g.arc(b * bw, yOf(2.1), 3, 0, 7); g.fill(); }
});
const laneMat = new THREE.MeshPhysicalMaterial({ map: laneTex, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 0.55 });
const whiteGloss = new THREE.MeshPhysicalMaterial({ color: 0xf4f7ff, roughness: 0.18, clearcoat: 1 });
const navy = new THREE.MeshStandardMaterial({ color: 0x2b3566, roughness: 0.5 });
const pinTex = ctex(64, 512, (g, w, h) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); const v = y => h * (1 - y / 0.381); g.fillStyle = '#e8243c'; g.fillRect(0, v(0.262), w, v(0.252) - v(0.262)); g.fillRect(0, v(0.243), w, v(0.233) - v(0.243)); });
const pinMat = new THREE.MeshPhysicalMaterial({ map: pinTex, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05 });
const pinGeo = (() => {
  const prof = [[0, 0], [0.026, 0], [0.036, 0.008], [0.048, 0.04], [0.058, 0.08], [0.0605, 0.114], [0.057, 0.15], [0.045, 0.2], [0.03, 0.24], [0.0235, 0.26], [0.024, 0.28], [0.03, 0.31], [0.032, 0.33], [0.029, 0.355], [0.018, 0.374], [0, 0.381]];
  const pts = []; for (let i = 0; i <= 64; i++) { const y = i / 64 * 0.381; let k = 0; while (k < prof.length - 2 && prof[k + 1][1] < y) k++; const [r0, y0] = prof[k], [r1, y1] = prof[k + 1]; pts.push(new THREE.Vector2(Math.max(0.0001, r0 + (r1 - r0) * ((y - y0) / Math.max(1e-6, y1 - y0))), y)); }
  const g = new THREE.LatheGeometry(pts, 40); g.translate(0, -Pins.PIN.com, 0); return g;
})();
function ballTex(color) {
  return ctex(512, 256, (g, w, h) => {
    const c = new THREE.Color(color); g.fillStyle = color; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) { g.strokeStyle = '#' + c.clone().lerp(new THREE.Color(i % 2 ? '#ffffff' : '#000000'), 0.35).getHexString(); g.globalAlpha = 0.35; g.lineWidth = 4 + Math.random() * 12; g.beginPath(); let x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); for (let s = 0; s < 4; s++) g.quadraticCurveTo(x + Math.random() * 120 - 60, y + Math.random() * 60 - 30, x += Math.random() * 100 - 50, y += Math.random() * 50 - 25); g.stroke(); }
    g.globalAlpha = 1; g.fillStyle = '#111';
    for (const [u, v, r] of [[0.25, 0.22, 10], [0.235, 0.32, 9], [0.265, 0.32, 9]]) { g.beginPath(); g.arc(u * w, v * h, r, 0, 7); g.fill(); }
  });
}

// ---------- sala ----------
const LANES_X = [-4.4, -2.2, 0, 2.2, 4.4];
const MASK_COLORS = [0x2ec27e, 0xff5c9a, 0x3d7bff, 0xffb02e, 0x9a5cff];
let mainLaneMesh = null;
function neon(color, k = 2.2) { return new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), toneMapped: false, fog: false }); }
function buildHall() {
  const darkWood = new THREE.MeshStandardMaterial({ color: 0x1c2140, roughness: 0.55, metalness: 0.1 });
  for (const [i, lx] of LANES_X.entries()) {
    const grp = new THREE.Group(); grp.position.x = lx;
    const lane = new THREE.Mesh(new THREE.BoxGeometry(L.W, 0.06, 19.4), laneMat); lane.position.set(0, -0.03, -9.7); lane.receiveShadow = true; grp.add(lane);
    if (lx === 0) mainLaneMesh = lane;
    const deckM = new THREE.Mesh(new THREE.BoxGeometry(L.W, 0.06, 1.6), laneMat); deckM.position.set(0, -0.03, -20.2); deckM.receiveShadow = true; grp.add(deckM);
    for (const s of [-1, 1]) {
      const gut = new THREE.Mesh(new THREE.CylinderGeometry(L.gutter / 2, L.gutter / 2, 20.2, 20, 1, true, -Math.PI / 2, Math.PI), new THREE.MeshPhysicalMaterial({ color: 0x2a3160, roughness: 0.25, metalness: 0.3, clearcoat: 1, side: THREE.DoubleSide }));
      gut.rotation.x = Math.PI / 2; gut.position.set(s * (L.half + L.gutter / 2), -0.005, -9.7); gut.receiveShadow = true; grp.add(gut);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 21), darkWood); cap.position.set(s * (L.half + L.gutter + 0.05), 0.0, -10); cap.receiveShadow = true; grp.add(cap);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.012, 21), neon(MASK_COLORS[i], 1.6)); strip.position.set(s * (L.half + L.gutter + 0.05), 0.046, -10); grp.add(strip);
    }
    const pit = new THREE.Mesh(new THREE.BoxGeometry(L.W + 2 * L.gutter + 0.2, 0.6, 1.4), new THREE.MeshStandardMaterial({ color: 0x07080f })); pit.position.set(0, -0.32, -21.7); grp.add(pit);
    // mascherone: pannello scuro con cornice luminosa e numero
    const mask = new THREE.Mesh(new THREE.BoxGeometry(L.W + 2 * L.gutter + 0.3, 1.1, 0.35), new THREE.MeshStandardMaterial({ map: maskTex(i), roughness: 0.6 }));
    mask.position.set(0, 1.75, -19.95); grp.add(mask);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(L.W + 2 * L.gutter + 0.34, 0.035, 0.37), neon(MASK_COLORS[i])); frame.position.set(0, 1.2, -19.95); grp.add(frame);
    const hood = new THREE.Mesh(new THREE.BoxGeometry(L.W + 2 * L.gutter + 0.3, 0.5, 2.2), new THREE.MeshStandardMaterial({ color: 0x10142a })); hood.position.set(0, 2.55, -19.2); grp.add(hood);
    for (const s of [-1, 1]) { const side = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.45, 2.4), darkWood); side.position.set(s * (L.half + L.gutter + 0.12), 0.2, -19.7); grp.add(side); }
    if (lx !== 0) for (const sp of pinSpots()) { const p = new THREE.Mesh(pinGeo, pinMat); p.position.set(sp.x, Pins.PIN.com, sp.z); p.castShadow = true; grp.add(p); }
    const appr = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 5), new THREE.MeshPhysicalMaterial({ map: laneTex, color: 0xf2dcc0, roughness: 0.3, clearcoat: 0.8 })); appr.position.set(0, -0.031, 2.5); appr.receiveShadow = true; grp.add(appr);
    const foul = new THREE.Mesh(new THREE.BoxGeometry(L.W + 2 * L.gutter, 0.004, 0.025), neon('#ff3355', 1.4)); foul.position.set(0, 0.002, 0); grp.add(foul);
    if (i < 4) grp.add(ballReturn(1.1));
    // luce del birillaio: pannello luminoso sotto il cappello
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(L.W + 0.3, 1.6), new THREE.MeshBasicMaterial({ color: 0xbfb8aa })); glow.rotation.x = Math.PI / 2; glow.position.set(0, 2.29, -19.2); grp.add(glow);
    scene.add(grp);
  }
  // moquette scura con motivi "cosmici" luminosi, come nelle sale vere
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(30, 12), new THREE.MeshStandardMaterial({ map: ctex(512, 512, (g, w, h) => { g.fillStyle = '#141838'; g.fillRect(0, 0, w, h); const c = ['#ffcf3a', '#ff4fa0', '#38d6ff', '#8a5cff']; for (let i = 0; i < 70; i++) { g.strokeStyle = g.fillStyle = c[i % 4]; g.globalAlpha = .7; g.lineWidth = 3; const x = Math.random() * w, y = Math.random() * h, r = 5 + Math.random() * 12; if (i % 3 === 0) { g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke(); } else if (i % 3 === 1) { g.beginPath(); g.moveTo(x - r, y); g.quadraticCurveTo(x, y - r * 1.5, x + r, y); g.stroke(); } else { g.beginPath(); g.arc(x, y, 2.5, 0, 7); g.fill(); } } }, [6, 3]), roughness: 0.95 }));
  carpet.rotation.x = -Math.PI / 2; carpet.position.set(0, -0.061, 11); carpet.receiveShadow = true; scene.add(carpet);
  const under = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ color: 0x0b0d1c })); under.rotation.x = -Math.PI / 2; under.position.set(0, -0.08, -10); scene.add(under);
  // pareti: blu notte con pannelli fonoassorbenti e strisce luminose
  const wallTex = ctex(1024, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#0f1330'); gr.addColorStop(1, '#232a5c'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 64) { g.fillStyle = (x / 64) % 2 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.12)'; g.fillRect(x + 4, 30, 56, h - 70); }
  }, [3, 1]);
  const wallM = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.9 });
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(40, 8), wallM); w.position.set(s * 7.4, 4, -4); w.rotation.y = -s * Math.PI / 2; scene.add(w);
    for (const [y, c] of [[0.9, '#38d6ff'], [3.3, '#ff4fa0']]) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 40), neon(c)); st.position.set(s * 7.37, y, -4); scene.add(st); }
  }
  // parete di fondo: un murale al tramonto con il cartello al neon
  const back = new THREE.Mesh(new THREE.PlaneGeometry(30, 8), new THREE.MeshBasicMaterial({ map: muralTex() })); back.position.set(0, 3.2, -22.5); scene.add(back);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.5), new THREE.MeshBasicMaterial({ map: ctex(1024, 256, (g, w, h) => { g.font = '700 170px Fredoka, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = '#ff4fa0'; g.shadowBlur = 30; g.fillStyle = '#ffd1ea'; g.fillText('STRIKE', w / 2, h / 2 + 10); g.shadowBlur = 10; g.fillText('STRIKE', w / 2, h / 2 + 10); }), transparent: true, toneMapped: false, fog: false, color: new THREE.Color(2, 2, 2) }));
  sign.position.set(0, 4.3, -22.45); scene.add(sign);
  const front = new THREE.Mesh(new THREE.PlaneGeometry(30, 8), wallM); front.position.set(0, 4, 16); front.rotation.y = Math.PI; scene.add(front);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(30, 40), new THREE.MeshStandardMaterial({ color: 0x0c0f22 })); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 5, -4); scene.add(ceil);
  // faretti tondi sul soffitto (caldi) e due "onde" luminose sopra le piste
  const spotM = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.9, 1.5), toneMapped: false });
  for (let i = 0; i < 8; i++) for (const x of [-5.5, -3.3, -1.1, 1.1, 3.3, 5.5]) { const d = new THREE.Mesh(new THREE.CircleGeometry(0.13, 20), spotM); d.rotation.x = Math.PI / 2; d.position.set(x, 4.98, 8 - i * 3.6); scene.add(d); }
  for (const [z, c] of [[-4, '#38d6ff'], [-10, '#8a5cff'], [-15, '#ff4fa0']]) {
    const pts = []; for (let k = 0; k <= 40; k++) { const x = -7 + k * 0.35; pts.push(new THREE.Vector3(x, 4.6 + Math.sin(k * 0.5) * 0.12, z)); }
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.025, 6), neon(c)); scene.add(tube);
  }
  monitor = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.75, 0.1), [darkWood, darkWood, darkWood, darkWood, new THREE.MeshBasicMaterial({ map: monitorTex }), darkWood]);
  monitor.position.set(0, 3.7, -1.2); monitor.rotation.x = 0.3; scene.add(monitor);
  // luci: poca luce d'ambiente, piste illuminate dall'alto, birilli in piena luce
  scene.add(new THREE.HemisphereLight(0x9fb4ff, 0x1a1530, 0.35));
  const key = new THREE.DirectionalLight(0xffe6c8, 2.0); key.position.set(2.5, 7, 5); key.target.position.set(0, 0, -1); key.castShadow = true;
  Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -6, near: 1, far: 20 }); key.shadow.mapSize.set(MOBILE ? 1024 : 2048, MOBILE ? 1024 : 2048); key.shadow.bias = -0.0005; key.shadow.normalBias = 0.02;
  scene.add(key, key.target);
  const laneFill = new THREE.DirectionalLight(0xfff0dd, 1.1); laneFill.position.set(-1, 6, -6); laneFill.target.position.set(0, 0, -12); scene.add(laneFill, laneFill.target);
  const pinLight = new THREE.SpotLight(0xfff4e6, 9, 7, 0.8, 0.7, 1.3); pinLight.position.set(0, 2.2, -18.4); pinLight.target.position.set(0, 0, -18.9); pinLight.castShadow = true; pinLight.shadow.mapSize.set(1024, 1024); scene.add(pinLight, pinLight.target);
  const lounge = new THREE.PointLight(0xffb070, 6, 9, 1.6); lounge.position.set(0, 2.8, 7); scene.add(lounge);
}
function maskTex(i) {
  const col = '#' + new THREE.Color(MASK_COLORS[i]).getHexString();
  return ctex(512, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#151a3a'); gr.addColorStop(1, '#262d63'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = col; g.globalAlpha = 0.55; g.lineWidth = 6;
    for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(w * (0.15 + k * 0.18), h * 1.1, 60 + k * 18, Math.PI, Math.PI * 2); g.stroke(); }
    g.globalAlpha = 1; g.fillStyle = col; g.font = '700 150px Fredoka, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(i + 1), w / 2, h / 2 + 8);
  });
}
function muralTex() {
  return ctex(2048, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#1b1446'); gr.addColorStop(0.45, '#6b2c7a'); gr.addColorStop(0.75, '#e2577a'); gr.addColorStop(1, '#ffb36b'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,240,200,.9)'; g.beginPath(); g.arc(w * 0.5, h * 0.78, 120, 0, 7); g.fill();
    for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.7})`; g.fillRect(Math.random() * w, Math.random() * h * 0.4, 2, 2); }
    // colline e skyline stilizzati
    g.fillStyle = '#2a1650'; g.beginPath(); g.moveTo(0, h); for (let x = 0; x <= w; x += 40) g.lineTo(x, h * 0.8 - Math.sin(x / 210) * 40 - Math.sin(x / 90) * 12); g.lineTo(w, h); g.fill();
    g.fillStyle = '#160c33'; let x = 0; while (x < w) { const bw = 40 + Math.random() * 80, bh = 60 + Math.random() * 160; if (Math.abs(x - w / 2) > 260) g.fillRect(x, h - bh, bw, bh); x += bw + 6; }
    g.fillStyle = '#ffd36b'; for (let i = 0; i < 260; i++) { const xx = Math.random() * w; if (Math.abs(xx - w / 2) > 270) g.fillRect(xx, h - Math.random() * 150, 5, 7); }
  });
}
let monitor = null;
const monCanvas = document.createElement('canvas'); monCanvas.width = 512; monCanvas.height = 214;
const monitorTex = new THREE.CanvasTexture(monCanvas); monitorTex.colorSpace = THREE.SRGBColorSpace;
function drawMonitor(name, line, color) {
  const g = monCanvas.getContext('2d'); g.fillStyle = '#10163a'; g.fillRect(0, 0, 512, 214);
  g.fillStyle = color || '#3d7bff'; g.fillRect(0, 0, 512, 56); g.fillStyle = '#fff'; g.font = '700 40px Fredoka, Arial'; g.textBaseline = 'middle'; g.fillText(name || '', 18, 30);
  g.font = '600 56px Fredoka, Arial'; g.fillStyle = '#ffcf3a'; g.fillText(line || '', 18, 136); monitorTex.needsUpdate = true;
}
function ballReturn(x) {
  const g = new THREE.Group(); g.position.set(x, 0, 3.4);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.9, 6, 16), new THREE.MeshPhysicalMaterial({ color: 0x3d7bff, roughness: 0.3, clearcoat: 1 }));
  body.rotation.x = Math.PI / 2; body.position.y = 0.42; body.scale.set(1, 1, 0.8); body.castShadow = true; g.add(body);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 1.1), new THREE.MeshStandardMaterial({ color: 0xc8d0e8, metalness: 0.6, roughness: 0.3 })); rail.position.set(0, 0.68, 0.1); g.add(rail);
  [0x2ec27e, 0xff5c9a, 0xffb02e].forEach((c, k) => { const b = new THREE.Mesh(new THREE.SphereGeometry(L.R, 24, 16), new THREE.MeshPhysicalMaterial({ map: ballTex('#' + new THREE.Color(c).getHexString()), roughness: 0.15, clearcoat: 1 })); b.position.set(0, 0.8, -0.32 + k * 0.23); b.castShadow = true; g.add(b); });
  return g;
}
// arredi KayKit (CC0) nella zona dietro le piste
const furn = {};
async function loadFurniture() {
  const ld = new GLTFLoader();
  for (const n of ['couch_pillows', 'armchair_pillows', 'table_low', 'lamp_standing', 'cactus_medium_A', 'cactus_small_B', 'rug_rectangle_A']) furn[n] = (await ld.loadAsync('assets/furniture/' + n + '.gltf')).scene;
  const put = (n, x, z, ry = 0, s = 1.2) => { const o = furn[n].clone(); o.position.set(x, -0.06, z); o.rotation.y = ry; o.scale.setScalar(s); o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); scene.add(o); return o; };
  put('rug_rectangle_A', 0, 7.2, 0, 2.2);
  seats = [];
  for (const [x, ry] of [[-1.6, Math.PI], [1.6, Math.PI]]) { put('couch_pillows', x, 7.4, ry, 1.25); seats.push([x - 0.45, 7.25], [x + 0.45, 7.25]); }
  put('table_low', 0, 6.2, 0, 1.3); put('armchair_pillows', -3.8, 6.6, Math.PI * 0.8, 1.25); seats.push([-3.75, 6.5]);
  put('armchair_pillows', 3.8, 6.6, -Math.PI * 0.8, 1.25); seats.push([3.75, 6.5]);
  put('lamp_standing', -5.6, 8, 0, 1.4); put('lamp_standing', 5.6, 8, 0, 1.4); put('cactus_medium_A', -6.4, 5, 0, 1.5); put('cactus_small_B', 6.4, 5, 0, 1.6); put('cactus_medium_A', 6.6, 9.6, 1, 1.4);
}
let seats = [];

// ---------- pista speciale ----------
const specGroup = new THREE.Group(); scene.add(specGroup);
let specObjs = [];
function buildSpecial(key) {
  specGroup.clear(); specObjs = [];
  if (mainLaneMesh) mainLaneMesh.visible = !key;
  if (!key) return;
  const spec = SPECIALS[key];
  const geo = new THREE.PlaneGeometry(L.W, 19.4, 8, 260); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) { const z = pos.getZ(i) - 9.7; pos.setZ(i, z); const hole = spec.hole && spec.hole(z); pos.setY(i, hole ? -2 : heightAt(spec, z)); }
  geo.computeVertexNormals();
  const surf = new THREE.Mesh(geo, laneMat); surf.receiveShadow = true; specGroup.add(surf);
  const obsMat = new THREE.MeshPhysicalMaterial({ color: 0xff5c9a, roughness: 0.3, clearcoat: 1 });
  for (const o of spec.obstacles(0)) { const m = new THREE.Mesh(o.box ? new THREE.BoxGeometry(o.w, 0.32, o.d) : new THREE.BoxGeometry(0.08, 0.26, 1), o.box ? obsMat : new THREE.MeshPhysicalMaterial({ color: 0xffb02e, roughness: 0.3, clearcoat: 1 })); m.castShadow = true; specGroup.add(m); specObjs.push(m); }
  updateSpecial(0);
}
function updateSpecial(t) {
  if (!G.spec) return;
  SPECIALS[G.spec].obstacles(t).forEach((o, i) => {
    const m = specObjs[i]; if (!m) return;
    if (o.box) m.position.set(o.cx, 0.16, o.cz);
    else { const dx = o.bx - o.ax, dz = o.bz - o.az; m.scale.z = Math.hypot(dx, dz); m.position.set((o.ax + o.bx) / 2, 0.13, (o.az + o.bz) / 2); m.rotation.y = Math.atan2(dx, dz); }
  });
}

// ---------- palla, birilli ----------
const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(L.R, 40, 28), new THREE.MeshPhysicalMaterial({ roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.03 }));
ballMesh.castShadow = true; scene.add(ballMesh);
const ballTexCache = {};
function setBallColor(c) { ballMesh.material.map = ballTexCache[c] || (ballTexCache[c] = ballTex(c)); ballMesh.material.needsUpdate = true; }
const pinMeshes = pinSpots().map(() => { const m = new THREE.Mesh(pinGeo, pinMat); m.castShadow = true; m.receiveShadow = true; scene.add(m); return m; });
const rake = new THREE.Mesh(new THREE.BoxGeometry(L.W + 0.4, 0.14, 0.05), navy); rake.visible = false; scene.add(rake);

// ---------- suoni ----------
let AC = null, master, noiseB, rollGain = null;
function ac() {
  if (AC) return AC;
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)(); master = AC.createGain(); master.gain.value = 0.8; master.connect(AC.destination);
    noiseB = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate); const d = noiseB.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = AC.createBufferSource(); src.buffer = noiseB; src.loop = true; const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 160; rollGain = AC.createGain(); rollGain.gain.value = 0; src.connect(f); f.connect(rollGain); rollGain.connect(master); src.start();
  } catch (e) { AC = null; }
  return AC;
}
function snd(type, v = 1) {
  const c = ac(); if (!c) return; const t = c.currentTime;
  const tone = (f, dur, vol, at = 0, typ = 'sine', slide = 1) => { const o = c.createOscillator(), g = c.createGain(); o.type = typ; o.frequency.setValueAtTime(f, t + at); if (slide !== 1) o.frequency.exponentialRampToValueAtTime(f * slide, t + at + dur); g.gain.setValueAtTime(vol, t + at); g.gain.exponentialRampToValueAtTime(1e-4, t + at + dur); o.connect(g); g.connect(master); o.start(t + at); o.stop(t + at + dur + .02); };
  const noise = (dur, f, q, vol, at = 0, typ = 'bandpass') => { const s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain(); s.buffer = noiseB; fl.type = typ; fl.frequency.value = f; fl.Q.value = q; g.gain.setValueAtTime(vol, t + at); g.gain.exponentialRampToValueAtTime(1e-4, t + at + dur); s.connect(fl); fl.connect(g); g.connect(master); s.start(t + at, Math.random()); s.stop(t + at + dur + .02); };
  const k = Math.min(1, v);
  if (type === 'pin') { noise(0.08, 2200 + Math.random() * 1200, 4, 0.35 * k); tone(1100 + Math.random() * 400, 0.04, 0.12 * k, 0, 'triangle'); }
  else if (type === 'land') { tone(70, 0.2, 0.5 * k); noise(0.12, 200, 1, 0.4 * k, 0, 'lowpass'); }
  else if (type === 'wall') { tone(160, 0.12, 0.4 * k, 0, 'square', 0.5); }
  else if (type === 'gutter') { tone(90, 0.3, 0.3, 0, 'sine', 0.7); }
  else if (type === 'strike') { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.5, 0.15, i * 0.08, 'triangle')); noise(1.4, 1500, 0.5, 0.25, 0.1); }
  else if (type === 'spare') { [659, 784, 988].forEach((f, i) => tone(f, 0.4, 0.15, i * 0.09, 'triangle')); noise(0.9, 1500, 0.5, 0.15, 0.1); }
  else if (type === 'boo') { tone(260, 0.5, 0.14, 0, 'sawtooth', 0.6); }
  else if (type === 'whoosh') { noise(0.3, 800, 0.8, 0.15 * k); }
}

// ---------- stato ----------
const G = { phase: 'loading', players: [], cur: 0, mode: 'classica', nFrames: 10, spec: null, ball: null, aimX: 0.18, aimA: 0, spin: 0, swing: 0, time: 0, standing: [], camPos: new THREE.Vector3(0, 3, 9), camLook: new THREE.Vector3(0, 0, -10) };
const deck = Pins.createDeck();
for (const p of deck.pins) p.addEventListener('collide', e => { const v = Math.abs(e.contact.getImpactVelocityAlongNormal()); if (v > 0.8 && G.lastClack + 0.02 < G.time) { G.lastClack = G.time; snd('pin', v / 4); } });
G.lastClack = 0;

// ---------- avatar ----------
const AV_H = 1.7;
function ensureAvatar(p) {
  if (p.av) return p.av;
  p.av = makeAvatar({ ...(p.look || randomLook()), prop: 'none' }, { height: AV_H });
  p.av.root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  scene.add(p.av.root);
  return p.av;
}
function seatPlayers() {
  const others = G.players.filter((_, i) => i !== G.cur);
  others.forEach((p, k) => {
    const av = ensureAvatar(p), s = seats[k % Math.max(1, seats.length)] || [k - 2, 7.2];
    av.root.position.set(s[0], 0.12, s[1]); av.root.rotation.y = Math.PI;
    if (av.state !== 'sit') { av.play('Sit_Chair_Idle', { fade: 0.3 }); av.state = 'sit'; }
  });
  const p = G.players[G.cur]; if (!p) return;
  const av = ensureAvatar(p); av.root.rotation.y = Math.PI; av.state = 'bowl';
  av.root.position.set(G.aimX + 0.12, 0, 1.25); av.play('Idle', { fade: 0.25 });
}
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
// orienta un osso perché punti nella direzione voluta (in coordinate mondo)
function aimBone(bone, child, dir) {
  bone.updateWorldMatrix(true, false); child.updateWorldMatrix(true, false);
  const a = bone.getWorldPosition(_v1), b = child.getWorldPosition(_v2);
  const cur = b.sub(a).normalize();
  _q1.setFromUnitVectors(cur, dir);
  bone.getWorldQuaternion(_q2); _q2.premultiply(_q1);
  const pq = new THREE.Quaternion(); bone.parent.getWorldQuaternion(pq);
  bone.quaternion.copy(pq.invert().multiply(_q2));
}
function poseArm(av, th, k = 1) {
  // th: 0 braccio giù, <0 indietro, >0 avanti (il personaggio guarda verso -z)
  const B = av.bones, up = B.upperarmr, low = B.lowerarmr, hand = B.wristr || B.handr;
  if (!up || !low) return;
  const dir = new THREE.Vector3(0.08, -Math.cos(th), -Math.sin(th)).normalize();
  if (k < 1) { const cur = new THREE.Vector3(); const a = up.getWorldPosition(new THREE.Vector3()), b = low.getWorldPosition(new THREE.Vector3()); cur.subVectors(b, a).normalize(); dir.lerp(cur, 1 - k).normalize(); }
  aimBone(up, low, dir); aimBone(low, hand, dir);
}
function setAvatarOpacity(p, o) {
  const av = p && p.av; if (!av || av.opacity === o) return; av.opacity = o;
  av.root.traverse(m => { if (!m.isMesh) return; for (const mt of [].concat(m.material)) { mt.transparent = o < 1; mt.opacity = o; mt.depthWrite = o >= 1; } m.castShadow = o > 0.5; });
}
// guida sulla pista: dove va la palla (prima parte), con la curva dell'effetto
const guideGeo = new THREE.BufferGeometry(); const GUIDE_N = 28;
guideGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(GUIDE_N * 3), 3));
const guide = new THREE.Points(guideGeo, new THREE.PointsMaterial({ size: 0.13, map: ctex(64, 64, (g) => { g.fillStyle = '#fff'; g.beginPath(); g.arc(32, 32, 28, 0, 7); g.fill(); }), alphaTest: 0.4, color: new THREE.Color(2.2, 1.9, 0.6), transparent: true, opacity: 0.9, toneMapped: false, depthWrite: false }));
scene.add(guide); guide.visible = false;
function updateGuide() {
  const b = newBall(G.aimX, G.aimA, 7.5, G.spin), pos = guideGeo.attributes.position, ev = [];
  let k = 0, t = 0, next = 0;
  while (k < GUIDE_N && t < 3) { if (b.z <= next) { pos.setXYZ(k++, b.x, 0.012, b.z); next -= 0.42; } laneStep(b, 1 / 240, null, 0, ev); t += 1 / 240; if (b.gutter) break; }
  while (k < GUIDE_N) pos.setXYZ(k++, 0, -5, 0);
  pos.needsUpdate = true; guideGeo.computeBoundingSphere();
}
function handPos(av) { const h = av.bones.handslotr || av.bones.handr; return h.getWorldPosition(new THREE.Vector3()); }

// ---------- rete: telefoni ----------
const CODE = (Q.get('code') || randomCode()).toUpperCase();
const ctrlUrl = () => new URL(`telecomando.html?r=${CODE}${Q.get('peer') ? '&peer=' + Q.get('peer') : ''}`, location.href).href;
let NET = null;
try {
  NET = hostRoom(CODE, {
    onOpen() { $('#net').textContent = 'Sala aperta: entra col telefono'; },
    onMsg: (id, m) => onPhone(id, m),
    onClose(id) { const p = G.players.find(p => p.conn === id); if (p) { p.online = false; renderLobby(); } },
    onError(t) { $('#net').textContent = 'Telefoni non disponibili (' + t + '): gioca qui col mouse'; },
  });
} catch (e) { $('#net').textContent = 'Telefoni non disponibili'; }
function send(p, m) { if (p.kind === 'phone' && p.conn && NET) NET.send(p.conn, m); }
function onPhone(id, m) {
  if (m.t === 'ping') return;
  if (m.t === 'join') {
    let p = G.players.find(x => x.pid && x.pid === m.pid);
    if (!p) {
      if (G.phase !== 'lobby') { NET.send(id, { t: 'full', text: 'Partita in corso: aspetta la prossima' }); return; }
      if (G.players.length >= 6) { NET.send(id, { t: 'full', text: 'Sala piena' }); return; }
      p = { kind: 'phone', pid: m.pid, name: (m.name || 'Telefono').slice(0, 14), color: m.color || COLORS[G.players.length % 6], look: m.look || randomLook() };
      G.players.push(p);
    }
    p.conn = id; p.online = true; if (m.name) p.name = m.name.slice(0, 14); if (m.look) { p.look = m.look; if (p.av) p.av.setLook({ ...m.look, prop: 'none' }); }
    NET.send(id, { t: 'hi', name: p.name, color: p.color, game: 'bowling' });
    renderLobby(); if (G.phase !== 'lobby') sendTurns();
    return;
  }
  const p = G.players.find(x => x.conn === id); if (!p) return;
  if (m.t === 'color') { p.color = m.color; renderLobby(); return; }
  if (G.players[G.cur] !== p) return;
  if (m.t === 'aim' && G.phase === 'aim') { G.aimX = clamp(+m.x || 0, -0.44, 0.44); G.aimA = clamp(+m.a || 0, -0.06, 0.06); drawAim(); }
  if (m.t === 'spin' && G.phase === 'aim') { G.spin = clamp(+m.v || 0, -1, 1); drawAim(); }
  if (m.t === 'swing' && G.phase === 'aim') { G.swing = clamp(+m.th || 0, -1.6, 1.6); G.swingLive = G.time; }
  if (m.t === 'throw' && G.phase === 'aim') throwBall({ power: +m.power || 0, hook: +m.hook || 0, timing: +m.timing || 0, pull: +m.pull || 0 }, 'phone');
}
function sendTurns() {
  const cp = G.players[G.cur];
  for (const p of G.players) {
    if (p.kind !== 'phone') continue;
    if (p === cp && G.phase === 'aim') send(p, { t: 'turn', yours: true, frame: Sc.currentFrame(p.sheet) + 1, pins: G.standing.length, x: G.aimX, a: G.aimA, spin: G.spin, spec: G.spec ? SPECIALS[G.spec].name : '' });
    else send(p, { t: 'turn', yours: false, who: cp ? cp.name : '' });
  }
}

// ---------- lobby ----------
function renderLobby() {
  const qr = qrcode(0, 'M'); qr.addData(ctrlUrl()); qr.make(); $('#qr').innerHTML = qr.createSvgTag({ cellSize: 5, margin: 1, scalable: true });
  $('#code').textContent = CODE; $('#url').textContent = ctrlUrl().replace(/^https?:\/\//, '');
  $('#plist').innerHTML = G.players.length ? G.players.map((p, i) => `<div class="pp"><i style="background:${p.color}"></i><b>${esc(p.name)}</b><small>${p.kind === 'phone' ? (p.online ? '📱 telefono' : '📱 scollegato') : p.kind === 'bot' ? '🤖 computer' : '🖱 qui'}</small><button data-del="${i}">✕</button></div>`).join('') : '<p class="note">Nessuno ancora: entra col telefono o aggiungi un giocatore qui.</p>';
  $('#start').disabled = !G.players.length;
}
const BOT_NAMES = ['Birillo', 'Contessa', 'Mister Strike', 'Nonna Pina', 'Er Canale'];
document.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || $('#lobby').classList.contains('hide')) return;
  if (b.dataset.del != null) { const p = G.players[+b.dataset.del]; send(p, { t: 'kicked' }); if (p.av) p.av.dispose(); G.players.splice(+b.dataset.del, 1); renderLobby(); }
  if (b.dataset.m) { G.mode = b.dataset.m; document.querySelectorAll('#modes .opt').forEach(x => x.classList.toggle('sel', x === b)); }
  if (b.dataset.f) { G.nFrames = +b.dataset.f; document.querySelectorAll('#frames .chip').forEach(x => x.classList.toggle('sel', x === b)); }
});
$('#addLocal').onclick = () => { if (G.players.some(p => p.kind === 'local')) return; const pr = savedProfile(); const n = $('#localName').value.trim() || (pr && pr.name) || 'Giocatore'; G.players.push({ kind: 'local', name: n.slice(0, 14), color: COLORS[G.players.length % 6], look: pr ? pr.look : randomLook() }); ac(); renderLobby(); };
$('#addBot').onclick = () => { const used = G.players.map(p => p.name); const n = BOT_NAMES.find(x => !used.includes(x)) || 'Computer'; G.players.push({ kind: 'bot', name: n, color: COLORS[G.players.length % 6], look: randomLook() }); renderLobby(); };
$('#start').onclick = () => { ac(); startGame(); };
$('#again').onclick = () => { $('#end').classList.add('hide'); startGame(); };
$('#toLobby').onclick = () => { $('#end').classList.add('hide'); $('#hud').classList.add('hide'); $('#lobby').classList.remove('hide'); G.phase = 'lobby'; buildSpecial(null); G.spec = null; sendTurns(); };
$('#menuBtn').onclick = () => { if (G.phase === 'lobby' || window.confirm('Tornare alla sala? La partita si chiude.')) $('#toLobby').onclick(); };

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
  // pista speciale: la stessa per tutti nello stesso frame
  const want = G.mode === 'speciale' ? SPEC_ORDER[fi % SPEC_ORDER.length] : null;
  if (want !== G.spec) { G.spec = want; buildSpecial(want); }
  G.aimX = p.lastX ?? 0.18; G.aimA = 0; G.spin = p.lastSpin ?? 0; G.swing = 0; G.followDone = false; setAvatarOpacity(p, 1); G.ball = null; G.phase = 'aim'; G.aimT = 0; G.released = false;
  setBallColor(p.color); seatPlayers();
  $('#who b').textContent = p.name; $('#who span').textContent = `Frame ${fi + 1} di ${p.sheet.frames.length}` + (G.spec ? ' · ' + SPECIALS[G.spec].name : '');
  drawMonitor(p.name, `Frame ${fi + 1} · ${Sc.total(p.sheet)} punti`, p.color);
  tip(p.kind === 'local' ? 'Scegli posizione ed effetto, poi tieni premuto, trascina giù per caricare e lascia' : p.kind === 'phone' ? `${p.name}: scegli l'effetto, poi tieni premuto sul telefono, braccio indietro e avanti, e lascia` : `${p.name} si prepara…`);
  if (G.spec && p.sheet.frames[fi].length === 0 && G.cur === 0) big(SPECIALS[G.spec].name, 'b', 1600);
  $('#aim').classList.toggle('hide', p.kind !== 'local');
  drawAim(); renderSheet(); sendTurns();
  if (p.kind === 'bot') setTimeout(botThrow, FAST ? 100 : 900);
}
function throwBall(inp, src) {
  if (G.phase !== 'aim' || G.released) return;
  const p = G.players[G.cur];
  let speed = clamp(2.8 + inp.power * 6.7, 2.4, 10.8), hook = clamp(inp.hook, -1, 1), ang = G.aimA + clamp(inp.pull || 0, -0.05, 0.05), loft = 0, note = '';
  const tm = inp.timing ?? 0;
  if (tm < -0.45) { speed *= 0.8; ang += (Math.random() - .5) * 0.03; note = 'Lasciata troppo presto!'; }
  else if (tm > 1.0) { loft = Math.min(1, (tm - 1.0) * 1.5 + 0.3); ang += (Math.random() - .5) * 0.025; note = 'Volata! Troppo tardi'; }
  else if (Math.abs(tm - 0.1) < 0.25 && src !== 'bot') note = 'Rilascio perfetto';
  p.lastX = G.aimX; p.lastSpin = G.spin;
  G.pending = { speed, hook, ang, loft, note };
  // animazione: un passo avanti e il braccio che va
  G.released = true; G.relT = 0; G.swingFrom = G.swing; snd('whoosh', speed / 9); G.fadeAv = true;
  $('#aim').classList.add('hide'); $('#power').classList.remove('on');
}
function launch() {
  const P = G.pending, p = G.players[G.cur];
  G.ball = newBall(G.aimX, P.ang, P.speed, P.hook, P.loft); G.ball.y = Math.max(G.ball.y, 0);
  G.phase = 'roll'; G.rollT = 0;
  tip(`${(P.speed * 3.6).toFixed(0)} km/h` + (Math.abs(P.hook) > 0.15 ? ` · effetto ${P.hook < 0 ? 'a sinistra' : 'a destra'}` : '') + (P.note ? ' · ' + P.note : ''));
  if (P.loft) snd('land', 0.3);
  sendTurns();
}

// ---------- computer ----------
function botThrow() {
  if (G.phase !== 'aim') return;
  const standing = G.standing.map(n => pinSpots()[n - 1]);
  const full = standing.length === 10;
  const targetX = full ? 0.06 : standing.reduce((a, s) => a + s.x, 0) / standing.length;
  const spec = G.spec ? SPECIALS[G.spec] : null;
  const hook = full && !spec ? -0.55 : full ? -0.3 : 0, x0 = full ? 0.22 : clamp(-targetX * 0.6, -0.3, 0.3);
  const t0 = G.time + 1.6;
  const sim = (a, speed) => { const b = newBall(x0, a, speed, hook); const ev = []; let t = 0; while (!b.done && !b.stopped && !b.fell && t < 6) { laneStep(b, 1 / 240, spec, t0 + t, ev); t += 1 / 240; } return { x: b.done ? b.x : 9, ok: b.done && !ev.some(e => e.t === 'wall') && !b.gutter }; };
  let best = null;
  for (const speed of spec ? [8, 9.4, 7, 6.2, 8.6, 7.5, 10] : [7.6 + Math.random() * 0.8]) {
    let a0 = -0.01, a1 = 0.01, f0 = sim(a0, speed).x - targetX, f1 = sim(a1, speed).x - targetX;
    for (let i = 0; i < 6 && Math.abs(f1) > 0.005 && f1 !== f0; i++) { const a2 = a1 - f1 * (a1 - a0) / (f1 - f0); a0 = a1; f0 = f1; a1 = clamp(a2, -0.08, 0.08); f1 = sim(a1, speed).x - targetX; }
    const r = sim(a1, speed);
    if (!best || (r.ok && !best.ok) || (r.ok === best.ok && Math.abs(f1) < Math.abs(best.err))) best = { a: a1, speed, ok: r.ok, err: f1 };
    if (best.ok && Math.abs(best.err) < 0.02) break;
  }
  G.aimX = x0; G.aimA = best.a + (Math.random() + Math.random() - 1) * 0.0035; drawAim();
  G.spin = hook; drawAim();
  G.botSwing = { t: 0, speed: best.speed, hook: hook + (Math.random() - .5) * 0.1 };
}

// ---------- comandi col mouse / dito: trascina giù per caricare, lascia ----------
const canvas = $('#gl');
let gest = null;
canvas.addEventListener('pointerdown', e => {
  ac(); const p = G.players[G.cur];
  if (G.phase !== 'aim' || !p || p.kind !== 'local' || G.released) return;
  canvas.setPointerCapture(e.pointerId); gest = { x0: e.clientX, y0: e.clientY, pow: 0, hook: 0 };
  $('#power').classList.add('on');
});
canvas.addEventListener('pointermove', e => {
  if (!gest) return;
  const H = Math.min(innerHeight, 700);
  gest.pow = clamp((e.clientY - gest.y0) / (H * 0.32), 0, 1);
  G.swing = -gest.pow * 1.3;
  $('#power b').style.height = (gest.pow * 100) + '%';
});
canvas.addEventListener('pointerup', () => {
  if (!gest) return; const g = gest; gest = null; $('#power').classList.remove('on');
  if (g.pow < 0.08) { G.swing = 0; tip('Trascina più giù per caricare il tiro'); return; }
  throwBall({ power: 0.2 + g.pow * 0.95, hook: G.spin, timing: 0.1, pull: 0 }, 'local');
});
const aimLane = document.querySelector('#aim .lane'); let aimDrag = false;
const aimFromEv = e => { const r = aimLane.getBoundingClientRect(); G.aimX = clamp(((e.clientX - r.left) / r.width - 0.5) / 0.76 * L.W, -0.44, 0.44); drawAim(); };
aimLane.addEventListener('pointerdown', e => { aimLane.setPointerCapture(e.pointerId); aimDrag = true; aimFromEv(e); });
aimLane.addEventListener('pointermove', e => { if (aimDrag) aimFromEv(e); });
aimLane.addEventListener('pointerup', () => aimDrag = false);
const nudge = (dx, da) => { if (G.phase !== 'aim' || G.released) return; G.aimX = clamp(G.aimX + dx, -0.44, 0.44); G.aimA = clamp(G.aimA + da, -0.06, 0.06); drawAim(); };
$('#mvL').onclick = () => nudge(-0.03, 0); $('#mvR').onclick = () => nudge(0.03, 0); $('#angL').onclick = () => nudge(0, -0.003); $('#angR').onclick = () => nudge(0, 0.003);
addEventListener('keydown', e => {
  const p = G.players[G.cur]; if (!p || p.kind !== 'local') return;
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') nudge(-0.02, 0); if (e.code === 'ArrowRight' || e.code === 'KeyD') nudge(0.02, 0);
  if (e.code === 'KeyQ') nudge(0, -0.003); if (e.code === 'KeyE') nudge(0, 0.003);
  if (e.code === 'KeyZ') setSpin(G.spin - 0.5); if (e.code === 'KeyC') setSpin(G.spin + 0.5);
});
function setSpin(v) { if (G.phase !== 'aim' || G.released) return; G.spin = clamp(Math.round(v * 2) / 2, -1, 1); drawAim(); }
document.querySelectorAll('#spinPC [data-sp]').forEach(b => b.onclick = () => setSpin(+b.dataset.sp));
function drawAim() {
  document.querySelectorAll('#spinPC [data-sp]').forEach(b => b.classList.toggle('sel', +b.dataset.sp === G.spin));
  G.guideDirty = true;
  const f = 0.5 + G.aimX / L.W * 0.76; document.querySelector('#aim .ball').style.left = (f * 100) + '%';
  const l = $('#aimLine'); l.setAttribute('x1', f * 100); l.setAttribute('x2', f * 100 + G.aimA * 1400);
}

// ---------- HUD ----------
let bigT = 0;
function big(t, cls = '', ms = 1500) { const el = $('#big'); el.textContent = t; el.className = cls; requestAnimationFrame(() => el.classList.add('show')); clearTimeout(bigT); bigT = setTimeout(() => el.classList.remove('show'), ms); }
function tip(t) { $('#tip').textContent = t; }
function renderSheet() {
  const n = G.players[0]?.sheet?.frames.length || 10;
  let h = '<table>';
  G.players.forEach((p, i) => {
    if (!p.sheet) return;
    const tt = Sc.totals(p.sheet);
    h += `<tr class="${i === G.cur ? 'cur' : ''}"><td class="nm" rowspan="2"><i style="background:${p.color}"></i>${esc(p.name)}</td>`;
    for (let f = 0; f < n; f++) h += `<td class="r">${Sc.marks(p.sheet, f).join(' ')}</td>`;
    h += `<td class="tot" rowspan="2">${Sc.total(p.sheet)}</td></tr><tr class="${i === G.cur ? 'cur' : ''}">`;
    for (let f = 0; f < n; f++) h += `<td class="t">${tt[f] ?? ''}</td>`;
    h += '</tr>';
  });
  $('#sheet').innerHTML = h + '</table>';
}

// ---------- risultato ----------
function finishThrow() {
  const p = G.players[G.cur], fi = Sc.currentFrame(p.sheet);
  const down = Pins.knocked(deck).filter(n => G.standing.includes(n));
  const n = G.ball && (G.ball.fell || G.ball.back) ? 0 : down.length;
  const wasFresh = G.standing.length === 10;
  G.throwFrame = fi;
  Sc.addRoll(p.sheet, n);
  G.standing = G.standing.filter(x => !down.includes(x));
  let text = '', cls = '', mood = 'meh';
  if (wasFresh && n === 10) { text = 'STRIKE!'; cls = 'y'; snd('strike'); mood = 'great'; }
  else if (!wasFresh && G.standing.length === 0) { text = 'SPARE!'; cls = 'p'; snd('spare'); mood = 'great'; }
  else if (G.ball && G.ball.fell) { text = 'Nel vuoto!'; snd('boo'); mood = 'bad'; }
  else if (G.ball && G.ball.back) { text = 'Torna indietro!'; snd('boo'); mood = 'bad'; }
  else if (n === 0) { text = G.ball && G.ball.gutter ? 'Canale…' : 'Zero'; snd('boo'); mood = 'bad'; }
  else if (wasFresh && headSplit(G.standing)) { text = `${n} · Split!`; cls = 'b'; }
  else { text = String(n); cls = 'b'; mood = n >= 8 ? 'good' : 'meh'; }
  big(text, cls, 1800);
  renderSheet(); drawMonitor(p.name, `${text} · ${Sc.total(p.sheet)} punti`, p.color);
  send(p, { t: 'res', text, score: Sc.total(p.sheet) });
  G.sweepDown = down; G.mood = mood;
  if (text === 'STRIKE!' && G.rec && G.rec.length > 20) { G.phase = 'replay'; G.repT = 0; }
  else { G.phase = 'react'; G.reactT = 0; react(); }
}
function react() {
  G.camSnap = true;
  const p = G.players[G.cur], av = p.av; if (!av) return;
  av.root.visible = true; setAvatarOpacity(p, 1); G.fadeAv = false;
  av.root.rotation.y = 0; // si gira verso di noi
  const m = G.mood;
  av.play(m === 'great' ? 'Cheer' : m === 'good' ? 'Taunt' : m === 'bad' ? (Math.random() < 0.5 ? 'Death_B' : 'Hit_A') : 'Interact', { once: true, then: 'Idle' });
  for (const q of G.players) if (q !== p && q.av && m === 'great') q.av.play('Cheer', { once: true, then: 'Sit_Chair_Idle' });
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
  if (fi !== G.throwFrame || Sc.finished(p.sheet)) {
    if (G.players.every(q => Sc.finished(q.sheet))) return endGame();
    let k = G.cur; do { k = (k + 1) % G.players.length; } while (Sc.finished(G.players[k].sheet));
    G.cur = k; nextThrow(true);
  } else {
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
  const w = rank[0]; if (w.av) { w.av.root.position.set(0, 0, 1.25); w.av.root.rotation.y = 0; w.av.play('Cheer', { once: false }); }
  for (const p of G.players) send(p, { t: 'end', text: `${rank[0].name} vince`, score: Sc.total(p.sheet) });
}

// ---------- ciclo ----------
const _q = new THREE.Quaternion(), _ax = new THREE.Vector3();
let last = performance.now(), acc = 0, slow = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000); last = now;
  // qualità automatica: se il computer fatica, si abbassa la risoluzione
  if (dt > 1 / 38) slow += dt; else slow = Math.max(0, slow - dt * 0.5);
  if (slow > 2 && PR > 0.75) { PR = Math.max(0.75, PR - 0.25); renderer.setPixelRatio(PR); resize(); slow = 0; }
  if (FAST) dt *= 3;
  G.time += dt;
  updateSpecial(G.time);
  const spec = G.spec ? SPECIALS[G.spec] : null;
  const p = G.players[G.cur], av = p && p.av;
  for (const q of G.players) if (q.av) q.av.update(dt);
  guide.visible = G.phase === 'aim' && !G.released && !G.spec;
  if (guide.visible && G.guideDirty) { G.guideDirty = false; updateGuide(); }
  if (G.fadeAv && av) setAvatarOpacity(p, Math.max(0.22, (av.opacity ?? 1) - dt * 4));
  if (G.phase === 'aim' && av) {
    // il computer: oscillazione del braccio e lancio
    if (G.botSwing) { const b = G.botSwing; b.t += dt; G.swing = b.t < 0.6 ? -Math.sin(b.t / 0.6 * Math.PI / 2) * 1.2 : -1.2; if (b.t > 0.75) { G.botSwing = null; throwBall({ power: (b.speed - 2.8) / 6.7, hook: b.hook, timing: 0.1 }, 'bot'); } }
    if (G.swingLive && G.time - G.swingLive > 1.5) G.swing *= 0.9;
    const tz = G.released ? 0.35 : 1.25;
    if (!G.released) av.root.position.x += (G.aimX + 0.12 - av.root.position.x) * Math.min(1, dt * 8);
    if (G.released) {
      // passo avanti e oscillazione in avanti; la palla parte quando il braccio è giù
      G.relT += dt; const k = Math.min(1, G.relT / 0.42);
      av.root.position.z = 1.25 + (tz - 1.25) * k;
      const th = G.swingFrom + (0.9 - G.swingFrom) * k;
      poseArm(av, th);
      if (th > -0.05 && !G.ball) { launch(); }
      if (G.relT > 0.42 && !G.followDone) { G.followDone = true; }
    } else {
      poseArm(av, G.swing);
      av.root.position.z += (1.25 - av.root.position.z) * Math.min(1, dt * 6);
    }
    if (!G.ball) { const h = handPos(av); ballMesh.position.set(h.x, h.y - 0.02, h.z); }
  }
  if (G.phase === 'roll') {
    if (av && G.relT < 1.2) { G.relT += dt; poseArm(av, 0.9, Math.max(0, 1 - (G.relT - 0.42) * 1.5)); }
    const b = G.ball, ev = []; acc += dt; let n = 0;
    while (acc > 1 / 480 && n < 400) { laneStep(b, 1 / 480, spec, G.time, ev); acc -= 1 / 480; n++; if (b.done || b.fell || b.stopped) break; }
    for (const e of ev) { if (e.t === 'wall') snd('wall', e.v / 4); if (e.t === 'land') snd('land', e.v / 3); if (e.t === 'gutter') snd('gutter'); }
    if (rollGain) rollGain.gain.value = b.air || b.fell ? 0 : Math.min(0.5, Math.hypot(b.vx, b.vz) / 18);
    G.rollT += dt;
    const w = Math.hypot(b.wx + b.sx, b.wz + b.sz); if (w > 0.01) { _ax.set((b.wx + b.sx) / w, 0, (b.wz + b.sz) / w); _q.setFromAxisAngle(_ax, w * dt); ballMesh.quaternion.premultiply(_q); }
    ballMesh.position.set(b.x, L.R + b.y + (b.gutter ? -0.07 : 0), b.z);
    if (b.done) { Pins.launchBall(deck, b); G.phase = 'deck'; G.rec = []; G.followDone = false; }
    else if (b.fell || b.stopped || (b.back && b.z > 1) || G.rollT > 12) { G.phase = 'deck'; G.noDeck = true; G.deckT = 0; }
  }
  if (G.phase === 'deck') {
    if (rollGain) rollGain.gain.value = Math.max(0, rollGain.gain.value - dt);
    if (!G.noDeck) {
      Pins.stepDeck(deck, dt);
      const bb = deck.ball; if (bb) { ballMesh.position.copy(bb.position); ballMesh.quaternion.copy(bb.quaternion); }
      if (G.rec && G.rec.length < 400) G.rec.push({ b: [ballMesh.position.clone(), ballMesh.quaternion.clone()], p: deck.pins.map(q => [q.position.x, q.position.y, q.position.z, q.quaternion.x, q.quaternion.y, q.quaternion.z, q.quaternion.w]) });
      if (Pins.settled(deck)) finishThrow();
    } else { G.deckT += dt; if (G.ball.fell) ballMesh.position.y -= dt * 2; if (G.deckT > 1.4) { G.noDeck = false; finishThrow(); } }
  }
  if (G.phase === 'replay') {
    G.repT += dt; const k = Math.min(G.rec.length - 1, Math.floor(G.repT * 60 * 0.4)), f = G.rec[k];
    ballMesh.position.copy(f.b[0]); ballMesh.quaternion.copy(f.b[1]);
    f.p.forEach((q, i) => { if (deck.pins[i].removed) return; pinMeshes[i].position.set(q[0], q[1], q[2]); pinMeshes[i].quaternion.set(q[3], q[4], q[5], q[6]); });
    if (k >= G.rec.length - 1 && G.repT > 1) { G.phase = 'react'; G.reactT = 0; react(); }
  }
  if (G.phase === 'react') { G.reactT += dt; if (G.reactT > (FAST ? 0.6 : 2.2)) { G.phase = 'sweep'; G.sweepT = 0; ballMesh.visible = false; G.camSnap = true; } }
  if (G.phase === 'sweep') {
    G.sweepT += dt; const t = G.sweepT; rake.visible = t > 0.2 && t < 1.6;
    rake.position.set(0, t < 0.5 ? 0.6 - (t - 0.2) * 1.6 : 0.12, t < 0.5 ? -17.7 : -17.7 - (t - 0.5) * 1.8);
    if (t > 0.5) for (const q of deck.pins) if (!q.removed && G.sweepDown.includes(q.spot.n)) { q.position.z = Math.min(q.position.z, rake.position.z - 0.06); if (q.position.z < -19.3) q.position.y = Math.max(-0.4, q.position.y - dt * 2); }
    if (t > 1.7) { rake.visible = false; ballMesh.visible = true; afterSweep(); }
  }
  if (G.phase !== 'replay') deck.pins.forEach((q, i) => { const m = pinMeshes[i]; m.visible = !q.removed; m.position.copy(q.position); m.quaternion.copy(q.quaternion); });
  updateCamera(dt);
  composer.render();
}
const _p = new THREE.Vector3(), _l = new THREE.Vector3();
function updateCamera(dt) {
  const p = G.players[G.cur], av = p && p.av;
  let k = 3;
  if (G.phase === 'lobby' || G.phase === 'loading') { const t = G.time * 0.08; _p.set(Math.sin(t) * 3, 2.6, 7.5); _l.set(0, 0.6, -10); }
  else if ((G.phase === 'aim' || G.phase === 'idle') && av) { const x = av.root.position.x; _p.set(x + 1.15, 2.35, av.root.position.z + 4.4); _l.set(G.aimX * 0.3 + Math.tan(G.aimA) * 14 - 0.15, 0.2, -12); k = 5; }
  else if (G.phase === 'roll') { const b = G.ball; const z = Math.max(-14.6, b.z + 3); _p.set(b.x * 0.6 - 0.7 * clamp((b.z + 7) / 7, 0, 1), 0.95 + clamp((b.z + 7) / 7, 0, 1) * 1.3 + Math.max(0, b.y) * 0.5, z); _l.set(b.x * 0.4, 0.2 + b.y * 0.5, b.z - 4); k = 7; }
  else if (G.phase === 'replay') { const a = 0.9 - G.repT * 0.25; _p.set(Math.sin(a) * 1.3, 0.3, -18.6 + Math.cos(a) * 1.3); _l.set(0, 0.18, -18.7); k = 6; }
  else if (G.phase === 'react' && av) { const r = av.root.position; _p.set(r.x - 0.5, 1.15, r.z + 3.4); _l.set(r.x, 0.85, r.z); k = 4; }
  else { _p.set(0.55, 0.8, -16.4); _l.set(0, 0.15, -18.7); }
  const f = G.camSnap ? 1 : 1 - Math.exp(-dt * k); G.camSnap = false; G.camPos.lerp(_p, f); G.camLook.lerp(_l, f);
  camera.position.copy(G.camPos); camera.lookAt(G.camLook);
}

// ---------- avvio ----------
buildHall(); Pins.resetPins(deck); setBallColor(COLORS[0]); renderLobby(); resize(); drawMonitor('Bowling', 'Pronti?');
requestAnimationFrame(frame);
Promise.all([loadAvatarLibrary(p => { $('#bar').style.width = (p * 90) + '%'; }), loadFurniture()]).then(() => {
  $('#load').classList.add('hide'); $('#lobby').classList.remove('hide'); G.phase = 'lobby';
  if (DEBUG) { window.__G = G; window.__deck = deck; window.__throw = throwBall; window.__start = startGame; }
  if (Q.has('auto')) {
    G.mode = Q.get('auto') === 'speciale' ? 'speciale' : 'classica'; G.nFrames = +(Q.get('frames') || 3);
    G.players.push({ kind: 'bot', name: 'Birillo', color: COLORS[0], look: randomLook() }, { kind: 'bot', name: 'Contessa', color: COLORS[1], look: { costume: 'banana', head: 'Mage', body: 'Mage', arms: 'Mage', legs: 'Mage', hat: 'none', cape: 'none', prop: 'none', hue: 2 } });
    startGame();
  }
}).catch(e => { $('#load').textContent = 'Errore nel caricamento: ' + e.message; });
