// Il percorso: un'isola con 6 buche. Altezze, superfici (green, fairway, rough, sabbia, acqua) e mesh.
import * as THREE from 'three';

export const W = 380, D = 260, X0 = -190, Z0 = -130; // estensione della mappa (metri)
export const WATER = 0;
export const S = { OUT: 0, ROUGH: 1, FAIR: 2, GREEN: 3, SAND: 4, WATER: 5, TEE: 6, FRINGE: 7 };

// buche: tee, punto di passaggio, green, eventuali bunker e laghetti
export const HOLES = [
  { tee: [-150, 92], mid: [-152, 58], green: [-144, 22], par: 3, bunkers: [[-134, 28, 4.5], [-155, 30, 3.5]], ponds: [] },
  { tee: [-122, 4], mid: [-96, -20], green: [-64, -40], par: 4, bunkers: [[-90, -8, 5]], ponds: [[-78, -22, 7]] },
  { tee: [-46, -70], mid: [-14, -78], green: [24, -66], par: 4, bunkers: [[30, -56, 4]], ponds: [[-12, -70, 9]] },
  { tee: [44, -44], mid: [60, -8], green: [52, 30], par: 4, bunkers: [[44, 22, 4], [62, 34, 3.5]], ponds: [] },
  { tee: [74, 56], mid: [104, 76], green: [142, 64], par: 4, bunkers: [[100, 68, 4], [132, 74, 4], [150, 58, 3]], ponds: [] },
  { tee: [154, 34], mid: [158, -4], green: [134, -54], par: 5, bunkers: [[146, -42, 4.5]], ponds: [[140, -12, 10]] },
];
export const GREEN_R = 10, FAIR_W = 9;

// rumore deterministico
function hash(x, y) { let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, y) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
export function fbm(x, y, o = 4) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { s += a * vnoise(x * f, y * f); f *= 2.03; a *= 0.5; } return s; }
export function rng(seed) { let s = seed >>> 0; return () => { s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9 | 0; s = Math.imul(s ^ (s >>> 13), 3266489909); return ((s ^= s >>> 16) >>> 0) / 4294967296; }; }

function segDist(px, pz, ax, az, bx, bz) { const ex = bx - ax, ez = bz - az, l = ex * ex + ez * ez; let t = ((px - ax) * ex + (pz - az) * ez) / l; t = Math.max(0, Math.min(1, t)); const dx = px - ax - ex * t, dz = pz - az - ez * t; return [Math.hypot(dx, dz), t]; }
// distanza dal corridoio della buca (tee → mid → green)
export function fairDist(h, x, z) { return Math.min(segDist(x, z, ...h.tee, ...h.mid)[0], segDist(x, z, ...h.mid, ...h.green)[0]); }

// ---------- griglie precalcolate (1 m) ----------
const NX = W + 1, NZ = D + 1;
export const HGT = new Float32Array(NX * NZ), SURF = new Uint8Array(NX * NZ);

function rawHeight(x, z) {
  // isola: alta al centro, scende verso il mare ai bordi
  const ex = (x - X0) / W * 2 - 1, ez = (z - Z0) / D * 2 - 1;
  const edge = Math.max(Math.abs(ex) ** 3, Math.abs(ez) ** 3);
  let h = 3.2 + fbm(x * 0.012 + 3, z * 0.012 + 7) * 9 - 4.5 + fbm(x * 0.05, z * 0.05, 3) * 1.6;
  h -= Math.max(0, edge - 0.55) * 26;
  return h;
}
function build() {
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const x = X0 + i, z = Z0 + j; let h = rawHeight(x, z), s = S.ROUGH;
    for (const hole of HOLES) {
      const fd = fairDist(hole, x, z);
      // corridoio più morbido (meno rumore fine) e un po' rialzato dall'acqua
      if (fd < FAIR_W + 8) { const k = 1 - Math.max(0, fd - FAIR_W) / 8; const smooth = 3.2 + fbm(x * 0.012 + 3, z * 0.012 + 7) * 9 - 4.5; h = h * (1 - k * 0.8) + Math.max(1.4, smooth) * k * 0.8; }
      if (fd < FAIR_W) s = S.FAIR;
      const gd = Math.hypot(x - hole.green[0], z - hole.green[1]);
      if (gd < GREEN_R + 6) { const gh = greenH(hole), k = Math.min(1, Math.max(0, (GREEN_R + 6 - gd) / 6)); const tilt = ((x - hole.green[0]) * 0.012 + (z - hole.green[1]) * -0.008); h = h * (1 - k) + (gh + tilt) * k; }
      if (gd < GREEN_R + 1.5) s = S.FRINGE;
      if (gd < GREEN_R) s = S.GREEN;
      const td = Math.max(Math.abs(x - hole.tee[0]), Math.abs(z - hole.tee[1]));
      if (td < 6) { const th = teeH(hole), k = Math.min(1, (6 - td) / 2.5); h = h * (1 - k) + th * k; if (td < 3.5) s = S.TEE; }
      for (const [bx, bz, br] of hole.bunkers) { const d = Math.hypot(x - bx, z - bz) / br; if (d < 1.25) { h -= Math.max(0, 1 - d * d) * 0.7; if (d < 1) s = S.SAND; } }
      // laghetti: riva larga e dolce che scende quasi al pelo dell'acqua, poi una sponda corta (niente crateri)
      for (const [px, pz, pr] of hole.ponds) { const d = pondD(x, z, px, pz, pr); if (d < 2.6) { const e = sstep(2.6, 1.05, d); h = h * (1 - e) + Math.min(h, WATER + 0.4) * e; const e2 = sstep(1.12, 0.72, d); h = h * (1 - e2) + (-1.1) * e2; } }
    }
    if (h < WATER + 0.05) s = S.WATER;
    HGT[j * NX + i] = h; SURF[j * NX + i] = s;
  }
}
function sstep(a, b, x) { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
function pondD(x, z, px, pz, pr) { return Math.hypot(x - px, z - pz) / pr + (fbm(x * 0.15, z * 0.15, 2) - 0.5) * 0.3; }
export function nearPond(x, z) { let m = 9; for (const h of HOLES) for (const [px, pz, pr] of h.ponds) m = Math.min(m, pondD(x, z, px, pz, pr)); return m; }
const _gh = new Map();
function greenH(h) { if (!_gh.has(h)) _gh.set(h, Math.max(1.6, rawHeightSmooth(...h.green) + 0.3)); return _gh.get(h); }
function teeH(h) { return Math.max(1.8, rawHeightSmooth(...h.tee) + 0.4); }
function rawHeightSmooth(x, z) { return 3.2 + fbm(x * 0.012 + 3, z * 0.012 + 7) * 9 - 4.5; }
build();

// superficie calcolata con precisione (per disegnare bordi puliti)
export function surfExact(x, z) {
  if (heightAt(x, z) < WATER + 0.05) return S.WATER;
  let s = S.ROUGH;
  for (const hole of HOLES) {
    const fd = fairDist(hole, x, z) + (fbm(x * 0.08, z * 0.08, 2) - 0.5) * 2.5;
    if (fd < FAIR_W && s === S.ROUGH) s = S.FAIR;
    const gd = Math.hypot(x - hole.green[0], z - hole.green[1]) + (fbm(x * 0.2, z * 0.2, 2) - 0.5) * 1.2;
    if (gd < GREEN_R + 1.5 && s !== S.GREEN) s = S.FRINGE;
    if (gd < GREEN_R) s = S.GREEN;
    const td = Math.max(Math.abs(x - hole.tee[0]), Math.abs(z - hole.tee[1]));
    if (td < 3.5) s = S.TEE;
    for (const [bx, bz, br] of hole.bunkers) { const d = Math.hypot(x - bx, z - bz) / br + (fbm(x * 0.3, z * 0.3, 2) - 0.5) * 0.25; if (d < 1) s = S.SAND; }
  }
  return s;
}
// altezza (bilineare) e normale
export function heightAt(x, z) {
  const fx = Math.max(0, Math.min(W - 1.001, x - X0)), fz = Math.max(0, Math.min(D - 1.001, z - Z0));
  const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = j * NX + i;
  return (HGT[k] * (1 - u) + HGT[k + 1] * u) * (1 - v) + (HGT[k + NX] * (1 - u) + HGT[k + NX + 1] * u) * v;
}
export function normalAt(x, z, out = new THREE.Vector3()) {
  const e = 0.5; return out.set(heightAt(x - e, z) - heightAt(x + e, z), 2 * e, heightAt(x, z - e) - heightAt(x, z + e)).normalize();
}
export function surfAt(x, z) {
  const i = Math.round(x - X0), j = Math.round(z - Z0);
  if (i < 0 || j < 0 || i >= NX || j >= NZ) return S.OUT;
  return SURF[j * NX + i];
}
export function holePos(h) { return new THREE.Vector3(h.green[0] + h.cup[0], 0, h.green[1] + h.cup[1]); }
// posizione della buca sul green (leggermente spostata dal centro, verso il fondo)
for (const h of HOLES) { const dx = h.green[0] - h.mid[0], dz = h.green[1] - h.mid[1], l = Math.hypot(dx, dz); h.cup = [dx / l * 3 + (dz / l) * 2, dz / l * 3 - (dx / l) * 2]; h.cupY = heightAt(h.green[0] + h.cup[0], h.green[1] + h.cup[1]); h.teeY = heightAt(...h.tee); }

// ---------- texture del terreno, disegnata una volta ----------
const PX = 6; // pixel per metro
const _nrm = new THREE.Vector3();
const hash2 = (i, j) => { const h = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return h - Math.floor(h); };
export function terrainTexture(compute) {
  // di solito si carica l'immagine già pronta (calcolarla sul telefono richiede troppi secondi)
  if (!compute) { const t = new THREE.TextureLoader().load('assets/terrain.jpg', undefined, undefined, () => { const c = terrainTexture(true); t.image = c.image; t.needsUpdate = true; }); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.flipY = false; return t; }
  const cw = Math.min(2048, W * PX), ch = Math.round(cw * D / W), sx = cw / W;
  const c = document.createElement('canvas'); c.width = cw; c.height = ch; const g = c.getContext('2d');
  const img = g.createImageData(cw, ch), d = img.data;
  const col = { [S.ROUGH]: [78, 132, 56], [S.FAIR]: [116, 176, 70], [S.GREEN]: [126, 194, 80], [S.FRINGE]: [100, 160, 62], [S.SAND]: [236, 218, 166], [S.WATER]: [70, 110, 60], [S.TEE]: [122, 184, 76], [S.OUT]: [70, 110, 60] };
  // direzione di gioco più vicina (per le strisce del taglio, che seguono la buca)
  const lane = (x, z) => { let best = 1e9, c = 0, along = 0; for (const h of HOLES) for (const [a, b] of [[h.tee, h.mid], [h.mid, h.green]]) { const [d, t] = segDist(x, z, ...a, ...b); if (d < best) { best = d; const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz); c = ((x - a[0]) * -dz + (z - a[1]) * dx) / l; along = t * l; } } return [c, along, best]; };
  const sq = v => Math.max(-1, Math.min(1, v * 3.5)); // onda quadra con bordi morbidi
  for (let py = 0; py < ch; py++) for (let px = 0; px < cw; px++) {
    const x = X0 + px / sx, z = Z0 + py / sx, s = surfExact(x, z), h = heightAt(x, z);
    let [r, gg, b] = col[s];
    const n = fbm(x * 0.15, z * 0.15, 3) - 0.5, n2 = fbm(x * 0.6 + 9, z * 0.6, 2) - 0.5;
    let k = 1 + n * 0.22 + n2 * 0.08;
    if (s === S.FAIR || s === S.TEE) {
      // taglio dell'erba a corsie lungo la buca, come sui campi veri (chiaro/scuro alternati)
      const [c] = lane(x, z); k = 1 + n * 0.1 + n2 * 0.04; k *= 1 + 0.05 * sq(Math.sin(c * Math.PI / 3.6));
    } else if (s === S.GREEN || s === S.FRINGE) { const [c] = lane(x, z); k = 1 + n * 0.06 + n2 * 0.03; if (s === S.GREEN) k *= 1 + 0.04 * sq(Math.sin(c * Math.PI / 1.5)); }
    if (s === S.ROUGH) {
      // "primo taglio": fascia di erba media attorno al corridoio, poi il rough vero
      let fd = 1e9; for (const hole of HOLES) fd = Math.min(fd, fairDist(hole, x, z)); fd += (fbm(x * 0.08, z * 0.08, 2) - 0.5) * 2.5;
      if (fd < FAIR_W + 2.4) { const t = Math.min(1, (FAIR_W + 2.4 - fd) / 0.6); r = r * (1 - t) + 98 * t; gg = gg * (1 - t) + 156 * t; b = b * (1 - t) + 62 * t; k = 1 + n * 0.1; }
      const dry = fbm(x * 0.03 + 50, z * 0.03, 2); r += (dry - 0.45) * 22; gg += (dry - 0.45) * 8;
      // sottobosco: verde più scuro e muschioso dove ci sono i boschetti (stessa mappa di densità degli alberi)
      const dens = fbm(x * 0.03 + 11, z * 0.03 - 4, 3);
      if (dens > 0.46) { const t = Math.min(1, (dens - 0.46) / 0.14); r *= 1 - t * 0.3; gg *= 1 - t * 0.18; b *= 1 - t * 0.12; k *= 1 + (n2 * 0.2) * t; }
    }
    if (s === S.SAND) k = 1 + n2 * 0.12;
    // pendii ripidi: roccia a strati
    const pd = nearPond(x, z);
    if (s === S.ROUGH && pd > 1.4) { const ny = normalAt(x, z, _nrm).y; if (ny < 0.9) { const t = Math.min(1, (0.9 - ny) / 0.18), band = 0.9 + 0.1 * Math.sin(h * 5 + n * 3); r = r * (1 - t) + 128 * band * t; gg = gg * (1 - t) + 116 * band * t; b = b * (1 - t) + 98 * band * t; } }
    if (pd < 1.4) { const t = sstep(1.25, 0.95, pd); r = r * (1 - t) + 214 * t; gg = gg * (1 - t) + 200 * t; b = b * (1 - t) + 150 * t; k = 1 + n2 * 0.1; } // riva del laghetto: erba scura, poi fango
    else if (h < 0.8 && s !== S.SAND && Math.max(Math.abs((x - X0) / W * 2 - 1), Math.abs((z - Z0) / D * 2 - 1)) > 0.6) { const t = Math.max(0, Math.min(1, (0.8 - h) / 1.2)); r = r * (1 - t) + 196 * t; gg = gg * (1 - t) + 180 * t; b = b * (1 - t) + 130 * t; } // spiaggia
    if (h < WATER + 0.35 && h > WATER - 0.3) { const t = 1 - Math.abs(h - WATER - 0.02) / 0.33; r = r * (1 - t * 0.35); gg = gg * (1 - t * 0.3); b = b * (1 - t * 0.2); } // sabbia bagnata
    // bordo erboso più scuro attorno ai bunker
    if (s !== S.SAND) for (const hole of HOLES) for (const [bx, bz, br] of hole.bunkers) { const dd = Math.hypot(x - bx, z - bz) / br; if (dd > 0.95 && dd < 1.25) k *= 0.9 + (dd - 0.95) * 0.33; }
    // ombra delle conche, luce sui dossi (occlusione finta dal terreno)
    if (pd > 1.6) { const avg = (heightAt(x + 3, z) + heightAt(x - 3, z) + heightAt(x, z + 3) + heightAt(x, z - 3)) / 4; k *= 1 - Math.max(-0.08, Math.min(0.16, (avg - h) * 0.22)); }
    const o = (py * cw + px) * 4; d[o] = r * k; d[o + 1] = gg * k; d[o + 2] = b * k; d[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  // sentieri del golf cart: dal green alla buca dopo
  g.lineCap = 'round'; g.lineJoin = 'round';
  const P = (x, z) => [(x - X0) * sx, (z - Z0) * sx];
  for (let i = 0; i + 1 < HOLES.length; i++) {
    const a = HOLES[i].green, b2 = HOLES[i + 1].tee, mx = (a[0] + b2[0]) / 2 + (b2[1] - a[1]) * 0.15, mz = (a[1] + b2[1]) / 2 - (b2[0] - a[0]) * 0.15;
    for (const [w, st] of [[3.2, 'rgba(120,100,70,0.35)'], [2.4, 'rgba(214,196,160,0.95)']]) {
      g.strokeStyle = st; g.lineWidth = w * sx; g.beginPath(); g.moveTo(...P(a[0] + (b2[0] - a[0]) * 0.12, a[1] + (b2[1] - a[1]) * 0.12)); g.quadraticCurveTo(...P(mx, mz), ...P(b2[0] - (b2[0] - a[0]) * 0.12, b2[1] - (b2[1] - a[1]) * 0.12)); g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.flipY = false;
  return t;
}
export function terrainMesh(step = 1.5) {
  const nx = Math.round(W / step), nz = Math.round(D / step);
  const geo = new THREE.PlaneGeometry(W, D, nx, nz); geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i) + X0 + W / 2, z = p.getZ(i) + Z0 + D / 2; p.setXYZ(i, x, heightAt(x, z), z); uv.setXY(i, (x - X0) / W, (z - Z0) / D); }
  geo.computeVertexNormals();
  const grain = noiseTex();
  const mat = new THREE.MeshStandardMaterial({ map: terrainTexture(), roughness: 0.95 });
  mat.onBeforeCompile = sh => {
    sh.uniforms.uGrain = { value: grain };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWp = (modelMatrix * vec4(transformed,1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp; uniform sampler2D uGrain;')
      .replace('#include <map_fragment>', '#include <map_fragment>\n float gr = texture2D(uGrain, vWp.xz * 0.35).r * 0.6 + texture2D(uGrain, vWp.xz * 0.05).r * 0.4; diffuseColor.rgb *= 0.82 + gr * 0.36;');
  };
  const m = new THREE.Mesh(geo, mat); m.receiveShadow = true;
  return m;
}
function noiseTex() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), img = g.createImageData(256, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) { const v = (fbm(x * 0.08, y * 0.08, 3) * 0.6 + Math.random() * 0.4) * 255; const o = (y * 256 + x) * 4; img.data[o] = img.data[o + 1] = img.data[o + 2] = v; img.data[o + 3] = 255; }
  g.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
