// Il mondo statico di Golf Caos (cielo, sole, mare, terreno, bandiere, casse, mazza): condiviso da schermo e telefoni.
import * as THREE from 'three';
import { HOLES, WATER, heightAt, terrainMesh } from './course.js';
export const CUP_R = 0.32;

export function buildWorld(scene, QL) {
  // cielo: cupola con gradiente e sole, usata anche per i riflessi
  const SUN_DIR = new THREE.Vector3(-0.45, 0.62, 0.35).normalize();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(800, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uSun: { value: SUN_DIR } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec3 vD; uniform vec3 uSun;
      void main(){ float h = clamp(vD.y, -0.2, 1.0);
        vec3 top = vec3(0.16,0.40,0.86), mid = vec3(0.42,0.66,0.94), hor = vec3(0.70,0.83,0.96);
        vec3 c = mix(hor, mid, smoothstep(0.0, 0.18, h)); c = mix(c, top, smoothstep(0.18, 0.75, h));
        float s = max(0.0, dot(normalize(vD), uSun)); c += vec3(1.0,0.86,0.6) * (pow(s, 600.0) * 4.0 + pow(s, 12.0) * 0.25);
        // nuvolette
        float cl = sin(vD.x*9.0+sin(vD.z*7.0))*sin(vD.z*11.0+vD.x*3.0); c = mix(c, vec3(1.0), smoothstep(0.55, 0.9, cl) * smoothstep(0.05, 0.3, h) * 0.5);
        gl_FragColor = vec4(c, 1.0); }`,
  }));
  scene.add(sky);
  const hemi = new THREE.HemisphereLight(0xcfe6ff, 0x5a7040, 0.9); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.6); sun.castShadow = true;
  sun.shadow.mapSize.set(QL.shadow || 512, QL.shadow || 512); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);
  function placeSun(focus, size) {
    sun.position.copy(focus).addScaledVector(SUN_DIR, 120); sun.target.position.copy(focus);
    const c = sun.shadow.camera; c.left = -size; c.right = size; c.top = size; c.bottom = -size; c.near = 10; c.far = 260; c.updateProjectionMatrix();
  }
  // mare
  const waterNormal = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const img = g.createImageData(128, 128); for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) { const a = Math.sin(x / 128 * Math.PI * 6 + Math.sin(y / 128 * Math.PI * 4) * 2), b = Math.cos(y / 128 * Math.PI * 8 + Math.sin(x / 128 * Math.PI * 2) * 2); const o = (y * 128 + x) * 4; img.data[o] = 128 + a * 40; img.data[o + 1] = 128 + b * 40; img.data[o + 2] = 255; img.data[o + 3] = 255; } g.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(60, 60); return t; })();
  const water = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), new THREE.MeshStandardMaterial({ color: 0x2f8db5, roughness: 0.08, metalness: 0.1, normalMap: waterNormal, normalScale: new THREE.Vector2(0.35, 0.35), transparent: true, opacity: 0.88 }));
  water.rotation.x = -Math.PI / 2; water.position.y = WATER; water.receiveShadow = true; scene.add(water);
  const terrain = terrainMesh(QL.step); scene.add(terrain);

  // ---------- buche: bandiera, coppa, tee ----------
  const flags = HOLES.map((h, i) => {
    const g = new THREE.Group(); const cx = h.green[0] + h.cup[0], cz = h.green[1] + h.cup[1]; g.position.set(cx, h.cupY, cz);
    const cup = new THREE.Mesh(new THREE.CircleGeometry(CUP_R, 28), new THREE.MeshBasicMaterial({ color: 0x0c140c, polygonOffset: true, polygonOffsetFactor: -2 })); cup.rotation.x = -Math.PI / 2; cup.position.y = 0.03; g.add(cup);
    const rim = new THREE.Mesh(new THREE.RingGeometry(CUP_R, CUP_R + 0.05, 28), new THREE.MeshBasicMaterial({ color: 0xffffff, polygonOffset: true, polygonOffsetFactor: -2 })); rim.rotation.x = -Math.PI / 2; rim.position.y = 0.03; g.add(rim);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.2, 8), new THREE.MeshStandardMaterial({ color: 0xf4f4f4 })); pole.position.y = 1.6; pole.castShadow = true; g.add(pole);
    const fg = new THREE.PlaneGeometry(1.3, 0.85, 12, 4); fg.translate(0.65, 0, 0);
    const flag = new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ color: [0xff4d6d, 0xffc93a, 0x3d7bff, 0x2ec27e, 0x9a5cff, 0xff7b3d][i], side: THREE.DoubleSide, roughness: 0.8 }));
    flag.position.y = 2.75; flag.castShadow = true; g.add(flag); g.userData.flag = flag; g.userData.base = fg.attributes.position.array.slice();
    // numero sulla bandiera
    const num = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), new THREE.MeshBasicMaterial({ map: textTex(String(i + 1), '#fff'), transparent: true, side: THREE.DoubleSide, depthWrite: false })); num.position.set(0.6, 2.75, 0.02); g.add(num);
    scene.add(g);
    // tee: due segnaposto
    const dx = h.mid[0] - h.tee[0], dz = h.mid[1] - h.tee[1], l = Math.hypot(dx, dz);
    for (const s of [-1, 1]) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.45, 14), new THREE.MeshStandardMaterial({ color: 0xe8243c, roughness: 0.4 })); const tx = h.tee[0] + (-dz / l) * 2.2 * s, tz = h.tee[1] + (dx / l) * 2.2 * s; m.position.set(tx, heightAt(tx, tz) + 0.15, tz); m.castShadow = true; scene.add(m); }
    return g;
  });
  function textTex(t, color, size = 128, font = 90) {
    const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); g.font = `700 ${font}px Fredoka, Arial`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 10; g.strokeStyle = 'rgba(0,0,0,.35)'; g.strokeText(t, size / 2, size / 2 + 4); g.fillStyle = color; g.fillText(t, size / 2, size / 2 + 4);
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; return tx;
  }

  function update(t) {
    waterNormal.offset.set(t * 0.004, t * 0.003);
    for (const f of flags) { const fl = f.userData.flag, a = fl.geometry.attributes.position, base = f.userData.base; for (let i = 0; i < a.count; i++) { const x = base[i * 3]; a.setZ(i, Math.sin(t * 5 + x * 3) * 0.12 * x); } a.needsUpdate = true; }
  }
  return { sky, sun, hemi, placeSun, water, waterNormal, terrain, flags, update, SUN_DIR };
}
export const ITEMS = {
  razzo: { icon: '🚀', name: 'Razzo', w: 3 }, bomba: { icon: '💣', name: 'Bomba', w: 3 }, gelo: { icon: '❄️', name: 'Gelo', w: 3 },
  fulmine: { icon: '🌩️', name: 'Fulmine', w: 1 }, calamita: { icon: '🧲', name: 'Calamita', w: 2 }, super: { icon: '⚡', name: 'Super tiro', w: 2 }, mina: { icon: '🎯', name: 'Mina', w: 2 },
};
const boxTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 128, 128); gr.addColorStop(0, '#ffd84a'); gr.addColorStop(1, '#ff9a2e'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); g.strokeStyle = '#fff'; g.lineWidth = 10; g.strokeRect(6, 6, 116, 116); g.font = '700 86px Fredoka, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.strokeStyle = '#b5560a'; g.lineWidth = 8; g.strokeText('?', 64, 70); g.fillText('?', 64, 70); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
export const boxGeo = new THREE.BoxGeometry(0.9, 0.9, 0.9), boxMat = new THREE.MeshStandardMaterial({ map: boxTex, roughness: 0.35, emissive: 0x553300, emissiveIntensity: 0.4 });
// ---------- mazza da golf da attaccare alla mano ----------
export function makeClub(color) {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 1.0, 8), new THREE.MeshStandardMaterial({ color: 0xd9dde6, metalness: 0.8, roughness: 0.25 })); shaft.position.y = -0.42; g.add(shaft);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.22, 8), new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.7), roughness: 0.8 })); grip.position.y = 0.0; g.add(grip);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.2), new THREE.MeshStandardMaterial({ color: 0x8a90a0, metalness: 0.9, roughness: 0.2 })); head.position.set(0, -0.93, 0.06); g.add(head);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

