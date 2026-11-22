// Personaggi "sportivi" (stile Switch Sports): Universal Base Characters di Quaternius (CC0) + Universal Animation Library 1 e 2.
// Vestiti sportivi colorati senza modelli in più: ogni vertice sa a quale osso appartiene (maglia, pantaloncini, scarpe).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const DIR = 'assets/sport/';
export const SKINS = ['#f3d2b8', '#e8b796', '#c98f68', '#a46a46', '#7a4a2e', '#4e2f1e'];
export const HAIR_COLORS = ['#2a1a12', '#5a3420', '#9a6a3a', '#d8b06a', '#c44a2a', '#e8e4dc', '#3a3a44', '#ff5c9a'];
export const HAIRS = { none: 'Nessuno', SimpleParted: 'Corti', Buzzed: 'Rasati', Long: 'Lunghi', Buns: 'Chignon', BuzzedFemale: 'Corti 2' };
export const KIT = ['#3d7bff', '#ff5c9a', '#ffcf3a', '#2ec27e', '#9a5cff', '#ff6a3d', '#1d2340', '#f4f6fb', '#20c4d8', '#e8243c'];
export const DEFAULT_SPORT = { body: 'M', skin: 1, hair: 'SimpleParted', hairColor: 1, beard: false, shirt: '#3d7bff', shorts: '#1d2340', shoes: '#f4f6fb' };

let LIB = null;
const EXTRA = ['Golf_Drive', 'Golf_Drive_B'];
export async function loadSportLibrary(onProgress) {
  if (LIB) return LIB;
  const ld = new GLTFLoader();
  const files = { M: 'Superhero_Male_FullBody.gltf', F: 'Superhero_Female_FullBody.gltf', ual1: 'ual1.glb', ual2: 'ual2.glb' };
  for (const h of Object.keys(HAIRS)) if (h !== 'none') files['hair_' + h] = 'Hair_' + h + '.gltf';
  files.hair_Beard = 'Hair_Beard.gltf';
  const out = {}; let n = 0; const keys = Object.keys(files);
  await Promise.all(keys.map(async k => { out[k] = await ld.loadAsync(DIR + files[k]); onProgress && onProgress(++n / keys.length); }));
  const clips = {};
  for (const k of ['ual1', 'ual2']) for (const c of out[k].animations) clips[c.name] = c;
  // animazioni da Mixamo già adattate al nostro scheletro (vedi sviluppo/tools/retarget.html)
  await Promise.all(EXTRA.map(async n => { try { const j = await (await fetch(DIR + n + '.json')).json(); clips[n] = THREE.AnimationClip.parse(j); } catch (e) { } }));
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

// Crea un personaggio. height in metri (il modello originale è ~1.8)
export function makeSportsmate(look = DEFAULT_SPORT, opts = {}) {
  if (!LIB) throw new Error('loadSportLibrary prima');
  look = { ...DEFAULT_SPORT, ...look };
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
