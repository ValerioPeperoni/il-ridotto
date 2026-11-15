// Personaggi componibili: maschera, cappello, parrucca, abito, colletto, accessorio.
// Usato sia dal tavolo (schermo grande) sia dal telefono (anteprima).
import * as THREE from 'three';

export const MASK_COLS = [['Avorio', '#eee7d8'], ['Oro', '#d4a94a'], ['Nero', '#1c1718'], ['Rosso', '#a3221d'], ['Blu notte', '#24365e'], ['Verde', '#1f5a3a'], ['Viola', '#5b2a6e'], ['Rosa', '#e3a0b4'], ['Argento', '#b9bcc2']];
export const CLOTH_COLS = [['Nero', '#17141c'], ['Bordeaux', '#6e1418'], ['Blu', '#1f2f55'], ['Verde', '#1d4a33'], ['Viola', '#4a2260'], ['Oro', '#b8892f'], ['Bianco', '#e9e2d0'], ['Rosso', '#b3221d'], ['Azzurro', '#5d8fb0'], ['Arancio', '#c8641e'], ['Rosa', '#c9708a'], ['Grigio', '#5a5a62']];
export const WIG_COLS = [['Bianco', '#e9e4da'], ['Grigio', '#8f8f95'], ['Nero', '#17120f'], ['Castano', '#5a3520'], ['Rosso', '#a8431c'], ['Biondo', '#d8b45a'], ['Rosa', '#e58fb1'], ['Azzurro', '#74b7d6'], ['Verde', '#5fae5a']];
export const SKINS = [['Chiara', '#f0d2bc'], ['Rosata', '#e6c2a2'], ['Olivastra', '#c99a72'], ['Scura', '#8a5a3c']];
export const PARTS = {
  mask: [['bauta', 'Bauta'], ['volto', 'Volto'], ['medico', 'Medico della peste'], ['colombina', 'Colombina'], ['arlecchino', 'Arlecchino'], ['gatto', 'Gatto'], ['jolly', 'Jolly'], ['teschio', 'Teschio'], ['sole', 'Sole'], ['diavolo', 'Diavolo'], ['capitano', 'Nasone'], ['moretta', 'Moretta'], ['nessuna', 'Faccia nuda'], ['robot', 'Cyborg'], ['dino', 'Dinosauro'], ['alieno', 'Alieno'], ['zucca', 'Zucca']],
  hat: [['none', 'Niente'], ['tricorno', 'Tricorno'], ['cilindro', 'Cilindro'], ['piumato', 'Piumato'], ['corona', 'Corona'], ['giullare', 'Giullare'], ['cuoco', 'Cuoco'], ['pentola', 'Pentola'], ['candela', 'Candela'], ['piccione', 'Piccione'], ['paglietta', 'Gondoliere'], ['turbante', 'Turbante'], ['festa', 'Cono da festa'], ['aureola', 'Aureola'], ['pesce', 'Pesce'], ['vichingo', 'Elmo con le corna'], ['renna', 'Corna di renna'], ['antenne', 'Antenne'], ['elica', 'Cappellino a elica'], ['cowboy', 'Cowboy'], ['astronauta', 'Casco spaziale'], ['fungo', 'Fungo'], ['pinna', 'Pinna di squalo']],
  wig: [['none', 'Pelato'], ['parrucca', 'Parrucca'], ['alta', 'Parruccone'], ['ricci', 'Ricci'], ['codino', 'Codino'], ['cresta', 'Cresta']],
  suit: [['abito', 'Abito'], ['dino', 'Dinosauro'], ['cyborg', 'Cyborg'], ['astronauta', 'Astronauta'], ['scheletro', 'Scheletro'], ['cavaliere', 'Cavaliere'], ['supereroe', 'Supereroe'], ['banana', 'Banana']],
  pat: [['tinta', 'Tinta unita'], ['righe', 'Righe'], ['rombi', 'Rombi'], ['pois', 'Pois'], ['broccato', 'Broccato'], ['scacchi', 'Scacchi']],
  collar: [['gorgiera', 'Gorgiera'], ['gorgierona', 'Gorgiera gigante'], ['mantello', 'Mantello'], ['jabot', 'Pizzo'], ['farfallino', 'Farfallino'], ['none', 'Niente']],
  acc: [['none', 'Niente'], ['monocolo', 'Monocolo'], ['occhiali', 'Occhialini'], ['baffi', 'Baffi'], ['barba', 'Barba'], ['pipa', 'Pipa'], ['rosa', 'Rosa in bocca'], ['naso', 'Naso rosso'], ['benda', 'Benda'], ['ventaglio', 'Ventaglio'], ['calice', 'Calice'], ['ali', 'Ali'], ['pappagallo', 'Pappagallo'], ['cuffie', 'Cuffie']],
};
const ids = k => PARTS[k].map(x => x[0]);
const pick = (v, list, d) => list.includes(v) ? v : d;
const idx = (v, n, d = 0) => Number.isInteger(v) && v >= 0 && v < n ? v : d;
export function normalizeLook(l) {
  l = l && typeof l === 'object' ? l : {};
  return {
    mask: pick(l.mask, ids('mask'), 'bauta'), mc: idx(l.mc, MASK_COLS.length), sk: idx(l.sk, SKINS.length, 1),
    hat: pick(l.hat, ids('hat'), 'tricorno'), hc: idx(l.hc, CLOTH_COLS.length), wig: pick(l.wig, ids('wig'), 'parrucca'), wc: idx(l.wc, WIG_COLS.length),
    c1: idx(l.c1, CLOTH_COLS.length), c2: idx(l.c2, CLOTH_COLS.length, 5), pat: pick(l.pat, ids('pat'), 'tinta'), suit: pick(l.suit, ids('suit'), 'abito'),
    collar: pick(l.collar, ids('collar'), 'gorgiera'), acc: pick(l.acc, ids('acc'), 'none'),
  };
}
export function randomLook(rand = Math.random) {
  const r = n => Math.floor(rand() * n), one = k => PARTS[k][r(PARTS[k].length)][0];
  let c1 = r(CLOTH_COLS.length), c2 = r(CLOTH_COLS.length); if (c2 === c1) c2 = (c1 + 5) % CLOTH_COLS.length;
  return { mask: one('mask'), mc: r(MASK_COLS.length), sk: r(SKINS.length), hat: one('hat'), hc: r(CLOTH_COLS.length), wig: one('wig'), wc: r(WIG_COLS.length), c1, c2, pat: one('pat'), collar: one('collar'), acc: one('acc'), suit: rand() < .45 ? 'abito' : one('suit') };
}
export const CROUPIER = { mask: 'bauta', mc: 0, sk: 1, hat: 'tricorno', hc: 0, wig: 'parrucca', wc: 0, c1: 1, c2: 5, pat: 'broccato', collar: 'jabot', acc: 'none' };
export const BOTS = [
  { name: 'Il Dottore', style: 'perfect', look: { mask: 'medico', mc: 0, sk: 1, hat: 'cilindro', hc: 0, wig: 'none', wc: 2, c1: 11, c2: 0, pat: 'tinta', collar: 'mantello', acc: 'none' } },
  { name: 'Colombina', style: 'gut', look: { mask: 'colombina', mc: 1, sk: 0, hat: 'none', hc: 0, wig: 'alta', wc: 0, c1: 8, c2: 6, pat: 'broccato', collar: 'jabot', acc: 'ventaglio' } },
  { name: 'Arlecchino', style: 'mimic', look: { mask: 'arlecchino', mc: 2, sk: 2, hat: 'giullare', hc: 7, wig: 'none', wc: 2, c1: 7, c2: 3, pat: 'rombi', collar: 'gorgiera', acc: 'none' } },
  { name: 'Il Capitano', style: 'nobust', look: { mask: 'capitano', mc: 3, sk: 2, hat: 'piumato', hc: 1, wig: 'ricci', wc: 2, c1: 1, c2: 5, pat: 'righe', collar: 'gorgiera', acc: 'baffi' } },
  { name: 'Pulcinella', style: 'gut', look: { mask: 'capitano', mc: 2, sk: 1, hat: 'cuoco', hc: 6, wig: 'none', wc: 2, c1: 6, c2: 11, pat: 'tinta', collar: 'gorgierona', acc: 'none' } },
];

// ---------------------------------------------------------------- texture
const GOLD = '#d6b062';
function tex(w, h, draw, rep) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
}
const clothCache = new Map();
function clothTex(pat, a, b) {
  const key = pat + a + b; if (clothCache.has(key)) return clothCache.get(key);
  const t = tex(256, 256, (g, w, h) => {
    g.fillStyle = a; g.fillRect(0, 0, w, h);
    if (pat === 'righe') { g.fillStyle = b; for (let x = 0; x < w; x += 64) g.fillRect(x, 0, 26, h); }
    else if (pat === 'rombi') {
      const s = 64; g.fillStyle = b;
      for (let y = -1; y < 5; y++) for (let x = -1; x < 5; x++) { const cx = x * s + (y % 2 ? s / 2 : 0), cy = y * s; g.beginPath(); g.moveTo(cx, cy - s / 2); g.lineTo(cx + s / 4, cy); g.lineTo(cx, cy + s / 2); g.lineTo(cx - s / 4, cy); g.fill(); }
      g.strokeStyle = 'rgba(214,176,98,.7)'; g.lineWidth = 2; for (let k = -h; k < w + h; k += s / 2) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + h / 2, h); g.stroke(); g.beginPath(); g.moveTo(k + h / 2, 0); g.lineTo(k, h); g.stroke(); }
    }
    else if (pat === 'pois') { g.fillStyle = b; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.beginPath(); g.arc(x * 64 + (y % 2 ? 32 : 0) + 16, y * 64 + 32, 15, 0, 7); g.fill(); } }
    else if (pat === 'scacchi') { g.fillStyle = b; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if ((x + y) % 2) g.fillRect(x * 64, y * 64, 64, 64); }
    else if (pat === 'broccato') {
      g.strokeStyle = b; g.lineWidth = 5; g.globalAlpha = .85;
      for (const [ox, oy] of [[64, 64], [192, 192], [192, 64], [64, 192]]) {
        g.save(); g.translate(ox, oy);
        for (let k = 0; k < 4; k++) { g.rotate(Math.PI / 2); g.beginPath(); g.moveTo(0, 6); g.bezierCurveTo(26, 14, 34, 44, 8, 56); g.bezierCurveTo(24, 40, 14, 22, 0, 24); g.stroke(); }
        g.beginPath(); g.arc(0, 0, 7, 0, 7); g.stroke(); g.restore();
      }
      g.globalAlpha = 1;
    }
    for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * .12})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  }, [pat === 'tinta' ? 1 : 5, pat === 'tinta' ? 1 : 3]);
  clothCache.set(key, t); return t;
}
function dark(hex, k) { const c = new THREE.Color(hex); c.multiplyScalar(k); return '#' + c.getHexString(); }
function isDark(hex) { const c = new THREE.Color(hex); return c.r + c.g + c.b < .9; }
const maskCache = new Map();
function maskTex(kind, col, skin, cracks) {
  const key = [kind, col, skin, cracks].join('|'); if (maskCache.has(key)) return maskCache.get(key);
  const t = tex(256, 256, (g, w, h) => {
    const ink = isDark(col) ? GOLD : '#2a1a10', deco = isDark(col) ? GOLD : '#b8954a';
    const fill = c => { g.fillStyle = c; g.fillRect(0, 0, w, h); };
    const shade = (a = .35) => { const r = g.createRadialGradient(w / 2, h * .45, 20, w / 2, h * .5, w * .7); r.addColorStop(0, 'rgba(0,0,0,0)'); r.addColorStop(1, `rgba(0,0,0,${a})`); g.fillStyle = r; g.fillRect(0, 0, w, h); };
    const eyes = (rx = 20, ry = 11, y = 106, tilt = 0, c = '#050304') => {
      for (const s of [-1, 1]) { g.save(); g.translate(128 + s * 42, y); g.rotate(s * tilt); g.fillStyle = c; g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(255,225,180,.6)'; g.beginPath(); g.arc(4, -3, 2.2, 0, 7); g.fill(); g.restore(); }
    };
    const face = () => { fill(skin); g.fillStyle = 'rgba(220,110,110,.3)'; for (const x of [70, 186]) { g.beginPath(); g.arc(x, 162, 18, 0, 7); g.fill(); } };
    const smile = (c = '#6a2a20', y = 186, r = 34) => { g.strokeStyle = c; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(128 - r, y); g.quadraticCurveTo(128, y + r * .7, 128 + r, y); g.stroke(); };
    if (kind === 'bauta') {
      fill(col); shade();
      g.strokeStyle = deco; g.lineWidth = 3; for (const s of [-1, 1]) { g.beginPath(); g.arc(128 + s * 42, 92, 30, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
      g.beginPath(); g.moveTo(128, 30); g.lineTo(118, 52); g.lineTo(128, 74); g.lineTo(138, 52); g.closePath(); g.stroke();
      eyes(20, 11, 106, -.12);
      g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 2; g.beginPath(); g.moveTo(128, 112); g.lineTo(128, 160); g.stroke();
    } else if (kind === 'volto') {
      fill(col); shade(.3); eyes(19, 10, 106, -.1);
      g.fillStyle = '#9a1f24'; g.beginPath(); g.moveTo(108, 188); g.quadraticCurveTo(118, 178, 128, 184); g.quadraticCurveTo(138, 178, 148, 188); g.quadraticCurveTo(128, 202, 108, 188); g.fill();
      g.strokeStyle = deco; g.lineWidth = 3; g.beginPath(); for (let a = 0; a < 9; a += .15) { const r = 4 + a * 3.2; g.lineTo(196 + r * Math.cos(a), 150 + r * Math.sin(a)); } g.stroke();
      g.fillStyle = '#1d1512'; g.beginPath(); g.moveTo(86, 124); g.quadraticCurveTo(78, 140, 86, 148); g.quadraticCurveTo(94, 140, 86, 124); g.fill();
    } else if (kind === 'medico') {
      fill(col); shade();
      for (const x of [86, 170]) { g.fillStyle = '#c9a050'; g.beginPath(); g.arc(x, 106, 27, 0, 7); g.fill(); g.fillStyle = '#0a0806'; g.beginPath(); g.arc(x, 106, 20, 0, 7); g.fill(); g.fillStyle = 'rgba(255,230,180,.6)'; g.beginPath(); g.arc(x + 6, 99, 4, 0, 7); g.fill(); }
      g.strokeStyle = 'rgba(60,40,30,.5)'; g.lineWidth = 2; for (let k = 0; k < 7; k++) { g.beginPath(); g.moveTo(34 + k * 31, 26); g.lineTo(40 + k * 31, 46); g.stroke(); }
    } else if (kind === 'colombina') {
      face(); g.fillStyle = '#b7322e'; g.beginPath(); g.ellipse(128, 190, 17, 8, 0, 0, 7); g.fill();
      const gg = g.createLinearGradient(0, 50, 0, 150); gg.addColorStop(0, col); gg.addColorStop(1, dark(col, .65));
      g.fillStyle = gg; g.beginPath(); g.moveTo(10, 100); g.bezierCurveTo(30, 48, 100, 58, 128, 84); g.bezierCurveTo(156, 58, 226, 48, 246, 100); g.bezierCurveTo(230, 152, 160, 150, 128, 130); g.bezierCurveTo(96, 150, 26, 152, 10, 100); g.fill();
      g.strokeStyle = deco; g.lineWidth = 3; g.stroke(); for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(40 + k * 44, 133, 7, 0, 7); g.stroke(); }
      eyes(20, 12, 104);
    } else if (kind === 'arlecchino' || kind === 'capitano') {
      face(); if (kind === 'arlecchino') smile(); else { g.fillStyle = '#1a120d'; g.beginPath(); g.moveTo(128, 176); g.bezierCurveTo(100, 164, 62, 184, 52, 162); g.bezierCurveTo(72, 194, 110, 188, 128, 182); g.bezierCurveTo(146, 188, 184, 194, 204, 162); g.bezierCurveTo(194, 184, 156, 164, 128, 176); g.fill(); }
      g.fillStyle = col; g.beginPath(); g.moveTo(0, 0); g.lineTo(256, 0); g.lineTo(256, 138); g.quadraticCurveTo(200, 160, 150, 140); g.lineTo(128, 164); g.lineTo(106, 140); g.quadraticCurveTo(56, 160, 0, 138); g.fill();
      g.strokeStyle = ink; g.lineWidth = 4; for (const s of [-1, 1]) { g.beginPath(); if (kind === 'capitano') { g.moveTo(128 + s * 14, 90); g.lineTo(128 + s * 72, 76); } else g.arc(128 + s * 42, 100, 30, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); }
      if (kind === 'arlecchino') { g.fillStyle = dark(col, 1.6) === '#000000' ? '#3a2a1e' : dark(col, 1.5); g.beginPath(); g.arc(160, 46, 13, 0, 7); g.fill(); }
      eyes(18, 10, 106, kind === 'capitano' ? .18 : 0);
    } else if (kind === 'gatto') {
      fill(col); shade();
      for (const s of [-1, 1]) { g.save(); g.translate(128 + s * 42, 104); g.rotate(s * -.3); g.fillStyle = '#0a0806'; g.beginPath(); g.ellipse(0, 0, 25, 15, 0, 0, 7); g.fill(); g.fillStyle = '#e8c93a'; g.beginPath(); g.ellipse(0, 0, 19, 11, 0, 0, 7); g.fill(); g.fillStyle = '#0a0806'; g.beginPath(); g.ellipse(0, 0, 4, 11, 0, 0, 7); g.fill(); g.restore(); }
      g.fillStyle = '#d98a96'; g.beginPath(); g.moveTo(116, 142); g.lineTo(140, 142); g.lineTo(128, 156); g.fill();
      g.strokeStyle = ink; g.lineWidth = 2.5; g.beginPath(); g.moveTo(128, 156); g.lineTo(128, 168); g.moveTo(128, 168); g.quadraticCurveTo(114, 182, 102, 170); g.moveTo(128, 168); g.quadraticCurveTo(142, 182, 154, 170); g.stroke();
      for (const s of [-1, 1]) for (const dy of [-8, 0, 8]) { g.beginPath(); g.moveTo(128 + s * 26, 158 + dy / 2); g.lineTo(128 + s * 84, 150 + dy * 1.6); g.stroke(); }
    } else if (kind === 'jolly') {
      fill(col); g.fillStyle = '#eee7d8'; g.fillRect(128, 0, 128, h); shade(.3);
      for (const s of [-1, 1]) { g.fillStyle = s < 0 ? '#eee7d8' : col; g.beginPath(); g.moveTo(128 + s * 42, 66); g.lineTo(128 + s * 66, 106); g.lineTo(128 + s * 42, 150); g.lineTo(128 + s * 18, 106); g.fill(); }
      eyes(15, 10, 106);
      g.strokeStyle = '#a3201c'; g.lineWidth = 7; g.lineCap = 'round'; g.beginPath(); g.moveTo(74, 176); g.quadraticCurveTo(128, 222, 182, 176); g.stroke();
      g.fillStyle = '#a3201c'; for (const x of [70, 186]) { g.beginPath(); g.arc(x, 174, 7, 0, 7); g.fill(); }
    } else if (kind === 'teschio') {
      fill(col); shade(.45);
      for (const s of [-1, 1]) { g.fillStyle = '#080605'; g.beginPath(); g.ellipse(128 + s * 42, 104, 26, 24, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(255,120,60,.8)'; g.beginPath(); g.arc(128 + s * 42, 104, 3, 0, 7); g.fill(); }
      g.fillStyle = '#080605'; g.beginPath(); g.moveTo(128, 136); g.lineTo(114, 160); g.lineTo(142, 160); g.fill();
      g.strokeStyle = '#1a1310'; g.lineWidth = 3; g.beginPath(); g.moveTo(78, 190); g.lineTo(178, 190); g.stroke(); for (let x = 86; x <= 170; x += 12) { g.beginPath(); g.moveTo(x, 178); g.lineTo(x, 204); g.stroke(); }
    } else if (kind === 'sole') {
      fill(col); shade(.25);
      g.strokeStyle = deco; g.lineWidth = 3; for (let a = 0; a < 16; a++) { g.save(); g.translate(128, 130); g.rotate(a * Math.PI / 8); g.beginPath(); g.moveTo(0, -112); g.quadraticCurveTo(10, -128, 0, -150); g.stroke(); g.restore(); }
      g.strokeStyle = ink; g.lineWidth = 4; g.lineCap = 'round'; for (const s of [-1, 1]) { g.beginPath(); g.arc(128 + s * 42, 100, 18, .15 * Math.PI, .85 * Math.PI); g.stroke(); }
      g.fillStyle = 'rgba(190,80,40,.45)'; for (const x of [72, 184]) { g.beginPath(); g.arc(x, 156, 16, 0, 7); g.fill(); }
      smile(ink, 180, 30);
    } else if (kind === 'diavolo') {
      fill(col); shade(.45);
      for (const s of [-1, 1]) { g.save(); g.translate(128 + s * 42, 106); g.rotate(s * .35); g.fillStyle = '#080403'; g.beginPath(); g.ellipse(0, 0, 24, 11, 0, 0, 7); g.fill(); g.fillStyle = '#ffd23f'; g.beginPath(); g.ellipse(0, 1, 9, 6, 0, 0, 7); g.fill(); g.restore(); }
      g.strokeStyle = ink; g.lineWidth = 5; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(128 + s * 10, 96); g.lineTo(128 + s * 76, 70); g.stroke(); }
      g.fillStyle = '#080403'; g.beginPath(); g.moveTo(84, 178); g.quadraticCurveTo(128, 214, 172, 178); g.quadraticCurveTo(128, 196, 84, 178); g.fill();
      g.fillStyle = '#f2ecd8'; for (const x of [104, 152]) { g.beginPath(); g.moveTo(x - 6, 186); g.lineTo(x + 6, 186); g.lineTo(x, 202); g.fill(); }
    } else if (kind === 'nessuna') {
      face(); for (const s of [-1, 1]) { g.fillStyle = '#fbf7ee'; g.beginPath(); g.ellipse(128 + s * 42, 106, 17, 13, 0, 0, 7); g.fill(); g.fillStyle = '#2a1a10'; g.beginPath(); g.arc(128 + s * 42 + 3, 108, 7, 0, 7); g.fill(); g.strokeStyle = '#3a2416'; g.lineWidth = 5; g.beginPath(); g.moveTo(128 + s * 22, 80); g.lineTo(128 + s * 62, 76); g.stroke(); }
      smile('#6a2a20', 182, 30);
    } else if (kind === 'robot') {
      fill(col); shade(.4); g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 3; g.strokeRect(40, 54, 176, 150); g.beginPath(); g.moveTo(128, 54); g.lineTo(128, 86); g.stroke();
      for (const s of [-1, 1]) { g.fillStyle = '#0a0806'; g.beginPath(); g.arc(128 + s * 42, 106, 22, 0, 7); g.fill(); }
      g.fillStyle = '#0a0806'; g.fillRect(84, 170, 88, 26); g.strokeStyle = col; g.lineWidth = 3; for (let x = 96; x < 172; x += 12) { g.beginPath(); g.moveTo(x, 170); g.lineTo(x, 196); g.stroke(); }
      g.fillStyle = '#c9a050'; for (const [x, y] of [[50, 64], [206, 64], [50, 194], [206, 194]]) { g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); }
    } else if (kind === 'dino') {
      fill(col); shade(.35); g.fillStyle = dark(col, .7); for (let i = 0; i < 26; i++) { g.beginPath(); g.arc((i * 53) % 256, (i * 97) % 256, 7, 0, 7); g.fill(); }
      for (const s of [-1, 1]) { g.fillStyle = '#f2d13a'; g.beginPath(); g.ellipse(128 + s * 50, 92, 17, 14, 0, 0, 7); g.fill(); g.fillStyle = '#0a0806'; g.beginPath(); g.ellipse(128 + s * 50, 92, 4, 13, 0, 0, 7); g.fill(); }
    } else if (kind === 'alieno') {
      fill(col); shade(.35); for (const s of [-1, 1]) { g.save(); g.translate(128 + s * 44, 108); g.rotate(s * -.45); g.fillStyle = '#050304'; g.beginPath(); g.ellipse(0, 0, 34, 20, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.ellipse(-8, -7, 7, 4, 0, 0, 7); g.fill(); g.restore(); }
      g.fillStyle = '#050304'; for (const s of [-1, 1]) { g.beginPath(); g.arc(128 + s * 5, 158, 2.5, 0, 7); g.fill(); } g.fillRect(118, 186, 20, 3);
    } else if (kind === 'zucca') {
      fill(col); shade(.35); g.strokeStyle = dark(col, .65); g.lineWidth = 4; for (const x of [40, 84, 128, 172, 216]) { g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x + (x - 128) * .2, 128, x, 256); g.stroke(); }
      g.fillStyle = '#ffd23f'; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(128 + s * 42, 84); g.lineTo(128 + s * 64, 122); g.lineTo(128 + s * 20, 122); g.fill(); }
      g.beginPath(); g.moveTo(128, 132); g.lineTo(140, 152); g.lineTo(116, 152); g.fill();
      g.beginPath(); g.moveTo(70, 170); for (let i = 1; i <= 8; i++) g.lineTo(70 + i * 14.5, i % 2 ? 190 : 174); g.lineTo(186, 170); g.quadraticCurveTo(128, 222, 70, 170); g.fill();
    } else { // moretta
      fill(col); shade(.4); eyes(16, 9, 106);
      g.fillStyle = deco; g.beginPath(); g.arc(128, 60, 5, 0, 7); g.fill();
    }
    if (cracks) {
      g.strokeStyle = '#0a0605'; g.lineWidth = 4; g.lineJoin = 'bevel';
      g.beginPath(); g.moveTo(200, 0); g.lineTo(178, 40); g.lineTo(192, 70); g.lineTo(160, 110); g.lineTo(172, 140); g.lineTo(140, 190); g.stroke();
      g.lineWidth = 2.5; g.beginPath(); g.moveTo(192, 70); g.lineTo(226, 96); g.moveTo(160, 110); g.lineTo(120, 122); g.lineTo(104, 150); g.stroke();
    }
  });
  maskCache.set(key, t); return t;
}

// ---------------------------------------------------------------- costruzione
const mat = (color, rough = .7, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...o });
function put(parent, geo, m, p = [0, 0, 0], r = [0, 0, 0], s = null) {
  const x = new THREE.Mesh(geo, m); x.position.set(p[0], p[1], p[2]); x.rotation.set(r[0], r[1], r[2]);
  if (s) { if (Array.isArray(s)) x.scale.set(s[0], s[1], s[2]); else x.scale.setScalar(s); }
  x.castShadow = true; parent.add(x); return x;
}
const sph = (r, w = 14, h = 10) => new THREE.SphereGeometry(r, w, h);
const cyl = (a, b, h, n = 20, open = false) => new THREE.CylinderGeometry(a, b, h, n, 1, open);
const cone = (r, h, n = 12) => new THREE.ConeGeometry(r, h, n);
const lathe = (pts, n = 24) => new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), n);
const glow = (hex, k = 4) => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k) });
const YUP = new THREE.Vector3(0, 1, 0);

function buildHat(L, c1hex, c2hex) {
  const g = new THREE.Group(), col = CLOTH_COLS[L.hc][1], m = mat(col, .75), gold = mat('#c9a050', .32, { metalness: .9 });
  switch (L.hat) {
    case 'tricorno':
      put(g, cyl(.26, .26, .03, 3), m, [0, 0, 0], [0, Math.PI, 0]); put(g, cyl(.11, .125, .1), m, [0, .05, 0]);
      put(g, new THREE.TorusGeometry(.2, .007, 6, 3), gold, [0, .018, 0], [Math.PI / 2, 0, Math.PI / 2]); break;
    case 'cilindro':
      put(g, cyl(.2, .2, .014, 28), m); put(g, cyl(.118, .11, .25, 24), m, [0, .125, 0]); put(g, cyl(.114, .114, .035, 24), mat(c2hex, .5), [0, .03, 0]); break;
    case 'piumato': {
      const t = new THREE.Group(); t.rotation.z = -.2; g.add(t);
      put(t, cyl(.26, .26, .014, 32), m); put(t, cyl(.11, .12, .1, 20), m, [0, .05, 0]);
      [[c2hex, .02, .5], ['#e8c860', .06, .85], [c1hex, -.02, .2]].forEach(([c, dx, rz]) => put(t, sph(1, 12, 8), mat(c, .8), [dx - .06, .2, .05], [0, 0, rz], [.026, .18, .012]));
      break;
    }
    case 'corona': {
      put(g, cyl(.12, .115, .07, 24, true), mat('#c9a050', .3, { metalness: .9, side: THREE.DoubleSide }), [0, .035, 0]);
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; put(g, cone(.022, .07, 4), gold, [Math.sin(a) * .118, .1, Math.cos(a) * .118]); put(g, sph(.014, 8, 6), mat(i % 2 ? '#a3201c' : '#2a4f8a', .2), [Math.sin(a + .39) * .121, .035, Math.cos(a + .39) * .121]); }
      break;
    }
    case 'giullare': {
      put(g, new THREE.SphereGeometry(.135, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), m, [0, -.02, 0]);
      [[-1, 0, col], [1, 0, c2hex], [0, 1, col]].forEach(([dx, dz, c], i) => {
        const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(dx * .06, .06, dz * .06), new THREE.Vector3(dx * .2, .3, dz * .2), new THREE.Vector3(dx * .3, .12, dz * .3));
        put(g, new THREE.TubeGeometry(curve, 12, .032 - i * .002, 8), mat(c, .75)); put(g, sph(.028), gold, [dx * .3, .1, dz * .3]);
      });
      break;
    }
    case 'cuoco': {
      const w = mat('#f4f0e6', .85); put(g, cyl(.1, .105, .12, 20), w, [0, .06, 0]); put(g, sph(.15, 16, 12), w, [0, .2, 0], [0, 0, 0], [1, .7, 1]);
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; put(g, sph(.07), w, [Math.sin(a) * .1, .2, Math.cos(a) * .1]); }
      break;
    }
    case 'pentola': {
      const steel = mat('#8d9299', .3, { metalness: .85, side: THREE.DoubleSide });
      put(g, cyl(.15, .14, .17, 24, true), steel, [0, .04, 0]); put(g, cyl(.15, .15, .01, 24), steel, [0, .125, 0]);
      for (const s of [-1, 1]) put(g, new THREE.TorusGeometry(.035, .009, 6, 12), steel, [s * .17, .06, 0], [Math.PI / 2, 0, 0]);
      break;
    }
    case 'candela':
      put(g, cyl(.09, .1, .012, 20), gold); put(g, cyl(.024, .026, .14, 12), mat('#eee2c4', .7, { emissive: '#3a2008', emissiveIntensity: .4 }), [0, .075, 0]);
      put(g, sph(.014, 10, 8), glow('#ffb852', 6), [0, .17, 0], [0, 0, 0], [1, 2.2, 1]); break;
    case 'piccione': {
      const grey = mat('#8a8f98', .8), dk = mat('#5c616b', .8);
      put(g, sph(.07, 14, 10), grey, [0, .07, .01], [0, 0, 0], [1, .85, 1.45]); put(g, sph(.036), grey, [0, .15, -.075]); put(g, sph(.04), mat('#4a7a5a', .5), [0, .11, -.06]);
      put(g, cone(.012, .035, 6), mat('#d98a2a', .6), [0, .145, -.118], [-Math.PI / 2, 0, 0]);
      for (const s of [-1, 1]) { put(g, sph(.006, 6, 6), mat('#110a08', .3), [s * .02, .158, -.1]); put(g, sph(.05), dk, [s * .055, .075, .03], [0, 0, 0], [.35, .7, 1.5]); }
      put(g, cone(.04, .1, 6), dk, [0, .07, .14], [Math.PI / 2 + .2, 0, 0], [1, 1, .3]);
      break;
    }
    case 'paglietta': {
      const straw = mat('#d9c07a', .9); put(g, cyl(.21, .21, .012, 32), straw); put(g, cyl(.118, .12, .075, 24), straw, [0, .04, 0]);
      put(g, cyl(.122, .122, .028, 24), mat(col, .6), [0, .025, 0]);
      for (const s of [-1, 1]) put(g, new THREE.BoxGeometry(.028, .12, .004), mat(col, .6), [s * .02, -.04, .125], [.25, 0, s * .15]);
      break;
    }
    case 'turbante':
      put(g, sph(.155, 18, 12), m, [0, .05, 0], [0, 0, 0], [1, .72, 1]); put(g, new THREE.TorusGeometry(.11, .045, 8, 20), mat(dark(col, 1.25), .75), [0, .07, 0], [Math.PI / 2 + .25, .3, 0]);
      put(g, sph(.022), mat('#a3201c', .15), [0, .08, -.15]); put(g, sph(1, 10, 8), mat('#f4f0e6', .8), [0, .2, -.12], [.3, 0, 0], [.02, .1, .01]); break;
    case 'festa': {
      const t = new THREE.Group(); t.rotation.z = .18; g.add(t);
      put(t, cone(.085, .26, 20), new THREE.MeshStandardMaterial({ map: clothTex('righe', col, c2hex), roughness: .6 }), [0, .13, 0]); put(t, sph(.03), mat('#f4f0e6', 1), [0, .27, 0]); break;
    }
    case 'aureola': put(g, new THREE.TorusGeometry(.12, .011, 8, 32), glow('#ffd77a', 3.5), [0, .1, 0], [Math.PI / 2 + .12, 0, 0]); break;
    case 'pesce': {
      const t = new THREE.Group(); t.rotation.set(0, .3, .12); t.position.y = .05; g.add(t);
      const sk = mat('#7fa3b8', .25, { metalness: .6 });
      put(t, sph(.06, 16, 10), sk, [0, 0, 0], [0, 0, 0], [3, .9, 1.1]); put(t, cone(.06, .1, 4), sk, [.22, 0, 0], [0, 0, Math.PI / 2], [1, 1, .25]);
      put(t, cone(.03, .06, 4), sk, [0, .06, 0], [0, 0, 0], [1, 1, .25]);
      for (const s of [-1, 1]) put(t, sph(.012, 8, 6), mat('#f4f0e6', .2), [-.13, .015, s * .05]);
      break;
    }
    case 'vichingo': {
      const steel = mat('#8d9299', .35, { metalness: .8 }); put(g, new THREE.SphereGeometry(.14, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), steel, [0, -.01, 0]); put(g, new THREE.TorusGeometry(.14, .014, 8, 24), gold, [0, 0, 0], [Math.PI / 2, 0, 0]);
      for (const s of [-1, 1]) { const cv = new THREE.QuadraticBezierCurve3(new THREE.Vector3(s * .12, .05, 0), new THREE.Vector3(s * .27, .06, 0), new THREE.Vector3(s * .25, .26, 0)); put(g, new THREE.TubeGeometry(cv, 10, .026, 8), mat('#efe6cf', .5)); put(g, cone(.026, .07, 8), mat('#efe6cf', .5), [s * .248, .29, 0], [0, 0, s * .1]); }
      break;
    }
    case 'renna': {
      const br = mat('#6b4423', .8);
      for (const s of [-1, 1]) { const tube = (a, b, c, r) => put(g, new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(...a), new THREE.Vector3(...b), new THREE.Vector3(...c)), 8, r, 6), br);
        tube([s * .06, 0, 0], [s * .1, .16, 0], [s * .2, .3, 0], .016); tube([s * .1, .13, 0], [s * .2, .14, 0], [s * .26, .2, 0], .012); tube([s * .15, .22, 0], [s * .1, .3, 0], [s * .12, .36, 0], .011); }
      break;
    }
    case 'antenne': for (const s of [-1, 1]) { put(g, cyl(.006, .006, .22, 6), mat('#8d9299', .4, { metalness: .7 }), [s * .07, .1, 0], [0, 0, s * -.3]); put(g, sph(.026), glow(s < 0 ? '#5dff8a' : '#ff5ad0', 2.5), [s * .103, .2, 0]); } break;
    case 'elica': {
      put(g, new THREE.SphereGeometry(.135, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ map: clothTex('righe', col, c2hex), roughness: .8 }), [0, -.02, 0]); put(g, cyl(.01, .01, .07, 6), gold, [0, .14, 0]);
      const pr = new THREE.Group(); pr.position.y = .18; g.add(pr); g.userData.spin = pr;
      for (const s of [-1, 1]) put(pr, new THREE.BoxGeometry(.13, .006, .04), mat(s < 0 ? '#d1201c' : '#e8c93a', .5), [s * .07, 0, 0], [.3 * s, 0, 0]);
      break;
    }
    case 'cowboy': {
      put(g, cyl(.25, .25, .012, 32), m, [0, 0, 0], [0, 0, 0], [1, 1, .78]); for (const s of [-1, 1]) put(g, new THREE.TorusGeometry(.19, .03, 8, 16, Math.PI), m, [s * .08, .0, 0], [0, Math.PI / 2, s * Math.PI / 2 + Math.PI / 2], [1, .5, 1]);
      put(g, sph(.12, 16, 12), m, [0, .07, 0], [0, 0, 0], [1, 1, .85]); put(g, cyl(.118, .118, .025, 20), mat(c2hex, .6), [0, .025, 0], [0, 0, 0], [1, 1, .85]); break;
    }
    case 'astronauta': put(g, sph(.2, 28, 20), mat('#cfe8f5', .05, { transparent: true, opacity: .22, metalness: .2 })); put(g, new THREE.TorusGeometry(.13, .025, 8, 28), mat('#d8dde2', .4, { metalness: .6 }), [0, -.15, 0], [Math.PI / 2, 0, 0]); break;
    case 'fungo': {
      put(g, new THREE.SphereGeometry(.21, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), m, [0, 0, 0], [0, 0, 0], [1, .75, 1]); put(g, cyl(.2, .2, .01, 24), mat('#efe6cf', .9), [0, 0, 0]);
      for (let i = 0; i < 9; i++) { const a = i * 2.4, v = .35 + (i % 3) * .35; put(g, sph(.03), mat('#f4f0e6', .8), [Math.sin(a) * Math.sin(v) * .2, Math.cos(v) * .155, Math.cos(a) * Math.sin(v) * .2], [0, 0, 0], [1, .5, 1]); }
      break;
    }
    case 'pinna': put(g, cone(.1, .26, 3), mat('#6e7c88', .5), [0, .11, .03], [-.25, Math.PI / 2, 0], [1, 1, .22]); break;
  }
  return g;
}
function buildWig(L) {
  const g = new THREE.Group(); if (L.wig === 'none') return g;
  const m = mat(WIG_COLS[L.wc][1], .9);
  const cap = () => put(g, sph(.128, 20, 14), m, [0, .03, .03], [0, 0, 0], [1, 1.05, 1]);
  if (L.wig === 'parrucca' || L.wig === 'alta') {
    cap(); for (const s of [-1, 1]) for (const [y, z] of [[-.02, .03], [-.075, .04]]) put(g, new THREE.TorusGeometry(.03, .017, 8, 14), m, [s * .12, y, z], [0, Math.PI / 2, 0]);
    if (L.wig === 'alta') { put(g, sph(.115, 16, 12), m, [0, .16, .02]); put(g, sph(.095, 16, 12), m, [0, .27, .02]); put(g, sph(.05), m, [0, .37, .02]); for (const s of [-1, 1]) put(g, sph(.045), m, [s * .09, .22, .02]); }
  } else if (L.wig === 'ricci') {
    for (let i = 0; i < 18; i++) { const a = i * 2.4, v = .15 + (i / 18) * 1.25; put(g, sph(.052), m, [Math.sin(a) * Math.sin(v) * .11, Math.cos(v) * .12 + .03, Math.cos(a) * Math.sin(v) * .11 + .035]); }
    put(g, sph(.11, 14, 10), m, [0, .03, .04]);
  } else if (L.wig === 'codino') {
    cap(); put(g, new THREE.CapsuleGeometry(.03, .16, 4, 8), m, [0, -.1, .15], [.25, 0, 0]);
    for (const s of [-1, 1]) put(g, cone(.03, .06, 8), mat(CLOTH_COLS[L.c2][1], .6), [s * .035, -.02, .15], [0, 0, s * Math.PI / 2]);
  } else if (L.wig === 'cresta') {
    for (let i = 0; i < 7; i++) { const a = -.9 + i * .38; put(g, cone(.03, .13 - Math.abs(i - 3) * .012, 8), m, [0, Math.cos(a) * .15, Math.sin(a) * .13 + .01], [a, 0, 0]); }
  }
  return g;
}
const SUIT_TEX = {};
function boneTex() { return SUIT_TEX.b || (SUIT_TEX.b = tex(512, 256, (g, w, h) => { g.fillStyle = '#0e0d10'; g.fillRect(0, 0, w, h); g.strokeStyle = '#efe9da'; g.lineCap = 'round'; g.lineWidth = 9; g.beginPath(); g.moveTo(256, 14); g.lineTo(256, 190); g.stroke(); g.lineWidth = 7; for (let i = 0; i < 5; i++) { const y = 40 + i * 24, r = 62 - i * 5; g.beginPath(); g.moveTo(256 - r, y + 12); g.quadraticCurveTo(256, y - 14, 256 + r, y + 12); g.stroke(); } g.beginPath(); g.ellipse(256, 206, 44, 18, 0, 0, 7); g.stroke(); })); }
const HAT_Y = { none: .118, parrucca: .145, alta: .37, ricci: .15, codino: .145, cresta: .118 };

export function makeCharacter(look, o = {}) {
  const L = normalizeLook(look), g = new THREE.Group(), standing = !!o.standing;
  const c1 = CLOTH_COLS[L.c1][1], c2 = CLOTH_COLS[L.c2][1], skin = SKINS[L.sk][1], mcol = MASK_COLS[L.mc][1];
  const steelM = mat('#8d9299', .35, { metalness: .8 });
  const cloth = L.suit === 'abito' ? new THREE.MeshStandardMaterial({ map: clothTex(L.pat, c1, c2), roughness: .86 })
    : L.suit === 'scheletro' ? new THREE.MeshStandardMaterial({ map: boneTex(), roughness: .8 })
    : L.suit === 'cyborg' || L.suit === 'cavaliere' ? steelM
    : mat(L.suit === 'astronauta' ? '#eceae4' : L.suit === 'banana' ? '#f2d13a' : c1, .8);
  const wood = mat('#2a160c', .45), gold = mat('#c9a050', .32, { metalness: .9 }), white = mat('#f1ead8', .8);
  const body = put(g, lathe([[0, .4], [.27, .41], [.31, .55], [.29, .8], [.26, 1.0], [.22, 1.12], [.13, 1.2], [.05, 1.24]], 28), cloth); body.scale.z = .78; body.receiveShadow = true;
  put(g, sph(1, 16, 10), cloth, [0, 1.12, 0], [0, 0, 0], [.27, .1, .17]);
  if (L.suit === 'dino') {
    put(g, sph(1, 14, 10), mat(c2, .8), [0, .86, -.13], [0, 0, 0], [.19, .3, .1]); put(g, cone(.15, .7, 10), cloth, [0, .58, .46], [Math.PI / 2 + .45, 0, 0]);
    for (let i = 0; i < 5; i++) put(g, cone(.04, .1, 4), mat(c2, .7), [0, .62 + i * .13, .24 - i * .012], [.9, Math.PI / 4, 0]);
  } else if (L.suit === 'cyborg') {
    put(g, sph(.045), glow(c1, 3), [0, 1.0, -.2]); put(g, new THREE.TorusGeometry(.06, .012, 8, 20), mat('#2a2d33', .4, { metalness: .7 }), [0, 1.0, -.2]);
    for (const s of [-1, 1]) { put(g, sph(.085), mat('#2a2d33', .4, { metalness: .7 }), [s * .25, 1.13, 0]); put(g, new THREE.TorusGeometry(.2, .012, 6, 20, Math.PI), mat('#c9a050', .3, { metalness: .9 }), [0, .7 + (s + 1) * .08, 0], [Math.PI / 2, 0, Math.PI], [1, .8, 1]); }
  } else if (L.suit === 'astronauta') {
    put(g, new THREE.BoxGeometry(.2, .14, .04), mat('#9aa3ad', .5), [0, .98, -.21]); [['#d1201c', -.06], ['#5dff8a', 0], ['#3f86c4', .06]].forEach(([c, x]) => put(g, sph(.014), glow(c, 2), [x, .99, -.235]));
    put(g, new THREE.BoxGeometry(.3, .4, .14), mat('#d8d6d0', .7), [0, .95, .26]); put(g, new THREE.TorusGeometry(.2, .02, 8, 24), mat(c1, .6), [0, .6, 0], [Math.PI / 2, 0, 0], [1, .8, 1]);
  } else if (L.suit === 'cavaliere') {
    put(g, new THREE.BoxGeometry(.22, .5, .02), mat(c1, .8), [0, .85, -.225]); put(g, new THREE.BoxGeometry(.04, .2, .024), mat(c2, .7), [0, .95, -.228]); put(g, new THREE.BoxGeometry(.13, .04, .024), mat(c2, .7), [0, .99, -.228]);
    for (const s of [-1, 1]) put(g, new THREE.SphereGeometry(.1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), steelM, [s * .25, 1.1, 0]);
  } else if (L.suit === 'supereroe') {
    put(g, new THREE.CylinderGeometry(.16, .42, .8, 16, 1, true, -Math.PI / 2, Math.PI), mat(c2, .8, { side: THREE.DoubleSide }), [0, .82, .06]);
    put(g, new THREE.CircleGeometry(.075, 5), mat('#e8c93a', .4, { side: THREE.DoubleSide }), [0, 1.0, -.215], [0, Math.PI, Math.PI / 2 * 0 + .31]); put(g, new THREE.TorusGeometry(.23, .02, 8, 24), mat('#e8c93a', .4), [0, .62, 0], [Math.PI / 2, 0, 0], [1, .8, 1]);
  } else if (L.suit === 'banana') {
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + .6; put(g, cone(.09, .36, 6), mat('#f7e27a', .8), [Math.sin(a) * .2, 1.06, Math.cos(a) * .17], [Math.cos(a) * 2.2, 0, -Math.sin(a) * 2.2], [1, 1, .35]); }
    put(g, cyl(.06, .05, .05, 8), mat('#5a3d18', .8), [0, .43, 0]);
  }
  // colletto
  if (L.collar === 'gorgiera' || L.collar === 'gorgierona') {
    const big = L.collar === 'gorgierona', n = big ? 16 : 13, rr = big ? .19 : .1, s = big ? .06 : .036;
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; put(g, sph(1, 8, 6), white, [Math.sin(a) * rr, 1.235, Math.cos(a) * rr * .8], [0, a, 0], [s * .55, s * .75, s * 1.5]); }
    put(g, cyl(rr * .8, rr * .8, .02, 16), white, [0, 1.235, 0], [0, 0, 0], [1, 1, .8]);
  } else if (L.collar === 'mantello') {
    put(g, cyl(.1, .37, .32, 24, true), mat(c2, .85, { side: THREE.DoubleSide }), [0, 1.08, .01], [0, 0, 0], [1, 1, .8]); put(g, sph(.025), gold, [0, 1.2, -.1]);
  } else if (L.collar === 'jabot') {
    for (let i = 0; i < 3; i++) put(g, sph(1, 10, 8), white, [0, 1.19 - i * .06, -.15 - i * .012], [0, 0, 0], [.07 - i * .012, .04, .03]);
    put(g, new THREE.TorusGeometry(.085, .02, 8, 20), white, [0, 1.235, 0], [Math.PI / 2, 0, 0], [1, .8, 1]);
  } else if (L.collar === 'farfallino') {
    for (const s of [-1, 1]) put(g, cone(.04, .08, 8), mat(c2, .6), [s * .04, 1.2, -.13], [0, 0, s * Math.PI / 2]); put(g, sph(.016), mat(c2, .6), [0, 1.2, -.135]);
    put(g, new THREE.TorusGeometry(.085, .016, 8, 20), white, [0, 1.235, 0], [Math.PI / 2, 0, 0], [1, .8, 1]);
  }
  if (!standing && !o.noChair) {
    put(g, new THREE.BoxGeometry(.5, .06, .45), wood, [0, .42, .05]); put(g, new THREE.BoxGeometry(.5, .75, .06), wood, [0, .8, .3]);
    for (const sx of [-1, 1]) put(g, sph(.03, 10, 8), gold, [sx * .23, 1.19, .3]);
    for (const [lx, lz] of [[-.21, -.17], [.21, -.17], [-.21, .27], [.21, .27]]) put(g, cyl(.022, .018, .42, 8), wood, [lx, .21, lz]);
  }
  // testa
  const head = new THREE.Group(); head.position.y = 1.44; head.rotation.order = 'YXZ'; head.scale.setScalar(1.42); g.add(head);
  const skinM = mat(skin, .7);
  put(g, cyl(.045, .05, .1, 12), skinM, [0, 1.27, 0]);
  put(head, sph(.115, 24, 18), skinM, [0, 0, 0], [0, 0, 0], [1, 1.12, 1]);
  const maskM = new THREE.MeshStandardMaterial({ map: maskTex(L.mask, mcol, skin, o.cracks ? 1 : 0), roughness: .38, metalness: L.mc === 1 || L.mc === 8 ? .45 : .05 });
  put(head, new THREE.SphereGeometry(.122, 32, 20, Math.PI * 1.5 - 1.0, 2.0, .5, 1.95), maskM, [0, 0, 0], [0, 0, 0], [1, 1.12, 1]);
  const EXc = .04;
  const solid = mat(mcol, .38, { metalness: L.mc === 1 || L.mc === 8 ? .45 : .05 });
  if (L.mask === 'medico') put(head, cone(.042, .27, 16), solid, [0, -.045, -.225], [-Math.PI / 2 - .35, 0, 0]);
  if (L.mask === 'capitano') put(head, cone(.02, .2, 10), solid, [0, -.012, -.19], [-Math.PI / 2 - .2, 0, 0]);
  if (L.mask === 'bauta') put(head, cone(.072, .13, 4), solid, [0, -.088, -.098], [-Math.PI / 2 + .55, Math.PI / 4, 0]);
  if (L.mask === 'volto' || L.mask === 'jolly' || L.mask === 'moretta' || L.mask === 'teschio' && false) put(head, cone(.018, .05, 8), solid, [0, 0, -.13], [-Math.PI / 2 - .5, 0, 0]);
  if (L.mask === 'arlecchino') put(head, sph(.022), solid, [0, -.005, -.122]);
  if (L.mask === 'gatto') for (const s of [-1, 1]) { put(head, cone(.045, .09, 4), solid, [s * .07, .13, -.03], [0, Math.PI / 4, s * -.35]); put(head, cone(.025, .05, 4), mat('#d98a96', .6), [s * .068, .125, -.045], [0, Math.PI / 4, s * -.35]); }
  if (L.mask === 'diavolo') for (const s of [-1, 1]) { const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(s * .06, .08, -.05), new THREE.Vector3(s * .13, .14, -.05), new THREE.Vector3(s * .1, .24, -.07)); put(head, new THREE.TubeGeometry(curve, 10, .018, 8), mat('#1a1010', .4)); put(head, cone(.018, .05, 8), mat('#1a1010', .4), [s * .097, .262, -.072], [0, 0, s * .25]); }
  if (L.mask === 'sole') for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; put(head, cone(.018, i % 2 ? .07 : .11, 6), gold, [Math.sin(a) * .16, Math.cos(a) * .17 + .01, -.02], [0, 0, -a]); }
  if (L.mask === 'robot') { put(head, sph(.02), glow('#ff3020', 3), [EXc, .036, -.114]); put(head, sph(.013), glow('#3fd8ff', 2.5), [-EXc, .036, -.114]); }
  if (L.mask === 'dino') { put(head, sph(.07, 16, 12), solid, [0, -.04, -.15], [0, 0, 0], [.95, .62, 1.35]); for (let i = 0; i < 6; i++) put(head, cone(.009, .025, 5), mat('#f6f1e2', .4), [(i - 2.5) * .022, -.085, -.215 + Math.abs(i - 2.5) * .012], [Math.PI, 0, 0]); for (const s of [-1, 1]) put(head, sph(.008, 6, 6), mat('#0a0806', .5), [s * .025, -.01, -.235]); }
  head.add(buildWig(L));
  const hat = buildHat(L, c1, c2); hat.position.y = L.hat === 'astronauta' ? .02 : HAT_Y[L.wig] + (L.hat === 'aureola' ? .06 : 0); head.add(hat);
  // accessori sul viso
  const hair = L.wig === 'none' ? '#3a2416' : WIG_COLS[L.wc][1], hairM = mat(hair, .85), EY = .036, EX = .04, EZ = -.116;
  if (L.acc === 'monocolo') { put(head, new THREE.TorusGeometry(.03, .005, 8, 20), gold, [EX, EY, EZ - .006]); put(head, new THREE.CircleGeometry(.028, 16), mat('#cfe3ea', .05, { transparent: true, opacity: .35, side: THREE.DoubleSide }), [EX, EY, EZ - .006]); put(head, cyl(.002, .002, .17, 4), gold, [.085, -.05, -.07], [.3, 0, .25]); }
  if (L.acc === 'occhiali') { for (const s of [-1, 1]) put(head, new THREE.TorusGeometry(.03, .005, 8, 20), mat('#15100c', .3), [s * EX, EY, EZ - .006], [0, s * -.3, 0]); put(head, cyl(.004, .004, .03, 6), mat('#15100c', .3), [0, EY, EZ - .012], [0, 0, Math.PI / 2]); }
  if (L.acc === 'baffi') for (const s of [-1, 1]) put(head, new THREE.TorusGeometry(.036, .011, 6, 12, Math.PI * .95), hairM, [s * .036, -.03, -.124], [0, 0, s > 0 ? Math.PI : 0]);
  if (L.acc === 'barba') { put(head, cone(.07, .2, 10), hairM, [0, -.19, -.065], [Math.PI + .25, 0, 0], [1, 1, .7]); put(head, sph(.06), hairM, [0, -.1, -.075], [0, 0, 0], [1.2, .7, .8]); }
  if (L.acc === 'pipa') { put(head, cyl(.006, .006, .12, 6), mat('#1a100a', .4), [.03, -.075, -.17], [Math.PI / 2 - .3, -.3, 0]); put(head, cyl(.02, .016, .035, 10), mat('#3a1c0e', .4), [.048, -.08, -.228]); put(head, sph(.012, 8, 6), glow('#ff7a2a', 1.6), [.048, -.066, -.228]); }
  if (L.acc === 'rosa') { put(head, cyl(.004, .004, .16, 6), mat('#2a5a2a', .7), [0, -.063, -.128], [0, 0, Math.PI / 2]); for (let i = 0; i < 5; i++) put(head, sph(.018, 8, 6), mat('#b3121b', .5), [.08 + Math.sin(i * 1.3) * .012, -.063 + Math.cos(i * 1.3) * .012, -.128 - (i % 2) * .01]); put(head, sph(1, 8, 6), mat('#2a5a2a', .7), [.03, -.05, -.128], [0, 0, .5], [.02, .008, .01]); }
  if (L.acc === 'naso') put(head, sph(.032, 14, 10), mat('#d1201c', .15), [0, -.008, -.135]);
  if (L.acc === 'cuffie') { put(head, new THREE.TorusGeometry(.135, .012, 8, 24, Math.PI), mat('#15100c', .4), [0, .02, .01]); for (const s of [-1, 1]) put(head, cyl(.045, .045, .035, 16), mat(c2, .5), [s * .13, 0, .01], [0, 0, Math.PI / 2]); }
  if (L.acc === 'benda') { put(head, new THREE.CircleGeometry(.036, 16), mat('#0c0a0a', .6, { side: THREE.DoubleSide }), [-EX, EY, EZ - .012], [.25, .3, 0]); put(head, new THREE.TorusGeometry(.124, .006, 6, 28), mat('#0c0a0a', .6), [0, .05, 0], [Math.PI / 2 - .25, .12, 0]); }
  // braccia
  const gloveM = mat(isDark(c2) ? '#e8dcc0' : c2, .6), handY = .835 - (standing ? .18 : 0);
  const arms = [-1, 1].map(sx => {
    const mesh = put(g, new THREE.CapsuleGeometry(.047, 1, 4, 10), cloth);
    const glove = new THREE.Group(); g.add(glove); put(glove, sph(.042, 14, 10), gloveM, [0, 0, 0], [0, 0, 0], [1, .55, 1.35]);
    const rest = new THREE.Vector3(sx * .17, handY, -.5);
    return { sx, shoulder: new THREE.Vector3(sx * .23, 1.11, -.02), hand: rest.clone(), rest, mesh, glove };
  });
  if (L.acc === 'ali') for (const s of [-1, 1]) { put(g, sph(1, 14, 10), mat('#f4f0e6', .8), [s * .3, 1.08, .24], [.1, s * -.5, s * -.5], [.14, .34, .03]); put(g, sph(1, 14, 10), mat('#e6e0d2', .8), [s * .38, .9, .26], [.1, s * -.5, s * -.9], [.1, .26, .025]); }
  if (L.acc === 'pappagallo') { const pg = new THREE.Group(); pg.position.set(.27, 1.19, 0); g.add(pg); put(pg, sph(.05, 12, 10), mat('#c8201c', .6), [0, .06, 0], [0, 0, 0], [1, 1.4, 1]); put(pg, sph(.036), mat('#c8201c', .6), [0, .15, -.01]); put(pg, cone(.016, .04, 6), mat('#e8c93a', .5), [0, .14, -.05], [-Math.PI / 2 - .5, 0, 0]); put(pg, cone(.025, .14, 6), mat('#2a4f8a', .6), [0, -.03, .05], [Math.PI - .5, 0, 0], [1, 1, .4]); for (const s of [-1, 1]) { put(pg, sph(.006, 6, 6), mat('#0a0806', .3), [s * .02, .16, -.035]); put(pg, sph(.03), mat('#1f8a4c', .6), [s * .04, .06, .01], [0, 0, 0], [.4, 1.2, 1]); } }
  if (L.acc === 'ventaglio') {
    const fan = put(arms[0].glove, new THREE.CircleGeometry(.19, 18, Math.PI * .15, Math.PI * .7), new THREE.MeshStandardMaterial({ map: clothTex('righe', c2, '#d6b062'), side: THREE.DoubleSide, roughness: .7 }), [0, .03, 0], [-.25, 0, 0]);
    fan.material.map = fan.material.map.clone(); fan.material.map.repeat.set(9, 1); fan.material.map.needsUpdate = true;
  }
  if (L.acc === 'calice') { put(arms[1].glove, lathe([[0, 0], [.03, 0], [.03, .006], [.006, .012], [.006, .07], [.034, .1], [.036, .14], [.032, .14], [.03, .105], [0, .08]], 16), mat('#c9a050', .25, { metalness: .9, side: THREE.DoubleSide }), [.08, -.03, .02]); put(arms[1].glove, cyl(.03, .03, .004, 12), mat('#5a0d14', .2), [.08, .1, .02]); }
  const ch = { group: g, head, arms, look: L, standing, t: Math.random() * 10, spin: hat.userData.spin || null };
  if (standing) g.position.y = .18;
  updateArms(ch);
  return ch;
}
const dV = new THREE.Vector3();
export function updateArms(ch) {
  for (const a of ch.arms) {
    dV.subVectors(a.hand, a.shoulder); const len = Math.max(.05, dV.length() - .03);
    a.mesh.position.copy(a.shoulder).addScaledVector(dV, .5);
    a.mesh.quaternion.setFromUnitVectors(YUP, dV.clone().normalize());
    a.mesh.scale.set(1, len / 1.094, 1);
    a.glove.position.copy(a.hand); a.glove.rotation.y = Math.atan2(dV.x, dV.z);
  }
}
export function disposeCharacter(ch) {
  ch.group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && !o.material.map) o.material.dispose(); });
  if (ch.group.parent) ch.group.parent.remove(ch.group);
}

// ---------------------------------------------------------------- editor (HTML condiviso tra telefono e tavolo)
export const EDIT_TABS = [['mask', 'Maschera'], ['hat', 'Cappello'], ['wig', 'Capelli'], ['suit', 'Costume'], ['acc', 'Extra']];
const oB = (key, cur) => `<div class="opts">${PARTS[key].map(([id, l]) => `<button data-set="${key}" data-v="${id}" aria-pressed="${cur === id}">${l}</button>`).join('')}</div>`;
const sB = (key, list, cur) => `<div class="sw">${list.map(([n, c], i) => `<button data-col="${key}" data-v="${i}" style="--c:${c}" aria-pressed="${cur === i}" aria-label="${n}" title="${n}"></button>`).join('')}</div>`;
export function editorHTML(L, tab) {
  if (tab === 'mask') return oB('mask', L.mask) + '<h3>COLORE DELLA MASCHERA</h3>' + sB('mc', MASK_COLS, L.mc) + '<h3>PELLE</h3>' + sB('sk', SKINS, L.sk);
  if (tab === 'hat') return oB('hat', L.hat) + '<h3>COLORE DEL CAPPELLO</h3>' + sB('hc', CLOTH_COLS, L.hc);
  if (tab === 'wig') return oB('wig', L.wig) + '<h3>COLORE</h3>' + sB('wc', WIG_COLS, L.wc);
  if (tab === 'suit') return oB('suit', L.suit) + (L.suit === 'abito' ? '<h3>FANTASIA</h3>' + oB('pat', L.pat) : '') + '<h3>COLORE PRINCIPALE</h3>' + sB('c1', CLOTH_COLS, L.c1) + '<h3>SECONDO COLORE</h3>' + sB('c2', CLOTH_COLS, L.c2) + '<h3>COLLETTO</h3>' + oB('collar', L.collar);
  return oB('acc', L.acc);
}
export function applyEdit(L, ds) { if (ds.set && PARTS[ds.set]) { L[ds.set] = ds.v; return true; } if (ds.col) { L[ds.col] = +ds.v; return true; } return false; }
