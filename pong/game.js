// Ping pong del Ridotto: due personaggi, palla con effetto vero, telefono come racchetta.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { T, mkBall, step, predict, solve, copy } from './ball.js';
import { makeArm } from './arm.js';
import { savedProfile } from '../avatar/avatar.js';
import { loadSportLibrary as loadAvatarLibrary, makeSportsmate, randomSport as randomLook } from '../avatar/sport.js';
const BOTS = [{ name: 'Topspin' }, { name: 'La Contessa' }, { name: 'Muro' }, { name: 'Nonna Pina' }, { name: 'Er Taglio' }];
import { hostRoom, randomCode } from '../net.js';

const Q = new URLSearchParams(location.search);
const DEBUG = Q.has('debug'), FAST = Q.has('fast'), NORENDER = Q.has('norender');
const MOBILE = matchMedia('(pointer:coarse)').matches;
const $ = s => document.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ canvas: $('#gl'), antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, MOBILE ? 1.3 : 1.5));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.92;
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
  // ombre morbide finte sotto gli oggetti (ambient occlusion dipinta): danno "peso" al tavolo e alle transenne
  const aoTex = ctex(128, 128, (g, w, h) => { const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  const aoMat = new THREE.MeshBasicMaterial({ map: aoTex, transparent: true, depthWrite: false, opacity: 0.8 });
  const ao = (x, z, w, d, o = 0.8) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), aoMat.clone()); m.material.opacity = o; m.rotation.x = -Math.PI / 2; m.position.set(x, 0.006, z); m.renderOrder = 1; scene.add(m); };
  ao(0, 0, T.W + 1.0, T.L + 1.2, 0.75);
  for (const [x, z, w, d] of [[0, -5.5, 6.6, 0.8], [0, 5.5, 6.6, 0.8], [-3, 0, 0.8, 11.6], [3, 0, 0.8, 11.6]]) ao(x, z, w, d, 0.5);
  for (const s2 of [-1, 1]) ao(s2 * 4.2, 0, 0.9, 2.6, 0.6);
  // tabellone col punteggio sulla parete di fondo (si aggiorna da solo)
  const sbC = document.createElement('canvas'); sbC.width = 512; sbC.height = 192; const sbT = new THREE.CanvasTexture(sbC); sbT.colorSpace = THREE.SRGBColorSpace;
  const sb = new THREE.Mesh(new THREE.PlaneGeometry(4, 1.5), new THREE.MeshBasicMaterial({ map: sbT, toneMapped: false })); sb.position.set(0, 5.2, -11.94); scene.add(sb);
  const sbFrame = new THREE.Mesh(new THREE.BoxGeometry(4.3, 1.8, 0.12), new THREE.MeshStandardMaterial({ color: 0x1d2340, roughness: 0.4 })); sbFrame.position.set(0, 5.2, -12.0); scene.add(sbFrame);
  G_board.draw = () => {
    const g = sbC.getContext('2d'); g.fillStyle = '#0d1228'; g.fillRect(0, 0, 512, 192);
    const P = G.players || []; g.font = '600 30px Fredoka, Arial'; g.textAlign = 'center'; g.fillStyle = '#9fb3ff';
    g.fillText((P[0] && P[0].name || '').slice(0, 12), 128, 40); g.fillText((P[1] && P[1].name || '').slice(0, 12), 384, 40);
    g.font = '700 110px Fredoka, Arial'; g.fillStyle = '#ff5a3d'; g.fillText(String(G.score ? G.score[0] : 0), 128, 150); g.fillStyle = '#38e8ff'; g.fillText(String(G.score ? G.score[1] : 0), 384, 150);
    g.fillStyle = '#ffcf3a'; g.font = '700 50px Fredoka, Arial'; g.fillText(':', 256, 135); sbT.needsUpdate = true;
  };
  // seggiolone dell'arbitro accanto alla rete
  { const m = new THREE.MeshStandardMaterial({ color: 0x3d7bff, roughness: 0.5 }), w = new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.4 });
    const g = new THREE.Group(); g.position.set(-3.7, 0, 0);
    for (const [x, z] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 1.1, 8), w); l.position.set(x, 0.55, z); g.add(l); }
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.6), m); seat.position.y = 1.12; g.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.06), m); back.position.set(0, 1.4, 0); back.rotation.y = Math.PI / 2; back.position.x = -0.28; g.add(back);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(g); ao(-3.7, 0, 1.2, 1.2, 0.6); }
  // fasci di luce dalle vetrate (additivi, molto leggeri)
  const shaftT = ctex(64, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,250,235,0.35)'); gr.addColorStop(1, 'rgba(255,250,235,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  for (let k = 0; k < 4; k++) { const sh = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 9), new THREE.MeshBasicMaterial({ map: shaftT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, opacity: 0.5 })); sh.position.set(-9 + k * 6, 4.5, -10.5); sh.rotation.set(-0.55, 0, 0.25); scene.add(sh); }
  // luci morbide
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd8c8b0, 0.55));
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
const G_board = { draw: () => { } };
const G = {
  phase: 'lobby', players: [], level: 1, target: 11, assist: true, strict: true, score: [0, 0], server: 0, serves: 0, time: 0,
  ball: null, charge: [0, 0], fire: false, lastHitter: -1, bounces: [], ideal: null, pendingHit: null, serving: false, toss: null,
  camPos: new THREE.Vector3(0, 3, 5), camLook: new THREE.Vector3(0, 0.8, 0), crowd: null, stillT: 0,
};
// side: giocatore 0 = vicino (z>0), 1 = lontano (z<0)
const sideZ = i => i === 0 ? 1 : -1;
buildHall();
// riflessi presi dal palazzetto stesso (pavimento e tavolo lucidi)
{ const pm = new THREE.PMREMGenerator(renderer); const rt = pm.fromScene(scene, 0.03, 0.1, 40); scene.environment = rt.texture; pm.dispose(); G_board.draw(); }

// personaggi del camerino; il giocatore vicino, se umano, gioca in prima persona
const avatars = [];
const FP_BASE = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.35, 0.5, -0.45)), _pq = new THREE.Quaternion(), _pq2 = new THREE.Quaternion(), _pe = new THREE.Euler(), _pv = new THREE.Vector3();
const fpRacket = makeRacket(0xe8243c); fpRacket.visible = false; camera.add(fpRacket); scene.add(camera);
function setupAvatars() {
  for (const a of avatars) a.av.dispose();
  avatars.length = 0;
  G.players.forEach((p, i) => {
    const av = makeSportsmate(p.sport || randomLook(), { height: 1.78 });
    av.root.traverse(o => { if (o.isMesh) o.castShadow = true; });
    av.root.rotation.y = i === 0 ? Math.PI : 0;
    av.root.position.set(0.3 * (i ? -1 : 1), 0, sideZ(i) * (T.L / 2 + 0.65));
    scene.add(av.root);
    const racket = makeRacket(i === 0 ? 0xe8243c : 0x2a5fd6); const hand = av.bones.hand_r;
    hand.add(racket); racket.scale.setScalar(1.3); racket.rotation.set(0, 0, 0); racket.position.set(0, 0.06, 0.02);
    av.play('Idle_B');
    avatars.push({ av, racket, x: av.root.position.x, vx: 0, swingT: -1, swingDir: 1, anim: 'Idle_B' });
    avatars[avatars.length - 1].arm = makeArm(av, racket);
  });
  const fp = G.view !== 'tv' && G.players[0] && G.players[0].kind !== 'cpu';
  if (avatars[0]) avatars[0].av.root.visible = !fp;
  fpRacket.visible = fp;
}
// Percorso della racchetta nel sistema del corpo (x = sinistra, y = su, z = avanti): preparazione, impatto, accompagnamento.
const STROKE = {
  1: { back: [-0.62, 0.9, 0.0], follow: [0.28, 1.38, 0.3], upB: [-0.6, 0.55, -0.4], upC: [-0.92, 0.12, 0.38], upF: [0.35, 0.85, 0.3], faceB: [-0.7, 0.05, 0.7], faceC: [0, -0.12, 1], faceF: [0.7, 0, 0.6], pole: [-0.6, -0.8, -0.3], twB: -0.45, twF: 0.4 },
  [-1]: { back: [0.3, 0.88, 0.12], follow: [-0.5, 1.25, 0.42], upB: [0.6, 0.65, 0.3], upC: [0.92, 0.12, 0.38], upF: [-0.3, 0.9, 0.3], faceB: [0.6, 0, 0.75], faceC: [0, -0.12, 1], faceF: [-0.6, 0, 0.75], pole: [-0.2, -0.85, 0.3], twB: 0.4, twF: -0.35 },
};
const READY = { head: [-0.18, 1.0, 0.42], up: [-0.35, 0.85, 0.25], face: [0.05, 0, 1], pole: [-0.6, -0.8, -0.1] };
const _V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
function toWorld(a, i, v, dirOnly) { const k = i === 0 ? -1 : 1; const w = new THREE.Vector3(v.x * k, v.y, v.z * k); return dirOnly ? w : w.add(a.av.root.position); }
const ease = t => t * t * (3 - 2 * t);
function strokeArm(a, i, uo) {
  if (!a.arm) return;
  const u = uo != null ? uo : a.hitT != null ? G.time - a.hitT : 9, S = STROKE[a.swingDir || 1];
  const C = CONTACT[(a.swingDir || 1) > 0 ? 'A' : 'B'];
  const contactL = new THREE.Vector3(...C.off);
  const contactW = a.hitPt ? new THREE.Vector3(...a.hitPt) : toWorld(a, i, contactL);
  let head, up, face, pole = _V(S.pole), tw = 0;
  const RH = toWorld(a, i, _V(READY.head)), RU = _V(READY.up), RF = _V(READY.face);
  if (u < -0.34 || u > 0.75) { head = RH; up = RU; face = RF; pole = _V(READY.pole); }
  else if (u < -0.14) { const k = ease((u + 0.34) / 0.2); head = RH.clone().lerp(toWorld(a, i, _V(S.back)), k); up = RU.clone().lerp(_V(S.upB), k); face = RF.clone().lerp(_V(S.faceB), k); tw = S.twB * k; }
  else if (u < 0) { const k = (u + 0.14) / 0.14, kk = k * k; const B = toWorld(a, i, _V(S.back)); head = B.clone().lerp(contactW, kk); head.y += Math.sin(k * Math.PI) * -0.05; up = _V(S.upB).lerp(_V(S.upC), kk); face = _V(S.faceB).lerp(_V(S.faceC), kk); tw = S.twB * (1 - kk); }
  else if (u < 0.22) { const k = Math.sqrt(u / 0.22); head = contactW.clone().lerp(toWorld(a, i, _V(S.follow)), k); up = _V(S.upC).lerp(_V(S.upF), k); face = _V(S.faceC).lerp(_V(S.faceF), k); tw = S.twF * k; }
  else { const k = ease((u - 0.22) / 0.53); head = toWorld(a, i, _V(S.follow)).lerp(RH, k); up = _V(S.upF).lerp(RU, k); face = _V(S.faceF).lerp(RF, k); tw = S.twF * (1 - k); }
  a.arm.apply({ head, racketUp: toWorld(a, i, up, true), face: toWorld(a, i, face, true), pole: toWorld(a, i, pole, true), twist: tw, k: 1, leftAxis: toWorld(a, i, new THREE.Vector3(1, 0, 0), true) });
}
function animateAvatars(dt) {
  avatars.forEach((a, i) => {
    const s = sideZ(i);
    // si sposta verso il punto dove colpirà (con dolcezza: niente tremolii)
    let tx = 0.25 * (i === 0 ? 1 : -1), tz = T.L / 2 + 0.65;
    const id = G.ideal && G.ideal.who === i && G.ideal.rx != null ? G.ideal : (G.pendingHit && G.pendingHit.who === i && G.pendingHit.id && G.pendingHit.id.rx != null ? G.pendingHit.id : null);
    if (id) { tx = id.rx; tz = Math.max(T.L / 2 + 0.25, Math.abs(id.rz)); }
    else if (G.serving && G.server === i) { tx = 0.35 * (i === 0 ? 1 : -1); tz = T.L / 2 + 0.3 + contactOf(i, 1, false, true).off[2]; }
    tx = clamp(tx, -1.6, 1.6);
    const want = Math.abs(tx - a.x) < 0.02 ? 0 : clamp((tx - a.x) * 7, -4, 4);
    a.vx += (want - a.vx) * Math.min(1, dt * 10); a.x += a.vx * dt;
    a.z = a.z ?? T.L / 2 + 0.65; const wz = Math.abs(tz - a.z) < 0.02 ? 0 : clamp((tz - a.z) * 7, -5, 5); a.vz = (a.vz || 0) + (wz - (a.vz || 0)) * Math.min(1, dt * 10); a.z += a.vz * dt;
    // ultimo quarto di secondo: aggiustamento fine, così la racchetta prende la palla esattamente
    if (id && id.t - G.time < 0.35 && id.t - G.time > -0.05) { const k = Math.min(1, dt * 16); a.x += (tx - a.x) * k; a.z += (tz - a.z) * k; }
    a.av.root.position.set(a.x, 0, s * a.z);
    // animazioni: gambe e busto dall'animazione, braccio della racchetta guidato (vedi arm.js)
    let anim = 'Sword_Idle';
    if (a.pend) { a.pend.wait -= dt; if (a.pend.wait <= 0) { const pd = a.pend; a.pend = null; a.swingT = 0; a.swingDir = pd.side; a.up = pd.up; snd('swish', pd.p); a.hitT = pd.hitT; a.hitPt = pd.pt; } }
    if (a.swingT >= 0) { a.swingT += dt; if (a.swingT > 0.9) a.swingT = -1; }
    if (Math.abs(a.vx) > 1.2 || Math.abs(a.vz || 0) > 1.2) anim = 'Jog_Fwd_Loop';
    if (anim !== a.anim) { a.anim = anim; a.av.play(anim, { fade: 0.2 }); }
    a.av.update(dt);
    strokeArm(a, i);
    if (DEBUG && G.hitInfo && G.hitInfo.who === i && !G.hitInfo.done && a.hitT != null && Math.abs(G.time - G.hitInfo.t) < 0.05) {
      const H = G.hitInfo; H.done = true; a.av.mixer.update(0); strokeArm(a, i, H.t - a.hitT); const rp = a.racket.localToWorld(new THREE.Vector3(0, 0.08, 0)); a.av.mixer.update(0); strokeArm(a, i);
      (G.log = G.log || []).push(`${G.time.toFixed(2)} CONTACT ${i} dt=${(G.time - H.t).toFixed(3)} dist=${rp.distanceTo(new THREE.Vector3(...H.p)).toFixed(2)} racket=${[rp.x, rp.y, rp.z].map(v => v.toFixed(2))} ball=${H.p.map(v => v.toFixed(2))}`);
    }
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
      p = { kind: 'phone', pid: m.pid, name: (m.name || 'Telefono').slice(0, 14), color: m.color, look: m.look, sport: m.sport || randomLook() };
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
  if (m.t === 'sw0') { const i = G.players.indexOf(p); swing(i, { time: G.time - (p.lat || 0.05) - (m.ago || 0) / 1000, dir: +m.dir || 0 }); return; }
  if (m.t === 'sw1') { const i = G.players.indexOf(p); swing(i, { detail: true, p: clamp(+m.p || 0.5, 0.05, 1.4), vert: clamp(+m.vert || 0, -1, 1), twist: clamp(+m.twist || 0, -1, 1), dir: +m.dir || 0 }); return; }
  if (m.t === 'sw') { const i = G.players.indexOf(p); swing(i, { detail: true, p: clamp(+m.p || 0.5, 0.05, 1.4), vert: clamp(+m.vert || 0, -1, 1), twist: clamp(+m.twist || 0, -1, 1), dir: +m.dir || 0 }); }

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
$('#addLocal').onclick = () => { ac(); if (G.players.filter(p => p.kind === 'local').length >= 1 || G.players.filter(p => p.kind !== 'cpu').length >= 2) return; const n = $('#localName').value.trim() || 'Giocatore'; G.players = G.players.filter(x => x.kind !== 'cpu'); const pr = savedProfile(); G.players.unshift({ kind: 'local', name: n.slice(0, 14), sport: pr && pr.sport ? pr.sport : randomLook() }); renderLobby(); };
$('#start').onclick = () => { if (!$('#start').dataset.ready) return; ac(); startMatch(); };
$('#again').onclick = () => { $('#end').classList.add('hide'); startMatch(); };
$('#toLobby').onclick = () => { $('#end').classList.add('hide'); $('#hud').classList.add('hide'); $('#lobby').classList.remove('hide'); G.phase = 'lobby'; G.players = G.players.filter(p => p.kind !== 'cpu'); renderLobby(); sendState(); };
$('#menuBtn').onclick = () => { if (window.confirm('Tornare alla sala?')) $('#toLobby').onclick(); };

// ---------- partita ----------
function startMatch() {
  G.players = G.players.filter(p => p.kind !== 'cpu');
  if (G.players.length === 1) { const b = BOTS[Math.floor(Math.random() * BOTS.length)]; G.players.push({ kind: 'cpu', name: b.name, sport: randomLook() }); }
  G.score = [0, 0]; G.server = Math.random() < 0.5 ? 0 : 1; G.serves = 0; G.charge = [0, 0]; G.fire = false; updateCharge();
  $('#lobby').classList.add('hide'); $('#hud').classList.remove('hide');
  $('#nA').textContent = G.players[0].name; $('#nB').textContent = G.players[1].name; $('#setInfo').textContent = 'a ' + G.target;
  G.view = G.players.filter(p => p.kind !== 'cpu').length === 2 ? 'tv' : 'behind';
  setupAvatars(); updateScore();
  big(`${G.players[G.server].name} batte`, 1300);
  later(beginServe, 1400);
}
function updateScore() { G_board.draw(); $('#ptA').textContent = G.score[0]; $('#ptB').textContent = G.score[1]; $('#srvA').classList.toggle('on', G.server === 0); $('#srvB').classList.toggle('on', G.server === 1); }
function beginServe() {
  G._mark = (G._mark || '') + 'S';
  G.phase = 'serve'; G.serving = true; G.lastHitter = -1; G.bounces = []; G.ideal = null; G.pendingHit = null; G.stillT = 0;
  const i = G.server, s = sideZ(i), a = avatars[i];
  G.ball = mkBall(a.x - 0.12 * s, 0.95, s * (T.L / 2 + 0.25)); G.toss = null; G.ball.held = true;
  trailPts.length = 0;
  const p = G.players[i];
  tip(p.kind === 'cpu' ? `${p.name} batte` : p.kind === 'phone' ? `${p.name}: tocca la racchetta gialla sul telefono per lanciare, poi colpisci quando la palla scende` : 'Battuta: muovi il mouse veloce quando la palla scende (o premi spazio)');
  sendState();
  // il computer lancia subito; chi gioca lancia la palla col tasto (o dopo qualche secondo)
  const sv = G.serveId = (G.serveId || 0) + 1;
  later(() => { if (G.phase === 'serve' && G.serveId === sv && !G.toss) toss(); }, p.kind === 'cpu' ? 700 : 7000);
}
function toss() {
  G._mark = (G._mark || '') + 'T';
  const b = G.ball; b.held = false; b.vy = 2.3; b.vx = b.vz = 0; G.toss = { t0: G.time };
  // momento ideale: quando ricade all'altezza della racchetta nel colpo di dritto (il personaggio sta fermo)
  const cy = contactOf(G.server, 1, false, true).off[1], drop = b.y - cy;
  G.ideal = { who: G.server, t: G.time + (2.3 + Math.sqrt(2.3 * 2.3 + 2 * 9.81 * drop)) / 9.81, x: b.x, y: cy, z: b.z, serve: true, side: 1 };
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
  // anche il computer sbaglia: più spesso contro i colpi forti e ai livelli facili
  const errP = id.serve ? 0 : [0.11, 0.065, 0.035][G.level] + Math.max(0, (G.incomingSpeed || 0) - 10) * 0.025 + (G.fire ? 0.15 : 0);
  const miss = Math.random() < errP ? (Math.random() < 0.5 ? 'long' : Math.random() < 0.6 ? 'wide' : 'net') : null;
  G.cpuSwing = { who: i, at: id.t + HIT_BEST + dt, sw: { p, vert, twist: rnd(-0.2, 0.2), aim, miss } };
}
// Colpo "alla Wii": conta l'INIZIO del gesto. Se parti in una finestra larga prima del momento giusto,
// la racchetta prende la palla nel punto giusto (il ritardo del Wi-Fi non conta più). Forza, alto/basso
// ed effetto arrivano dal gesto completo, se arriva in tempo.
const HIT_EARLY = 0.45, HIT_LATE = 0.12, HIT_BEST = -0.16;
// Dove si trova la testa della racchetta, rispetto ai piedi, nel momento del colpo (misurato sulle animazioni a velocità 1.3).
// x = sinistra del personaggio, z = davanti. Così il personaggio si piazza in modo che racchetta e palla si incontrino davvero.
const SWING_SPEED = 1.0;
const CONTACT = { A: { t: 0.14, off: [-0.5, 0.92, 0.38] }, B: { t: 0.14, off: [0.1, 0.9, 0.4] }, O: { t: 0.14, off: [-0.42, 1.1, 0.45] }, S: { t: 0.14, off: [-0.38, 1.12, 0.42] } };
// Per ogni personaggio si misura davvero, sulla sua animazione, dove sta la testa della racchetta (calibrazione all'inizio).
function calibrate(a) {
  const av = a.av, p0 = av.root.position.clone(), r0 = av.root.rotation.y; av.root.position.set(0, 0, 0); av.root.rotation.y = 0;
  const out = {}, v = new THREE.Vector3();
  for (const [key, clip, yLo, yHi] of [['A', 'Sword_Regular_A', 0.8, 1.15], ['B', 'Sword_Regular_B', 0.62, 1.1], ['S', 'Sword_Regular_A', 0.98, 1.3]]) {
    let best = null; const samples = [];
    for (let ct = 0.1; ct < 0.46; ct += 0.01) {
      const act = av.play(clip, { once: true, solo: true, speed: 1 }); if (!act) break; act.timeScale = 0; act.time = ct; av.mixer.update(0); av.root.updateMatrixWorld(true);
      a.racket.localToWorld(v.set(0, 0.08, 0));
      if (v.z > 0.45 && v.y > 0.6 && v.y < 1.4) samples.push({ clip, t: ct / SWING_SPEED, off: [v.x, v.y, v.z] });
      if (v.y < yLo || v.y > yHi) continue;
      const score = v.z - Math.abs(v.x + (key === 'B' ? -0.1 : 0.15)) * 0.3; // davanti, poco di lato
      if (!best || score > best.score) best = { score, t: ct, off: [v.x, v.y, v.z] };
    }
    out[key] = best ? { clip, t: best.t / SWING_SPEED, off: best.off } : CONTACT[key === 'S' ? 'A' : key];
    out[key + 's'] = samples;
  }
  av.root.position.copy(p0); av.root.rotation.y = r0; av.play('Sword_Idle', { solo: true });
  a.contact = out;
  if (DEBUG) (G.log = G.log || []).push(`calib ${JSON.stringify(out)}`);
}
function contactOf(i, side, smash, serve) { return CONTACT[serve ? 'S' : smash ? 'O' : side > 0 ? 'A' : 'B']; }
// il punto del gesto (tra quelli misurati) in cui la racchetta è all'altezza della palla
function contactAt(i, side, y) {
  const a = avatars[i], list = a && a.contact && a.contact[(side > 0 ? 'A' : 'B') + 's'];
  if (!list || !list.length) return contactOf(i, side, false);
  const zMax = Math.max(...list.map(c => c.off[2]));
  let best = null, bs = 1e9; for (const c of list) { const sc = Math.abs(c.off[1] - y) * 3 + (zMax - c.off[2]); if (sc < bs) { bs = sc; best = c; } }
  return best;
}
function placeFor(id, i, side, smash) {
  const c = contactOf(i, side, smash), k = i === 0 ? -1 : 1; // giocatore 0 è girato di 180°
  id.rx = id.x - c.off[0] * k; id.rz = id.z - c.off[2] * k; id.contact = c;
}
function swing(i, sw) {
  const a = avatars[i]; if (!a) return;
  const t = sw.time ?? G.time;
  const ph = G.pendingHit;
  // dettagli di un gesto già iniziato (arrivano 50 ms dopo l'inizio): forza, verso, su/giù; il colpo non si rifà
  if (sw.detail) {
    if (ph && ph.who === i && !ph.done) {
      Object.assign(ph.sw, { p: sw.p ?? ph.sw.p, vert: sw.vert ?? ph.sw.vert, twist: sw.twist ?? ph.sw.twist, yaw: sw.yaw ?? ph.sw.yaw });
      if (sw.dir && !ph.dir) { ph.dir = sw.dir; if (G.strict && ph.dir !== ph.side) ph.wrong = true; }
    }
    return;
  }
  if (G.phase !== 'serve' && G.phase !== 'rally') { startSwingAnim(i, sw); return; }
  if (G.serving && G.server === i && !G.toss) { toss(); return; } // senza tasto, il primo gesto lancia la palla
  const id = G.ideal; if (!id || id.who !== i) { startSwingAnim(i, sw); return; }
  const d = t - id.t;
  if (d < -1.0) return;                       // ancora in preparazione: non conta
  if (id.tried && !id.serve) return;          // un solo tentativo per palla
  id.tried = true;
  if (d < -HIT_EARLY || d > HIT_LATE) { startSwingAnim(i, sw); if (G.players[i].kind !== 'cpu') shotTip(d < 0 ? 'Troppo presto!' : 'Troppo tardi!'); return; }
  const W = HIT_EARLY, side = sideOf(i, id);
  G.pendingHit = { who: i, at: Math.max(G.time, id.t), d: d - HIT_BEST, W, sw: { p: 0.65, vert: 0.2, twist: 0, yaw: 0, ...sw }, t0: t, side, dir: sw.dir || 0, id };
  // dritto quando serviva il rovescio (o viceversa): colpo a vuoto
  if (G.strict && sw.dir && sw.dir !== side && !id.serve) G.pendingHit.wrong = true;
  // l'animazione parte in modo da arrivare sulla palla proprio al momento giusto
  startSwingAnim(i, sw, Math.max(0, id.t - G.time), side);
}
// dritto o rovescio: dipende da che lato del corpo arriva la palla (destrorso)
function sideOf(i, id) { if (id && id.side) return id.side; const a = avatars[i]; if (!a || !id) return 1; const rel = (id.x - a.x) * (i === 0 ? 1 : -1); return rel >= -0.05 ? 1 : -1; }
function startSwingAnim(i, sw, lead = 0, side) {
  const a = avatars[i]; if (!a) return;
  if ((a.swingT >= 0 && a.swingT < 0.25) || a.pend) return;
  const smash = false; // la schiacciata ha un'altra posa: per ora tutti i colpi usano dritto/rovescio
  const serve = !!(G.ideal && G.ideal.serve && G.ideal.who === i), c = (G.ideal && G.ideal.who === i && G.ideal.contact && (side ?? 1) === G.ideal.side) ? G.ideal.contact : contactOf(i, side ?? 1, smash, serve);
  const id0 = G.ideal && G.ideal.who === i ? G.ideal : null;
  a.pend = { pt: id0 && id0.z != null && lead > 0 ? [id0.x, id0.y, id0.z] : null, hitT: G.time + (lead > 0 ? lead : 0.14), wait: Math.max(0, lead - 0.34), side: side ?? (G.ideal ? sideOf(i, G.ideal) : 1), up: sw.vert || 0, p: sw.p || 0.6, smash, serve, c };
}

// colpo: dalla posizione attuale della palla verso il campo avversario
function doHit(h) {
  if (h.wrong) { // gesto sbagliato: la racchetta passa ma non prende la palla
    G.pendingHit = null; if (G.players[h.who].kind !== 'cpu') shotTip(h.side > 0 ? 'Era un DRITTO! Racchetta da destra a sinistra' : 'Era un ROVESCIO! Racchetta da sinistra a destra'); return;
  }
  G._mark = (G._mark || '') + 'H';
  G.hitInfo = { who: h.who, t: h.at, p: [G.ball.x, G.ball.y, G.ball.z] };
  if (DEBUG) { const rp = avatars[h.who] ? avatars[h.who].racket.localToWorld(new THREE.Vector3(0, 0.08, 0)) : null; (G.log = G.log || []).push(`${G.time.toFixed(2)} HIT by ${h.who} d=${h.d.toFixed(3)} y=${G.ball.y.toFixed(2)} z=${G.ball.z.toFixed(2)} side=${h.side} rd=${rp ? rp.distanceTo(new THREE.Vector3(G.ball.x, G.ball.y, G.ball.z)).toFixed(2) : '-'} av=${avatars[h.who].x.toFixed(2)},${avatars[h.who].z.toFixed(2)} tgt=${h.id && h.id.rx != null ? h.id.rx.toFixed(2) + ',' + h.id.rz.toFixed(2) : '-'} sw=${avatars[h.who].swingT.toFixed(3)} ball=${G.ball.x.toFixed(2)}`); }
  const i = h.who, s = sideZ(i), b = G.ball, sw = h.sw, q = 1 - Math.abs(h.d) / h.W;
  const left = i === 0 ? -1 : 1; // la sinistra di chi colpisce, in coordinate x
  let type = 'drive', p = sw.p, vert = sw.vert;
  if (G.serving) type = 'serve';
  else if (p >= 0.95 && vert < -0.15) type = 'smash';
  else if (vert > 0.75 && p < 0.35) type = 'lob';
  else if (vert < -0.3 && p < 0.75) type = 'chop';
  else if (p < 0.15) type = 'drop';
  const noise = 0.03 + (1 - q) * 0.3 + Math.max(0, p - 1.05) * 0.12 + (b.y < 0.85 && type === 'smash' ? 0.2 : 0);
  const u = clamp(h.d / (h.d < 0 ? 0.49 : 0.28), -1, 1), side = h.side || 1;
  let tx = sw.aim != null ? sw.aim : -u * 0.62 * left * side + b.x * 0.12 + (sw.yaw && Math.abs(sw.yaw) < 1 ? sw.yaw * 0.15 : 0);
  tx = clamp(tx + gauss() * noise, -0.78, 0.78);
  let depth, flight, spin = { wx: 0, wy: (sw.twist || 0) * 60, wz: 0 }, label;
  if (type === 'serve') {
    // battuta: rimbalzo sul proprio campo e poi di là
    return doServe(i, p, tx, q, sw);
  } else if (type === 'smash') { depth = 0.95; flight = -1 * (14 + 5 * Math.min(p, 1.3)); spin.wx = -s * 70; label = 'Schiacciata!'; }
  else if (type === 'lob') { depth = 1.05; flight = 1.1 + (0.5 - p) * 0.4; spin.wx = -s * 30; label = 'Pallonetto'; }
  else if (type === 'chop') { depth = 0.8; flight = -1 * (4.5 + 3 * p); spin.wx = s * 110; label = 'Taglio'; }
  else if (type === 'drop') { depth = 0.35; flight = 0.8; spin.wx = s * 50; label = 'Smorzata'; }
  else { depth = 0.5 + 0.72 * Math.min(1, p) + Math.max(0, p - 1.05) * 1.6; flight = -1 * (5.5 + 9 * Math.min(p, 1.3)); spin.wx = -s * (40 + 110 * Math.max(0, vert)); label = vert > 0.5 ? 'Colpo carico' : 'Dritto'; }
  depth = Math.min(1.2, depth + gauss() * noise);
  if (sw.miss === 'long') depth = 1.45 + Math.random() * 0.3;
  if (sw.miss === 'wide') tx = (Math.random() < 0.5 ? -1 : 1) * (0.86 + Math.random() * 0.2);
  if (sw.miss === 'net') { flight = Math.abs(flight) > 0 && flight < 1 ? flight : 0.4; }
  const tz = -s * depth;
  // flight < 0 = velocità media: il tempo di volo dipende dalla distanza
  if (flight < 0) flight = Math.hypot(tx - b.x, tz - b.z) / -flight;
  // barra carica: i colpi a tempo la riempiono; piena + schiacciata (o colpo perfetto) = colpo di fuoco
  G.charge[i] = Math.min(1, G.charge[i] + (q > 0.8 ? 0.25 : 0.1));
  let fire = false;
  if (G.charge[i] >= 1 && (type === 'smash' || q > 0.85) && type !== 'lob' && type !== 'drop') { fire = true; G.charge[i] = 0; flight /= 1.35; spin.wx *= 1.4; label = '🔥 COLPO DI FUOCO'; big('🔥 Fuoco!', 900); snd('cheer'); }
  G.fire = fire; updateCharge();
  let v = solve({ x: b.x, y: b.y, z: b.z }, tx, tz, flight, spin);
  if (sw.miss === 'net') { const tn = Math.abs(b.z) / Math.max(4, Math.abs(v.vz)); v = { vx: v.vx, vy: (T.H + 0.08 - b.y + 0.5 * 9.81 * tn * tn) / tn, vz: -s * Math.max(4, Math.abs(v.vz)) }; }
  else if (type !== 'drop' && !sw.miss) for (let k = 0; k < 4; k++) {
    const pr = predict(mkBall(b.x, b.y, b.z, v.vx, v.vy, v.vz, spin.wx, spin.wy, spin.wz), 3), tb = pr.ev.filter(e => e.t === 'table');
    if (!tb.length || tb[0].side !== -s) break;
    const t1 = tb[0].time, t2 = tb[1] ? tb[1].time : 9;
    if (pr.pts.some(q => q.t > t1 && q.t < t2 && -s * q.z > T.L / 2 + 0.1 && q.y > 0.8)) break;
    depth = Math.min(1.25, depth + 0.12); const tz2 = -s * depth; const fl2 = flight * 0.95; v = solve({ x: b.x, y: b.y, z: b.z }, tx, tz2, fl2, spin);
  }
  // se finirebbe in rete senza volerlo (palla bassa vicino al tavolo), si alza la traiettoria
  for (let k = 0; k < 3 && q > 0.35 && !sw.miss; k++) {
    const pr = predict(mkBall(b.x, b.y, b.z, v.vx, v.vy, v.vz, spin.wx, spin.wy, spin.wz), 2), e0 = pr.ev[0];
    if (!e0 || (e0.t !== 'net' && e0.t !== 'cord')) break;
    flight *= 1.25; spin.wx *= 0.6; v = solve({ x: b.x, y: b.y, z: b.z }, tx, -s * Math.min(1.2, depth), flight, spin);
  }
  Object.assign(b, { vx: v.vx, vy: v.vy, vz: v.vz, wx: spin.wx, wy: spin.wy, wz: spin.wz });
  G.netHit = false; G.lastHitter = i; G.bounces = []; G.ideal = null; G.pendingHit = null; G.incomingSpeed = Math.hypot(v.vx, v.vy, v.vz);
  snd('hit', p);
  if (G.players[i].kind !== 'cpu') shotTip(`${label} · ${(G.incomingSpeed * 3.6).toFixed(0)} km/h` + (q > 0.8 ? ' · tempo perfetto' : ''));
  planReceive();
}
function doServe(i, p, tx, q, sw = {}) {
  const s = sideZ(i), b = G.ball;
  // forza = quanto è profonda e veloce; anticipo/ritardo = angolo; rotazione del polso = effetto laterale
  const fast = clamp((p - 0.2) / 0.9, 0, 1);
  const want2 = { x: clamp(tx * 1.15, -0.65, 0.65), z: -s * (0.7 + 0.55 * fast) };
  const side = clamp(sw.twist || 0, -1, 1), back = (sw.vert || 0) < -0.3;
  const spin = { wx: back ? s * 70 : -s * (30 + 50 * fast), wy: side * 70, wz: 0 };
  let best = null;
  for (const z1 of [0.4, 0.6, 0.8, 0.95, 1.1, 1.22]) for (const fl of [0.15, 0.19, 0.23, 0.28, 0.33, 0.4, 0.48]) for (const f of [0.25, 0.45, 0.6]) {
    const x1 = b.x + (want2.x - b.x) * f;
    const v = solve({ x: b.x, y: b.y, z: b.z }, x1, s * z1, fl, spin);
    const pr = predict(mkBall(b.x, b.y, b.z, v.vx, v.vy, v.vz, spin.wx, spin.wy, spin.wz), 2.5), tb = pr.ev.filter(e => e.t === 'table');
    if (!(tb.length >= 2 && tb[0].side === s && tb[1].side === -s && !pr.ev.some(e => e.t === 'net' || e.t === 'cord'))) continue;
    const sp = Math.hypot(v.vx, v.vy, v.vz), c = Math.abs(tb[1].x - want2.x) + Math.abs(tb[1].z - want2.z) + Math.abs(sp - (6 + 9 * fast)) * 0.12;
    if (!best || c < best.c) best = { c, v };
  }
  const v = best ? best.v : solve({ x: b.x, y: b.y, z: b.z }, 0, s * 0.7, 0.32, spin);
  const err = (1 - q) * 0.25 + Math.max(0, p - 1.1) * 0.3;
  v.vx += gauss() * err * 0.5; if (err > 0.18) v.vz *= 1 + gauss() * 0.06;
  Object.assign(b, { vx: v.vx, vy: v.vy, vz: v.vz, ...spin });
  if (DEBUG) (G.log = G.log || []).push(`${G.time.toFixed(2)} SERVE v=${[v.vx, v.vy, v.vz].map(x => x.toFixed(2))} best=${!!best} p=${p.toFixed(2)} tx=${tx} b=${[b.x, b.y, b.z].map(x => x.toFixed(2))}`);
  G.netHit = false; G.lastHitter = i; G.bounces = []; G.ideal = null; G.pendingHit = null; G.toss = null; G.phase = 'rally';
  snd('hit', 0.6); planReceive();
  if (G.players[i].kind !== 'cpu') shotTip(`Battuta ${fast > 0.66 ? 'forte' : fast > 0.33 ? 'media' : 'corta'}${Math.abs(want2.x) > 0.35 ? ' angolata' : ''}${Math.abs(side) > 0.4 ? ' con effetto' : ''} · ${(Math.hypot(v.vx, v.vy, v.vz) * 3.6).toFixed(0)} km/h`);
}
// prevede dove e quando l'avversario potrà colpire
function planReceive() {
  const r = 1 - G.lastHitter, s = sideZ(r);
  const pr = predict(G.ball, 3);
  const tb = pr.ev.filter(e => e.t === 'table');
  const needed = G.serving ? 2 : 1;
  const bounce = tb[needed - 1];
  if (!bounce || bounce.side !== s || (G.serving && tb[0].side !== -s)) { G.ideal = null; if (DEBUG) (G.log = G.log || []).push(`${G.time.toFixed(2)} noplan ` + tb.map(e => e.side).join(',') + ' ' + pr.ev.map(e=>e.t).join(',')); return; }
  const second = tb[needed] ? tb[needed].time : 9;
  const after = pr.pts.filter(q => q.t > bounce.time + 0.03 && q.t < second - 0.02);
  // come un giocatore vero: si colpisce dietro la fine del tavolo, all'altezza comoda (vicino al punto più alto)
  const a0 = avatars[r], dir0 = r === 0 ? 1 : -1;
  let hit = null, best = 1e9;
  for (const q of after) {
    const dz = s * q.z - T.L / 2; if (dz < 0.05 || dz > 1.1 || q.y < 0.7 || q.y > 1.55) continue;
    const sd = a0 ? ((q.x - a0.x) * dir0 >= -0.12 ? 1 : -1) : 1, wantY = contactOf(r, sd, false).off[1];
    const c = Math.abs(dz - 0.35) * 0.5 + Math.abs(q.y - wantY) * 3; if (c < best) { best = c; hit = q; }
  }
  // palla corta: ci si allunga sopra il bordo del tavolo
  if (!hit) for (const q of after) { if (s * q.z > T.L / 2 - 0.45 && q.y > T.H + 0.1 && (!hit || q.y > hit.y)) hit = q; }
  if (!hit) { G.ideal = null; if (DEBUG) (G.log = G.log || []).push(`${G.time.toFixed(2)} unreachable`); return; }
  const a = avatars[r], dir = r === 0 ? 1 : -1;
  // dritto o rovescio si decide subito, da dove arriva la palla rispetto a dove sei: poi ti sposti di conseguenza
  const side = a ? ((hit.x - a.x) * dir >= -0.12 ? 1 : -1) : 1;
  G.ideal = { who: r, t: G.time + hit.t, x: hit.x, y: hit.y, z: hit.z, side };
  placeFor(G.ideal, r, side, false);
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
  if ((a >= G.target || c >= G.target) && Math.abs(a - c) >= 2) { later(endMatch, 1600); sendState(); return; }
  // cambio battuta ogni 2 punti (ogni punto ai vantaggi)
  G.serves++;
  const every = (a >= G.target - 1 && c >= G.target - 1) ? 1 : 2;
  if (G.serves >= every) { G.serves = 0; G.server = 1 - G.server; }
  updateScore(); sendState();
  later(beginServe, FAST ? 500 : 1700);
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
    swing(i, { time: G.time, p: clamp(sp / 7.5, 0.1, 1.35), vert: clamp(-vy / sp, -1, 1), twist: 0, yaw: vx < 0 ? 1 : -1, dir: Math.abs(vx) > Math.abs(vy) * 0.5 ? (vx < 0 ? 1 : -1) : 0 });
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
// ?rec: niente orologio vero, si avanza a passi fissi da fuori (registrazione delle partite)
const REC = Q.has('rec'), timers = [];
// in registrazione i ritardi seguono il tempo del gioco, non l'orologio
function later(fn, ms) { if (!REC) return setTimeout(fn, ms); timers.push({ at: G.time + ms / 1000, fn }); }
let last = REC ? 0 : performance.now(), acc = 0, simNow = 0;
function frame(now) {
  if (!REC) requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000); last = now; if (FAST) dt *= 2;
  G.time += dt;
  if (REC) for (let k = timers.length - 1; k >= 0; k--) if (G.time >= timers[k].at) { const f = timers[k].fn; timers.splice(k, 1); f(); }
  if (G.ball && (G.phase === 'serve' || G.phase === 'rally' || G.phase === 'point')) {
    const b = G.ball;
    if (b.held) { const a = avatars[G.server], c = contactOf(G.server, 1, false, true), sz = sideZ(G.server); b.x = a.x - sz * c.off[0]; b.z = sz * ((a.z ?? T.L / 2 + 0.65) - c.off[2]); b.y = Math.max(0.95, c.off[1] + 0.1); }
    else {
      acc += dt; let n = 0;
      const t0 = G.time - dt;
      while (acc > 1 / 480 && n < 60) {
        const ev = [], pv = [b.vx, b.vy, b.vz]; step(b, 1 / 480, ev, G.time); acc -= 1 / 480; n++;
        if (G.trace) { G.trace.push([+G.time.toFixed(4), +b.x.toFixed(3), +b.y.toFixed(3), +b.z.toFixed(3), +b.vx.toFixed(3), +b.vy.toFixed(3), +b.vz.toFixed(3), ev.map(e => e.t[0]).join('') + (G._mark || '')]); G._mark = ''; }
        if (G.phase !== 'point') for (const e of ev) onEvent(e);
        if (G.pendingHit && !G.pendingHit.done && t0 + n / 480 >= G.pendingHit.at) { G.pendingHit.done = true; doHit(G.pendingHit); }
        if (G.serving && G.toss && b.y < 0.6 && b.vy < 0 && G.phase === 'serve') { if (G.players[G.server].kind !== 'cpu') shotTip('Palla caduta: rilancio'); beginServe(); break; }
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
  if (!NORENDER) composer.render();
}
function updateCamera(dt) {
  const b = G.ball;
  if (Q.has('cam')) { const c = Q.get('cam').split(',').map(Number); camera.position.set(c[0], c[1], c[2]); camera.lookAt(c[3], c[4], c[5]); return; }
  if (G.phase === 'lobby') { const t = G.time * 0.12; _p.set(Math.sin(t) * 4.2, 2.2, Math.cos(t) * 4.2); _l.set(0, 0.8, 0); }
  else if (G.view === 'tv') { _p.set(3.4, 2.3, (b ? b.z : 0) * 0.15); _l.set(0, 0.85, (b ? b.z : 0) * 0.25); }
  else { // prima persona: occhi del giocatore vicino, segue un po' la palla
    const ax = avatars[0] ? avatars[0].x : 0;
    _p.set(ax * 0.8 + 0.1, 1.42, (avatars[0] ? avatars[0].z ?? T.L / 2 + 0.65 : T.L / 2 + 0.65) + 0.2);
    _l.set((b ? b.x : 0) * 0.35 + ax * 0.3, 0.86 + (b ? Math.max(0, b.y - 1) * 0.3 : 0), -0.8);
  }
  const k = 1 - Math.exp(-dt * (G.view === 'tv' ? 4 : 7)); G.camPos.lerp(_p, k); G.camLook.lerp(_l, k);
  camera.position.copy(G.camPos); camera.lookAt(G.camLook);
}

renderLobby(); resize(); if (!REC) requestAnimationFrame(frame);
if (REC) { window.__adv = (n = 1, dt = 1 / 30) => { for (let i = 0; i < n; i++) { simNow += dt * 1000; frame(simNow); } }; }
await loadAvatarLibrary(); $('#start').dataset.ready = '1';
if (Q.has('trace')) G.trace = [];
if (DEBUG) { window.__G = G; window.__swing = swing; window.__start = startMatch; window.__av = avatars; }
if (Q.has('auto')) {
  // prova: due computer
  G.players = [{ kind: 'cpu', name: 'Topspin', sport: randomLook() }, { kind: 'cpu', name: 'La Contessa', sport: randomLook() }];
  G.target = +(Q.get('pts') || 5);
  const orig = startMatch;
  G.players.forEach(p => p.kind = 'cpu');
  $('#lobby').classList.add('hide'); $('#hud').classList.remove('hide');
  G.score = [0, 0]; G.server = 0; G.serves = 0; $('#nA').textContent = G.players[0].name; $('#nB').textContent = G.players[1].name;
  G.view = Q.get('auto') === 'tv' ? 'tv' : 'behind'; if (Q.has('fp')) G.players[0].kind = 'local'; setupAvatars(); if (Q.has('fp')) G.players[0].kind = 'cpu'; updateScore(); setTimeout(beginServe, 500);
}
