// Il telefono: ingresso, editor della maschera, comandi di gioco.
import * as THREE from 'three';
import { makeCharacter, disposeCharacter, normalizeLook, randomLook, EDIT_TABS, editorHTML, applyEdit } from './chars.js';
import { joinRoom } from './net.js';

const $ = s => document.querySelector(s), main = $('#main');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = v => new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 }).format(v);
const floor10 = v => Math.floor(v / 10) * 10;
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'], SUITS = ['♠', '♥', '♦', '♣'];
const NAME = { H: 'Carta', S: 'Sto', D: 'Raddoppio', P: 'Divido' };
const FORMAT = { libera: 'Partita libera', torneo: 'Torneo', ultimo: 'Ultimo in piedi' };
const RULES = { baro: 'Il baro', diavolo: 'Diavolo', segreta: 'Puntata segreta', freebet: 'Free Bet', laterali: 'Laterali', gufata: 'Gufata' };
const Q = new URLSearchParams(location.search);
let code = (Q.get('r') || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);

function load() { try { return JSON.parse(localStorage.getItem('ridotto-me') || 'null'); } catch (e) { return null; } }
function save() { try { localStorage.setItem('ridotto-me', JSON.stringify(me)); } catch (e) { /* si gioca lo stesso */ } }
const me = Object.assign({ name: '', look: randomLook(), pid: null, code: null }, load() || {});
me.look = normalizeLook(me.look);
let net = null, link = 'connecting', ST = null, joined = !!(me.pid && me.code === code && me.name), view = '', tab = 'mask', note = '';
let draft = null, draftFor = 0, sentFor = 0, sheet = null, promptSeen = 0, promptEnd = 0, wake = null;

// ---------------------------------------------------------------- rete
function hello() { if (net) net.send({ t: 'hello', pid: me.code === code ? me.pid : null, name: me.name, look: me.look }); }
function connect() {
  if (net) net.close();
  ST = null; link = 'connecting';
  net = joinRoom(code, {
    onState(s) { link = s; if (s === 'open' && joined) hello(); conn(); if (!ST || s !== 'open') render(); },
    onMsg(m) {
      if (m.t === 'welcome') { me.pid = m.pid; me.code = code; save(); }
      else if (m.t === 'kicked') { joined = false; ST = null; me.pid = null; save(); note = 'Sei stato tolto dal tavolo. Puoi rientrare.'; render(); }
      else if (m.t === 'state') { ST = m; if (m.you) { me.pid = m.you.pid; me.code = code; } render(); }
    },
  });
}
function conn() {
  const ok = link === 'open';
  $('#dot').className = 'dot' + (ok ? ' ok' : '');
  $('#conn').textContent = !code ? 'Nessuna sala' : ok ? 'Sala ' + code : link === 'noroom' ? 'Sala non trovata' : 'Mi collego…';
}
let profT = 0;
function sendProfile() { save(); clearTimeout(profT); profT = setTimeout(() => net && net.send({ t: 'profile', name: me.name, look: me.look }), 120); }
async function keepAwake() { try { if (!wake && navigator.wakeLock) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); } } catch (e) { /* non disponibile */ } }
document.addEventListener('visibilitychange', () => { if (!document.hidden && joined) keepAwake(); });

// ---------------------------------------------------------------- anteprima 3D
let PV = null;
function previewStart() {
  const el = $('#stage'); if (!el || PV) return;
  try {
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); r.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, .1, 20);
    cam.position.set(0, 1.55, -3.6); cam.lookAt(0, 1.5, 0);
    scene.add(new THREE.HemisphereLight(0xfff0dd, 0x2a1a12, 1.1));
    const d = new THREE.DirectionalLight(0xffe2b8, 2.3); d.position.set(1.5, 3, -4); scene.add(d);
    const rim = new THREE.PointLight(0xff9a48, 8, 8); rim.position.set(-1.6, 2.2, 1.6); scene.add(rim);
    el.prepend(r.domElement);
    PV = { r, scene, cam, el, ch: null, raf: 0, drag: 0, spin: 0, key: '' };
    let px = null;
    el.addEventListener('pointerdown', e => { px = e.clientX; });
    el.addEventListener('pointermove', e => { if (px !== null && PV) { PV.drag += (e.clientX - px) * .012; px = e.clientX; } });
    window.addEventListener('pointerup', () => { px = null; });
    const loop = t => {
      if (!PV) return;
      const w = el.clientWidth, h = el.clientHeight;
      if (r.domElement.width !== Math.round(w * r.getPixelRatio()) || r.domElement.height !== Math.round(h * r.getPixelRatio())) { r.setSize(w, h, false); cam.aspect = w / Math.max(1, h); cam.updateProjectionMatrix(); }
      if (PV.ch) { if (PV.ch.spin) PV.ch.spin.rotation.y = t / 60; PV.ch.group.rotation.y = Math.sin(t / 1400) * .45 + PV.drag; PV.ch.head.rotation.x = -.05 + Math.sin(t / 900) * .05; }
      r.render(scene, cam); PV.raf = requestAnimationFrame(loop);
    };
    previewLook(); PV.raf = requestAnimationFrame(loop);
  } catch (e) { PV = null; }
}
function previewLook() {
  if (!PV) return; const key = JSON.stringify(me.look); if (key === PV.key) return; PV.key = key;
  if (PV.ch) disposeCharacter(PV.ch);
  PV.ch = makeCharacter(me.look, { standing: false }); PV.scene.add(PV.ch.group);
}
function previewStop() { if (!PV) return; cancelAnimationFrame(PV.raf); if (PV.ch) disposeCharacter(PV.ch); PV.r.dispose(); PV.r.domElement.remove(); PV = null; }

// ---------------------------------------------------------------- viste
function cardHTML(c) { if (c < 0) return '<div class="cd back"></div>'; if (c === 100) return '<div class="cd r"><span>★<small style="font-size:11px">Jolly</small></span></div>'; const r = RANKS[c % 13], s = SUITS[Math.floor(c / 13) % 4]; return `<div class="cd${s === '♥' || s === '♦' ? ' r' : ''}"><span>${r}<small>${s}</small></span></div>`; }
const cardTxt = c => RANKS[c % 13] + SUITS[Math.floor(c / 13) % 4];
function whichView() {
  if (!code) return 'code'; if (!joined) return 'join'; if (!ST) return 'wait';
  if (ST.phase === 'busy' || ST.phase === 'full') return ST.phase;
  return ST.phase;
}
function render() {
  conn();
  const v = whichView();
  if (v !== view) { if (view === 'lobby') previewStop(); view = v; sheet = null; build(v); }
  if (v === 'lobby') updateLobby(); else if (v === 'game') main.innerHTML = gameHTML(); else if (v === 'end') main.innerHTML = endHTML();
}
function build(v) {
  if (v === 'code') main.innerHTML = `<h2>In quale sala?</h2><p class="muted">Scrivi le quattro lettere che vedi sullo schermo del tavolo, oppure inquadra il codice QR.</p><input class="field" id="codeIn" maxlength="4" placeholder="ABCD" autocapitalize="characters" autocomplete="off"><button class="btn gold big" data-do="code">Avanti</button>`;
  else if (v === 'join') main.innerHTML = `<h2>Benvenuto al Ridotto</h2><p class="muted">Sala ${esc(code)}. Scrivi come ti chiami: il nome comparirà sopra la tua maschera.</p>${note ? `<p class="it">${esc(note)}</p>` : ''}
    <input class="field" id="nameIn" maxlength="14" placeholder="Il tuo nome" autocomplete="off" value="${esc(me.name)}"><button class="btn gold big" data-do="enter">Entra</button>
    <p class="muted" id="joinMsg">${link === 'noroom' ? 'Non trovo la sala: controlla che la pagina del tavolo sia aperta sul computer.' : ''}</p>`;
  else if (v === 'wait') main.innerHTML = `<h2>Entro nella sala ${esc(code)}…</h2><p class="muted">${link === 'noroom' ? 'Non trovo la sala. Controlla che la pagina del tavolo sia aperta sul computer e che il codice sia giusto.' : 'Un momento.'}</p><button class="btn" data-do="leave">Cambia nome o sala</button>`;
  else if (v === 'busy') main.innerHTML = `<h2>Partita in corso</h2><p class="muted">Al tavolo stanno giocando. Entrerai appena tornano in sala d'attesa: tieni aperta questa pagina.</p>`;
  else if (v === 'full') main.innerHTML = `<h2>Tavolo pieno</h2><p class="muted">Ci sono già sei giocatori. Chiedi a chi ha il computer di liberare un posto.</p>`;
  else if (v === 'lobby') {
    main.innerHTML = `<div id="stage"><div class="who" id="who"></div></div>
      <div class="row"><input class="field" id="name2" maxlength="14" autocomplete="off" value="${esc(me.name)}" style="flex:2 1 0"><button class="btn paper" data-do="dice">Sorpresa!</button></div>
      <div class="tabs" id="tabs" role="tablist">${EDIT_TABS.map(([k, l]) => `<button role="tab" data-tab="${k}">${l}</button>`).join('')}</div>
      <div id="editor" style="display:grid; gap:10px"></div><div class="panel" id="info"></div>`;
    previewStart(); editor();
  }
}
function editor() {
  const ed = $('#editor'); if (!ed) return;
  document.querySelectorAll('#tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
  ed.innerHTML = editorHTML(me.look, tab);
}
function updateLobby() {
  const w = $('#who'); if (w) w.textContent = me.name;
  const info = $('#info'); if (!info || !ST) return;
  const c = ST.cfg, on = Object.keys(c.rules).filter(k => c.rules[k]);
  info.innerHTML = `<h3>LA SERATA</h3><p>${c.game === 'dubito' ? '<b>Dubito</b> · bugiardi e pistola: le tue carte le vedi solo tu, qui.' : `<b>Blackjack · ${FORMAT[c.format]}</b>${c.format === 'torneo' ? ' · ' + c.hands + ' mani' : ''} · banco ${c.bank === 'turno' ? 'a turno' : 'della casa'}`}</p>
    ${on.length && c.game !== 'dubito' ? `<div class="tags">${on.map(k => `<span>${RULES[k].toUpperCase()}</span>`).join('')}</div>` : ''}
    <p class="muted">Al tavolo: ${ST.players.map(p => esc(p.name)).join(', ')}. La tua maschera è già sullo schermo grande; la partita la fa partire chi ha il computer.</p>`;
}
let dsel = new Set(), dselFor = 0;
function dubHTML() {
  const y = ST.you, d = ST.dub, pr = ST.prompt, RN = { 12: ['Re', 'Re'], 11: ['Regina', 'Regine'], 0: ['Asso', 'Assi'] }[d.rank], mine = pr && pr.kind === 'dub';
  if (pr && pr.id !== promptSeen) { promptSeen = pr.id; promptEnd = pr.left ? Date.now() + pr.left : 0; if (navigator.vibrate) { try { navigator.vibrate(70); } catch (e) { /* niente vibrazione */ } } }
  if (mine && dselFor !== pr.id) { dselFor = pr.id; dsel = new Set(); }
  let h = `<div class="me"><div><h3>${esc(y.name).toUpperCase()}</h3><div class="chips">${y.alive ? d.hand.length : 'fuori'}<small>${y.alive ? 'CARTE IN MANO' : ''}</small></div></div><div class="muted" style="text-align:right">Giro ${d.round}<br>mazzetto: ${d.pile}</div></div>`;
  h += `<div class="status">${esc(ST.status)}</div>`;
  h += `<div class="felt"><div style="text-align:center"><h3>CARTA DEL TAVOLO</h3><div style="font:400 40px/1.1 var(--display);color:var(--gold)">${RN[1].toUpperCase()}</div></div>
    <div class="tags" style="justify-content:center">${d.seats.map(s => `<span style="${s.alive ? '' : 'opacity:.4;text-decoration:line-through'}${s.me ? ';background:var(--gold);color:var(--ink)' : ''}">${esc(s.name).toUpperCase()} · ${s.n} · ${s.pulls}/6</span>`).join('')}</div></div>`;
  if (d.reveal) h += `<div class="panel"><h3>CARTE SCOPERTE</h3><div class="line"><div class="cards">${d.reveal.cards.map(cardHTML).join('')}</div><span class="tot ${d.reveal.lie ? 'bust' : 'win'}">${d.reveal.lie ? esc(d.reveal.liar) + ' mentiva' : esc(d.reveal.liar) + ' era onesto'}</span></div></div>`;
  if (y.alive && d.hand.length) h += `<h3>LE TUE CARTE${mine ? ' · TOCCANE DA 1 A 3' : ''}</h3><div class="handrow">${d.hand.map((c, i) => `<button class="cdb${dsel.has(i) && mine ? ' sel' : ''}" data-dc="${i}" ${mine ? '' : 'disabled'}>${cardHTML(c)}</button>`).join('')}</div>`;
  if (mine) {
    const k = dsel.size;
    h += (promptEnd ? `<div class="timer"><i style="animation-duration:${Math.max(200, promptEnd - Date.now())}ms"></i></div>` : '') +
      `<button class="btn gold big" data-do="dplay" ${k ? '' : 'disabled'}>${k ? 'Gioca ' + k + ' come ' + RN[k > 1 ? 1 : 0] : 'Scegli le carte'}<small>coperte: puoi anche mentire</small></button>` +
      (pr.canCall && d.last ? `<button class="btn red big" data-do="dcall">Dubito!<small>${esc(d.last.name)} ha dichiarato ${d.last.n} ${RN[d.last.n > 1 ? 1 : 0]}</small></button>` : '');
  } else h += `<p class="it" style="text-align:center">${!y.alive ? 'La tua maschera è in pezzi: resta a guardare.' : ST.turn && ST.turn !== y.pid ? 'Tocca a ' + esc(ST.turnName) + '.' : 'Guarda il tavolo.'}</p>`;
  return h + `<div class="spacer"></div><div class="phr">${(ST.phrases || []).map((p, i) => `<button data-say="${i}">${esc(p)}</button>`).join('')}</div>`;
}
function gameHTML() {
  if (ST.cfg.game === 'dubito' && ST.dub) return dubHTML();
  const y = ST.you, pr = ST.prompt, c = ST.cfg;
  if (pr && pr.id !== promptSeen) { promptSeen = pr.id; promptEnd = pr.left ? Date.now() + pr.left : 0; sheet = null; if (pr.kind !== 'bet' && navigator.vibrate) { try { navigator.vibrate(pr.kind === 'pact' ? [80, 60, 80] : 70); } catch (e) { /* niente vibrazione */ } } }
  let h = `<div class="me"><div><h3>${esc(y.name).toUpperCase()}${y.banker ? ' · TIENI IL BANCO' : ''}${c.format === 'ultimo' && y.alive && y.lives === 1 ? ' · MASCHERA INCRINATA' : ''}</h3><div class="chips">${y.alive ? fmt(y.chips) : 'fuori'}<small>${y.alive ? 'FICHES' : ''}</small></div></div>
    <div class="muted" style="text-align:right">Mano ${ST.hand}${c.format === 'torneo' ? ' di ' + c.hands : ''}${ST.minBet > 10 ? '<br>minima ' + fmt(ST.minBet) : ''}</div></div>`;
  h += `<div class="status">${esc(ST.status)}</div>`;
  if (ST.dealer.cards.length || ST.hands.length) {
    h += `<div class="felt"><div class="line"><span class="lbl">BANCO</span><div class="cards">${ST.dealer.cards.map(cardHTML).join('')}</div>${ST.dealer.total ? `<span class="tot">${esc(ST.dealer.total)}</span>` : ''}</div>`;
    ST.hands.forEach((x, i) => {
      const done = x.res && ST.stage === 'settle', cls = done ? (x.delta > 0 ? ' win' : x.delta < 0 ? ' bust' : '') : (x.total === 'Blackjack' ? ' gold' : (+x.total > 21 ? ' bust' : ''));
      h += `<div class="hand${x.active ? ' active' : ''}"><span class="lbl" style="font:400 11px var(--display);letter-spacing:.14em;width:54px">${ST.hands.length > 1 ? 'MANO ' + (i + 1) : 'TU'}</span><div class="cards">${x.cards.map(cardHTML).join('')}</div><span class="tot${cls}">${done ? (x.delta > 0 ? '+' + fmt(x.delta) : x.delta < 0 ? '−' + fmt(-x.delta) : esc(x.res)) : esc(x.total)}</span>
        <span class="st">${done ? esc(x.res) : 'puntata ' + fmt(x.stake + x.free) + (x.free ? ' (gratis ' + fmt(x.free) + ')' : '') + (x.mult > 1 ? ' · PATTO ×3' : '')}</span></div>`;
    });
    h += '</div>';
  }
  if (ST.peek !== null && ST.peek !== undefined) h += `<div class="panel"><p><b>Hai sbirciato:</b> il banco nasconde ${cardTxt(ST.peek)}.</p></div>`;
  const timer = pr && promptEnd ? `<div class="timer"><i style="animation-duration:${Math.max(200, promptEnd - Date.now())}ms"></i></div>` : '';
  if (sheet === 'cheat' && ST.can.cheat) {
    h += `<h2>Quale trucco?</h2><p class="muted">Ne hai uno solo. Se qualcuno ti vede e grida "Baro!", perdi la mano e paghi la multa.</p>
      <button class="btn red big" data-cheat="peek">Sbircia<small>guardi la carta coperta del banco</small></button>
      <button class="btn red big" data-cheat="swap">Cambia carta<small>l'ultima, con una a caso</small></button>
      <button class="btn red big" data-cheat="ace">Asso nella manica<small>l'ultima carta diventa un asso</small></button>
      <button class="btn" data-do="closeSheet">Lascia stare</button>`;
  } else if (sheet === 'accuse' && ST.can.accuse) {
    h += `<h2>Chi sta barando?</h2><p class="muted">Se hai ragione incassi la multa. Se sbagli, paghi tu 50 fiches di scuse.</p>
      ${ST.players.filter(p => p.inRound && p.pid !== y.pid).map(p => `<button class="btn red big" data-accuse="${p.pid}">${esc(p.name)}</button>`).join('')}<button class="btn" data-do="closeSheet">Nessuno, mi sbagliavo</button>`;
  } else if (pr && pr.kind === 'bet') {
    const max = Math.max(10, Math.min(pr.max, floor10(y.chips))), min = Math.min(pr.min, max);
    if (draftFor !== pr.id) { draftFor = pr.id; draft = { bet: Math.max(min, Math.min(max, pr.last || min)), pp: 0, t3: 0, gufo: null, secret: false }; }
    const f = draft, sent = sentFor === pr.id, chip = (v, col) => `<button class="chip" style="--c:${col}" data-chip="${v}" ${f.bet + v > max || sent ? 'disabled' : ''}><span>+${v}</span></button>`;
    const sg = (k, cur) => `<div class="seg">${[0, 10, 20, 50].map(v => `<button data-side="${k}" data-v="${v}" aria-pressed="${cur === v}">${v || 'No'}</button>`).join('')}</div>`;
    h += timer + `<div class="betnum"><small>LA TUA PUNTATA${min > 10 ? ' · MINIMA ' + fmt(min) : ''}</small>${fmt(f.bet)}</div>
      <div class="chiprow">${chip(10, '#2a3f6b')}${chip(50, '#1e5a3a')}${chip(100, '#17110d')}${max >= 500 ? chip(500, '#4a2260') : ''}</div>
      <div class="row"><button class="btn" data-bet="min">Minimo</button><button class="btn" data-bet="half">Metà</button><button class="btn" data-bet="max">Tutto</button></div>`;
    if (pr.side) h += `<div class="panel"><h3>COPPIA PERFETTA · FINO A 30 A 1</h3>${sg('pp', f.pp)}<h3>21+3 · LE TUE CARTE PIÙ QUELLA DEL BANCO</h3>${sg('t3', f.t3)}</div>`;
    if (pr.secret) h += `<button class="btn${f.secret ? ' on' : ''}" data-do="secret">Puntata segreta: ${f.secret ? 'sì, sotto la campana' : 'no'}</button>`;
    if (pr.gufo && pr.gufo.length) h += `<div class="panel"><h3>GUFATA · SE SBALLA INCASSI 3 A 1</h3><div class="opts"><button data-gufo="" aria-pressed="${!f.gufo}">Nessuno</button>${pr.gufo.map(t => `<button data-gufo="${t.pid}" aria-pressed="${!!f.gufo && f.gufo.pid === t.pid}">${esc(t.name)}</button>`).join('')}</div>${f.gufo ? `<div class="seg">${[10, 20, 50].map(v => `<button data-gamt="${v}" aria-pressed="${f.gufo.amt === v}">${v}</button>`).join('')}</div>` : ''}</div>`;
    h += `<button class="btn gold big" data-do="bet" ${sent ? 'disabled' : ''}>${sent ? 'Puntata inviata' : 'Punta ' + fmt(f.bet)}</button>`;
  } else if (pr && pr.kind === 'act') {
    const b = (a, sub) => `<button class="btn paper big${pr.best === a ? ' hint' : ''}" data-act="${a}" ${pr.allowed.includes(a) ? '' : 'disabled'}>${NAME[a]}<small>${sub}</small></button>`;
    h += timer + `<h2>Tocca a te${ST.hands.length > 1 ? ' · mano ' + (pr.hi + 1) : ''}</h2><div class="grid2">${b('H', 'un\'altra carta')}${b('S', 'mi fermo')}${b('D', pr.freeD ? 'gratis, paga il banco' : 'una carta, puntata doppia')}${b('P', pr.freeP ? 'gratis, paga il banco' : 'due mani')}</div>`;
    if (pr.best) h += `<div class="panel"><h3>IL CONSIGLIO DEL DOTTORE</h3><p><b>${NAME[pr.best]}.</b> ${esc(pr.why || '')}</p></div>`;
    if (ST.can.cheat) h += `<button class="btn" data-do="cheat">Trucchi (ne hai uno)</button>`;
  } else if (pr && pr.kind === 'pact') {
    h += timer + `<div class="pact"><h2>Il Diavolo ti offre un patto</h2><p>Se accetti, questa mano vale <b>il triplo</b>: se vinci incassi tre volte, se perdi paghi tre volte (fin dove arrivano le tue fiches).</p><p class="it">Hai ${pr.total || 'ancora niente'} e ${fmt(pr.stake)} fiches sul tavolo.</p>
      <div class="grid2"><button class="btn red big" data-pact="1">Accetto</button><button class="btn paper big" data-pact="0">Rifiuto</button></div></div>`;
  } else {
    h += `<p class="it" style="text-align:center">${!y.alive ? 'Sei fuori dalla partita: resta a guardare (e a gufare).' : y.banker && ST.stage !== 'settle' ? 'Tieni il banco: in questa mano paghi e incassi tu.' : ST.turn && ST.turn !== y.pid ? 'Tocca a ' + esc(ST.turnName) + '.' : y.betDone ? 'Puntata fatta. Aspetta gli altri.' : 'Guarda il tavolo.'}</p>`;
    if (ST.side && (ST.side.pp || ST.side.t3 || ST.side.gufo || ST.side.secret) && ST.stage !== 'bet') { const g = ST.side.gufo && ST.players.find(p => p.pid === ST.side.gufo.pid); h += `<div class="tags">${ST.side.secret ? '<span>PUNTATA SEGRETA</span>' : ''}${ST.side.pp ? `<span>COPPIA ${ST.side.pp}</span>` : ''}${ST.side.t3 ? `<span>21+3 ${ST.side.t3}</span>` : ''}${g ? `<span>GUFATA SU ${esc(g.name).toUpperCase()}</span>` : ''}</div>`; }
  }
  h += '<div class="spacer"></div>';
  if (!sheet && ST.can.accuse) h += `<button class="btn red" data-do="accuse">Baro! Accusa qualcuno</button>`;
  if (!sheet) h += `<div class="phr">${(ST.phrases || []).map((p, i) => `<button data-say="${i}">${esc(p)}</button>`).join('')}</div>`;
  return h;
}
function endHTML() {
  const r = ST.rank || [], mine = r.find(x => x.pid === ST.you.pid);
  return `<h2>${mine && mine.pos === 1 ? 'Hai vinto tu!' : esc(r[0] ? r[0].name : '') + ' vince'}</h2><p class="muted">${mine ? 'Sei arrivato ' + mine.pos + '° su ' + r.length + '.' : ''}</p>
    <div class="rank">${r.map(x => `<div class="${x.pid === ST.you.pid ? 'me' : ''}"><span>${x.pos}.</span><span>${esc(x.name)}</span><b>${x.label || (x.out ? 'fuori' : fmt(x.chips))}</b></div>`).join('')}</div>
    <p class="muted">Rivincita o nuove regole: decide chi ha il computer. Tieni aperta questa pagina.</p>
    <div class="spacer"></div><div class="phr">${(ST.phrases || []).map((p, i) => `<button data-say="${i}">${esc(p)}</button>`).join('')}</div>`;
}

// ---------------------------------------------------------------- comandi
main.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  const d = b.dataset; keepAwake();
  if (d.do === 'code') { const v = ($('#codeIn').value || '').toUpperCase().replace(/[^A-Z]/g, ''); if (v.length === 4) { code = v; history.replaceState(null, '', '?r=' + code + (Q.get('peer') ? '&peer=' + Q.get('peer') : '')); joined = false; connect(); render(); } return; }
  if (d.do === 'enter') { const v = ($('#nameIn').value || '').replace(/\s+/g, ' ').trim().slice(0, 14); if (!v) { $('#nameIn').focus(); return; } me.name = v; note = ''; joined = true; save(); hello(); render(); return; }
  if (d.do === 'leave') { joined = false; me.pid = null; save(); render(); return; }
  if (d.do === 'dice') { me.look = normalizeLook(randomLook()); previewLook(); editor(); sendProfile(); return; }
  if (d.tab) { tab = d.tab; editor(); return; }
  if (d.set || d.col) { if (applyEdit(me.look, d)) { me.look = normalizeLook(me.look); previewLook(); editor(); sendProfile(); } return; }
  if (d.say !== undefined) { net.send({ t: 'say', i: +d.say }); b.style.opacity = .4; setTimeout(() => { b.style.opacity = ''; }, 1500); return; }
  if (!ST) return;
  const pr = ST.prompt;
  if (d.do === 'closeSheet') { sheet = null; render(); return; }
  if (d.do === 'cheat') { sheet = 'cheat'; render(); return; }
  if (d.do === 'accuse') { sheet = 'accuse'; render(); return; }
  if (d.cheat) { net.send({ t: 'cheat', kind: d.cheat }); sheet = null; render(); return; }
  if (d.accuse) { net.send({ t: 'accuse', target: d.accuse }); sheet = null; render(); return; }
  if (!pr) return;
  if (pr.kind === 'dub') {
    if (d.dc !== undefined) { const i = +d.dc; if (dsel.has(i)) dsel.delete(i); else if (dsel.size < 3) dsel.add(i); render(); }
    else if (d.do === 'dplay' && dsel.size) { net.send({ t: 'reply', id: pr.id, v: { play: [...dsel] } }); b.disabled = true; }
    else if (d.do === 'dcall') { net.send({ t: 'reply', id: pr.id, v: { call: true } }); b.disabled = true; }
    return;
  }
  if (pr.kind === 'bet' && draft) {
    const max = Math.max(10, Math.min(pr.max, floor10(ST.you.chips))), min = Math.min(pr.min, max), f = draft;
    if (d.chip) f.bet = Math.min(max, f.bet + +d.chip);
    else if (d.bet === 'min') f.bet = min; else if (d.bet === 'max') f.bet = max; else if (d.bet === 'half') f.bet = Math.max(min, floor10(max / 2));
    else if (d.side) f[d.side] = +d.v;
    else if (d.do === 'secret') f.secret = !f.secret;
    else if (d.gufo !== undefined) f.gufo = d.gufo ? { pid: d.gufo, amt: f.gufo ? f.gufo.amt : 20 } : null;
    else if (d.gamt && f.gufo) f.gufo.amt = +d.gamt;
    else if (d.do === 'bet') { sentFor = pr.id; net.send({ t: 'reply', id: pr.id, v: f }); }
    render(); return;
  }
  if (pr.kind === 'act' && d.act) { net.send({ t: 'reply', id: pr.id, v: d.act }); main.querySelectorAll('[data-act]').forEach(x => { x.disabled = true; }); return; }
  if (pr.kind === 'pact' && d.pact) { net.send({ t: 'reply', id: pr.id, v: d.pact === '1' }); main.querySelectorAll('[data-pact]').forEach(x => { x.disabled = true; }); }
});
main.addEventListener('change', e => { if (e.target.id === 'name2') { const v = e.target.value.replace(/\s+/g, ' ').trim().slice(0, 14); if (v) { me.name = v; sendProfile(); updateLobby(); } else e.target.value = me.name; } });
main.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.target.id === 'nameIn' || e.target.id === 'codeIn')) { e.preventDefault(); main.querySelector('[data-do="enter"], [data-do="code"]').click(); } });

if (code) connect();
render();
