// Arredo del percorso: club house con parcheggio, panchine, cartelli delle buche, lava-palline, cestini e golf cart.
// Modelli KayKit City Builder Bits (CC0) + pezzi fatti qui con forme semplici. Va chiamato DOPO loadNature (usa i tronchi per evitare gli alberi).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HOLES, S, surfAt, heightAt, fairDist, GREEN_R, WATER } from './course.js';
import { trunks } from './nature.js';

const K = 4.5; // i modelli City Bits sono in scala 1:4.5 circa
const FILES = ['bench', 'building_B_withoutBase', 'building_E_withoutBase', 'car_stationwagon', 'car_hatchback', 'streetlight'];

const M = {
  wood: new THREE.MeshStandardMaterial({ color: 0x9a6a3e, roughness: 0.85 }),
  woodD: new THREE.MeshStandardMaterial({ color: 0x6e4826, roughness: 0.9 }),
  white: new THREE.MeshStandardMaterial({ color: 0xf3f1ea, roughness: 0.5 }),
  green: new THREE.MeshStandardMaterial({ color: 0x1f7a4d, roughness: 0.6 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.7 }),
  metal: new THREE.MeshStandardMaterial({ color: 0xb8bec8, roughness: 0.3, metalness: 0.7 }),
  seat: new THREE.MeshStandardMaterial({ color: 0x3a3f4a, roughness: 0.8 }),
};
const box = (w, h, d, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; return o; };
const cyl = (r1, r2, h, m, x = 0, y = 0, z = 0, seg = 12) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; return o; };

function signTex(n, par, len) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 192; const g = c.getContext('2d');
  g.fillStyle = '#1f6b45'; g.fillRect(0, 0, 256, 192); g.strokeStyle = '#f3e9c8'; g.lineWidth = 8; g.strokeRect(8, 8, 240, 176);
  g.fillStyle = '#f3e9c8'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '700 30px Fredoka, Arial'; g.fillText('BUCA', 128, 38);
  g.font = '700 78px Fredoka, Arial'; g.fillText(String(n), 128, 96);
  g.font = '600 28px Fredoka, Arial'; g.fillText(`PAR ${par} · ${len} m`, 128, 156);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function teeSign(n, par, len) {
  const g = new THREE.Group();
  g.add(box(0.14, 1.5, 0.14, M.woodD, -0.75, 0.75, 0), box(0.14, 1.5, 0.14, M.woodD, 0.75, 0.75, 0));
  g.add(box(1.9, 1.35, 0.1, M.wood, 0, 1.55, 0));
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.2), new THREE.MeshStandardMaterial({ map: signTex(n, par, len), roughness: 0.7 }));
  face.position.set(0, 1.55, 0.056); g.add(face);
  g.add(box(2.1, 0.12, 0.3, M.woodD, 0, 2.28, 0));
  return g;
}
function ballWasher(color) {
  const g = new THREE.Group();
  g.add(cyl(0.06, 0.06, 1.0, M.dark, 0, 0.5, 0, 8));
  g.add(box(0.36, 0.42, 0.24, new THREE.MeshStandardMaterial({ color, roughness: 0.4 }), 0, 1.15, 0));
  g.add(cyl(0.025, 0.025, 0.35, M.metal, 0, 1.5, 0, 6));
  g.add(box(0.5, 0.06, 0.4, M.dark, 0, 0.03, 0));
  return g;
}
function bin() {
  const g = new THREE.Group();
  g.add(cyl(0.32, 0.28, 0.85, M.green, 0, 0.43, 0, 14));
  g.add(cyl(0.35, 0.35, 0.08, M.dark, 0, 0.88, 0, 14));
  return g;
}
function golfCart(color) {
  const g = new THREE.Group(), body = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.1 });
  g.add(box(1.25, 0.32, 2.3, body, 0, 0.5, 0));                 // telaio
  g.add(box(1.2, 0.55, 0.55, body, 0, 0.82, 0.95));               // muso
  g.add(box(1.1, 0.16, 0.7, M.seat, 0, 0.82, -0.05));             // sedile
  g.add(box(1.1, 0.55, 0.14, M.seat, 0, 1.1, -0.42));             // schienale
  g.add(box(1.15, 0.5, 0.7, M.dark, 0, 0.92, -0.85));              // sacche
  for (const x of [-0.55, 0.55]) for (const z of [-0.95, 0.55]) g.add(cyl(0.035, 0.035, 1.25, M.metal, x, 1.3, z, 6));
  g.add(box(1.35, 0.08, 1.85, M.white, 0, 1.95, -0.2));            // tettuccio
  const ws = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.75), new THREE.MeshStandardMaterial({ color: 0xbfe3ff, transparent: true, opacity: 0.35, roughness: 0.05, side: THREE.DoubleSide }));
  ws.position.set(0, 1.5, 0.58); g.add(ws);
  g.add(cyl(0.2, 0.2, 0.06, M.dark, 0.25, 1.05, 0.55, 12).rotateX(-1.0)); // volante
  const wg = new THREE.CylinderGeometry(0.26, 0.26, 0.18, 14); wg.rotateZ(Math.PI / 2);
  for (const x of [-0.6, 0.6]) for (const z of [-0.75, 0.8]) { const w = new THREE.Mesh(wg, M.dark); w.position.set(x, 0.26, z); w.castShadow = true; g.add(w); }
  return g;
}
// panchina in legno (più "golf" di quella da città, che teniamo per la club house)
function bench() {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) g.add(box(1.8, 0.06, 0.13, M.wood, 0, 0.48, -0.17 + i * 0.17));
  for (let i = 0; i < 2; i++) g.add(box(1.8, 0.12, 0.05, M.wood, 0, 0.72 + i * 0.18, -0.3));
  for (const x of [-0.75, 0.75]) { g.add(box(0.08, 0.48, 0.45, M.dark, x, 0.24, -0.02)); g.add(box(0.08, 0.5, 0.06, M.dark, x, 0.7, -0.3)); }
  return g;
}

// Zone occupate dall'arredo, calcolate solo dal terreno: così PC e telefono mettono tutto negli stessi punti
// e loadNature può evitare di piantarci alberi sopra.
export function propZones() { const z = []; layout(null, z, {}); return z; }

export async function loadProps(scene, { mobile = false } = {}) {
  const ld = new GLTFLoader(), src = {};
  await Promise.all(FILES.map(async f => { src[f] = (await ld.loadAsync('assets/city/' + f + '.gltf')).scene; }));
  const r = layout(scene, [], { src, mobile });
  window.__props = r; return r;
}

function layout(scene, placed, { src, mobile }) {
  const free = (x, z, r) => placed.every(p => Math.hypot(p.x - x, p.z - z) > p.r + r);
  const flatness = (x, z, r) => { let lo = 1e9, hi = -1e9; for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const h = heightAt(x + i * r, z + j * r); lo = Math.min(lo, h); hi = Math.max(hi, h); } return hi - lo; };
  const okLand = (x, z, r, fair = 6) => { const s = surfAt(x, z); return (s === S.ROUGH || s === S.TEE || (fair === 0 && (s === S.FAIR || s === S.FRINGE))) && heightAt(x, z) > WATER + 0.8 && HOLES.every(h => fairDist(h, x, z) > fair && Math.hypot(x - h.green[0], z - h.green[1]) > GREEN_R + 6); };
  function put(mk, x, z, yaw, r, sink = 0.04) {
    placed.push({ x, z, r }); if (!scene) return;
    const obj = mk();
    let lo = 1e9; for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) lo = Math.min(lo, heightAt(x + i * r * 0.6, z + j * r * 0.6));
    obj.position.set(x, lo - sink, z); obj.rotation.y = yaw;
    obj.traverse(o => { if (o.isMesh) { o.castShadow = !mobile; o.receiveShadow = true; } });
    obj.updateMatrixWorld(true); obj.traverse(o => { o.matrixAutoUpdate = false; });
    scene.add(obj);
    return obj;
  }
  const solid = (t) => { if (scene) trunks.push(t); };
  const kit = (name) => { const o = src[name].clone(true); o.scale.setScalar(K); return o; };
  const cartColors = [0xf3f1ea, 0xffd23f, 0x2ec27e, 0xf3f1ea, 0xff6b6b, 0x3d7bff];

  HOLES.forEach((h, i) => {
    const dx = h.mid[0] - h.tee[0], dz = h.mid[1] - h.tee[1], l = Math.hypot(dx, dz), fx = dx / l, fz = dz / l, sx = -fz, sz = fx;
    const yaw = Math.atan2(fx, fz), at = (b, s) => [h.tee[0] - fx * b + sx * s, h.tee[1] - fz * b + sz * s];
    const len = Math.round(Math.hypot(h.green[0] - h.tee[0], h.green[1] - h.tee[1]));
    // cartello della buca, a sinistra del tee e girato verso chi arriva
    for (const s of [-5.5, 5.5, -7.5]) { const [x, z] = at(2.5, s); if (okLand(x, z, 1, 0) && free(x, z, 1.2)) { put(() => teeSign(i + 1, h.par, len), x, z, yaw + Math.PI, 1.1); solid({ x, z, r: 0.25, h: 2.4 }); break; } }
    // lava-palline e cestino dall'altra parte
    for (const s of [5, -5, 7]) { const [x, z] = at(1.5, s); if (okLand(x, z, 0.6, 0) && free(x, z, 0.8)) { put(() => ballWasher([0xff4d6d, 0xffc93a, 0x3d7bff, 0x2ec27e, 0x9a5cff, 0xff7b3d][i]), x, z, yaw, 0.4); const [bx, bz] = [x - fx * 1.0, z - fz * 1.0]; put(bin, bx, bz, 0, 0.4); break; } }
    // panchina dietro al tee, rivolta verso il colpo
    for (const [b, s] of [[7, 3], [7, -3], [9, 0], [6, 6]]) { const [x, z] = at(b, s); if (okLand(x, z, 1.2, 0) && free(x, z, 1.3)) { put(bench, x, z, yaw, 1); solid({ x, z, r: 0.8, h: 1.0 }); break; } }
    // golf cart parcheggiato a lato
    for (const [b, s] of [[5, 9], [5, -9], [10, 8], [10, -8]]) { const [x, z] = at(b, s); if (okLand(x, z, 1.5, 0) && free(x, z, 1.8) && flatness(x, z, 1.2) < 0.5) { put(() => golfCart(cartColors[i]), x, z, yaw + 0.35 * Math.sign(s), 1.3); solid({ x, z, r: 1.2, h: 2 }); break; } }
  });

  // club house con parcheggio, vicino al tee della buca 1
  const h = HOLES[0], dx = h.mid[0] - h.tee[0], dz = h.mid[1] - h.tee[1], l = Math.hypot(dx, dz), fx = dx / l, fz = dz / l;
  let best = null;
  for (let a = 0; a < 24; a++) for (const d of [22, 28, 34, 40]) {
    const ang = Math.atan2(-fz, -fx) + (a - 12) * 0.13, x = h.tee[0] + Math.cos(ang) * d, z = h.tee[1] + Math.sin(ang) * d;
    if (!okLand(x, z, 6, 14) || !free(x, z, 11)) continue;
    const fl = flatness(x, z, 8); const sc = fl + d * 0.02; if (!best || sc < best.sc) best = { x, z, sc };
  }
  let club = null;
  if (best) {
    const toTee = Math.atan2(h.tee[0] - best.x, h.tee[1] - best.z);
    put(() => {
    const g = new THREE.Group(); const b1 = kit('building_E_withoutBase'), b2 = kit('building_B_withoutBase');
    b1.position.set(-4.4, 0, 0); b2.position.set(3.6, 0, 0.6); g.add(b1, b2);
    // insegna
    const c = document.createElement('canvas'); c.width = 512; c.height = 128; const cg = c.getContext('2d'); cg.fillStyle = '#1f6b45'; cg.fillRect(0, 0, 512, 128); cg.fillStyle = '#f3e9c8'; cg.font = '700 64px Fredoka, Arial'; cg.textAlign = 'center'; cg.textBaseline = 'middle'; cg.fillText('CLUB HOUSE', 256, 68);
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.25), new THREE.MeshStandardMaterial({ map: tx, roughness: 0.6 })); sign.position.set(0, 3.2, 3.9); g.add(sign);
    g.add(box(5.2, 1.4, 0.15, M.woodD, 0, 3.2, 3.8));
    // veranda
    g.add(box(15, 0.25, 4, M.wood, 0, 0.12, 5));
    for (const x of [-6.5, -2, 2, 6.5]) g.add(cyl(0.12, 0.12, 2.6, M.white, x, 1.4, 6.6, 8));
    g.add(box(15.4, 0.18, 4.4, M.green, 0, 2.75, 5));
    for (const x of [-5, 5]) { const bb = kit('bench'); bb.position.set(x, 0.25, 6.2); g.add(bb); }
    // parcheggio con due macchine e i lampioni
    const lot = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.MeshStandardMaterial({ color: 0x5b5f66, roughness: 0.95 })); lot.rotation.x = -Math.PI / 2; lot.position.set(11.5, 0.06, 4); lot.receiveShadow = true; g.add(lot);
    for (let k = 0; k < 3; k++) { const ln = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 4.5), M.white); ln.rotation.x = -Math.PI / 2; ln.position.set(8.5 + k * 3, 0.08, 2.2); g.add(ln); }
    const c1 = kit('car_stationwagon'); c1.position.set(10, 0.32, 2.4); c1.rotation.y = Math.PI; g.add(c1);
    const c2 = kit('car_hatchback'); c2.position.set(13, 0.32, 2.2); c2.rotation.y = Math.PI + 0.08; g.add(c2);
    for (const [x, z, r] of [[-8.5, 7.5, 0], [8.5, 8, 0], [15.8, 8.5, Math.PI]]) { const s = kit('streetlight'); s.position.set(x, 0, z); s.rotation.y = r; g.add(s); }
    return g; }, best.x, best.z, toTee, 11, 0.1);
    solid({ x: best.x, z: best.z, r: 7, h: 9 }); { const cx = Math.cos(toTee), sz = Math.sin(toTee); solid({ x: best.x + cx * 11.5, z: best.z - sz * 11.5, r: 3.2, h: 2 }); }
    club = { x: best.x, z: best.z };
  }
  return { n: placed.length, club };
}
