// Aspetto: stecche, set di palline, panni (tutto disegnato in codice).
import * as THREE from 'three';

export const FELTS = [
  { id: 'verde', name: 'Verde classico', c: '#0b5a32' },
  { id: 'blu', name: 'Blu torneo', c: '#1b4f8f' },
  { id: 'rosso', name: 'Rosso Ridotto', c: '#7d1622' },
  { id: 'viola', name: 'Viola', c: '#4b2577' },
  { id: 'petrolio', name: 'Petrolio', c: '#0d5a5f' },
  { id: 'nero', name: 'Nero', c: '#1d1d22' },
];

const CL = ['#ffffff', '#f2c014', '#1a4fc4', '#d62a1e', '#5b2a86', '#f07c13', '#127a3a', '#7a1c1c', '#121212'];
const full = a => { const o = {}; for (let i = 0; i <= 15; i++) o[i] = a[i <= 8 ? i : i - 8]; o[0] = a[0]; return o; };
export const SETS = [
  { id: 'classiche', name: 'Classiche', base: '#f6f1e3', num: '#111', colors: full(CL) },
  { id: 'neon', name: 'Neon', base: '#f4f4ff', num: '#111', glow: true, colors: full(['#ffffff', '#fff200', '#00b7ff', '#ff2d55', '#b84dff', '#ff8a00', '#00ff8c', '#ff4fd8', '#101018']) },
  { id: 'pastello', name: 'Pastello', base: '#fbf6ee', num: '#3a2e28', colors: full(['#ffffff', '#f6d36b', '#8fb3e8', '#ee8f87', '#b9a0d8', '#f4b47c', '#93cfa3', '#c98a8a', '#3b3540']) },
  { id: 'lusso', name: 'Oro e gioielli', base: '#efe3c2', num: '#2a1d08', gold: true, colors: full(['#fffaf0', '#d4a72c', '#123d8c', '#a3121c', '#4a1670', '#c4561a', '#0c5c32', '#5c1010', '#0b0b0b']) },
  { id: 'retro', name: 'Avorio antico', base: '#e9dcbc', num: '#2b2114', colors: full(['#efe4c8', '#d9a520', '#2b4e8a', '#a8321f', '#5a3a6b', '#c96b22', '#3c6b3a', '#6b2a20', '#1d1a16']) },
];

export function ballTexture(id, set) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
  const g = c.getContext('2d'), w = c.width, h = c.height;
  const col = set.colors[id], stripe = id > 8;
  g.fillStyle = id === 0 ? set.colors[0] : stripe ? set.base : col; g.fillRect(0, 0, w, h);
  if (stripe) { g.fillStyle = col; g.fillRect(0, h * 0.27, w, h * 0.46); }
  if (id === 0) {
    g.fillStyle = '#d42a1e';
    for (const [u, v] of [[0.25, 0.5], [0.75, 0.5], [0, 0.5], [0.5, 0.5]]) { g.beginPath(); g.arc(u * w, v * h, 9, 0, 7); g.fill(); }
  } else {
    for (const u of [0.25, 0.75]) {
      g.fillStyle = set.gold ? '#f7e7b4' : set.base;
      g.beginPath(); g.arc(u * w, h / 2, 62, 0, 7); g.fill();
      if (set.gold) { g.strokeStyle = '#b8862a'; g.lineWidth = 6; g.stroke(); }
      g.fillStyle = set.num; g.font = `700 ${id > 9 ? 66 : 76}px Georgia, "Times New Roman", serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(id), u * w, h / 2 + 4);
      if (id === 6 || id === 9) { g.fillRect(u * w - 18, h / 2 + 40, 36, 5); }
    }
  }
  // lieve sporco e riflessi irregolari
  for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.025})`; g.fillRect(Math.random() * w, Math.random() * h, 3, 3); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

export function feltTexture(color, shade = 1) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'); const base = new THREE.Color(color).multiplyScalar(shade);
  g.fillStyle = '#' + base.getHexString(); g.fillRect(0, 0, 256, 256);
  const img = g.getImageData(0, 0, 256, 256), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 18; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(5, 5); t.anisotropy = 8;
  return t;
}

export function woodTexture(a = '#5a2a12', b = '#2c1206') {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d'); g.fillStyle = a; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 140; i++) {
    g.strokeStyle = Math.random() < .5 ? b : `rgba(255,220,180,${Math.random() * .06})`; g.globalAlpha = Math.random() * .5 + .1; g.lineWidth = Math.random() * 3 + .5;
    const y = Math.random() * 512; g.beginPath(); g.moveTo(0, y);
    for (let x = 0; x <= 512; x += 32) g.lineTo(x, y + Math.sin(x / 60 + i) * 6 + (Math.random() - .5) * 3);
    g.stroke();
  }
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2); t.anisotropy = 8;
  return t;
}

// ---------- stecche ----------
export const CUES = [
  { id: 'classica', name: 'La Classica', butt: '#3a1a0a', wrap: '#141414', accent: '#c9a24a', pat: 'punte', css: 'linear-gradient(90deg,#e8cf9c 0 45%,#c9a24a 45% 47%,#3a1a0a 47% 70%,#141414 70% 88%,#3a1a0a 88%)' },
  { id: 'diavola', name: 'La Diavola', butt: '#7a0d12', wrap: '#0b0b0b', accent: '#e8e8e8', pat: 'fiamme', css: 'linear-gradient(90deg,#e8cf9c 0 45%,#ddd 45% 47%,#7a0d12 47% 70%,#0b0b0b 70% 88%,#7a0d12 88%)' },
  { id: 'neon', name: 'Neon', butt: '#0b0b14', wrap: '#1b1b2a', accent: '#00e5ff', pat: 'neon', glow: true, css: 'linear-gradient(90deg,#e8cf9c 0 45%,#00e5ff 45% 47%,#0b0b14 47% 60%,#ff2bd6 60% 62%,#0b0b14 62% 70%,#1b1b2a 70% 88%,#0b0b14 88%)' },
  { id: 'marmo', name: 'Marmo', butt: '#ebe7df', wrap: '#2c2c2c', accent: '#9a9a9a', pat: 'marmo', css: 'linear-gradient(90deg,#e8cf9c 0 45%,#999 45% 47%,#ebe7df 47% 70%,#2c2c2c 70% 88%,#ebe7df 88%)' },
  { id: 'oro', name: 'Il Conte', butt: '#0e0c0a', wrap: '#3b2a10', accent: '#e6c25a', pat: 'filigrana', css: 'linear-gradient(90deg,#e8cf9c 0 45%,#e6c25a 45% 47%,#0e0c0a 47% 70%,#3b2a10 70% 88%,#0e0c0a 88%)' },
  { id: 'carbonio', name: 'Carbonio', butt: '#2a2a2e', wrap: '#101012', accent: '#d42a1e', pat: 'carbonio', css: 'linear-gradient(90deg,#3a3a40 0 45%,#d42a1e 45% 47%,#2a2a2e 47% 70%,#101012 70% 88%,#2a2a2e 88%)' },
];

function patternTex(c) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256;
  const g = cv.getContext('2d'), w = 512, h = 256;
  g.fillStyle = c.butt; g.fillRect(0, 0, w, h);
  if (c.pat === 'punte') {
    g.fillStyle = '#efe0bd';
    for (let i = 0; i < 4; i++) { const x = i * w / 4; g.beginPath(); g.moveTo(x + 18, 0); g.lineTo(x + w / 8 + 4, h * 0.85); g.lineTo(x + w / 4 - 10, 0); g.fill(); }
    g.strokeStyle = c.accent; g.lineWidth = 3;
    for (let i = 0; i < 4; i++) { const x = i * w / 4; g.beginPath(); g.moveTo(x + 18, 0); g.lineTo(x + w / 8 + 4, h * 0.85); g.lineTo(x + w / 4 - 10, 0); g.stroke(); }
  } else if (c.pat === 'fiamme') {
    for (let i = 0; i < 9; i++) {
      const x = i * w / 8 - 20; const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, '#000'); grd.addColorStop(1, '#ff6a00');
      g.fillStyle = i % 2 ? '#000' : grd; g.beginPath(); g.moveTo(x, h);
      g.bezierCurveTo(x + 10, h * 0.6, x + 50, h * 0.6, x + 30, h * 0.08); g.bezierCurveTo(x + 60, h * 0.5, x + 80, h * 0.5, x + 70, h); g.fill();
    }
  } else if (c.pat === 'neon') {
    for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#ff2bd6' : '#00e5ff'; g.fillRect(0, 20 + i * 40, w, 6); }
  } else if (c.pat === 'marmo') {
    for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(60,60,70,${Math.random() * .5})`; g.lineWidth = Math.random() * 3; g.beginPath(); let x = Math.random() * w, y = 0; g.moveTo(x, y); while (y < h) { x += (Math.random() - .5) * 40; y += 20; g.lineTo(x, y); } g.stroke(); }
  } else if (c.pat === 'filigrana') {
    g.strokeStyle = c.accent; g.lineWidth = 2;
    for (let i = 0; i < 8; i++) { const x = i * w / 8 + 32; g.beginPath(); for (let t = 0; t < 6.3; t += 0.1) { const r = 24 + 10 * Math.sin(3 * t); g.lineTo(x + Math.cos(t) * r, h / 2 + Math.sin(t) * r * 2.4); } g.closePath(); g.stroke(); }
  } else if (c.pat === 'carbonio') {
    for (let y = 0; y < h; y += 16) for (let x = 0; x < w; x += 16) { g.fillStyle = ((x + y) / 16) % 2 ? '#3a3a40' : '#1e1e22'; g.fillRect(x, y, 16, 16); g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(x, y, 16, 3); }
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function wrapTex(color) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256; const g = cv.getContext('2d');
  g.fillStyle = color; g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 8) { g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(0, y, 256, 3); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const mapleTex = (() => { let t = null; return () => t || (t = woodTexture('#b89a68', '#93764c')); })();

// Stecca lungo +Z, puntale nell'origine
export function makeCue(c, scale = 1) {
  const grp = new THREE.Group();
  const accent = new THREE.MeshStandardMaterial({ color: c.accent, metalness: 0.9, roughness: 0.25, emissive: c.glow ? c.accent : 0x000000, emissiveIntensity: c.glow ? 0.8 : 0 });
  const butt = new THREE.MeshPhysicalMaterial({ map: patternTex(c), roughness: 0.25, clearcoat: 1, emissive: c.glow ? 0xffffff : 0, emissiveMap: c.glow ? patternTex(c) : null, emissiveIntensity: c.glow ? 0.5 : 0 });
  const shaftMat = c.id === 'carbonio' ? new THREE.MeshPhysicalMaterial({ color: 0x2b2b30, roughness: 0.3, clearcoat: 1 }) : new THREE.MeshStandardMaterial({ map: mapleTex(), roughness: 0.55 });
  const parts = [
    [0.008, 0.0061, 0.0061, new THREE.MeshStandardMaterial({ color: 0x2a62c8, roughness: 0.9 })],
    [0.022, 0.0063, 0.0063, new THREE.MeshStandardMaterial({ color: 0xf5f1e6, roughness: 0.3 })],
    [0.68, 0.0064, 0.0102, shaftMat],
    [0.025, 0.0105, 0.0105, accent],
    [0.32, 0.0107, 0.0127, butt],
    [0.008, 0.0129, 0.0129, accent],
    [0.26, 0.0129, 0.0136, new THREE.MeshStandardMaterial({ map: wrapTex(c.wrap), roughness: 0.85 })],
    [0.008, 0.0137, 0.0137, accent],
    [0.13, 0.0137, 0.0148, butt],
    [0.012, 0.0148, 0.0142, new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.6 })],
  ];
  let z = 0;
  for (const [len, r0, r1, mat] of parts) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r1 * scale, r0 * scale, len * scale, 20), mat);
    m.rotation.x = Math.PI / 2; m.position.z = (z + len / 2) * scale; m.castShadow = true; grp.add(m); z += len;
  }
  return grp;
}
