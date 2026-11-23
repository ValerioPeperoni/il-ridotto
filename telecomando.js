// niente zoom con due dita o doppio tocco: su iPhone il meta viewport non basta
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, e => e.preventDefault(), { passive: false });
document.addEventListener('touchmove', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
let lastTap = 0; document.addEventListener('touchend', e => { const n = Date.now(); if (n - lastTap < 300 && !e.target.closest('input')) e.preventDefault(); lastTap = n; }, { passive: false });
// se lo zoom è comunque scattato, si rimette a posto da solo
if (window.visualViewport) visualViewport.addEventListener('resize', () => { if (visualViewport.scale > 1.01) { const m = document.querySelector('meta[name=viewport]'); const c = m.content; m.content = c + ',minimum-scale=1'; setTimeout(() => { m.content = c; }, 50); } });
// versione: se il telefono ha in memoria file vecchi, si ricarica da solo con quelli nuovi
const BUILD = '202611230145';
fetch('build.txt?' + Date.now(), { cache: 'no-store' }).then(r => r.ok ? r.text() : '').then(v => { v = (v || '').trim(); if (v && v !== BUILD && sessionStorage.getItem('ridotto-reload') !== v) { sessionStorage.setItem('ridotto-reload', v); const u = new URL(location.href); u.searchParams.set('_v', v); location.replace(u.href); } }).catch(() => { });
// Telefono come controller di movimento (bowling; in futuro ping pong).
import { joinRoom } from './net.js';

const $ = s => document.querySelector(s);
const Q = new URLSearchParams(location.search);
const CODE = (Q.get('r') || '').toUpperCase();
const COLORS = ['#ff3d9a', '#38e8ff', '#ffd166', '#7cff6b', '#b26bff', '#ff7b3d'];
const store = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } } };
let pid = store.get('ridotto-pid'); if (!pid) { pid = Math.random().toString(36).slice(2, 10); store.set('ridotto-pid', pid); }
let color = store.get('ridotto-color') || COLORS[Math.floor(Math.random() * 6)];
let game = 'bowling', net = null, myTurn = false, flipHook = store.get('ridotto-flip') === '1', fingerMode = false;

// ---------- schermata di ingresso ----------
function mySport() { try { const p = JSON.parse(store.get('ridotto-avatar') || 'null'); return p && p.sport ? p.sport : null; } catch (e) { return null; } }
function myLook() { try { const p = JSON.parse(store.get('ridotto-avatar') || 'null'); return p && p.look ? p.look : null; } catch (e) { return null; } }
{ const prof = (() => { try { return JSON.parse(store.get('ridotto-avatar') || 'null'); } catch (e) { return null; } })();
  $('#camLink').href = 'avatar.html?ret=' + encodeURIComponent('telecomando.html' + location.search);
  if (prof && prof.look) $('#camT').textContent = 'Cambia personaggio';
  if (prof && prof.name && !store.get('ridotto-me')) store.set('ridotto-me', prof.name); }
$('#name').value = store.get('ridotto-me') || '';
function drawCols() { $('#cols').innerHTML = COLORS.map(c => `<button class="col${c === color ? ' sel' : ''}" data-c="${c}" style="background:${c};color:${c}"></button>`).join(''); }
drawCols();
$('#cols').onclick = e => { const b = e.target.closest('[data-c]'); if (!b) return; color = b.dataset.c; store.set('ridotto-color', color); drawCols(); document.documentElement.style.setProperty('--me', color); if (net) net.send({ t: 'color', color }); };
document.documentElement.style.setProperty('--me', color);
if (!CODE) $('#jstate').textContent = 'Manca il codice della sala: inquadra il QR sullo schermo.';
$('#enter').onclick = async () => {
  const name = $('#name').value.trim() || 'Giocatore'; store.set('ridotto-me', name);
  await askMotion(); keepAwake();
  show('wait'); $('#waitT').textContent = 'Mi collego…';
  net = joinRoom(CODE, {
    onState(s) { $('#netstate').textContent = s === 'open' ? 'Collegato' : s === 'noroom' ? 'Non trovo la sala: lo schermo è acceso?' : s === 'lost' ? 'Connessione persa, riprovo…' : 'Mi collego…'; if (s === 'open') net.send({ t: 'join', name, color, pid, look: myLook(), sport: mySport(), wantView: want3D() }); },
    onMsg: onMsg,
  });
};
function show(id) { for (const s of ['join', 'wait', 'bowl', 'pong', 'golf', 'caos']) $('#' + s).classList.toggle('hide', s !== id); const v = id === 'caos' && typeof V3 !== 'undefined' && V3; $('#cv3d').classList.toggle('hide', !v); $('#cvArrow').classList.toggle('hide', !v); }
let wake = null;
async function keepAwake() { try { if (!wake && navigator.wakeLock) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); } } catch (e) { } }
document.addEventListener('visibilitychange', () => { if (!document.hidden) keepAwake(); });

function onMsg(m) {
  if (m.t === 'sync') { net && net.send({ t: 'sync', h: m.h }); return; }
  if (m.t === 'golf') { game = 'golf'; golfState(m); return; }
  if (m.t === 'caos') { game = 'caos'; caosState(m); return; }
  if (m.t === 'cvl') { game = 'caos'; view3D().then(v => v && v.onLooks(m)); return; }
  if (m.t === 'cv') { if (V3) V3.onSnap(m); return; }
  if (m.t === 'cfx') { if (V3) V3.onFx(m); return; }
  if (m.t === 'pong') { game = 'pong'; show('pong'); pServing = !!m.serving; $('#pScore').textContent = `${m.score[0]} - ${m.score[1]}`; $('#pInfo').textContent = m.serving ? 'Tocca a te battere: premi LANCIA, poi colpisci quando la palla scende' : `contro ${m.vs}`; $('#pToss').classList.toggle('hide', !m.serving); pongFace(); if (m.serving) { vibrate(50); calibrate(); } return; }
  if (m.t === 'hi' && m.game === 'caos') view3D(); // l'isola si carica subito, mentre si aspetta in sala
  if (m.t === 'hi') { game = m.game || 'bowling'; $('#waitT').textContent = `Ciao ${m.name}! Aspetta che parta la partita`; color = m.color || color; document.documentElement.style.setProperty('--me', color); }
  else if (m.t === 'full' || m.t === 'kicked') { $('#waitT').textContent = m.text || 'Sei stato tolto dalla sala'; }
  else if (m.t === 'turn') {
    myTurn = !!m.yours;
    if (myTurn) {
      show('bowl'); aimX = m.x ?? aimX; aimA = m.a ?? 0; if (m.spin != null) { spin = m.spin; drawSpin(); } drawLane();
      $('#bTitle').textContent = 'Tocca a te!'; $('#bInfo').textContent = `Frame ${m.frame} · birilli in piedi: ${m.pins}` + (m.spec ? ' · ' + m.spec : '');
      vibrate(60);
    } else { show('wait'); $('#waitT').textContent = m.who ? `Tocca a ${m.who}` : 'Aspetta…'; }
  }
  else if (m.t === 'res') { $('#res').textContent = m.text; $('#score').textContent = `Punti: ${m.score}`; if (/STRIKE|SPARE/.test(m.text)) vibrate([80, 60, 160]); }
  else if (m.t === 'end') { show('wait'); $('#waitT').textContent = m.text; $('#score').textContent = `I tuoi punti: ${m.score}`; }
}
function vibrate(p) { try { navigator.vibrate && navigator.vibrate(p); } catch (e) { } }

// ---------- sensori ----------
let motionOK = false;
const buf = []; // campioni {t, w:[x,y,z] rad/s}
async function askMotion() {
  try {
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      const r = await DeviceMotionEvent.requestPermission(); if (r !== 'granted') return;
    }
  } catch (e) { return; }
  addEventListener('devicemotion', e => {
    const r = e.rotationRate; if (!r || r.alpha == null) return;
    motionOK = true;
    const k = Math.PI / 180;
    // alpha: asse z (perpendicolare allo schermo), beta: asse x, gamma: asse y (lungo il telefono)
    const la = e.acceleration, ga = e.accelerationIncludingGravity; buf.push({ t: performance.now() / 1000, w: [r.beta * k, r.gamma * k, r.alpha * k], a: la && la.x != null ? [la.x, la.y, la.z] : null, g: ga && ga.x != null ? [ga.x, ga.y, ga.z] : null });
    while (buf.length && buf[0].t < buf[buf.length - 1].t - 3) buf.shift();
    if (holding) liveSwing();
    if (game === 'pong') pongMotion(e);
  });
}

// ---------- mira ----------
let aimX = 0.18, aimA = 0;
const lane = $('#lane');
function drawLane() {
  const f = 0.5 + aimX / 1.0541 * 0.76; lane.querySelector('.ball').style.left = (f * 100) + '%';
  const l = $('#aimL'); l.setAttribute('x1', f * 100); l.setAttribute('x2', f * 100 + aimA * 900);
}
let dragL = false;
const fromEv = e => { const r = lane.getBoundingClientRect(); aimX = Math.max(-0.44, Math.min(0.44, ((e.clientX - r.left) / r.width - 0.5) / 0.76 * 1.0541)); drawLane(); sendAim(); };
lane.addEventListener('pointerdown', e => { lane.setPointerCapture(e.pointerId); dragL = true; fromEv(e); });
lane.addEventListener('pointermove', e => { if (dragL) fromEv(e); });
lane.addEventListener('pointerup', () => dragL = false);
$('#aL').onclick = () => { aimX = Math.max(-0.44, aimX - 0.04); aimA = 0; drawLane(); sendAim(); vibrate(10); };
$('#aR').onclick = () => { aimX = Math.min(0.44, aimX + 0.04); aimA = 0; drawLane(); sendAim(); vibrate(10); };
let aimTimer = 0;
function sendAim() { clearTimeout(aimTimer); aimTimer = setTimeout(() => net && net.send({ t: 'aim', x: aimX, a: aimA }), 40); }
// effetto scelto coi tasti (come i tasti del Joy-Con): -1 tutto a sinistra … +1 tutto a destra
let spin = 0;
function drawSpin() { document.querySelectorAll('#spinRow [data-sp]').forEach(b => b.classList.toggle('sel', +b.dataset.sp === spin)); }
$('#spinRow').onclick = e => { const b = e.target.closest('[data-sp]'); if (!b) return; spin = +b.dataset.sp; drawSpin(); vibrate(15); net && net.send({ t: 'spin', v: spin }); };
$('#swMode').onclick = () => { fingerMode = !fingerMode; $('#pad').classList.toggle('hide', !fingerMode); $('#hold').classList.toggle('hide', fingerMode); $('#spinRow').classList.toggle('hide', !fingerMode && !spinKeys); $('#swMode').textContent = fingerMode ? 'Usa i sensori' : 'Senza sensori? Usa il dito'; };

// ---------- lancio col movimento (tutto manuale) ----------
// Tieni premuto, braccio indietro e poi avanti: la palla parte da sola nel punto più basso del braccio
// (o quando alzi il dito). Se il braccio va un po' a sinistra o a destra la palla va di lì;
// se ruoti il polso mentre lanci la palla prende l'effetto.
let holding = false, holdT0 = 0, lastSend = 0, thrown = false;
let flipDir = store.get('ridotto-flipdir') === '1', spinKeys = store.get('ridotto-spinkeys') === '1';
const hold = $('#hold');
hold.addEventListener('pointerdown', e => { e.preventDefault(); if (!myTurn) return; hold.setPointerCapture(e.pointerId); holding = true; thrown = false; holdT0 = performance.now() / 1000; hold.classList.add('on'); vibrate(20); if (!motionOK) { $('#bInfo').textContent = 'Non sento i sensori: usa il dito (link qui sotto)'; } });
hold.addEventListener('pointerup', () => { if (!holding) return; holding = false; hold.classList.remove('on'); if (!thrown) release(true); });
hold.addEventListener('pointercancel', () => { holding = false; hold.classList.remove('on'); });
hold.addEventListener('contextmenu', e => e.preventDefault());

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = a => { const l = Math.hypot(...a) || 1; return a.map(x => x / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function principalAxis(samples) {
  // asse attorno a cui il telefono ruota di più (iterazione di potenza sulla matrice ω ωᵀ)
  const M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const s of samples) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) M[i][j] += s.w[i] * s.w[j];
  let v = [1, 0.3, 0.2];
  for (let k = 0; k < 20; k++) v = norm([dot(M[0], v), dot(M[1], v), dot(M[2], v)]);
  return v;
}
// Il braccio è un pendolo: si trova l'asse dell'oscillazione, il verso (il primo tratto ampio è all'indietro)
// e l'angolo. Si lancia nel punto più basso, cioè quando la velocità in avanti smette di crescere.
function analyse(samples) {
  if (samples.length < 6) return null;
  const strong = samples.filter(s => Math.hypot(...s.w) > 1.2);
  if (strong.length < 4) return null;
  const u = principalAxis(strong);
  let th = 0, sigma = 0, prev = samples[0].t; const rates = [];
  for (const s of samples) { const r = dot(s.w, u); th += r * (s.t - prev); prev = s.t; if (!sigma && Math.abs(th) > 0.25) sigma = -Math.sign(th); rates.push({ t: s.t, r, th, w: s.w, g: s.g }); }
  if (!sigma) return null;
  let minTh = 0;
  for (const x of rates) { x.r *= sigma; x.th *= sigma; minTh = Math.min(minTh, x.th); }
  return { u: u.map(c => c * sigma), th: th * sigma, minTh, rates };
}
function forwardPhase(a) {
  let iMin = 0; a.rates.forEach((x, i) => { if (x.th < a.rates[iMin].th) iMin = i; });
  return a.rates.slice(iMin);
}
function liveSwing() {
  if (thrown) return;
  const now = performance.now() / 1000;
  const a = analyse(buf.filter(s => s.t >= holdT0));
  if (!a) return;
  const m = $('#meter i'); m.style.left = (50 + Math.max(-48, Math.min(48, a.th * 30))) + '%';
  if (now - lastSend > 0.05) { lastSend = now; net && net.send({ t: 'swing', th: a.th }); }
  // rilascio automatico: braccio andato indietro (almeno 20°), poi in avanti forte; si lancia appena la velocità cala
  if (a.minTh > -0.35) return;
  const f = forwardPhase(a); if (f.length < 3) return;
  const peak = Math.max(...f.map(x => x.r)), last = f[f.length - 1];
  if (peak > 2.2 && last.r < peak * 0.85 && a.th > a.minTh + 0.3) release(false);
}
function release(byFinger) {
  if (thrown) return;
  const s = buf.filter(x => x.t >= holdT0);
  const a = analyse(s);
  if (!a || !myTurn) { if (motionOK) $('#bInfo').textContent = 'Non ho sentito il movimento: tieni premuto, braccio indietro e poi avanti'; return; }
  const f = forwardPhase(a);
  const peak = Math.max(0, ...f.map(x => x.r));
  if (peak < 1.5 || f.length < 3) { $('#bInfo').textContent = 'Troppo piano: braccio indietro e poi avanti, deciso'; net && net.send({ t: 'swing', th: 0 }); return; }
  thrown = true;
  // asse del braccio (dal telefono verso la spalla): lì puntano la gravità e la forza centripeta nel tratto veloce
  let ax = [0, 0, 0];
  for (const x of f) if (x.g) { const k = x.r * x.r; ax = ax.map((c, i) => c + x.g[i] * k); }
  if (Math.hypot(...ax) < 1e-3) ax = [0, 1, 0];
  let arm = norm(ax); arm = norm(arm.map((c, i) => c - a.u[i] * dot(arm, a.u)));
  const lateral = cross(a.u, arm); // verso destra
  let twist = 0, lat = 0, swing = 0;
  for (let i = 1; i < f.length; i++) { const dt = f[i].t - f[i - 1].t, w = f[i].w; twist += dot(w, arm) * dt; lat += dot(w, lateral) * dt; swing += dot(w, a.u) * dt; }
  let dir = Math.atan2(lat, Math.max(0.4, Math.abs(swing))); if (flipDir) dir = -dir; // + = destra
  // polso girato in senso antiorario (visto dall'alto) = la palla curva a sinistra
  let hook = Math.max(-1, Math.min(1, -twist / 0.8)); if (flipHook) hook = -hook;
  if (spinKeys) hook = spin;
  else if (Math.abs(hook) < 0.22) hook = 0;
  const power = Math.max(0.08, Math.min(1.2, (peak - 2.2) / 8.5));
  const msg = { t: 'throw', power, hook, timing: 0.1, pull: Math.max(-0.06, Math.min(0.06, dir * 0.15)) };
  net && net.send(msg); myTurn = false; vibrate(40);
  const kmh = (2.8 + power * 6.7) * 3.6;
  const dTxt = Math.abs(dir) < 0.06 ? 'dritta' : dir < 0 ? 'verso sinistra' : 'verso destra';
  const hTxt = hook === 0 ? 'senza effetto' : hook < 0 ? 'effetto a sinistra' : 'effetto a destra';
  $('#bInfo').textContent = `${kmh.toFixed(0)} km/h · ${dTxt} · ${hTxt}`;
  holding = false; hold.classList.remove('on');
}
$('#flip').onclick = () => { flipHook = !flipHook; store.set('ridotto-flip', flipHook ? '1' : '0'); drawFlips(); };
$('#flipD').onclick = () => { flipDir = !flipDir; store.set('ridotto-flipdir', flipDir ? '1' : '0'); drawFlips(); };
$('#spinMode').onclick = () => { spinKeys = !spinKeys; store.set('ridotto-spinkeys', spinKeys ? '1' : '0'); drawFlips(); };
function drawFlips() { $('#spinMode').textContent = spinKeys ? 'Effetto: coi tasti' : 'Effetto: col polso'; $('#spinRow').classList.toggle('hide', !spinKeys && !fingerMode); $('#flip').classList.toggle('hide', spinKeys); $('#flip').textContent = flipHook ? 'Effetto invertito ✓' : 'Effetto al contrario?'; $('#flipD').textContent = flipDir ? 'Direzione invertita ✓' : 'Direzione al contrario?'; }
drawFlips();

// ---------- lancio col dito ----------
const pad = $('#pad'); let pg = null;
pad.addEventListener('pointerdown', e => { if (!myTurn) return; pad.setPointerCapture(e.pointerId); pg = { y0: e.clientY, h: [{ t: performance.now(), x: e.clientX, y: e.clientY }] }; });
pad.addEventListener('pointermove', e => { if (!pg) return; const n = performance.now(); pg.h.push({ t: n, x: e.clientX, y: e.clientY }); while (pg.h.length > 2 && n - pg.h[0].t > 160) pg.h.shift(); const th = -(e.clientY - pg.y0) / 160; net && net.send({ t: 'swing', th: Math.max(-1.5, Math.min(1.5, th)) }); });
pad.addEventListener('pointerup', e => {
  if (!pg) return; const h = pg.h, a = h[0], b = h[h.length - 1], dt = Math.max(0.016, (b.t - a.t) / 1000), H = innerHeight;
  const vy = -(b.y - a.y) / dt / H, vx = (b.x - a.x) / dt / H; const tm = -(e.clientY - pg.y0) / 160; pg = null;
  if (vy < 0.4) return;
  net && net.send({ t: 'throw', power: Math.min(1.25, vy / 3.4), hook: spin, timing: Math.min(tm, 0.5), pull: Math.max(-0.05, Math.min(0.05, vx / 2.2 * 0.05)) }); myTurn = false;
});
drawLane();


// ---------- ping pong: il telefono è la racchetta ----------
let gUp = [0, 1, 0], swingS = null, coolUntil = 0, lefty = store.get('ridotto-lefty') === '1', pongFlip = store.get('ridotto-pongflip') === '1';
function drawPFlip() { const b = $('#pFlip'); if (b) b.textContent = pongFlip ? 'Dritto/rovescio invertiti ✓' : 'Dritto e rovescio al contrario?'; }
setTimeout(() => { const b = $('#pFlip'); if (b) b.onclick = () => { pongFlip = !pongFlip; store.set('ridotto-pongflip', pongFlip ? '1' : '0'); drawPFlip(); }; drawPFlip(); }, 0);
$('#hand').textContent = lefty ? 'Mancino' : 'Destro';
$('#hand').onclick = () => { lefty = !lefty; store.set('ridotto-lefty', lefty ? '1' : '0'); $('#hand').textContent = lefty ? 'Mancino' : 'Destro'; };
function pongMotion(e) {
  const t = performance.now() / 1000, k = Math.PI / 180, r = e.rotationRate; if (!r) return;
  const w = [r.beta * k, r.gamma * k, r.alpha * k], mag = Math.hypot(...w);
  const ag = e.accelerationIncludingGravity, la = e.acceleration;
  if (ag && ag.x != null && mag < 2) { const n = norm([ag.x, ag.y, ag.z]); gUp = norm(gUp.map((v, i) => v * 0.9 + n[i] * 0.1)); }
  let lin = la && la.x != null ? [la.x, la.y, la.z] : ag && ag.x != null ? [ag.x - gUp[0] * 9.81, ag.y - gUp[1] * 9.81, ag.z - gUp[2] * 9.81] : [0, 0, 0];
  // appena il gesto parte lo diciamo subito allo schermo: conta l'inizio, non la fine (così il Wi-Fi non fa ritardo).
  // Il verso conta: dritto = racchetta da destra a sinistra (gira in senso antiorario visto dall'alto), rovescio = il contrario.
  const linM = Math.hypot(...lin), hand = (lefty ? -1 : 1) * (pongFlip ? -1 : 1);
  if (!swingS && (mag > 3.8 || linM > 14) && t > coolUntil) {
    const yr = dot(w, gUp) * hand;
    swingS = { peak: mag, tPeak: t, wPeak: w, acc: [], t0: t, yawI: 0, lastT: t, sent1: false };
    net && net.send({ t: 'sw0', ago: 0, dir: Math.abs(yr) > 1.2 ? Math.sign(yr) : 0 }); vibrate(12);
  }
  if (swingS) {
    const S = swingS; S.acc.push({ t, up: dot(lin, gUp) }); S.yawI += dot(w, gUp) * hand * (t - S.lastT); S.lastT = t;
    if (mag > S.peak) { S.peak = mag; S.tPeak = t; S.wPeak = w; }
    // dopo 50 ms si sa già abbastanza: forza, verso, su/giù, polso. Arriva prima del colpo.
    if (!S.sent1 && t - S.t0 >= 0.05) {
      S.sent1 = true;
      const up = S.acc.reduce((a, b) => a + b.up, 0) / Math.max(1, S.acc.length);
      const dir = Math.abs(S.yawI) > 0.04 ? Math.sign(S.yawI) : 0;
      net && net.send({ t: 'sw1', p: Math.max(0.1, Math.min(1.4, S.peak / 13)), vert: Math.max(-1, Math.min(1, up / 10)), twist: Math.max(-1, Math.min(1, S.wPeak[1] / S.peak)), dir });
      $('#pLast').textContent = dir > 0 ? 'Dritto' : dir < 0 ? 'Rovescio' : 'Colpo';
    }
    if (mag < S.peak * 0.7 || t - S.tPeak > 0.06) {
      const s = S; swingS = null; coolUntil = t + 0.35;
      const ups = s.acc.filter(a => a.t >= s.tPeak - 0.15 && a.t <= s.tPeak + 0.03);
      const vert = Math.max(-1, Math.min(1, ups.reduce((a, b) => a + b.up, 0) / Math.max(1, ups.length) / 12));
      const yaw = dot(s.wPeak, gUp) / s.peak * hand;
      const twist = Math.max(-1, Math.min(1, s.wPeak[1] / s.peak));
      const p = Math.max(0.1, Math.min(1.4, s.peak / 16));
      net && net.send({ t: 'sw', ago: (performance.now() / 1000 - s.tPeak) * 1000, p, vert, yaw, twist, dir: Math.abs(s.yawI) > 0.04 ? Math.sign(s.yawI) : 0 });
      $('#pLast').textContent = `${s.yawI > 0.04 ? 'Dritto' : s.yawI < -0.04 ? 'Rovescio' : 'Colpo'} · forza ${(p * 100).toFixed(0)}% · ${vert > 0.3 ? 'verso l\'alto' : vert < -0.3 ? 'verso il basso' : 'piatto'}`;
      vibrate(25);
    }
  }
}
// col dito: strisciata sulla racchetta
const pr = $('#pRacket'); let ps = null;
pr.addEventListener('pointerdown', e => { if (pServing) { $('#pToss').onclick(); return; } pr.setPointerCapture(e.pointerId); ps = [{ t: performance.now(), x: e.clientX, y: e.clientY }]; });
pr.addEventListener('pointermove', e => { if (!ps) return; const n = performance.now(); ps.push({ t: n, x: e.clientX, y: e.clientY }); while (ps.length > 2 && n - ps[0].t > 90) ps.shift(); });
pr.addEventListener('pointerup', () => {
  if (!ps || ps.length < 2) { ps = null; return; }
  const a = ps[0], b = ps[ps.length - 1], dt = Math.max(0.01, (b.t - a.t) / 1000), H = innerHeight; ps = null;
  const vx = (b.x - a.x) / dt / H, vy = (b.y - a.y) / dt / H, sp = Math.hypot(vx, vy); if (sp < 1) return;
  net && net.send({ t: 'sw', ago: 0, p: Math.min(1.35, sp / 6), vert: Math.max(-1, Math.min(1, -vy / sp)), yaw: vx < 0 ? 1 : -1, twist: 0 });
  vibrate(20);
});
$('#pFinger').onclick = () => { $('#pRacket').innerHTML = 'Striscia il dito<br>sulla racchetta<br><small style="font-weight:400;font-size:15px">veloce = forte · verso l\'alto = carica</small>'; };


// ---------- minigolf: fionda ----------
let gCan = false, gHave = false;
function golfState(m) {
  show('golf');
  $('#gTitle').textContent = m.phase === 'lobby' ? 'Minigolf' : `Buca ${m.hole} · ${m.name}`;
  $('#gInfo').textContent = m.phase === 'lobby' ? 'Aspetta che parta la partita' : `Par ${m.par} · colpi ${m.strokes}`;
  gCan = m.can;
  $('#gState').textContent = m.phase === 'between' ? 'Prossima buca…' : m.holed ? 'In buca! 🎉' : m.frozen ? 'Congelato! 🧊' : m.can ? 'Tira!' : m.phase === 'play' ? 'La palla rotola…' : '';
  $('#gState').style.color = m.can ? '#7cff6b' : '';
  gHave = !!m.power;
  $('#gUse').textContent = m.power ? `${m.power.icon} Usa: ${m.power.name}` : 'Nessun potere';
  $('#gUse').style.opacity = m.power ? 1 : .35;
  if (m.can) vibrate(15);
}
$('#gUse').onclick = () => { if (gHave && net) { net.send({ t: 'guse' }); vibrate([30, 30, 60]); } };
const gPad = $('#gPad'); let gd = null, gLast = 0;
function gVec(e) { const r = gPad.getBoundingClientRect(); const dx = e.clientX - gd.x, dy = e.clientY - gd.y, sc = 200 / r.width; const l = Math.hypot(dx, dy) * sc; const pow = Math.min(1, l / 90); return { dx: dx * sc, dy: dy * sc, l, pow, ang: Math.atan2(-dx, dy) }; }
gPad.addEventListener('pointerdown', e => { gPad.setPointerCapture(e.pointerId); gd = { x: e.clientX, y: e.clientY }; });
gPad.addEventListener('pointermove', e => {
  if (!gd) return; const v = gVec(e), k = Math.min(1, 90 / Math.max(1, v.l));
  $('#gBand').setAttribute('x2', v.dx * k); $('#gBand').setAttribute('y2', v.dy * k);
  $('#gArrow').setAttribute('x2', -v.dx * k * 0.9); $('#gArrow').setAttribute('y2', -v.dy * k * 0.9);
  $('#gArrow').setAttribute('stroke', `hsl(${120 - v.pow * 120},90%,55%)`);
  const n = performance.now(); if (n - gLast > 60 && net) { gLast = n; net.send({ t: 'gaim', ang: v.ang, pow: v.pow }); }
});
gPad.addEventListener('pointerup', e => {
  if (!gd) return; const v = gVec(e); gd = null;
  for (const id of ['#gBand', '#gArrow']) { $(id).setAttribute('x2', 0); $(id).setAttribute('y2', 0); }
  if (v.l < 8) return;
  if (net) net.send({ t: 'gshot', ang: v.ang, pow: v.pow }); vibrate(30);
});


// ---------- Golf Caos: levetta + tasto + oggetto ----------
let joyV = { x: 0, y: 0 }, joySent = 0, lastCaos = {};
const joy = $('#joy'), knob = joy.querySelector('i');
function joyFrom(e) {
  const r = joy.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, R = r.width / 2;
  let x = (e.clientX - cx) / R, y = (e.clientY - cy) / R; const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
  joyV = { x, y: -y }; knob.style.transform = `translate(${x * R * 0.6}px,${y * R * 0.6}px)`; sendJoy();
}
function sendJoy(force) { const now = performance.now(); if (!force && now - joySent < 50) return; joySent = now; const m = { t: 'joy', x: +joyV.x.toFixed(2), y: +joyV.y.toFixed(2) }; if (V3) m.cy = +V3.camYaw().toFixed(3); net && net.send(m); }
joy.addEventListener('pointerdown', e => { joy.setPointerCapture(e.pointerId); joyFrom(e); });
joy.addEventListener('pointermove', e => { if (e.buttons || e.pointerType === 'touch') joyFrom(e); });
const joyEnd = () => { joyV = { x: 0, y: 0 }; knob.style.transform = ''; sendJoy(true); };
joy.addEventListener('pointerup', joyEnd); joy.addEventListener('pointercancel', joyEnd);
setInterval(() => { if (game === 'caos' && (joyV.x || joyV.y)) sendJoy(true); }, 120);
const cBtn = $('#cBtn'); let sl = null, slSent = 0;
const aiming = () => lastCaos.near || lastCaos.state === 'addr' || lastCaos.state === 'charge';
cBtn.addEventListener('pointerdown', e => {
  e.preventDefault(); cBtn.setPointerCapture(e.pointerId); cBtn.classList.add('on'); vibrate(15);
  if (aiming()) { sl = { x: e.clientX, y: e.clientY }; net && net.send({ t: 'sling', on: true, dx: 0, pow: 0 }); }
  else net && net.send({ t: 'btn', on: true });
});
cBtn.addEventListener('pointermove', e => {
  if (!sl) return; const now = performance.now(); if (now - slSent < 45) return; slSent = now;
  const pow = Math.max(0, Math.min(1, (e.clientY - sl.y) / (innerHeight * 0.3)));
  const notch = Math.floor(pow * 4 + 0.001); if (notch !== sl.lastP) { sl.lastP = notch; vibrate(notch === 4 ? 40 : 15); }
  drawPow(pow);
  net && net.send({ t: 'sling', on: true, dx: 0, pow: +pow.toFixed(3) });
});
const cUp = () => { cBtn.classList.remove('on'); drawPow(-1); if (sl) { sl = null; net && net.send({ t: 'sling', on: false }); } else net && net.send({ t: 'btn', on: false }); };
function drawPow(p) { const el = $('#pBar'); el.classList.toggle('hide', p < 0); if (p < 0) return; el.querySelector('b').style.height = (p * 100) + '%'; el.querySelector('span').textContent = p < 0.04 ? 'trascina giù' : Math.round(p * 100) + '%'; }
// mira: trascina il dito di lato in un punto libero dello schermo (giri senza limiti; la visuale ti segue)
{ let ad = null, acc = 0, sent = 0; const area = $('#caos');
  area.addEventListener('pointerdown', e => { if (e.target.closest('button,#joy')) return; ad = e.clientX; area.setPointerCapture(e.pointerId); });
  area.addEventListener('pointermove', e => { if (ad == null) return; const dd = (e.clientX - ad) * 0.006; acc += dd; if (V3) V3.turn(dd); ad = e.clientX; const now = performance.now(); if (now - sent > 40 && Math.abs(acc) > 0.002) { sent = now; net && net.send({ t: 'turn', d: +acc.toFixed(4) }); acc = 0; } });
  const end = () => { ad = null; if (acc) { net && net.send({ t: 'turn', d: +acc.toFixed(4) }); acc = 0; } }; area.addEventListener('pointerup', end); area.addEventListener('pointercancel', end); }
cBtn.addEventListener('pointerup', cUp); cBtn.addEventListener('pointercancel', cUp); cBtn.addEventListener('contextmenu', e => e.preventDefault());
// pointerdown e non click: il click non arriva se un altro dito è sulla levetta (cioè mentre corri)
$('#cItem').addEventListener('pointerdown', e => { e.preventDefault(); net && net.send({ t: 'use' }); vibrate(30); });
function caosState(m) {
  if (m.phase === 'lobby') { show('wait'); $('#waitT').textContent = 'Aspetta che parta la partita'; return; }
  show('caos');
  document.documentElement.style.setProperty('--me', m.color || color);
  $('#cTitle').textContent = `Buca ${m.hole}`;
  $('#cInfo').textContent = `${m.strokes} colpi · ${m.score} punti`;
  const st = { frozen: '❄️ Congelato!', ko: '💫 Sei a terra!', done: '⛳ In buca! Ora dai fastidio agli altri: mazzate e poteri', addr: 'Mira e tira', charge: 'Lascia per tirare!' }[m.state] || (m.near ? 'Sei alla palla' : '');
  $('#cState').textContent = st; $('#cState').style.visibility = st ? '' : 'hidden';
  cBtn.innerHTML = m.near || m.state === 'addr' || m.state === 'charge' ? 'TIRA<br><small style="font-size:13px;font-weight:500">tieni, trascina<br>giù e lascia</small>' : 'MAZZATA';
  const it = $('#cItem'); it.textContent = m.item || 'nessun oggetto'; it.classList.toggle('on', !!m.item);
  if (m.item && !lastCaos.item) vibrate(60);
  if (m.state === 'ko' && lastCaos.state !== 'ko') vibrate([100, 50, 100]);
  lastCaos = m;
}

// ---------- Golf Caos: la propria visuale 3D sul telefono ----------
let V3 = null, V3p = null;
function want3D() { if (store.get('ridotto-3d') === '0') return false; try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } }
function view3D() {
  if (V3p) return V3p;
  if (!want3D()) return (V3p = Promise.resolve(null));
  const ld = $('#cvLoad'); ld.classList.remove('hide');
  V3p = import('./caos/phone-view.js').then(mod => {
    $('#cv3d').classList.remove('hide'); $('#caos').classList.add('v3');
    return mod.startPhoneView($('#cv3d'), { arrow: $('#cvArrow') }, p => { ld.querySelector('span').textContent = Math.round(p * 100) + '%'; });
  }).then(v => { V3 = v; ld.classList.add('hide'); $('#cvArrow').classList.remove('hide'); return v; })
    .catch(e => { console.error(e); ld.textContent = 'Visuale 3D non disponibile su questo telefono'; setTimeout(() => ld.classList.add('hide'), 3000); return null; });
  return V3p;
}

// ---------- ping pong: la racchetta sullo schermo segue il telefono ----------
let pServing = false, oriQ = null, oriQ0 = null, oriSent = 0;
const qMul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
const qInv = a => [-a[0], -a[1], -a[2], a[3]];
function qFromDev(al, be, ga) { // Eulero 'YXZ' (alpha attorno a y, beta attorno a x, -gamma attorno a z)
  const k = Math.PI / 180, x = be * k / 2, y = al * k / 2, z = -ga * k / 2;
  const c1 = Math.cos(x), c2 = Math.cos(y), c3 = Math.cos(z), s1 = Math.sin(x), s2 = Math.sin(y), s3 = Math.sin(z);
  return [s1 * c2 * c3 + c1 * s2 * s3, c1 * s2 * c3 - s1 * c2 * s3, c1 * c2 * s3 - s1 * s2 * c3, c1 * c2 * c3 + s1 * s2 * s3];
}
function calibrate() { if (oriQ) oriQ0 = oriQ.slice(); }
addEventListener('deviceorientation', e => {
  if (e.alpha == null || game !== 'pong') return;
  oriQ = qFromDev(e.alpha, e.beta, e.gamma); if (!oriQ0) oriQ0 = oriQ.slice();
  const now = performance.now(); if (now - oriSent < 33) return; oriSent = now;
  let r = qMul(qInv(oriQ0), oriQ); if (lefty) r = [r[0], -r[1], -r[2], r[3]];
  net && net.send({ t: 'pq', q: r.map(v => +v.toFixed(3)) });
});
async function askOrientation() { try { if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') await DeviceOrientationEvent.requestPermission(); } catch (e) { } }
$('#enter').addEventListener('click', askOrientation);
$('#pToss').onclick = () => { calibrate(); net && net.send({ t: 'toss' }); vibrate(30); $('#pToss').classList.add('hide'); pServing = false; pongFace(); };
function pongFace() { $('#pRacket').innerHTML = pServing ? 'TOCCA QUI<br>per lanciare<br><small style="font-weight:400;font-size:15px">poi colpisci quando scende</small>' : 'Colpisci<br>quando arriva<br><small style="font-weight:400;font-size:15px">su = palla carica · giù = schiacciata</small>'; $('#pRacket').style.background = pServing ? 'radial-gradient(circle at 40% 35%,#ffe27a,#ffb300 60%,#a86f00)' : ''; }
$('#pCal').onclick = () => { calibrate(); vibrate(20); };
