// Bot del biliardo: cerca i tiri in buca possibili, li prova con la fisica e sceglie il migliore
// (anche pensando a dove resta la bianca). Il livello decide quanto sbaglia la mira.
import { T, pockets, clone, strike, simulate, freeSpot, makeBall } from './physics.js';
import { legalTargets, judge, groupOf } from './rules.js';

const R = T.R, POCK = pockets();
export const LEVELS = {
  facile: { err: 0.022, powErr: 0.18, think: 6, position: false },
  medio: { err: 0.009, powErr: 0.09, think: 12, position: true },
  campione: { err: 0.0025, powErr: 0.04, think: 22, position: true },
};

function pathClear(balls, x0, z0, x1, z1, skip, rad = 2 * R) {
  const dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz) || 1e-9, ux = dx / l, uz = dz / l;
  for (const b of balls) {
    if (!b.on || skip.includes(b.id)) continue;
    const ox = b.x - x0, oz = b.z - z0, t = ox * ux + oz * uz;
    if (t < 0 || t > l) continue;
    if (Math.abs(ox * uz - oz * ux) < rad - 0.002) return false;
  }
  return true;
}

// Tiri diretti: bianca → palla fantasma → buca
export function candidates(balls, targets) {
  const cue = balls.find(b => b.id === 0), out = [];
  for (const b of balls) {
    if (!b.on || !targets.includes(b.id)) continue;
    POCK.forEach((p, pi) => {
      const [px, pz] = p.aim, ex = px - b.x, ez = pz - b.z, el = Math.hypot(ex, ez);
      const gx = b.x - ex / el * 2 * R, gz = b.z - ez / el * 2 * R;
      const ax = gx - cue.x, az = gz - cue.z, al = Math.hypot(ax, az);
      if (al < 1e-4) return;
      const cut = (ax * ex + az * ez) / (al * el);
      if (cut < 0.2) return;
      // le buche centrali accettano male i tiri troppo angolati
      if (!p.corner && Math.abs(ez / el) < 0.45) return;
      if (!pathClear(balls, cue.x, cue.z, gx, gz, [0, b.id])) return;
      if (!pathClear(balls, b.x, b.z, px, pz, [0, b.id])) return;
      const score = cut * cut / (0.4 + al + 1.3 * el);
      out.push({ id: b.id, pocket: pi, ang: Math.atan2(az, ax), dist: al, el, cut, score });
    });
  }
  return out.sort((a, b) => b.score - a.score);
}

function evalShot(m, balls, shot, lvl) {
  const sim = clone(balls), cue = sim.find(b => b.id === 0);
  strike(cue, shot.ang, shot.speed, shot.a, shot.b);
  const ev = simulate(sim);
  const mm = JSON.parse(JSON.stringify(m));
  const r = judge(mm, sim, ev);
  let v = 0;
  if (r.end) v = mm.winner === m.turn ? 1000 : -1000;
  else if (r.foul) v = -60;
  else if (r.keep) {
    v = 50;
    if (lvl.position) {
      const next = candidates(sim, legalTargets(mm, sim));
      v += next.length ? 25 * Math.min(1, next[0].score * 3) + Math.min(5, next.length) : -15;
    }
  } else {
    // non è andata in buca: almeno non lasciare tiri facili all'avversario
    const opp = candidates(sim, legalTargets(mm, sim, mm.turn));
    v = -(opp.length ? 20 * Math.min(1, opp[0].score * 3) : 0);
  }
  return v;
}

export function chooseShot(m, balls, levelName = 'medio', rand = Math.random) {
  const lvl = LEVELS[levelName] || LEVELS.medio, cue = balls.find(b => b.id === 0);
  if (m.breakShot) return { ang: Math.atan2(rand() * 0.04 - 0.02, 1), speed: 7.6 + rand() * 0.6, a: 0, b: -0.15 };
  const targets = legalTargets(m, balls);
  const cands = candidates(balls, targets).slice(0, lvl.think);
  let best = null;
  for (const c of cands) {
    // velocità: abbastanza per arrivare in buca con margine
    const base = Math.sqrt(2 * 9.81 * 0.05 * (c.dist + c.el / Math.max(0.3, c.cut) + 0.3)) + 0.25;
    for (const k of [0.85, 1.15, 1.5]) for (const spin of [0, 0.5, -0.5]) {
      const shot = { ang: c.ang, speed: Math.min(6.5, base * k), a: 0, b: spin, id: c.id };
      const v = evalShot(m, balls, shot, lvl) + c.score * 5;
      if (!best || v > best.v) best = { ...shot, v };
    }
  }
  if (!best || best.v < 0) {
    // difesa: colpisci una palla legale cercando almeno una sponda
    const legal = balls.filter(b => b.on && targets.includes(b.id));
    for (const b of legal) for (let i = -2; i <= 2; i++) {
      const ang = Math.atan2(b.z - cue.z, b.x - cue.x) + i * 0.012;
      for (const sp of [0.9, 1.6, 2.6]) {
        const shot = { ang, speed: sp, a: 0, b: 0 };
        const v = evalShot(m, balls, shot, lvl);
        if (!best || v > best.v) best = { ...shot, v };
      }
    }
  }
  if (!best) best = { ang: rand() * 6.28, speed: 2, a: 0, b: 0 };
  // errore umano
  const e = lvl.err * (1 + (best.speed > 4 ? 0.6 : 0));
  return { ang: best.ang + (rand() + rand() - 1) * e, speed: best.speed * (1 + (rand() - .5) * lvl.powErr), a: best.a, b: best.b };
}

// Palla in mano: prova posizioni e tiene quella col tiro migliore
export function placeCue(m, balls, kitchen, rand = Math.random) {
  const cue = balls.find(b => b.id === 0), targets = legalTargets(m, balls);
  let best = null;
  for (let i = 0; i < 60; i++) {
    const x = kitchen ? -T.L / 2 + R + rand() * (T.L / 4 - 2 * R) : (rand() - .5) * (T.L - 4 * R);
    const z = (rand() - .5) * (T.W - 4 * R);
    if (!freeSpot(balls, x, z, cue)) continue;
    cue.x = x; cue.z = z;
    const c = candidates(balls, targets)[0];
    const s = c ? c.score * (c.cut > 0.9 ? 1.3 : 1) : 0;
    if (!best || s > best.s) best = { x, z, s };
  }
  if (best) { cue.x = best.x; cue.z = best.z; }
  return cue;
}
