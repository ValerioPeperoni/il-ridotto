// Punteggio del bowling: n frame (l'ultimo ha i tiri bonus come il decimo), strike e spare con bonus.
export function newSheet(n = 10) { return { frames: Array.from({ length: n }, () => []) }; }
const lastIdx = s => s.frames.length - 1;
export function frameDone(s, i) {
  const f = s.frames[i];
  if (i < lastIdx(s)) return f[0] === 10 || f.length === 2;
  if (f.length < 2) return false;
  if (f[0] === 10 || f[0] + f[1] === 10) return f.length === 3;
  return true;
}
export function currentFrame(s) { for (let i = 0; i < s.frames.length; i++) if (!frameDone(s, i)) return i; return s.frames.length; }
export function finished(s) { return currentFrame(s) >= s.frames.length; }
// i birilli vanno rimessi tutti prima del prossimo tiro?
export function freshRack(s, i) {
  const f = s.frames[i];
  if (f.length === 0) return true;
  if (i < lastIdx(s)) return false;
  if (f.length === 1) return f[0] === 10;
  if (f.length === 2) return f[0] === 10 ? f[1] === 10 : f[0] + f[1] === 10;
  return false;
}
export function addRoll(s, n) { const i = currentFrame(s); if (i < s.frames.length) s.frames[i].push(n); return i; }
export function totals(s) {
  const rolls = [], idx = [];
  s.frames.forEach(f => { idx.push(rolls.length); rolls.push(...f); });
  const out = []; let sum = 0;
  for (let i = 0; i < s.frames.length; i++) {
    const f = s.frames[i], r = idx[i];
    if (!frameDone(s, i)) { out.push(null); continue; }
    let v;
    if (i === lastIdx(s)) v = f.reduce((a, b) => a + b, 0);
    else if (f[0] === 10) { if (rolls.length < r + 3) { out.push(null); continue; } v = 10 + rolls[r + 1] + rolls[r + 2]; }
    else if (f[0] + f[1] === 10) { if (rolls.length < r + 3) { out.push(null); continue; } v = 10 + rolls[r + 2]; }
    else v = f[0] + f[1];
    sum += v; out.push(sum);
  }
  return out;
}
export function total(s) {
  // somma provvisoria (anche dei frame non chiusi), per la classifica in corso
  let t = 0; const tt = totals(s); let lastFull = -1;
  tt.forEach((v, i) => { if (v != null) { t = v; lastFull = i; } });
  for (let i = lastFull + 1; i < s.frames.length; i++) t += s.frames[i].reduce((a, b) => a + b, 0);
  return t;
}
export function marks(s, i) {
  const f = s.frames[i], m = [], last = i === lastIdx(s);
  let rackStart = 0; // indice del primo tiro sul rack attuale
  for (let k = 0; k < f.length; k++) {
    const v = f[k], fresh = k === rackStart;
    if (fresh && v === 10) { m.push('X'); rackStart = k + 1; continue; }
    if (!fresh && f[k - 1] + v === 10) { m.push('/'); rackStart = k + 1; continue; }
    m.push(v === 0 ? '-' : String(v));
    if (!fresh) rackStart = k + 1;
    if (!last) continue;
  }
  return m;
}
