// Effetti sonori sintetizzati (nessun file audio).
let ctx = null, master = null, muted = false, noiseBuf = null;
function ac() {
  if (ctx) return ctx;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = .5; master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) { ctx = null; }
  return ctx;
}
function tone(f, dur, { type = 'sine', vol = .2, at = 0, slide = 0 } = {}) {
  const c = ac(); if (!c || muted) return;
  const t = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f + slide), t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .008); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .05);
}
function noise(dur, freq, q, { vol = .25, at = 0, type = 'bandpass' } = {}) {
  const c = ac(); if (!c || muted) return;
  const t = c.currentTime + at, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = noiseBuf; s.loop = true; f.type = type; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random() * .5); s.stop(t + dur + .02);
}
export const SFX = {
  unlock() { const c = ac(); if (c && c.state === 'suspended') c.resume(); },
  mute(v) { muted = v; }, get muted() { return muted; },
  card() { noise(.09, 2600 + Math.random() * 900, 1.2, { vol: .22 }); },
  flip() { noise(.06, 3800, 2, { vol: .16 }); },
  chip() { for (let i = 0; i < 3; i++) tone(2300 + Math.random() * 1700, .05, { type: 'triangle', vol: .09, at: i * .035 }); noise(.03, 5200, 3, { vol: .08 }); },
  turn() { tone(880, .22, { vol: .12 }); tone(1320, .3, { vol: .08, at: .09 }); },
  win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, .28, { type: 'triangle', vol: .13, at: i * .08 })); },
  lose() { tone(196, .4, { type: 'sawtooth', vol: .08, slide: -70 }); },
  bust() { tone(150, .35, { type: 'square', vol: .07, slide: -80 }); noise(.2, 300, 1, { vol: .12 }); },
  blackjack() { [659, 784, 988, 1319, 1568].forEach((f, i) => tone(f, .32, { type: 'triangle', vol: .13, at: i * .07 })); },
  devil() { tone(55, 2.2, { type: 'sawtooth', vol: .16 }); tone(77.8, 2.2, { type: 'sawtooth', vol: .12 }); noise(1.6, 180, .7, { vol: .18, type: 'lowpass' }); },
  gong() { [98, 147.5, 196.4, 263, 331.7].forEach((f, i) => tone(f, 2.4 - i * .3, { vol: .16 - i * .02 })); noise(.3, 900, .8, { vol: .1 }); },
  fanfare() { [392, 523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, .34, { type: 'triangle', vol: .15, at: i * .15 })); },
  crack() { noise(.18, 1800, .6, { vol: .3, type: 'highpass' }); tone(110, .3, { type: 'square', vol: .08, slide: -50 }); },
  bang() { noise(.5, 500, .5, { vol: .7, type: 'lowpass' }); noise(.12, 2500, .7, { vol: .5 }); tone(70, .5, { type: 'sawtooth', vol: .3, slide: -40 }); },
  click() { noise(.03, 3000, 4, { vol: .3 }); tone(1800, .03, { type: 'square', vol: .08 }); },
  tick() { tone(1200, .03, { type: 'square', vol: .04 }); },
};
