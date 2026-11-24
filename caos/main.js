// Golf Caos: tutti giocano insieme sulla stessa isola. Corri alla tua palla, tira, raccogli oggetti, colpisci gli altri.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { HOLES, S, W, D, X0, Z0, WATER, heightAt, normalAt, surfAt, terrainMesh, GREEN_R, fairDist } from './course.js';
import { loadNature, trunks, wind } from './nature.js';
import { propZones, loadProps } from './props.js';
import * as FX from './fx.js';
import { makeFreeArm } from '../pong/arm.js';
import { buildWorld, ITEMS, boxGeo, boxMat, makeClub, makeRocket } from './world.js';
import { hostRoom, randomCode } from '../net.js';
import { savedProfile } from '../avatar/avatar.js';
import { loadSportLibrary as loadAvatarLibrary, makeSportsmate, randomSport as randomLook } from '../avatar/sport.js';

const Q = new URLSearchParams(location.search);
const DEBUG = Q.has('debug');
const MOBILE = matchMedia('(pointer:coarse)').matches, LITE = Q.has('lite'), SPEED = +(Q.get('speed') || 1);
// qualità grafica: bassa / media / alta (si sceglie nella sala, ricarica la pagina)
let GFX = Q.get('gfx') || (() => { try { return localStorage.getItem('ridotto-gfx'); } catch (e) { return null; } })() || (MOBILE ? 'bassa' : 'media');
const QL = { bassa: { pr: 1, shadow: 0, bloom: false, plants: 0.35, trees: 0.55, step: 2 }, media: { pr: 1.25, shadow: 1024, bloom: false, plants: 0.65, trees: 0.85, step: 1.5 }, alta: { pr: 1.6, shadow: 2048, bloom: true, plants: 1, trees: 1, step: 1.25 } }[GFX] || { pr: 1.25, shadow: 1024, bloom: false, plants: 0.65, trees: 0.85, step: 1.5 };
const $ = s => document.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const COLORS = ['#3d7bff', '#ff5c9a', '#ffb02e', '#2ec27e', '#9a5cff', '#ff6a3d', '#20c4d8', '#e8e8e8'];
const BALL_R = 0.11, CUP_R = 0.32, AV_H = 2.0;

// ---------- motore grafico ----------
const renderer = new THREE.WebGLRenderer({ canvas: $('#gl'), antialias: !MOBILE, powerPreference: 'high-performance' });
let PR = Math.min(devicePixelRatio, QL.pr); renderer.setPixelRatio(PR);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = !LITE && QL.shadow > 0; if (LITE) renderer.setPixelRatio(PR = 0.5); renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const FOG = new THREE.Color(0xa9cbee); scene.background = FOG; scene.fog = new THREE.Fog(FOG, 160, 560);
const camera = new THREE.PerspectiveCamera(50, 1, 0.3, 900);
let composer = null;
if (QL.bloom && !LITE) { composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera)); composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.25, 0.4, 1.0)); composer.addPass(new OutputPass()); }
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); composer && composer.setSize(w, h); camera.aspect = w / h; camera.fov = w < h ? 68 : 50; camera.updateProjectionMatrix(); }
addEventListener('resize', resize);
FX.initFx(scene);

const W_ = buildWorld(scene, QL); const { sky, sun, hemi, placeSun, water, waterNormal, terrain, flags, SUN_DIR } = W_;

// ---------- casse degli oggetti ----------
let boxes = [];
function placeBoxes(hole) {
  for (const b of boxes) scene.remove(b.m); boxes = [];
  const pts = [];
  for (let k = 0; k < 7; k++) {
    const t = (k + 0.5) / 7, a = t < 0.5 ? hole.tee : hole.mid, b = t < 0.5 ? hole.mid : hole.green, u = t < 0.5 ? t * 2 : t * 2 - 1;
    const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz), side = (k % 2 ? 1 : -1) * (3 + (k * 37 % 7));
    let x = a[0] + dx * u + (-dz / l) * side, z = a[1] + dz * u + (dx / l) * side;
    if (surfAt(x, z) === S.WATER || Math.hypot(x - hole.green[0], z - hole.green[1]) < GREEN_R) { x = a[0] + dx * u; z = a[1] + dz * u; }
    if (surfAt(x, z) === S.WATER) continue;
    pts.push([x, z]);
  }
  for (const [x, z] of pts) { const m = new THREE.Mesh(boxGeo, boxMat); m.castShadow = true; m.position.set(x, heightAt(x, z) + 1.1, z); scene.add(m); boxes.push({ m, x, z, t: 0, gone: 0 }); }
}
function randomItem(p) { const list = Object.entries(ITEMS).filter(([k]) => !(p && p.done && ITEMS[k].own)); const tot = list.reduce((a, b) => a + b[1].w, 0); let r = Math.random() * tot; for (const [k, v] of list) { r -= v.w; if (r <= 0) return k; } return 'bomba'; }

// ---------- stato ----------
const G = { phase: 'loading', players: [], hole: 0, nHoles: 6, time: 0, finishOrder: [], clock: 0, mines: [], missiles: [], bombs: [], bananas: [], shake: 0, intro: 0 };
const camPos = new THREE.Vector3(0, 60, 120), camLook = new THREE.Vector3(), camShake = new THREE.Vector3();
const shake = k => { G.shake = Math.max(G.shake, k); };

function newPlayer(o) {
  return Object.assign({ kind: 'local', name: 'Giocatore', color: COLORS[G.players.length % COLORS.length], look: randomLook(), score: 0, kos: 0, input: { x: 0, y: 0, btn: false, item: false, aim: 0 } }, o);
}
function ensureAvatar(p) {
  if (p.av) return;
  p.av = makeSportsmate(p.sport || p.look, { height: AV_H }); p.baseScale = p.av.root.scale.x; p.spRest = ['spine_01', 'spine_02', 'spine_03', 'neck_01'].map(n => [p.av.bones[n], p.av.bones[n].quaternion.clone()]); p.larm = null;
  { const play = p.av.play; p.clipN = 0; p.av.play = (n, o) => { p.clip = n; p.clipN++; return play(n, o); }; }
  p.av.root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  const hand = p.av.bones.hand_r;
  p.club = makeClub(p.color); hand.add(p.club); p.club.rotation.set(Math.PI, 0, 0); p.club.position.set(0, 0.08, 0); p.club.scale.setScalar(1.8 / AV_H);
  scene.add(p.av.root);
  // palla
  p.ballMesh = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 20, 14), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 }));
  p.ballMesh.castShadow = true; scene.add(p.ballMesh);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.36, 24), new THREE.MeshBasicMaterial({ color: p.color, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; scene.add(ring); p.ballRing = ring;
  // segnalino alto sopra la palla, visibile da lontano
  const pin = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 12), new THREE.MeshBasicMaterial({ color: p.color })); pin.rotation.x = Math.PI; scene.add(pin); p.ballPin = pin;
  // anteprima della traiettoria
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(60 * 3), 3));
  p.aimDots = new THREE.Points(pg, new THREE.PointsMaterial({ color: p.color, size: 0.35, map: dotSprite, alphaTest: 0.4, transparent: true, depthWrite: false }));
  p.aimDots.frustumCulled = false; scene.add(p.aimDots);
  // etichetta HTML
  const tag = document.createElement('div'); tag.className = 'tagp'; tag.style.setProperty('--c', p.color);
  tag.innerHTML = `<div class="st"></div><span class="n">${esc(p.name)}</span><span class="it"></span><div class="pw"><b></b></div>`;
  $('#tags').appendChild(tag); p.tag = tag;
}
const dotSprite = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.beginPath(); g.arc(16, 16, 13, 0, 7); g.fill(); return new THREE.CanvasTexture(c); })();
function disposePlayer(p) { if (p.av) { p.av.dispose(); scene.remove(p.ballMesh, p.ballRing, p.ballPin, p.aimDots); p.tag.remove(); p.av = null; } }

// ---------- palla: fisica ----------
const SURF_K = { // rimbalzo, attrito al rimbalzo, resistenza al rotolamento (m/s²)
  [S.GREEN]: [0.22, 0.85, 0.65], [S.FRINGE]: [0.25, 0.8, 1.3], [S.FAIR]: [0.32, 0.78, 1.5], [S.TEE]: [0.32, 0.78, 1.5],
  [S.ROUGH]: [0.18, 0.55, 3.6], [S.SAND]: [0.03, 0.25, 7.5], [S.WATER]: [0, 0, 9], [S.OUT]: [0.2, 0.5, 4],
};
const _n = new THREE.Vector3(), _t = new THREE.Vector3();
function ballStep(b, dt, ev, opts = {}) {
  const v = b.vel, p = b.pos;
  v.y -= 9.8 * dt;
  if (b.air) v.multiplyScalar(1 - 0.05 * dt);
  if (opts.magnet) { const dx = opts.magnet.x - p.x, dz = opts.magnet.z - p.z, d = Math.hypot(dx, dz); if (d < 14 && d > 0.05) { v.x += dx / d * 5 * dt; v.z += dz / d * 5 * dt; } }
  p.addScaledVector(v, dt);
  const h = heightAt(p.x, p.z), s = surfAt(p.x, p.z);
  if (p.y - BALL_R <= h) {
    normalAt(p.x, p.z, _n); p.y = h + BALL_R;
    const K = SURF_K[s] || SURF_K[S.ROUGH];
    const vn = v.dot(_n);
    if (vn < 0) {
      if (-vn > 1.2) { v.addScaledVector(_n, -vn * (1 + K[0])); _t.copy(v).addScaledVector(_n, -v.dot(_n)); v.addScaledVector(_t, -(1 - K[1])); ev && ev.push({ t: 'bounce', v: -vn, s }); }
      else v.addScaledVector(_n, -vn);
    }
    b.air = v.dot(_n) > 0.8;
    if (!b.air) {
      // rotolamento: resistenza (le pendenze le fa già la gravità)
      const sp = Math.hypot(v.x, v.y, v.z), dec = K[2] * dt;
      if (sp <= dec) v.set(0, 0, 0); else v.multiplyScalar((sp - dec) / sp);
    }
    if (s === S.WATER && h < WATER - 0.05) { ev && ev.push({ t: 'water' }); b.inWater = true; }
  } else b.air = true;
  // tronchi e rocce
  if (!opts.ghost) for (const tr of trunksNear(p.x, p.z)) {
    const dx = p.x - tr.x, dz = p.z - tr.z, d = Math.hypot(dx, dz), r = tr.r + BALL_R;
    if (d < r && p.y < heightAt(tr.x, tr.z) + tr.h && d > 1e-4) {
      const nx = dx / d, nz = dz / d; p.x = tr.x + nx * r; p.z = tr.z + nz * r;
      const vn = v.x * nx + v.z * nz; if (vn < 0) { v.x -= 1.6 * vn * nx; v.z -= 1.6 * vn * nz; v.multiplyScalar(0.6); ev && ev.push({ t: 'tree', v: -vn }); }
    }
  }
  if (p.x < X0 + 2 || p.x > X0 + W - 2 || p.z < Z0 + 2 || p.z > Z0 + D - 2 || p.y < -6) { b.inWater = true; ev && ev.push({ t: 'water' }); }
}
// griglia spaziale per i tronchi
const TG = new Map(); let tgReady = false;
function trunksNear(x, z) {
  if (!tgReady) { for (const t of trunks) { const k = Math.floor(t.x / 8) + ',' + Math.floor(t.z / 8); if (!TG.has(k)) TG.set(k, []); TG.get(k).push(t); } tgReady = true; }
  const out = [], cx = Math.floor(x / 8), cz = Math.floor(z / 8);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const l = TG.get((cx + i) + ',' + (cz + j)); if (l) out.push(...l); }
  return out;
}
function cupOf(h) { return { x: h.green[0] + h.cup[0], z: h.green[1] + h.cup[1], y: h.cupY }; }
function onGreen(p) { const s = surfAt(p.x, p.z); return s === S.GREEN || s === S.FRINGE; }
// velocità iniziale del tiro
function shotVel(p, power, yaw) {
  const b = p.ball, putt = onGreen(b.pos), s = surfAt(b.pos.x, b.pos.z);
  let sp, loft;
  if (putt) { sp = 0.8 + power * 12; loft = 0.02; }
  else { sp = 7 + power * 25; loft = 0.56; if (s === S.SAND) sp *= 0.72; else if (s === S.ROUGH) sp *= 0.88; }
  if (p.superShot && !putt) sp *= 1.4;
  return new THREE.Vector3(Math.sin(yaw) * Math.cos(loft) * sp, Math.sin(loft) * sp, Math.cos(yaw) * Math.cos(loft) * sp);
}
// simulazione rapida (anteprima e computer)
function simulate(p, power, yaw, maxT = 7, untilLand = false, out = null) {
  const b = { pos: p.ball.pos.clone(), vel: shotVel(p, power, yaw), air: true };
  const dt = 1 / 60; let t = 0, k = 0, landed = false;
  const hole = HOLES[G.hole], cup = cupOf(hole);
  while (t < maxT) {
    ballStep(b, dt, null, { ghost: p.superShot });
    t += dt;
    if (out && k < 60 && Math.floor(t * 60) % 3 === 0) { out.setXYZ(k++, b.pos.x, b.pos.y, b.pos.z); }
    if (b.inWater) return { pos: b.pos, water: true, t, k };
    if (!b.air && !landed) { landed = true; if (untilLand) break; }
    if (Math.hypot(b.pos.x - cup.x, b.pos.z - cup.z) < CUP_R && b.vel.length() < 6) return { pos: b.pos, cup: true, t, k };
    if (!b.air && b.vel.lengthSq() < 0.01) break;
  }
  return { pos: b.pos, t, k };
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
    onError(t) { $('#net').textContent = 'Telefoni non disponibili (' + t + '): gioca qui con tastiera e mouse'; },
  });
} catch (e) { $('#net').textContent = 'Telefoni non disponibili'; }
function send(p, m) { if (p.kind === 'phone' && p.conn && NET) NET.send(p.conn, m); }
function onPhone(id, m) {
  if (m.t === 'ping') return;
  if (m.t === 'join') {
    let p = G.players.find(x => x.pid && x.pid === m.pid);
    if (!p) {
      if (G.phase !== 'lobby') { NET.send(id, { t: 'full', text: 'Partita in corso: aspetta la prossima' }); return; }
      if (G.players.length >= 8) { NET.send(id, { t: 'full', text: 'Sala piena' }); return; }
      p = newPlayer({ kind: 'phone', pid: m.pid, name: (m.name || 'Telefono').slice(0, 14), sport: m.sport || randomLook() });
      if (m.color) p.color = m.color;
      G.players.push(p);
    }
    p.conn = id; p.online = true; if (m.sport) p.sport = m.sport; p.wantView = !!m.wantView; p.viewSent = 0;
    NET.send(id, { t: 'hi', name: p.name, color: p.color, game: 'caos' });
    renderLobby(); sendState(p);
    return;
  }
  const p = G.players.find(x => x.conn === id); if (!p) return;
  if (m.t === 'joy') { p.input.x = clamp(+m.x || 0, -1, 1); p.input.y = clamp(+m.y || 0, -1, 1); p.input.cy = m.cy != null ? +m.cy : null; }
  else if (m.t === 'btn') { p.input.btn = !!m.on; if (m.on) p.input.press = true; }
  else if (m.t === 'turn') { p.input.aim += clamp(+m.d || 0, -1, 1); }
  else if (m.t === 'sling') { p.input.sling = m.on ? { dx: clamp(+m.dx || 0, -1.5, 1.5), pow: clamp(+m.pow || 0, 0, 1) } : null; }
  else if (m.t === 'use') { p.input.item = true; }
}
// ---------- visuale sui telefoni: il PC manda lo stato del mondo ~15 volte al secondo ----------
const r2 = v => Math.round(v * 100) / 100;
let viewT = 0;
function sendViews(dt) {
  viewT += dt; if (viewT < 1 / 20) return; viewT = 0;
  const viewers = G.players.filter(p => p.kind === 'phone' && p.wantView && p.online !== false);
  if (!viewers.length || !['intro', 'play', 'results', 'over'].includes(G.phase)) return;
  const ready = G.players.filter(p => p.pos && p.ball);
  const P = ready.map(p => [r2(p.pos.x), r2(p.pos.y), r2(p.pos.z), r2(p.yaw), p.clip || 'Idle', p.clipN || 0, r2(p.ball.pos.x), r2(p.ball.pos.y), r2(p.ball.pos.z),
    (p.done ? 1 : 0) | (p.frozen > 0 ? 2 : 0) | (p.ko > 0 ? 4 : 0) | (p.ball.moving ? 8 : 0) | ((p.state === 'addr' || p.state === 'charge') ? 16 : 0) | (p.state === 'charge' ? 32 : 0) | (p.superShot ? 64 : 0) | (p.giant > 0 ? 128 : 0),
    r2(p.aimYaw || 0), r2(p.charge || 0), r2(p.landX || 0), r2(p.landZ || 0), p.item ? ITEMS[p.item].icon : '']);
  const snap = { t: 'cv', ph: G.phase, h: G.hole, P, B: boxes.map(b => b.gone ? 0 : 1),
    M: G.missiles.map(m => [r2(m.m.position.x), r2(m.m.position.y), r2(m.m.position.z)]), Bo: G.bombs.map(m => [r2(m.m.position.x), r2(m.m.position.y), r2(m.m.position.z)]), Mi: G.mines.map(m => [r2(m.x), r2(m.z)]) };
  for (const v of viewers) {
    if (v.viewSent !== G.viewSeq) { // all'inizio di ogni buca: nomi, look, casse
      v.viewSent = G.viewSeq;
      send(v, { t: 'cvl', h: G.hole, me: ready.indexOf(v), players: ready.map(p => ({ name: p.name, color: p.color, look: p.sport || p.look })), boxes: boxes.map(b => [r2(b.x), r2(b.z)]) });
    }
    snap.me = ready.indexOf(v); send(v, snap);
  }
}
function viewFx(m) { for (const v of G.players) if (v.kind === 'phone' && v.wantView) send(v, { t: 'cfx', ...m }); }
function sendState(p) {
  if (p.kind !== 'phone') return;
  const st = { t: 'caos', phase: G.phase, state: p.frozen > 0 ? 'frozen' : p.ko > 0 ? 'ko' : (p.state || 'wait'), item: p.item ? ITEMS[p.item].icon + ' ' + ITEMS[p.item].name : '', hole: G.hole + 1, strokes: p.strokes || 0, score: p.score, color: p.color, near: !!p.nearBall };
  const key = JSON.stringify(st); if (key === p.lastSent) return; p.lastSent = key; send(p, st);
}

// ---------- lobby ----------
function renderLobby() {
  const qr = qrcode(0, 'M'); qr.addData(ctrlUrl()); qr.make(); $('#qr').innerHTML = qr.createSvgTag({ cellSize: 5, margin: 1, scalable: true });
  $('#code').textContent = CODE; $('#url').textContent = ctrlUrl().replace(/^https?:\/\//, '');
  $('#plist').innerHTML = G.players.length ? G.players.map((p, i) => `<div class="pp"><i style="background:${p.color}"></i><b>${esc(p.name)}</b><small>${p.kind === 'phone' ? (p.online ? '📱 telefono' : '📱 scollegato') : p.kind === 'bot' ? '🤖 computer' : '⌨️ qui'}</small><button data-del="${i}">✕</button></div>`).join('') : '<p class="note">Nessuno ancora: entra col telefono o aggiungi un giocatore qui.</p>';
  $('#start').disabled = !G.players.length;
}
const BOT_NAMES = ['Mazzolino', 'Contessa', 'Er Buca', 'Nonna Pina', 'Birdie', 'Sciabolone', 'Tuono'];
document.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || $('#lobby').classList.contains('hide')) return;
  if (b.dataset.del != null) { const p = G.players[+b.dataset.del]; send(p, { t: 'kicked' }); disposePlayer(p); G.players.splice(+b.dataset.del, 1); renderLobby(); }
  if (b.dataset.q) { try { localStorage.setItem('ridotto-gfx', b.dataset.q); } catch (e2) { } location.reload(); return; }
  if (b.dataset.h) { G.nHoles = +b.dataset.h; document.querySelectorAll('#nholes .chip').forEach(x => x.classList.toggle('sel', x === b)); }
});
$('#addLocal').onclick = () => { if (G.players.some(p => p.kind === 'local')) return; const pr = savedProfile(); const n = $('#localName').value.trim() || (pr && pr.name) || 'Giocatore'; G.players.push(newPlayer({ kind: 'local', name: n.slice(0, 14), sport: pr && pr.sport ? pr.sport : randomLook() })); FX.audio(); renderLobby(); };
$('#addBot').onclick = () => { const used = G.players.map(p => p.name); const n = BOT_NAMES.find(x => !used.includes(x)) || 'Computer'; G.players.push(newPlayer({ kind: 'bot', name: n })); renderLobby(); };
$('#start').onclick = () => { FX.audio(); startGame(); };
$('#again').onclick = () => { $('#end').classList.add('hide'); startGame(); };
$('#toLobby').onclick = () => { $('#end').classList.add('hide'); $('#hud').classList.add('hide'); $('#lobby').classList.remove('hide'); G.phase = 'lobby'; for (const p of G.players) { if (p.av) p.av.root.visible = false; sendState(p); } };
$('#menuBtn').onclick = () => { if (G.phase === 'lobby' || confirm('Tornare alla sala? La partita si chiude.')) $('#toLobby').onclick(); };

// ---------- partita ----------
function startGame() {
  G.hole = 0; for (const p of G.players) { p.score = 0; p.kos = 0; p.totalStrokes = 0; ensureAvatar(p); p.av.root.visible = true; }
  $('#lobby').classList.add('hide'); $('#hud').classList.remove('hide'); $('#legend').classList.toggle('hide', !G.players.some(p => p.kind === 'local'));
  startHole();
}
function startHole() {
  const h = HOLES[G.hole];
  G.finishOrder = []; G.clock = 0; G.phase = 'intro'; G.intro = 0; G.holeT = 0;
  for (const m of G.mines) scene.remove(m.m); G.mines = [];
  for (const x of G.missiles) scene.remove(x.m); G.missiles = [];
  for (const x of G.bombs) scene.remove(x.m); G.bombs = [];
  for (const x of G.bananas) scene.remove(x.m); G.bananas = [];
  placeBoxes(h); G.viewSeq = (G.viewSeq || 0) + 1;
  flags.forEach((f, i) => { f.userData.beam.visible = i === G.hole; });
  const dx = h.mid[0] - h.tee[0], dz = h.mid[1] - h.tee[1], l = Math.hypot(dx, dz), yaw = Math.atan2(dx, dz);
  G.players.forEach((p, i) => {
    const n = G.players.length, off = (i - (n - 1) / 2) * 1.3;
    const bx = h.tee[0] + (-dz / l) * off, bz = h.tee[1] + (dx / l) * off;
    p.ball = { pos: new THREE.Vector3(bx, heightAt(bx, bz) + BALL_R, bz), vel: new THREE.Vector3(), air: false, moving: false, last: null, inWater: false };
    p.ball.last = p.ball.pos.clone();
    p.pos = new THREE.Vector3(bx - Math.sin(yaw) * 1.2 - Math.cos(yaw) * 0.6, 0, bz - Math.cos(yaw) * 1.2 + Math.sin(yaw) * 0.6); p.pos.y = heightAt(p.pos.x, p.pos.z);
    p.vel = new THREE.Vector3(); p.yaw = yaw; p.aimYaw = yaw; p.state = 'walk'; p.strokes = 0; p.done = false; p.item = null; p.ko = 0; p.frozen = 0; p.charge = 0; p.chargeT = 0; p.superShot = false; p.magnet = 0; p.swipeCd = 0; p.fly = null; p.giant = 0; p.pendingShot = null; p.golfAct = null; if (p.baseScale) p.av.root.scale.setScalar(p.baseScale);
    p.av.root.visible = true; p.ballMesh.visible = true; p.ballRing.visible = true; p.ballPin.visible = true;
    p.av.play('Idle', { fade: 0.1 }); p.anim = 'Idle';
    unfreeze(p);
  });
  $('#holeT').textContent = `Buca ${G.hole + 1} di ${G.nHoles}`; $('#holeS').textContent = `Par ${h.par} · ${Math.round(Math.hypot(h.green[0] - h.tee[0], h.green[1] - h.tee[1]))} m`;
  big(`Buca ${G.hole + 1}`, 'y', 2200);
  tip('Tutti insieme: il primo in buca prende più punti!');
  renderBoard();
}
function nextHole() {
  G.hole++;
  if (G.hole >= G.nHoles) return endGame();
  startHole();
}
function endGame() {
  G.phase = 'over';
  const rank = [...G.players].sort((a, b) => b.score - a.score || a.totalStrokes - b.totalStrokes);
  $('#final').innerHTML = `<div class="w">${esc(rank[0].name)} vince!</div>` + rank.map((p, i) => `<div>${['🥇', '🥈', '🥉'][i] || (i + 1) + '.'} ${esc(p.name)} — <b>${p.score} punti</b> <small>(${p.totalStrokes} colpi, ${p.kos} mazzate)</small></div>`).join('');
  $('#end').classList.remove('hide'); FX.sound('fanfare');
  const w = rank[0]; w.av.play('Cheer');
  for (const p of G.players) send(p, { t: 'end', text: `${rank[0].name} vince`, score: p.score });
}
function playerSunk(p) {
  p.done = true; p.state = 'done'; G.finishOrder.push(p);
  const pts = [6, 4, 3, 2, 1, 1, 1, 1][G.finishOrder.length - 1];
  const h = HOLES[G.hole], bonus = Math.max(0, h.par - p.strokes + 1);
  p.score += pts + bonus; p.totalStrokes += p.strokes;
  const names = { 1: 'Buca in uno!', [h.par - 2]: 'Eagle!', [h.par - 1]: 'Birdie!', [h.par]: 'Par' };
  big(p.strokes === 1 ? 'BUCA IN UNO!' : `${p.name} in buca!`, 'y', 2000);
  tip(`${p.name}: ${p.strokes} colpi${names[p.strokes] ? ' · ' + names[p.strokes] : ''} · +${pts + bonus} punti`);
  const c = cupOf(h); FX.confetti(new THREE.Vector3(c.x, c.y + 0.5, c.z)); FX.sound('cup'); viewFx({ k: 'cup', x: r2(c.x), y: r2(c.y + 0.5), z: r2(c.z), who: p.name });
  p.av.play('Cheer', { fade: 0.2 }); p.anim = 'Cheer'; if (p.av.mood) p.av.mood('happy', 4);
  p.ballMesh.visible = false; p.ballRing.visible = false; p.ballPin.visible = false;
  if (G.finishOrder.length === 1 && G.players.length > 1) G.clock = 30;
  renderBoard();
}
function giveUp(p) { if (p.done) return; p.done = true; p.state = 'done'; p.totalStrokes += p.strokes + 2; p.ballMesh.visible = p.ballRing.visible = p.ballPin.visible = false; }
function renderBoard() {
  const list = [...G.players].sort((a, b) => b.score - a.score);
  $('#board').innerHTML = list.map(p => `<div class="r${p.done ? ' done' : ''}"><i style="background:${p.color}"></i><b>${esc(p.name)}</b><small>${p.done ? '⛳ ' : ''}${p.strokes || 0} colpi</small><em>${p.score}</em></div>`).join('');
}

// ---------- comandi: tastiera e mouse ----------
const keys = {};
addEventListener('keydown', e => { keys[e.code] = true; if (e.code === 'Space') e.preventDefault(); const lp = localP(); if (lp && (e.code === 'KeyE' || e.code === 'ShiftLeft')) lp.input.item = true; });
addEventListener('keyup', e => { keys[e.code] = false; });
let mouseBtn = false, lastMX = null;
const canvas = $('#gl');
let mDrag = null;
canvas.addEventListener('pointerdown', e => {
  FX.audio(); const lp = localP();
  if (e.button === 2) { if (lp) lp.input.item = true; return; }
  if (lp && lp.state === 'addr') { mDrag = { x: e.clientX, y: e.clientY }; return; } // fionda col mouse
  mouseBtn = true;
});
addEventListener('pointerup', e => { if (e.button === 2) return; mouseBtn = false; if (mDrag) { mDrag = null; const lp = localP(); if (lp) lp.input.sling = null; } });
addEventListener('pointermove', e => {
  if (!mDrag) return; const lp = localP(); if (!lp) return;
  const dx = e.clientX - mDrag.x, dy = e.clientY - mDrag.y, l = Math.hypot(dx, dy);
  if (l < 8) { lp.input.sling = { world: true, yaw: lp.aimYaw, pow: 0 }; return; }
  camAxes(); // tiri dalla parte opposta a dove trascini (come una fionda)
  const wx = -(_r.x * dx) + _f.x * dy, wz = -(_r.z * dx) + _f.z * dy;
  lp.input.sling = { world: true, yaw: Math.atan2(wx, wz), pow: clamp(l / (Math.min(innerHeight, innerWidth) * 0.35), 0, 1) };
});
canvas.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('pointermove', e => { if (lastMX != null && !mDrag) { const lp = localP(); if (lp && lp.state === 'addr' && e.buttons) lp.input.aim += (e.clientX - lastMX) * 0.004; } lastMX = e.clientX; });
function localP() { return G.players.find(p => p.kind === 'local'); }
function readLocal(p, dt) {
  const f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0), r = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  p.input.x = r; p.input.y = f; p.input.btn = mouseBtn || !!keys.Space;
}

// ---------- logica dei giocatori ----------
const _f = new THREE.Vector3(), _r = new THREE.Vector3();
function camAxes() { camera.getWorldDirection(_f); _f.y = 0; _f.normalize(); _r.set(-_f.z, 0, _f.x); }
function updatePlayer(p, dt) {
  if (p.kind === 'local') readLocal(p, dt);
  if (p.kind === 'bot') botThink(p, dt);
  const inp = p.input, b = p.ball, h = HOLES[G.hole];
  p.swipeCd = Math.max(0, p.swipeCd - dt);
  // volo dopo un'esplosione / mazzata
  if (p.fly) {
    p.fly.v.y -= 20 * dt; p.pos.addScaledVector(p.fly.v, dt);
    if (p.tumble) p.tumble.ang += p.tumble.rate * dt;
    const gh = groundUnder(p); if (p.pos.y <= gh && p.fly.v.y < 0) { p.pos.y = gh; p.fly = null; landKO(p); }
  }
  if (p.tumble && !p.fly) { // dopo l'atterraggio la capriola si chiude dolcemente
    const tgt = Math.round(p.tumble.ang / (2 * Math.PI)) * 2 * Math.PI; p.tumble.ang += (tgt - p.tumble.ang) * Math.min(1, dt * 14);
    if (Math.abs(tgt - p.tumble.ang) < 0.01) p.tumble = null;
  }
  if (p.squash > 0) p.squash = Math.max(0, p.squash - dt * 3.2);
  if (p.ko > 0) {
    p.ko -= dt;
    if (!p.fly && p.koGetUp && p.ko <= p.koGetUp.t) { const a = p.av.play('LayToIdle', { once: true, fade: 0.15 }); if (a) a.timeScale = a.getClip().duration / Math.max(0.5, p.koGetUp.t) * 0.9; p.koGetUp = null; }
    if (p.ko <= 0) { p.av.play('Idle', { fade: 0.3 }); p.anim = 'Idle'; p.state = p.done ? 'done' : 'walk'; p.immune = G.time + 2.5; p.av.mood('open', 0); }
  }
  if (p.stars) { const on = p.ko > 0 && !p.fly; p.stars.visible = on; if (on) { p.stars.rotation.y += dt * 5; const hb = p.av.bones && p.av.bones.Head; if (hb) { hb.getWorldPosition(p.stars.position); p.stars.position.y += 0.42 * p.baseScale / 1.11; } else p.stars.position.copy(p.pos).y += 2.1; } }
  // appena rialzato si è intoccabili per un attimo (si vede lampeggiare): niente mazzate a catena
  if (p.av) { const imm = (p.immune || 0) > G.time && p.ko <= 0; p.av.root.visible = !imm || Math.floor(G.time * 10) % 2 === 0; }
  if (p.giant > 0) { p.giant -= dt; const k = p.giant > 0 ? Math.min(2.2, p.av.root.scale.x / p.baseScale + dt * 4) : 1; p.av.root.scale.setScalar(p.baseScale * Math.max(1, k)); if (p.giant <= 0) p.av.root.scale.setScalar(p.baseScale); }
  if (p.frozen > 0) { p.frozen -= dt; if (p.frozen <= 0) unfreeze(p); }
  if (p.pendingShot && G.time >= p.pendingShot.at) fireShot(p);
  if (p.state === 'swing' && G.time > (p.swingEnd || 0) && !p.pendingShot) p.state = 'walk';
  const stunned = p.ko > 0 || p.frozen > 0 || p.fly;
  // oggetto
  if (inp.item) { inp.item = false; if (p.item && !stunned && G.phase === 'play') useItem(p); }
  if (G.phase !== 'play') { inp.btn = false; }
  // vicino alla palla?
  const dBall = Math.hypot(p.pos.x - b.pos.x, p.pos.z - b.pos.z);
  p.nearBall = !p.done && !b.moving && dBall < 1.9;
  const moveIn = Math.hypot(inp.x, inp.y) > 0.25;
  if (p.state === 'addr' || p.state === 'charge') {
    if (!p.nearBall || stunned) p.state = 'walk';
    else if (p.state === 'addr' && Math.abs(inp.y) > 0.7 && !inp.btn) p.state = 'walk';
  }
  if (p.state === 'walk' && p.nearBall && !stunned && G.phase === 'play' && ((!moveIn || dBall < 1.2) && p.idleT > 0.15 || inp.sling)) {
    p.state = 'addr'; const c = cupOf(h); p.aimYaw = autoAim(p); inp.aim = 0;
  }
  if (p.state === 'addr' || p.state === 'charge') {
    // mira: joystick/AD ruotano, il mouse pure
    const turnBy = inp.x * Math.abs(inp.x) * 1.3 * dt + inp.aim; inp.aim = 0;
    p.aimYaw -= turnBy; if (p.slingOn) p.slingBase -= turnBy;
    // posizione di tiro accanto alla palla
    const tx = b.pos.x - Math.cos(p.aimYaw) * 0.75 - Math.sin(p.aimYaw) * 0.15, tz = b.pos.z + Math.sin(p.aimYaw) * 0.75 - Math.cos(p.aimYaw) * 0.15;
    p.pos.x += (tx - p.pos.x) * Math.min(1, dt * 10); p.pos.z += (tz - p.pos.z) * Math.min(1, dt * 10);
    p.yaw = lerpAngle(p.yaw, p.aimYaw + Math.PI / 2, Math.min(1, dt * 10));
    // fionda: trascini indietro, la direzione è la mira e la lunghezza la potenza; lasci e tiri
    if (inp.sling) {
      if (!p.slingOn) { p.slingOn = true; p.slingBase = p.aimYaw; p.state = 'charge'; p.slingMode = true; }
      if (inp.sling.world) p.aimYaw = inp.sling.yaw; else p.aimYaw = p.slingBase - inp.sling.dx * 1.1;
      p.charge = clamp(inp.sling.pow, 0, 1);
    } else if (p.slingOn) {
      p.slingOn = false; p.slingMode = false;
      if (p.charge > 0.04) shoot(p); else { p.state = 'addr'; p.charge = 0; }
    }
    if (p.state === 'addr' && inp.btn && (!p.btnWas || inp.press)) { p.state = 'charge'; p.chargeT = 0; }
    if (p.state === 'charge' && !p.slingMode) {
      p.chargeT += dt; p.charge = 1 - Math.abs(1 - (p.chargeT / 1.1) % 2); // va su e giù
      if (!inp.btn) shoot(p);
    }
    golfPose(p);
  } else if (p.state === 'swing') {
    // durante lo swing si resta fermi
  } else if (!stunned && !p.done || (p.done && !stunned)) {
    // corsa
    if (inp.cy != null) { _f.set(Math.sin(inp.cy), 0, Math.cos(inp.cy)); _r.set(-_f.z, 0, _f.x); } else camAxes(); // telefono con la sua visuale: rispetto alla sua telecamera
    const mx = _r.x * inp.x + _f.x * inp.y, mz = _r.z * inp.x + _f.z * inp.y, ml = Math.hypot(mx, mz);
    const s = surfAt(p.pos.x, p.pos.z), wet = s === S.WATER, sandy = s === S.SAND;
    const speed = (wet ? 2.5 : sandy ? 4.2 : 7.2) * Math.min(1, ml) * (p.giant > 0 ? 1.25 : 1);
    const tvx = ml > 0.2 ? mx / ml * speed : 0, tvz = ml > 0.2 ? mz / ml * speed : 0;
    p.vel.x += (tvx - p.vel.x) * Math.min(1, dt * 10); p.vel.z += (tvz - p.vel.z) * Math.min(1, dt * 10);
    if (!p.fly) { p.pos.x += p.vel.x * dt; p.pos.z += p.vel.z * dt; }
    const sp = Math.hypot(p.vel.x, p.vel.z);
    if (sp > 0.5) p.yaw = lerpAngle(p.yaw, Math.atan2(p.vel.x, p.vel.z), Math.min(1, dt * 12));
    if (!p.fly) playAnim(p, p.done && sp < 0.5 ? (p.anim === 'Cheer' ? 'Cheer' : 'Idle') : sp > 4 ? 'Running_A' : sp > 0.5 ? 'Walking_A' : 'Idle');
    if (p.av.mixer) { const a = p.av.mixer._actions.find(x => x.isRunning() && x.getClip().name === 'Sprint_Loop'); if (a) a.timeScale = sp / 7; }
    // mazzata a chi è vicino (lontano dalla palla)
    if ((inp.press || (inp.btn && !p.btnWas)) && (dBall > 3 || p.done) && p.swipeCd <= 0 && G.phase === 'play' && G.holeT > 1) swipe(p);
    // da gigante travolgi chi tocchi
    if (p.giant > 0) for (const q of G.players) if (q !== p && !(q.ko > 0) && q.pos.distanceTo(p.pos) < 1.9) { if (knock(q, p.pos, 12, 2.2)) { p.kos++; p.score++; FX.sound('whack'); shake(0.25); renderBoard(); } }
  }
  p.idleT = moveIn ? 0 : (p.idleT || 0) + dt;
  p.btnWas = inp.btn; inp.press = false;
  // terreno, alberi, bordi
  if (!p.fly) p.pos.y = groundUnder(p);
  for (const tr of trunksNear(p.pos.x, p.pos.z)) { const dx = p.pos.x - tr.x, dz = p.pos.z - tr.z, d = Math.hypot(dx, dz), r = tr.r + 0.35; if (d < r && d > 1e-4) { p.pos.x = tr.x + dx / d * r; p.pos.z = tr.z + dz / d * r; } }
  p.pos.x = clamp(p.pos.x, X0 + 4, X0 + W - 4); p.pos.z = clamp(p.pos.z, Z0 + 4, Z0 + D - 4);
  if (heightAt(p.pos.x, p.pos.z) < WATER - 1.5 && !p.fly) { // troppo profondo: torna indietro
    p.pos.x -= p.vel.x * dt * 2; p.pos.z -= p.vel.z * dt * 2;
  }
  // casse
  if (!p.item) for (const bx of boxes) if (!bx.gone && Math.hypot(p.pos.x - bx.x, p.pos.z - bx.z) < 1.3) { bx.gone = 8; bx.m.visible = false; p.item = randomItem(p); FX.sound('item'); FX.sparkle(bx.m.position.clone(), new THREE.Color(1.6, 1.2, 0.3)); if (p.kind !== 'bot') tip(`${p.name} ha preso: ${ITEMS[p.item].icon} ${ITEMS[p.item].name}`); }
  // mine
  for (const mn of G.mines) if (mn.armed && mn.owner !== p && !mn.done && Math.hypot(p.pos.x - mn.x, p.pos.z - mn.z) < 1.2) { mn.done = true; scene.remove(mn.m); boom(new THREE.Vector3(mn.x, heightAt(mn.x, mn.z), mn.z), 4.5, mn.owner); }
  p.av.root.position.copy(p.pos); p.av.root.rotation.set(0, p.yaw, 0);
  if (p.tumble) { // capriola attorno al centro del corpo
    _tq.setFromAxisAngle(p.tumble.axis, p.tumble.ang); p.av.root.quaternion.premultiply(_tq);
    _tc.set(0, 1.0 * p.av.root.scale.y, 0); _tc2.copy(_tc).applyQuaternion(_tq); p.av.root.position.add(_tc).sub(_tc2);
  }
  if (p.squash > 0) { const k = Math.sin(p.squash * Math.PI) * 0.22 * p.squash; p.av.root.scale.set(p.baseScale * (1 + k * 0.6), p.baseScale * (1 - k), p.baseScale * (1 + k * 0.6)); }
  else if (!(p.giant > 0) && p.av.root.scale.y !== p.av.root.scale.x) p.av.root.scale.setScalar(p.baseScale);
  if (p.ice) p.ice.position.copy(p.pos).y += 0.9;
  sendState(p);
}
function lerpAngle(a, b, k) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * k; }
function playAnim(p, name, o = {}) { if (p.anim === name) return; p.anim = name; p.av.play(name, { fade: 0.18, ...o }); }
function autoAim(p) {
  const h = HOLES[G.hole], c = cupOf(h), b = p.ball.pos;
  // verso la buca se vicina, altrimenti verso il punto di passaggio se non lo si è superato
  const dc = Math.hypot(c.x - b.x, c.z - b.z);
  const pastMid = fairDist(h, b.x, b.z) < 30 && Math.hypot(b.x - h.mid[0], b.z - h.mid[1]) < Math.hypot(h.tee[0] - h.mid[0], h.tee[1] - h.mid[1]) * 0.4;
  const tgt = dc < 70 || pastMid || Math.hypot(b.x - h.tee[0], b.z - h.tee[1]) > Math.hypot(h.mid[0] - h.tee[0], h.mid[1] - h.tee[1]) ? [c.x, c.z] : h.mid;
  return Math.atan2(tgt[0] - b.x, tgt[1] - b.z);
}
// Swing vero (animazione Mixamo "Golf Drive" adattata): mentre carichi il personaggio va indietro col bastone
// quanto la potenza; quando tiri la palla parte nell'istante dell'impatto.
// la mano sinistra impugna il bastone sopra la destra (l'animazione da sola la lasciava staccata)
const _g1 = new THREE.Vector3(), _g2 = new THREE.Vector3(), _g3 = new THREE.Vector3(), _pole = new THREE.Vector3();
const _sq = new THREE.Quaternion();
function leftGrip(p) {
  if (!p.larm) p.larm = makeFreeArm(p.av);
  // busto un po' meno piegato: con la testa grande la postura dell'animazione sembrava ingobbita
  for (const [b, q0] of p.spRest) { _sq.copy(b.quaternion); b.quaternion.slerp(q0, 0.3); }
  p.av.root.updateMatrixWorld(true);
  p.club.localToWorld(_g1.set(0, 0.11, 0)); p.club.localToWorld(_g2.set(0, -0.93, 0));
  const up = _g1.sub(_g2).normalize();
  p.av.bones.hand_r.getWorldPosition(_g3).addScaledVector(up, 0.085 * p.av.root.scale.x / 1.11);
  _pole.set(Math.cos(p.yaw), -1.2, -Math.sin(p.yaw)).normalize();
  p.larm.apply(_g3, _pole, 1);
}
const SWING = { clip: 'Golf_Drive_B', address: 0.2, top: 0.95, impact: 1.17, speed: 1.7 };
function golfPose(p) {
  if (p.anim !== 'golf' || !p.golfAct) { p.golfAct = p.av.play(SWING.clip, { once: true, fade: 0.2 }); p.anim = 'golf'; }
  if (!p.golfAct) { playAnim(p, 'Idle_B'); return; }
  const k = p.state === 'charge' ? p.charge : 0, e = k * k * (3 - 2 * k);
  p.golfAct.timeScale = 0; p.golfAct.time = SWING.address + (SWING.top - SWING.address) * e;
}
function shoot(p) {
  const power = Math.max(0.04, p.charge), yaw = p.aimYaw, putt = onGreen(p.ball.pos);
  p.state = 'swing'; p.charge = 0;
  let delay = 0.1;
  if (p.golfAct && p.anim === 'golf') {
    if (putt) p.golfAct.time = Math.max(p.golfAct.time, SWING.impact - 0.16 * SWING.speed);
    delay = Math.max(0.08, (SWING.impact - p.golfAct.time) / SWING.speed); p.golfAct.timeScale = SWING.speed;
    const act = p.golfAct; setTimeout(() => { if (p.anim === 'golf' && p.golfAct === act) { playAnim(p, 'Idle'); p.golfAct = null; } }, 1600);
  }
  p.pendingShot = { at: G.time + delay, power, yaw };
  p.swingEnd = G.time + delay + 0.45;
  FX.sound('swish', power);
}
function fireShot(p) {
  const s = p.pendingShot; p.pendingShot = null; const b = p.ball, power = s.power;
  b.last = b.pos.clone(); b.vel.copy(shotVel(p, power, s.yaw)); b.moving = true; b.air = !onGreen(b.pos); b.inWater = false; b.ghost = p.superShot; b.superT = p.superShot ? 4 : 0;
  p.superShot = false; p.triedItem = false; p.strokes++;
  FX.sound(onGreen(b.pos) ? 'putt' : 'hit', 0.8 + power * 0.4);
  if (power > 0.9) FX.sparkle(b.pos.clone(), new THREE.Color(2, 1.8, 0.6), 10);
  renderBoard();
}
function updateBall(p, dt) {
  const b = p.ball; if (p.done) return;
  if (b.moving) {
    const ev = [], h = HOLES[G.hole], c = cupOf(h);
    const steps = 4; for (let i = 0; i < steps; i++) {
      ballStep(b, dt / steps, ev, { ghost: b.ghost, magnet: p.magnet > 0 ? c : null });
      const dc = Math.hypot(b.pos.x - c.x, b.pos.z - c.z), sp = b.vel.length();
      if (dc < CUP_R * 1.15 && b.pos.y < c.y + 0.45) {
        const hs = Math.hypot(b.vel.x, b.vel.z);
        // entra se rotola non troppo forte, o se ci cade dentro dall'alto (schiacciata alla GWYF)
        if (hs < 6 || (b.vel.y < -1 && hs < 11)) { playerSunk(p); return; }
        if (!(b.lipT > G.time)) { b.lipT = G.time + 0.35; const a = (Math.random() - 0.5) * 0.6, ca = Math.cos(a), sa = Math.sin(a); const vx = b.vel.x * ca - b.vel.z * sa, vz = b.vel.x * sa + b.vel.z * ca; b.vel.x = vx * 0.72; b.vel.z = vz * 0.72; b.vel.y = Math.max(b.vel.y, 0.9); FX.sound('bounce', 0.6); }
      } else if (dc < CUP_R * 3 && !b.air && sp < 2.2) { // imbuto: la buca attira un po' le palle lente che passano vicino
        b.vel.x += (c.x - b.pos.x) / dc * 1.6 * dt / steps; b.vel.z += (c.z - b.pos.z) / dc * 1.6 * dt / steps;
      }
      if (b.inWater) break;
    }
    for (const e of ev) { if (e.t === 'bounce' && e.v > 2) FX.sound('bounce', Math.min(1.5, e.v / 6)); if (e.t === 'bounce' && e.s === S.SAND) FX.puff(b.pos.clone(), new THREE.Color(0.95, 0.88, 0.7), 6, 0.5); if (e.t === 'tree') FX.sound('whack'); }
    if (b.superT > 0) { b.superT -= dt; FX.trail(b.pos, new THREE.Color(2, 1.6, 0.4), 0.45, 0.35); }
    else if (b.air && b.vel.length() > 8 && Math.random() < 0.6) FX.trail(b.pos, new THREE.Color(1, 1, 1), 0.18, 0.25);
    if (b.inWater) {
      FX.splash(b.pos.clone().setY(WATER)); viewFx({ k: 'splash', x: r2(b.pos.x), y: WATER, z: r2(b.pos.z) }); p.strokes++; b.pos.copy(b.last); b.vel.set(0, 0, 0); b.moving = false; b.inWater = false; b.ghost = false;
      if (p.kind !== 'bot') tip(`${p.name}: in acqua! Torni indietro (+1)`); renderBoard();
    } else if (!b.air && b.vel.lengthSq() < 0.25 && Math.hypot(b.pos.x - cupOf(HOLES[G.hole]).x, b.pos.z - cupOf(HOLES[G.hole]).z) < CUP_R * 1.7) {
      playerSunk(p); return; // ferma (o quasi) sul bordo: è dentro, si segna subito
    } else if (!b.air && b.vel.lengthSq() < 0.006) {
      const n = normalAt(b.pos.x, b.pos.z); if (n.y > 0.985 || b.vel.lengthSq() < 0.0005) { b.vel.set(0, 0, 0); b.moving = false; b.ghost = false; }
    }
    if (p.strokes >= 12 && !b.moving) giveUp(p);
  }
  if (p.magnet > 0) p.magnet -= dt;
  p.ballMesh.position.copy(b.pos);
  p.ballRing.position.set(b.pos.x, heightAt(b.pos.x, b.pos.z) + 0.04, b.pos.z);
  p.ballPin.position.set(b.pos.x, b.pos.y + 1.4 + Math.sin(G.time * 4) * 0.15, b.pos.z);
  p.ballPin.visible = !p.done && Math.hypot(p.pos.x - b.pos.x, p.pos.z - b.pos.z) > 3;
}

// ---------- mazzate, oggetti ----------
const _tq = new THREE.Quaternion(), _tc = new THREE.Vector3(), _tc2 = new THREE.Vector3();
// terreno sotto i piedi: il più alto tra centro e quattro punti attorno (in salita i piedi non affondano)
function groundUnder(p) {
  const r = 0.2 * (p.av ? p.av.root.scale.x / (p.baseScale || 1) : 1) * 1.1; let h = heightAt(p.pos.x, p.pos.z);
  h = Math.max(h, heightAt(p.pos.x + r, p.pos.z), heightAt(p.pos.x - r, p.pos.z), heightAt(p.pos.x, p.pos.z + r), heightAt(p.pos.x, p.pos.z - r));
  return h - 0.02;
}
// mazzata da cartone: capriola in aria, botta a terra con schiacciamento, stelline, ci si rialza
function startTumble(p, dir) {
  const flight = Math.max(0.4, 2 * p.fly.v.y / 20), turns = flight > 0.9 ? 2 : 1;
  p.tumble = { axis: new THREE.Vector3(dir.z, 0, -dir.x).normalize(), ang: 0, rate: turns * 2 * Math.PI / flight };
  p.koLying = false; p.koGetUp = null;
  if (!p.stars) {
    const g = new THREE.Group(), sh = new THREE.Shape();
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 0.05 : 0.12; i ? sh.lineTo(Math.cos(a) * r, Math.sin(a) * r) : sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 1 }); geo.center();
    const mat = new THREE.MeshStandardMaterial({ color: 0xffd23a, emissive: 0xffb000, emissiveIntensity: 0.6, roughness: 0.4 });
    for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(geo, mat), a = i / 4 * Math.PI * 2; m.position.set(Math.cos(a) * 0.42, Math.sin(a * 2) * 0.06, Math.sin(a) * 0.42); m.rotation.y = -a; g.add(m); }
    g.visible = false; scene.add(g); p.stars = g;
  }
}
function landKO(p) {
  FX.puff(p.pos.clone(), undefined, 10, 1.0); FX.sound('whack', 0.5); p.squash = 1;
  // giù a terra (supino), poi si rialza con l'animazione apposta, nel tempo che resta
  p.koLying = true; const a = p.av.play('Death01', { once: true, fade: 0.08 }); if (a) a.time = a.getClip().duration * 0.75;
  p.koGetUp = { t: Math.max(0.9, Math.min(1.6, p.ko - 0.6)) };
}
function knock(p, from, force, ko = 2.4) {
  if (p.ko > 0 || p.giant > 0 || (p.immune || 0) > G.time) return false;
  if (DEBUG) console.log('knock', p.name, new Error().stack.split('\n')[2]);
  const d = p.pos.clone().sub(from); d.y = 0; const l = d.length() || 1; d.multiplyScalar(1 / l);
  p.fly = { v: new THREE.Vector3(d.x * force, 5 + force * 0.5, d.z * force) }; p.ko = Math.max(ko, 2.2); p.state = 'ko';
  startTumble(p, d); p.av.play('Hit_Knockback', { once: true, fade: 0.05 }); p.anim = 'ko'; p.av.mood('ko', p.ko);
  FX.sparkle(p.pos.clone().setY(p.pos.y + 1.4), new THREE.Color(2, 2, 0.6), 10);
  return true;
}
function swipe(p) {
  p.swipeCd = 0.9; FX.sound('swish', 1);
  playAnim(p, '1H_Melee_Attack_Slice_Horizontal'); p.anim = 'swipe'; setTimeout(() => { if (p.anim === 'swipe') p.anim = ''; }, 500);
  const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
  for (const q of G.players) {
    if (q === p) continue; const dx = q.pos.x - p.pos.x, dz = q.pos.z - p.pos.z, d = Math.hypot(dx, dz);
    if (d < 2.2 && (dx * fx + dz * fz) / (d || 1) > 0.2) { if (!knock(q, p.pos, 9, p.done ? 1.4 : 2.4)) continue; p.kos++; p.score++; FX.sound('whack'); shake(0.3); renderBoard(); }
  }
  for (const q of G.players) { // anche le palle degli altri vicine volano via
    const b = q.ball; if (q.done || q === p) continue; const dx = b.pos.x - p.pos.x, dz = b.pos.z - p.pos.z, d = Math.hypot(dx, dz);
    if (d < 2 && (dx * fx + dz * fz) / (d || 1) > 0) { b.last = b.pos.clone(); b.vel.set(fx * 14, 5, fz * 14); b.moving = true; b.air = true; FX.sound('hit'); }
  }
}
function boom(pos, r, owner) {
  FX.explosion(pos.clone().setY(pos.y + 0.4), r, { shake }); viewFx({ k: 'boom', x: r2(pos.x), y: r2(pos.y + 0.4), z: r2(pos.z), r });
  for (const q of G.players) {
    const d = q.pos.distanceTo(pos);
    if (d < r) { if (knock(q, pos, 14 * (1 - d / r) + 6, 2.6) && owner && owner !== q) { owner.kos++; owner.score++; } }
    const b = q.ball; const db = b.pos.distanceTo(pos);
    if (!q.done && db < r * 1.2) { const dir = b.pos.clone().sub(pos); dir.y = 0; dir.normalize(); b.last = b.moving ? b.last : b.pos.clone(); b.vel.set(dir.x * 12 * (1 - db / (r * 1.2)) + dir.x * 3, 7, dir.z * 12 * (1 - db / (r * 1.2)) + dir.z * 3); b.moving = true; b.air = true; }
  }
  renderBoard();
}
function nearestFoe(p, maxD = 80) { let best = null, bd = maxD; for (const q of G.players) { if (q === p) continue; const d = q.pos.distanceTo(p.pos); if (d < bd) { bd = d; best = q; } } return best; }
function useItem(p) {
  const it = p.item; p.item = null; FX.sound('item');
  const head = p.pos.clone().setY(p.pos.y + 1.4);
  if (it === 'razzo') {
    const tgt = nearestFoe(p, 140);
    const m = makeRocket(new THREE.Color(p.color).getHex());
    m.position.copy(head); scene.add(m);
    const v = new THREE.Vector3(Math.sin(p.yaw), 0.6, Math.cos(p.yaw)).normalize().multiplyScalar(14);
    G.missiles.push({ m, v, tgt, owner: p, t: 0 }); FX.sound('launch');
    if (p.kind !== 'bot') tip(`${p.name}: razzo${tgt ? ' su ' + tgt.name : ''}!`);
  } else if (it === 'bomba') {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 12), new THREE.MeshStandardMaterial({ color: 0x1d2030, roughness: 0.4, metalness: 0.3 }));
    const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.2), new THREE.MeshStandardMaterial({ color: 0xc8a060 })); fuse.position.y = 0.4; m.add(fuse);
    m.position.copy(head); m.castShadow = true; scene.add(m);
    const tgt = nearestFoe(p, 30); let dir = new THREE.Vector3(Math.sin(p.yaw), 0, Math.cos(p.yaw));
    if (tgt) dir = tgt.pos.clone().sub(p.pos).setY(0).normalize();
    const dist = tgt ? Math.min(22, tgt.pos.distanceTo(p.pos)) : 14;
    const v = dir.multiplyScalar(dist / 1.2); v.y = 7;
    G.bombs.push({ m, v, t: 0, owner: p });
  } else if (it === 'gelo') {
    const tgt = nearestFoe(p, 60);
    if (tgt) { FX.beam(head, tgt.pos.clone().setY(tgt.pos.y + 1), new THREE.Color(0.6, 1.4, 2.4)); viewFx({ k: 'beam', a: head.toArray().map(r2), b: [r2(tgt.pos.x), r2(tgt.pos.y + 1), r2(tgt.pos.z)] }); freeze(tgt); p.kos++; p.score++; renderBoard(); }
    else { FX.beam(head, head.clone().add(new THREE.Vector3(Math.sin(p.yaw) * 20, 0, Math.cos(p.yaw) * 20))); }
  } else if (it === 'fulmine') {
    shake(0.6);
    for (const q of G.players) if (q !== p) { FX.lightning(q.pos.clone()); viewFx({ k: 'light', x: r2(q.pos.x), y: r2(q.pos.y), z: r2(q.pos.z) }); if (knock(q, q.pos.clone().add(new THREE.Vector3(0.1, 0, 0.1)), 2, 2.2)) { p.kos++; p.score++; } }
    renderBoard(); flashScreen();
  } else if (it === 'calamita') { p.magnet = 9; FX.sparkle(p.ball.pos.clone(), new THREE.Color(2, 0.5, 0.5), 16); if (p.kind !== 'bot') tip(`${p.name}: la tua palla ora cerca la buca`); }
  else if (it === 'banana') {
    // buccia dietro di te: chi ci passa scivola, le palle che ci rotolano sopra deviano
    const m = makeBanana(); const bx = p.pos.x - Math.sin(p.yaw) * 1.4, bz = p.pos.z - Math.cos(p.yaw) * 1.4;
    m.position.set(bx, heightAt(bx, bz) + 0.03, bz); m.rotation.y = Math.random() * 6; scene.add(m);
    G.bananas.push({ m, x: bx, z: bz, owner: p, t: 0 }); FX.sound('item');
    if (p.kind !== 'bot') tip(`${p.name}: buccia di banana!`);
  } else if (it === 'gigante') {
    p.giant = 8; FX.sound('launch'); FX.sparkle(p.pos.clone().setY(p.pos.y + 1), new THREE.Color(2, 1.2, 0.3), 20);
    if (p.kind !== 'bot') tip(`${p.name} è GIGANTE: travolgi tutti!`);
  } else if (it === 'scambio') {
    // la tua palla si scambia con quella più vicina alla buca
    const c = cupOf(HOLES[G.hole]); let best = null, bd = Math.hypot(p.ball.pos.x - c.x, p.ball.pos.z - c.z);
    for (const q of G.players) { if (q === p || q.done || q.ball.moving) continue; const d = Math.hypot(q.ball.pos.x - c.x, q.ball.pos.z - c.z); if (d < bd) { bd = d; best = q; } }
    if (best && !p.ball.moving) {
      const a = p.ball.pos.clone(), b = best.ball.pos.clone();
      FX.beam(a.clone().setY(a.y + 0.3), b.clone().setY(b.y + 0.3), new THREE.Color(1.6, 0.6, 2.4)); viewFx({ k: 'beam', a: [r2(a.x), r2(a.y + 0.3), r2(a.z)], b: [r2(b.x), r2(b.y + 0.3), r2(b.z)] });
      p.ball.pos.copy(b); best.ball.pos.copy(a); p.ball.last = b.clone(); best.ball.last = a.clone();
      FX.sparkle(a, new THREE.Color(1.6, 0.6, 2.4), 14); FX.sparkle(b, new THREE.Color(1.6, 0.6, 2.4), 14); FX.sound('freeze');
      tip(`${p.name} si prende la palla di ${best.name}!`);
    } else { p.item = 'scambio'; if (p.kind !== 'bot') tip('Scambio: la tua palla è già la più vicina (o si sta muovendo)'); }
  }
  else if (it === 'mina') {
    const m = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.12, 16), new THREE.MeshStandardMaterial({ color: 0x3a4030, roughness: 0.7 })); m.add(base);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.3, 0.3), toneMapped: false })); led.position.y = 0.08; m.add(led);
    m.position.set(p.pos.x, heightAt(p.pos.x, p.pos.z) + 0.05, p.pos.z); scene.add(m);
    G.mines.push({ m, led, x: p.pos.x, z: p.pos.z, owner: p, armed: false, t: 0 });
  }
}
function slip(q) {
  FX.sound('whack'); FX.puff(q.pos.clone(), new THREE.Color(1, 0.95, 0.4), 8, 0.6);
  q.fly = { v: new THREE.Vector3(Math.sin(q.yaw) * 3, 6, Math.cos(q.yaw) * 3) }; q.ko = 2.0; q.state = 'ko';
  startTumble(q, new THREE.Vector3(Math.sin(q.yaw), 0, Math.cos(q.yaw))); q.av.play('Hit_Knockback', { once: true, fade: 0.05 }); q.anim = 'ko'; q.av.mood('ko', q.ko);
}
function makeBanana() {
  const g = new THREE.Group(), y = new THREE.MeshStandardMaterial({ color: 0xffd23a, roughness: 0.5 }), br = new THREE.MeshStandardMaterial({ color: 0x6b4a1e, roughness: 0.8 });
  for (let k = 0; k < 3; k++) { const pg = new THREE.SphereGeometry(0.22, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2); pg.scale(0.45, 0.35, 1.5); const m = new THREE.Mesh(pg, y); m.rotation.y = k * Math.PI * 2 / 3; m.rotation.x = -0.25; m.position.set(Math.sin(k * 2.09) * 0.2, 0, Math.cos(k * 2.09) * 0.2); m.lookAt(0, -0.3, 0); m.rotateX(Math.PI / 2 + 0.6); g.add(m); }
  const c = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), y); c.position.y = 0.06; g.add(c);
  const st = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.12, 6), br); st.position.y = 0.16; g.add(st);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; }); return g;
}
function freeze(q) {
  FX.sound('freeze');
  q.frozen = 3.5; q.state = q.done ? 'done' : 'walk';
  if (!q.ice) { q.ice = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.1, 1.3), new THREE.MeshPhysicalMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.55, roughness: 0.05, clearcoat: 1, depthWrite: false })); scene.add(q.ice); }
  q.ice.visible = true; q.av.mixer.timeScale = 0;
}
function unfreeze(q) { if (q.ice) q.ice.visible = false; if (q.av) q.av.mixer.timeScale = 1; q.frozen = 0; }
function flashScreen() { const d = document.createElement('div'); d.style.cssText = 'position:fixed;inset:0;background:#eaf2ff;opacity:.8;pointer-events:none;transition:opacity .5s;z-index:3'; document.body.appendChild(d); requestAnimationFrame(() => requestAnimationFrame(() => d.style.opacity = 0)); setTimeout(() => d.remove(), 600); }
function updateProjectiles(dt) {
  for (let i = G.missiles.length - 1; i >= 0; i--) {
    const ms = G.missiles[i]; ms.t += dt;
    if (ms.tgt) { const want = ms.tgt.pos.clone().setY(ms.tgt.pos.y + 1).sub(ms.m.position).normalize().multiplyScalar(26); ms.v.lerp(want, Math.min(1, dt * (ms.t < 0.4 ? 1 : 3.2))); }
    else ms.v.y -= 6 * dt;
    ms.m.position.addScaledVector(ms.v, dt); ms.m.lookAt(ms.m.position.clone().add(ms.v)); ms.m.rotateZ(ms.t * 6); { const fl = ms.m.userData.flame; if (fl) { const k = 0.8 + Math.random() * 0.5; fl.scale.set(1, 1, k); ms.m.userData.core.scale.set(0.5, 0.5, 0.7 * k); } }
    FX.trail(ms.m.position.clone().addScaledVector(ms.v, -0.03), new THREE.Color(2, 1.1, 0.4), 0.5, 0.25); if (Math.random() < 0.7) FX.trail(ms.m.position, new THREE.Color(0.75, 0.75, 0.78), 0.6, 1.1, true);
    const hitGround = ms.m.position.y < heightAt(ms.m.position.x, ms.m.position.z) + 0.2;
    const hitTgt = ms.tgt && ms.m.position.distanceTo(ms.tgt.pos.clone().setY(ms.tgt.pos.y + 1)) < 1.2;
    if (hitGround || hitTgt || ms.t > 7) { scene.remove(ms.m); G.missiles.splice(i, 1); boom(ms.m.position.clone().setY(Math.max(ms.m.position.y - 0.4, heightAt(ms.m.position.x, ms.m.position.z))), 5, ms.owner); }
  }
  for (let i = G.bombs.length - 1; i >= 0; i--) {
    const bm = G.bombs[i]; bm.t += dt; bm.v.y -= 18 * dt; bm.m.position.addScaledVector(bm.v, dt);
    const gh = heightAt(bm.m.position.x, bm.m.position.z) + 0.35; if (bm.m.position.y < gh) { bm.m.position.y = gh; bm.v.multiplyScalar(0.4); bm.v.y = Math.abs(bm.v.y) * 0.3; }
    bm.m.rotation.x += dt * 5; if (Math.random() < 0.8) FX.trail(bm.m.position.clone().setY(bm.m.position.y + 0.45), new THREE.Color(2, 1.4, 0.3), 0.15, 0.3);
    bm.m.scale.setScalar(1 + Math.max(0, bm.t - 1.2) * Math.abs(Math.sin(bm.t * 30)) * 0.3);
    if (bm.t > 1.9) { scene.remove(bm.m); G.bombs.splice(i, 1); boom(bm.m.position.clone(), 5.5, bm.owner); }
  }
  for (const bn of G.bananas) {
    bn.t += dt; if (bn.t < 0.6) continue;
    for (const q of G.players) if (!(q.ko > 0) && !q.fly && Math.hypot(q.pos.x - bn.x, q.pos.z - bn.z) < 0.9) { bn.done = true; slip(q); if (bn.owner !== q) { bn.owner.kos++; bn.owner.score++; renderBoard(); } break; }
    for (const q of G.players) { const b = q.ball; if (!q.done && b.moving && !b.air && Math.hypot(b.pos.x - bn.x, b.pos.z - bn.z) < 0.7 && !bn.hitBall) { bn.hitBall = true; const a = (Math.random() < 0.5 ? -1 : 1) * (0.6 + Math.random() * 0.6), ca = Math.cos(a), sa = Math.sin(a); const vx = b.vel.x * ca - b.vel.z * sa, vz = b.vel.x * sa + b.vel.z * ca; b.vel.x = vx; b.vel.z = vz; FX.sound('bounce'); setTimeout(() => bn.hitBall = false, 400); } }
    if (bn.done || bn.t > 60) { scene.remove(bn.m); bn.done = true; }
  }
  G.bananas = G.bananas.filter(b => !b.done);
  for (const mn of G.mines) { mn.t += dt; if (mn.t > 1) mn.armed = true; mn.led.visible = Math.floor(mn.t * (mn.armed ? 3 : 8)) % 2 === 0; }
  G.mines = G.mines.filter(m => !m.done);
}

// ---------- computer ----------
function botThink(p, dt) {
  const inp = p.input; inp.x = inp.y = 0; inp.btn = false;
  if (G.phase !== 'play' || p.ko > 0 || p.frozen > 0) return;
  if (p.done) { // ha finito: va a dare mazzate e usa i poteri
    if (p.item && Math.random() < dt * 0.5) inp.item = true;
    const foe = nearestFoe(p, 200); if (!foe) return;
    const dx = foe.pos.x - p.pos.x, dz = foe.pos.z - p.pos.z, d = Math.hypot(dx, dz);
    if (d > 1.6) steer(p, dx, dz); else if (Math.random() < dt * 2) { p.yaw = Math.atan2(dx, dz); inp.btn = !p.btnWas; }
    return;
  }
  p.botT = (p.botT || 0) - dt;
  if (p.item && p.botT < 0 && !['calamita', 'scambio'].includes(p.item) && Math.random() < dt * 0.7) inp.item = true;
  const b = p.ball;
  if (p.state === 'addr' || p.state === 'charge') {
    if (!p.plan) p.plan = botPlan(p);
    const pl = p.plan;
    if (['calamita', 'scambio'].includes(p.item) && !p.triedItem) { inp.item = true; p.triedItem = true; p.plan = null; return; }
    const da = lerpAngle(0, pl.yaw - p.aimYaw, 1);
    if (Math.abs(da) > 0.01) { p.aimYaw += clamp(da, -dt * 2, dt * 2); return; }
    if (p.state === 'addr') { inp.btn = true; return; }
    // tiene premuto finché la potenza arriva al punto giusto (sale)
    const rising = (p.chargeT / 1.1) % 2 < 1;
    inp.btn = !(rising && p.charge >= pl.power - 0.01);
    if (!inp.btn) p.plan = null;
    return;
  }
  p.plan = null;
  if (b.moving) { // insegue la palla
    const dx = b.pos.x - p.pos.x, dz = b.pos.z - p.pos.z, d = Math.hypot(dx, dz); if (d > 6) steer(p, dx, dz); return;
  }
  const dx = b.pos.x - p.pos.x, dz = b.pos.z - p.pos.z;
  // ogni tanto prende una cassa vicina
  if (!p.item) { const bx = boxes.find(x => !x.gone && Math.hypot(x.x - p.pos.x, x.z - p.pos.z) < 9 && Math.hypot(x.x - b.pos.x, x.z - b.pos.z) < 14); if (bx) { steer(p, bx.x - p.pos.x, bx.z - p.pos.z); return; } }
  // mazzata a chi passa vicino
  const foe = nearestFoe(p, 2); if (foe && G.holeT > 6 && Math.random() < dt * 0.8 && Math.hypot(dx, dz) > 3.5) { p.yaw = Math.atan2(foe.pos.x - p.pos.x, foe.pos.z - p.pos.z); inp.btn = !p.btnWas; return; }
  const dd = Math.hypot(dx, dz); if (dd > 1.1) steer(p, dx, dz, dd < 3 ? 0.5 : 1);
}
function steer(p, dx, dz, k = 1) {
  // direzione nel riferimento della telecamera
  camAxes(); let l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
  // evita i tronchi davanti
  for (const tr of trunksNear(p.pos.x, p.pos.z)) { const ox = tr.x - p.pos.x, oz = tr.z - p.pos.z, d = Math.hypot(ox, oz); if (d < tr.r + 2.2 && (ox * dx + oz * dz) > 0) { const s = (ox * dz - oz * dx) > 0 ? 1 : -1; dx += dz * s * 0.9; dz -= dx * s * 0.9; l = Math.hypot(dx, dz); dx /= l; dz /= l; } }
  p.input.x = (dx * _r.x + dz * _r.z) * k; p.input.y = (dx * _f.x + dz * _f.z) * k;
}
function botPlan(p) {
  const h = HOLES[G.hole], c = cupOf(h), base = autoAim(p), b = p.ball.pos;
  const tgt = (() => { const dc = Math.hypot(c.x - b.x, c.z - b.z); if (Math.abs(lerpAngle(0, Math.atan2(c.x - b.x, c.z - b.z) - base, 1)) < 0.01) return [c.x, c.z]; return h.mid; })();
  let best = null;
  for (let yi = -2; yi <= 2; yi++) for (let pw = 0.06; pw <= 1.0; pw += 0.06) {
    const yaw = base + yi * 0.05, r = simulate(p, pw, yaw, 9);
    if (r.water) continue;
    const d = Math.hypot(r.pos.x - tgt[0], r.pos.z - tgt[1]) + (r.cup ? -5 : 0) + (surfAt(r.pos.x, r.pos.z) === S.SAND ? 6 : 0) + (surfAt(r.pos.x, r.pos.z) === S.ROUGH ? 3 : 0);
    if (!best || d < best.d) best = { d, yaw, power: pw };
  }
  if (!best) best = { yaw: base, power: 0.3 };
  const skill = 0.06;
  return { yaw: best.yaw + (Math.random() - .5) * skill * 0.5, power: clamp(best.power + (Math.random() - .5) * skill, 0.04, 1) };
}

// ---------- HUD ----------
let bigT = 0;
function big(t, cls = '', ms = 1500) { const el = $('#big'); el.textContent = t; el.className = cls; requestAnimationFrame(() => el.classList.add('show')); clearTimeout(bigT); bigT = setTimeout(() => el.classList.remove('show'), ms); }
function tip(t) { $('#tip').textContent = t; }
const _v = new THREE.Vector3();
function updateTags() {
  const w = innerWidth, h = innerHeight, placed = [], list = [];
  for (const p of G.players) {
    if (!p.tag) continue;
    _v.copy(p.pos).y += AV_H + 0.45; _v.project(camera);
    const vis = _v.z < 1 && Math.abs(_v.x) < 1.1 && Math.abs(_v.y) < 1.1 && G.phase !== 'lobby' && G.phase !== 'over';
    p.tag.style.display = vis ? '' : 'none'; if (!vis) continue;
    list.push({ p, x: (_v.x + 1) / 2 * w, y: (1 - _v.y) / 2 * h });
  }
  // etichette vicine: si impilano invece di sovrapporsi (con un piccolo ritardo, niente tremolii)
  list.sort((a, b) => b.y - a.y);
  for (const e of list) {
    let y = e.y;
    for (let it = 0; it < 6; it++) { const hit = placed.find(o => Math.abs(o.x - e.x) < 96 && Math.abs(o.y - y) < 27); if (!hit) break; y = hit.y - 27; }
    placed.push({ x: e.x, y });
    const p = e.p; p._ty = p._ty == null || Math.abs(p._ty - y) > 200 ? y : p._ty + (y - p._ty) * 0.25;
    p.tag.style.left = e.x + 'px'; p.tag.style.top = p._ty + 'px';
  }
  for (const { p } of list) {
    const it = p.tag.querySelector('.it'); const icon = p.item ? ITEMS[p.item].icon : ''; if (it.textContent !== icon) it.textContent = icon; it.style.display = icon ? '' : 'none';
    const pw = p.tag.querySelector('.pw'); pw.style.display = p.state === 'charge' ? '' : 'none'; pw.firstChild.style.width = (p.charge * 100) + '%';
    const st = p.tag.querySelector('.st'); const s = p.frozen > 0 ? '❄️ congelato' : p.ko > 0 ? '💫 KO' : p.done ? '⛳ in buca' : p.state === 'addr' ? 'mira…' : ''; if (st.textContent !== s) st.textContent = s;
  }
}

// ---------- telecamera condivisa ----------
const _c = new THREE.Vector3(), _box = new THREE.Box3();
function updateCamera(dt) {
  const h = HOLES[G.hole];
  let pos, look;
  if (G.phase === 'lobby' || G.phase === 'loading') {
    const t = G.time * 0.03; look = new THREE.Vector3(Math.sin(t) * 40, 2, Math.cos(t * 0.7) * 30); pos = look.clone().add(new THREE.Vector3(Math.cos(t) * 90, 55, Math.sin(t) * 90));
  } else if (G.phase === 'intro') {
    // volo dalla buca al tee
    const k = Math.min(1, G.intro / 3.2), e = k * k * (3 - 2 * k), c = cupOf(h);
    const from = new THREE.Vector3(c.x, c.y, c.z), to = new THREE.Vector3(h.tee[0], h.teeY, h.tee[1]);
    look = from.clone().lerp(to, e); const dir = to.clone().sub(from).setY(0).normalize();
    pos = look.clone().addScaledVector(dir, 22).add(new THREE.Vector3(0, 16 - e * 4, 0));
    camPos.copy(pos); camLook.copy(look);
  } else {
    _box.makeEmpty(); let n = 0;
    for (const p of G.players) { if (p.done && G.phase === 'play' && G.players.some(q => !q.done)) continue; _box.expandByPoint(p.pos); if (!p.done) _box.expandByPoint(p.ball.pos); n++; }
    if (!n) { const c = cupOf(h); _box.expandByPoint(new THREE.Vector3(c.x, c.y, c.z)); }
    _box.getCenter(_c); const size = _box.getSize(new THREE.Vector3()), R = Math.max(size.x, size.z) * 0.5;
    const c = cupOf(h), toCup = new THREE.Vector3(c.x - _c.x, 0, c.z - _c.z); if (toCup.length() < 3) toCup.set(h.green[0] - h.tee[0], 0, h.green[1] - h.tee[1]); toCup.normalize();
    const dist = clamp(R * 1.25 + 10, 13, 120);
    look = _c.clone().addScaledVector(toCup, Math.min(5, dist * 0.1)); look.y = heightAt(look.x, look.z) + 1;
    pos = _c.clone().addScaledVector(toCup, -dist * 0.85); pos.y = Math.max(heightAt(pos.x, pos.z) + 3, _c.y + dist * 0.6);
  }
  if (Q.has('close') && G.players[0] && G.players[0].pos && G.phase !== 'intro') { const p0 = G.players[0]; look = p0.pos.clone().setY(p0.pos.y + 1); pos = look.clone().add(new THREE.Vector3(Math.sin(p0.yaw + 0.9) * 4.5, 1.6, Math.cos(p0.yaw + 0.9) * 4.5)); }
  const k = 1 - Math.exp(-dt * (G.phase === 'intro' ? 30 : 2.2));
  camPos.lerp(pos, k); camLook.lerp(look, k);
  G.shake = Math.max(0, G.shake - dt * 1.8);
  camShake.set((Math.random() - .5), (Math.random() - .5), (Math.random() - .5)).multiplyScalar(G.shake * 1.2);
  camera.position.copy(camPos).add(camShake); camera.lookAt(camLook); sky.position.copy(camera.position);
  placeSun(camLook, clamp(camPos.distanceTo(camLook) * 0.9, 25, 90));
}

// ---------- ciclo ----------
// ?rec: si avanza a passi fissi da fuori (per registrare e guardare le partite)
const REC = Q.has('rec'); let simNow = 0;
let last = REC ? 0 : performance.now(), slow = 0, wasPhase = '';
function frame(now) {
  if (!REC) requestAnimationFrame(frame);
  let dt = clamp((now - last) / 1000, 0, 0.05); last = now; G.time += dt;
  if (dt > 1 / 35) slow += dt; else slow = Math.max(0, slow - dt * 0.5);
  if (slow > 2.5 && PR > 0.7) { PR = Math.max(0.7, PR - 0.2); renderer.setPixelRatio(PR); resize(); slow = 0; }
  wind.value = G.time;
  W_.update(G.time);
  for (const bx of boxes) { bx.m.rotation.y += dt * 1.2; bx.m.position.y = heightAt(bx.x, bx.z) + 1.1 + Math.sin(G.time * 2 + bx.x) * 0.15; if (bx.gone > 0) { bx.gone -= dt; if (bx.gone <= 0) { bx.gone = 0; bx.m.visible = true; } } }
  for (let sub = 0; sub < SPEED; sub++) simStep(dt);
  for (const p of G.players) if (p.av) { p.av.update(dt * SPEED); if (p.anim === 'golf' && p.club) leftGrip(p); }
  FX.updateFx(dt, camera);
  updateCamera(dt);
  updateTags();
  if (Q.has('norender') || window.__noRender) return;
  if (composer) composer.render(); else renderer.render(scene, camera);
}
function simStep(dt) {
  if (G.phase === 'intro') { G.intro += dt; if (G.intro > 3.4) { G.phase = 'play'; big('Via!', 'p', 900); } }
  if (G.phase === 'play' || G.phase === 'intro' || G.phase === 'results') {
    for (const p of G.players) { updatePlayer(p, dt); updateBall(p, dt); }
    // spinte tra giocatori
    for (let i = 0; i < G.players.length; i++) for (let j = i + 1; j < G.players.length; j++) { const a = G.players[i].pos, b = G.players[j].pos, dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz); if (d < 0.8 && d > 1e-4) { const k = (0.8 - d) / 2 / d; a.x -= dx * k; a.z -= dz * k; b.x += dx * k; b.z += dz * k; } }
    updateProjectiles(dt);
    updateAimPreview();
  }
  sendViews(dt);
  if (G.phase === 'play') {
    G.holeT += dt;
    if (G.clock > 0) { G.clock -= dt; $('#clock').classList.remove('hide'); $('#clock').textContent = Math.ceil(G.clock) + 's'; if (G.clock <= 0) { for (const p of G.players) giveUp(p); } }
    else $('#clock').classList.add('hide');
    if (G.players.every(p => p.done)) { G.phase = 'results'; G.resT = 0; renderBoard(); }
  }
  if (G.phase === 'results') { G.resT += dt; $('#clock').classList.add('hide'); if (G.resT > 3.5) nextHole(); }
}
const arrowShape = (() => { const sh = new THREE.Shape(); sh.moveTo(-0.18, 0); sh.lineTo(0.18, 0); sh.lineTo(0.18, 0.75); sh.lineTo(0.42, 0.75); sh.lineTo(0, 1); sh.lineTo(-0.42, 0.75); sh.lineTo(-0.18, 0.75); sh.closePath(); const g = new THREE.ShapeGeometry(sh); g.rotateX(Math.PI / 2); return g; })();
function aimDeco(p) {
  if (p.arrow) return;
  p.arrow = new THREE.Mesh(arrowShape, new THREE.MeshBasicMaterial({ color: p.color, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide })); scene.add(p.arrow);
  p.land = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.95, 32), new THREE.MeshBasicMaterial({ color: p.color, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide })); p.land.rotation.x = -Math.PI / 2; scene.add(p.land);
}
function updateAimPreview() {
  for (const p of G.players) {
    if (!p.aimDots) continue;
    aimDeco(p);
    const show = (p.state === 'addr' || p.state === 'charge') && !p.done;
    p.aimDots.visible = p.arrow.visible = p.land.visible = show; if (!show) continue;
    const pwA = p.state === 'charge' ? Math.max(0.05, p.charge) : 0.3, b = p.ball.pos;
    p.arrow.position.set(b.x, heightAt(b.x, b.z) + 0.1, b.z); p.arrow.rotation.y = p.aimYaw;
    p.arrow.scale.set(1 + pwA * 0.6, 1, 1.5 + pwA * 6); p.arrow.rotation.order = 'YXZ';
    p.arrow.material.color.setStyle(p.color).lerp(new THREE.Color(1, 0.3, 0.2), pwA * 0.6);
    p.aimT = (p.aimT || 0) + 1; if (p.aimT % 2) continue; // ogni 2 fotogrammi basta
    const pos = p.aimDots.geometry.attributes.position;
    const pw = p.state === 'charge' ? Math.max(0.05, p.charge) : 0.55;
    const putt = onGreen(p.ball.pos);
    const r = simulate(p, pw, p.aimYaw, putt ? 4 : 6, !putt, pos); p.landX = r.pos.x; p.landZ = r.pos.z;
    let k = r.k || 0; if (putt) k = Math.max(2, Math.floor(k * 0.45));
    p.land.visible = !putt && p.state === 'charge'; p.land.position.set(r.pos.x, heightAt(r.pos.x, r.pos.z) + 0.08, r.pos.z); p.land.scale.setScalar(0.8 + Math.sin(G.time * 6) * 0.08);
    for (let i = k; i < 60; i++) pos.setXYZ(i, 0, -100, 0);
    pos.needsUpdate = true;
  }
}

// ---------- avvio ----------
resize(); renderLobby(); document.querySelectorAll('#gfx .chip').forEach(x => x.classList.toggle('sel', x.dataset.q === GFX));
if (!REC) requestAnimationFrame(frame); else window.__adv = (n = 1, dt = 1 / 30) => { for (let i = 0; i < n; i++) { simNow += dt * 1000; frame(simNow); } };
(async () => {
  let a = 0, b = 0; const prog = () => { $('#bar').style.width = ((a * 0.5 + b * 0.5) * 100) + '%'; };
  await Promise.all([loadAvatarLibrary(p => { a = p; prog(); }), (LITE ? Promise.resolve() : loadNature(scene, { mobile: GFX === 'bassa', plants: QL.plants, trees: QL.trees, avoid: propZones(), onProgress: p => { b = p; prog(); } }))]);
  if (!LITE) await loadProps(scene, { mobile: GFX === 'bassa' }).catch(e => console.warn('arredo', e));
  // riflessi dal cielo
  const pm = new THREE.PMREMGenerator(renderer); const envScene = new THREE.Scene(); envScene.add(sky.clone()); scene.environment = pm.fromScene(envScene, 0.04).texture; pm.dispose();
  // prepara subito gli effetti (fuori vista), così la prima esplosione non blocca il gioco
  { const pre = [makeRocket(0xff3355), makeBanana()]; pre.forEach((o, k) => { o.position.set(k * 3, -300, 0); scene.add(o); }); setTimeout(() => pre.forEach(o => scene.remove(o)), 4000); }
  { const far = new THREE.Vector3(0, -300, 0); FX.explosion(far, 5); FX.splash(far); FX.confetti(far); FX.beam(far, far.clone().add(new THREE.Vector3(1, 0, 0))); FX.lightning(far); }
  $('#load').classList.add('hide'); $('#lobby').classList.remove('hide'); G.phase = 'lobby';
  if (DEBUG) { window.__renderer = renderer; window.__scene = scene; window.__G = G; window.__cam = camera; window.__sim = simulate; window.__setCam = (a) => { camPos.set(a[0], a[1], a[2]); camLook.set(a[3], a[4], a[5]); }; window.__HOLES = HOLES; window.__use = (i, it) => { const p = G.players[i]; p.item = it; useItem(p); }; window.__sunk = i => playerSunk(G.players[i]); window.__boom = (x, z) => boom(new THREE.Vector3(x, heightAt(x, z), z), 5, null); }
  if (Q.has('cam')) { $('#lobby').classList.add('hide'); const c = Q.get('cam').split(',').map(Number); G.phase = 'still'; camPos.set(c[0], c[1], c[2]); camLook.set(c[3], c[4], c[5]); updateCamera = () => { camera.position.copy(camPos); camera.lookAt(camLook); sky.position.copy(camera.position); placeSun(camLook, 60); }; }
  if (Q.has('auto')) {
    const n = +(Q.get('bots') || 3);
    for (let i = 0; i < n; i++) $('#addBot').onclick();
    G.nHoles = +(Q.get('holes') || 6); startGame();
  }
})().catch(e => { $('#load').querySelector('p').textContent = 'Errore nel caricamento: ' + e.message; console.error(e); });
