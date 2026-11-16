// Le buche del minigolf del Ridotto. Ogni buca è una lista di pezzi: pavimenti, rampe, muri,
// respingenti, ostacoli che si muovono, scatole dei poteri. Il costruttore crea sia la fisica (cannon-es) sia la grafica.
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export const BALL_R = 0.05;
export const HOLE_R = 0.085;

// ---------- definizioni ----------
// p: pavimento [x, z, larghezza, profondità, y] · w: muro [x1, z1, x2, z2, altezza] · r: rampa [x, z, larghezza, lunghezza, y0, y1, rotY]
// b: respingente [x, z, raggio] · s: girandola [x, z, lunghezza, velocità] · m: blocco mobile [x, z, w, d, asse 'x'|'z', ampiezza, velocità]
// d: disco rotante [x, z, raggio, velocità] · q: scatola dei poteri [x, z] · deco: [tipo, x, z, ...]
export const HOLES = [
  {
    name: 'Benvenuti al Ridotto', par: 2, tee: [0, 2.6], hole: [0, -2.6],
    p: [[0, 0, 1.6, 6.4]],
    w: [[-0.8, 3.2, 0.8, 3.2], [-0.8, -3.2, 0.8, -3.2], [-0.8, 3.2, -0.8, -3.2], [0.8, 3.2, 0.8, -3.2]],
    b: [[-0.35, 0, 0.12], [0.35, -0.6, 0.12], [0, 0.7, 0.1]],
    q: [[0, -1.2]],
  },
  {
    name: 'I dadi', par: 3, tee: [-2.4, 2.4], hole: [2.4, -2.4], wp: [[-2.4, -2.4]],
    p: [[-2.4, 0.3, 1.4, 5.6], [0, -2.4, 6.2, 1.4]],
    w: [[-3.1, 3.1, -1.7, 3.1], [-3.1, 3.1, -3.1, -3.1], [-1.7, 3.1, -1.7, -1.7], [-3.1, -3.1, 3.1, -3.1], [-1.7, -1.7, 3.1, -1.7], [3.1, -1.7, 3.1, -3.1]],
    dice: [[-2.62, 0.6, 0.36, 0.4], [-2.15, -0.7, 0.34, 1.1], [0, -2.2, 0.36, 0.2], [1.3, -2.62, 0.3, 0.9]],
    q: [[-2.4, -1.4], [1.0, -2.0]],
  },
  {
    name: 'La roulette', par: 3, tee: [0, 3.0], hole: [0, -3.2],
    p: [[0, 2.6, 1.2, 1.8], [0, -2.7, 1.2, 2.0]],
    d: [[0, 0, 1.75, 0.9]],
    w: [[-0.6, 3.5, 0.6, 3.5], [-0.6, 3.5, -0.6, 1.7], [0.6, 3.5, 0.6, 1.7], [-0.6, -3.7, 0.6, -3.7], [-0.6, -3.7, -0.6, -1.7], [0.6, -3.7, 0.6, -1.7]],
    b: [[0.9, 0.5, 0.1], [-0.8, -0.6, 0.1], [0.3, -0.9, 0.1]],
    q: [[-0.9, 0.4]],
  },
  {
    name: 'Il salto', par: 3, tee: [0, 2.9], hole: [0, -3.2], wp: [[2.0, 2.7], [2.0, -2.6]],
    p: [[0.55, 2.7, 2.4, 1.8], [2.0, 0, 0.6, 7.2], [0.45, -2.4, 2.5, 2.8]],
    r: [[0, 1.2, 1.0, 1.4, 0, 0.35, 0]],
    w: [[-0.65, 3.6, 2.3, 3.6], [-0.65, 3.6, -0.65, 1.8], [-0.65, 1.8, -0.5, 1.8], [0.5, 1.8, 1.7, 1.8], [2.3, 3.6, 2.3, -3.8], [1.7, 1.8, 1.7, -1.0], [-0.8, -1.0, -0.8, -3.8], [-0.8, -3.8, 2.3, -3.8]],
    b: [[2.0, 0.8, 0.1], [2.0, -0.6, 0.1]],
    q: [[2.0, 0.1]],
  },
  {
    name: 'Il mulino', par: 3, tee: [0, 3.0], hole: [0, -3.0],
    p: [[0, 0, 2.0, 6.6]],
    w: [[-1, 3.3, 1, 3.3], [-1, -3.3, 1, -3.3], [-1, 3.3, -1, -3.3], [1, 3.3, 1, -3.3], [-1, -1.2, -0.22, -1.2], [0.22, -1.2, 1, -1.2]],
    s: [[0, -0.55, 0.55, 1.6], [0, 1.0, 0.75, -1.1]],
    m: [[0, -2.2, 0.5, 0.12, 'x', 0.55, 1.3]],
    q: [[-0.6, 0.2], [0.6, 0.2]],
  },
  {
    name: 'Il labirinto del Conte', par: 5, tee: [-2.3, 2.6], hole: [2.4, -2.6], wp: [[-2.3, -2.3], [-0.6, -2.3], [-0.6, 2.3], [1.7, 2.3]],
    p: [[0, 0, 6.0, 6.0]],
    w: [[-3, 3, 3, 3], [-3, -3, 3, -3], [-3, 3, -3, -3], [3, 3, 3, -3], [-1.6, 3, -1.6, -1.6], [0.4, -3, 0.4, 1.6]],
    m: [[-0.6, 0.0, 0.5, 0.12, 'x', 0.62, 1.1], [1.7, -0.5, 0.6, 0.12, 'x', 0.75, 1.4]],
    s: [[-2.3, 0.6, 0.55, 1.4]],
    b: [[2.0, 0.9, 0.1], [1.2, -1.6, 0.12], [-1.0, -2.3, 0.1]],
    q: [[-2.3, -1.2], [-0.6, 1.4], [1.7, 1.0]],
  },
];

// ---------- texture ----------
function ctex(w, h, draw, rep) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); } return t; }
const turf = ctex(256, 256, (g, w, h) => {
  g.fillStyle = '#2f8a3c'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 9000; i++) { g.fillStyle = `hsl(${110 + Math.random() * 20},${50 + Math.random() * 20}%,${25 + Math.random() * 18}%)`; g.fillRect(Math.random() * w, Math.random() * h, 1, 2 + Math.random() * 2); }
  g.fillStyle = 'rgba(255,255,255,.04)'; for (let i = 0; i < 8; i++) g.fillRect(0, i * 32, w, 16);
}, [1, 1]);
export const MATS = {
  turf: (w, d) => { const t = turf.clone(); t.repeat.set(w / 0.8, d / 0.8); t.needsUpdate = true; return new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 }); },
  side: new THREE.MeshStandardMaterial({ color: 0x1a120d, roughness: 0.6 }),
  wall: new THREE.MeshPhysicalMaterial({ color: 0x7a1424, roughness: 0.35, clearcoat: 0.6 }),
  wallTop: new THREE.MeshStandardMaterial({ color: 0xd9b25f, metalness: 0.9, roughness: 0.3 }),
  neon: new THREE.MeshBasicMaterial({ color: 0xff3d9a, toneMapped: false }),
  bumper: new THREE.MeshPhysicalMaterial({ color: 0xd9b25f, metalness: 0.8, roughness: 0.25 }),
  moving: new THREE.MeshPhysicalMaterial({ color: 0x38e8ff, emissive: 0x0a5a6a, roughness: 0.3, clearcoat: 1 }),
};

// ---------- costruzione ----------
export function buildHole(def, world, mats, scene) {
  const grp = new THREE.Group(); scene.add(grp);
  const bodies = [], movers = [], pickups = [];
  const add = (body) => { world.addBody(body); bodies.push(body); return body; };
  const staticBox = (hx, hy, hz, x, y, z, mat, q) => { const b = new CANNON.Body({ mass: 0, material: mat }); b.addShape(new CANNON.Box(new CANNON.Vec3(hx, hy, hz))); b.position.set(x, y, z); if (q) b.quaternion.copy(q); return add(b); };
  const [hx0, hz0] = def.hole;
  // pavimenti: si lascia un buco quadrato attorno alla buca
  const floors = [...def.p, ...(def.p2 || [])];
  for (const [x, z, w, d, y = 0] of floors) {
    const inside = Math.abs(hx0 - x) < w / 2 && Math.abs(hz0 - z) < d / 2;
    const top = y, th = 0.2;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, th, d), [MATS.side, MATS.side, MATS.turf(w, d), MATS.side, MATS.side, MATS.side]);
    mesh.position.set(x, top - th / 2, z); mesh.receiveShadow = true; grp.add(mesh);
    if (!inside) { staticBox(w / 2, th / 2, d / 2, x, top - th / 2, z, mats.floor); continue; }
    // quattro rettangoli attorno al foro
    const s = HOLE_R + 0.004, x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2;
    const rect = (ax, az, bx, bz) => { if (bx - ax > 0.001 && bz - az > 0.001) staticBox((bx - ax) / 2, th / 2, (bz - az) / 2, (ax + bx) / 2, top - th / 2, (az + bz) / 2, mats.floor); };
    rect(x0, z0, hx0 - s, z1); rect(hx0 + s, z0, x1, z1); rect(hx0 - s, z0, hx0 + s, hz0 - s); rect(hx0 - s, hz0 + s, hx0 + s, z1);
    // coppa
    staticBox(0.2, 0.02, 0.2, hx0, top - 0.32, hz0, mats.floor);
    for (const [ox, oz, a, c] of [[s + 0.02, 0, 0.02, s], [-s - 0.02, 0, 0.02, s], [0, s + 0.02, s, 0.02], [0, -s - 0.02, s, 0.02]]) staticBox(a, 0.16, c, hx0 + ox, top - 0.16, hz0 + oz, mats.wall);
    def.holeY = top;
  }
  if (def.holeY == null) def.holeY = 0;
  // buco disegnato
  const holeM = new THREE.Mesh(new THREE.CircleGeometry(HOLE_R, 32), new THREE.MeshBasicMaterial({ color: 0x050505 })); holeM.rotation.x = -Math.PI / 2; holeM.position.set(hx0, def.holeY + 0.002, hz0); grp.add(holeM);
  const ring = new THREE.Mesh(new THREE.RingGeometry(HOLE_R, HOLE_R + 0.012, 32), new THREE.MeshBasicMaterial({ color: 0xffffff })); ring.rotation.x = -Math.PI / 2; ring.position.set(hx0, def.holeY + 0.003, hz0); grp.add(ring);
  // bandiera
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.9), new THREE.MeshStandardMaterial({ color: 0xeeeeee, metalness: 0.5 })); pole.position.set(hx0, def.holeY + 0.45, hz0); grp.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.2, 8, 1), new THREE.MeshStandardMaterial({ color: 0xff3d9a, side: THREE.DoubleSide, emissive: 0x551030 })); flag.position.set(hx0 + 0.15, def.holeY + 0.8, hz0); grp.add(flag);
  // tee
  const tee = new THREE.Mesh(new THREE.CircleGeometry(0.16, 24), new THREE.MeshStandardMaterial({ color: 0xd9b25f, roughness: 0.4 })); tee.rotation.x = -Math.PI / 2; tee.position.set(def.tee[0], 0.003, def.tee[1]); grp.add(tee);
  // muri
  for (const [x1, z1, x2, z2, h = 0.22] of def.w) {
    const len = Math.hypot(x2 - x1, z2 - z1), ang = Math.atan2(x2 - x1, z2 - z1);
    const q = new CANNON.Quaternion().setFromAxisAngle(new CANNON.Vec3(0, 1, 0), ang);
    const y = floorYAt(def, (x1 + x2) / 2, (z1 + z2) / 2);
    staticBox(0.05, h / 2, len / 2 + 0.05, (x1 + x2) / 2, y + h / 2, (z1 + z2) / 2, mats.wall, q);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, h, len + 0.1), MATS.wall); m.position.set((x1 + x2) / 2, y + h / 2, (z1 + z2) / 2); m.rotation.y = ang; m.castShadow = true; m.receiveShadow = true; grp.add(m);
    const tp = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.02, len + 0.11), MATS.wallTop); tp.position.set(m.position.x, y + h + 0.01, m.position.z); tp.rotation.y = ang; grp.add(tp);
  }
  // rampe
  for (const [x, z, w, len, y0, y1, ry = 0] of def.r || []) {
    const ang = Math.atan2(y1 - y0, len), L2 = Math.hypot(len, y1 - y0);
    const q = new CANNON.Quaternion().setFromEuler(ang, ry, 0, 'YXZ');
    const cy = (y0 + y1) / 2 - 0.05 * Math.cos(ang);
    staticBox(w / 2, 0.05, L2 / 2, x, cy, z, mats.floor, q);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, L2), [MATS.side, MATS.side, MATS.turf(w, L2), MATS.side, MATS.side, MATS.side]);
    m.position.set(x, cy, z); m.quaternion.set(q.x, q.y, q.z, q.w); m.receiveShadow = true; grp.add(m);
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 3), MATS.neon); arrow.rotation.x = -Math.PI / 2 - ang; arrow.position.set(x, (y0 + y1) / 2 + 0.06, z); grp.add(arrow);
  }
  // respingenti (pile di fiches)
  for (const [x, z, r] of def.b || []) {
    const b = new CANNON.Body({ mass: 0, material: mats.bumper }); b.addShape(new CANNON.Cylinder(r, r, 0.25, 16)); b.position.set(x, 0.125 + floorYAt(def, x, z), z); add(b);
    const m = new THREE.Group();
    for (let k = 0; k < 5; k++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.045, 24), new THREE.MeshStandardMaterial({ color: [0xc8261c, 0x111111, 0x1c56d8, 0xf2f2f2, 0x127a3a][(k + Math.round(x * 10)) % 5], roughness: 0.4 })); c.position.y = 0.025 + k * 0.05; c.castShadow = true; m.add(c); }
    m.position.set(x, floorYAt(def, x, z), z); grp.add(m);
  }
  // dadi giganti
  for (const [x, z, s, rot] of def.dice || []) {
    const q = new CANNON.Quaternion().setFromAxisAngle(new CANNON.Vec3(0, 1, 0), rot);
    staticBox(s / 2, s / 2, s / 2, x, s / 2, z, mats.wall, q);
    const m = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), diceMats()); m.position.set(x, s / 2, z); m.rotation.y = rot; m.castShadow = true; grp.add(m);
  }
  // girandole (bracci che ruotano)
  for (const [x, z, len, sp] of def.s || []) {
    const b = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC, material: mats.wall });
    b.addShape(new CANNON.Box(new CANNON.Vec3(len, 0.08, 0.04))); b.addShape(new CANNON.Box(new CANNON.Vec3(0.04, 0.08, len)));
    b.position.set(x, 0.1, z); b.angularVelocity.set(0, sp, 0); add(b);
    const m = new THREE.Group();
    const arm = new THREE.Mesh(new THREE.BoxGeometry(len * 2, 0.16, 0.08), MATS.moving); m.add(arm); const arm2 = arm.clone(); arm2.rotation.y = Math.PI / 2; m.add(arm2);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.3, 16), MATS.wallTop); m.add(hub);
    m.position.set(x, 0.1, z); m.traverse(o => o.castShadow = true); grp.add(m); movers.push({ body: b, mesh: m });
  }
  // blocchi che vanno avanti e indietro
  for (const [x, z, w, d, ax, amp, sp] of def.m || []) {
    const b = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC, material: mats.wall });
    b.addShape(new CANNON.Box(new CANNON.Vec3(w / 2, 0.1, d / 2))); b.position.set(x, 0.1, z); add(b);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.2, d), MATS.moving); m.castShadow = true; grp.add(m);
    movers.push({ body: b, mesh: m, slide: { x, z, ax, amp, sp } });
  }
  // dischi rotanti (roulette)
  for (const [x, z, r, sp] of def.d || []) {
    const b = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC, material: mats.floor });
    b.addShape(new CANNON.Cylinder(r, r, 0.1, 40)); b.position.set(x, -0.05, z); b.angularVelocity.set(0, sp, 0); add(b);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.1, 64), [rouletteMat(), new THREE.MeshStandardMaterial({ map: rouletteTex(), roughness: 0.5 }), MATS.side]);
    m.material = [new THREE.MeshStandardMaterial({ color: 0x3a1a0a }), new THREE.MeshStandardMaterial({ map: rouletteTex(), roughness: 0.45 }), new THREE.MeshStandardMaterial({ color: 0x3a1a0a })];
    m.receiveShadow = true; grp.add(m); movers.push({ body: b, mesh: m });
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r + 0.03, 0.03, 8, 64), MATS.wallTop); rim.rotation.x = Math.PI / 2; rim.position.set(x, 0.0, z); grp.add(rim);
  }
  for (const [x, z] of def.q || []) pickups.push({ x, z, y: floorYAt(def, x, z), active: true, t: 0 });
  // decorazioni sotto la buca: isola che fluttua
  const isle = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.2, 1.4, 7), new THREE.MeshStandardMaterial({ color: 0x2a1c14, roughness: 1, flatShading: true }));
  const bb = new THREE.Box3().setFromObject(grp), sz = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
  isle.scale.set(sz.x * 0.62, 1, sz.z * 0.62); isle.position.set(c.x, -0.95, c.z); grp.add(isle);
  return { grp, bodies, movers, pickups, flag, bounds: bb };
}
function floorYAt(def, x, z) {
  for (const [fx, fz, w, d, y = 0] of [...def.p, ...(def.p2 || [])]) if (Math.abs(x - fx) <= w / 2 + 0.06 && Math.abs(z - fz) <= d / 2 + 0.06) return y;
  return 0;
}
let _dice = null;
function diceMats() {
  if (_dice) return _dice;
  const face = n => new THREE.MeshPhysicalMaterial({ roughness: 0.2, clearcoat: 1, map: ctex(128, 128, (g, w, h) => {
    g.fillStyle = '#c8101c'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff';
    const P = { 1: [[.5, .5]], 2: [[.25, .25], [.75, .75]], 3: [[.25, .25], [.5, .5], [.75, .75]], 4: [[.25, .25], [.75, .25], [.25, .75], [.75, .75]], 5: [[.25, .25], [.75, .25], [.5, .5], [.25, .75], [.75, .75]], 6: [[.25, .22], [.75, .22], [.25, .5], [.75, .5], [.25, .78], [.75, .78]] }[n];
    for (const [u, v] of P) { g.beginPath(); g.arc(u * w, v * h, 11, 0, 7); g.fill(); }
  }) });
  return (_dice = [1, 6, 2, 5, 3, 4].map(face));
}
function rouletteTex() {
  return ctex(1024, 1024, (g, w, h) => {
    const n = 37; g.translate(w / 2, h / 2);
    for (let i = 0; i < n; i++) { g.fillStyle = i === 0 ? '#127a3a' : i % 2 ? '#b3121b' : '#121212'; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, w / 2, i / n * Math.PI * 2, (i + 1) / n * Math.PI * 2); g.fill(); }
    g.fillStyle = '#3a1a0a'; g.beginPath(); g.arc(0, 0, w * 0.32, 0, 7); g.fill();
    g.strokeStyle = '#d9b25f'; g.lineWidth = 6; g.beginPath(); g.arc(0, 0, w * 0.32, 0, 7); g.stroke();
    g.fillStyle = '#d9b25f'; g.font = '700 70px Georgia'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('RIDOTTO', 0, 0);
  });
}
function rouletteMat() { return new THREE.MeshStandardMaterial({ color: 0x3a1a0a }); }
