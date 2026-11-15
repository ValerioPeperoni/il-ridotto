import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { makeCharacter, updateArms, disposeCharacter, normalizeLook, randomLook, BOTS, CROUPIER, EDIT_TABS, editorHTML, applyEdit } from './chars.js';
import { hostRoom, randomCode } from './net.js';
import { SFX } from './sfx.js';

const $ = s => document.querySelector(s);
const fmt = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 });
const DEG = Math.PI / 180;
const deco = BJ.rng(20251758);
const R = 2.1, TH = 0.8, TZ = -0.9;          // raggio del tavolo, altezza, bordo dritto
const CW = 0.09, CHh = 0.126;                // carta
let SPEED = 1;
const wait = ms => new Promise(r => setTimeout(r, ms * SPEED));

// ---------------------------------------------------------------- renderer
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x060403);
scene.fog = new THREE.FogExp2(0x0a0604, 0.085);
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.05, 40);
const CAM_BASE = new THREE.Vector3(0, 1.33, 1.5);
const CAM_LOOK = new THREE.Vector3(0, 0.74, -0.45);
const camLook = CAM_LOOK.clone();

// ---------------------------------------------------------------- texture helpers
function canvasTex(w, h, draw, opt = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (opt.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  if (opt.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(opt.repeat[0], opt.repeat[1]); }
  return t;
}
function speckle(g, w, h, n, colors, maxA = 0.08) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[i % colors.length].replace('A', (deco() * maxA).toFixed(3));
    g.fillRect(deco() * w, deco() * h, 1 + deco() * 2, 1 + deco() * 2);
  }
}
function roundRect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h);
  g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
}
function drawSuit(g, s, x, y, size) {
  g.save(); g.translate(x, y); g.scale(size / 100, size / 100); g.beginPath();
  if (s === 1) { // cuori
    g.moveTo(0, 45); g.bezierCurveTo(-20, 25, -50, 5, -50, -15); g.bezierCurveTo(-50, -40, -20, -50, 0, -25);
    g.bezierCurveTo(20, -50, 50, -40, 50, -15); g.bezierCurveTo(50, 5, 20, 25, 0, 45); g.fill();
  } else if (s === 2) { // quadri
    g.moveTo(0, -50); g.quadraticCurveTo(14, -16, 38, 0); g.quadraticCurveTo(14, 16, 0, 50); g.quadraticCurveTo(-14, 16, -38, 0); g.quadraticCurveTo(-14, -16, 0, -50); g.fill();
  } else if (s === 0) { // picche
    g.moveTo(0, -50); g.bezierCurveTo(20, -28, 50, -8, 50, 12); g.bezierCurveTo(50, 35, 20, 40, 5, 22);
    g.lineTo(14, 48); g.lineTo(-14, 48); g.lineTo(-5, 22); g.bezierCurveTo(-20, 40, -50, 35, -50, 12); g.bezierCurveTo(-50, -8, -20, -28, 0, -50); g.fill();
  } else { // fiori
    g.arc(0, -22, 21, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(-24, 10, 21, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(24, 10, 21, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(0, 4, 12, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(-5, 10); g.lineTo(-14, 48); g.lineTo(14, 48); g.lineTo(5, 10); g.fill();
  }
  g.restore();
}
function arcText(g, text, cx, cy, r, center, font, spacing = 1.08) {
  g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  const ws = [...text].map(ch => g.measureText(ch).width * spacing);
  let ang = center + ws.reduce((a, b) => a + b, 0) / 2 / r;
  [...text].forEach((ch, i) => {
    ang -= ws[i] / 2 / r;
    g.save(); g.translate(cx + r * Math.cos(ang), cy + r * Math.sin(ang)); g.rotate(ang - Math.PI / 2); g.fillText(ch, 0, 0); g.restore();
    ang -= ws[i] / 2 / r;
  });
}

// ---------------------------------------------------------------- materiali
const M = {};
function buildMaterials() {
  const wood = canvasTex(512, 512, (g, w, h) => {
    const pw = 64;
    for (let x = 0; x < w; x += pw) {
      g.fillStyle = `hsl(${18 + deco() * 8},${40 + deco() * 12}%,${9 + deco() * 6}%)`; g.fillRect(x, 0, pw, h);
      for (let i = 0; i < 46; i++) {
        g.strokeStyle = `rgba(${deco() < .5 ? '0,0,0' : '120,70,40'},${.04 + deco() * .1})`; g.lineWidth = 1 + deco() * 2;
        const xx = x + deco() * pw; g.beginPath(); g.moveTo(xx, 0);
        g.bezierCurveTo(xx + deco() * 10 - 5, h * .3, xx + deco() * 10 - 5, h * .7, xx + deco() * 6 - 3, h); g.stroke();
      }
      g.fillStyle = 'rgba(0,0,0,.65)'; g.fillRect(x + pw - 2, 0, 2, h);
    }
  }, { repeat: [6, 6] });
  M.floor = new THREE.MeshStandardMaterial({ map: wood, roughness: .55, metalness: .05, color: 0x9a7a66 });
  const wood2 = wood.clone(); wood2.needsUpdate = true; wood2.repeat.set(5, 1);
  M.panel = new THREE.MeshStandardMaterial({ map: wood2, roughness: .6, color: 0x8a6a56 });
  M.darkwood = new THREE.MeshStandardMaterial({ color: 0x2a160c, roughness: .45, metalness: .05 });
  M.leather = new THREE.MeshStandardMaterial({ color: 0x2b130b, roughness: .42, metalness: 0 });
  M.gold = new THREE.MeshStandardMaterial({ color: 0xc9a050, roughness: .32, metalness: .9 });
  M.brass = new THREE.MeshStandardMaterial({ color: 0xa8823e, roughness: .38, metalness: .85 });
  const damask = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#16251c'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(196,160,90,.16)'; g.lineWidth = 2;
    for (const [ox, oy] of [[0, 0], [w / 2, h / 2], [w, 0], [0, h], [w, h]]) {
      g.save(); g.translate(ox, oy);
      for (let k = 0; k < 4; k++) { g.rotate(Math.PI / 2); g.beginPath(); g.moveTo(0, 8); g.bezierCurveTo(30, 20, 40, 60, 10, 80); g.bezierCurveTo(30, 60, 18, 30, 0, 30); g.stroke(); }
      g.beginPath(); g.arc(0, 0, 10, 0, Math.PI * 2); g.stroke(); g.restore();
    }
    speckle(g, w, h, 3000, ['rgba(0,0,0,A)', 'rgba(255,230,180,A)'], .05);
  }, { repeat: [7, 2] });
  M.wall = new THREE.MeshStandardMaterial({ map: damask, roughness: .9 });
  const velvet = canvasTex(256, 64, (g, w, h) => {
    for (let x = 0; x < w; x++) { const s = .45 + .55 * Math.pow(Math.abs(Math.sin(x / w * Math.PI * 6)), .7); g.fillStyle = `rgb(${Math.round(110 * s)},${Math.round(14 * s)},${Math.round(20 * s)})`; g.fillRect(x, 0, 1, h); }
  }, { repeat: [2, 1] });
  M.curtain = new THREE.MeshStandardMaterial({ map: velvet, roughness: .95, side: THREE.DoubleSide });
}

// ---------------------------------------------------------------- tavolo
function feltTexture() {
  return canvasTex(2048, 1024, (g, W, H) => {
    const s = W / (2 * R), cx = W / 2, cy = 0;
    const grd = g.createRadialGradient(cx, H * .45, 40, cx, H * .45, W * .62);
    grd.addColorStop(0, '#11583a'); grd.addColorStop(.6, '#0b3f2a'); grd.addColorStop(1, '#052114');
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    speckle(g, W, H, 60000, ['rgba(0,0,0,A)', 'rgba(140,220,170,A)'], .07);
    const gold = 'rgba(219,182,104,.82)';
    g.strokeStyle = gold; g.fillStyle = gold;
    g.lineWidth = 5; g.beginPath(); g.arc(cx, cy, (R - .09) * s, 0, Math.PI); g.stroke();
    g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, (R - .125) * s, 0, Math.PI); g.stroke();
    // decorazioni sul bordo
    for (let a = 8; a <= 172; a += 8) {
      const r = (R - .107) * s, x = cx + r * Math.cos(a * DEG), y = cy + r * Math.sin(a * DEG);
      g.save(); g.translate(x, y); g.rotate(a * DEG); g.beginPath(); g.moveTo(-6, 0); g.lineTo(0, -5); g.lineTo(6, 0); g.lineTo(0, 5); g.closePath(); g.fill(); g.restore();
    }
    arcText(g, 'BLACKJACK PAGA 3 A 2', cx, cy, 1.0 * s, Math.PI / 2, '400 60px "IM Fell English SC", Georgia, serif');
    g.fillStyle = 'rgba(219,182,104,.62)';
    arcText(g, 'IL BANCO CHIEDE FINO A 16 E STA SU 17', cx, cy, .84 * s, Math.PI / 2, '400 30px "IM Fell English SC", Georgia, serif', 1.14);
    g.fillStyle = gold;
    // posti di puntata
    for (const t of []) {
      const r = 1.72 * s, x = cx + r * Math.cos(t * DEG), y = cy + r * Math.sin(t * DEG);
      g.lineWidth = 4; g.beginPath(); g.arc(x, y, .13 * s, 0, Math.PI * 2); g.stroke();
      g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, .145 * s, 0, Math.PI * 2); g.stroke();
      g.save(); g.translate(x, y); g.rotate(t * DEG - Math.PI / 2);
      for (let k = 0; k < 4; k++) { g.rotate(Math.PI / 2); drawSuit(g, k, 0, -.105 * s, 16); }
      g.restore();
    }
    // monogramma
    g.font = '400 40px "IM Fell English SC", Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(219,182,104,.5)';
    g.fillText('·  IL RIDOTTO  ·', cx, .2 * s);
  });
}
function buildTable() {
  const top = new THREE.Mesh(new THREE.CircleGeometry(R, 128, Math.PI, Math.PI).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: feltTexture(), roughness: .96 }));
  top.material.map.repeat.set(1, 2);
  top.position.set(0, TH, TZ); top.receiveShadow = true; scene.add(top);
  // bordo imbottito
  const pts = []; for (let i = 0; i <= 64; i++) { const a = i / 64 * Math.PI; pts.push(new THREE.Vector3((R + .02) * Math.cos(a), 0, (R + .02) * Math.sin(a))); }
  const rail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, .085, 20, false), M.leather);
  rail.position.set(0, TH + .03, TZ); rail.castShadow = rail.receiveShadow = true; scene.add(rail);
  const trim = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => p.clone().multiplyScalar((R - .06) / (R + .02)))), 160, .012, 8, false), M.gold);
  trim.position.set(0, TH + .004, TZ); scene.add(trim);
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(R + .06, R + .02, .16, 96, 1, true, -Math.PI / 2, Math.PI), M.darkwood);
  skirt.position.set(0, TH - .08, TZ); skirt.castShadow = true; skirt.receiveShadow = true; scene.add(skirt);
  const edge = new THREE.Mesh(new THREE.BoxGeometry(2 * R + .3, .19, .1), M.darkwood);
  edge.position.set(0, TH - .06, TZ - .05); edge.castShadow = true; scene.add(edge);
  const edgeTrim = new THREE.Mesh(new THREE.BoxGeometry(2 * R + .3, .018, .02), M.gold); edgeTrim.position.set(0, TH + .03, TZ); scene.add(edgeTrim);
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(.22, .45, TH - .1, 24), M.darkwood); ped.position.set(0, (TH - .1) / 2, TZ + .8); ped.castShadow = true; scene.add(ped);
}

// ---------------------------------------------------------------- stanza
function buildRoom() {
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14).rotateX(-Math.PI / 2), M.floor); floor.receiveShadow = true; scene.add(floor);
  const rug = new THREE.Mesh(new THREE.CircleGeometry(3.3, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({
    map: canvasTex(512, 512, (g, w, h) => {
      g.fillStyle = '#3d0f12'; g.beginPath(); g.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(200,150,80,.5)'; g.lineWidth = 10; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 20, 0, Math.PI * 2); g.stroke();
      g.lineWidth = 3; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 44, 0, Math.PI * 2); g.stroke();
      for (let a = 0; a < 360; a += 15) { g.save(); g.translate(w / 2, h / 2); g.rotate(a * DEG); g.fillStyle = 'rgba(200,150,80,.35)'; g.fillRect(-4, -w / 2 + 60, 8, 30); g.restore(); }
      speckle(g, w, h, 20000, ['rgba(0,0,0,A)', 'rgba(255,200,150,A)'], .1);
    }), roughness: 1,
  }));
  rug.position.set(0, .005, TZ + .9); rug.receiveShadow = true; scene.add(rug);
  const wall = (w, h, x, y, z, ry, mat) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.y = ry; m.receiveShadow = true; scene.add(m); return m; };
  const WZ = -4.0, WX = 4.6, H = 3.3;
  for (const [w, x, z, ry] of [[9.2, 0, WZ, 0], [9, -WX, .5, Math.PI / 2], [9, WX, .5, -Math.PI / 2], [9.2, 0, 5, Math.PI]]) {
    wall(w, H - 1.1, x, 1.1 + (H - 1.1) / 2, z, ry, M.wall);
    wall(w, 1.1, x + (ry === Math.PI / 2 ? .01 : ry === -Math.PI / 2 ? -.01 : 0), .55, z + (ry === 0 ? .01 : ry === Math.PI ? -.01 : 0), ry, M.panel);
  }
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(10, 10).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x120a07, roughness: 1 })); ceil.position.y = H; scene.add(ceil);
  // cornice dei pannelli
  const rail1 = new THREE.Mesh(new THREE.BoxGeometry(9.2, .06, .05), M.darkwood); rail1.position.set(0, 1.12, WZ + .03); scene.add(rail1);
  // quadro: Venezia di notte
  const paint = canvasTex(1024, 640, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#0b1320'); sky.addColorStop(.55, '#2a2a3a'); sky.addColorStop(.62, '#5a4030'); sky.addColorStop(1, '#0b0d12');
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    const moon = g.createRadialGradient(760, 150, 10, 760, 150, 180); moon.addColorStop(0, 'rgba(255,236,190,.95)'); moon.addColorStop(.12, 'rgba(255,230,180,.55)'); moon.addColorStop(1, 'rgba(255,220,160,0)');
    g.fillStyle = moon; g.fillRect(0, 0, w, h);
    g.fillStyle = '#0c0b0d';
    const base = h * .62;
    g.fillRect(0, base - 40, w, 60);
    for (const [x, ww, hh] of [[60, 90, 120], [150, 60, 80], [230, 140, 150], [420, 80, 90], [520, 160, 110], [700, 70, 70], [790, 120, 130], [930, 90, 80]]) g.fillRect(x, base - hh, ww, hh);
    for (const [x, r] of [[300, 70], [600, 55], [850, 45]]) { g.beginPath(); g.arc(x, base - 150 + (70 - r), r, Math.PI, 0); g.fill(); g.fillRect(x - 3, base - 150 + (70 - r) - r - 40, 6, 40); }
    g.fillRect(470, base - 300, 36, 300); g.beginPath(); g.moveTo(462, base - 300); g.lineTo(488, base - 360); g.lineTo(514, base - 300); g.fill();
    for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(255,${190 + deco() * 50},120,${.4 + deco() * .5})`; g.fillRect(40 + deco() * 940, base - 20 - deco() * 120, 4, 6); }
    for (let y = base + 20; y < h; y += 6) { g.fillStyle = `rgba(255,220,170,${.04 + deco() * .1})`; const x = 600 + (deco() - .5) * 300; g.fillRect(x, y, 40 + deco() * 160, 2); }
    g.fillStyle = '#050505'; g.beginPath(); g.moveTo(250, base + 80); g.quadraticCurveTo(380, base + 110, 520, base + 70); g.lineTo(505, base + 95); g.quadraticCurveTo(380, base + 125, 262, base + 100); g.fill();
    speckle(g, w, h, 40000, ['rgba(0,0,0,A)', 'rgba(255,220,170,A)'], .08);
    const vg = g.createRadialGradient(w / 2, h / 2, h * .2, w / 2, h / 2, w * .7); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.65)'); g.fillStyle = vg; g.fillRect(0, 0, w, h);
  });
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.375), new THREE.MeshStandardMaterial({ map: paint, roughness: .7 }));
  pic.position.set(0, 2.25, WZ + .04); scene.add(pic);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(2.42, 1.6, .06), M.gold); frame.position.set(0, 2.25, WZ + .01); scene.add(frame);
  // scaffali con bottiglie
  const glassCols = [0x1d3a20, 0x4a2a0c, 0x3a0d14, 0x223038, 0x5a4210];
  for (const sx of [-1, 1]) {
    for (const y of [1.45, 1.95]) {
      const sh = new THREE.Mesh(new THREE.BoxGeometry(1.6, .05, .3), M.darkwood); sh.position.set(sx * 2.45, y, WZ + .15); sh.castShadow = true; scene.add(sh);
      for (let i = 0; i < 7; i++) {
        if (deco() < .2) continue;
        const hgt = .22 + deco() * .14, rad = .035 + deco() * .025;
        const mat = new THREE.MeshStandardMaterial({ color: glassCols[Math.floor(deco() * glassCols.length)], roughness: .08, metalness: .3, transparent: true, opacity: .88 });
        const b = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, hgt, 14), mat);
        const neck = new THREE.Mesh(new THREE.CylinderGeometry(.012, rad * .7, .1, 10), mat);
        b.position.set(sx * 2.45 - .65 + i * .21, y + .025 + hgt / 2, WZ + .15); neck.position.set(b.position.x, y + .025 + hgt + .05, b.position.z);
        scene.add(b, neck);
      }
    }
  }
  // tende
  for (const sx of [-1, 1]) {
    const c = new THREE.Mesh(new THREE.PlaneGeometry(1.2, H), M.curtain); c.position.set(sx * 4.0, H / 2, WZ + .1); scene.add(c);
    const c2 = new THREE.Mesh(new THREE.PlaneGeometry(2.4, H), M.curtain); c2.position.set(sx * (WX - .02), H / 2, -1.6); c2.rotation.y = -sx * Math.PI / 2; scene.add(c2);
  }
}

// ---------------------------------------------------------------- luci
const flames = [];
function candle(x, y, z, withLight = true, h = .16) {
  const g = new THREE.Group();
  const prof = [[0, 0], [.06, 0], [.065, .015], [.02, .03], [.018, .12], [.045, .14], [.035, .155], [0, .155]].map(([a, b]) => new THREE.Vector2(a, b));
  const stick = new THREE.Mesh(new THREE.LatheGeometry(prof, 20), M.brass); stick.castShadow = true; g.add(stick);
  const wax = new THREE.Mesh(new THREE.CylinderGeometry(.022, .024, h, 14), new THREE.MeshStandardMaterial({ color: 0xeee2c4, roughness: .7, emissive: 0x3a2008, emissiveIntensity: .3 }));
  wax.position.y = .155 + h / 2; g.add(wax);
  const flame = new THREE.Mesh(new THREE.SphereGeometry(.014, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, .72, .32).multiplyScalar(6) }));
  flame.scale.set(1, 2.2, 1); flame.position.y = .155 + h + .025; g.add(flame);
  g.position.set(x, y, z); scene.add(g);
  let light = null;
  if (withLight) { light = new THREE.PointLight(0xff9a48, 1.6, 6, 2); light.position.set(x, y + .155 + h + .06, z); scene.add(light); }
  flames.push({ flame, light, seed: deco() * 100, base: light ? light.intensity : 0 });
}
let spot, lampBulb, dust;
function buildLights() {
  scene.add(new THREE.HemisphereLight(0x3a2a20, 0x070405, .35));
  // lampada sopra il tavolo
  const lx = 0, lz = TZ + .85, ly = 2.35;
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, 3.3 - ly - .1, 6), M.darkwood); cord.position.set(lx, (3.3 + ly + .1) / 2, lz); scene.add(cord);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(.07, .42, .26, 48, 1, true), new THREE.MeshStandardMaterial({ color: 0x173a26, roughness: .35, metalness: .6, side: THREE.DoubleSide }));
  shade.position.set(lx, ly, lz); scene.add(shade);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(.42, .012, 8, 64).rotateX(Math.PI / 2), M.brass); rim.position.set(lx, ly - .13, lz); scene.add(rim);
  lampBulb = new THREE.Mesh(new THREE.SphereGeometry(.06, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, .82, .55).multiplyScalar(8) }));
  lampBulb.position.set(lx, ly - .06, lz); scene.add(lampBulb);
  spot = new THREE.SpotLight(0xffd29a, 26, 9, .8, .55, 2);
  spot.position.set(lx, ly - .14, lz); spot.target.position.set(0, TH, TZ + .75);
  spot.castShadow = true; spot.shadow.mapSize.set(2048, 2048); spot.shadow.camera.near = .3; spot.shadow.camera.far = 5; spot.shadow.bias = -.0004; spot.shadow.normalBias = .02;
  scene.add(spot, spot.target);
  const dfill = new THREE.SpotLight(0xffc890, 16, 6, .45, .8, 2); dfill.position.set(0, 2.2, TZ + .9); dfill.target.position.set(0, 1.35, TZ - .5); scene.add(dfill, dfill.target);
  const fill = new THREE.PointLight(0xffb070, 1.1, 5, 2); fill.position.set(0, 1.7, TZ + 1.3); scene.add(fill);
  for (const sx of [-1, 1]) { const side = new THREE.PointLight(0xffa860, 3.2, 4.5, 2); side.position.set(sx * 2.0, 2.0, .2); scene.add(side); }
  // cono di luce volumetrico
  const coneH = ly - .1 - .05;
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(.38, 1.7, coneH, 48, 1, true), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uH: { value: coneH } },
    vertexShader: `varying float vY; varying vec3 vN; varying vec3 vV; uniform float uH;
      void main(){ vY = position.y / uH + .5; vec4 mv = modelViewMatrix * vec4(position,1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying float vY; varying vec3 vN; varying vec3 vV;
      void main(){ float e = pow(abs(dot(vN, vV)), 2.2); float a = .075 * e * smoothstep(0., .35, vY) * (.35 + .65 * vY); gl_FragColor = vec4(vec3(1., .78, .5) * a, 1.); }`,
  }));
  cone.position.set(lx, ly - .13 - coneH / 2 + .02, lz); scene.add(cone);
  // pulviscolo
  const N = 420, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { const y = TH + .1 + deco() * (ly - TH - .3), rr = (.25 + (1 - (y - TH) / (ly - TH)) * 1.3) * Math.sqrt(deco()), a = deco() * Math.PI * 2; pos.set([lx + rr * Math.cos(a), y, lz + rr * Math.sin(a)], i * 3); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dot = canvasTex(32, 32, (g) => { const r = g.createRadialGradient(16, 16, 0, 16, 16, 16); r.addColorStop(0, 'rgba(255,240,210,1)'); r.addColorStop(1, 'rgba(255,240,210,0)'); g.fillStyle = r; g.fillRect(0, 0, 32, 32); });
  dust = new THREE.Points(geo, new THREE.PointsMaterial({ size: .012, map: dot, transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffd9a8 }));
  scene.add(dust);
  // candele
  candle(-1.25, TH, TZ + .14); candle(1.25, TH, TZ + .14);
  for (const sx of [-1, 1]) { candle(sx * 1.25, 1.55, -3.92, true, .2); const br = new THREE.Mesh(new THREE.BoxGeometry(.18, .04, .14), M.brass); br.position.set(sx * 1.25, 1.53, -3.93); scene.add(br); }
  candle(-2.0, 1.02, -3.75, false, .12);
}

// ---------------------------------------------------------------- carte
const faceCache = new Map();
const cardGeoF = new THREE.PlaneGeometry(CW, CHh).rotateX(-Math.PI / 2);
const cardGeoB = new THREE.PlaneGeometry(CW, CHh).rotateX(Math.PI / 2);
const PIPS = {
  2: [[.5, .12], [.5, .88]], 3: [[.5, .12], [.5, .5], [.5, .88]], 4: [[.27, .12], [.73, .12], [.27, .88], [.73, .88]],
  5: [[.27, .12], [.73, .12], [.27, .88], [.73, .88], [.5, .5]], 6: [[.27, .12], [.73, .12], [.27, .5], [.73, .5], [.27, .88], [.73, .88]],
  7: [[.27, .12], [.73, .12], [.27, .5], [.73, .5], [.27, .88], [.73, .88], [.5, .31]],
  8: [[.27, .12], [.73, .12], [.27, .5], [.73, .5], [.27, .88], [.73, .88], [.5, .31], [.5, .69]],
  9: [[.27, .12], [.73, .12], [.27, .37], [.73, .37], [.27, .63], [.73, .63], [.27, .88], [.73, .88], [.5, .5]],
  10: [[.27, .12], [.73, .12], [.27, .37], [.73, .37], [.27, .63], [.73, .63], [.27, .88], [.73, .88], [.5, .25], [.5, .75]],
};
function paperBase(g, w, h) {
  roundRect(g, 2, 2, w - 4, h - 4, 22); g.save(); g.clip();
  const pg = g.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, h * .7); pg.addColorStop(0, '#f6edd6'); pg.addColorStop(1, '#dccaa2');
  g.fillStyle = pg; g.fillRect(0, 0, w, h);
  speckle(g, w, h, 5000, ['rgba(90,60,30,A)', 'rgba(255,255,255,A)'], .12);
  g.restore();
}
function faceTex(c) {
  if (faceCache.has(c)) return faceCache.get(c);
  const t = canvasTex(320, 448, (g, w, h) => {
    paperBase(g, w, h);
    const rank = BJ.RANKS[BJ.rankOf(c)], s = BJ.suitOf(c), red = s === 1 || s === 2;
    const ink = red ? '#a3201c' : '#1d140e';
    g.strokeStyle = 'rgba(110,40,30,.55)'; g.lineWidth = 2; roundRect(g, 14, 14, w - 28, h - 28, 14); g.stroke();
    g.fillStyle = ink;
    const corner = () => {
      g.font = '700 62px "Cormorant Garamond", Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      g.fillText(rank, 44, 72); drawSuit(g, s, 44, 104, 40);
    };
    corner(); g.save(); g.translate(w, h); g.rotate(Math.PI); corner(); g.restore();
    const ix = 78, iy = 54, iw = w - 156, ih = h - 108;
    if (PIPS[+rank]) {
      for (const [px, py] of PIPS[+rank]) { g.save(); g.translate(ix + px * iw, iy + py * ih); if (py > .5) g.rotate(Math.PI); drawSuit(g, s, 0, 0, 62); g.restore(); }
    } else if (rank === 'A') {
      g.strokeStyle = ink; g.lineWidth = 2; g.globalAlpha = .5;
      g.beginPath(); g.ellipse(w / 2, h / 2, 92, 120, 0, 0, Math.PI * 2); g.stroke();
      for (let a = 0; a < 360; a += 30) { g.save(); g.translate(w / 2, h / 2); g.rotate(a * DEG); g.beginPath(); g.moveTo(0, -132); g.quadraticCurveTo(12, -142, 0, -152); g.stroke(); g.restore(); }
      g.globalAlpha = 1; drawSuit(g, s, w / 2, h / 2, 150);
    } else {
      g.fillStyle = red ? 'rgba(163,32,28,.09)' : 'rgba(29,20,14,.08)'; g.fillRect(ix, iy + 10, iw, ih - 20);
      g.strokeStyle = ink; g.lineWidth = 2.5; g.strokeRect(ix, iy + 10, iw, ih - 20);
      g.fillStyle = '#c9a050'; // corona
      g.beginPath(); g.moveTo(w / 2 - 46, 190); g.lineTo(w / 2 - 46, 150); g.lineTo(w / 2 - 23, 172); g.lineTo(w / 2, 140); g.lineTo(w / 2 + 23, 172); g.lineTo(w / 2 + 46, 150); g.lineTo(w / 2 + 46, 190); g.closePath(); g.fill();
      g.strokeStyle = '#6b4a20'; g.lineWidth = 2; g.stroke();
      g.fillStyle = ink; g.font = '700 150px "Cormorant Garamond", Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(rank, w / 2, 280);
      drawSuit(g, s, w / 2 - 70, 370, 34); drawSuit(g, s, w / 2 + 70, 370, 34);
    }
  });
  faceCache.set(c, t); return t;
}
let backTex;
function makeBackTex() {
  backTex = canvasTex(320, 448, (g, w, h) => {
    roundRect(g, 2, 2, w - 4, h - 4, 22); g.save(); g.clip();
    g.fillStyle = '#efe3c6'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#6c1519'; roundRect(g, 16, 16, w - 32, h - 32, 12); g.fill();
    g.save(); roundRect(g, 16, 16, w - 32, h - 32, 12); g.clip();
    g.strokeStyle = 'rgba(214,176,98,.6)'; g.lineWidth = 2;
    for (let k = -h; k < w + h; k += 22) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + h, h); g.stroke(); g.beginPath(); g.moveTo(k, h); g.lineTo(k + h, 0); g.stroke(); }
    g.restore();
    g.fillStyle = '#6c1519'; g.beginPath(); g.ellipse(w / 2, h / 2, 70, 92, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#d6b062'; g.lineWidth = 4; g.stroke(); g.lineWidth = 1.5; g.beginPath(); g.ellipse(w / 2, h / 2, 60, 82, 0, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#d6b062'; g.font = '400 86px "IM Fell English SC", Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('R', w / 2, h / 2 + 4);
    speckle(g, w, h, 3000, ['rgba(0,0,0,A)', 'rgba(255,230,180,A)'], .1);
    g.restore();
  });
}
const backMat = () => new THREE.MeshStandardMaterial({ map: backTex, color: 0xd8d0c0, roughness: .6, alphaTest: .5 });
function makeCard(c) {
  const grp = new THREE.Group();
  const f = new THREE.Mesh(cardGeoF, new THREE.MeshStandardMaterial({ map: faceTex(c), color: 0xcfc6b4, roughness: .75, alphaTest: .5 }));
  const b = new THREE.Mesh(cardGeoB, backMat());
  f.castShadow = b.castShadow = true; f.receiveShadow = true; b.position.y = -.0004;
  grp.add(f, b); grp.userData.c = c; scene.add(grp); return grp;
}

// ---------------------------------------------------------------- fiches
const CHIP_R = .024, CHIP_H = .0075;
const DENOMS = [
  { v: 500, col: '#4a2260', ring: '#d6b062', txt: '#d6b062' },
  { v: 100, col: '#17110d', ring: '#d6b062', txt: '#d6b062' },
  { v: 50, col: '#1e5a3a', ring: '#efe3c6', txt: '#efe3c6' },
  { v: 25, col: '#8e1b1f', ring: '#efe3c6', txt: '#efe3c6' },
  { v: 10, col: '#e7dcc0', ring: '#2a3f6b', txt: '#2a3f6b' },
  { v: 5, col: '#b0782a', ring: '#efe3c6', txt: '#2a1a10' },
];
const chipGeo = new THREE.CylinderGeometry(CHIP_R, CHIP_R, CHIP_H, 36);
function buildChipMats() {
  for (const d of DENOMS) {
    const top = canvasTex(128, 128, (g, w) => {
      g.fillStyle = d.col; g.beginPath(); g.arc(64, 64, 64, 0, Math.PI * 2); g.fill();
      g.fillStyle = d.ring; for (let k = 0; k < 8; k++) { g.save(); g.translate(64, 64); g.rotate(k * Math.PI / 4); g.fillRect(-7, -64, 14, 18); g.restore(); }
      g.strokeStyle = d.ring; g.lineWidth = 3; g.setLineDash([6, 5]); g.beginPath(); g.arc(64, 64, 38, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
      g.fillStyle = d.txt; g.font = '700 38px "Cormorant Garamond", Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(d.v), 64, 66);
    });
    const side = canvasTex(256, 16, (g, w, h) => { g.fillStyle = d.col; g.fillRect(0, 0, w, h); g.fillStyle = d.ring; for (let k = 0; k < 8; k++) g.fillRect(k * 32 + 4, 0, 14, h); });
    d.mats = [new THREE.MeshStandardMaterial({ map: side, roughness: .45 }), new THREE.MeshStandardMaterial({ map: top, roughness: .4 }), new THREE.MeshStandardMaterial({ map: top, roughness: .4 })];
  }
}
function makeStack(amount) {
  const g = new THREE.Group(); let left = amount, i = 0;
  for (const d of DENOMS) {
    while (left >= d.v - 1e-9 && i < 40) {
      const m = new THREE.Mesh(chipGeo, d.mats); m.position.y = CHIP_H / 2 + i * CHIP_H; m.rotation.y = deco() * 6;
      m.position.x = (deco() - .5) * .002; m.position.z = (deco() - .5) * .002; m.castShadow = true; m.receiveShadow = true;
      g.add(m); left -= d.v; i++;
    }
  }
  g.userData.amount = amount; scene.add(g); return g;
}
function buildRack() {
  const tray = new THREE.Mesh(new THREE.BoxGeometry(.62, .03, .16), M.darkwood); tray.position.set(0, TH + .015, TZ + .14); tray.castShadow = true; scene.add(tray);
  const order = [100, 100, 50, 50, 25, 25, 10, 10];
  order.forEach((v, k) => {
    const d = DENOMS.find(x => x.v === v);
    for (let j = 0; j < 22; j++) {
      const m = new THREE.Mesh(chipGeo, d.mats); m.rotation.x = Math.PI / 2;
      m.position.set(-.27 + k * .077, TH + .03 + CHIP_R * .9, TZ + .07 + j * CHIP_H * 1.0);
      m.castShadow = true; scene.add(m);
    }
  });
}

// ---------------------------------------------------------------- sabot e scarti
let shoeBlock, discard, discardCount = 0;
const SHOE_MOUTH = new THREE.Vector3(.86, TH + .06, TZ + .36);
const DISCARD_POS = new THREE.Vector3(-.86, TH, TZ + .3);
function buildShoe() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(.16, .1, .3), M.darkwood); body.position.y = .05; body.castShadow = true; g.add(body);
  const lip = new THREE.Mesh(new THREE.BoxGeometry(.17, .012, .04), M.brass); lip.position.set(0, .1, .14); g.add(lip);
  shoeBlock = new THREE.Mesh(new THREE.BoxGeometry(CW + .004, .006, .26), [M.darkwood, M.darkwood, new THREE.MeshStandardMaterial({ map: backTex, roughness: .5 }), M.darkwood, M.darkwood, M.darkwood]);
  shoeBlock.position.set(0, .104, -.01); g.add(shoeBlock);
  g.position.set(.86, TH, TZ + .2); g.rotation.y = -12 * DEG; scene.add(g);
  const tray = new THREE.Mesh(new THREE.BoxGeometry(.13, .02, .17), M.darkwood); tray.position.set(DISCARD_POS.x, TH + .01, DISCARD_POS.z); tray.rotation.y = 12 * DEG; scene.add(tray);
  discard = new THREE.Mesh(new THREE.BoxGeometry(CW, 1, CHh), [new THREE.MeshStandardMaterial({ color: 0xe8dcc0 }), new THREE.MeshStandardMaterial({ color: 0xe8dcc0 }), new THREE.MeshStandardMaterial({ map: backTex, roughness: .5 }), new THREE.MeshStandardMaterial({ color: 0xe8dcc0 }), new THREE.MeshStandardMaterial({ color: 0xe8dcc0 }), new THREE.MeshStandardMaterial({ color: 0xe8dcc0 })]);
  discard.position.set(DISCARD_POS.x, TH + .02, DISCARD_POS.z); discard.rotation.y = 12 * DEG; discard.visible = false; discard.castShadow = true; scene.add(discard);
}
function updateShoeVisual() {
  const frac = SHOE.frac();
  shoeBlock.scale.z = Math.max(.05, frac); shoeBlock.position.z = -.01 - (1 - frac) * .13;
  discard.visible = discardCount > 0; discard.scale.y = Math.max(.001, discardCount * .00045);
  discard.position.y = TH + .02 + discard.scale.y / 2;
}

// ---------------------------------------------------------------- tween
const tweens = [];
const ease = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
function tween(ms, fn) {
  return new Promise(res => tweens.push({ t0: performance.now(), dur: Math.max(1, ms * SPEED), fn, res }));
}
function runTweens(now) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i], k = Math.min(1, (now - tw.t0) / tw.dur);
    tw.fn(ease(k), k);
    if (k >= 1) { tweens.splice(i, 1); tw.res(); }
  }
}
function flyTo(obj, to, ms, { lift = .12, yaw = null, flip = null } = {}) {
  const from = obj.position.clone(), y0 = obj.rotation.y, z0 = obj.rotation.z;
  return tween(ms, (e) => {
    obj.position.lerpVectors(from, to, e); obj.position.y += Math.sin(e * Math.PI) * lift;
    if (yaw !== null) obj.rotation.y = y0 + (yaw - y0) * e;
    if (flip !== null) obj.rotation.z = z0 + (flip - z0) * Math.min(1, Math.max(0, (e - .35) / .65));
  });
}

// ---------------------------------------------------------------- etichette HTML
const labelBox = $('#labels');
const labels = new Set();
function makeLabel(cls, html, getPos) {
  const el = document.createElement('div'); el.className = cls; el.innerHTML = html; labelBox.appendChild(el);
  const l = { el, getPos }; labels.add(l); return l;
}
function dropLabel(l) { if (!l) return; l.el.remove(); labels.delete(l); }
const projV = new THREE.Vector3();
function updateLabels() {
  for (const l of labels) {
    const gp = l.getPos(); if (!gp) { l.el.style.display = 'none'; continue; }
    projV.copy(gp).project(camera);
    if (projV.z > 1 || Math.abs(projV.x) > 1.02 || projV.y > .98 || projV.y < -1) { l.el.style.display = 'none'; continue; }
    l.el.style.display = '';
    const lx = (projV.x * .5 + .5) * window.innerWidth, half = l.el.offsetWidth / 2 + 6;
    l.el.style.left = Math.max(half, Math.min(window.innerWidth - half, lx)).toFixed(1) + 'px';
    l.el.style.top = ((-projV.y * .5 + .5) * window.innerHeight).toFixed(1) + 'px';
  }
}

// ================================================================ IL GIOCO
const Q = new URLSearchParams(location.search);
const TEST = { auto: Q.has('auto'), norender: Q.has('norender'), debug: Q.has('debug') };
if (Q.has('fast')) SPEED = .04;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rnd = n => Math.floor(Math.random() * n);
const floor10 = v => Math.floor(v / 10) * 10;
const tmpV = new THREE.Vector3();
const DEVIL = 99;
const NAME = { H: 'Carta', S: 'Stai', D: 'Raddoppia', P: 'Dividi' };
const PHRASES = ['Bravo!', 'Che fortuna…', 'Mamma mia!', 'Ladro!', 'Ci vediamo al banco.', 'Stasera offro io.', 'Non ci credo.', 'Forza, sballa!'];
const FORMAT_TXT = {
  libera: 'Si gioca finché volete. Chi resta al verde riceve un prestito di 1.000 fiches (e la vergogna in classifica).',
  torneo: 'Tutti partono con 1.000 fiches. Alla fine delle mani vince chi ne ha di più. Chi resta al verde è fuori.',
  ultimo: 'Si parte con 500 fiches e due vite. La puntata minima raddoppia ogni 4 mani. Alla seconda bancarotta la maschera si spezza: vince l\'ultimo rimasto.',
};
const BANK_TXT = {
  casa: 'Il banco è del Ridotto: paga e incassa lui, nessuno di voi ci guadagna.',
  turno: 'Uno di voi tiene il banco con le sue fiches per 3 mani, poi passa. Chi fa blackjack reale (asso e figura dello stesso seme) incassa 2 a 1 e si prende il banco.',
};
const RULE_NAMES = { baro: 'Il baro', diavolo: 'Diavolo', segreta: 'Puntata segreta', freebet: 'Free Bet', laterali: 'Laterali', gufata: 'Gufata' };

function loadCfg() {
  const d = { game: 'blackjack', format: 'libera', hands: 20, elim: true, bank: 'casa', hints: true, rules: { baro: false, diavolo: false, segreta: false, freebet: false, laterali: false, gufata: false } };
  try { const s = JSON.parse(localStorage.getItem('ridotto-cfg') || 'null'); if (s) { Object.assign(d, s, { rules: Object.assign(d.rules, s.rules || {}) }); } } catch (e) { /* impostazioni di base */ }
  return d;
}
const CFG = loadCfg();
const saveCfg = () => { try { localStorage.setItem('ridotto-cfg', JSON.stringify(CFG)); } catch (e) { /* non salvato */ } };

const S = {
  phase: 'lobby', players: [], hand: 0, minBet: 10, banker: null, bankLeft: 0, nextBanker: null, bankNet: 0,
  dealer: { cards: [], objs: [], hole: true, tag: null, speech: null }, turn: null, focus: null, cam: { kind: 'home', p: null },
  roundMult: 1, accQ: [], cheated: new Map(), caught: new Set(), accused: new Set(), accOpen: false, firstPerson: false,
  outOrder: [], ended: false, abort: false, gen: 0, devilAt: -1, draws: 0, late: new Map(), status: '', red: 0, gaze: new Map(), stage: '', rank: null,
};
if (TEST.debug) { window.__S = S; window.__CFG = CFG; }

// ---------------------------------------------------------------- sabot
const SHOE = {
  cards: [], pos: 0,
  shuffle() { this.cards = []; for (let d = 0; d < 6; d++) for (let c = 0; c < 52; c++) this.cards.push(c); for (let i = this.cards.length - 1; i > 0; i--) { const j = rnd(i + 1), t = this.cards[i]; this.cards[i] = this.cards[j]; this.cards[j] = t; } this.pos = 0; },
  draw() { if (window.__rig && window.__rig.length) return window.__rig.shift(); if (this.pos >= this.cards.length) this.shuffle(); return this.cards[this.pos++]; },
  frac() { return this.cards.length ? 1 - this.pos / this.cards.length : 1; },
  needsShuffle() { return this.pos >= this.cards.length * .75; },
};
SHOE.shuffle();

// ---------------------------------------------------------------- geometria dei posti
const seatDir = p => new THREE.Vector3(Math.cos(p.a), 0, Math.sin(p.a));
const seatRight = p => new THREE.Vector3(Math.sin(p.a), 0, -Math.cos(p.a));
const tablePt = (r, a) => new THREE.Vector3(r * Math.cos(a), TH, TZ + r * Math.sin(a));
const isMe = p => S.firstPerson && p.kind === 'local';
function handAnchor(p, hi) { const n = p.hands.length; return tablePt(isMe(p) ? 1.5 : 1.38, p.a).addScaledVector(seatRight(p), (hi - (n - 1) / 2) * (n > 3 ? .15 : .17)); }
function cardSpot(p, hi, i) { return handAnchor(p, hi).addScaledVector(seatRight(p), i * .034 - .02).addScaledVector(seatDir(p), -i * .006).setY(TH + .002 + i * .0012); }
function betSpot(p, hi, extra = 0) { const n = Math.max(1, p.hands.length); return tablePt(1.72, p.a).addScaledVector(seatRight(p), (hi - (n - 1) / 2) * .13 + extra * .055).setY(TH + .001); }
const dealerSpot = i => new THREE.Vector3(-.06 + i * .058, TH + .002 + i * .0012, TZ + .44);
const yawOf = p => Math.PI / 2 - p.a;
const RACK = new THREE.Vector3(0, TH + .04, TZ + .14);
const order = () => S.players.slice().sort((x, y) => x.a - y.a);
const alive = () => order().filter(p => p.alive);
const humans = () => S.players.filter(p => p.kind !== 'bot');
const byPid = pid => S.players.find(p => p.pid === pid);

// ---------------------------------------------------------------- oggetti extra: Diavolo, campana, anelli, segnaposto del banco
let devilTexture = null;
function makeDevilCard() {
  if (!devilTexture) devilTexture = canvasTex(320, 448, (g, w, h) => {
    roundRect(g, 2, 2, w - 4, h - 4, 22); g.save(); g.clip();
    const gr = g.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, h * .7); gr.addColorStop(0, '#7a0f0f'); gr.addColorStop(1, '#120303'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#d6b062'; g.lineWidth = 3; roundRect(g, 14, 14, w - 28, h - 28, 14); g.stroke();
    g.fillStyle = '#0a0202'; g.beginPath(); g.ellipse(w / 2, 230, 88, 104, 0, 0, 7); g.fill();
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(w / 2 + s * 50, 150); g.quadraticCurveTo(w / 2 + s * 120, 110, w / 2 + s * 86, 50); g.quadraticCurveTo(w / 2 + s * 84, 110, w / 2 + s * 26, 132); g.fill(); }
    g.fillStyle = '#ffd23f'; for (const s of [-1, 1]) { g.save(); g.translate(w / 2 + s * 36, 212); g.rotate(s * .4); g.beginPath(); g.ellipse(0, 0, 22, 9, 0, 0, 7); g.fill(); g.restore(); }
    g.strokeStyle = '#ffd23f'; g.lineWidth = 4; g.beginPath(); g.moveTo(w / 2 - 40, 280); g.quadraticCurveTo(w / 2, 310, w / 2 + 40, 280); g.stroke();
    g.fillStyle = '#d6b062'; g.font = '400 34px "IM Fell English SC", Georgia, serif'; g.textAlign = 'center'; g.fillText('DIABOLUS', w / 2, 400);
    g.restore();
  });
  const grp = new THREE.Group();
  const f = new THREE.Mesh(cardGeoF, new THREE.MeshStandardMaterial({ map: devilTexture, emissive: 0xff2a10, emissiveMap: devilTexture, emissiveIntensity: 1.6, roughness: .5, alphaTest: .5 }));
  const b = new THREE.Mesh(cardGeoB, backMat()); b.position.y = -.0004; f.castShadow = b.castShadow = true;
  grp.add(f, b); scene.add(grp); return grp;
}
function makeDome() {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.SphereGeometry(.05, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x4d1014, roughness: .35, metalness: .3 }));
  m.scale.y = 1.5; m.castShadow = true; g.add(m);
  const k = new THREE.Mesh(new THREE.SphereGeometry(.009, 10, 8), M.gold); k.position.y = .08; g.add(k);
  const r = new THREE.Mesh(new THREE.TorusGeometry(.05, .004, 6, 28).rotateX(Math.PI / 2), M.gold); r.position.y = .003; g.add(r);
  scene.add(g); return g;
}
const rings = [];
function buildRings() {
  rings.forEach(r => scene.remove(r)); rings.length = 0;
  const mat = new THREE.MeshBasicMaterial({ color: 0xb8954a, transparent: true, opacity: .75 });
  for (const p of S.players) {
    const r = new THREE.Mesh(new THREE.RingGeometry(.118, .128, 48).rotateX(-Math.PI / 2), mat); r.position.copy(tablePt(1.72, p.a)).setY(TH + .0015);
    const r2 = new THREE.Mesh(new THREE.RingGeometry(.134, .137, 48).rotateX(-Math.PI / 2), mat); r2.position.copy(r.position);
    scene.add(r, r2); rings.push(r, r2);
  }
}
let bankMark = null;
function showBankMark(p) {
  if (!bankMark) {
    const top = canvasTex(256, 256, (g, w) => { g.fillStyle = '#c9a050'; g.beginPath(); g.arc(128, 128, 128, 0, 7); g.fill(); g.strokeStyle = '#2a1a10'; g.lineWidth = 6; g.beginPath(); g.arc(128, 128, 108, 0, 7); g.stroke(); g.fillStyle = '#2a1a10'; g.font = '400 58px "IM Fell English SC", Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('BANCO', 128, 132); });
    bankMark = new THREE.Mesh(new THREE.CylinderGeometry(.085, .085, .012, 40), [M.gold, new THREE.MeshStandardMaterial({ map: top, roughness: .35, metalness: .5 }), M.gold]);
    bankMark.castShadow = true; scene.add(bankMark); bankMark.position.copy(RACK);
  }
  bankMark.visible = !!p;
  if (p) { bankMark.rotation.y = yawOf(p) + Math.PI; flyTo(bankMark, tablePt(1.72, p.a).setY(TH + .007), 700, { lift: .15 }); }
}
let myHands = null;
function showMyHands(on) {
  if (!myHands) {
    myHands = new THREE.Group();
    const glove = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: .6 }), sleeve = new THREE.MeshStandardMaterial({ color: 0x1c2a40, roughness: .85 });
    for (const sx of [-1, 1]) {
      const gl = new THREE.Mesh(new THREE.SphereGeometry(.045, 14, 10), glove); gl.scale.set(1, .5, 1.4); gl.position.set(sx * .3, TH + .1, 1.24); gl.rotation.y = sx * .3; gl.castShadow = true;
      const sl = new THREE.Mesh(new THREE.CapsuleGeometry(.055, .5, 4, 10), sleeve); sl.position.set(sx * .36, TH + .02, 1.55); sl.rotation.x = Math.PI / 2 - .25; sl.rotation.z = sx * .25;
      const cuff = new THREE.Mesh(new THREE.TorusGeometry(.055, .018, 8, 18), new THREE.MeshStandardMaterial({ color: 0xf1ead8, roughness: .8 })); cuff.position.set(sx * .32, TH + .08, 1.33); cuff.rotation.x = .3;
      myHands.add(gl, sl, cuff);
    }
    scene.add(myHands);
  }
  myHands.visible = on;
}

// ---------------------------------------------------------------- giocatori e posti
let PID = 0;
function charTop(p) { if (!p.ch) return 2; if (!p.ch.top) { p.ch.group.updateMatrixWorld(true); p.ch.top = new THREE.Box3().setFromObject(p.ch.group).max.y - p.ch.group.position.y; } return p.ch.top; }
function placeChar(p) {
  if (isMe(p)) { if (p.ch) { disposeCharacter(p.ch); p.ch = null; } return; }
  const cracks = S.phase !== 'lobby' && (CFG.game === 'dubito' ? !p.alive : CFG.format === 'ultimo' && p.lives === 1);
  const key = JSON.stringify(p.look) + cracks;
  if (!p.ch || p.chKey !== key) { if (p.ch) disposeCharacter(p.ch); p.ch = makeCharacter(p.look, { cracks }); p.chKey = key; scene.add(p.ch.group); }
  const w = tablePt(2.62, p.a); p.ch.group.position.set(w.x, 0, w.z); p.ch.group.rotation.y = yawOf(p); p.ch.top = 0;
}
function layoutSeats() {
  const P = S.players, hs = humans();
  S.firstPerson = S.phase !== 'lobby' && hs.length === 1 && hs[0].kind === 'local' && P.length <= 5;
  if (S.firstPerson) { const A = [[], [130], [50, 130], [20, 50, 130], [20, 50, 130, 160]][P.length - 1]; let i = 0; for (const p of P) p.a = (p === hs[0] ? 90 : A[i++]) * DEG; }
  else { const A = { 0: [], 1: [90], 2: [62, 118], 3: [45, 90, 135], 4: [30, 70, 110, 150], 5: [22, 56, 90, 124, 158], 6: [15, 45, 75, 105, 135, 165] }[P.length]; P.forEach((p, i) => { p.a = A[i] * DEG; }); }
  P.forEach(placeChar); buildRings(); showMyHands(S.firstPerson); refreshPlates();
}
function addPlayer(kind, name, look, extra = {}) {
  if (S.players.length >= 6) return null;
  const p = Object.assign({ pid: 'p' + (++PID) + Math.random().toString(36).slice(2, 6), kind, name, look: normalizeLook(look), style: 'gut', conn: null, online: true, seen: Date.now(), chips: 1000, lastBet: 20, alive: true, lives: 2, loans: 0, cheatTok: 1, secretTok: 1, hands: [], inRound: false, a: 0, ch: null, chKey: '', plate: null, speech: null, prompt: null, side: null, peek: null, draft: null, startChips: 1000 }, extra);
  p.plate = makeLabel('nameplate', '', () => p.ch ? p.ch.group.localToWorld(tmpV.set(0, charTop(p) + .04, 0)) : null);
  S.players.push(p); layoutSeats(); spotlight(p); renderLobby(); pushState(); return p;
}
function removePlayer(p) {
  const i = S.players.indexOf(p); if (i < 0) return;
  S.players.splice(i, 1); if (p.ch) disposeCharacter(p.ch); dropLabel(p.plate); dropLabel(p.speech);
  if (p.conn) { NET.send(p.conn, { t: 'kicked' }); }
  layoutSeats(); renderLobby(); pushState();
}
function spotlight(p) { S.show = p; S.showUntil = performance.now() / 1000 + 7; }
const cleanName = (s, d) => (String(s || '').replace(/\s+/g, ' ').trim().slice(0, 14)) || d;
function refreshPlates() {
  for (const p of S.players) if (p.plate) {
    p.plate.el.className = 'nameplate' + (p.alive ? '' : ' out');
    p.plate.el.innerHTML = `${S.banker === p ? '<div class="b">BANCO</div>' : ''}<div class="n">${esc(p.name)}</div>` + (S.phase === 'lobby' ? '' : `<div class="f">${!p.alive ? 'fuori' : CFG.game === 'dubito' ? (p.hand || []).length + ' carte · ' + (p.pulls || 0) + '/6' : fmt.format(p.chips) + ' fiches'}</div>`);
  }
}
function say(who, text, small = '', bad = false, ms = 1900) {
  const d = who === 'dealer', ch = d ? dealerCh : who.ch, key = d ? S.dealer : who;
  if (!ch) return;
  if (key.speech) dropLabel(key.speech);
  const top = d ? 2.12 : charTop(who) + .36;
  const l = makeLabel('speech' + (bad ? ' bad' : ''), `${small ? `<small>${esc(small)}</small>` : ''}${esc(text)}`, () => ch.group.localToWorld(tmpV.set(0, top - (d ? .18 : 0), 0)));
  key.speech = l; setTimeout(() => { if (key.speech === l) { dropLabel(l); key.speech = null; } }, ms * Math.max(SPEED, .5));
}
function setStatus(t) { S.status = t; $('#status').textContent = t; pushState(); }

// ---------------------------------------------------------------- rete
let NET = null, CODE = '';
function playUrl() { const u = new URL('play.html', location.href); u.search = ''; u.searchParams.set('r', CODE); if (Q.get('peer')) u.searchParams.set('peer', Q.get('peer')); return u.href; }
function openRoom() {
  try { CODE = sessionStorage.getItem('ridotto-code') || ''; } catch (e) { CODE = ''; }
  if (!/^[A-Z]{4}$/.test(CODE)) CODE = randomCode();
  try { sessionStorage.setItem('ridotto-code', CODE); } catch (e) { /* va bene lo stesso */ }
  const ns = $('#netstate');
  if (typeof Peer === 'undefined') { ns.textContent = 'Collegamento telefoni non disponibile: si gioca su questo schermo.'; ns.className = 'netstate bad'; return; }
  NET = hostRoom(CODE, {
    onOpen() { ns.textContent = 'Sala aperta: i telefoni possono entrare.'; ns.className = 'netstate ok'; },
    onError(type) { ns.textContent = type === 'unavailable-id' ? 'Codice occupato: ricarica la pagina.' : 'Collegamento instabile (' + type + '). Riprovo…'; ns.className = 'netstate bad'; },
    onMsg(id, m) { try { onNet(id, m); } catch (e) { console.error(e); } },
    onClose(id) { const p = S.players.find(x => x.conn === id); S.late.delete(id); if (p) { p.conn = null; p.online = false; renderLobby(); pushState(); } },
  });
  $('#code').textContent = CODE; $('#url').textContent = playUrl().replace(/^https?:\/\//, '');
  const qr = qrcode(0, 'M'); qr.addData(playUrl()); qr.make(); $('#qr').innerHTML = qr.createSvgTag({ cellSize: 6, margin: 1, scalable: true });
}
function onNet(id, m) {
  let p = S.players.find(x => x.conn === id);
  if (m.t === 'ping') { if (p) { p.seen = Date.now(); } NET.send(id, { t: 'pong' }); return; }
  if (m.t === 'hello') {
    const old = typeof m.pid === 'string' && byPid(m.pid);
    if (old && old.kind === 'remote') { if (old.conn && old.conn !== id) NET.drop(old.conn); old.conn = id; old.online = true; old.seen = Date.now(); renderLobby(); pushState(); return; }
    if (S.phase !== 'lobby') { S.late.set(id, m); NET.send(id, { t: 'state', phase: 'busy', code: CODE }); return; }
    if (S.players.length >= 6) { NET.send(id, { t: 'state', phase: 'full', code: CODE }); return; }
    const np = addPlayer('remote', cleanName(m.name, 'Ospite ' + (S.players.length + 1)), m.look, { conn: id });
    if (np) NET.send(id, { t: 'welcome', pid: np.pid });
    return;
  }
  if (!p) return;
  p.seen = Date.now(); p.online = true;
  if (m.t === 'profile') {
    if (S.phase !== 'lobby') return;
    if (m.name !== undefined) p.name = cleanName(m.name, p.name);
    if (m.look) { p.look = normalizeLook(m.look); placeChar(p); spotlight(p); }
    refreshPlates(); renderLobby(); pushState();
  } else if (m.t === 'reply') { if (p.prompt && p.prompt.id === m.id) acceptReply(p, m.v); }
  else if (m.t === 'cheat') tryCheat(p, m.kind);
  else if (m.t === 'accuse') accuse(p, byPid(m.target));
  else if (m.t === 'say') { const i = m.i | 0; if (PHRASES[i] && Date.now() - (p.lastSay || 0) > 1500) { p.lastSay = Date.now(); say(p, PHRASES[i], '', false, 2200); } }
  else if (m.t === 'leave') { if (S.phase === 'lobby') removePlayer(p); }
}
let dirty = false;
function pushState() {
  if (dirty) return; dirty = true;
  setTimeout(() => { dirty = false; if (NET) for (const p of S.players) if (p.kind === 'remote' && p.conn) NET.send(p.conn, snapshot(p)); renderHUD(); }, 0);
}
function totalText(cards, live) {
  if (!cards.length) return '';
  const { total, soft } = BJ.handInfo(cards);
  if (BJ.isNatural(cards)) return 'Blackjack';
  if (live && soft && total < 21) return `${total - 10} / ${total}`;
  return String(total);
}
function snapshot(p) {
  const pr = p.prompt, d = S.dealer;
  return {
    t: 'state', code: CODE, phase: S.phase === 'lobby' ? 'lobby' : S.ended ? 'end' : 'game', stage: S.stage,
    dub: CFG.game === 'dubito' && S.D ? { round: S.D.round, rank: S.D.rank, hand: p.hand || [], pile: S.D.pileN, last: S.D.last ? { name: S.D.last.p.name, n: S.D.last.cards.length } : null, reveal: S.D.reveal, seats: order().map(q => ({ name: q.name, n: (q.hand || []).length, alive: q.alive, pulls: q.pulls || 0, me: q === p })) } : null,
    cfg: { game: CFG.game, format: CFG.format, hands: CFG.hands, bank: CFG.bank, rules: CFG.rules, hints: CFG.hints },
    hand: S.hand, minBet: S.minBet, status: S.status, phrases: PHRASES,
    you: { pid: p.pid, name: p.name, look: p.look, chips: p.chips, alive: p.alive, lives: p.lives, loans: p.loans, banker: S.banker === p, cheatTok: p.cheatTok, secretTok: p.secretTok, inRound: p.inRound, betDone: !!p.betDone && S.stage === 'bet', bet: p.inRound && p.hands[0] ? p.hands.reduce((a, h) => a + h.stake, 0) : 0 },
    players: order().map(q => ({ pid: q.pid, name: q.name, chips: q.chips, alive: q.alive, lives: q.lives, banker: S.banker === q, bot: q.kind === 'bot', online: q.online, inRound: q.inRound })),
    dealer: { cards: d.cards.map((c, i) => i === 1 && d.hole ? -1 : c), total: d.cards.length ? (d.hole ? totalText([d.cards[0]], false) : totalText(d.cards, false)) : '' },
    hands: p.hands.map((h, hi) => ({ cards: h.cards, total: totalText(h.cards, S.focus && S.focus.p === p && S.focus.hi === hi), stake: h.stake, free: h.free, mult: h.mult, res: h.res || '', delta: h.delta, active: !!(S.focus && S.focus.p === p && S.focus.hi === hi) })),
    side: p.side, turn: S.turn === 'dealer' ? 'dealer' : S.turn ? S.turn.pid : null, turnName: S.turn === 'dealer' ? 'il banco' : S.turn ? S.turn.name : '',
    prompt: pr ? Object.assign({ id: pr.id, kind: pr.kind, left: pr.deadline ? Math.max(0, pr.deadline - Date.now()) : 0 }, pr.pub) : null,
    can: { cheat: canCheat(p), accuse: canAccuse(p) }, peek: p.peek, rank: S.rank,
  };
}

// ---------------------------------------------------------------- domande ai giocatori
let PROMPT_ID = 0;
function ask(p, kind, data, pub, ms, fallback) {
  return new Promise(resolve => {
    if (p.kind === 'bot') { botAnswer(p, kind, data).then(resolve); return; }
    if (TEST.auto && p.kind === 'local') { setTimeout(() => resolve(kind === 'act' ? data.best : kind === 'pact' ? Math.random() < .5 : fallback()), 30); return; }
    const limit = isMe(p) ? 0 : (p.kind === 'remote' && !p.online ? Math.min(ms, 3500) : ms);
    const pr = { id: ++PROMPT_ID, kind, data, pub, deadline: limit ? Date.now() + limit : 0, done: false, timer: 0 };
    pr.resolve = v => { if (pr.done) return; pr.done = true; clearTimeout(pr.timer); if (p.prompt === pr) p.prompt = null; pushState(); renderBar(); resolve(v); };
    if (limit) pr.timer = setTimeout(() => pr.resolve(fallback()), limit);
    p.prompt = pr; p.draft = null; p.dsel = null; pushState(); renderBar();
    if (kind === 'act' && p.kind === 'local') SFX.turn();
  });
}
function acceptReply(p, v) {
  const pr = p.prompt; if (!pr) return;
  if (pr.kind === 'act') { if (pr.data.allowed.includes(v)) pr.resolve(v); }
  else if (pr.kind === 'bet') pr.resolve(cleanBet(p, v || {}, pr.data));
  else if (pr.kind === 'pact') pr.resolve(!!v);
  else if (pr.kind === 'dub') {
    if (v && v.call && pr.data.canCall) { pr.resolve({ call: true }); return; }
    const n = pr.data.hand.length, idx = [...new Set((v && Array.isArray(v.play) ? v.play : []).map(x => x | 0).filter(x => x >= 0 && x < n))].slice(0, 3);
    if (idx.length) pr.resolve({ play: idx });
  }
}
function cleanBet(p, v, d) {
  const max = Math.max(10, Math.min(d.max, floor10(p.chips))), min = Math.min(d.min, max);
  const bet = Math.max(min, Math.min(max, floor10(+v.bet || 0)));
  let left = p.chips - bet;
  const side = x => { x = [0, 10, 20, 50].includes(+x) ? +x : 0; if (x > left) x = 0; left -= x; return x; };
  const pp = d.side ? side(v.pp) : 0, t3 = d.side ? side(v.t3) : 0;
  let gufo = null;
  if (d.gufo && v.gufo && d.gufo.some(t => t.pid === v.gufo.pid)) { const amt = side(v.gufo.amt); if (amt) gufo = { pid: v.gufo.pid, amt }; }
  return { bet, pp, t3, gufo, secret: !!(d.secret && v.secret) };
}
function botAnswer(p, kind, d) {
  if (kind === 'bet') return wait(400 + Math.random() * 1400).then(() => {
    let b = { perfect: 20, gut: 30, mimic: 20, nobust: 10 }[p.style] || 20;
    if (p.name === 'Pulcinella') b = [10, 50, 100, 200][rnd(4)];
    if (p.name === 'Colombina' && p.chips > p.startChips) b = 50;
    if (CFG.format === 'torneo' && S.hand > CFG.hands * .7) { const lead = Math.max(...alive().map(x => x.chips)); if (p.chips < lead) b = (lead - p.chips) / 2 + 20; }
    const v = { bet: b, pp: 0, t3: 0, gufo: null, secret: false };
    if (d.side && p.style !== 'perfect' && Math.random() < .25) v[Math.random() < .5 ? 'pp' : 't3'] = 10;
    if (d.gufo && d.gufo.length && p.style !== 'perfect' && Math.random() < .1) v.gufo = { pid: d.gufo[rnd(d.gufo.length)].pid, amt: 10 };
    if (d.secret && Math.random() < (CFG.format === 'torneo' && S.hand > CFG.hands * .8 ? .7 : .06)) v.secret = true;
    return cleanBet(p, v, d);
  });
  if (kind === 'dub') return wait(1000 + Math.random() * 900).then(() => {
    const good = [], bad = []; d.hand.forEach((c, i) => (c === JOKER || BJ.rankOf(c) === d.rank ? good : bad).push(i));
    if (d.canCall && Math.random() < .08 + .12 * d.lastN + (good.length >= 3 ? .22 : 0) + (d.lastEmpty ? .3 : 0)) return { call: true };
    const src = (!good.length || (bad.length && Math.random() < .22)) ? bad : good;
    return { play: src.slice(0, Math.max(1, Math.min(src.length, 1 + rnd(Math.random() < .3 ? 3 : 2)))) };
  });
  if (kind === 'pact') return wait(1700).then(() => d.total >= 17 || (d.total >= 9 && d.total <= 11) || Math.random() < .3);
  return wait(850 + Math.random() * 500).then(() => {
    if (d.canCheat && p.style !== 'perfect' && d.total >= 12 && d.total <= 16 && Math.random() < .14) return { cheat: ['peek', 'swap', 'swap', 'ace'][rnd(4)] };
    if (d.freeP && d.allowed.includes('P') && BJ.valOf(d.cards[0]) !== 5) return 'P';
    if (d.freeD && d.allowed.includes('D')) return 'D';
    let a = BJ.STRATEGIES[p.style].play(d.cards, d.up, d.allowed.includes('D'), d.allowed.includes('P'), Math.random);
    if (!d.allowed.includes(a)) a = 'H';
    return a;
  });
}

// ---------------------------------------------------------------- carte in volo
let dealerCh = null;
async function reachDealer(world, ms) {
  const a = dealerCh.arms[1], back = a.rest.clone();
  const tgt = dealerCh.group.worldToLocal(world.clone()); tgt.y = Math.max(tgt.y, a.rest.y);
  const from = a.hand.clone();
  await tween(ms * .45, e => a.hand.lerpVectors(from, tgt, e));
  tween(ms * .55, e => a.hand.lerpVectors(tgt, back, e));
}
async function flyCard(c, target, yaw, faceUp, ms = 450) {
  reachDealer(SHOE_MOUTH, ms * .6); await wait(ms * .2);
  const obj = c === DEVIL ? makeDevilCard() : makeCard(c);
  obj.position.copy(SHOE_MOUTH); obj.rotation.set(0, -12 * DEG, Math.PI); SFX.card();
  await flyTo(obj, target, ms, { lift: .1, yaw, flip: faceUp ? 0 : Math.PI });
  updateShoeVisual(); return obj;
}
async function flipCard(obj, ms = 380) { const y = obj.position.y; SFX.flip(); await tween(ms, e => { obj.rotation.z = Math.PI * (1 - e); obj.position.y = y + Math.sin(e * Math.PI) * .06; }); }
async function maybeDevil(dest) { if (S.draws++ !== S.devilAt) return; await devilScene(dest); }
async function dealCardTo(p, hi, sideways = false) {
  await maybeDevil({ p, hi });
  const h = p.hands[hi], i = h.cards.length, c = SHOE.draw();
  const obj = await flyCard(c, cardSpot(p, hi, i), yawOf(p) + (sideways ? Math.PI / 2 : 0), true);
  h.cards.push(c); h.objs.push(obj); setHandTag(p, hi); pushState();
}
async function dealDealer(faceUp) {
  await maybeDevil(null);
  const d = S.dealer, i = d.cards.length, c = SHOE.draw();
  const obj = await flyCard(c, dealerSpot(i), 0, faceUp);
  d.cards.push(c); d.objs.push(obj); setDealerTag(); pushState();
}
function makeStackAt(amount, pos) { const st = makeStack(Math.max(5, Math.round(amount / 5) * 5)); st.position.copy(pos); return st; }
async function placeBet(p, hi, amount, extra = 0, secret = false) {
  const h = p.hands[hi], st = makeStackAt(amount, tablePt(2.0, p.a).setY(TH + .01));
  h.stacks.push(st); SFX.chip();
  if (secret) { const dome = makeDome(); st.add(dome); st.userData.dome = dome; st.children.forEach(c => { if (c !== dome) c.visible = false; }); }
  await flyTo(st, betSpot(p, hi, extra), 420, { lift: .05 });
}
function setHandTag(p, hi) {
  const h = p.hands[hi]; if (!h) return;
  if (!h.tag) h.tag = makeLabel('tag', '', () => isMe(p) ? handAnchor(p, hi).addScaledVector(seatRight(p), .1 + .034 * Math.max(0, h.cards.length - 1)).addScaledVector(seatDir(p), .02).setY(TH + .02) : handAnchor(p, hi).addScaledVector(seatDir(p), -.13).addScaledVector(seatRight(p), .03 + .017 * Math.max(0, h.cards.length - 1)).setY(TH + .02));
  const t = BJ.handInfo(h.cards).total;
  h.tag.el.className = 'tag' + (h.forfeit ? ' bust' : t > 21 ? ' bust' : BJ.isNatural(h.cards) && p.hands.length === 1 ? ' gold' : h.mult > 1 ? ' devil' : '');
  h.tag.el.innerHTML = (h.forfeit ? 'Baro!' : esc(totalText(h.cards, S.focus && S.focus.p === p && S.focus.hi === hi))) + (h.mult > 1 && !h.forfeit ? '<small>PATTO ×3</small>' : '') + (h.free && !h.forfeit ? '<small>GRATIS</small>' : '');
}
function setDealerTag() {
  const d = S.dealer; if (!d.cards.length) return;
  if (!d.tag) d.tag = makeLabel('tag', '', () => tmpV.set(0, TH + .02, TZ + .27));
  const vis = d.hole ? [d.cards[0]] : d.cards, t = BJ.handInfo(vis).total;
  d.tag.el.className = 'tag' + (!d.hole && t > 21 ? ' bust' : S.roundMult > 1 ? ' devil' : '');
  d.tag.el.innerHTML = (d.hole ? `${t === 11 ? 'A' : t}` : esc(totalText(d.cards, false))) + (S.roundMult > 1 ? '<small>MANO DOPPIA</small>' : '');
}

// ---------------------------------------------------------------- il Diavolo
async function devilScene(dest) {
  S.devilAt = -1;
  const focus0 = S.focus, cam0 = S.cam;
  const target = dest ? cardSpot(dest.p, dest.hi, dest.p.hands[dest.hi].cards.length).add(new THREE.Vector3(0, .0, 0)) : dealerSpot(S.dealer.cards.length);
  const obj = await flyCard(DEVIL, target, dest ? yawOf(dest.p) : 0, true, 620);
  SFX.devil(); S.red = 1;
  const y0 = obj.position.y; tween(900, e => { obj.position.y = y0 + .16 * e; obj.rotation.y += .02; });
  if (dest) {
    const p = dest.p, h = p.hands[dest.hi], total = BJ.handInfo(h.cards).total;
    S.cam = { kind: 'seat', p }; S.focus = { p, hi: dest.hi };
    setStatus(`La carta del Diavolo! A ${p.name} viene offerto un patto.`);
    await wait(1500);
    const yes = await ask(p, 'pact', { total }, { total, stake: h.stake + h.free }, 14000, () => false);
    if (yes) { h.mult = 3; if (p.ch) say(p, 'Accetto il patto.', '', true, 2400); setStatus(`${p.name} accetta: questa mano vale il triplo, nel bene e nel male.`); }
    else { if (p.ch) say(p, 'Vade retro!', '', false, 2200); setStatus(`${p.name} rifiuta il patto.`); }
    setHandTag(p, dest.hi);
  } else {
    S.roundMult = 2; S.cam = { kind: 'dealer' };
    setStatus('Il Diavolo siede al banco: questa mano vale doppio per tutti.'); say('dealer', 'Stasera si gioca forte.', '', true, 2600); setDealerTag();
  }
  await wait(1900);
  S.red = 0; S.focus = focus0; S.cam = cam0;
  await flyTo(obj, DISCARD_POS.clone().setY(TH + .03), 520, { lift: .2, flip: Math.PI });
  scene.remove(obj);
}

// ---------------------------------------------------------------- il baro
const canCheat = p => !!(CFG.rules.baro && p.cheatTok > 0 && !S.cheated.has(p.pid) && p.prompt && p.prompt.kind === 'act');
const canAccuse = p => !!(CFG.rules.baro && S.accOpen && p.alive && !S.accused.has(p.pid) && S.phase === 'game');
function tryCheat(p, kind) { if (canCheat(p) && ['peek', 'swap', 'ace'].includes(kind)) p.prompt.resolve({ cheat: kind }); }
async function doCheat(p, hi, kind) {
  p.cheatTok--; S.cheated.set(p.pid, kind);
  const h = p.hands[hi];
  if (kind === 'peek') { p.peek = S.dealer.cards[1]; S.gaze.set(p.pid, { until: performance.now() + 1500 * Math.max(SPEED, .3), at: dealerSpot(1) }); pushState(); await wait(1400); }
  else {
    const i = h.cards.length - 1, old = h.objs[i], c = kind === 'ace' ? rnd(4) * 13 : SHOE.draw(), arm = p.ch && p.ch.arms[1];
    let from, to;
    if (arm) { from = arm.hand.clone(); to = p.ch.group.worldToLocal(old.position.clone()); to.y += .05; await tween(240, e => arm.hand.lerpVectors(from, to, e)); }
    const obj = makeCard(c); obj.position.copy(old.position); obj.rotation.copy(old.rotation); scene.remove(old);
    h.cards[i] = c; h.objs[i] = obj; const y = obj.position.y;
    await tween(260, e => { obj.position.y = y + Math.sin(e * Math.PI) * .025; });
    if (arm) tween(300, e => arm.hand.lerpVectors(to, arm.rest, e));
    setHandTag(p, hi);
  }
  const eye = { peek: .1, swap: .22, ace: .38 }[kind];
  for (const b of alive()) if (b.kind === 'bot' && b !== p && !S.accused.has(b.pid) && Math.random() < eye) { setTimeout(() => accuse(b, p), (900 + Math.random() * 2200) * Math.max(SPEED, .1)); break; }
  pushState(); renderBar();
}
function accuse(by, target) {
  if (!by || !target || by === target || !canAccuse(by) || !target.inRound || S.caught.has(target.pid)) return;
  S.accused.add(by.pid); S.accQ.push({ by, target });
  const t = S.turn; if (t && t !== 'dealer' && t.prompt && t.prompt.kind === 'act') t.prompt.resolve('_int');
  pushState();
}
async function checkpoint() { while (S.accQ.length) await accusationScene(S.accQ.shift()); }
async function accusationScene({ by, target }) {
  const cam0 = S.cam; S.cam = target.ch ? { kind: 'seat', p: target } : cam0;
  SFX.gong(); setStatus(`${by.name} accusa ${target.name} di barare!`);
  if (by.ch) say(by, 'Baro!', 'accusa ' + target.name, true, 2600);
  await wait(2300);
  const kind = S.cheated.get(target.pid);
  if (kind && !S.caught.has(target.pid)) {
    S.caught.add(target.pid);
    const stake = target.hands.reduce((a, h) => a + h.stake, 0), fine = Math.min(target.chips, Math.max(50, stake));
    target.hands.forEach((h, hi) => { h.forfeit = true; setHandTag(target, hi); });
    target.chips -= fine; by.chips += fine; SFX.crack();
    const what = { peek: 'aveva sbirciato la carta del banco', swap: 'aveva cambiato una carta', ace: 'aveva un asso nella manica' }[kind];
    setStatus(`Beccato! ${target.name} ${what}. Mano persa e ${fmt.format(fine)} fiches di multa a ${by.name}.`);
    if (target.ch) say(target, 'Mi hanno beccato…', '', true, 2600);
  } else {
    const fine = Math.min(by.chips, 50); by.chips -= fine; target.chips += fine; SFX.lose();
    setStatus(`${target.name} è innocente. ${by.name} paga ${fmt.format(fine)} fiches di scuse.`);
    if (target.ch) say(target, 'Come osi!', '', false, 2600);
  }
  refreshPlates(); pushState();
  await wait(2600); S.cam = cam0;
}

// ---------------------------------------------------------------- scommesse laterali
function ppResult(a, b) { if (BJ.rankOf(a) !== BJ.rankOf(b)) return [0, '']; const sa = BJ.suitOf(a), sb = BJ.suitOf(b), red = s => s === 1 || s === 2; return sa === sb ? [30, 'Coppia perfetta'] : red(sa) === red(sb) ? [10, 'Coppia di colore'] : [5, 'Coppia mista']; }
function t3Result(a, b, c) {
  const r = [a, b, c].map(BJ.rankOf).sort((x, y) => x - y), s = [a, b, c].map(BJ.suitOf);
  const flush = s[0] === s[1] && s[1] === s[2], trips = r[0] === r[2];
  const straight = (r[1] === r[0] + 1 && r[2] === r[1] + 1) || (r[0] === 0 && r[1] === 11 && r[2] === 12);
  if (trips && flush) return [100, 'Tris reale']; if (straight && flush) return [40, 'Scala reale']; if (trips) return [30, 'Tris']; if (straight) return [10, 'Scala']; if (flush) return [5, 'Colore']; return [0, ''];
}
async function resolveSideBets(players) {
  let any = false;
  for (const p of players) {
    const sd = p.side, h = p.hands[0]; if (!sd || !(sd.pp || sd.t3)) continue; any = true;
    let win = 0; const parts = [];
    if (sd.pp) { const [k, n] = ppResult(h.cards[0], h.cards[1]); if (k) { win += sd.pp * k; p.chips += sd.pp; parts.push(n); } else S.bankNet += sd.pp; }
    if (sd.t3) { const [k, n] = t3Result(h.cards[0], h.cards[1], S.dealer.cards[0]); if (k) { win += sd.t3 * k; p.chips += sd.t3; parts.push(n); } else S.bankNet += sd.t3; }
    if (win) { p.chips += win; S.bankNet -= win; SFX.win(); setStatus(`${p.name}: ${parts.join(' e ')}! +${fmt.format(win)} fiches.`); if (p.ch) say(p, parts[0] + '!', '+' + fmt.format(win), false, 2400); }
    if (p.sideStack) { const st = p.sideStack; p.sideStack = null; flyTo(st, win ? tablePt(2.02, p.a).setY(TH + .01) : RACK.clone(), 520, { lift: .05 }).then(() => scene.remove(st)); }
    if (win) await wait(1500);
  }
  if (any) { refreshPlates(); pushState(); await wait(400); }
}

// ---------------------------------------------------------------- una mano
const newHand = stake => ({ cards: [], objs: [], base: stake, stake, free: 0, stacks: [], aces: false, need: false, mult: 1, forfeit: false, delta: 0, tag: null, res: '' });
function maxBetFor(p, n) { let m = 500; if (S.banker) m = Math.max(S.minBet, floor10(S.banker.chips / (2 * Math.max(1, n)))); return Math.max(10, Math.min(m, floor10(p.chips))); }
function pickBanker(act) {
  if (act.length < 2) { S.banker = null; showBankMark(null); return; }
  let next = null;
  if (S.nextBanker && S.nextBanker.alive) next = S.nextBanker;
  else if (!S.banker || !S.banker.alive || S.bankLeft <= 0) { const after = act.filter(p => !S.banker || p.a > S.banker.a); next = after[0] || act[0]; }
  S.nextBanker = null;
  if (next && next !== S.banker) { S.banker = next; S.bankLeft = 3; showBankMark(next); if (next.ch) say(next, 'Il banco è mio.', '', false, 2200); }
  else if (next) S.bankLeft = 3;
  S.bankLeft--;
}
async function playRound() {
  S.hand++; S.roundMult = 1; S.bankNet = 0; S.dealerIdle = false; S.cheated.clear(); S.caught.clear(); S.accused.clear(); S.accQ.length = 0; S.draws = 0; S.gaze.clear();
  await clearTable();
  for (const p of S.players) { p.peek = null; p.startChips = p.chips; p.inRound = false; p.hands = []; p.side = null; }
  if (S.hand > 1 && S.hand % 10 === 1) for (const p of S.players) { p.cheatTok = 1; p.secretTok = 1; }
  if (CFG.format === 'ultimo') S.minBet = Math.min(2000, 10 * 2 ** Math.floor((S.hand - 1) / 4));
  if (SHOE.needsShuffle()) { setStatus('Il banco rimescola i sei mazzi.'); say('dealer', 'Si rimescola.'); SHOE.shuffle(); discardCount = 0; updateShoeVisual(); await wait(1300); }
  const act = alive();
  if (CFG.bank === 'turno') pickBanker(act); else { S.banker = null; }
  refreshPlates();
  const bettors = act.filter(p => p !== S.banker);
  S.devilAt = CFG.rules.diavolo && Math.random() < .3 ? rnd(3 * bettors.length + 3) : -1;
  if (TEST.debug && window.__devil !== undefined) { S.devilAt = window.__devil; window.__devil = undefined; }
  S.stage = 'bet'; S.turn = null; S.focus = null; S.cam = { kind: 'home' };
  setStatus(`${handTitle()}. Fate le vostre puntate${S.banker ? ': tiene il banco ' + S.banker.name : ''}.`);
  const bets = await Promise.all(bettors.map(p => {
    const d = { min: S.minBet, max: maxBetFor(p, bettors.length), side: CFG.rules.laterali, secret: CFG.rules.segreta && p.secretTok > 0, gufo: CFG.rules.gufata ? bettors.filter(x => x !== p).map(x => ({ pid: x.pid, name: x.name })) : null };
    p.betDone = false;
    return ask(p, 'bet', d, Object.assign({ last: Math.max(d.min, Math.min(d.max, p.lastBet)) }, d), 30000, () => cleanBet(p, { bet: p.lastBet }, d)).then(v => { p.betDone = true; pushState(); return v; });
  }));
  bettors.forEach((p, i) => {
    const b = bets[i]; p.lastBet = b.bet; p.inRound = true;
    p.chips -= b.bet + b.pp + b.t3 + (b.gufo ? b.gufo.amt : 0); p.side = b; if (b.secret) p.secretTok--;
    p.hands = [newHand(b.bet)];
  });
  const players = bettors;
  if (!players.length) { setStatus('Nessuno al tavolo.'); await wait(1500); return; }
  S.stage = 'deal'; S.accOpen = true; refreshPlates();
  setStatus('Puntate fatte. Il banco distribuisce.'); S.cam = { kind: S.firstPerson ? 'dealer' : 'home' };
  await Promise.all(players.map(p => placeBet(p, 0, p.hands[0].stake, 0, p.side.secret)));
  for (const p of players) {
    const sb = p.side.pp + p.side.t3;
    if (sb) { p.sideStack = makeStackAt(sb, tablePt(2.0, p.a).setY(TH + .01)); flyTo(p.sideStack, betSpot(p, 0, -1.6), 400, { lift: .04 }); }
    if (p.side.gufo) { const t = byPid(p.side.gufo.pid); if (t && p.ch) say(p, `Gufo ${t.name}!`, 'se sballa incasso 3 a 1', true, 2400); else if (t) setStatus(`Hai gufato ${t.name}.`); }
  }
  if (players.some(p => p.side.gufo)) await wait(1200);
  S.dealer.cards = []; S.dealer.objs = []; S.dealer.hole = true;
  for (let r = 0; r < 2; r++) { for (const p of players) await dealCardTo(p, 0); await dealDealer(r === 0); }
  await resolveSideBets(players);
  let dNat = false;
  if (BJ.valOf(S.dealer.cards[0]) >= 10) {
    setStatus('Il banco controlla la carta coperta…'); await wait(900);
    if (BJ.isNatural(S.dealer.cards)) { dNat = true; S.dealer.hole = false; await flipCard(S.dealer.objs[1]); setDealerTag(); say('dealer', 'Blackjack del banco.', '', true, 2400); setStatus('Blackjack del banco.'); SFX.lose(); await wait(900); }
    else say('dealer', 'Niente blackjack.', '', false, 1400);
  }
  if (!dNat) {
    S.stage = 'play';
    if (CFG.rules.baro) for (const b of players) if (b.kind === 'bot' && Math.random() < .015) { const others = players.filter(x => x !== b); if (others.length) setTimeout(() => accuse(b, others[rnd(others.length)]), (3000 + Math.random() * 7000) * Math.max(SPEED, .1)); }
    for (const p of players) await playSeat(p);
    await checkpoint();
    await dealerTurn(players);
  }
  await checkpoint(); S.accOpen = false;
  await settle(players, dNat);
}
function handTitle() { return CFG.format === 'torneo' ? `Mano ${S.hand} di ${CFG.hands}` : `Mano ${S.hand}`; }

async function playSeat(p) {
  for (let hi = 0; hi < p.hands.length; hi++) {
    const h = p.hands[hi];
    if (h.forfeit) continue;
    S.turn = p; S.focus = { p, hi }; S.cam = { kind: 'seat', p }; setHandTag(p, hi); pushState();
    if (h.need) { await dealCardTo(p, hi); h.need = false; }
    if (h.aces) { S.focus = null; setHandTag(p, hi); continue; }
    if (BJ.isNatural(h.cards) && p.hands.length === 1) {
      SFX.blackjack(); setStatus(`${p.name} fa blackjack!`); if (p.ch) say(p, 'Blackjack!', '', false, 2200); await wait(900); S.focus = null; setHandTag(p, hi); continue;
    }
    for (;;) {
      await checkpoint(); if (h.forfeit) break;
      const info = BJ.handInfo(h.cards), total = info.total;
      if (total >= 21) { if (total > 21) { SFX.bust(); setStatus(`${p.name} sballa con ${total}.`); if (p.ch) say(p, 'Sballato.', '', true); await wait(800); } break; }
      const two = h.cards.length === 2, fb = CFG.rules.freebet, pair = two && BJ.isPair(h.cards);
      const freeD = fb && two && !info.soft && total >= 9 && total <= 11, freeP = fb && pair && BJ.valOf(h.cards[0]) !== 10;
      const canD = two && (freeD || p.chips >= h.base), canP = pair && p.hands.length < 4 && (freeP || p.chips >= h.base);
      const allowed = ['H', 'S']; if (canD) allowed.push('D'); if (canP) allowed.push('P');
      let [best, why] = BJ.basicWhy(h.cards, S.dealer.cards[0], canD, canP);
      if (freeP && canP && best !== 'P' && BJ.valOf(h.cards[0]) !== 5) { best = 'P'; why = 'Con il Free Bet la divisione la paga il banco: dividi.'; }
      else if (freeD && canD && best !== 'D' && best !== 'P') { best = 'D'; why = 'Con il Free Bet questo raddoppio è gratis: prendilo.'; }
      setStatus(p.hands.length > 1 ? `Tocca a ${p.name}: mano ${hi + 1} di ${p.hands.length}.` : `Tocca a ${p.name}.`);
      const data = { hi, cards: h.cards.slice(), up: S.dealer.cards[0], allowed, total, best, why, freeD, freeP, canCheat: CFG.rules.baro && p.cheatTok > 0 && !S.cheated.has(p.pid) };
      const pub = { allowed, freeD, freeP, hi, best: CFG.hints ? best : null, why: CFG.hints ? why : null };
      const a = await ask(p, 'act', data, pub, 30000, () => 'S');
      if (a === '_int') continue;
      if (a && a.cheat) { await doCheat(p, hi, a.cheat); continue; }
      const word = { H: 'Carta.', S: 'Sto.', D: 'Raddoppio.', P: 'Divido.' }[a];
      if (p.ch) { if (a === best && p.style === 'perfect' && p.kind === 'bot') say(p, word, 'da manuale', false, 1500); else if (a !== best && CFG.hints) say(p, word, 'il Dottore: ' + NAME[best].toLowerCase(), true, 1900); else say(p, word, '', false, 1400); }
      else if (a !== best && CFG.hints) setStatus(`Il Dottore avrebbe scelto ${NAME[best].toLowerCase()}.`);
      if (p.kind === 'bot') await wait(300);
      if (a === 'S') break;
      if (a === 'H') { await dealCardTo(p, hi); continue; }
      if (a === 'D') {
        if (freeD) h.free += h.base; else { p.chips -= h.base; h.stake += h.base; }
        refreshPlates(); await placeBet(p, hi, h.base, h.stacks.length);
        await dealCardTo(p, hi, true);
        const t = BJ.handInfo(h.cards).total; if (t > 21) { SFX.bust(); if (p.ch) say(p, 'Sballato.', '', true); setStatus(`${p.name} sballa con ${t}.`); await wait(700); }
        break;
      }
      if (a === 'P') {
        const isAce = BJ.valOf(h.cards[0]) === 11, nh = newHand(h.base);
        if (freeP) { nh.stake = 0; nh.free = h.base; } else p.chips -= h.base;
        nh.cards = [h.cards[1]]; nh.objs = [h.objs[1]]; nh.need = true; nh.aces = isAce; nh.mult = h.mult;
        h.cards = [h.cards[0]]; h.objs = [h.objs[0]]; h.aces = isAce;
        p.hands.splice(hi + 1, 0, nh); refreshPlates();
        const moves = [];
        p.hands.forEach((hh, k) => { hh.objs.forEach((o, i) => moves.push(flyTo(o, cardSpot(p, k, i), 380, { lift: .03 }))); hh.stacks.forEach((st, j) => moves.push(flyTo(st, betSpot(p, k, j), 380, { lift: .02 }))); });
        await Promise.all(moves);
        await placeBet(p, hi + 1, h.base);
        p.hands.forEach((_, k) => setHandTag(p, k));
        await dealCardTo(p, hi); setHandTag(p, hi + 1);
        if (isAce) break;
        continue;
      }
    }
    S.focus = null; setHandTag(p, hi);
  }
  S.turn = null; pushState();
}

async function dealerTurn(players) {
  S.turn = 'dealer'; S.focus = null; S.cam = { kind: 'dealer' }; S.stage = 'dealer';
  setStatus('Il banco scopre la carta.');
  S.dealer.hole = false; await flipCard(S.dealer.objs[1]); setDealerTag(); pushState();
  const live = players.some(p => p.hands.some(h => !h.forfeit && BJ.handInfo(h.cards).total <= 21 && !(BJ.isNatural(h.cards) && p.hands.length === 1)));
  if (live) while (BJ.handInfo(S.dealer.cards).total < 17) { await checkpoint(); await wait(450); await dealDealer(true); }
  const t = BJ.handInfo(S.dealer.cards).total; S.dealerIdle = !live;
  if (!live) setStatus('Nessuna mano da battere: il banco non tira.');
  else if (t > 21) { const push = CFG.rules.freebet && t === 22; say('dealer', push ? 'Ventidue: è pari.' : `Il banco sballa con ${t}.`, '', true, 2400); setStatus(push ? 'Il banco fa 22: con il Free Bet è pari per tutti.' : `Il banco sballa con ${t}.`); }
  else { say('dealer', `Il banco sta su ${t}.`, '', false, 2400); setStatus(`Il banco sta su ${t}.`); }
  await wait(700);
}

async function settle(players, dNat) {
  S.stage = 'settle'; S.turn = null; S.cam = { kind: 'home' };
  const dt = BJ.handInfo(S.dealer.cards).total, dBust = dt > 21, push22 = CFG.rules.freebet && dt === 22 && !dNat;
  const src = () => S.banker ? tablePt(1.72, S.banker.a).setY(TH + .02) : RACK.clone();
  const jobs = []; let royal = null;
  for (const p of players) {
    p.hands.forEach((h, hi) => {
      const t = BJ.handInfo(h.cards).total, nat = BJ.isNatural(h.cards) && p.hands.length === 1 && !h.forfeit;
      const r0 = BJ.rankOf(h.cards[0]), r1 = BJ.rankOf(h.cards[1]);
      const isRoyal = nat && CFG.bank === 'turno' && !!S.banker && BJ.suitOf(h.cards[0]) === BJ.suitOf(h.cards[1]) && Math.max(r0, r1) >= 10;
      let base;
      if (h.forfeit) base = -h.stake;
      else if (dNat) base = nat ? 0 : -h.stake;
      else if (nat) base = (isRoyal ? 2 : 1.5) * h.stake;
      else if (t > 21) base = -h.stake;
      else if (push22) base = 0;
      else if (dBust || t > dt) base = h.stake + h.free;
      else if (t === dt) base = 0;
      else base = -h.stake;
      if (isRoyal && !dNat && !royal) royal = p;
      const m = h.mult * S.roundMult; let delta = 0;
      if (base > 0) { delta = base * m; p.chips += h.stake + delta; }
      else if (base < 0) { const extra = Math.min(p.chips, h.stake * (m - 1)); p.chips -= extra; delta = base - extra; }
      else p.chips += h.stake;
      S.bankNet -= delta; h.delta = delta;
      h.res = h.forfeit ? 'Baro scoperto' : delta > 0 ? (nat ? (isRoyal ? 'Blackjack reale' : 'Blackjack') : 'Vinta') : base < 0 ? (t > 21 ? 'Sballata' : 'Persa') : (base === 0 && h.stake === 0 && !dBust && t < dt ? 'Persa (era gratis)' : 'Pari');
      if (!h.tag) setHandTag(p, hi);
      h.tag.el.className = 'tag ' + (delta > 0 ? (nat ? 'gold' : 'win') : delta < 0 ? 'bust' : '');
      h.tag.el.textContent = delta > 0 ? (nat ? 'Blackjack +' : '+') + fmt.format(delta) : delta < 0 ? '−' + fmt.format(-delta) : (h.res.startsWith('Persa') ? 'Persa' : 'Pari');
      jobs.push((async () => {
        await wait(150 * hi + Math.random() * 200);
        for (const st of h.stacks) if (st.userData.dome) { const dm = st.userData.dome; st.remove(dm); st.children.forEach(c => { c.visible = true; }); scene.remove(dm); }
        if (delta < 0) { SFX.chip(); await Promise.all(h.stacks.map(st => flyTo(st, src(), 600, { lift: .08 }))); h.stacks.forEach(st => scene.remove(st)); h.stacks = []; }
        else if (delta > 0) { const pay = makeStackAt(delta, src()); SFX.chip(); await flyTo(pay, betSpot(p, hi, h.stacks.length), 650, { lift: .08 }); h.stacks.push(pay); }
      })());
    });
  }
  // gufate
  for (const p of players) if (p.side && p.side.gufo) {
    const t = byPid(p.side.gufo.pid), amt = p.side.gufo.amt, hit = t && t.hands.some(h => BJ.handInfo(h.cards).total > 21);
    if (hit) { p.chips += amt * 4; S.bankNet -= amt * 3; if (p.ch) say(p, 'Gufata riuscita!', '+' + fmt.format(amt * 3), false, 2600); } else S.bankNet += amt;
  }
  await Promise.all(jobs);
  let bankMsg = '';
  if (S.banker) {
    const b = S.banker; b.chips += S.bankNet;
    bankMsg = S.bankNet > 0 ? ` Il banco di ${b.name} incassa ${fmt.format(S.bankNet)}.` : S.bankNet < 0 ? ` Il banco di ${b.name} paga ${fmt.format(-S.bankNet)}.` : '';
    if (b.chips < 0) { b.chips = 0; bankMsg = ` Il banco di ${b.name} è saltato!`; }
    if (b.ch && S.bankNet) say(b, S.bankNet > 0 ? 'Grazie, signori.' : 'Che salasso…', (S.bankNet > 0 ? '+' : '−') + fmt.format(Math.abs(S.bankNet)), S.bankNet < 0, 2600);
  }
  const best = players.reduce((a, p) => Math.max(a, p.chips - p.startChips), -1e9);
  if (best > 0) SFX.win(); else SFX.lose();
  refreshPlates(); pushState();
  const me = S.players.find(isMe), myNet = me && me.inRound ? me.chips - me.startChips : null;
  setStatus((myNet !== null ? (myNet > 0 ? `Hai vinto ${fmt.format(myNet)} fiches.` : myNet < 0 ? `Hai perso ${fmt.format(-myNet)} fiches.` : 'Pari: riprendi la puntata.') : dNat ? 'Blackjack del banco.' : dBust && !push22 ? 'Il banco ha sballato: vince chi è rimasto in gioco.' : push22 ? 'Il banco ha fatto 22: pari.' : S.dealerIdle ? 'Mano chiusa.' : `Il banco ha chiuso a ${dt}.`) + bankMsg);
  await wait(1700);
  const back = [];
  for (const p of players) for (const h of p.hands) { for (const st of h.stacks) back.push(flyTo(st, tablePt(2.02, p.a).setY(TH + .01), 520, { lift: .04 }).then(() => scene.remove(st))); h.stacks = []; }
  await Promise.all(back);
  if (royal && CFG.bank === 'turno' && royal.alive) { S.nextBanker = royal; setStatus(`Blackjack reale di ${royal.name}: pagato 2 a 1, e il banco passa a lui.`); await wait(1800); }
}
async function clearTable() {
  const objs = [];
  for (const p of S.players) { for (const h of p.hands) { objs.push(...h.objs); dropLabel(h.tag); h.stacks.forEach(st => scene.remove(st)); } if (p.sideStack) { scene.remove(p.sideStack); p.sideStack = null; } }
  objs.push(...S.dealer.objs); dropLabel(S.dealer.tag); S.dealer.tag = null; S.dealer.objs = []; S.dealer.cards = [];
  for (const p of S.players) p.hands = [];
  if (!objs.length) return;
  reachDealer(DISCARD_POS, 700);
  await Promise.all(objs.map((o, i) => wait(i * 25).then(() => flyTo(o, DISCARD_POS.clone().setY(TH + .02 + discardCount * .00045), 520, { lift: .06, flip: Math.PI, yaw: 12 * DEG }))));
  discardCount += objs.length; objs.forEach(o => scene.remove(o)); updateShoeVisual(); pushState();
}

// ---------------------------------------------------------------- tra una mano e l'altra
const elimHands = n => [Math.round(n * 8 / 30), Math.round(n * 16 / 30), Math.round(n * 25 / 30)];
async function eliminate(p, why) {
  p.alive = false; S.outOrder.push(p); if (S.banker === p) { S.banker = null; showBankMark(null); }
  if (CFG.game === 'dubito') placeChar(p);
  SFX.crack(); if (p.ch) { S.cam = { kind: 'seat', p }; say(p, 'Addio, signori.', '', true, 2600); }
  setStatus(`${why} ${p.name} è fuori.`); refreshPlates(); pushState(); await wait(2500); S.cam = { kind: 'home' };
}
async function bankrupt(p) {
  if (CFG.format === 'libera') { p.loans++; p.chips = 1000; setStatus(`${p.name} è al verde: il Ridotto gli presta altre 1.000 fiches.`); if (p.ch) say(p, 'Un prestito, prego.', 'prestito n. ' + p.loans, true, 2400); refreshPlates(); await wait(1900); }
  else if (CFG.format === 'ultimo' && p.lives > 1) { p.lives--; p.chips = 500; SFX.crack(); placeChar(p); if (p.ch) S.cam = { kind: 'seat', p }; setStatus(`La maschera di ${p.name} si incrina: 500 fiches e un'ultima possibilità.`); refreshPlates(); await wait(2600); S.cam = { kind: 'home' }; }
  else { p.lives = 0; await eliminate(p, CFG.format === 'ultimo' ? 'La maschera si spezza:' : 'Senza più fiches:'); }
}
async function postRound() {
  for (const p of alive()) if (p.chips < 10) await bankrupt(p);
  if (CFG.format === 'torneo' && CFG.elim && elimHands(CFG.hands).includes(S.hand) && S.hand < CFG.hands) {
    const a = alive(); if (a.length > 2) { const low = a.reduce((m, p) => p.chips < m.chips ? p : m); await eliminate(low, 'Momento della verità: chi ha meno fiches esce.'); }
  }
  const a = alive();
  if (S.abort) return true;
  if (!a.some(p => p.kind !== 'bot')) return true;
  if (CFG.format === 'torneo' && (S.hand >= CFG.hands || a.length <= 1)) return true;
  if (CFG.format === 'ultimo' && a.length <= 1) return true;
  return false;
}
function ranking() {
  const score = p => CFG.format === 'libera' ? p.chips - p.loans * 1000 : p.chips;
  const A = alive().sort((x, y) => score(y) - score(x)), O = S.outOrder.slice().reverse();
  return [...A, ...O].map((p, i) => ({ pos: i + 1, pid: p.pid, name: p.name, chips: p.chips, loans: p.loans, out: !p.alive, label: CFG.game === 'dubito' ? (p.alive ? 'in piedi' : 'fuori') : null }));
}
async function gameLoop() {
  const gen = ++S.gen;
  while (gen === S.gen) {
    await playRound(); if (gen !== S.gen) return;
    if (await postRound()) break;
    await wait(600);
  }
  if (gen === S.gen) endGame();
}
function startGame() {
  if (!S.players.length) return;
  if (CFG.game === 'dubito') { if (S.players.length >= 2) startDubito(); return; }
  SFX.unlock();
  if (CFG.bank === 'turno' && S.players.length < 2) CFG.bank = 'casa';
  const start = CFG.format === 'ultimo' ? 500 : 1000;
  for (const p of S.players) Object.assign(p, { chips: start, startChips: start, alive: true, lives: 2, loans: 0, cheatTok: 1, secretTok: 1, lastBet: 20, hands: [], inRound: false, side: null, peek: null, prompt: null });
  Object.assign(S, { phase: 'game', hand: 0, minBet: 10, banker: null, bankLeft: 0, nextBanker: null, outOrder: [], ended: false, abort: false, rank: null, stage: '' });
  layoutSeats(); showBankMark(null);
  S.editing = null; renderEditor();
  $('#lobby').hidden = true; $('#end').hidden = true; $('#hud').hidden = false; $('#endBtn').textContent = 'Termina partita';
  renderHUD(); pushState(); gameLoop();
}
function endGame() {
  S.ended = true; S.rank = ranking(); S.turn = null; S.focus = null;
  const w = byPid(S.rank[0].pid); S.cam = w && w.ch ? { kind: 'winner', p: w } : { kind: 'home' };
  SFX.fanfare(); if (w && w.ch) say(w, 'Il Ridotto è mio!', '', false, 6000);
  setStatus('');
  $('#endSheet').innerHTML = `<h2>${esc(S.rank[0].name)} vince</h2><p>${CFG.game === 'dubito' ? 'Resta una sola maschera intera, dopo ' + S.hand + ' giri.' : CFG.format === 'torneo' ? 'Torneo concluso dopo ' + S.hand + ' mani.' : CFG.format === 'ultimo' ? 'L\'ultima maschera intera.' : 'Partita chiusa dopo ' + S.hand + ' mani.'}</p>
    <div class="rank">${S.rank.map(r => `<div class="row"><span>${r.pos}.</span><span>${esc(r.name)}${r.loans ? ` <small>(${r.loans} ${r.loans > 1 ? 'prestiti' : 'prestito'})</small>` : ''}</span><b>${r.label || (r.out ? 'fuori' : fmt.format(r.chips))}</b></div>`).join('')}</div>
    <div class="row-btns"><button class="ticket main" id="againBtn"><span class="t">Rivincita</span><span class="s">stessi giocatori e regole</span></button><button class="ticket" id="lobbyBtn"><span class="t">Sala d'attesa</span><span class="s">cambia regole o maschere</span></button></div>`;
  setTimeout(() => { $('#end').hidden = false; }, 2600 * Math.max(SPEED, .1));
  pushState();
}
async function toLobby() {
  S.gen++; S.phase = 'lobby'; S.ended = false; S.rank = null; S.banker = null; showBankMark(null); S.turn = null; S.focus = null; S.status = '';
  for (const p of S.players) { p.alive = true; p.lives = 2; }
  await clearTable(); dubClear();
  $('#end').hidden = true; $('#hud').hidden = true; $('#lobby').hidden = false; $('#status').textContent = '';
  layoutSeats();
  for (const [id, m] of S.late) { S.late.delete(id); onNet(id, m); }
  renderLobby(); pushState();
}

// ---------------------------------------------------------------- interfaccia: sala d'attesa
function seg(id, value, cb) {
  const box = $(id);
  box.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === String(value))));
  if (!box.dataset.wired) { box.dataset.wired = '1'; box.addEventListener('click', e => { const b = e.target.closest('button[data-v]'); if (b) cb(b.dataset.v); }); }
}
function renderLobby() {
  if (S.phase !== 'lobby') return;
  $('#plist').innerHTML = S.players.length ? S.players.map((p, i) => `<div class="prow">
      ${p.kind === 'local' ? `<input id="pn-${p.pid}" data-name="${p.pid}" value="${esc(p.name)}" maxlength="14" aria-label="Nome del giocatore ${i + 1}">` : `<span class="nm">${esc(p.name)}</span>`}
      <span class="kind${p.kind === 'remote' && !p.online ? ' off' : ''}">${p.kind === 'remote' ? (p.online ? 'TELEFONO' : 'SCOLLEGATO') : p.kind === 'bot' ? 'MASCHERA' : 'QUI'}</span>
      <span>${p.kind === 'local' ? `<button class="mini" data-edit="${p.pid}">Personalizza</button> ` : ''}<button class="mini" data-del="${p.pid}" aria-label="Togli ${esc(p.name)}">Togli</button></span></div>`).join('')
    : '<p class="note">Ancora nessuno. Inquadrate il codice, oppure aggiungete un giocatore qui sotto.</p>';
  $('#addLocal').disabled = $('#addBot').disabled = S.players.length >= 6;
  seg('#segGame', CFG.game, v => { CFG.game = v; saveCfg(); renderLobby(); pushState(); });
  $('#bjOpts').hidden = CFG.game !== 'blackjack';
  $('#gameNote').textContent = CFG.game === 'dubito' ? 'Ognuno riceve 5 carte segrete (sul telefono). A turno ne giochi da 1 a 3 coperte dichiarando che sono la carta del tavolo: Re, Regine o Assi. Puoi mentire. Chi viene dopo può dire "Dubito!": se mentivi premi tu il grilletto, se dicevi la verità lo preme lui. La pistola ha 6 colpi e uno solo è carico. I jolly valgono tutto. Vince l\'ultimo in piedi. Da 2 a 6 giocatori.' : 'Tutti contro il banco: vince chi si avvicina di più a 21 senza superarlo.';
  seg('#segFormat', CFG.format, v => { CFG.format = v; saveCfg(); renderLobby(); pushState(); });
  seg('#segHands', CFG.hands, v => { CFG.hands = +v; saveCfg(); renderLobby(); pushState(); });
  seg('#segBank', CFG.bank, v => { CFG.bank = v; saveCfg(); renderLobby(); pushState(); });
  $('#formatNote').textContent = FORMAT_TXT[CFG.format]; $('#bankNote').textContent = BANK_TXT[CFG.bank] + (CFG.bank === 'turno' && S.players.length < 2 ? ' Servono almeno due giocatori.' : '');
  $('#torneoOpts').hidden = CFG.format !== 'torneo'; $('#optElim').checked = CFG.elim; $('#optHints').checked = CFG.hints;
  document.querySelectorAll('[data-rule]').forEach(c => { c.checked = !!CFG.rules[c.dataset.rule]; });
  const n = S.players.length, hs = humans().length;
  const locals = S.players.filter(p => p.kind === 'local').length, dub = CFG.game === 'dubito', dubBad = dub && (n < 2 || locals > 1);
  $('#startBtn').disabled = n === 0 || hs === 0 || dubBad;
  $('#startNote').textContent = dubBad ? (locals > 1 ? 'A Dubito le carte sono segrete: al massimo un giocatore su questo schermo, gli altri dal telefono.' : 'A Dubito servono almeno due giocatori: aggiungi un telefono o una maschera del Ridotto.') : n === 0 ? 'Serve almeno un giocatore.' : hs === 0 ? 'Serve almeno un giocatore in carne e ossa.' : `${n} al tavolo. Quando ci siete tutti, si parte.`;
}
let editTab = 'mask';
function openEditor(p) { S.editing = p; editTab = 'mask'; renderEditor(); }
function renderEditor() {
  const p = S.editing, box = $('#editBox');
  if (!p || !S.players.includes(p) || S.phase !== 'lobby') { S.editing = null; box.hidden = true; $('#cfgBox').hidden = false; return; }
  box.hidden = false; $('#cfgBox').hidden = true;
  box.innerHTML = `<h2>La maschera di ${esc(p.name)}</h2><p class="note">Guardala al centro dello schermo mentre la cambi.</p>
    <div class="tabs">${EDIT_TABS.map(([k, l]) => `<button data-tab="${k}" aria-selected="${k === editTab}">${l}</button>`).join('')}</div>
    <div style="display:grid; gap:9px">${editorHTML(p.look, editTab)}</div>
    <div class="seg"><button data-ed="dice">Sorpresa!</button><button data-ed="done" aria-pressed="true">Fatto</button></div>`;
}
function wireEditor() {
  $('#editBox').addEventListener('click', e => {
    const b = e.target.closest('button'), p = S.editing; if (!b || !p) return;
    if (b.dataset.tab) editTab = b.dataset.tab;
    else if (b.dataset.ed === 'done') S.editing = null;
    else if (b.dataset.ed === 'dice') { p.look = normalizeLook(randomLook()); placeChar(p); }
    else if (applyEdit(p.look, b.dataset)) { p.look = normalizeLook(p.look); placeChar(p); }
    renderEditor();
  });
}
function wireLobby() {
  wireEditor();
  $('#addLocal').addEventListener('click', () => addPlayer('local', 'Giocatore ' + (S.players.length + 1), randomLook()));
  $('#addBot').addEventListener('click', () => { const b = BOTS.find(x => !S.players.some(p => p.name === x.name)); if (b) addPlayer('bot', b.name, b.look, { style: b.style }); });
  $('#plist').addEventListener('click', e => {
    const d = e.target.closest('[data-del]'); if (d) { const p = byPid(d.dataset.del); if (p) removePlayer(p); return; }
    const r = e.target.closest('[data-edit]'); if (r) { const p = byPid(r.dataset.edit); if (p) openEditor(p); }
  });
  $('#plist').addEventListener('change', e => { const pid = e.target.dataset.name; const p = pid && byPid(pid); if (p) { p.name = cleanName(e.target.value, p.name); refreshPlates(); renderLobby(); } });
  $('#optElim').addEventListener('change', e => { CFG.elim = e.target.checked; saveCfg(); pushState(); });
  $('#optHints').addEventListener('change', e => { CFG.hints = e.target.checked; saveCfg(); pushState(); });
  document.querySelectorAll('[data-rule]').forEach(c => c.addEventListener('change', () => { CFG.rules[c.dataset.rule] = c.checked; saveCfg(); pushState(); }));
  $('#startBtn').addEventListener('click', startGame);
  $('#end').addEventListener('click', e => { if (e.target.closest('#againBtn')) { S.gen++; clearTable().then(startGame); } else if (e.target.closest('#lobbyBtn')) toLobby(); });
  $('#endBtn').addEventListener('click', () => {
    if (S.ended) return;
    if (S.abort) { S.abort = false; $('#endBtn').textContent = 'Termina partita'; }
    else { S.abort = true; $('#endBtn').textContent = 'Finisce dopo questa mano (annulla)'; }
  });
  $('#soundBtn').addEventListener('click', e => { SFX.mute(!SFX.muted); SFX.unlock(); e.currentTarget.setAttribute('aria-pressed', String(!SFX.muted)); e.currentTarget.textContent = 'Suoni: ' + (SFX.muted ? 'no' : 'sì'); });
  $('#speedBtn').addEventListener('click', e => { SPEED = SPEED === 1 ? .5 : 1; e.currentTarget.setAttribute('aria-pressed', String(SPEED !== 1)); e.currentTarget.textContent = 'Velocità: ' + (SPEED === 1 ? 'normale' : 'rapida'); });
  $('#accuseBtn').addEventListener('click', openAccuse);
  $('#pick').addEventListener('click', e => { if (e.target === $('#pick')) $('#pick').hidden = true; });
}

// ---------------------------------------------------------------- interfaccia: partita
function renderHUD() {
  if (S.phase === 'lobby') return;
  const fmtName = { libera: 'Partita libera', torneo: 'Torneo', ultimo: 'Ultimo in piedi' }[CFG.format];
  if (CFG.game === 'dubito' && S.D) {
    $('#sub').textContent = `Dubito · giro ${S.D.round} · carta del tavolo: ${DRANK[S.D.rank][0]}`; $('#rulechips').innerHTML = ''; refreshPlates();
    $('#board').innerHTML = '<h4>AL TAVOLO</h4>' + order().map(p => `<div class="row${p.alive ? '' : ' out'}${S.turn === p ? ' turn' : ''}"><span>${esc(p.name)}</span><b>${p.alive ? (p.hand || []).length + ' carte · ' + (p.pulls || 0) + '/6' : 'fuori'}</b></div>`).join('');
    $('#accuseBtn').hidden = true; return;
  }
  $('#sub').textContent = `${fmtName} · ${handTitle().toLowerCase()}${S.minBet > 10 ? ' · minima ' + fmt.format(S.minBet) : ''}${CFG.bank === 'turno' ? ' · banco a turno' : ''}`;
  $('#rulechips').innerHTML = Object.keys(CFG.rules).filter(k => CFG.rules[k]).map(k => `<span>${RULE_NAMES[k].toUpperCase()}</span>`).join('');
  const rows = S.players.slice().sort((a, b) => (b.alive - a.alive) || (b.chips - a.chips));
  $('#board').innerHTML = '<h4>CLASSIFICA</h4>' + rows.map(p => `<div class="row${p.alive ? '' : ' out'}${S.turn === p ? ' turn' : ''}"><span>${esc(p.name)}${S.banker === p ? '<small class="bank">BANCO</small>' : ''}${CFG.format === 'ultimo' && p.alive && p.lives === 1 ? '<small>INCRINATA</small>' : ''}${p.loans ? `<small>${p.loans} PREST.</small>` : ''}${p.kind === 'remote' && !p.online ? '<small>OFFLINE</small>' : ''}</span><b>${p.alive ? fmt.format(p.chips) : 'fuori'}</b></div>`).join('');
  $('#accuseBtn').hidden = !(CFG.rules.baro && S.accOpen && S.players.some(p => p.kind === 'local' && canAccuse(p)));
}
const localPrompt = () => order().find(p => p.kind === 'local' && p.prompt) || null;
const CARD_TXT = c => BJ.RANKS[BJ.rankOf(c)] + BJ.SUITS[BJ.suitOf(c)];
function renderBar() {
  const bar = $('#bar'), adv = $('#advice'), p = localPrompt();
  const peeker = S.players.find(x => x.kind === 'local' && x.peek !== null && x.peek !== undefined);
  if (!p) { bar.innerHTML = ''; adv.hidden = true; return; }
  const pr = p.prompt, d = pr.data, who = S.firstPerson ? '' : `<div class="who">${esc(p.name)}, tocca a te</div>`;
  adv.hidden = true;
  if (pr.kind === 'bet') {
    const max = Math.max(10, Math.min(d.max, floor10(p.chips))), min = Math.min(d.min, max);
    if (!p.draft) p.draft = { bet: Math.max(min, Math.min(max, p.lastBet)), pp: 0, t3: 0, gufo: null, secret: false };
    const f = p.draft, chip = (v, col) => `<button class="chipbtn" style="--c:${col}" data-chip="${v}" ${f.bet + v > max ? 'disabled' : ''} aria-label="Aggiungi ${v}"><span>${v}</span></button>`;
    let extras = '';
    if (d.side) extras += `<button class="ticket small" data-x="pp"><span class="t">Coppia perfetta</span><span class="s">${f.pp ? fmt.format(f.pp) + ' fiches' : 'non gioco'}</span></button><button class="ticket small" data-x="t3"><span class="t">21+3</span><span class="s">${f.t3 ? fmt.format(f.t3) + ' fiches' : 'non gioco'}</span></button>`;
    if (d.secret) extras += `<button class="ticket small${f.secret ? ' hint' : ''}" data-x="secret"><span class="t">Puntata segreta</span><span class="s">${f.secret ? 'sotto la campana' : 'no'}</span></button>`;
    if (d.gufo && d.gufo.length) { const t = f.gufo && d.gufo.find(x => x.pid === f.gufo.pid); extras += `<button class="ticket small${t ? ' hint' : ''}" data-x="gufo"><span class="t">Gufata</span><span class="s">${t ? '20 su ' + esc(t.name) : 'nessuno'}</span></button>`; }
    bar.innerHTML = who + (extras ? `<div class="extras">${extras}</div>` : '') + chip(10, '#2a3f6b') + chip(50, '#1e5a3a') + chip(100, '#17110d') +
      `<div class="betbox"><div class="k">PUNTATA${min > 10 ? ' (MIN ' + min + ')' : ''}</div><div class="v">${fmt.format(f.bet)}</div></div>` +
      `<button class="ticket" data-x="clear"><span class="t">Minimo</span><span class="s">riparti da ${min}</span></button>` +
      `<button class="ticket main" data-x="go"><span class="t">${S.firstPerson ? 'Distribuisci' : 'Punta'}</span><span class="s">${S.firstPerson ? 'Invio' : 'conferma'}</span></button>`;
  } else if (pr.kind === 'act') {
    if (p.cheatMenu && canCheat(p)) {
      bar.innerHTML = who + `<button class="ticket red" data-cheat="peek"><span class="t">Sbircia</span><span class="s">la carta coperta del banco</span></button><button class="ticket red" data-cheat="swap"><span class="t">Cambia carta</span><span class="s">l'ultima, con una a caso</span></button><button class="ticket red" data-cheat="ace"><span class="t">Asso nella manica</span><span class="s">l'ultima carta diventa un asso</span></button><button class="ticket" data-x="nocheat"><span class="t">Lascia stare</span><span class="s">gioco pulito</span></button>`;
      return;
    }
    const hint = CFG.hints, t = (a, s, key) => `<button class="ticket${hint && d.best === a ? ' hint' : ''}" data-a="${a}" ${d.allowed.includes(a) ? '' : 'disabled'}><span class="t">${NAME[a]}</span><span class="s">${s} · ${key}</span></button>`;
    bar.innerHTML = who + t('H', 'un\'altra carta', 'C') + t('S', 'mi fermo', 'S') + t('D', d.freeD ? 'gratis, paga il banco' : 'una carta, puntata doppia', 'R') + t('P', d.freeP ? 'gratis, paga il banco' : 'due mani', 'D') +
      (canCheat(p) ? `<button class="ticket small red" data-x="cheat"><span class="t">Trucchi</span><span class="s">ne hai uno</span></button>` : '');
    if (hint || p.peek !== null && p.peek !== undefined) {
      adv.hidden = false; $('#adviceK').textContent = 'IL CONSIGLIO DEL DOTTORE';
      $('#adviceText').innerHTML = (hint ? `<b>${NAME[d.best]}.</b> ${esc(d.why)}` : '') + (p.peek !== null && p.peek !== undefined ? `<br><b>Hai sbirciato:</b> il banco nasconde ${CARD_TXT(p.peek)}.` : '');
    }
  } else if (pr.kind === 'dub') {
    if (!p.dsel) p.dsel = new Set();
    const k = p.dsel.size, nm = c => c === JOKER ? 'Jolly' : CARD_TXT(c);
    bar.innerHTML = `<div class="who">${S.firstPerson ? 'Le tue carte' : esc(p.name) + ', le tue carte'}: scegline da 1 a 3</div>` + p.hand.map((c, i) => `<button class="ticket small${p.dsel.has(i) ? ' hint' : ''}" data-dc="${i}"><span class="t" style="font-size:22px">${nm(c)}</span></button>`).join('') +
      `<button class="ticket main" data-x="dplay" ${k ? '' : 'disabled'}><span class="t">Gioca${k ? ' ' + k : ''}</span><span class="s">come ${DRANK[d.rank][1].toLowerCase()}</span></button>` + (d.canCall ? `<button class="ticket red" data-x="dcall"><span class="t">Dubito!</span><span class="s">sull'ultima giocata</span></button>` : '');
  } else if (pr.kind === 'pact') {
    bar.innerHTML = who + `<button class="ticket red" data-pact="1"><span class="t">Accetto il patto</span><span class="s">la mano vale il triplo</span></button><button class="ticket" data-pact="0"><span class="t">Rifiuto</span><span class="s">vade retro</span></button>`;
    adv.hidden = false; $('#adviceK').textContent = 'LA CARTA DEL DIAVOLO'; $('#adviceText').innerHTML = `Se accetti, questa mano vale <b>il triplo</b>: se vinci incassi tre volte, se perdi paghi tre volte (fin dove arrivano le tue fiches).`;
  }
  void peeker;
}
function wireBar() {
  $('#bar').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    const p = localPrompt(); if (!p) return; const pr = p.prompt, d = pr.data; SFX.unlock();
    if (pr.kind === 'bet') {
      const f = p.draft, max = Math.max(10, Math.min(d.max, floor10(p.chips))), min = Math.min(d.min, max), cyc = v => ({ 0: 10, 10: 20, 20: 50, 50: 0 }[v]);
      if (b.dataset.chip) { f.bet = Math.min(max, f.bet + +b.dataset.chip); SFX.chip(); }
      else if (b.dataset.x === 'clear') f.bet = min;
      else if (b.dataset.x === 'pp') f.pp = cyc(f.pp);
      else if (b.dataset.x === 't3') f.t3 = cyc(f.t3);
      else if (b.dataset.x === 'secret') f.secret = !f.secret;
      else if (b.dataset.x === 'gufo') { const i = f.gufo ? d.gufo.findIndex(x => x.pid === f.gufo.pid) : -1; f.gufo = i + 1 < d.gufo.length ? { pid: d.gufo[i + 1].pid, amt: 20 } : null; }
      else if (b.dataset.x === 'go') { acceptReply(p, f); return; }
      renderBar();
    } else if (pr.kind === 'act') {
      if (b.dataset.x === 'cheat') { p.cheatMenu = true; renderBar(); }
      else if (b.dataset.x === 'nocheat') { p.cheatMenu = false; renderBar(); }
      else if (b.dataset.cheat) { p.cheatMenu = false; tryCheat(p, b.dataset.cheat); }
      else if (b.dataset.a) acceptReply(p, b.dataset.a);
    } else if (pr.kind === 'dub') {
      if (b.dataset.dc !== undefined) { const i = +b.dataset.dc; if (p.dsel.has(i)) p.dsel.delete(i); else if (p.dsel.size < 3) p.dsel.add(i); renderBar(); }
      else if (b.dataset.x === 'dplay') acceptReply(p, { play: [...p.dsel] }); else if (b.dataset.x === 'dcall') acceptReply(p, { call: true });
    } else if (pr.kind === 'pact') acceptReply(p, b.dataset.pact === '1');
  });
  document.addEventListener('keydown', e => {
    if (e.target.matches('input, select, textarea')) return;
    const p = localPrompt(); if (!p) return; const k = e.key.toLowerCase();
    if (p.prompt.kind === 'act') { const a = { c: 'H', h: 'H', s: 'S', r: 'D', d: 'P', p: 'P' }[k]; if (a && p.prompt.data.allowed.includes(a)) { e.preventDefault(); acceptReply(p, a); } }
    else if (p.prompt.kind === 'bet' && k === 'enter' && p.draft) { e.preventDefault(); acceptReply(p, p.draft); }
  });
}
function openPick(title, opts, cb) {
  $('#pickSheet').innerHTML = `<h2 style="font-size:30px">${esc(title)}</h2><div class="row-btns">${opts.map((o, i) => `<button class="ticket" data-i="${i}"><span class="t">${esc(o.label)}</span></button>`).join('')}<button class="ticket small" data-i="-1"><span class="t">Annulla</span></button></div>`;
  $('#pick').hidden = false;
  $('#pickSheet').onclick = e => { const b = e.target.closest('button[data-i]'); if (!b) return; $('#pick').hidden = true; const i = +b.dataset.i; if (i >= 0) cb(opts[i].value); };
}
function openAccuse() {
  const locals = S.players.filter(p => p.kind === 'local' && canAccuse(p)); if (!locals.length) return;
  const pickTarget = by => openPick('Chi sta barando?', S.players.filter(p => p !== by && p.inRound).map(p => ({ label: p.name, value: p })), t => accuse(by, t));
  if (locals.length === 1) pickTarget(locals[0]); else openPick('Chi accusa?', locals.map(p => ({ label: p.name, value: p })), pickTarget);
}

// ---------------------------------------------------------------- regia: camera, teste, luci
const CAM = { pos: new THREE.Vector3(0, 2, 3.4), look: new THREE.Vector3(0, .9, -.4), tp: new THREE.Vector3(), tl: new THREE.Vector3() };
const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
window.addEventListener('pointermove', e => { mouse.x = e.clientX / window.innerWidth * 2 - 1; mouse.y = e.clientY / window.innerHeight * 2 - 1; });
const headWorld = (p, y = 1.3) => p.ch.group.localToWorld(new THREE.Vector3(0, y, 0));
function camTargets(t) {
  const c = S.cam, portrait = window.innerWidth < window.innerHeight;
  if (S.phase === 'lobby') {
    const ps = S.players.filter(p => p.ch);
    if (ps.length) { const p = S.editing && ps.includes(S.editing) ? S.editing : S.show && S.showUntil > t && ps.includes(S.show) ? S.show : ps[Math.floor(t / 5) % ps.length]; CAM.tp.copy(tablePt(.35, p.a)).setY(1.62); CAM.tl.copy(headWorld(p, 1.52)); }
    else { CAM.tp.set(Math.sin(t * .11) * 1.5, 1.95, 3.3 + Math.cos(t * .11) * .2); CAM.tl.set(0, .95, -.45); }
    return;
  }
  if (S.firstPerson) {
    CAM.tp.set(0, 1.33, 1.5);
    if (c.kind === 'seat' && c.p && c.p.ch) CAM.tl.copy(headWorld(c.p, 1.2)).lerp(c.p.hands.length ? cardSpot(c.p, 0, 0) : tablePt(1.6, c.p.a), .45);
    else if (c.kind === 'winner' && c.p && c.p.ch) CAM.tl.copy(headWorld(c.p, 1.4));
    else if (c.kind === 'dealer') CAM.tl.set(0, .86, TZ + .2);
    else if (c.kind === 'pile') CAM.tl.set(0, TH, TZ + .75);
    else CAM.tl.set(0, .74, -.45);
    return;
  }
  if ((c.kind === 'seat' || c.kind === 'winner') && c.p && c.p.ch) {
    const p = c.p;
    if (c.kind === 'winner') { CAM.tp.copy(tablePt(.9, p.a)).setY(1.65); CAM.tl.copy(headWorld(p, 1.4)); }
    else { CAM.tp.copy(tablePt(.2, p.a)).setY(1.78); CAM.tl.copy(headWorld(p, 1.3)).lerp(cardSpot(p, 0, 0), .45); }
  } else if (c.kind === 'pile') { CAM.tp.set(0, 1.85, TZ - .35); CAM.tl.set(0, TH, TZ + .8);
  } else if (c.kind === 'dealer') { CAM.tp.set(0, 1.8, 2.0); CAM.tl.set(0, .98, -1.0); }
  else { const wide = S.players.length > 4 || portrait; CAM.tp.set(0, wide ? 2.5 : 2.3, wide ? -3.2 : -2.75); CAM.tl.set(0, .62, .8); }
}
function aim(ch, world, dt, bow = 0) {
  let yaw = 0, pitch = -.2;
  if (world) { ch.group.worldToLocal(tmpV.copy(world)).sub(ch.head.position); yaw = Math.max(-1, Math.min(1, Math.atan2(-tmpV.x, -tmpV.z))); pitch = Math.max(-.6, Math.min(.35, Math.atan2(tmpV.y, Math.hypot(tmpV.x, tmpV.z)))); }
  const k = 1 - Math.exp(-dt * 4);
  ch.head.rotation.y += (yaw - ch.head.rotation.y) * k; ch.head.rotation.x += (pitch + bow - ch.head.rotation.x) * k;
}
const WARM = new THREE.Color(0xffd29a), HELL = new THREE.Color(0xff2a14);
let redNow = 0;
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), .38, .5, 1.05);
composer.addPass(bloom);
const grain = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uRed: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime; uniform float uRed; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){ vec4 c = texture2D(tDiffuse, vUv); vec2 d = vUv - .5; float v = smoothstep(.9, .28, length(d * vec2(1.05, 1.2)));
      c.rgb *= mix(.28, 1., v); c.rgb += (h(vUv * 900. + uTime) - .5) * .028; c.rgb = mix(c.rgb, c.rgb * vec3(1.05, .98, .9), .5);
      c.rgb = mix(c.rgb, c.rgb * vec3(1.25, .55, .5), uRed * .7); gl_FragColor = c; }`,
});
composer.addPass(grain);
composer.addPass(new OutputPass());
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h; BASE_FOV = w / h < 1 ? 70 : w / h < 1.4 ? 60 : 54; camera.fov = BASE_FOV; camera.updateProjectionMatrix();
  renderer.setSize(w, h, false); composer.setSize(w, h); bloom.setSize(w, h);
}
window.addEventListener('resize', resize);
let last = performance.now(), BASE_FOV = 54;
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000), t = now / 1000; last = now;
  runTweens(now);
  camTargets(t);
  const k = 1 - Math.exp(-dt * 2.6);
  CAM.pos.lerp(CAM.tp, k); CAM.look.lerp(CAM.tl, k);
  const shared = S.phase !== 'lobby' && !S.firstPerson, wantFov = shared && (S.cam.kind === 'home') ? BASE_FOV + 8 : BASE_FOV;
  if (Math.abs(camera.fov - wantFov) > .05) { camera.fov += (wantFov - camera.fov) * k; camera.updateProjectionMatrix(); }
  if (dealerCh) dealerCh.group.visible = !shared || CAM.pos.z > -.6;
  mouse.sx += (mouse.x - mouse.sx) * (1 - Math.exp(-dt * 3)); mouse.sy += (mouse.y - mouse.sy) * (1 - Math.exp(-dt * 3));
  const par = S.firstPerson && S.phase !== 'lobby' ? 1 : .25;
  camera.position.set(CAM.pos.x + mouse.sx * .08 * par, CAM.pos.y + Math.sin(t * 1.1) * .004 - mouse.sy * .03 * par, CAM.pos.z);
  camera.lookAt(CAM.look.x + mouse.sx * .6 * par, CAM.look.y - mouse.sy * .35 * par, CAM.look.z);
  for (const f of flames) {
    const n = Math.sin(t * 13 + f.seed) * .5 + Math.sin(t * 23.7 + f.seed * 2) * .3 + Math.sin(t * 5.3 + f.seed) * .2;
    f.flame.scale.set(1 + n * .08, 2.2 + n * .35, 1 + n * .08); if (f.light) f.light.intensity = f.base * (1 + n * .18);
  }
  if (dust) { dust.rotation.y = t * .015; dust.position.y = Math.sin(t * .3) * .02; }
  redNow += (S.red - redNow) * (1 - Math.exp(-dt * 3)); spot.color.copy(WARM).lerp(HELL, redNow); grain.uniforms.uRed.value = redNow;
  const focusPt = S.focus ? cardSpot(S.focus.p, S.focus.hi, 0) : null, dealerPt = tmpV.set(0, TH, TZ + .4).clone();
  for (const p of S.players) if (p.ch) {
    const ch = p.ch; ch.t += dt; if (ch.spin) ch.spin.rotation.y += dt * 16; ch.group.children[0].scale.y = 1 + Math.sin(ch.t * 1.6) * .008;
    const gz = S.gaze.get(p.pid);
    let tgt;
    if (gz && now < gz.until) tgt = gz.at;
    else if (S.phase === 'lobby' || S.ended) tgt = camera.position;
    else if (!p.alive) tgt = null;
    else if (S.turn === 'dealer') tgt = dealerPt;
    else if (focusPt) tgt = focusPt;
    else tgt = p.hands.length ? cardSpot(p, 0, 0) : dealerPt;
    aim(ch, tgt, dt, p.alive ? 0 : .55);
    updateArms(ch);
  }
  if (dealerCh) { aim(dealerCh, S.phase === 'lobby' ? camera.position : focusPt || tmpV.set(0, TH, TZ + 1.2), dt); updateArms(dealerCh); }
  grain.uniforms.uTime.value = t % 100;
  if (!TEST.norender) composer.render();
  updateLabels();
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- avvio
(async () => {
  try { await Promise.race([Promise.all([document.fonts.load('400 40px "IM Fell English SC"'), document.fonts.load('700 60px "Cormorant Garamond"')]), new Promise(r => setTimeout(r, 3000))]); } catch (e) { /* font di riserva */ }
  buildMaterials(); makeBackTex(); buildChipMats();
  buildRoom(); buildTable(); buildLights(); buildShoe(); buildRack();
  { const fill = new THREE.PointLight(0xffb878, 5, 6, 2); fill.position.set(0, 2.3, 1.9); scene.add(fill); }
  dealerCh = makeCharacter(CROUPIER, { standing: true }); dealerCh.group.position.set(0, .18, TZ - .5); dealerCh.group.rotation.y = Math.PI; scene.add(dealerCh.group);
  resize(); updateShoeVisual(); wireLobby(); wireBar();
  $('#lobby').hidden = false; openRoom(); renderLobby();
  camTargets(0); CAM.pos.copy(CAM.tp); CAM.look.copy(CAM.tl);
  requestAnimationFrame(frame);
  setTimeout(() => $('#loader').classList.add('gone'), 400);
  if (TEST.debug) { window.__start = startGame; window.__add = addPlayer; window.__BOTS = BOTS; window.__accuse = accuse; window.__net = () => NET; window.__cam = (kind, i) => { S.cam = { kind, p: S.players[i] }; camTargets(0); CAM.pos.copy(CAM.tp); CAM.look.copy(CAM.tl); }; window.__ready = true; }
})();

// ================================================================ DUBITO (il gioco dei bugiardi, con la pistola)
const JOKER = 100, DRANK = { 12: ['Re', 'Re'], 11: ['Regina', 'Regine'], 0: ['Asso', 'Assi'] };
const PILE = new THREE.Vector3(0, TH + .002, TZ + .8);
let jokerTexture = null, pistol = null;
function makeDubCard(c) {
  if (c !== JOKER) return makeCard(c);
  if (!jokerTexture) jokerTexture = canvasTex(320, 448, (g, w, h) => {
    paperBase(g, w, h); g.strokeStyle = 'rgba(110,40,30,.55)'; g.lineWidth = 2; roundRect(g, 14, 14, w - 28, h - 28, 14); g.stroke();
    const cols = ['#a3201c', '#1f5a3a', '#c9a050'];
    [[-1, 0], [1, 1], [0, 2]].forEach(([dx, k]) => { g.fillStyle = cols[k]; g.beginPath(); g.moveTo(w / 2 + dx * 20, 230); g.quadraticCurveTo(w / 2 + dx * 90, 120 - (dx ? 0 : 40), w / 2 + dx * 96, 170 - (dx ? 0 : 90)); g.quadraticCurveTo(w / 2 + dx * 40 + 30, 170, w / 2 + dx * 20 + 44, 230); g.fill(); g.fillStyle = '#c9a050'; g.beginPath(); g.arc(w / 2 + dx * 96, 170 - (dx ? 0 : 90), 12, 0, 7); g.fill(); });
    g.fillStyle = '#f6edd6'; g.strokeStyle = '#1d140e'; g.lineWidth = 3; g.beginPath(); g.ellipse(w / 2 + 12, 270, 54, 60, 0, 0, 7); g.fill(); g.stroke();
    g.fillStyle = '#1d140e'; for (const s of [-1, 1]) { g.beginPath(); g.arc(w / 2 + 12 + s * 20, 258, 6, 0, 7); g.fill(); } g.strokeStyle = '#a3201c'; g.lineWidth = 5; g.beginPath(); g.arc(w / 2 + 12, 276, 26, .15 * Math.PI, .85 * Math.PI); g.stroke();
    g.fillStyle = '#1d140e'; g.font = '400 40px "IM Fell English SC", Georgia, serif'; g.textAlign = 'center'; g.fillText('JOLLY', w / 2, 400);
  });
  const grp = new THREE.Group(), f = new THREE.Mesh(cardGeoF, new THREE.MeshStandardMaterial({ map: jokerTexture, color: 0xcfc6b4, roughness: .75, alphaTest: .5 })), b = new THREE.Mesh(cardGeoB, backMat());
  b.position.y = -.0004; f.castShadow = b.castShadow = true; grp.add(f, b); scene.add(grp); return grp;
}
function getPistol() {
  if (pistol) return pistol;
  const g = new THREE.Group(), steel = new THREE.MeshStandardMaterial({ color: 0x2b2d33, roughness: .35, metalness: .8 });
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(.012, .015, .22, 10).rotateX(Math.PI / 2), steel); barrel.position.set(0, .03, -.13);
  const body = new THREE.Mesh(new THREE.BoxGeometry(.03, .04, .11), M.darkwood); body.position.set(0, .024, -.04);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(.03, .1, .042), M.darkwood); grip.position.set(0, -.03, .02); grip.rotation.x = .45;
  const guard = new THREE.Mesh(new THREE.TorusGeometry(.02, .004, 6, 14), M.gold); guard.position.set(0, -.004, -.04); guard.rotation.y = Math.PI / 2;
  const cock = new THREE.Mesh(new THREE.BoxGeometry(.008, .035, .012), M.gold); cock.position.set(0, .06, .005); cock.rotation.x = -.5;
  g.add(barrel, body, grip, guard, cock); g.visible = false; scene.add(g); return pistol = g;
}
const fanSpot = (p, i, n) => tablePt(isMe(p) ? 1.56 : 1.45, p.a).addScaledVector(seatRight(p), (i - (n - 1) / 2) * .052).setY(TH + .002 + i * .0009);
const nextAlive = p => { const o = order(); let i = o.indexOf(p); for (let k = 0; k < o.length; k++) { i = (i + 1) % o.length; if (o[i].alive) return o[i]; } return p; };
function dubClear() { const D = S.D; if (!D) return; D.objs.forEach(o => scene.remove(o)); D.objs = []; dropLabel(D.tag); D.tag = null; for (const p of S.players) { p.hand = []; p.hobjs = []; } if (pistol) pistol.visible = false; }
function startDubito() {
  SFX.unlock();
  for (const p of S.players) Object.assign(p, { alive: true, lives: 2, loans: 0, chips: 0, hands: [], inRound: false, prompt: null, hand: [], hobjs: [], pulls: 0, bullet: rnd(6), side: null, peek: null });
  Object.assign(S, { phase: 'game', hand: 0, minBet: 10, banker: null, outOrder: [], ended: false, abort: false, rank: null, stage: 'dub', turn: null, focus: null, accOpen: false, D: { round: 0, rank: 12, last: null, pileN: 0, objs: [], tag: null, reveal: null } });
  S.editing = null; renderEditor(); layoutSeats(); showBankMark(null);
  $('#lobby').hidden = true; $('#end').hidden = true; $('#hud').hidden = false; $('#endBtn').textContent = 'Termina partita';
  renderHUD(); pushState(); dubLoop();
}
async function dubLoop() {
  const gen = ++S.gen; let starter = alive()[0];
  while (gen === S.gen) {
    const loser = await dubRound(starter); if (gen !== S.gen) return;
    const a = alive();
    if (a.length <= 1 || S.abort || !a.some(p => p.kind !== 'bot')) break;
    starter = loser.alive ? loser : nextAlive(loser);
    await wait(900);
  }
  if (gen === S.gen) endGame();
}
async function dubRound(starter) {
  const D = S.D; dubClear(); D.round++; S.hand = D.round; D.rank = [12, 11, 0][rnd(3)]; D.last = null; D.pileN = 0; D.reveal = null;
  const A = alive(), n = A.length, per = n <= 4 ? 6 : n === 5 ? 8 : 9, deck = [];
  for (const r of [12, 11, 0]) for (let i = 0; i < per; i++) deck.push(r + 13 * (i % 4));
  for (let i = 0; i < (n <= 5 ? 2 : 3); i++) deck.push(JOKER);
  for (let i = deck.length - 1; i > 0; i--) { const j = rnd(i + 1), t = deck[i]; deck[i] = deck[j]; deck[j] = t; }
  S.turn = null; S.cam = { kind: 'home' };
  setStatus(`Giro ${D.round}. La carta del tavolo è: ${DRANK[D.rank][0]}. Chi viene scoperto a mentire preme il grilletto.`);
  D.tag = makeLabel('tag gold', `TAVOLO: ${DRANK[D.rank][1].toUpperCase()}`, () => tmpV.set(0, TH + .14, TZ + .42));
  for (let k = 0; k < 5; k++) for (const p of A) {
    const c = deck.pop(), o = makeDubCard(c); p.hand.push(c); p.hobjs.push(o); D.objs.push(o);
    o.position.copy(SHOE_MOUTH); o.rotation.set(0, yawOf(p), Math.PI); SFX.card(); flyTo(o, fanSpot(p, k, 5), 300, { lift: .08 }); await wait(70);
  }
  await wait(900); pushState();
  let cur = starter.alive ? starter : nextAlive(starter);
  for (;;) {
    const holders = alive().filter(p => p.hand.length);
    if (!cur.hand.length && holders.length) { cur = nextAlive(cur); continue; }
    const canCall = !!D.last && D.last.p !== cur, must = canCall && holders.length <= 1;
    S.turn = cur; S.cam = { kind: 'seat', p: cur };
    setStatus(must ? `${cur.name} è l'ultimo con le carte in mano: deve dubitare.` : `Tocca a ${cur.name}.`);
    let v;
    if (must || !cur.hand.length) { await wait(1300); v = { call: true }; }
    else v = await ask(cur, 'dub', { hand: cur.hand.slice(), rank: D.rank, canCall, lastN: D.last ? D.last.cards.length : 0, lastEmpty: !!(D.last && !D.last.p.hand.length) }, { canCall }, 30000, () => ({ play: [0] }));
    if (v.call && D.last) { const loser = await dubCall(cur); await dubPistol(loser); return loser; }
    const idx = (v.play || [0]).slice().sort((x, y) => y - x), cards = [], objs = [];
    for (const i of idx) { cards.push(cur.hand.splice(i, 1)[0]); objs.push(cur.hobjs.splice(i, 1)[0]); }
    objs.forEach((o, j) => { SFX.card(); flyTo(o, PILE.clone().add(new THREE.Vector3((Math.random() - .5) * .14, (D.pileN + j) * .0012, (Math.random() - .5) * .1)), 420, { lift: .1, yaw: Math.random() * 6 }); });
    D.pileN += cards.length; D.last = { p: cur, cards, objs };
    cur.hobjs.forEach((o, i) => flyTo(o, fanSpot(cur, i, cur.hobjs.length), 250, { lift: .01 }));
    const word = `${cards.length === 1 ? (D.rank === 11 ? 'Una' : 'Un') : ['', '', 'Due', 'Tre'][cards.length]} ${DRANK[D.rank][cards.length > 1 ? 1 : 0]}.`;
    if (cur.ch) say(cur, word, cur.hand.length ? '' : 'ha finito le carte', false, 2000);
    setStatus(`${cur.name} gioca ${cards.length === 1 ? 'una carta coperta' : cards.length + ' carte coperte'} e dichiara: ${word}`);
    pushState(); await wait(1400);
    cur = nextAlive(cur);
  }
}
async function dubCall(caller) {
  const D = S.D, L = D.last; SFX.gong(); S.turn = null;
  setStatus(`${caller.name} dubita di ${L.p.name}!`); if (caller.ch) say(caller, 'Dubito!', '', true, 2400);
  S.cam = { kind: 'pile' }; await wait(1500);
  L.objs.forEach((o, j) => { SFX.flip(); flyTo(o, PILE.clone().add(new THREE.Vector3((j - (L.objs.length - 1) / 2) * .11, .05, -.12)), 500, { lift: .12, yaw: Math.PI, flip: 0 }); });
  await wait(1200);
  const lie = L.cards.some(c => c !== JOKER && BJ.rankOf(c) !== D.rank), loser = lie ? L.p : caller;
  D.reveal = { cards: L.cards.slice(), lie, liar: L.p.name, caller: caller.name };
  setStatus(lie ? `${L.p.name} mentiva! Il grilletto tocca a lui.` : `${L.p.name} diceva la verità. Il grilletto tocca a ${caller.name}.`);
  if (L.p.ch) say(L.p, lie ? 'Accidenti…' : 'Visto? Onesto.', '', lie, 2400);
  if (lie) SFX.lose(); else SFX.win();
  pushState(); await wait(2800); return loser;
}
async function dubPistol(p) {
  const g = getPistol(); S.cam = p.ch ? { kind: 'seat', p } : { kind: 'home' }; S.turn = p;
  setStatus(`${p.name} prende la pistola. Colpo ${p.pulls + 1} di 6…`);
  let arm = null, from, to;
  if (p.ch) { arm = p.ch.arms[1]; from = arm.hand.clone(); to = new THREE.Vector3(.21, 1.4, -.1); arm.glove.add(g); g.visible = true; g.position.set(-.02, .06, .0); g.rotation.set(.2, Math.PI / 2, 0); await tween(800, e => arm.hand.lerpVectors(from, to, e)); }
  for (let i = 0; i < 4; i++) { SFX.tick(); await wait(430); }
  const fired = p.pulls === p.bullet; p.pulls++;
  if (fired) { SFX.bang(); S.red = 1; setTimeout(() => { S.red = 0; }, 600); } else SFX.click();
  await wait(fired ? 350 : 800);
  if (arm) { g.visible = false; scene.add(g); tween(500, e => arm.hand.lerpVectors(to, arm.rest, e)); }
  if (fired) await eliminate(p, 'Il colpo parte:');
  else { setStatus(`Clic. ${p.name} è salvo, per ora: ${p.pulls} ${p.pulls === 1 ? 'colpo tirato' : 'colpi tirati'} su 6.`); if (p.ch) say(p, 'Fiuu…', '', false, 2200); pushState(); await wait(2000); }
}
