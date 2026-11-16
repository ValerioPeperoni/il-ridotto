// Fisica del biliardo: palle su un piano (x lungo il tavolo, z largo), y verso l'alto.
// Modello: strisciamento → rotolamento con attrito del panno, effetto laterale, urti elastici tra palle,
// sponde con perdita di energia e attrito (l'effetto laterale "apre" o "chiude" il rimbalzo), bocche delle buche.
export const T = {
  L: 2.54, W: 1.27, R: 0.028575,
  cp: 0.088,   // distanza dall'angolo dove finisce la sponda (buche d'angolo)
  sp: 0.064,   // metà apertura buca centrale
  back: 0.056, // spessore sponda
};
const G = 9.81, MU_S = 0.2, MU_R = 0.012, SPIN_DEC = 22, E_BALL = 0.95, E_RAIL = 0.78, MU_RAIL = 0.17;
export const DT = 1 / 900;

// Buche: centro del foro (per la grafica) e punto di mira (per bot e linee)
export function pockets() {
  const { L, W } = T, o = 0.014, s = 0.046;
  return [
    { x: -L / 2 - o, z: -W / 2 - o, r: 0.07, aim: [-L / 2 + 0.012, -W / 2 + 0.012], corner: true },
    { x: 0, z: -W / 2 - s, r: 0.064, aim: [0, -W / 2 - 0.01], corner: false },
    { x: L / 2 + o, z: -W / 2 - o, r: 0.07, aim: [L / 2 - 0.012, -W / 2 + 0.012], corner: true },
    { x: -L / 2 - o, z: W / 2 + o, r: 0.07, aim: [-L / 2 + 0.012, W / 2 - 0.012], corner: true },
    { x: 0, z: W / 2 + s, r: 0.064, aim: [0, W / 2 + 0.01], corner: false },
    { x: L / 2 + o, z: W / 2 + o, r: 0.07, aim: [L / 2 - 0.012, W / 2 - 0.012], corner: true },
  ];
}

// Sponde: poligoni (per la grafica) e segmenti (per la fisica). Ogni poligono è un trapezio:
// naso della sponda sul bordo del campo, ganasce inclinate verso la buca.
export function cushions() {
  const { L, W, cp, sp, back } = T, polys = [];
  const jc = 0.024, js = 0.006; // inclinazione ganasce (angolo / centro)
  for (const sz of [-1, 1]) {           // sponde lunghe
    const z0 = sz * W / 2, z1 = sz * (W / 2 + back);
    polys.push([[-L / 2 + cp, z0], [-sp, z0], [-sp + js, z1], [-L / 2 + cp - jc, z1]]);
    polys.push([[sp, z0], [L / 2 - cp, z0], [L / 2 - cp + jc, z1], [sp - js, z1]]);
  }
  for (const sx of [-1, 1]) {           // sponde corte
    const x0 = sx * L / 2, x1 = sx * (L / 2 + back);
    polys.push([[x0, -W / 2 + cp], [x0, W / 2 - cp], [x1, W / 2 - cp + jc], [x1, -W / 2 + cp - jc]]);
  }
  const segs = [];
  for (const p of polys) {
    // lati: naso (0-1) e ganasce (1-2, 3-0); il lato posteriore non serve
    for (const [i, j] of [[0, 1], [1, 2], [3, 0]]) segs.push({ ax: p[i][0], az: p[i][1], bx: p[j][0], bz: p[j][1] });
  }
  return { polys, segs };
}
const SEGS = cushions().segs;
const POCKETS = pockets();

export function makeBall(id, x, z) { return { id, x, z, vx: 0, vz: 0, wx: 0, wy: 0, wz: 0, on: true, moving: false }; }

// Disposizione del triangolo (8-ball): 8 al centro, una piena e una rigata negli angoli dietro
export function rack(rand = Math.random) {
  const { L, R } = T, balls = [makeBall(0, -L / 4, 0)];
  const fx = L / 4, gap = R * 2 + 0.0004;
  const order = [1, 9, 2, 10, 8, 3, 11, 4, 12, 5, 13, 6, 14, 7, 15];
  // mescola mantenendo l'8 al centro e due angoli di tipo diverso
  const rest = order.filter(n => n !== 8);
  for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
  const slots = []; for (let row = 0; row < 5; row++) for (let k = 0; k <= row; k++) slots.push([row, k]);
  const ids = new Array(15);
  ids[4] = 8; // riga 2, centro
  let a = rest.find(n => n < 8), b = rest.find(n => n > 8);
  ids[10] = a; ids[14] = b;
  const left = rest.filter(n => n !== a && n !== b); let li = 0;
  for (let i = 0; i < 15; i++) if (ids[i] == null) ids[i] = left[li++];
  slots.forEach(([row, k], i) => {
    const x = fx + row * gap * Math.sqrt(3) / 2 + (rand() - .5) * 0.0003;
    const z = (k - row / 2) * gap + (rand() - .5) * 0.0003;
    balls.push(makeBall(ids[i], x, z));
  });
  return balls;
}

// Colpo di stecca: direzione (angolo), velocità, punto di impatto sulla bianca (a = laterale, b = alto/basso, in [-1,1])
export function strike(ball, ang, speed, a = 0, b = 0) {
  const R = T.R, dx = Math.cos(ang), dz = Math.sin(ang);
  const lim = 0.62; a = Math.max(-1, Math.min(1, a)) * lim; b = Math.max(-1, Math.min(1, b)) * lim;
  // leggera deviazione (squirt) con effetto laterale
  const sq = -a * 0.018, c = Math.cos(sq), s = Math.sin(sq);
  const ex = dx * c - dz * s, ez = dx * s + dz * c;
  ball.vx = ex * speed; ball.vz = ez * speed;
  const k = 5 * speed / (2 * R);
  ball.wx = ez * k * b; ball.wz = -ex * k * b; ball.wy = k * a;
  ball.moving = true;
}

function segHit(b) {
  const R = T.R; let hit = null;
  for (const s of SEGS) {
    const ex = s.bx - s.ax, ez = s.bz - s.az, l2 = ex * ex + ez * ez;
    let t = ((b.x - s.ax) * ex + (b.z - s.az) * ez) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = s.ax + ex * t, pz = s.az + ez * t, dx = b.x - px, dz = b.z - pz, d2 = dx * dx + dz * dz;
    if (d2 < R * R) { const d = Math.sqrt(d2) || 1e-9; if (!hit || d < hit.d) hit = { d, nx: dx / d, nz: dz / d }; }
  }
  return hit;
}

// Un passo di simulazione. events: array dove vengono aggiunti gli eventi (urti, sponde, buche)
export function step(balls, dt, events, time = 0) {
  const R = T.R, { L, W } = T;
  for (const b of balls) {
    if (!b.on || !b.moving) continue;
    // velocità del punto di contatto col panno
    let ux = b.vx + R * b.wz, uz = b.vz - R * b.wx;
    const us = Math.hypot(ux, uz);
    if (us > 0.012) {                                   // strisciamento
      ux /= us; uz /= us; const a = MU_S * G * dt;
      const dv = Math.min(a, us / 3.5);
      b.vx -= dv * ux; b.vz -= dv * uz;
      b.wx += 2.5 * dv * uz / R; b.wz -= 2.5 * dv * ux / R;
    } else {                                            // rotolamento
      const v = Math.hypot(b.vx, b.vz);
      if (v > 0) { const nv = Math.max(0, v - MU_R * G * dt); b.vx *= nv / v; b.vz *= nv / v; }
      b.wx = b.vz / R; b.wz = -b.vx / R;
    }
    if (b.wy) { const d = SPIN_DEC * dt; b.wy = Math.abs(b.wy) <= d ? 0 : b.wy - Math.sign(b.wy) * d; }
    b.x += b.vx * dt; b.z += b.vz * dt;
    if (Math.hypot(b.vx, b.vz) < 0.004 && Math.abs(b.wy) < 0.3 && Math.hypot(b.wx, b.wz) * R < 0.006) {
      b.vx = b.vz = b.wx = b.wz = b.wy = 0; b.moving = false;
    }
  }
  // urti tra palle
  for (let i = 0; i < balls.length; i++) {
    const a = balls[i]; if (!a.on) continue;
    for (let j = i + 1; j < balls.length; j++) {
      const b = balls[j]; if (!b.on || (!a.moving && !b.moving)) continue;
      const dx = b.x - a.x, dz = b.z - a.z, d2 = dx * dx + dz * dz;
      if (d2 >= 4 * R * R) continue;
      const d = Math.sqrt(d2) || 1e-9, nx = dx / d, nz = dz / d;
      const vn = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
      const over = 2 * R - d; a.x -= nx * over / 2; a.z -= nz * over / 2; b.x += nx * over / 2; b.z += nz * over / 2;
      if (vn <= 0) continue;
      const J = (1 + E_BALL) / 2 * vn;
      a.vx -= J * nx; a.vz -= J * nz; b.vx += J * nx; b.vz += J * nz;
      // un filo di "trascinamento" (throw) dovuto all'attrito tra le palle
      const tx = -nz, tz = nx, vt = (a.vx - b.vx) * tx + (a.vz - b.vz) * tz + R * (a.wy + b.wy);
      const th = Math.max(-0.05 * J, Math.min(0.05 * J, vt * 0.08));
      a.vx -= th * tx; a.vz -= th * tz; b.vx += th * tx; b.vz += th * tz;
      a.moving = b.moving = true;
      events.push({ t: 'ball', a: a.id, b: b.id, v: vn, time });
    }
  }
  // sponde e buche
  for (const b of balls) {
    if (!b.on || !b.moving) continue;
    const h = segHit(b);
    if (h) {
      const { nx, nz } = h, vn = b.vx * nx + b.vz * nz;
      b.x += nx * (R - h.d); b.z += nz * (R - h.d);
      if (vn < 0) {
        b.vx -= (1 + E_RAIL) * vn * nx; b.vz -= (1 + E_RAIL) * vn * nz;
        // attrito della sponda: l'effetto laterale cambia l'angolo di uscita
        const tx = -nz, tz = nx;
        const st = b.vx * tx + b.vz * tz + b.wy * R;
        const Jn = (1 + E_RAIL) * -vn;
        const p = Math.max(-MU_RAIL * Jn, Math.min(MU_RAIL * Jn, -st / 3.5));
        b.vx += p * tx; b.vz += p * tz; b.wy += 2.5 * p / R;
        // la sponda colpisce sopra il centro: inverte in parte la rotazione in avanti
        const mx = nz, mz = -nx, k = b.wx * mx + b.wz * mz;
        b.wx += mx * (-1.45 * k); b.wz += mz * (-1.45 * k);
        events.push({ t: 'rail', a: b.id, v: -vn, time });
      }
    }
    if (Math.abs(b.x) > L / 2 + R * 0.55 || Math.abs(b.z) > W / 2 + R * 0.55) {
      let best = 0, bd = 1e9;
      POCKETS.forEach((p, i) => { const d = Math.hypot(p.x - b.x, p.z - b.z); if (d < bd) { bd = d; best = i; } });
      b.on = false; b.moving = false; b.pocket = best;
      events.push({ t: 'pot', a: b.id, pocket: best, v: Math.hypot(b.vx, b.vz), time });
    }
  }
}

export function anyMoving(balls) { return balls.some(b => b.on && b.moving); }

// Simula fino a fermo (per il bot). Restituisce gli eventi.
export function simulate(balls, maxT = 14) {
  const ev = []; let t = 0;
  while (anyMoving(balls) && t < maxT) { step(balls, DT * 2, ev, t); t += DT * 2; }
  return ev;
}

export function clone(balls) { return balls.map(b => ({ ...b })); }

// Mira: dove la bianca tocca per prima una palla o una sponda lungo la direzione ang
export function aimTrace(balls, cue, ang) {
  const R = T.R, dx = Math.cos(ang), dz = Math.sin(ang);
  let best = { t: 4, ball: null };
  for (const b of balls) {
    if (!b.on || b === cue) continue;
    const ox = b.x - cue.x, oz = b.z - cue.z, p = ox * dx + oz * dz;
    if (p <= 0) continue;
    const q = ox * ox + oz * oz - p * p, rr = 4 * R * R;
    if (q > rr) continue;
    const t = p - Math.sqrt(rr - q);
    if (t < best.t) best = { t, ball: b };
  }
  // sponde: campionamento lungo il raggio (abbastanza preciso per la grafica)
  let railT = null;
  const probe = { x: 0, z: 0 };
  for (let t = 0; t < best.t; t += 0.004) {
    probe.x = cue.x + dx * t; probe.z = cue.z + dz * t;
    if (segHit(probe) || Math.abs(probe.x) > T.L / 2 || Math.abs(probe.z) > T.W / 2) { railT = t; break; }
  }
  if (railT != null && railT < best.t) {
    probe.x = cue.x + dx * railT; probe.z = cue.z + dz * railT;
    const h = segHit(probe); let rx = dx, rz = dz;
    if (h) { const vn = dx * h.nx + dz * h.nz; rx = dx - 2 * vn * h.nx; rz = dz - 2 * vn * h.nz; }
    return { gx: probe.x, gz: probe.z, ball: null, rail: { rx, rz } };
  }
  const gx = cue.x + dx * best.t, gz = cue.z + dz * best.t;
  if (!best.ball) return { gx, gz, ball: null };
  const nx = (best.ball.x - gx) / (2 * R), nz = (best.ball.z - gz) / (2 * R);
  const dn = dx * nx + dz * nz;
  return { gx, gz, ball: best.ball, ox: nx, oz: nz, cx: dx - dn * nx, cz: dz - dn * nz, cut: dn };
}

export function freeSpot(balls, x, z, ignore) {
  const R = T.R;
  return Math.abs(x) < T.L / 2 - R && Math.abs(z) < T.W / 2 - R &&
    balls.every(b => !b.on || b === ignore || Math.hypot(b.x - x, b.z - z) > 2 * R + 0.001);
}
