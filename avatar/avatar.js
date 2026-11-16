// Avatar del Ridotto: personaggi KayKit (CC0) componibili. Tutti hanno lo stesso scheletro,
// quindi testa, busto, braccia, gambe, cappello, mantello e oggetto in mano si mescolano liberamente.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const BASE = new URL('../assets/avatar/', import.meta.url).href;
export const SOURCES = ['Knight', 'Barbarian', 'Mage', 'Rogue', 'Rogue_Hooded', 'Skeleton_Minion', 'Skeleton_Mage', 'Skeleton_Rogue', 'Skeleton_Warrior'];
export const NICE = { Knight: 'Cavaliere', Barbarian: 'Barbaro', Mage: 'Mago', Rogue: 'Furfante', Rogue_Hooded: 'Incappucciato', Skeleton_Minion: 'Scheletrino', Skeleton_Mage: 'Teschio mago', Skeleton_Rogue: 'Teschio ladro', Skeleton_Warrior: 'Teschio guerriero' };
export const CATS = [
  ['head', 'Testa'], ['body', 'Busto'], ['arms', 'Braccia'], ['legs', 'Gambe'], ['hat', 'Cappello'], ['cape', 'Mantello'], ['prop', 'In mano'], ['hue', 'Colore'],
];
export const HUES = [0, 0.08, 0.16, 0.33, 0.5, 0.62, 0.75, 0.88];
const PROP_NICE = { Mug: 'Boccale', '1H_Sword': 'Spada', '1H_Axe': 'Ascia', '1H_Wand': 'Bacchetta', '2H_Staff': 'Bastone', Spellbook_open: 'Libro', Knife: 'Pugnale', '1H_Crossbow': 'Balestra', Round_Shield: 'Scudo', Throwable: 'Bomba' };

let LIB = null;
export async function loadAvatarLibrary(onProgress) {
  if (LIB) return LIB;
  const loader = new GLTFLoader();
  const files = [...SOURCES, 'anims'];
  let done = 0;
  const res = await Promise.all(files.map(n => loader.loadAsync(BASE + n + '.glb').then(g => { done++; onProgress && onProgress(done / files.length); return [n, g]; })));
  const src = Object.fromEntries(res);
  const clips = Object.fromEntries(src.anims.animations.map(c => [c.name, c]));
  // catalogo dei pezzi
  const parts = { head: {}, body: {}, arms: {}, legs: {}, hat: {}, cape: {}, prop: {} };
  for (const n of SOURCES) {
    const scene = src[n].scene; const objs = {};
    scene.traverse(o => { if (o.isMesh) objs[o.name] = o; });
    const get = (...names) => names.map(x => objs[x]).filter(Boolean);
    const pre = n;
    const head = get(pre + '_Head', pre + '_Head_Hooded', 'Rogue_Head_Hooded', pre + '_Skull', pre + '_Eyes', pre + '_Jaw');
    if (n === 'Rogue_Hooded') parts.head[n] = get('Rogue_Head_Hooded'); else if (head.length) parts.head[n] = head;
    const body = get(pre + '_Body', 'Rogue_Body'); if (body.length) parts.body[n] = [body[0]];
    const arms = get(pre + '_ArmLeft', pre + '_ArmRight', 'Rogue_ArmLeft', 'Rogue_ArmRight'); if (arms.length) parts.arms[n] = arms.slice(0, 2);
    const legs = get(pre + '_LegLeft', pre + '_LegRight', 'Rogue_LegLeft', 'Rogue_LegRight'); if (legs.length) parts.legs[n] = legs.slice(0, 2);
    const hat = get(pre + '_Hat', pre + '_Helmet', pre + '_Hood'); if (hat.length) parts.hat[n] = hat;
    const cape = get(pre + '_Cape', pre + '_Cloak', 'Rogue_Cape'); if (cape.length) parts.cape[n] = [cape[0]];
    for (const k of Object.keys(PROP_NICE)) if (objs[k] && !parts.prop[k]) parts.prop[k] = [objs[k]];
  }
  LIB = { src, clips, parts };
  return LIB;
}

export function optionsFor(cat) {
  if (!LIB) return [];
  if (cat === 'hue') return HUES.map((h, i) => [i, '']);
  const keys = Object.keys(LIB.parts[cat]);
  const opts = keys.map(k => [k, cat === 'prop' ? PROP_NICE[k] || k : NICE[k] || k]);
  if (cat === 'hat' || cat === 'cape' || cat === 'prop') opts.unshift(['none', 'Niente']);
  return opts;
}

export function randomLook(rand = Math.random) {
  const pick = a => a[Math.floor(rand() * a.length)];
  const L = {};
  for (const [c] of CATS) { const o = optionsFor(c); L[c] = o.length ? pick(o)[0] : 'none'; }
  // un po' di coerenza: spesso testa e cappello dallo stesso personaggio
  if (rand() < 0.4 && LIB && LIB.parts.hat[L.head]) L.hat = L.head;
  return L;
}
export const DEFAULT_LOOK = { head: 'Knight', body: 'Knight', arms: 'Knight', legs: 'Knight', hat: 'none', cape: 'Knight', prop: 'none', hue: 0 };

// colore degli abiti: rotazione della tinta nel materiale
function hueMaterial(mat, h) {
  const m = mat.clone();
  if (!h) return m;
  m.onBeforeCompile = sh => {
    sh.uniforms.uHue = { value: h * Math.PI * 2 };
    sh.fragmentShader = 'uniform float uHue;\nvec3 hueRot(vec3 c, float a){ const vec3 k = vec3(0.57735); float ca = cos(a); return c * ca + cross(k, c) * sin(a) + k * dot(k, c) * (1.0 - ca); }\n' +
      sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb = max(hueRot(diffuseColor.rgb, uHue), 0.0);');
  };
  m.customProgramCacheKey = () => 'hue' + h;
  return m;
}

// Costruisce un avatar animato. Restituisce { root, mixer, play(name, opts), update(dt), setLook(look), dispose() }
export function makeAvatar(look = DEFAULT_LOOK, opts = {}) {
  if (!LIB) throw new Error('loadAvatarLibrary prima');
  const root = new THREE.Group();
  if (opts.height) root.scale.setScalar(opts.height / 2.45);
  const rig = SkeletonUtils.clone(LIB.src.Knight.scene);
  // via i pezzi del modello base: teniamo solo lo scheletro
  const drop = []; rig.traverse(o => { if (o.isMesh) drop.push(o); });
  drop.forEach(o => o.parent.remove(o));
  const bones = {}; rig.traverse(o => { if (o.isBone) bones[o.name] = o; });
  root.add(rig);
  const added = [];
  const mixer = new THREE.AnimationMixer(rig);
  let current = null;
  const av = { root, rig, mixer, bones, look: { ...DEFAULT_LOOK, ...look } };

  function attach(cat, key, hue) {
    const list = LIB.parts[cat][key]; if (!list) return;
    for (const src of list) {
      let m;
      const tint = (cat === 'body' || cat === 'legs' || cat === 'cape' || cat === 'hat') ? hue : 0;
      const mat = hueMaterial(src.material, tint);
      if (src.isSkinnedMesh) {
        m = new THREE.SkinnedMesh(src.geometry, mat);
        const sb = src.skeleton.bones.map(b => bones[b.name]);
        m.bind(new THREE.Skeleton(sb, src.skeleton.boneInverses), src.bindMatrix);
        rig.add(m);
      } else {
        m = new THREE.Mesh(src.geometry, mat);
        m.position.copy(src.position); m.quaternion.copy(src.quaternion); m.scale.copy(src.scale);
        (bones[src.parent && src.parent.name] || rig).add(m);
      }
      m.castShadow = true; m.receiveShadow = !!opts.receiveShadow; m.frustumCulled = false;
      added.push(m);
    }
  }
  av.setLook = (look) => {
    for (const m of added) { m.parent && m.parent.remove(m); m.material.dispose(); }
    added.length = 0;
    av.look = { ...DEFAULT_LOOK, ...look };
    const h = HUES[av.look.hue | 0] || 0;
    for (const [c] of CATS) { if (c === 'hue') continue; const k = av.look[c]; if (k && k !== 'none') attach(c, k, h); }
  };
  av.play = (name, o = {}) => {
    const clip = LIB.clips[name]; if (!clip) return null;
    const a = mixer.clipAction(clip);
    a.reset(); a.setLoop(o.once ? THREE.LoopOnce : THREE.LoopRepeat); a.clampWhenFinished = !!o.once; a.timeScale = o.speed || 1;
    if (current && current !== a) { a.crossFadeFrom(current, o.fade ?? 0.25, false); }
    a.play(); current = a;
    if (o.once && o.then) { const h = e => { if (e.action === a) { mixer.removeEventListener('finished', h); av.play(o.then, { fade: 0.3 }); } }; mixer.addEventListener('finished', h); }
    return a;
  };
  av.update = dt => mixer.update(dt);
  av.dispose = () => { for (const m of added) m.material.dispose(); root.parent && root.parent.remove(root); };
  av.setLook(av.look);
  av.play(opts.idle || 'Idle');
  return av;
}

// salva/carica l'avatar del giocatore (condiviso tra tutti i giochi)
export function savedProfile() {
  try { const p = JSON.parse(localStorage.getItem('ridotto-avatar')); if (p && p.look) return p; } catch (e) { }
  return null;
}
export function saveProfile(p) { try { localStorage.setItem('ridotto-avatar', JSON.stringify(p)); } catch (e) { } }
