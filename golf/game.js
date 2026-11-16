// Minigolf del Ridotto: tutti tirano insieme, palle che si scontrano, poteri che fanno danni.
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { HOLES, buildHole, BALL_R, HOLE_R } from './course.js';
import { hostRoom, randomCode } from '../net.js';

const Q = new URLSearchParams(location.search);
const DEBUG = Q.has('debug'), FAST = Q.has('fast');
const MOBILE = matchMedia('(pointer:coarse)').matches;
const $ = s => document.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const COLORS = ['#ff3d9a', '#38e8ff', '#ffd166', '#7cff6b', '#b26bff', '#ff7b3d'];
const HATS = ['cilindro', 'festa', 'corona', 'cuoco', 'corna', 'elica'];
const MAX_STROKES = 10, MAX_SPEED = 5.2;
export const POWERS = {
  bomba: { icon: '💣', name: 'Bomba', desc: 'Esplode sulla palla più vicina alla buca' },
  raggio: { icon: '⚡', name: 'Raggio', desc: 'Fulmina la palla avversaria più vicina' },
  ghiaccio: { icon: '🧊', name: 'Ghiaccio', desc: 'Congela tutti gli altri per 5 secondi' },
  gigante: { icon: '🍄', name: 'Palloni', desc: 'Gli altri diventano giganti: in buca non entrano' },
  calamita: { icon: '🧲', name: 'Calamita', desc: 'La buca ti attira per 6 secondi' },
  salto: { icon: '🦘', name: 'Molla', desc: 'Il prossimo tiro salta gli ostacoli' },
  scambio: { icon: '🌀', name: 'Scambio', desc: 'Prendi il posto di chi è più vicino alla buca' },
};

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ canvas: $('#gl'), antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, MOBILE ? 1.5 : 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 200);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new ShaderPass({ uniforms: { tDiffuse: { value: null } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); if (!(c.r == c.r) || !(c.g == c.g) || !(c.b == c.b)) c = vec4(0.0,0.0,0.0,1.0); gl_FragColor = vec4(clamp(c.rgb, 0.0, 60.0), 1.0); }' }));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.5, 0.88));
composer.addPass(new OutputPass());
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); composer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize);
function ctex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }

// cielo notturno con stelle e casinò lontani
const sky = new THREE.Mesh(new THREE.SphereGeometry(90, 32, 16), new THREE.MeshBasicMaterial({ side: THREE.BackSide, map: ctex(1024, 512, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#05030f'); gr.addColorStop(0.5, '#1a0b33'); gr.addColorStop(0.62, '#3b1050'); gr.addColorStop(1, '#05030f'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * .9})`; g.fillRect(Math.random() * w, Math.random() * h * 0.55, 1.2, 1.2); }
  for (let i = 0; i < 60; i++) { const x = Math.random() * w, bw = 6 + Math.random() * 22, bh = 10 + Math.random() * 60; g.fillStyle = '#0b0618'; g.fillRect(x, h * 0.6 - bh, bw, bh); for (let k = 0; k < 6; k++) { g.fillStyle = ['#ff3d9a', '#38e8ff', '#ffd166'][k % 3]; g.globalAlpha = 0.6; g.fillRect(x + 2 + Math.random() * (bw - 4), h * 0.6 - bh + Math.random() * bh, 2, 2); g.globalAlpha = 1; } }
}) }));
scene.add(sky); scene.fog = new THREE.Fog(0x12082a, 18, 60);
scene.add(new THREE.HemisphereLight(0x9a8cff, 0x201030, 0.9));
const sun = new THREE.DirectionalLight(0xfff0dd, 2.2); sun.position.set(4, 9, 5); sun.castShadow = true;
sun.shadow.mapSize.set(MOBILE ? 1024 : 2048, MOBILE ? 1024 : 2048); Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 30 }); sun.shadow.bias = -0.0005; scene.add(sun);
const rim = new THREE.PointLight(0xff3d9a, 6, 14, 2); rim.position.set(-4, 2, -4); scene.add(rim);
const rim2 = new THREE.PointLight(0x38e8ff, 6, 14, 2); rim2.position.set(4, 2, 4); scene.add(rim2);

// ---------- fisica ----------
const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
world.broadphase = new CANNON.SAPBroadphase(world); world.solver.iterations = 10;
const mats = { floor: new CANNON.Material('floor'), wall: new CANNON.Material('wall'), bumper: new CANNON.Material('bumper'), ball: new CANNON.Material('ball') };
world.addContactMaterial(new CANNON.ContactMaterial(mats.ball, mats.floor, { friction: 0.08, restitution: 0.25 }));
world.addContactMaterial(new CANNON.ContactMaterial(mats.ball, mats.wall, { friction: 0.02, restitution: 0.72 }));
world.addContactMaterial(new CANNON.ContactMaterial(mats.ball, mats.bumper, { friction: 0.02, restitution: 1.15 }));
world.addContactMaterial(new CANNON.ContactMaterial(mats.ball, mats.ball, { friction: 0.05, restitution: 0.85 }));

// ---------- suoni ----------
let AC = null, master, noiseB;
function ac() { if (AC) return AC; try { AC = new (window.AudioContext || window.webkitAudioContext)(); master = AC.createGain(); master.gain.value = 0.8; master.connect(AC.destination); noiseB = AC.createBuffer(1, AC.sampleRate, AC.sampleRate); const d = noiseB.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } catch (e) { AC = null; } return AC; }
function snd(type, v = 1) {
  const c = ac(); if (!c) return; const t = c.currentTime;
  const tone = (f, dur, vol, at = 0, typ = 'sine', slide = 1) => { const o = c.createOscillator(), g = c.createGain(); o.type = typ; o.frequency.setValueAtTime(f, t + at); if (slide !== 1) o.frequency.exponentialRampToValueAtTime(f * slide, t + at + dur); g.gain.setValueAtTime(vol, t + at); g.gain.exponentialRampToValueAtTime(1e-4, t + at + dur); o.connect(g); g.connect(master); o.start(t + at); o.stop(t + at + dur + .02); };
  const noise = (dur, f, q, vol, at = 0, typ = 'bandpass') => { const s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain(); s.buffer = noiseB; s.loop = true; fl.type = typ; fl.frequency.value = f; fl.Q.value = q; g.gain.setValueAtTime(vol, t + at); g.gain.exponentialRampToValueAtTime(1e-4, t + at + dur); s.connect(fl); fl.connect(g); g.connect(master); s.start(t + at, Math.random()); s.stop(t + at + dur + .02); };
  const k = Math.min(1, v);
  if (type === 'putt') { tone(700, 0.05, 0.3 * k + 0.1, 0, 'triangle'); noise(0.04, 1800, 2, 0.2 * k + 0.05); }
  else if (type === 'wall') { tone(260, 0.06, 0.25 * k, 0, 'square', 0.6); }
  else if (type === 'boing') { tone(300, 0.25, 0.3, 0, 'sine', 2.4); }
  else if (type === 'ball') { tone(1500, 0.04, 0.3 * k); }
  else if (type === 'cup') { [0, 0.07, 0.14].forEach((a, i) => tone(500 - i * 80, 0.08, 0.3, a, 'triangle')); [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.3, 0.15, 0.25 + i * 0.08, 'triangle')); }
  else if (type === 'boom') { tone(70, 0.6, 0.6, 0, 'sine', 0.4); noise(0.7, 300, 0.6, 0.6, 0, 'lowpass'); }
  else if (type === 'zap') { tone(1800, 0.25, 0.2, 0, 'sawtooth', 0.2); noise(0.2, 4000, 3, 0.2); }
  else if (type === 'ice') { [2000, 2600, 3100].forEach((f, i) => tone(f, 0.25, 0.08, i * 0.05)); }
  else if (type === 'pick') { [880, 1320, 1760].forEach((f, i) => tone(f, 0.12, 0.15, i * 0.06, 'triangle')); }
  else if (type === 'swap') { tone(300, 0.4, 0.2, 0, 'sine', 3); tone(900, 0.4, 0.1, 0.1, 'sine', 0.33); }
  else if (type === 'fall') { tone(600, 0.6, 0.2, 0, 'sine', 0.2); }
  else if (type === 'jump') { tone(250, 0.3, 0.25, 0, 'square', 3); }
}

// ---------- stato ----------
const G = { phase: 'lobby', players: [], hole: 0, nHoles: 6, built: null, time: 0, holeT: 0, firstIn: null, camPos: new THREE.Vector3(0, 8, 8), camLook: new THREE.Vector3(), fx: [] };

// ---------- palle con faccia e cappello ----------
function hatMesh(kind, color) {
  const g = new THREE.Group(), m = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 });
  if (kind === 'cilindro') { const a = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 16), m(0x111111)); a.position.y = 0.025; g.add(a); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.006, 20), m(0x111111)); g.add(b); const r = new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.031, 0.01, 16), m(color)); r.position.y = 0.008; g.add(r); }
  else if (kind === 'festa') { const a = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.08, 16), m(color)); a.position.y = 0.04; g.add(a); const p = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), m(0xffffff)); p.position.y = 0.085; g.add(p); }
  else if (kind === 'corona') { const a = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 8, 1, true), new THREE.MeshStandardMaterial({ color: 0xffd166, metalness: 1, roughness: 0.25, side: THREE.DoubleSide })); a.position.y = 0.015; g.add(a); for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.02, 4), a.material); s.position.set(Math.cos(i) * 0.035, 0.038, Math.sin(i) * 0.035); g.add(s); } }
  else if (kind === 'cuoco') { const a = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.03, 16), m(0xffffff)); a.position.y = 0.015; g.add(a); const b = new THREE.Mesh(new THREE.SphereGeometry(0.038, 12, 10), m(0xffffff)); b.position.y = 0.045; b.scale.y = 0.8; g.add(b); }
  else if (kind === 'corna') { for (const s of [-1, 1]) { const a = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.045, 8), m(0xc8101c)); a.position.set(s * 0.025, 0.02, 0); a.rotation.z = -s * 0.4; g.add(a); } }
  else { const a = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), m(color)); g.add(a); const st = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.03), m(0x333333)); st.position.y = 0.04; g.add(st); const pr = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.004, 0.012), m(0xffd166)); pr.position.y = 0.055; g.add(pr); g.userData.prop = pr; }
  return g;
}
function nameSprite(text, color) {
  const t = ctex(256, 64, (g, w, h) => { g.font = '700 34px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,.7)'; g.strokeText(text, w / 2, h / 2); g.fillStyle = color; g.fillText(text, w / 2, h / 2); });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true })); s.scale.set(0.5, 0.125, 1); s.renderOrder = 10; return s;
}
function makeBallFor(p, i) {
  const body = new CANNON.Body({ mass: 0.12, material: mats.ball, linearDamping: 0.42, angularDamping: 0.45 });
  body.addShape(new CANNON.Sphere(BALL_R)); body.allowSleep = false; world.addBody(body);
  body.addEventListener('collide', e => { const v = Math.abs(e.contact.getImpactVelocityAlongNormal()); if (v < 0.4) return; const o = e.body; if (o.material === mats.bumper) snd('boing'); else if (o.material === mats.ball) snd('ball', v / 3); else if (o.material === mats.wall) snd('wall', v / 4); });
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 24, 16), new THREE.MeshPhysicalMaterial({ color: p.color, roughness: 0.25, clearcoat: 1, map: ctex(128, 64, (g, w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, h * 0.45, w, h * 0.1); }) }));
  sphere.castShadow = true;
  const face = new THREE.Group();
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.017, 12, 10), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 })); e.position.set(s * 0.02, 0.022, -0.04); face.add(e); const pu = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), new THREE.MeshBasicMaterial({ color: 0x000000 })); pu.position.set(s * 0.02, 0.022, -0.056); face.add(pu); }
  const hat = hatMesh(p.hat || HATS[i % HATS.length], p.color); hat.position.y = BALL_R - 0.005; face.add(hat);
  const tag = nameSprite(p.name, p.color); tag.position.y = 0.2; face.add(tag);
  const grp = new THREE.Group(); grp.add(sphere); grp.add(face); scene.add(grp);
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 12), new THREE.MeshBasicMaterial({ color: p.color, toneMapped: false })); arrow.rotation.x = -Math.PI / 2; const arrowG = new THREE.Group(); arrowG.add(arrow);
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.01, 1), arrow.material); shaft.position.z = 0.5; arrowG.add(shaft); arrowG.visible = false; scene.add(arrowG);
  const ice = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), new THREE.MeshPhysicalMaterial({ color: 0xbfefff, transparent: true, opacity: 0.55, roughness: 0.05, clearcoat: 1 })); ice.visible = false; scene.add(ice);
  Object.assign(p, { body, grp, sphere, face, hatObj: hat, arrowG, shaft, arrow, ice, yaw: 0 });
}
function removeBall(p) { if (p.body) world.removeBody(p.body); for (const o of [p.grp, p.arrowG, p.ice]) if (o) scene.remove(o); p.body = null; }

// ---------- buca ----------
function loadHole(i) {
  if (G.built) { scene.remove(G.built.grp); for (const b of G.built.bodies) world.removeBody(b); for (const pk of G.built.pickups) if (pk.mesh) scene.remove(pk.mesh); }
  const def = HOLES[i]; def.holeY = null;
  G.built = buildHole(def, world, mats, scene); G.def = def;
  G.built.grp.traverse(o => { if (o.isMesh) { o.receiveShadow = true; } });
  for (const pk of G.built.pickups) { pk.mesh = pickupMesh(); pk.mesh.position.set(pk.x, pk.y + 0.18, pk.z); scene.add(pk.mesh); }
  G.players.forEach((p, k) => {
    if (!p.body) makeBallFor(p, k);
    const off = (k - (G.players.length - 1) / 2) * 0.14;
    placeBall(p, def.tee[0] + off, def.tee[1] + (k % 2) * 0.12);
    p.holed = false; p.strokes = 0; p.lastPos = [p.body.position.x, p.body.position.z]; p.frozenUntil = 0; p.bigUntil = 0; p.magnetUntil = 0; p.jumpNext = false;
    p.grp.visible = true; p.wp = 0; p.botWait = rnd(1, 2.5);
    setBig(p, false);
  });
  G.holeT = 0; G.firstIn = null; G.phase = 'play';
  $('#holeName').textContent = `Buca ${i + 1} · ${def.name}`; $('#holePar').textContent = `Par ${def.par}`;
  big(`Buca ${i + 1}`, def.name);
  sendAll();
}
function placeBall(p, x, z) {
  const y = (G.def.holeY != null && false) ? 0 : 0;
  p.body.position.set(x, y + BALL_R + 0.02, z); p.body.velocity.setZero(); p.body.angularVelocity.setZero(); p.body.quaternion.set(0, 0, 0, 1);
  if (!p.body.world) world.addBody(p.body);
}
function pickupMesh() {
  const t = ctex(64, 64, (g, w, h) => { g.fillStyle = '#ffd166'; g.fillRect(0, 0, w, h); g.strokeStyle = '#7a4a00'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6); g.fillStyle = '#7a1424'; g.font = '700 46px Georgia'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', w / 2, h / 2 + 3); });
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), new THREE.MeshStandardMaterial({ map: t, emissive: 0xffaa33, emissiveIntensity: 0.4 })); m.castShadow = true; return m;
}
function setBig(p, on) {
  const r = on ? BALL_R * 2.1 : BALL_R;
  p.body.shapes[0].radius = r; p.body.shapes[0].updateBoundingSphereRadius(); p.body.updateBoundingRadius();
  p.sphere.scale.setScalar(r / BALL_R); p.face.scale.setScalar(r / BALL_R); p.big = on;
}

// ---------- tiri ----------
const camFwd = new THREE.Vector3(), camRight = new THREE.Vector3();
function screenDirToWorld(ang) {
  camera.getWorldDirection(camFwd); camFwd.y = 0; camFwd.normalize(); camRight.set(-camFwd.z, 0, camFwd.x);
  return new THREE.Vector3().addScaledVector(camFwd, Math.cos(ang)).addScaledVector(camRight, Math.sin(ang)).normalize();
}
function canShoot(p) { return G.phase === 'play' && p.body && !p.holed && p.still && G.time > p.frozenUntil && p.strokes < MAX_STROKES; }
function shoot(p, dir, pow) {
  if (!canShoot(p)) return false;
  pow = clamp(pow, 0.03, 1);
  const sp = 0.25 + MAX_SPEED * Math.pow(pow, 1.25);
  p.lastPos = [p.body.position.x, p.body.position.z];
  p.body.velocity.set(dir.x * sp, p.jumpNext ? 3.2 : 0.2, dir.z * sp);
  if (p.jumpNext) { snd('jump'); p.jumpNext = false; }
  p.strokes++; p.still = false; p.stillT = 0; p.aim = null;
  snd('putt', pow);
  sendTo(p);
  return true;
}

// ---------- poteri ----------
function distToHole(p) { return Math.hypot(p.body.position.x - G.def.hole[0], p.body.position.z - G.def.hole[1]); }
function others(p) { return G.players.filter(q => q !== p && q.body && !q.holed); }
function usePower(p) {
  if (!p.power || G.phase !== 'play' || !p.body) return;
  const kind = p.power; p.power = null; const opp = others(p);
  const byHole = [...opp].sort((a, b) => distToHole(a) - distToHole(b));
  const near = [...opp].sort((a, b) => a.body.position.distanceTo(p.body.position) - b.body.position.distanceTo(p.body.position));
  toast(`${p.name}: ${POWERS[kind].icon} ${POWERS[kind].name}!`, p.color);
  if (kind === 'bomba') {
    const tgt = byHole[0]; const at = tgt ? tgt.body.position.clone() : p.body.position.clone();
    const bomb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x330000 }));
    scene.add(bomb); const from = p.body.position.clone();
    G.fx.push({ t: 0, dur: 0.9, upd: (k) => { bomb.position.set(from.x + (at.x - from.x) * k, from.y + (at.y - from.y) * k + Math.sin(k * Math.PI) * 1.6, from.z + (at.z - from.z) * k); }, end: () => { scene.remove(bomb); explode(at); } });
  } else if (kind === 'raggio') {
    const tgt = near[0]; if (!tgt) return;
    const a = p.body.position, b = tgt.body.position;
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(a.x, a.y + 0.05, a.z), new THREE.Vector3(b.x, b.y + 0.05, b.z)]);
    const beam = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x9ff6ff, toneMapped: false })); scene.add(beam);
    const glowB = new THREE.PointLight(0x9ff6ff, 8, 2); glowB.position.copy(b); scene.add(glowB);
    snd('zap');
    const d = new CANNON.Vec3(b.x - a.x, 0, b.z - a.z); d.normalize();
    tgt.body.velocity.set(d.x * 3.5, 2.2, d.z * 3.5); tgt.frozenUntil = G.time + 1.2;
    G.fx.push({ t: 0, dur: 0.45, upd: k => { beam.material.opacity = 1 - k; }, end: () => { scene.remove(beam); scene.remove(glowB); } });
  } else if (kind === 'ghiaccio') { snd('ice'); for (const q of opp) { q.frozenUntil = G.time + 5; q.body.velocity.scale(0.1, q.body.velocity); } }
  else if (kind === 'gigante') { snd('boing'); for (const q of opp) { setBig(q, true); q.bigUntil = G.time + 9; } }
  else if (kind === 'calamita') { snd('pick'); p.magnetUntil = G.time + 6; }
  else if (kind === 'salto') { snd('jump'); p.jumpNext = true; }
  else if (kind === 'scambio') {
    const tgt = byHole[0]; if (!tgt) return; snd('swap');
    const a = p.body.position.clone(), b = tgt.body.position.clone();
    p.body.position.copy(b); tgt.body.position.copy(a); p.body.velocity.setZero(); tgt.body.velocity.setZero();
  }
  for (const q of G.players) sendTo(q);
}
function explode(at) {
  snd('boom');
  const flash = new THREE.PointLight(0xffaa44, 30, 4); flash.position.copy(at); flash.position.y += 0.3; scene.add(flash);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffc070, transparent: true, toneMapped: false })); ball.position.copy(at); scene.add(ball);
  const sparks = new THREE.Group(); for (let i = 0; i < 24; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 4), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffd166 : 0xff5a3d, toneMapped: false })); s.userData.v = new THREE.Vector3(rnd(-1, 1), rnd(0.5, 2), rnd(-1, 1)).multiplyScalar(2); sparks.add(s); } sparks.position.copy(at); scene.add(sparks);
  G.fx.push({ t: 0, dur: 0.7, upd: k => { ball.scale.setScalar(1 + k * 9); ball.material.opacity = 1 - k; flash.intensity = 30 * (1 - k); sparks.children.forEach(s => { s.position.addScaledVector(s.userData.v, 0.016); s.userData.v.y -= 0.15; }); }, end: () => { scene.remove(ball); scene.remove(flash); scene.remove(sparks); } });
  for (const q of G.players) {
    if (!q.body || q.holed) continue;
    const d = q.body.position.vsub(new CANNON.Vec3(at.x, at.y, at.z)); const l = Math.max(0.15, d.length());
    if (l > 1.4) continue;
    const k = 4.5 * (1 - l / 1.4) / l; q.body.velocity.set(q.body.velocity.x + d.x * k, 2.8 * (1 - l / 1.4) + 0.5, q.body.velocity.z + d.z * k); q.still = false;
  }
  G.shake = 0.6;
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
    onError(t) { $('#net').textContent = 'Telefoni non disponibili (' + t + '): gioca qui col mouse'; },
  });
} catch (e) { $('#net').textContent = 'Telefoni non disponibili'; }
function sendTo(p) {
  if (p.kind !== 'phone' || !p.conn || !NET) return;
  NET.send(p.conn, { t: 'golf', hole: G.hole + 1, name: G.def ? G.def.name : '', par: G.def ? G.def.par : 0, strokes: p.strokes || 0, can: !!(p.body && canShoot(p)), holed: !!p.holed, power: p.power ? POWERS[p.power] : null, frozen: G.time < (p.frozenUntil || 0), phase: G.phase, color: p.color });
}
const sendAll = () => G.players.forEach(sendTo);
function onPhone(id, m) {
  if (m.t === 'ping') return;
  if (m.t === 'join') {
    let p = G.players.find(x => x.pid && x.pid === m.pid);
    if (!p) {
      if (G.phase !== 'lobby') { NET.send(id, { t: 'full', text: 'Partita in corso: aspetta la prossima' }); return; }
      if (G.players.length >= 6) { NET.send(id, { t: 'full', text: 'Sala piena' }); return; }
      p = { kind: 'phone', pid: m.pid, name: (m.name || 'Telefono').slice(0, 14), color: m.color || COLORS[G.players.length % 6], total: 0, cards: [] };
      G.players.push(p);
    }
    p.conn = id; p.online = true;
    NET.send(id, { t: 'hi', name: p.name, color: p.color, game: 'golf' });
    renderLobby(); sendTo(p); return;
  }
  const p = G.players.find(x => x.conn === id); if (!p) return;
  if (m.t === 'gaim') p.aim = { dir: screenDirToWorld(+m.ang || 0), pow: clamp(+m.pow || 0, 0, 1), t: G.time };
  if (m.t === 'gshot') { if (!shoot(p, screenDirToWorld(+m.ang || 0), +m.pow || 0)) sendTo(p); }
  if (m.t === 'guse') usePower(p);
}

// ---------- lobby ----------
function renderLobby() {
  const qr = qrcode(0, 'M'); qr.addData(ctrlUrl()); qr.make(); $('#qr').innerHTML = qr.createSvgTag({ cellSize: 5, margin: 1, scalable: true });
  $('#code').textContent = CODE; $('#url').textContent = ctrlUrl().replace(/^https?:\/\//, '');
  $('#plist').innerHTML = G.players.length ? G.players.map((p, i) => `<div class="pp"><span class="dot" style="background:${p.color}"></span><b>${esc(p.name)}</b><small>${p.kind === 'phone' ? (p.online ? '📱 telefono' : '📱 scollegato') : p.kind === 'bot' ? '🤖 bot' : '🖱 qui'}</small><button data-del="${i}">✕</button></div>`).join('') : '<p class="note">Entra col telefono, oppure aggiungi chi gioca qui e qualche bot.</p>';
  $('#start').disabled = !G.players.length;
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const BOT_NAMES = ['Mazza Matta', 'La Buca', 'Tiro Storto', 'Conte Golfo', 'Zia Pallina'];
document.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || $('#lobby').classList.contains('hide')) return;
  if (b.dataset.del != null) { const p = G.players[+b.dataset.del]; if (p.conn && NET) NET.send(p.conn, { t: 'kicked' }); G.players.splice(+b.dataset.del, 1); renderLobby(); }
  if (b.dataset.n) { G.nHoles = +b.dataset.n; document.querySelectorAll('#nh .chip').forEach(x => x.classList.toggle('sel', x === b)); }
});
$('#addLocal').onclick = () => { ac(); if (G.players.some(p => p.kind === 'local')) return; const n = $('#localName').value.trim() || 'Giocatore'; G.players.push({ kind: 'local', name: n.slice(0, 14), color: COLORS[G.players.length % 6], total: 0, cards: [] }); renderLobby(); };
$('#addBot').onclick = () => { if (G.players.length >= 6) return; const used = G.players.map(p => p.name); G.players.push({ kind: 'bot', name: BOT_NAMES.find(x => !used.includes(x)) || 'Bot', color: COLORS[G.players.length % 6], total: 0, cards: [] }); renderLobby(); };
$('#start').onclick = () => { ac(); startGame(); };
$('#again').onclick = () => { $('#end').classList.add('hide'); startGame(); };
$('#toLobby').onclick = () => { $('#end').classList.add('hide'); $('#hud').classList.add('hide'); $('#lobby').classList.remove('hide'); G.phase = 'lobby'; G.players.forEach(removeBall); renderLobby(); sendAll(); };
$('#menuBtn').onclick = () => { if (window.confirm('Tornare alla sala?')) $('#toLobby').onclick(); };

function startGame() {
  G.players.forEach((p, i) => { removeBall(p); p.cards = []; p.total = 0; p.hat = HATS[i % HATS.length]; p.power = null; });
  $('#lobby').classList.add('hide'); $('#hud').classList.remove('hide');
  G.hole = 0; G.order = G.nHoles >= HOLES.length ? HOLES.map((_, i) => i) : [0, ...HOLES.map((_, i) => i).slice(1).sort(() => Math.random() - 0.5).slice(0, G.nHoles - 1)];
  loadHole(G.order[0]); renderScores();
}
function endHole() {
  G.phase = 'between';
  for (const p of G.players) { const s = p.holed ? p.strokes : MAX_STROKES; p.cards.push(s); p.total += s; }
  renderScores(true);
  setTimeout(() => {
    G.hole++;
    if (G.hole >= G.order.length) return endGame();
    loadHole(G.order[G.hole]); renderScores();
  }, FAST ? 1500 : 4200);
  sendAll();
}
function endGame() {
  G.phase = 'over';
  const rank = [...G.players].sort((a, b) => a.total - b.total);
  const par = G.order.reduce((a, i) => a + HOLES[i].par, 0);
  $('#final').innerHTML = `<div class="w">${esc(rank[0].name)} vince!</div>` + rank.map((p, i) => `<div>${i + 1}. ${esc(p.name)} — <b>${p.total}</b> colpi (${p.total - par >= 0 ? '+' : ''}${p.total - par})</div>`).join('');
  $('#end').classList.remove('hide'); snd('cup');
  for (const p of G.players) if (p.kind === 'phone' && NET) NET.send(p.conn, { t: 'end', text: `${rank[0].name} vince`, score: p.total });
}

// ---------- HUD ----------
let bigT = 0;
function big(a, b, ms = 1800) { const el = $('#big'); el.innerHTML = `${esc(a)}<small>${esc(b || '')}</small>`; el.classList.add('show'); clearTimeout(bigT); bigT = setTimeout(() => el.classList.remove('show'), ms); }
function toast(t, color) { const el = document.createElement('div'); el.className = 'toast'; el.textContent = t; el.style.borderColor = color || '#fff'; $('#toasts').appendChild(el); setTimeout(() => el.remove(), 2600); }
function renderScores(full) {
  const n = G.order.length;
  let h = '<table><tr><th></th>' + G.order.map((k, i) => `<th class="${i === G.hole ? 'cur' : ''}">${i + 1}</th>`).join('') + '<th>Tot</th></tr>';
  h += '<tr class="par"><td>Par</td>' + G.order.map(k => `<td>${HOLES[k].par}</td>`).join('') + `<td>${G.order.reduce((a, k) => a + HOLES[k].par, 0)}</td></tr>`;
  for (const p of G.players) {
    h += `<tr><td class="nm" style="color:${p.color}">${esc(p.name)}</td>` + G.order.map((k, i) => `<td>${p.cards[i] ?? (i === G.hole && p.strokes ? `<i>${p.strokes}</i>` : '')}</td>`).join('') + `<td class="tot">${p.total}</td></tr>`;
  }
  $('#scores').innerHTML = h + '</table>';
  $('#scores').classList.toggle('full', !!full);
}
function updateSide() {
  $('#side').innerHTML = G.players.map(p => `<div class="sp" style="border-color:${p.color}"><b style="color:${p.color}">${esc(p.name)}</b> <span>${p.holed ? '⛳ in buca' : `${p.strokes} colpi`}</span>${p.power ? ` <em title="${POWERS[p.power].name}">${POWERS[p.power].icon}</em>` : ''}${G.time < (p.frozenUntil || 0) ? ' 🧊' : ''}${p.big ? ' 🍄' : ''}${p.magnetUntil > G.time ? ' 🧲' : ''}</div>`).join('');
  const lp = G.players.find(p => p.kind === 'local');
  $('#useBtn').classList.toggle('hide', !(lp && lp.power));
  if (lp && lp.power) $('#useBtn').textContent = `${POWERS[lp.power].icon} Usa ${POWERS[lp.power].name}`;
  if (G.firstIn != null && G.phase === 'play') { const left = Math.max(0, 45 - (G.time - G.firstIn)); $('#timer').textContent = `⏱ ${left.toFixed(0)}`; $('#timer').classList.remove('hide'); } else $('#timer').classList.add('hide');
}

// ---------- comandi locali (fionda col mouse o col dito) ----------
let drag = null;
const canvas = $('#gl');
canvas.addEventListener('pointerdown', e => { ac(); const p = G.players.find(q => q.kind === 'local'); if (!p || G.phase !== 'play') return; canvas.setPointerCapture(e.pointerId); drag = { x0: e.clientX, y0: e.clientY }; });
canvas.addEventListener('pointermove', e => {
  if (!drag) return; const p = G.players.find(q => q.kind === 'local'); if (!p) return;
  const dx = drag.x0 - e.clientX, dy = drag.y0 - e.clientY, l = Math.hypot(dx, dy);
  const pow = clamp(l / (Math.min(innerWidth, innerHeight) * 0.42), 0, 1);
  p.aim = { dir: screenDirToWorld(Math.atan2(dx, -dy)), pow, t: G.time };
});
canvas.addEventListener('pointerup', e => {
  if (!drag) return; const p = G.players.find(q => q.kind === 'local'); const d = drag; drag = null; if (!p) return;
  const dx = d.x0 - e.clientX, dy = d.y0 - e.clientY, l = Math.hypot(dx, dy);
  if (l < 12) { p.aim = null; return; }
  shoot(p, screenDirToWorld(Math.atan2(dx, -dy)), clamp(l / (Math.min(innerWidth, innerHeight) * 0.42), 0, 1));
});
$('#useBtn').onclick = () => { const p = G.players.find(q => q.kind === 'local'); if (p) usePower(p); };
addEventListener('keydown', e => { if (e.code === 'KeyE' || e.code === 'Space') { const p = G.players.find(q => q.kind === 'local'); if (p) usePower(p); } });

// ---------- bot ----------
const ray = new CANNON.RaycastResult();
function rayClear(x0, z0, y, x1, z1) {
  ray.reset(); world.raycastClosest(new CANNON.Vec3(x0, y, z0), new CANNON.Vec3(x1, y, z1), { skipBackfaces: true }, ray);
  return !ray.hasHit || G.players.some(q => q.body === ray.body);
}
// la palla passa? tre raggi: centro e i due bordi
function floorY(x, z, from = 2) {
  ray.reset(); world.raycastClosest(new CANNON.Vec3(x, from, z), new CANNON.Vec3(x, -1, z), { skipBackfaces: true }, ray);
  if (!ray.hasHit || G.players.some(q => q.body === ray.body)) return null;
  return ray.hitPointWorld.y;
}
function clearPath(p, x, z) {
  const a = p.body.position, dx = x - a.x, dz = z - a.z, l = Math.hypot(dx, dz) || 1, nx = -dz / l * BALL_R * 1.1, nz = dx / l * BALL_R * 1.1, y = a.y;
  if (!(rayClear(a.x, a.z, y, x, z) && rayClear(a.x + nx, a.z + nz, y, x + nx, z + nz) && rayClear(a.x - nx, a.z - nz, y, x - nx, z - nz))) return false;
  // niente vuoto sotto il percorso
  for (let t = 0.15; t < l; t += 0.15) { const fy = floorY(a.x + dx / l * t, a.z + dz / l * t, y + 0.3); if (fy == null || fy < y - 0.4) return false; }
  return true;
}
function botThink(p, dt) {
  if (p.power && Math.random() < dt * 0.4) usePower(p);
  if (!canShoot(p)) return;
  p.botWait -= dt; if (p.botWait > 0) return;
  p.botWait = rnd(0.5, 1.4);
  const def = G.def, path = [...(def.wp || []), def.hole], a = p.body.position;
  // avanza lungo il percorso: un punto è superato se ci sei vicino o se vedi già il successivo
  while (p.wp < path.length - 1 && (Math.hypot(path[p.wp][0] - a.x, path[p.wp][1] - a.z) < 0.55 || clearPath(p, path[p.wp + 1][0], path[p.wp + 1][1]))) p.wp++;
  let tgt = null;
  for (let k = path.length - 1; k >= p.wp; k--) if (clearPath(p, path[k][0], path[k][1])) { tgt = path[k]; break; }
  let spread = 0.04;
  if (!tgt) { tgt = path[p.wp]; spread = 0.1; }
  const dx = tgt[0] - a.x, dz = tgt[1] - a.z, d = Math.hypot(dx, dz), isHole = tgt === def.hole;
  const ty = floorY(tgt[0], tgt[1]) ?? 0, rise = Math.max(0, ty - (a.y - BALL_R));
  const speedNeed = clamp(d / 1.07 * (isHole ? 1.0 : 1.05) + (isHole ? 0.2 : 0.1) + rise * 7, 0.45, MAX_SPEED);
  let pow = Math.pow(Math.max(0.01, speedNeed - 0.25) / MAX_SPEED, 1 / 1.25);
  const ang = Math.atan2(dz, dx) + rnd(-1, 1) * spread;
  pow = clamp(pow * rnd(0.9, 1.1), 0.05, 1);
  shoot(p, new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang)), pow);
}

// ---------- ciclo ----------
let last = performance.now(), acc = 0;
const _q = new THREE.Quaternion(), _e = new THREE.Vector3();
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000); last = now; if (FAST) dt *= 2;
  G.time += dt;
  if (G.phase === 'play' || G.phase === 'between') {
    G.holeT += dt;
    // ostacoli che si muovono
    for (const mv of G.built.movers) if (mv.slide) { const s = mv.slide, o = Math.sin(G.time * s.sp) * s.amp, v = Math.cos(G.time * s.sp) * s.amp * s.sp; if (s.ax === 'x') { mv.body.position.x = s.x + o; mv.body.velocity.set(v, 0, 0); } else { mv.body.position.z = s.z + o; mv.body.velocity.set(0, 0, v); } }
    // calamita
    for (const p of G.players) if (p.body && p.magnetUntil > G.time && !p.holed) { const d = new CANNON.Vec3(G.def.hole[0] - p.body.position.x, 0, G.def.hole[1] - p.body.position.z), l = d.length(); if (l < 2.6 && l > 0.01) { p.body.velocity.x += d.x / l * 3 * dt; p.body.velocity.z += d.z / l * 3 * dt; p.still = false; } }
    acc += dt; let n = 0;
    while (acc >= 1 / 120 && n < 8) { world.step(1 / 120); acc -= 1 / 120; n++; }
    if (n === 8) acc = 0;
    for (const mv of G.built.movers) { mv.mesh.position.copy(mv.body.position); mv.mesh.quaternion.copy(mv.body.quaternion); }
    // pickup
    for (const pk of G.built.pickups) {
      pk.mesh.visible = pk.active; pk.mesh.rotation.y += dt * 1.6; pk.mesh.position.y = pk.y + 0.18 + Math.sin(G.time * 3) * 0.03;
      if (!pk.active) { if (G.time > pk.t) pk.active = true; continue; }
      for (const p of G.players) if (p.body && !p.holed && !p.power && Math.hypot(p.body.position.x - pk.x, p.body.position.z - pk.z) < 0.17) {
        const keys = Object.keys(POWERS); p.power = keys[Math.floor(Math.random() * keys.length)]; pk.active = false; pk.t = G.time + 9;
        snd('pick'); toast(`${p.name} trova ${POWERS[p.power].icon} ${POWERS[p.power].name}`, p.color); sendTo(p); break;
      }
    }
    for (const p of G.players) updateBall(p, dt);
    if (G.phase === 'play') {
      const active = G.players.filter(p => !p.holed && p.strokes < MAX_STROKES);
      const waiting = G.players.filter(p => !p.holed);
      if (!waiting.length || (G.firstIn != null && G.time - G.firstIn > 45) || (!active.length && waiting.every(p => p.still)) || G.holeT > 150) endHole();
    }
  }
  // effetti
  for (let i = G.fx.length - 1; i >= 0; i--) { const f = G.fx[i]; f.t += dt; f.upd(Math.min(1, f.t / f.dur)); if (f.t >= f.dur) { f.end && f.end(); G.fx.splice(i, 1); } }
  if (G.built) { const fl = G.built.flag; fl.rotation.y = Math.sin(G.time * 2) * 0.25; }
  updateSide();
  updateCamera(dt);
  composer.render();
}
function updateBall(p, dt) {
  if (!p.body) return;
  const b = p.body, pos = b.position, v = b.velocity.length();
  if (p.holed) { p.grp.visible = false; p.arrowG.visible = false; p.ice.visible = false; return; }
  if (p.big && G.time > p.bigUntil) setBig(p, false);
  if (G.time < p.frozenUntil) { b.velocity.set(0, Math.min(0, b.velocity.y), 0); b.angularVelocity.setZero(); }
  // ferma?
  if (v < 0.09) { p.stillT = (p.stillT || 0) + dt; if (p.stillT > 0.25 && !p.still) { p.still = true; b.velocity.setZero(); b.angularVelocity.setZero(); sendTo(p); } }
  else { p.stillT = 0; if (p.still && v > 0.2) { p.still = false; sendTo(p); } }
  // in buca?
  const hx = G.def.hole[0], hz = G.def.hole[1], dh = Math.hypot(pos.x - hx, pos.z - hz);
  if (!p.big && dh < HOLE_R && pos.y < G.def.holeY - 0.01) {
    p.holed = true; world.removeBody(b); snd('cup');
    const d = p.strokes - G.def.par;
    const word = p.strokes === 1 ? 'Buca in uno!' : d <= -2 ? 'Eagle!' : d === -1 ? 'Birdie!' : d === 0 ? 'Par' : d === 1 ? 'Bogey' : `+${d}`;
    big(`${p.name}`, word, 1600); toast(`${p.name} in buca: ${word}`, p.color);
    if (G.firstIn == null) G.firstIn = G.time;
    sendTo(p); return;
  }
  // caduto fuori
  if (pos.y < -1.2) { snd('fall'); toast(`${p.name} è caduto! +1`, p.color); p.strokes++; placeBall(p, p.lastPos[0], p.lastPos[1]); p.still = false; }
  // grafica
  p.grp.visible = true;
  p.sphere.position.copy(pos); p.sphere.quaternion.copy(b.quaternion);
  p.face.position.copy(pos);
  const hv = Math.hypot(b.velocity.x, b.velocity.z);
  if (hv > 0.2) p.yaw = Math.atan2(-b.velocity.x, -b.velocity.z);
  else if (p.aim) p.yaw = Math.atan2(-p.aim.dir.x, -p.aim.dir.z);
  p.face.rotation.y += (((p.yaw - p.face.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 8);
  if (p.hatObj.userData.prop) p.hatObj.userData.prop.rotation.y += dt * 20;
  // freccia di mira
  const aimOn = p.aim && G.time - p.aim.t < 0.6 && p.aim.pow > 0.02 && canShoot(p);
  p.arrowG.visible = !!aimOn;
  if (aimOn) {
    const len = 0.25 + p.aim.pow * 1.3; p.shaft.scale.z = len; p.shaft.position.z = -len / 2; p.arrow.position.z = -len - 0.06;
    p.arrowG.position.set(pos.x, pos.y - BALL_R + 0.012, pos.z); p.arrowG.rotation.y = Math.atan2(-p.aim.dir.x, -p.aim.dir.z);
    p.arrow.material.color.setHSL(0.33 - p.aim.pow * 0.33, 1, 0.55);
  }
  p.ice.visible = G.time < p.frozenUntil; if (p.ice.visible) p.ice.position.copy(pos);
  if (p.kind === 'bot') botThink(p, dt);
}
function updateCamera(dt) {
  if (G.phase === 'lobby' || !G.built) { const t = G.time * 0.1; G.camPos.set(Math.sin(t) * 9, 5, Math.cos(t) * 9); camera.position.copy(G.camPos); camera.lookAt(0, 0, 0); return; }
  const bb = G.built.bounds, s = bb.getSize(new THREE.Vector3());
  // vista di lato se la buca è lunga e lo schermo è largo
  const side = s.z > s.x * 1.25 && camera.aspect > 1.1;
  // zona interessante: buca + palle in gioco
  const box = new THREE.Box3(); box.expandByPoint(new THREE.Vector3(G.def.hole[0], 0, G.def.hole[1]));
  for (const p of G.players) if (p.body && !p.holed) box.expandByPoint(new THREE.Vector3(p.body.position.x, 0, p.body.position.z));
  box.expandByScalar(0.9); box.intersect(bb.clone().expandByScalar(0.3));
  const c = box.getCenter(new THREE.Vector3()), z = box.getSize(new THREE.Vector3());
  let w = side ? z.z : z.x, d = side ? z.x : z.z; w = Math.max(w, 2.6); d = Math.max(d, 2.0);
  const fov = camera.fov * Math.PI / 180, a = camera.aspect;
  const need = Math.max(d * 0.75, w / a) / (2 * Math.tan(fov / 2));
  const dist = need * 1.15 + 0.8;
  const off = side ? new THREE.Vector3(dist * 0.6, dist * 0.8, 0) : new THREE.Vector3(0, dist * 0.8, dist * 0.6);
  const pos = c.clone().add(off);
  const k = 1 - Math.exp(-dt * 1.8);
  G.camPos.lerp(pos, k); G.camLook.lerp(new THREE.Vector3(c.x, 0, c.z), k);
  camera.position.copy(G.camPos);
  if (G.shake > 0) { G.shake = Math.max(0, G.shake - dt); camera.position.x += (Math.random() - .5) * G.shake * 0.3; camera.position.y += (Math.random() - .5) * G.shake * 0.3; }
  camera.lookAt(G.camLook);
}

renderLobby(); resize(); requestAnimationFrame(frame);
if (DEBUG) { window.__G = G; window.__shoot = shoot; window.__use = usePower; window.__load = loadHole; window.__start = startGame; }
if (Q.has('auto')) {
  for (let i = 0; i < +(Q.get('auto') || 3); i++) G.players.push({ kind: 'bot', name: BOT_NAMES[i], color: COLORS[i], total: 0, cards: [] });
  G.nHoles = +(Q.get('holes') || HOLES.length); startGame();
  if (Q.get('hole')) { G.order = [+Q.get('hole')]; loadHole(+Q.get('hole')); }
}
