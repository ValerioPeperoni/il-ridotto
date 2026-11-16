// Luci "da studio" condivise tra i giochi: ambiente HDR vero (Poly Haven, CC0), luce principale morbida
// con ombre, luce di contorno, terreno che raccoglie solo l'ombra. Colori naturali (niente saturazione esagerata).
import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

const HDR = new URL('../assets/hdr/', import.meta.url).href;

export function setupStage(renderer, scene, o = {}) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping ?? THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = o.exposure ?? 1.0;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const pm = new THREE.PMREMGenerator(renderer);
  new RGBELoader().load(HDR + (o.hdr || 'venice_sunset_1k') + '.hdr', t => {
    const env = pm.fromEquirectangular(t).texture; t.dispose();
    scene.environment = env;
    if (o.background) { scene.background = env; scene.backgroundBlurriness = o.blur ?? 0.6; scene.backgroundIntensity = o.bgIntensity ?? 0.6; }
  });
  scene.environmentIntensity = o.envIntensity ?? 0.7;
  const key = new THREE.DirectionalLight(o.keyColor ?? 0xfff1e0, o.key ?? 2.4);
  key.position.set(2.5, 4.5, 3); key.castShadow = true;
  const sz = o.shadowSize ?? 3;
  Object.assign(key.shadow.camera, { left: -sz, right: sz, top: sz, bottom: -sz, near: 0.5, far: 20 });
  key.shadow.mapSize.set(o.mobile ? 1024 : 2048, o.mobile ? 1024 : 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 4;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(o.rimColor ?? 0x9fb8ff, o.rim ?? 1.6); rim.position.set(-3, 3, -4); scene.add(rim);
  const hemi = new THREE.HemisphereLight(0xdfe8ff, 0x3a2a55, o.hemi ?? 0.4); scene.add(hemi);
  if (o.ground !== false) {
    const g = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.28 }));
    g.rotation.x = -Math.PI / 2; g.receiveShadow = true; scene.add(g);
  }
  return { key, rim, hemi };
}
