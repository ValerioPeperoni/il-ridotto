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
    onState(s) { $('#netstate').textContent = s === 'open' ? 'Collegato' : s === 'noroom' ? 'Non trovo la sala: lo schermo è acceso?' : s === 'lost' ? 'Connessione persa, riprovo…' : 'Mi collego…'; if (s === 'open') net.send({ t: 'join', name, color, pid, look: myLook() }); },
    onMsg: onMsg,
  });
};
function show(id) { for (const s of ['join', 'wait', 'bowl', 'pong', 'golf']) $('#' + s).classList.toggle('hide', s !== id); }
let wake = null;
async function keepAwake() { try { if (!wake && navigator.wakeLock) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); } } catch (e) { } }
document.addEventListener('visibilitychange', () => { if (!document.hidden) keepAwake(); });

function onMsg(m) {
  if (m.t === 'sync') { net && net.send({ t: 'sync', h: m.h }); return; }
  if (m.t === 'golf') { game = 'golf'; golfState(m); return; }
  if (m.t === 'pong') { game = 'pong'; show('pong'); $('#pScore').textContent = `${m.score[0]} - ${m.score[1]}`; $('#pInfo').textContent = m.serving ? 'Tocca a te battere: colpisci quando la palla scende' : `contro ${m.vs}`; if (m.serving) vibrate(50); return; }
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
    const la = e.acceleration; buf.push({ t: performance.now() / 1000, w: [r.beta * k, r.gamma * k, r.alpha * k], a: la && la.x != null ? [la.x, la.y, la.z] : null });
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
$('#swMode').onclick = () => { fingerMode = !fingerMode; $('#pad').classList.toggle('hide', !fingerMode); $('#hold').classList.toggle('hide', fingerMode); $('#spinRow').classList.toggle('hide', !fingerMode); $('#meter').classList.toggle('hide', fingerMode); $('#swMode').textContent = fingerMode ? 'Usa i sensori' : 'Senza sensori? Usa il dito'; };

// ---------- lancio col movimento (tutto manuale) ----------
// Tieni premuto, braccio indietro e poi avanti: la palla parte da sola nel punto più basso del braccio
// (o quando alzi il dito). Se il braccio va un po' a sinistra o a destra la palla va di lì;
// se ruoti il polso mentre lanci la palla prende l'effetto.
let holding = false, holdT0 = 0, lastSend = 0, thrown = false;
let flipDir = store.get('ridotto-flipdir') === '1';
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
function analyse(samples) {
  if (samples.length < 6) return null;
  const u = principalAxis(samples);
  let th = 0, sigma = 0, prev = samples[0].t, minTh = 0; const rates = [];
  for (const s of samples) {
    const r = dot(s.w, u);
    if (!sigma && Math.abs(r) > 1.5) sigma = -Math.sign(r); // il primo movimento è all'indietro
    th += r * (s.t - prev); prev = s.t; rates.push({ t: s.t, r, th, w: s.w, a: s.a });
  }
  if (!sigma) sigma = 1;
  for (const x of rates) { x.r *= sigma; x.th *= sigma; minTh = Math.min(minTh, x.th); }
  return { u: u.map(c => c * sigma), th: th * sigma, minTh, rates };
}
function liveSwing() {
  if (thrown) return;
  const now = performance.now() / 1000;
  const a = analyse(buf.filter(s => s.t >= holdT0));
  if (!a) return;
  const m = $('#meter i'); m.style.left = (50 + Math.max(-48, Math.min(48, a.th * 30))) + '%';
  if (now - lastSend > 0.05) { lastSend = now; net && net.send({ t: 'swing', th: a.th }); }
  // rilascio automatico: dopo essere andato indietro, il braccio torna giù andando avanti veloce
  const last = a.rates[a.rates.length - 1];
  if (a.minTh < -0.35 && a.th > -0.05 && last.r > 3) release(false);
}
function release(byFinger) {
  const s = buf.filter(x => x.t >= holdT0);
  const a = analyse(s);
  if (!a || !myTurn) { if (motionOK) $('#bInfo').textContent = 'Non ho sentito il movimento: riprova'; return; }
  const tEnd = s[s.length - 1].t;
  const lastR = a.rates.filter(x => x.t > tEnd - 0.2);
  const peak = Math.max(0, ...lastR.map(x => x.r));
  if (peak < 1.2) { $('#bInfo').textContent = 'Troppo piano: braccio indietro e poi avanti, deciso'; net && net.send({ t: 'swing', th: 0 }); return; }
  thrown = true;
  // asse del braccio: l'accelerazione centripeta punta verso la spalla (sensori senza gravità);
  // se non c'è, prendiamo l'asse lungo del telefono
  let arm = [0, 0, 0], n = 0;
  for (const x of a.rates) if (x.a && x.r > 2.5) { const l = Math.hypot(...x.a); if (l > 3) { arm = arm.map((c, i) => c + x.a[i] / l); n++; } }
  arm = n >= 3 ? norm(arm) : [0, 1, 0];
  arm = norm(arm.map((c, i) => c - a.u[i] * dot(arm, a.u))); // perpendicolare all'asse di oscillazione
  const side = norm(cross(a.u, arm)); // rotazione attorno a questo asse = braccio che va di lato
  const tail = a.rates.filter(x => x.t > tEnd - 0.14);
  const avg = f => tail.reduce((acc, x) => acc + f(x), 0) / tail.length;
  const main = avg(x => dot(x.w, a.u)), lat = avg(x => dot(x.w, side)), twist = avg(x => dot(x.w, arm));
  let dir = Math.atan2(lat, Math.max(1, main)); if (flipDir) dir = -dir;      // radianti: + = destra
  let hook = Math.max(-1, Math.min(1, twist / 7)); if (flipHook) hook = -hook;
  if (Math.abs(hook) < 0.12) hook = 0;
  const timing = byFinger ? a.th : 0.1; // rilascio automatico = momento giusto
  const msg = { t: 'throw', power: Math.min(1.25, peak / 9.5), hook, timing, pull: Math.max(-0.05, Math.min(0.05, dir * 0.12)) };
  net && net.send(msg); myTurn = false; vibrate(40);
  const dTxt = Math.abs(dir) < 0.05 ? 'dritta' : dir < 0 ? 'verso sinistra' : 'verso destra';
  const hTxt = hook === 0 ? 'senza effetto' : hook < 0 ? 'effetto a sinistra' : 'effetto a destra';
  $('#bInfo').textContent = `Potenza ${(msg.power * 100).toFixed(0)}% · ${dTxt} · ${hTxt}`;
  holding = false; hold.classList.remove('on');
}
$('#flip').onclick = () => { flipHook = !flipHook; store.set('ridotto-flip', flipHook ? '1' : '0'); drawFlips(); };
$('#flipD').onclick = () => { flipDir = !flipDir; store.set('ridotto-flipdir', flipDir ? '1' : '0'); drawFlips(); };
function drawFlips() { $('#flip').textContent = flipHook ? 'Effetto invertito ✓' : 'Effetto al contrario?'; $('#flipD').textContent = flipDir ? 'Direzione invertita ✓' : 'Direzione al contrario?'; }
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
let gUp = [0, 1, 0], swingS = null, coolUntil = 0, lefty = store.get('ridotto-lefty') === '1';
$('#hand').textContent = lefty ? 'Mancino' : 'Destro';
$('#hand').onclick = () => { lefty = !lefty; store.set('ridotto-lefty', lefty ? '1' : '0'); $('#hand').textContent = lefty ? 'Mancino' : 'Destro'; };
function pongMotion(e) {
  const t = performance.now() / 1000, k = Math.PI / 180, r = e.rotationRate; if (!r) return;
  const w = [r.beta * k, r.gamma * k, r.alpha * k], mag = Math.hypot(...w);
  const ag = e.accelerationIncludingGravity, la = e.acceleration;
  if (ag && ag.x != null && mag < 2) { const n = norm([ag.x, ag.y, ag.z]); gUp = norm(gUp.map((v, i) => v * 0.9 + n[i] * 0.1)); }
  let lin = la && la.x != null ? [la.x, la.y, la.z] : ag && ag.x != null ? [ag.x - gUp[0] * 9.81, ag.y - gUp[1] * 9.81, ag.z - gUp[2] * 9.81] : [0, 0, 0];
  if (!swingS && mag > 6 && t > coolUntil) swingS = { peak: mag, tPeak: t, wPeak: w, acc: [] };
  if (swingS) {
    swingS.acc.push({ t, up: dot(lin, gUp) });
    if (mag > swingS.peak) { swingS.peak = mag; swingS.tPeak = t; swingS.wPeak = w; }
    if (mag < swingS.peak * 0.55 || t - swingS.tPeak > 0.12) {
      const s = swingS; swingS = null; coolUntil = t + 0.35;
      const ups = s.acc.filter(a => a.t >= s.tPeak - 0.15 && a.t <= s.tPeak + 0.03);
      const vert = Math.max(-1, Math.min(1, ups.reduce((a, b) => a + b.up, 0) / Math.max(1, ups.length) / 12));
      const yaw = dot(s.wPeak, gUp) / s.peak * (lefty ? -1 : 1);
      const twist = Math.max(-1, Math.min(1, s.wPeak[1] / s.peak));
      const p = Math.max(0.1, Math.min(1.4, s.peak / 16));
      net && net.send({ t: 'sw', ago: (performance.now() / 1000 - s.tPeak) * 1000, p, vert, yaw, twist });
      $('#pLast').textContent = `Colpo: forza ${(p * 100).toFixed(0)}% · ${vert > 0.3 ? 'verso l\'alto' : vert < -0.3 ? 'verso il basso' : 'piatto'}`;
      vibrate(25);
    }
  }
}
// col dito: strisciata sulla racchetta
const pr = $('#pRacket'); let ps = null;
pr.addEventListener('pointerdown', e => { pr.setPointerCapture(e.pointerId); ps = [{ t: performance.now(), x: e.clientX, y: e.clientY }]; });
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
