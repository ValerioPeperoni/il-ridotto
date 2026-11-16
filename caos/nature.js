// Alberi, cespugli, rocce, fiori ed erba (Stylized Nature MegaKit, CC0) sparsi sull'isola con istanze.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HOLES, X0, Z0, W, D, S, surfAt, heightAt, fairDist, rng, fbm, GREEN_R, WATER } from './course.js';

export const wind = { value: 0 };
export const trunks = []; // {x, z, r} per le collisioni

const KINDS = {
  CommonTree_1: { s: [1.2, 1.6], trunk: 0.45 }, CommonTree_2: { s: [1.2, 1.6], trunk: 0.45 }, CommonTree_3: { s: [1.1, 1.5], trunk: 0.45 }, CommonTree_5: { s: [1.1, 1.5], trunk: 0.45 },
  Pine_1: { s: [1.2, 1.7], trunk: 0.4 }, Pine_3: { s: [1.2, 1.7], trunk: 0.4 },
  Bush_Common: { s: [0.9, 1.4] }, Bush_Common_Flowers: { s: [0.9, 1.3] },
  Rock_Medium_1: { s: [0.6, 1.3], rock: 1.2 }, Rock_Medium_2: { s: [0.6, 1.3], rock: 1.2 }, Rock_Medium_3: { s: [0.6, 1.2], rock: 1.1 },
  Grass_Common_Short: { s: [0.35, 0.6] }, Grass_Wispy_Short: { s: [0.35, 0.6] },
  Flower_3_Group: { s: [0.35, 0.55] }, Flower_4_Group: { s: [0.35, 0.55] }, Fern_1: { s: [0.18, 0.28] }, Mushroom_Common: { s: [0.4, 0.6] },
};

function windify(mat, amp) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uWind = wind;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWind;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
        vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        #else
        vec3 ip = vec3(0.0);
        #endif
        float hk = max(0.0, transformed.y) * ${amp.toFixed(3)};
        transformed.x += sin(uWind * 1.7 + ip.x * 0.31 + ip.z * 0.17 + transformed.y * 0.4) * hk;
        transformed.z += cos(uWind * 1.3 + ip.z * 0.29 + transformed.y * 0.3) * hk * 0.6;`);
  };
  mat.customProgramCacheKey = () => 'wind' + amp;
}

export async function loadNature(scene, { mobile = false, plants = 1, trees = 1, onProgress } = {}) {
  const ld = new GLTFLoader(), src = {};
  const names = Object.keys(KINDS); let n = 0;
  await Promise.all(names.map(async k => { src[k] = (await ld.loadAsync('assets/nature/' + k + '.gltf')).scene; onProgress && onProgress(++n / names.length); }));
  const R = rng(1234);
  const place = { }; for (const k of names) place[k] = [];
  const nearHole = (x, z, m) => HOLES.some(h => fairDist(h, x, z) < m);
  const nearGreenOrTee = (x, z, m) => HOLES.some(h => Math.hypot(x - h.green[0], z - h.green[1]) < GREEN_R + m || Math.hypot(x - h.tee[0], z - h.tee[1]) < m);
  const land = (x, z) => surfAt(x, z) === S.ROUGH && heightAt(x, z) > WATER + 0.6;
  const pick = a => a[Math.floor(R() * a.length)];
  // alberi: a gruppi (boschetti) nel rough, lontani dai corridoi
  for (let i = 0; i < 3400; i++) {
    const x = X0 + 6 + R() * (W - 12), z = Z0 + 6 + R() * (D - 12);
    if (!land(x, z)) continue;
    const fd = Math.min(...HOLES.map(h => fairDist(h, x, z)));
    const dens = fbm(x * 0.03 + 11, z * 0.03 - 4, 3);
    if (fd > 13 && dens > 0.5 && R() < (dens - 0.5) * 2.2 * trees) place[pick(dens > 0.62 ? ['Pine_1', 'Pine_3', 'CommonTree_3'] : ['CommonTree_1', 'CommonTree_2', 'CommonTree_5'])].push([x, z]);
    else if (fd > 10 && R() < 0.04) place[pick(['Bush_Common', 'Bush_Common_Flowers'])].push([x, z]);
    else if (fd > 9 && R() < 0.02) place[pick(['Rock_Medium_1', 'Rock_Medium_2', 'Rock_Medium_3'])].push([x, z]);
  }
  // fiori, felci, funghi ed erba alta ai bordi dei corridoi (dove si gioca e si guarda)
  for (let i = 0; i < 3600 * plants; i++) {
    const h = pick(HOLES), t = R(), a = t < 0.5 ? h.tee : h.mid, b = t < 0.5 ? h.mid : h.green, u = R();
    const side = (R() < 0.5 ? -1 : 1) * (9.5 + R() * 18), dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz);
    const x = a[0] + dx * u + (-dz / l) * side, z = a[1] + dz * u + (dx / l) * side;
    if (!land(x, z) || nearGreenOrTee(x, z, 3) || nearHole(x, z, 9.3)) continue;
    const r = R();
    if (r < 0.76) place[pick(['Grass_Common_Short', 'Grass_Wispy_Short'])].push([x, z]);
    else if (r < 0.9) place[pick(['Flower_3_Group', 'Flower_4_Group'])].push([x, z]);
    else if (r < 0.97) place.Fern_1.push([x, z]);
    else place.Mushroom_Common.push([x, z]);
  }
  // istanze, divise a blocchi di 48 m: così si disegna solo quello che la telecamera vede
  const dummy = new THREE.Object3D();
  for (const k of names) {
    const list = place[k]; if (!list.length) continue;
    const meta = KINDS[k], meshes = []; src[k].updateMatrixWorld(true);
    src[k].traverse(o => { if (o.isMesh) meshes.push(o); });
    const chunks = new Map();
    for (const [x, z] of list) {
      const s = meta.s[0] + R() * (meta.s[1] - meta.s[0]);
      dummy.position.set(x, heightAt(x, z) - 0.05 * s, z); dummy.rotation.set(0, R() * Math.PI * 2, 0); dummy.scale.setScalar(s); dummy.updateMatrix();
      const key = Math.floor(x / 48) + ',' + Math.floor(z / 48); if (!chunks.has(key)) chunks.set(key, []); chunks.get(key).push(dummy.matrix.clone());
      if (meta.trunk) trunks.push({ x, z, r: meta.trunk * s, h: 7 * s });
      if (meta.rock) trunks.push({ x, z, r: meta.rock * s, h: 1.6 * s, rock: true });
    }
    const big = !!(meta.trunk || meta.rock || k.startsWith('Bush'));
    for (const m of meshes) {
      const mat = m.material.clone();
      const leafy = /Leaves|Leaf|Grass|Flowers/.test(mat.name);
      if (leafy) { windify(mat, /Grass/.test(mat.name) ? 0.12 : /Flowers|Leaves$/.test(mat.name) ? 0.08 : 0.025); }
      if (mobile && mat.normalMap) mat.normalMap = null;
      for (const mats of chunks.values()) {
        const im = new THREE.InstancedMesh(m.geometry, mat, mats.length);
        mats.forEach((M, i) => im.setMatrixAt(i, M.clone().multiply(m.matrixWorld)));
        im.computeBoundingSphere();
        im.castShadow = big; im.receiveShadow = true;
        scene.add(im);
      }
    }
  }
  const stats = {}; let verts = 0; for (const k of names) { stats[k] = place[k].length; src[k].traverse(o => { if (o.isMesh) verts += o.geometry.attributes.position.count * place[k].length; }); }
  stats.verts = verts; window.__nature = stats;
  return stats;
}
