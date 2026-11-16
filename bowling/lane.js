// Corsa della palla sulla pista (modello proprio, preciso e regolabile): strisciamento sull'olio,
// aggancio sul secco (effetto "hook"), canali, piste speciali con dossi, muri mobili, rampe e salti.
export const L = {
  W: 1.0541, half: 0.527, gutter: 0.235, R: 0.1085,
  head: -18.288, pinGap: 0.3048, rowGap: 0.2639,
  deckStart: -17.6, deckEnd: -19.25, oil: 11.6,
};
const G = 9.81;

export function pinSpots() {
  const out = [];
  for (let r = 0; r < 4; r++) for (let k = 0; k <= r; k++) out.push({ n: out.length + 1, x: (k - r / 2) * L.pinGap, z: L.head - r * L.rowGap });
  return out;
}

// ---------- piste speciali ----------
// Ogni pista: height(z) del piano, ostacoli (segmenti fissi o mobili), buchi (zone senza pavimento)
export const SPECIALS = {
  dossi: {
    name: 'Le gobbe', desc: 'Due dossi: troppo piano e la palla torna indietro',
    height: z => { const a = Math.exp(-((z + 6) ** 2) / 1.1) * 0.22, b = Math.exp(-((z + 11.5) ** 2) / 0.9) * 0.36; return a + b; },
    obstacles: () => [],
  },
  muri: {
    name: 'I muri ballerini', desc: 'Due muri si spostano da un lato all\'altro',
    height: () => 0,
    obstacles: t => [
      box(Math.sin(t * 1.1) * 0.36, -7, 0.3, 0.14),
      box(Math.sin(t * 1.4 + 2) * 0.36, -12.5, 0.3, 0.14),
    ],
  },
  stretta: {
    name: 'Il corridoio', desc: 'La pista si stringe: niente canali, ma le sponde ti rimbalzano',
    height: () => 0,
    obstacles: () => [
      seg(-0.53, -3, -0.2, -7), seg(-0.2, -7, -0.2, -11), seg(-0.2, -11, -0.53, -14),
      seg(0.53, -3, 0.2, -7), seg(0.2, -7, 0.2, -11), seg(0.2, -11, 0.53, -14),
    ],
    noGutter: z => z < -3 && z > -14,
  },
  salto: {
    name: 'Il salto', desc: 'Una rampa e un buco: serve velocità per arrivare dall\'altra parte',
    height: z => (z < -6 && z > -8.2) ? (-6 - z) / 2.2 * 0.3 : 0,
    hole: z => z <= -8.2 && z > -10.4,
    obstacles: () => [],
  },
  girandola: {
    name: 'La girandola', desc: 'Una sbarra gira a metà pista',
    height: () => 0,
    obstacles: t => { const a = t * 1.6, c = Math.cos(a) * 0.42, s = Math.sin(a) * 0.42; return [{ ...seg(-c, -9.5 - s, c, -9.5 + s), spin: { cx: 0, cz: -9.5, w: 1.6 } }]; },
  },
};
function seg(ax, az, bx, bz) { return { ax, az, bx, bz }; }
function box(cx, cz, w, d) { return { box: true, cx, cz, w, d }; }
const FLAT = { height: () => 0, obstacles: () => [] };

export function newBall(x, angle, speed, hook = 0, loft = 0) {
  const R = L.R, dx = Math.sin(angle), dz = -Math.cos(angle);
  // rotazione: un po' di rotolamento in avanti + rotazione laterale attorno alla direzione di marcia
  const roll = 0.25 * speed / R, side = hook * 18;
  return {
    x, z: -0.25 - loft * 0.6, y: loft * 0.25, vy: loft * 1.2, vx: dx * speed, vz: dz * speed,
    wx: dz * roll, wz: -dx * roll, wy: 0,
    sx: dx * side, sz: dz * side, // componente laterale (asse lungo la marcia)
    gutter: 0, fell: false, air: loft > 0.05, t: 0, done: false, hits: 0,
  };
}

export function heightAt(spec, z) { return (spec || FLAT).height(z); }

// Un passo: ritorna eventi {t:'wall'|'gutter'|'land'|'fall'}
export function step(b, dt, spec, time, ev) {
  spec = spec || FLAT;
  const R = L.R;
  b.t += dt;
  const h = spec.height(b.z), hole = spec.hole && spec.hole(b.z);
  // in volo
  if (b.air || b.y > h + 0.002 || hole) {
    b.vy -= G * dt; b.y += b.vy * dt;
    b.x += b.vx * dt; b.z += b.vz * dt;
    const h2 = spec.height(b.z), hole2 = spec.hole && spec.hole(b.z);
    if (!hole2 && b.y <= h2 && !b.fell) { if (b.air && b.vy < -0.6) ev.push({ t: 'land', v: -b.vy }); b.y = h2; b.vy = 0; b.air = false; }
    if (b.y < -0.6 && !b.fell) { b.fell = true; ev.push({ t: 'fall' }); }
    if (b.fell) return;
  } else {
    // sul pavimento: pendenza
    const dh = (spec.height(b.z - 0.01) - spec.height(b.z + 0.01)) / 0.02; // dh/d(-z)
    b.vz += G * dh * dt * 5 / 7;
    if (!b.gutter) {
      const oily = -b.z < L.oil ? 1 : 0;
      const mu = oily ? 0.012 : 0.2, mur = 0.006;
      // velocità del punto di contatto (rotazione totale = rotolamento + laterale)
      const wx = b.wx + b.sx, wz = b.wz + b.sz;
      let ux = b.vx + R * wz, uz = b.vz - R * wx; const us = Math.hypot(ux, uz);
      if (us > 0.03) {
        ux /= us; uz /= us; const dv = Math.min(mu * G * dt, us / 3.5);
        b.vx -= dv * ux; b.vz -= dv * uz;
        // l'attrito agisce sulla rotazione: prima consuma la parte laterale
        const dwx = 2.5 * dv * uz / R, dwz = -2.5 * dv * ux / R;
        b.wx += dwx; b.wz += dwz;
      } else {
        b.sx = b.sz = 0; b.wx = b.vz / R; b.wz = -b.vx / R;
      }
      const v = Math.hypot(b.vx, b.vz);
      if (v > 0) { const nv = Math.max(0, v - mur * G * dt); b.vx *= nv / v; b.vz *= nv / v; }
      // la rotazione laterale si riallinea al rotolamento sul secco
      
    }
    b.x += b.vx * dt; b.z += b.vz * dt;
    // segue il terreno; se il terreno scende più in fretta della palla, decolla (rampe, gobbe)
    const nh = spec.height(b.z), vyPrev = b.vy || 0;
    if (nh < b.y + vyPrev * dt - 0.004 && vyPrev > 0.2) { b.air = true; b.y += vyPrev * dt; b.vy = vyPrev; }
    else { b.vy = (nh - b.y) / dt; b.y = nh; }
  }
  // canali
  const noG = spec.noGutter && spec.noGutter(b.z);
  if (!b.gutter && !noG && Math.abs(b.x) > L.half + 0.01 && b.z > L.deckStart) {
    b.gutter = Math.sign(b.x); b.vx = 0; b.sx = b.sz = 0; ev.push({ t: 'gutter' });
  }
  if (b.gutter) { b.x += (b.gutter * (L.half + L.gutter / 2) - b.x) * Math.min(1, dt * 10); }
  // ostacoli
  for (const o of spec.obstacles(time)) {
    if (o.box) {
      const hx = o.w / 2 + R, hz = o.d / 2 + R, dx = b.x - o.cx, dz = b.z - o.cz;
      if (Math.abs(dx) < hx && Math.abs(dz) < hz) {
        const px = hx - Math.abs(dx), pz = hz - Math.abs(dz);
        if (pz < px) { b.z = o.cz + Math.sign(dz) * hz; if (b.vz * Math.sign(dz) < 0) { b.vz = -b.vz * 0.55; ev.push({ t: 'wall', v: Math.abs(b.vz) }); } }
        else { b.x = o.cx + Math.sign(dx) * hx; if (b.vx * Math.sign(dx) < 0) { b.vx = -b.vx * 0.55; ev.push({ t: 'wall', v: Math.abs(b.vx) }); } }
        b.sx = b.sz = 0;
      }
    } else {
      const ex = o.bx - o.ax, ez = o.bz - o.az, l2 = ex * ex + ez * ez;
      let t = ((b.x - o.ax) * ex + (b.z - o.az) * ez) / l2; t = Math.max(0, Math.min(1, t));
      const px = o.ax + ex * t, pz = o.az + ez * t, dx = b.x - px, dz = b.z - pz, d = Math.hypot(dx, dz);
      if (d < R + 0.03 && d > 1e-6) {
        const nx = dx / d, nz = dz / d;
        b.x = px + nx * (R + 0.03); b.z = pz + nz * (R + 0.03);
        // velocità della superficie (girandola)
        let svx = 0, svz = 0;
        if (o.spin) { svx = -o.spin.w * (pz - o.spin.cz); svz = o.spin.w * (px - o.spin.cx); }
        const rvn = (b.vx - svx) * nx + (b.vz - svz) * nz;
        if (rvn < 0) { b.vx -= 1.6 * rvn * nx; b.vz -= 1.6 * rvn * nz; ev.push({ t: 'wall', v: -rvn }); b.sx = b.sz = 0; }
      }
    }
  }
  if (b.z < L.deckStart - 0.15 && !b.done) b.done = true;
  if (b.vz > 0.05 && b.z > -1 && !b.air) { b.back = true; } // tornata indietro
  if (Math.hypot(b.vx, b.vz) < 0.15 && !b.air && b.t > 1) b.stopped = true;
}
