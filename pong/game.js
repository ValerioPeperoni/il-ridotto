// Ping pong del Ridotto: due personaggi, palla con effetto vero, telefono come racchetta.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { T, mkBall, step, predict, solve, copy } from './ball.js';
import { makeCharacter, updateArms, randomLook, BOTS } from '../chars.js';
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
renderer.setPixelRatio(Math.min(devicePixelRatio, MOBILE ? 1.5 : 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0d1016); scene.fog = new THREE.Fog(0x0d1016, 9, 22);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 60);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new ShaderPass({ uniforms: { tDiffuse: { value: null } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); if (!(c.r == c.r) || !(c.g == c.g) || !(c.b == c.b)) c = vec4(0.0,0.0,0.0,1.0); gl_FragColor = vec4(clamp(c.rgb, 0.0, 60.0), 1.0); }' }));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.4, 0.5, 0.92));
composer.addPass(new OutputPass());
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); composer.setSize(w, h); camera.aspect = w / h; camera.fov = w < h ? 72 : 55; camera.updateProjectionMatrix(); }
addEventListener('resize', resize);
function ctex(w, h, draw, rep) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); } return t; }

// ---------- scena ----------
function buildHall() {
  const top = ctex(512, 920, (g, w, h) => {
    g.fillStyle = '#1d4f8f'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * .03})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    g.fillStyle = '#fff'; const b = 10; g.fillRect(0, 0, w, b); g.fillRect(0, h - b, w, b); g.fillRect(0, 0, b, h); g.fillRect(w - b, 0, b, h); g.fillRect(w / 2 - 2, 0, 4, h);
  });
  const table = new THREE.Mesh(new THREE.BoxGeometry(T.W, 0.03, T.L), [new THREE.MeshStandardMaterial({ color: 0x163a6a }), new THREE.MeshStandardMaterial({ color: 0x163a6a }), new THREE.MeshPhysicalMaterial({ map: top, roughness: 0.45, clearcoat: 0.3 }), new THREE.MeshStandardMaterial({ color: 0x0d2140 }), new THREE.MeshStandardMaterial({ color: 0x163a6a }), new THREE.MeshStandardMaterial({ color: 0x163a6a })]);
  table.position.y = T.H - 0.015; table.receiveShadow = true; table.castShadow = true; scene.add(table);
  const steel = new THREE.MeshStandardMaterial({ color: 0x2a2d33, metalness: 0.7, roughness: 0.35 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, T.H - 0.03, 10), steel); l.position.set(sx * (T.W / 2 - 0.12), (T.H - 0.03) / 2, sz * (T.L / 2 - 0.25)); l.castShadow = true; scene.add(l); }
  const netTex = ctex(256, 64, (g, w, h) => { g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(240,240,240,.7)'; g.lineWidth = 1; for (let x = 0; x < w; x += 6) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } for (let y = 0; y < h; y += 6) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } g.fillStyle = '#fff'; g.fillRect(0, 0, w, 7); }, [4, 1]);
  const net = new THREE.Mesh(new THREE.PlaneGeometry(T.W + 0.3, T.net), new THREE.MeshStandardMaterial({ map: netTex, transparent: true, side: THREE.DoubleSide, roughness: 0.9 }));
  net.position.set(0, T.H + T.net / 2, 0); scene.add(net);
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, T.net + 0.02, 8), steel); p.position.set(s * (T.W / 2 + 0.15), T.H + T.net / 2, 0); scene.add(p); }
  // pavimento da palestra, transenne, luci
  const floorT = ctex(1024, 1024, (g, w, h) => { for (let i = 0; i < 16; i++) { g.fillStyle = `hsl(18,${40 + Math.random() * 10}%,${30 + Math.random() * 6}%)`; g.fillRect(i * w / 16, 0, w / 16, h); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(i * w / 16, 0, 2, h); } for (let i = 0; i < 30; i++) { g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(Math.random() * w, Math.random() * h, w / 16, 2); } }, [3, 3]);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), new THREE.MeshPhysicalMaterial({ map: floorT, roughness: 0.4, clearcoat: 0.5 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const court = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 9.5), new THREE.MeshStandardMaterial({ color: 0x8a2a20, roughness: 0.7 })); court.rotation.x = -Math.PI / 2; court.position.y = 0.002; court.receiveShadow = true; scene.add(court);
  const barT = ctex(1024, 128, (g, w, h) => { g.fillStyle = '#10131a'; g.fillRect(0, 0, w, h); g.font = 'italic 700 72px Georgia, serif'; g.textBaseline = 'middle'; g.fillStyle = '#ff5a3d'; for (let x = 20; x < w; x += 520) g.fillText('Il Ridotto', x, h / 2 + 4); g.fillStyle = '#38e8ff'; g.font = '700 40px Arial'; g.fillText('PING PONG', 380, h / 2 + 4); });
  for (const [x, z, ry, len] of [[0, -4.75, 0, 5.6], [0, 4.75, Math.PI, 5.6], [-2.8, 0, Math.PI / 2, 9.5], [2.8, 0, -Math.PI / 2, 9.5]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(len, 0.6, 0.04), new THREE.MeshStandardMaterial({ map: barT.clone(), roughness: 0.6 })); b.material.map.wrapS = THREE.RepeatWrapping; b.material.map.repeat.set(len / 3, 1); b.material.map.needsUpdate = true;
    b.position.set(x, 0.3, z); b.rotation.y = ry; scene.add(b);
  }
  const wall = new THREE.MeshStandardMaterial({ color: 0x1a1e27, roughness: 0.9 });
  for (const [x, z, ry] of [[0, -10, 0], [0, 10, Math.PI], [-10, 0, Math.PI / 2], [10, 0, -Math.PI / 2]]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(20, 8), wall); w.position.set(x, 4, z); w.rotation.y = ry; scene.add(w); }
  // pubblico stilizzato sugli spalti
  const crowdG = new THREE.Group(); const bodyG = new THREE.CapsuleGeometry(0.18, 0.4, 4, 8), headG = new THREE.SphereGeometry(0.13, 10, 8);
  for (let i = 0; i < 70; i++) {
    const side = i % 2 ? 1 : -1, x = side * rnd(4.5, 7.5), z = rnd(-6, 6), y = (Math.abs(x) - 4.5) * 0.45;
    const c = new THREE.Color().setHSL(Math.random(), 0.5, 0.35);
    const b = new THREE.Mesh(bodyG, new THREE.MeshStandardMaterial({ color: c })); b.position.set(x, y + 0.45, z); crowdG.add(b);
    const h = new THREE.Mesh(headG, new THREE.MeshStandardMaterial({ color: 0xd9b08c })); h.position.set(x, y + 0.95, z); h.userData.b = rnd(0, 6); crowdG.add(h);
  }
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.2 + k * 0.45, 13), new THREE.MeshStandardMaterial({ color: 0x252a35 })); st.position.set(s * (4.7 + k * 0.7), (0.2 + k * 0.45) / 2, 0); scene.add(st); }
  scene.add(crowdG); G.crowd = crowdG;
  scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x302018, 0.6));
  for (const z of [-1.6, 1.6]) { const l = new THREE.SpotLight(0xffffff, 16, 10, 0.7, 0.6, 1.2); l.position.set(0, 5, z); l.target.position.set(0, 0.7, z * 0.4); l.castShadow = true; l.shadow.mapSize.set(MOBILE ? 1024 : 2048, MOBILE ? 1024 : 2048); l.shadow.bias = -0.0004; scene.add(l, l.target); }
  for (const x of [-3, 3]) { const l = new THREE.PointLight(0xffe0c0, 4, 12, 2); l.position.set(x, 4.5, 0); scene.add(l); }
}

// racchetta (impugnatura lungo -y locale, piatto in alto)
function makeRacket(color) {
  const g = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.1, 0.022), new THREE.MeshStandardMaterial({ color: 0x8a5a2a, roughness: 0.6 })); handle.position.y = -0.05; g.add(handle);
  const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.008, 32), [new THREE.MeshStandardMaterial({ color: 0xc8a070 }), new THREE.MeshStandardMaterial({ color, roughness: 0.6 }), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 })]);
  blade.rotation.x = Math.PI / 2; blade.scale.set(1, 1, 1.08); blade.position.y = 0.075; blade.castShadow = true; g.add(blade);
  return g;
}

// ---------- palla ----------
const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(T.r, 20, 14), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffa060, emissiveIntensity: 0.25, roughness: 0.4 }));
ballMesh.castShadow = true; scene.add(ballMesh);
const TRAIL = 18, trailGeo = new THREE.BufferGeometry(); trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL * 3), 3));
const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: 0xffd0a0, transparent: true, opacity: 0.55 })); trail.frustumCulled = false; scene.add(trail);
const trailPts = [];
const fireLight = new THREE.PointLight(0xff5a00, 3, 1.5, 2); fireLight.visible = false; scene.add(fireLight);
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

// personaggi
const avatars = [];
function setupAvatars() {
  for (const a of avatars) scene.remove(a.ch.group);
  avatars.length = 0;
  G.players.forEach((p, i) => {
    const ch = makeCharacter(p.look, { standing: true });
    ch.group.position.set(0.3 * (i ? -1 : 1), 0, sideZ(i) * (T.L / 2 + 0.55));
    ch.group.rotation.y = i === 0 ? 0 : Math.PI;
    ch.group.traverse(o => { if (o.isMesh) o.castShadow = true; });
    scene.add(ch.group);
    const racket = makeRacket(i === 0 ? 0xd8261c : 0x1c56d8); ch.arms[1].glove.add(racket); racket.rotation.set(-0.3, 0, -0.2); racket.position.set(0, 0.02, -0.02);
    avatars.push({ ch, racket, x: 0, swingT: -1, swingDir: 1 });
  });
}
function animateAvatars(dt) {
  avatars.forEach((a, i) => {
    const s = sideZ(i);
    // si sposta verso il punto dove colpirà
    let tx = 0.25;
    if (G.ideal && G.ideal.who === i) tx = G.ideal.x - 0.32 * (i === 0 ? 1 : -1);
    else if (G.serving && G.server === i) tx = 0.35 * (i === 0 ? 1 : -1);
    a.x += (clamp(tx, -1.2, 1.2) - a.x) * Math.min(1, dt * 5);
    a.ch.group.position.x = a.x; a.ch.group.position.z = s * (T.L / 2 + 0.55);
    const arm = a.ch.arms[1];
    if (a.swingT >= 0) {
      a.swingT += dt; const k = clamp(a.swingT / 0.32, 0, 1), e = Math.sin(k * Math.PI);
      const fx = a.swingDir;
      arm.hand.set(0.45 * fx - 0.75 * fx * k + 0.1, 0.95 + 0.25 * e * (a.up ?? 0.3), -0.25 - 0.35 * e);
      if (a.swingT > 0.4) a.swingT = -1;
    } else {
      const ready = G.phase === 'rally' || G.phase === 'serve';
      arm.hand.set(0.32, ready ? 0.98 : 0.8, ready ? -0.35 : -0.2);
    }
    const left = a.ch.arms[0]; left.hand.set(-0.28, 0.85 + (G.serving && G.server === i && G.toss ? 0.25 : 0), -0.3);
    updateArms(a.ch);
    a.ch.head.rotation.y = Math.sin(G.time * 0.7 + i) * 0.1;
  });
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
      p = { kind: 'phone', pid: m.pid, name: (m.name || 'Telefono').slice(0, 14), color: m.color, look: randomLook() };
      G.players = G.players.filter(x => x.kind !== 'cpu'); G.players.push(p);
    }
    p.conn = id; p.online = true; p.lat = 0.04;
    NET.send(id, { t: 'hi', name: p.name, color: p.color, game: 'pong' });
    renderLobby(); if (G.phase !== 'lobby') sendState();
    return;
  }
  const p = G.players.find(x => x.conn === id); if (!p) return;
  if (m.t === 'sync') { const rtt = (performance.now() - m.h) / 1000; if (rtt < 1) p.lat = p.lat * 0.7 + (rtt / 2) * 0.3; return; }
  if (m.t === 'sw') {
    const i = G.players.indexOf(p);
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
$('#addLocal').onclick = () => { ac(); if (G.players.filter(p => p.kind === 'local').length >= 1 || G.players.filter(p => p.kind !== 'cpu').length >= 2) return; const n = $('#localName').value.trim() || 'Giocatore'; G.players = G.players.filter(x => x.kind !== 'cpu'); G.players.unshift({ kind: 'local', name: n.slice(0, 14), look: randomLook() }); renderLobby(); };
$('#start').onclick = () => { ac(); startMatch(); };
$('#again').onclick = () => { $('#end').classList.add('hide'); startMatch(); };
$('#toLobby').onclick = () => { $('#end').classList.add('hide'); $('#hud').classList.add('hide'); $('#lobby').classList.remove('hide'); G.phase = 'lobby'; G.players = G.players.filter(p => p.kind !== 'cpu'); renderLobby(); sendState(); };
$('#menuBtn').onclick = () => { if (window.confirm('Tornare alla sala?')) $('#toLobby').onclick(); };

// ---------- partita ----------
function startMatch() {
  G.players = G.players.filter(p => p.kind !== 'cpu');
  if (G.players.length === 1) { const b = BOTS[Math.floor(Math.random() * BOTS.length)]; G.players.push({ kind: 'cpu', name: b.name, look: b.look }); }
  G.score = [0, 0]; G.server = Math.random() < 0.5 ? 0 : 1; G.serves = 0; G.charge = [0, 0]; G.fire = false; updateCharge();
  $('#lobby').classList.add('hide'); $('#hud').classList.remove('hide');
  $('#nA').textContent = G.players[0].name; $('#nB').textContent = G.players[1].name; $('#setInfo').textContent = 'a ' + G.target;
  setupAvatars(); updateScore();
  G.view = G.players.filter(p => p.kind !== 'cpu').length === 2 ? 'tv' : 'behind';
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
  tip(p.kind === 'cpu' ? `${p.name} batte` : p.kind === 'phone' ? `${p.name}: colpisci col telefono quando la palla scende` : 'Battuta: muovi il mouse veloce quando la palla scende (o premi spazio)');
  sendState();
  setTimeout(() => { if (G.phase === 'serve') toss(); }, 700);
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
  G.cpuSwing = { who: i, at: id.t + dt, sw: { p, vert, twist: rnd(-0.2, 0.2), aim } };
}
function swing(i, sw) {
  const a = avatars[i]; if (!a) return;
  if (a.swingT < 0 || a.swingT > 0.25) { a.swingT = 0; a.swingDir = sw.yaw ? Math.sign(sw.yaw) : 1; a.up = sw.vert; snd('swish', sw.p); }
  if (G.phase !== 'serve' && G.phase !== 'rally') return;
  const id = G.ideal; if (!id || id.who !== i) return;
  if (G.serving && !G.toss) { toss(); return; } // il primo gesto lancia la palla
  const W = (G.assist && G.players[i].kind !== 'cpu' ? 0.24 : 0.16) * (G.fire ? 0.6 : 1);
  const d = (sw.time ?? G.time) - id.t;
  if (Math.abs(d) > W) { if (G.players[i].kind !== 'cpu') shotTip(d < 0 ? 'Troppo presto!' : 'Troppo tardi!'); return; }
  G.pendingHit = { who: i, at: Math.max(G.time, id.t + d), d, W, sw };
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
    snd('table');
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
        if (G.pendingHit && G.time >= G.pendingHit.at) doHit(G.pendingHit);
        if (G.serving && G.toss && b.y < 0.75 && b.vy < 0 && G.phase === 'serve') { if (G.players[G.server].kind !== 'cpu') shotTip('Palla caduta: rilancio'); beginServe(); break; }
      }
      // palla ferma sul tavolo
      if (Math.hypot(b.vx, b.vy, b.vz) < 0.15 && G.phase === 'rally') { G.stillT += dt; if (G.stillT > 0.8) point(b.z > 0 ? 1 : 0, 'Palla morta'); } else G.stillT = 0;
      if (G.cpuSwing && G.time >= G.cpuSwing.at) { const c = G.cpuSwing; G.cpuSwing = null; swing(c.who, { ...c.sw, time: G.time, yaw: 1 }); }
    }
    ballMesh.position.set(b.x, b.y, b.z); ballMesh.visible = true;
    ballMesh.material.emissive.setHex(G.fire ? 0xff4400 : 0xffa060); ballMesh.material.emissiveIntensity = G.fire ? 2.2 : 0.25; trail.material.color.setHex(G.fire ? 0xff6a00 : 0xffd0a0);
    fireLight.visible = !!G.fire; fireLight.position.copy(ballMesh.position);
    trailPts.push(b.x, b.y, b.z); if (trailPts.length > TRAIL * 3) trailPts.splice(0, 3);
    const arr = trailGeo.attributes.position.array; for (let i = 0; i < TRAIL * 3; i++) arr[i] = trailPts[Math.min(i, trailPts.length - 1)] ?? 0;
    trailGeo.attributes.position.needsUpdate = true; trailGeo.setDrawRange(0, trailPts.length / 3);
  } else ballMesh.visible = false;
  animateAvatars(dt);
  if (G.crowd) G.crowd.children.forEach((h, k) => { if (h.userData.b != null) { const j = G.crowdJump && G.time - G.crowdJump < 1.2 ? Math.abs(Math.sin((G.time - G.crowdJump) * 9 + h.userData.b)) * 0.12 : 0; h.position.y = h.userData.y0 ?? (h.userData.y0 = h.position.y); h.position.y += j + Math.sin(G.time * 2 + h.userData.b) * 0.01; } });
  updateCamera(dt);
  composer.render();
}
function updateCamera(dt) {
  const b = G.ball;
  if (G.phase === 'lobby') { const t = G.time * 0.12; _p.set(Math.sin(t) * 4.2, 2.2, Math.cos(t) * 4.2); _l.set(0, 0.8, 0); }
  else if (G.view === 'tv') { _p.set(3.6, 2.4, (b ? b.z : 0) * 0.15); _l.set(0, 0.85, (b ? b.z : 0) * 0.25); }
  else { const ax = avatars[0] ? avatars[0].x : 0; _p.set(ax * 0.5 - 0.8, 1.9, T.L / 2 + 2.3); _l.set((b ? b.x : 0) * 0.2 - 0.15, 0.8, -0.7); }
  const k = 1 - Math.exp(-dt * 4); G.camPos.lerp(_p, k); G.camLook.lerp(_l, k);
  camera.position.copy(G.camPos); camera.lookAt(G.camLook);
}

renderLobby(); resize(); requestAnimationFrame(frame);
if (DEBUG) { window.__G = G; window.__swing = swing; window.__start = startMatch; }
if (Q.has('auto')) {
  // prova: due computer
  G.players = [{ kind: 'cpu', name: 'Il Dottore', look: BOTS[0].look }, { kind: 'cpu', name: 'Colombina', look: BOTS[1].look }];
  G.target = +(Q.get('pts') || 5);
  const orig = startMatch;
  G.players.forEach(p => p.kind = 'cpu');
  $('#lobby').classList.add('hide'); $('#hud').classList.remove('hide');
  G.score = [0, 0]; G.server = 0; G.serves = 0; $('#nA').textContent = G.players[0].name; $('#nB').textContent = G.players[1].name;
  setupAvatars(); updateScore(); G.view = Q.get('auto') === 'tv' ? 'tv' : 'behind'; setTimeout(beginServe, 500);
}
