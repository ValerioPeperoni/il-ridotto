// Effetti: esplosioni, fumo, scintille, onda d'urto, raggio di ghiaccio, fulmini, coriandoli, schizzi d'acqua, suoni.
import * as THREE from 'three';

let scene;
const parts = []; // particelle generiche
const live = []; // oggetti con update(dt) → false quando finiscono
export function initFx(s) { scene = s; }

function dotTex(soft) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  if (soft) { gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); }
  else { gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); }
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); return t;
}
const SOFT = dotTex(true), HARD = dotTex(false);
const smokeTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  for (let i = 0; i < 14; i++) { const x = 40 + Math.random() * 48, y = 40 + Math.random() * 48, r = 18 + Math.random() * 26; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }
  return new THREE.CanvasTexture(c);
})();

// particella: sprite con velocità, gravità, crescita e dissolvenza
function spawn(o) {
  const mat = new THREE.SpriteMaterial({ map: o.tex || SOFT, color: o.color, transparent: true, depthWrite: false, blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending, opacity: o.op ?? 1, rotation: Math.random() * 6.28 });
  const s = new THREE.Sprite(mat); s.position.copy(o.pos); s.scale.setScalar(o.size); scene.add(s);
  parts.push({ s, v: o.vel || new THREE.Vector3(), g: o.g ?? 0, life: o.life, t: 0, size: o.size, grow: o.grow ?? 1, op: o.op ?? 1, drag: o.drag ?? 0, spin: (Math.random() - .5) * 2 });
}
const debrisGeo = new THREE.BoxGeometry(0.18, 0.12, 0.14), debrisMat = new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 1 });

export function explosion(pos, r = 5, { shake } = {}) {
  sound('boom');
  shake && shake(0.9);
  // lampo
  const flash = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.2, 1.2), transparent: true, toneMapped: false }));
  flash.position.copy(pos); scene.add(flash);
  const light = new THREE.PointLight(0xffaa55, 120, r * 5, 2); light.position.copy(pos).y += 1.5; scene.add(light);
  let t = 0;
  live.push(dt => { t += dt; const k = t / 0.35; flash.scale.setScalar(r * (0.3 + k * 0.9)); flash.material.opacity = Math.max(0, 1 - k); light.intensity = 120 * Math.max(0, 1 - t / 0.5); if (t > 0.5) { scene.remove(flash, light); flash.geometry.dispose(); flash.material.dispose(); return false; } return true; });
  // palla di fuoco
  for (let i = 0; i < 26; i++) { const d = new THREE.Vector3(Math.random() - .5, Math.random() * 0.9 + 0.1, Math.random() - .5).normalize(); spawn({ pos: pos.clone().addScaledVector(d, 0.4), vel: d.multiplyScalar(4 + Math.random() * 7), color: new THREE.Color().setHSL(0.06 + Math.random() * 0.06, 1, 0.55), size: 1.6 + Math.random() * 1.6, grow: 1.8, life: 0.5 + Math.random() * 0.35, add: true, drag: 3.5 }); }
  // fumo
  for (let i = 0; i < 18; i++) { const d = new THREE.Vector3(Math.random() - .5, Math.random() * 0.8 + 0.3, Math.random() - .5).normalize(); spawn({ pos: pos.clone().addScaledVector(d, 0.8), vel: d.multiplyScalar(2 + Math.random() * 3), color: new THREE.Color(0.25, 0.23, 0.22), tex: smokeTex, size: 2.2 + Math.random() * 1.5, grow: 2.6, life: 1.6 + Math.random() * 1.2, op: 0.75, g: -0.6, drag: 1.2 }); }
  // scintille
  for (let i = 0; i < 30; i++) { const d = new THREE.Vector3(Math.random() - .5, Math.random() * 0.8 + 0.2, Math.random() - .5).normalize(); spawn({ pos: pos.clone(), vel: d.multiplyScalar(10 + Math.random() * 12), color: new THREE.Color(1, 0.8, 0.4), tex: HARD, size: 0.18, grow: 0.3, life: 0.6 + Math.random() * 0.5, add: true, g: 12, drag: 0.6 }); }
  // zolle e sassi
  for (let i = 0; i < 12; i++) {
    const m = new THREE.Mesh(debrisGeo, debrisMat); m.position.copy(pos); m.castShadow = true; scene.add(m);
    const v = new THREE.Vector3(Math.random() - .5, 0.8 + Math.random(), Math.random() - .5).normalize().multiplyScalar(7 + Math.random() * 6), w = new THREE.Vector3(Math.random(), Math.random(), Math.random()).multiplyScalar(12);
    let tt = 0; live.push(dt => { tt += dt; v.y -= 18 * dt; m.position.addScaledVector(v, dt); m.rotation.x += w.x * dt; m.rotation.y += w.y * dt; if (tt > 1.4) { scene.remove(m); return false; } return true; });
  }
  // onda d'urto a terra
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48), new THREE.MeshBasicMaterial({ color: 0xfff0d0, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.copy(pos).y += 0.15; scene.add(ring);
  let rt = 0; live.push(dt => { rt += dt; const k = rt / 0.45; ring.scale.setScalar(1 + k * r * 1.6); ring.material.opacity = Math.max(0, 0.8 * (1 - k)); if (k >= 1) { scene.remove(ring); ring.geometry.dispose(); return false; } return true; });
  // bruciatura sul terreno
  const scorch = new THREE.Mesh(new THREE.CircleGeometry(r * 0.45, 24), new THREE.MeshBasicMaterial({ color: 0x1a1410, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  scorch.rotation.x = -Math.PI / 2; scorch.position.copy(pos).y += 0.06; scene.add(scorch);
  let st = 0; live.push(dt => { st += dt; if (st > 8) { scorch.material.opacity -= dt * 0.5; if (scorch.material.opacity <= 0) { scene.remove(scorch); return false; } } return true; });
}
export function splash(pos) {
  sound('splash');
  for (let i = 0; i < 28; i++) { const a = Math.random() * 6.28, sp = 1 + Math.random() * 3; spawn({ pos: pos.clone(), vel: new THREE.Vector3(Math.cos(a) * sp, 4 + Math.random() * 5, Math.sin(a) * sp), color: new THREE.Color(0.8, 0.93, 1), tex: HARD, size: 0.25, grow: 0.6, life: 0.9, g: 14, op: 0.9 }); }
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.55, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.copy(pos).y = 0.05; scene.add(ring);
  let t = 0; live.push(dt => { t += dt; ring.scale.setScalar(1 + t * 5); ring.material.opacity = Math.max(0, 0.8 - t * 0.8); if (t > 1) { scene.remove(ring); return false; } return true; });
}
export function puff(pos, color = new THREE.Color(0.85, 0.8, 0.7), n = 8, size = 0.6) {
  for (let i = 0; i < n; i++) { const d = new THREE.Vector3(Math.random() - .5, Math.random() * 0.6, Math.random() - .5); spawn({ pos: pos.clone(), vel: d.multiplyScalar(3), color, tex: smokeTex, size, grow: 2, life: 0.7, op: 0.7, drag: 2 }); }
}
export function sparkle(pos, color, n = 14) {
  for (let i = 0; i < n; i++) { const d = new THREE.Vector3(Math.random() - .5, Math.random() * 0.8 + 0.2, Math.random() - .5).normalize(); spawn({ pos: pos.clone(), vel: d.multiplyScalar(3 + Math.random() * 4), color, tex: HARD, size: 0.3, grow: 0.2, life: 0.8, add: true, g: 6, drag: 1 }); }
}
export function confetti(pos) {
  const cols = [0xff5c9a, 0xffcf3a, 0x3d7bff, 0x2ec27e, 0x9a5cff, 0xffffff];
  for (let i = 0; i < 70; i++) { const d = new THREE.Vector3(Math.random() - .5, 1.2 + Math.random(), Math.random() - .5).normalize(); spawn({ pos: pos.clone(), vel: d.multiplyScalar(6 + Math.random() * 6), color: new THREE.Color(cols[i % 6]), tex: HARD, size: 0.22, grow: 1, life: 2.2, g: 7, drag: 1.4 }); }
}
// scia (per razzi e palle col super tiro)
export function trail(pos, color, size = 0.5, life = 0.5, smoke = false) {
  spawn({ pos: pos.clone(), color, tex: smoke ? smokeTex : SOFT, size, grow: smoke ? 2.5 : 0.2, life, add: !smoke, op: smoke ? 0.5 : 0.9, vel: new THREE.Vector3((Math.random() - .5) * .3, smoke ? 0.4 : 0, (Math.random() - .5) * .3) });
}
export function beam(a, b, color = new THREE.Color(0.6, 1.4, 2.2)) {
  sound('zap');
  const dir = b.clone().sub(a), len = dir.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, len, 10, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending }));
  m.position.copy(a).addScaledVector(dir, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()); scene.add(m);
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, len, 6, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 3, 3), toneMapped: false })); core.position.copy(m.position); core.quaternion.copy(m.quaternion); scene.add(core);
  let t = 0; live.push(dt => { t += dt; m.material.opacity = Math.max(0, 1 - t / 0.5); m.scale.x = m.scale.z = 1 + Math.sin(t * 60) * 0.3; if (t > 0.5) { scene.remove(m, core); return false; } return true; });
  for (let i = 0; i < 16; i++) sparkle(a.clone().lerp(b, Math.random()), color, 1);
}
export function lightning(pos) {
  sound('thunder');
  const pts = []; let x = pos.x + (Math.random() - .5) * 4, z = pos.z + (Math.random() - .5) * 4;
  for (let y = 40; y > pos.y; y -= 2.5) { pts.push(new THREE.Vector3(x, y, z)); x += (Math.random() - .5) * 2.2; z += (Math.random() - .5) * 2.2; x += (pos.x - x) * 0.15; z += (pos.z - z) * 0.15; }
  pts.push(pos.clone());
  const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0), 60, 0.12, 5);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2.6, 3.4), toneMapped: false, transparent: true })); scene.add(m);
  const l = new THREE.PointLight(0xcfe0ff, 200, 30, 1.5); l.position.copy(pos).y += 3; scene.add(l);
  let t = 0; live.push(dt => { t += dt; m.visible = Math.floor(t * 30) % 3 !== 2; m.material.opacity = Math.max(0, 1 - t / 0.6); l.intensity = 200 * Math.max(0, 1 - t / 0.4); if (t > 0.6) { scene.remove(m, l); geo.dispose(); return false; } return true; });
  sparkle(pos, new THREE.Color(1.5, 1.6, 2.5), 20);
}
export function updateFx(dt, camera) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.t += dt; const k = p.t / p.life;
    if (k >= 1) { scene.remove(p.s); p.s.material.dispose(); parts.splice(i, 1); continue; }
    p.v.y -= p.g * dt; if (p.drag) p.v.multiplyScalar(Math.max(0, 1 - p.drag * dt));
    p.s.position.addScaledVector(p.v, dt);
    p.s.scale.setScalar(p.size * (1 + (p.grow - 1) * k));
    p.s.material.opacity = p.op * (1 - k * k); p.s.material.rotation += p.spin * dt;
  }
  for (let i = live.length - 1; i >= 0; i--) if (!live[i](dt)) live.splice(i, 1);
}

// ---------- suoni sintetizzati ----------
let AC, master, noise;
export function audio() {
  if (AC) return AC;
  try { AC = new (window.AudioContext || window.webkitAudioContext)(); master = AC.createGain(); master.gain.value = 0.7; master.connect(AC.destination); noise = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate); const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } catch (e) { AC = null; }
  return AC;
}
export function sound(type, v = 1) {
  const c = AC; if (!c) return; const t = c.currentTime;
  const tone = (f, dur, vol, at = 0, typ = 'sine', slide = 1) => { const o = c.createOscillator(), g = c.createGain(); o.type = typ; o.frequency.setValueAtTime(f, t + at); if (slide !== 1) o.frequency.exponentialRampToValueAtTime(f * slide, t + at + dur); g.gain.setValueAtTime(vol, t + at); g.gain.exponentialRampToValueAtTime(1e-4, t + at + dur); o.connect(g); g.connect(master); o.start(t + at); o.stop(t + at + dur + .02); };
  const nz = (dur, f, q, vol, at = 0, typ = 'bandpass') => { const s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain(); s.buffer = noise; fl.type = typ; fl.frequency.value = f; fl.Q.value = q; g.gain.setValueAtTime(vol, t + at); g.gain.exponentialRampToValueAtTime(1e-4, t + at + dur); s.connect(fl); fl.connect(g); g.connect(master); s.start(t + at, Math.random()); s.stop(t + at + dur + .02); };
  if (type === 'boom') { nz(1.2, 120, 0.7, 0.9, 0, 'lowpass'); tone(60, 0.8, 0.6, 0, 'sine', 0.5); nz(0.4, 900, 0.6, 0.3); }
  else if (type === 'hit') { tone(1400 * v, 0.06, 0.25, 0, 'triangle'); nz(0.05, 3000, 2, 0.25 * v); }
  else if (type === 'putt') { tone(900, 0.05, 0.18, 0, 'triangle'); }
  else if (type === 'swish') { nz(0.25, 1500, 1, 0.25 * v); }
  else if (type === 'whack') { tone(220, 0.15, 0.35, 0, 'square', 0.5); nz(0.12, 600, 1, 0.4); }
  else if (type === 'cup') { tone(700, 0.08, 0.3, 0, 'triangle'); tone(500, 0.12, 0.25, 0.08, 'triangle'); [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.3, 0.14, 0.25 + i * 0.09, 'triangle')); }
  else if (type === 'splash') { nz(0.6, 700, 0.5, 0.4); nz(0.3, 2500, 1, 0.15, 0.05); }
  else if (type === 'zap') { tone(1800, 0.4, 0.15, 0, 'sawtooth', 0.3); nz(0.4, 4000, 2, 0.15); }
  else if (type === 'thunder') { nz(1.6, 200, 0.5, 0.8, 0, 'lowpass'); nz(0.2, 3000, 1, 0.4); }
  else if (type === 'item') { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.12, 0.12, i * 0.05, 'square')); }
  else if (type === 'launch') { nz(0.8, 1200, 0.4, 0.35); tone(300, 0.6, 0.15, 0, 'sawtooth', 2); }
  else if (type === 'freeze') { [1500, 1900, 2400].forEach((f, i) => tone(f, 0.3, 0.1, i * 0.05, 'sine')); }
  else if (type === 'bounce') { tone(500 * v, 0.04, 0.12, 0, 'sine'); }
  else if (type === 'tick') { tone(1000, 0.03, 0.08, 0, 'square'); }
  else if (type === 'fanfare') { [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone(f, 0.35, 0.15, i * 0.14, 'triangle')); }
}
