// Fisica della pallina da ping pong: gravità, attrito dell'aria, effetto Magnus (rotazione),
// rimbalzo sul tavolo con scambio tra rotazione e velocità, rete, pavimento.
export const T = { L: 2.74, W: 1.525, H: 0.76, net: 0.1525, r: 0.02 };
const G = 9.81, KD = 0.11, KM = 0.0011, E_TABLE = 0.9, E_FLOOR = 0.65;

export function mkBall(x, y, z, vx = 0, vy = 0, vz = 0, wx = 0, wy = 0, wz = 0) { return { x, y, z, vx, vy, vz, wx, wy, wz, alive: true }; }
export const copy = b => ({ ...b });

// un passo; ev riceve {t:'table', side:+1 (vicino, z>0) / -1 (lontano), x, z} | {t:'net'} | {t:'floor'}
export function step(b, dt, ev, time = 0) {
  const v = Math.hypot(b.vx, b.vy, b.vz);
  let ax = -KD * v * b.vx, ay = -KD * v * b.vy - G, az = -KD * v * b.vz;
  ax += KM * (b.wy * b.vz - b.wz * b.vy); ay += KM * (b.wz * b.vx - b.wx * b.vz); az += KM * (b.wx * b.vy - b.wy * b.vx);
  b.vx += ax * dt; b.vy += ay * dt; b.vz += az * dt;
  const k = Math.exp(-dt * 0.25); b.wx *= k; b.wy *= k; b.wz *= k;
  const pz = b.z, py = b.y;
  b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
  const { L, W, H, r } = T;
  // rete
  if ((pz > 0) !== (b.z > 0) && Math.abs(b.x) < W / 2 + 0.15) {
    const top = H + T.net;
    if (b.y - r < top - 0.006) { b.z = Math.sign(pz) * (r + 0.001); b.vz *= -0.12; b.vx *= 0.5; b.vy *= 0.4; ev.push({ t: 'net', time }); }
    else if (b.y - r < top + 0.004) { b.vz *= 0.7; b.vy = Math.abs(b.vy) * 0.3 + 0.4; ev.push({ t: 'cord', time }); }
  }
  // tavolo
  if (b.vy < 0 && b.y - r <= H && py - r > H - 0.02 && Math.abs(b.x) <= W / 2 && Math.abs(b.z) <= L / 2) {
    b.y = H + r; b.vy = -b.vy * E_TABLE;
    const ux = b.vx + r * b.wz, uz = b.vz - r * b.wx, u = Math.hypot(ux, uz);
    if (u > 1e-6) {
      const lim = 0.25 * Math.abs(b.vy) * (1 + E_TABLE), d = Math.min(lim, u * 0.4);
      const dvx = -ux / u * d, dvz = -uz / u * d;
      b.vx += dvx; b.vz += dvz; b.wx += -1.5 * dvz / r; b.wz += 1.5 * dvx / r;
    }
    ev.push({ t: 'table', side: b.z > 0 ? 1 : -1, x: b.x, z: b.z, time });
  }
  // bordo del tavolo (spigolo): si ignora, la palla passa
  if (b.y - r < 0 && b.vy < 0) { b.y = r; b.vy = -b.vy * E_FLOOR; b.vx *= 0.8; b.vz *= 0.8; ev.push({ t: 'floor', time }); }
}

// Prevede la traiettoria: array di {t, x, y, z, vy} ed eventi
export function predict(b0, tMax = 3, dt = 1 / 240) {
  const b = copy(b0), pts = [], ev = []; let t = 0;
  while (t < tMax) { step(b, dt, ev, t); t += dt; pts.push({ t, x: b.x, y: b.y, z: b.z, vy: b.vy, vz: b.vz }); if (ev.some(e => e.t === 'floor')) break; }
  return { pts, ev };
}

// Velocità iniziale per atterrare in (tx, tz) sul piano del tavolo dopo circa `flight` secondi, con la rotazione data
export function solve(from, tx, tz, flight, spin) {
  let vx = (tx - from.x) / flight, vz = (tz - from.z) / flight;
  let vy = (T.H + T.r - from.y + 0.5 * G * flight * flight) / flight;
  for (let it = 0; it < 14; it++) {
    const b = mkBall(from.x, from.y, from.z, vx, vy, vz, spin.wx, spin.wy, spin.wz), ev = [];
    let t = 0, land = null, net = false;
    while (t < 3) {
      const py = b.y; step(b, 1 / 240, ev, t); t += 1 / 240;
      const tb = ev.find(e => e.t === 'table'); if (tb) { land = { x: tb.x, z: tb.z, t }; break; }
      if (ev.some(e => e.t === 'net' || e.t === 'cord')) { net = true; break; }
      if (py > T.H + T.r && b.y <= T.H + T.r && b.vy < 0) { land = { x: b.x, z: b.z, t }; break; }
      if (b.y < 0) break;
    }
    if (net) { vy += 0.35; continue; }
    if (!land) { vy -= 0.3; continue; }
    const ex = tx - land.x, ez = tz - land.z, et = flight - land.t;
    if (Math.abs(ex) < 0.005 && Math.abs(ez) < 0.005 && Math.abs(et) < 0.02) break;
    vx += ex / land.t; vz += ez / land.t; vy += 0.45 * G * et;
  }
  return { vx, vy, vz };
}
