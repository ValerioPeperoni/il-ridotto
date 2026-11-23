// Personaggi "sportivi" (stile Switch Sports): Universal Base Characters di Quaternius (CC0) + Universal Animation Library 1 e 2.
// Vestiti sportivi colorati senza modelli in più: ogni vertice sa a quale osso appartiene (maglia, pantaloncini, scarpe).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const DIR = 'assets/sport/';
export const SKINS = ['#f3d2b8', '#e8b796', '#c98f68', '#a46a46', '#7a4a2e', '#4e2f1e'];
export const HAIR_COLORS = ['#2a1a12', '#5a3420', '#9a6a3a', '#d8b06a', '#c44a2a', '#e8e4dc', '#3a3a44', '#ff5c9a'];
export const HAIRS = { none: 'Nessuno', short: 'Corti', spiky: 'A punta', bob: 'Caschetto', ponytail: 'Coda', buns: 'Chignon', afro: 'Afro', long: 'Lunghi' };
const OLD_HAIR = { SimpleParted: 'short', Buzzed: 'short', Long: 'long', Buns: 'buns', BuzzedFemale: 'bob' };
export const KIT = ['#3d7bff', '#ff5c9a', '#ffcf3a', '#2ec27e', '#9a5cff', '#ff6a3d', '#1d2340', '#f4f6fb', '#20c4d8', '#e8243c'];
export const DEFAULT_SPORT = { body: 'M', skin: 1, hair: 'short', hairColor: 1, beard: false, shirt: '#3d7bff', shorts: '#1d2340', shoes: '#f4f6fb' };

let LIB = null;
const EXTRA = ['Golf_Drive', 'Golf_Drive_B'];
export async function loadSportLibrary(onProgress) {
  if (LIB) return LIB;
  const ld = new GLTFLoader();
  const files = { M: 'Superhero_Male_FullBody.gltf', F: 'Superhero_Female_FullBody.gltf', ual1: 'ual1.glb', ual2: 'ual2.glb' };
  files.hair_Beard = 'Hair_Beard.gltf';
  const out = {}; let n = 0; const keys = Object.keys(files);
  await Promise.all(keys.map(async k => { out[k] = await ld.loadAsync(DIR + files[k]); onProgress && onProgress(++n / keys.length); }));
  const clips = {};
  for (const k of ['ual1', 'ual2']) for (const c of out[k].animations) clips[c.name] = c;
  // animazioni da Mixamo già adattate al nostro scheletro (vedi sviluppo/tools/retarget.html)
  await Promise.all(EXTRA.map(async n => { try { const j = await (await fetch(DIR + n + '.json')).json(); clips[n] = THREE.AnimationClip.parse(j); } catch (e) { } }));
  // personaggi stilizzati costruiti con sviluppo/charbuild (stesso scheletro)
  try { out.sm = await (await fetch(DIR + 'sportsmates.json')).json(); } catch (e) { out.sm = null; }
  LIB = { src: out, clips };
  return LIB;
}
export function sportClips() { return LIB ? LIB.clips : {}; }

// classificazione dei vertici: 0 pelle, 1 maglia, 2 pantaloncini, 3 scarpe
const SHIRT = /spine|clavicle|upperarm|neck/i, SHORTS = /pelvis|thigh/i, SHOES = /foot|ball/i;
function regionAttribute(mesh) {
  const g = mesh.geometry; if (g.attributes.aOutfit) return;
  const si = g.attributes.skinIndex, sw = g.attributes.skinWeight, bones = mesh.skeleton.bones, n = si.count;
  const arr = new Float32Array(n * 3);
  const pos = g.attributes.position;
  for (let i = 0; i < n; i++) {
    let best = 0, bw = -1; for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > bw) { bw = w; best = si.getComponent(i, k); } }
    const name = bones[best] ? bones[best].name : '';
    if (SHOES.test(name)) arr[i * 3 + 2] = 1;
    else if (SHORTS.test(name)) arr[i * 3 + 1] = 1;
    else if (SHIRT.test(name) && !/neck/i.test(name)) arr[i * 3] = 1;
    else if (/neck/i.test(name) && pos.getY(i) < 1.42) arr[i * 3] = 1; // il colletto
  }
  g.setAttribute('aOutfit', new THREE.BufferAttribute(arr, 3));
}
function outfitMaterial(src, look) {
  const m = src.clone();
  const U = { uShirt: { value: new THREE.Color(look.shirt) }, uShorts: { value: new THREE.Color(look.shorts) }, uShoes: { value: new THREE.Color(look.shoes) }, uSkin: { value: new THREE.Color(SKINS[look.skin] || SKINS[1]) } };
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 aOutfit; varying vec3 vOutfit;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvOutfit = aOutfit; transformed += objectNormal * (aOutfit.x * 0.018 + aOutfit.y * 0.012 + aOutfit.z * 0.02); // stoffa un po\' staccata dal corpo');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vOutfit; uniform vec3 uShirt, uShorts, uShoes, uSkin;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        vec3 skin = uSkin * (0.55 + lum * 1.25);
        float sh = smoothstep(0.35, 0.65, vOutfit.x), pa = smoothstep(0.35, 0.65, vOutfit.y), sc = smoothstep(0.35, 0.65, vOutfit.z);
        vec3 col = skin;
        col = mix(col, uShirt * (0.9 + lum * 0.18), sh);
        col = mix(col, uShorts * (0.9 + lum * 0.18), pa);
        col = mix(col, uShoes * (0.85 + lum * 0.3), sc);
        diffuseColor.rgb = col;`)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n float clothW = max(max(smoothstep(0.35,0.65,vOutfit.x), smoothstep(0.35,0.65,vOutfit.y)), smoothstep(0.35,0.65,vOutfit.z)); normal = normalize(mix(normal, nonPerturbedNormal, clothW * 0.85));')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = mix(roughnessFactor, 0.85, max(max(smoothstep(0.35,0.65,vOutfit.x), smoothstep(0.35,0.65,vOutfit.y)), smoothstep(0.35,0.65,vOutfit.z)));');
  };
  m.customProgramCacheKey = () => 'outfit';
  m.userData.U = U;
  return m;
}
function tintMaterial(src, color) {
  const m = src.clone(); const U = { uTint: { value: new THREE.Color(color) } };
  m.onBeforeCompile = sh => { sh.uniforms.uTint = U.uTint; sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uTint;').replace('#include <map_fragment>', '#include <map_fragment>\n float l2 = dot(diffuseColor.rgb, vec3(0.299,0.587,0.114)); diffuseColor.rgb = uTint * (0.35 + l2 * 1.6);'); };
  m.customProgramCacheKey = () => 'tint'; m.userData.U = U; return m;
}

// ---------- personaggi stilizzati (testa grande, faccia disegnata, vestiti veri) ----------
const b64 = (s, T) => { const bin = atob(s), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return new T(u8.buffer); };
const GEO = new Map();
function smGeo(key, d) {
  if (GEO.has(key)) return GEO.get(key);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(b64(d.pos, Float32Array), 3));
  g.setIndex(new THREE.BufferAttribute(b64(d.idx, Uint16Array), 1));
  g.setAttribute('skinIndex', new THREE.BufferAttribute(new Uint16Array(b64(d.si, Uint8Array)), 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(new Float32Array(b64(d.sw, Uint8Array)).map(x => x / 255), 4));
  // zone come pesi separati (si interpolano bene sui triangoli di confine): maglia, pantaloncini, scarpe | suola, bordino
  { const r = b64(d.reg, Uint8Array), a = new Float32Array(r.length * 3), b = new Float32Array(r.length * 2);
    for (let i = 0; i < r.length; i++) { const k = r[i]; if (k >= 1 && k <= 3) a[i * 3 + k - 1] = 1; else if (k === 4) b[i * 2] = 1; else if (k === 5) b[i * 2 + 1] = 1; }
    g.setAttribute('aR1', new THREE.BufferAttribute(a, 3)); g.setAttribute('aR2', new THREE.BufferAttribute(b, 2)); }
  if (d.lim) g.setAttribute('aLim', new THREE.BufferAttribute(b64(d.lim, Float32Array), 2));
  else g.setAttribute('aLim', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2).fill(3), 2));
  if (d.uv) g.setAttribute('uv', new THREE.BufferAttribute(b64(d.uv, Float32Array), 2));
  g.computeVertexNormals(); g.computeBoundingSphere();
  GEO.set(key, g); return g;
}
// materiale "da cartone curato": colori per zona (pelle, maglia, pantaloncini, scarpe, suola), luce di contorno morbida
function smMaterial(look, opts = {}) {
  const U = { uSkin: { value: new THREE.Color(SKINS[look.skin] || SKINS[1]) }, uShirt: { value: new THREE.Color(look.shirt) }, uShorts: { value: new THREE.Color(look.shorts) }, uShoes: { value: new THREE.Color(look.shoes) }, uSole: { value: new THREE.Color(0xf7f6f2) }, uTrim: { value: new THREE.Color(look.trim || '#ffffff') }, uRim: { value: opts.rim ?? 0.35 } };
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.62, map: opts.map || null });
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 aR1; attribute vec2 aR2; attribute vec2 aLim; varying vec3 vR1; varying vec2 vR2; varying vec2 vLim;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvR1 = aR1; vR2 = aR2; vLim = aLim;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vR1; varying vec2 vR2; varying vec2 vLim; uniform vec3 uSkin, uShirt, uShorts, uShoes, uSole, uTrim; uniform float uRim;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec3 w1 = step(0.5, vR1); vec2 w2 = step(0.5, vR2);
        // orli netti: maniche, pantaloncini, girovita e colletto decisi pixel per pixel lungo le ossa
        float kind = floor(vLim.x + 0.5), t = vLim.y;
        if (abs(vLim.x - kind) > 0.02) { w2.y = 0.0; kind = 9.0; } // confine tra due parti del corpo: niente orli
        if (kind < 0.5) { if (t > 9.0) { float y = t - 10.0; w1 = vec3(step(y, 1.512), 0.0, 0.0); w2 = vec2(0.0, step(y, 1.528) * (1.0 - step(y, 1.512))); }
          else { w1 = vec3(step(1.0361, t), step(t, 1.0201), 0.0); w2 = vec2(0.0, step(1.0201, t) * step(t, 1.0361)); } }
        else if (kind < 1.5) { w1 = vec3(step(t, 0.44), 0.0, 0.0); w2 = vec2(0.0, step(0.44, t) * step(t, 0.485)); }
        else if (kind < 2.5) { w1 = vec3(0.0, step(t, 0.56), 0.0); w2 = vec2(0.0, step(0.56, t) * step(t, 0.605)); }
        vec3 rc = uSkin; rc = mix(rc, uShirt, w1.x); rc = mix(rc, uShorts, w1.y); rc = mix(rc, uShoes, w1.z); rc = mix(rc, uSole, w2.x); rc = mix(rc, uTrim, w2.y);
        float cloth = max(max(w1.x, w1.y), w2.y);
        ${opts.map ? '' : 'diffuseColor.rgb = rc;'}`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = mix(roughnessFactor, 0.85, cloth);')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        { float fr = pow(1.0 - clamp(dot(normalize(vViewPosition), -normal) * -1.0 + 0.0, 0.0, 1.0), 3.0); totalEmissiveRadiance += diffuseColor.rgb * fr * uRim; }`);
  };
  m.customProgramCacheKey = () => 'sm' + (opts.map ? 'm' : '');
  m.userData.U = U; return m;
}
// faccia disegnata (occhi grandi con riflesso, sopracciglia, bocca, guance): una tela per personaggio
function faceCanvas(look, mode = 'open') {
  const W = 1024, H = 512, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  g.fillStyle = SKINS[look.skin] || SKINS[1]; g.fillRect(0, 0, W, H);
  const P = (u, v) => [u * W, (1 - v) * H];
  const hair = HAIR_COLORS[look.hairColor] || HAIR_COLORS[1], dark = look.skin >= 4;
  // guance
  for (const s of [-1, 1]) { const [x, y] = P(0.5 + s * 0.085, 0.405); const gr = g.createRadialGradient(x, y, 2, x, y, 34); gr.addColorStop(0, 'rgba(255,110,110,0.35)'); gr.addColorStop(1, 'rgba(255,110,110,0)'); g.fillStyle = gr; g.fillRect(x - 40, y - 40, 80, 80); }
  for (const s of [-1, 1]) {
    const [x, y] = P(0.5 + s * 0.052, 0.475);
    if (mode === 'open') {
      g.fillStyle = '#1b1420'; g.beginPath(); g.ellipse(x, y, 25, 37, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#4b3b63'; g.beginPath(); g.ellipse(x, y + 11, 18, 19, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.ellipse(x - 7 * s, y - 14, 9, 11.5, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(x + 7 * s, y + 14, 4, 0, Math.PI * 2); g.fill();
    } else { g.strokeStyle = '#1b1420'; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.arc(x, y - 8, 23, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); }
    // sopracciglia
    const [bx, by] = P(0.5 + s * 0.058, 0.615); g.strokeStyle = hair; g.lineWidth = 11; g.lineCap = 'round'; g.beginPath(); g.moveTo(bx - 20, by + 4); g.quadraticCurveTo(bx, by - 7, bx + 20, by + 4); g.stroke();
  }
  // bocca: sorriso morbido
  const [mx, my] = P(0.5, 0.34); g.strokeStyle = dark ? '#3a1a1a' : '#8a3a3a'; g.lineWidth = 7; g.lineCap = 'round';
  if (mode === 'happy') { g.fillStyle = '#7a2a2a'; g.beginPath(); g.arc(mx, my - 6, 24, 0.02 * Math.PI, 0.98 * Math.PI); g.closePath(); g.fill(); g.fillStyle = '#ff8a8a'; g.beginPath(); g.ellipse(mx, my + 10, 11, 6, 0, 0, Math.PI * 2); g.fill(); }
  else { g.beginPath(); g.arc(mx, my - 14, 22, 0.22 * Math.PI, 0.78 * Math.PI); g.stroke(); }
  return c;
}
function buildStylized(rig, bones, look, opts) {
  const D = LIB.src.sm[look.body === 'F' ? 'F' : 'M'];
  let skel = null, bind = null;
  rig.traverse(o => { if (o.isSkinnedMesh && !skel) { skel = o.skeleton; bind = o.bindMatrix; } });
  const hide = []; rig.traverse(o => { if (o.isSkinnedMesh) hide.push(o); }); hide.forEach(o => { o.visible = false; });
  const mat = smMaterial(look), meshes = [];
  const add = (key, d, m) => { const sm = new THREE.SkinnedMesh(smGeo(key, d), m); sm.bind(skel, bind); sm.castShadow = true; sm.receiveShadow = !!opts.receiveShadow; sm.frustumCulled = false; rig.add(sm); meshes.push(sm); return sm; };
  const B = look.body === 'F' ? 'F' : 'M';
  add(B + 'body', D.body, mat); add(B + 'shoes', D.shoes, mat); add(B + 'hR', D.handR, mat); add(B + 'hL', D.handL, mat);
  // testa con la faccia: tre tele (aperti, chiusi, felice) per sbattere le palpebre ed esultare
  const faces = { open: new THREE.CanvasTexture(faceCanvas(look, 'open')), closed: new THREE.CanvasTexture(faceCanvas(look, 'closed')), happy: new THREE.CanvasTexture(faceCanvas(look, 'happy')) };
  for (const t of Object.values(faces)) { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; }
  const hm = smMaterial(look, { map: faces.open, rim: 0.25 }); hm.roughness = 0.55;
  add(B + 'head', D.head, hm);
  const hk = OLD_HAIR[look.hair] || look.hair;
  if (look.beard && LIB.src.sm.hair.beard) add('hair_beard', LIB.src.sm.hair.beard, new THREE.MeshStandardMaterial({ color: HAIR_COLORS[look.hairColor] || HAIR_COLORS[1], roughness: 0.7 }));
  if (hk && hk !== 'none' && LIB.src.sm.hair[hk]) { const hmat = new THREE.MeshStandardMaterial({ color: HAIR_COLORS[look.hairColor] || HAIR_COLORS[1], roughness: 0.55 }); add('hair_' + hk, LIB.src.sm.hair[hk], hmat); }
  return { mat, faces, headMat: hm, meshes };
}

// Crea un personaggio. height in metri (il modello originale è ~1.8)
export function makeSportsmate(look = DEFAULT_SPORT, opts = {}) {
  if (!LIB) throw new Error('loadSportLibrary prima');
  look = { ...DEFAULT_SPORT, ...look };
  if (LIB.src.sm && !opts.classic) return makeStylized(look, opts);
  const root = new THREE.Group();
  const rig = SkeletonUtils.clone(LIB.src[look.body === 'F' ? 'F' : 'M'].scene);
  root.add(rig);
  const bones = {}; rig.traverse(o => { if (o.isBone) bones[o.name] = o; });
  let body = null;
  rig.traverse(o => {
    if (!o.isSkinnedMesh) return;
    o.castShadow = true; o.receiveShadow = !!opts.receiveShadow; o.frustumCulled = false;
    if (/Superhero/i.test(o.name)) { body = o; regionAttribute(o); o.material = outfitMaterial(o.material, look); }
    else if (/Eyebrows/i.test(o.name)) o.material = tintMaterial(o.material, HAIR_COLORS[look.hairColor] || HAIR_COLORS[1]);
  });
  const extras = [];
  function attachHair(key) {
    const src = LIB.src['hair_' + key]; if (!src) return;
    src.scene.traverse(o => {
      if (!o.isSkinnedMesh) return;
      const m = new THREE.SkinnedMesh(o.geometry, tintMaterial(o.material, HAIR_COLORS[look.hairColor] || HAIR_COLORS[1]));
      m.bind(new THREE.Skeleton(o.skeleton.bones.map(b => bones[b.name]), o.skeleton.boneInverses), o.bindMatrix);
      m.castShadow = true; m.frustumCulled = false; rig.add(m); extras.push(m);
    });
  }
  if (look.hair && look.hair !== 'none') attachHair(look.hair);
  if (look.beard) attachHair('Beard');
  // scarpe da ginnastica vere (tomaia colorata + suola bianca), agganciate alle ossa dei piedi nella posa di riposo
  rig.updateMatrixWorld(true);
  const shoeMat = new THREE.MeshStandardMaterial({ color: look.shoes, roughness: 0.6 }), soleMat = new THREE.MeshStandardMaterial({ color: 0xf6f6f2, roughness: 0.7 });
  const lace = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
  for (const sd of ['l', 'r']) {
    const foot = bones['foot_' + sd], ball = bones['ball_' + sd]; if (!foot || !ball) continue;
    const pf = foot.getWorldPosition(new THREE.Vector3()), pb = ball.getWorldPosition(new THREE.Vector3());
    const dir = pb.clone().sub(pf); dir.y = 0; const len = Math.max(0.1, dir.length()); dir.normalize();
    const g = new THREE.Group();
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.046, 0.15, 6, 14), shoeMat); upper.rotation.x = Math.PI / 2; upper.scale.set(1.08, 1, 0.8); upper.position.set(0, 0.045, 0.02); g.add(upper);
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.104, 0.028, 0.27), soleMat); sole.position.set(0, 0.014, 0.02); g.add(sole);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.012, 0.08), lace); strip.position.set(0, 0.088, 0.04); strip.rotation.x = -0.25; g.add(strip);
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
    // posizione nel mondo: tallone sotto la caviglia, punta verso le dita
    const center = pf.clone().addScaledVector(dir, len * 0.35); center.y = 0;
    const W = new THREE.Matrix4().compose(center, new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir), new THREE.Vector3(1, 1, 1));
    const local = foot.matrixWorld.clone().invert().multiply(W);
    local.decompose(g.position, g.quaternion, g.scale);
    foot.add(g); extras.push(g);
  }
  if (body) body.material.userData.shoeMat = shoeMat;
  if (opts.height) { root.scale.setScalar(opts.height / 1.8); }
  const mixer = new THREE.AnimationMixer(rig);
  let current = null;
  const av = { root, rig, bones, mixer, look, body };
  av.play = (name, o = {}) => {
    name = ALIAS[name] || name; if (o.then) o = { ...o, then: ALIAS[o.then] || o.then };
    const clip = LIB.clips[name]; if (!clip) return null;
    const a = mixer.clipAction(clip);
    if (o.solo) { mixer.stopAllAction(); current = null; }
    a.reset(); a.setLoop(o.once ? THREE.LoopOnce : THREE.LoopRepeat); a.clampWhenFinished = !!o.once; a.timeScale = o.speed || 1;
    if (current && current !== a) a.crossFadeFrom(current, o.fade ?? 0.25, false);
    a.play(); current = a;
    if (o.once && o.then) { const h = e => { if (e.action === a) { mixer.removeEventListener('finished', h); av.play(o.then, { fade: 0.3 }); } }; mixer.addEventListener('finished', h); }
    return a;
  };
  av.update = dt => mixer.update(dt);
  av.setColors = c => { const U = body && body.material.userData.U; if (!U) return; if (c.shirt) U.uShirt.value.set(c.shirt); if (c.shorts) U.uShorts.value.set(c.shorts); if (c.shoes) { U.uShoes.value.set(c.shoes); if (body.material.userData.shoeMat) body.material.userData.shoeMat.color.set(c.shoes); } if (c.skin != null) U.uSkin.value.set(SKINS[c.skin]); };
  av.dispose = () => { root.parent && root.parent.remove(root); };
  av.play(opts.idle || 'Idle_Loop');
  return av;
}
function makeStylized(look, opts) {
  const root = new THREE.Group();
  const rig = SkeletonUtils.clone(LIB.src.M.scene); root.add(rig);
  const bones = {}; rig.traverse(o => { if (o.isBone) bones[o.name] = o; });
  const S = buildStylized(rig, bones, look, opts);
  if (opts.height) root.scale.setScalar(opts.height / 1.8);
  const mixer = new THREE.AnimationMixer(rig); let current = null;
  const av = { root, rig, bones, mixer, look, body: S.meshes[0], stylized: true };
  av.play = (name, o = {}) => {
    name = ALIAS[name] || name; if (o.then) o = { ...o, then: ALIAS[o.then] || o.then };
    const clip = LIB.clips[name]; if (!clip) return null;
    const a = mixer.clipAction(clip);
    if (o.solo) { mixer.stopAllAction(); current = null; }
    a.reset(); a.setLoop(o.once ? THREE.LoopOnce : THREE.LoopRepeat); a.clampWhenFinished = !!o.once; a.timeScale = o.speed || 1;
    if (current && current !== a) a.crossFadeFrom(current, o.fade ?? 0.25, false);
    a.play(); current = a;
    if (o.once && o.then) { const h = e => { if (e.action === a) { mixer.removeEventListener('finished', h); av.play(o.then, { fade: 0.3 }); } }; mixer.addEventListener('finished', h); }
    return a;
  };
  // sbatte le palpebre ogni tanto; av.mood('happy') per esultare
  let blinkT = 1 + Math.random() * 3, mood = 'open', moodT = 0;
  av.mood = (m, sec = 2) => { mood = m; moodT = sec; };
  av.update = dt => {
    mixer.update(dt); blinkT -= dt; if (moodT > 0) { moodT -= dt; if (moodT <= 0) mood = 'open'; }
    const want = mood !== 'open' ? S.faces[mood] : blinkT < 0 ? S.faces.closed : S.faces.open;
    if (blinkT < -0.12) blinkT = 2 + Math.random() * 3.5;
    if (S.headMat.map !== want) { S.headMat.map = want; }
  };
  av.setColors = c => { const U = S.mat.userData.U; if (c.shirt) U.uShirt.value.set(c.shirt); if (c.shorts) U.uShorts.value.set(c.shorts); if (c.shoes) U.uShoes.value.set(c.shoes); if (c.skin != null) U.uSkin.value.set(SKINS[c.skin]); };
  av.dispose = () => { root.parent && root.parent.remove(root); };
  av.play(opts.idle || 'Idle_Loop');
  return av;
}
// nomi delle animazioni dei vecchi personaggi → animazioni nuove (così i giochi funzionano con entrambi)
export const ALIAS = { Idle: 'Idle_Loop', Idle_B: 'Sword_Idle', '1H_Ranged_Aiming': 'Sword_Idle', Running_A: 'Sprint_Loop', Running_B: 'Jog_Fwd_Loop', Walking_A: 'Walk_Loop', Cheer: 'Dance_Loop',
  '1H_Melee_Attack_Slice_Horizontal': 'Sword_Regular_A', Death_A: 'Death01', Death_B: 'Hit_Knockback', Block: 'Sword_Idle', Sit_Chair_Idle: 'Sitting_Idle_Loop', Running_Strafe_Left: 'Jog_Fwd_Loop',
  Running_Strafe_Right: 'Jog_Fwd_Loop', Taunt: 'Yes', Hit_A: 'Hit_Chest', Hit_B: 'Hit_Head', Throw: 'OverhandThrow', Use_Item: 'Interact' };
export function randomSport(r = Math.random) {
  const pick = a => a[Math.floor(r() * a.length)];
  const body = r() < 0.5 ? 'M' : 'F';
  const hairs = body === 'M' ? ['SimpleParted', 'Buzzed', 'Long', 'none'] : ['Long', 'Buns', 'BuzzedFemale', 'SimpleParted'];
  const shirt = pick(KIT); let shorts = pick(KIT); if (shorts === shirt) shorts = '#1d2340';
  return { body, skin: Math.floor(r() * SKINS.length), hair: pick(hairs), hairColor: Math.floor(r() * 6), beard: body === 'M' && r() < 0.25, shirt, shorts, shoes: pick(['#f4f6fb', '#1d2340', '#ff5c9a', '#ffcf3a']) };
}
