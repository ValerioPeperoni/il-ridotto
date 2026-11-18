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
  const flagTime = { value: 0 };
  const COLS = ['#ff4d6d', '#ffc93a', '#3d7bff', '#2ec27e', '#9a5cff', '#ff7b3d'];
  // asta a strisce bianche e rosse
  const poleTex = (() => { const c = document.createElement('canvas'); c.width = 8; c.height = 128; const g = c.getContext('2d'); for (let k = 0; k < 8; k++) { g.fillStyle = k % 2 ? '#f6f6f6' : '#e8243c'; g.fillRect(0, k * 16, 8, 16); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const poleMat = new THREE.MeshStandardMaterial({ map: poleTex, roughness: 0.35 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xffcf3a, metalness: 0.8, roughness: 0.25 });
  const flagGeo = new THREE.PlaneGeometry(1.5, 1.0, 20, 8); flagGeo.translate(0.75, 0, 0);
  // bandiera di stoffa che sventola (nel vertex shader: costa zero alla CPU)
  function flagMat(color, n) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 170; const g = c.getContext('2d');
    g.fillStyle = color; g.beginPath(); g.moveTo(0, 0); g.lineTo(256, 0); g.lineTo(206, 85); g.lineTo(256, 170); g.lineTo(0, 170); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(0, 0, 256, 18); g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(0, 152, 256, 18);
    g.font = '700 110px Fredoka, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 12; g.strokeStyle = 'rgba(0,0,0,.25)'; g.strokeText(n, 100, 92); g.fillStyle = '#fff'; g.fillText(n, 100, 92);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.MeshStandardMaterial({ map: t, side: THREE.DoubleSide, alphaTest: 0.5, transparent: false, roughness: 0.85 });
    m.onBeforeCompile = sh => {
      sh.uniforms.uT = flagTime;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uT;').replace('#include <begin_vertex>', `#include <begin_vertex>
        float fw = position.x / 1.5;
        transformed.z += (sin(uT * 5.5 + position.x * 3.2 - position.y * 1.2) * 0.16 + sin(uT * 9.0 + position.x * 6.0) * 0.04) * fw;
        transformed.y -= fw * fw * 0.12;
        transformed.x -= abs(sin(uT * 5.5 + position.x * 3.2)) * 0.06 * fw;`);
    };
    m.customProgramCacheKey = () => 'flag';
    return m;
  }
  // colonna di luce sulla buca: si vede da lontano, come un segnalino
  const beamGeo = new THREE.CylinderGeometry(0.32, 0.32, 30, 20, 1, true); beamGeo.translate(0, 15, 0);
  const beamTex = (() => { const c = document.createElement('canvas'); c.width = 4; c.height = 128; const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 128, 0, 0); gr.addColorStop(0, 'rgba(255,255,255,0.45)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.18)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 4, 128); return new THREE.CanvasTexture(c); })();
  const ringTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 20, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.75, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.85, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
  const flags = HOLES.map((h, i) => {
    const g = new THREE.Group(); const cx = h.green[0] + h.cup[0], cz = h.green[1] + h.cup[1]; g.position.set(cx, h.cupY, cz);
    const col = new THREE.Color(COLS[i]);
    const cup = new THREE.Mesh(new THREE.CircleGeometry(CUP_R, 28), new THREE.MeshBasicMaterial({ color: 0x0c140c, polygonOffset: true, polygonOffsetFactor: -2 })); cup.rotation.x = -Math.PI / 2; cup.position.y = 0.03; g.add(cup);
    const rim = new THREE.Mesh(new THREE.RingGeometry(CUP_R, CUP_R + 0.06, 28), new THREE.MeshBasicMaterial({ color: 0xffffff, polygonOffset: true, polygonOffsetFactor: -2 })); rim.rotation.x = -Math.PI / 2; rim.position.y = 0.03; g.add(rim);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshBasicMaterial({ map: ringTex, color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -3 })); glow.rotation.x = -Math.PI / 2; glow.position.y = 0.04; g.add(glow);
    const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ map: beamTex, color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false })); g.add(beam);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 3.4, 10), poleMat); pole.position.y = 1.7; pole.castShadow = true; g.add(pole);
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 10), goldMat); top.position.y = 3.44; g.add(top);
    const flag = new THREE.Mesh(flagGeo, flagMat(COLS[i], String(i + 1))); flag.position.set(0.03, 2.85, 0); flag.castShadow = true; g.add(flag);
    g.userData.flag = flag; g.userData.glow = glow; g.userData.beam = beam;
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
    flagTime.value = t;
    for (const f of flags) { const k = 1 + Math.sin(t * 3) * 0.08; f.userData.glow.scale.setScalar(k); f.userData.beam.material.opacity = 0.75 + Math.sin(t * 2.2) * 0.2; }
  }
  return { sky, sun, hemi, placeSun, water, waterNormal, terrain, flags, update, SUN_DIR };
}
export const ITEMS = {
  razzo: { icon: '🚀', name: 'Razzo', w: 3 }, bomba: { icon: '💣', name: 'Bomba', w: 3 }, gelo: { icon: '❄️', name: 'Gelo', w: 3 },
  fulmine: { icon: '🌩️', name: 'Fulmine', w: 1 }, calamita: { icon: '🧲', name: 'Calamita', w: 2, own: true }, mina: { icon: '🎯', name: 'Mina', w: 2 },
  banana: { icon: '🍌', name: 'Banana', w: 3 }, gigante: { icon: '🍄', name: 'Gigante', w: 2 }, scambio: { icon: '🔄', name: 'Scambio', w: 1, own: true },
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

// ---------- razzo a cartone: corpo tornito, alette, oblò, fiamma ----------
export function makeRocket(color = 0xe8243c) {
  const g = new THREE.Group(); // punta verso +z
  const prof = [[0, -0.55], [0.13, -0.55], [0.17, -0.45], [0.2, -0.2], [0.21, 0.1], [0.2, 0.3], [0.16, 0.48], [0.1, 0.62], [0.04, 0.72], [0, 0.75]];
  const curve = new THREE.SplineCurve(prof.map(([r, y]) => new THREE.Vector2(r, y)));
  const body = new THREE.LatheGeometry(curve.getSpacedPoints(40).map(p => new THREE.Vector2(Math.max(0.001, p.x), p.y)), 24);
  body.rotateX(Math.PI / 2);
  // colori a fasce con una texture: bianco, punta colorata, fascia colorata
  const c = document.createElement('canvas'); c.width = 4; c.height = 128; const cg = c.getContext('2d'); const hex = '#' + new THREE.Color(color).getHexString();
  cg.fillStyle = '#f4f4f8'; cg.fillRect(0, 0, 4, 128); cg.fillStyle = hex; cg.fillRect(0, 0, 4, 32); cg.fillRect(0, 96, 4, 14); cg.fillStyle = '#c9ccd6'; cg.fillRect(0, 118, 4, 10);
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
  const bm = new THREE.MeshStandardMaterial({ map: tx, roughness: 0.35, metalness: 0.1 });
  g.add(new THREE.Mesh(body, bm));
  // oblò
  const win = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 10), new THREE.MeshStandardMaterial({ color: 0x5ec8ff, roughness: 0.05, metalness: 0.3, emissive: 0x1a5a90, emissiveIntensity: 0.6 }));
  win.scale.set(1, 1, 0.45); win.position.set(0, 0.195, 0.18); win.rotation.x = -0.1; g.add(win);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.018, 8, 20), new THREE.MeshStandardMaterial({ color: 0xc9ccd6, metalness: 0.8, roughness: 0.3 })); ring.position.copy(win.position); ring.rotation.x = Math.PI / 2 - 0.1; g.add(ring);
  // alette curve
  const fs = new THREE.Shape(); fs.moveTo(0, 0); fs.quadraticCurveTo(0.22, -0.05, 0.26, -0.3); fs.lineTo(0.2, -0.32); fs.quadraticCurveTo(0.1, -0.2, 0, -0.18); fs.closePath();
  const fg = new THREE.ExtrudeGeometry(fs, { depth: 0.025, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2 }); fg.translate(0, 0, -0.0125);
  const finM = new THREE.MeshStandardMaterial({ color, roughness: 0.4 });
  fg.rotateX(Math.PI / 2); fg.translate(0.14, 0, -0.2);
  for (let k = 0; k < 3; k++) { const f = new THREE.Mesh(fg, finM); f.rotation.z = k * Math.PI * 2 / 3 + Math.PI / 2; g.add(f); }
  // ugello e fiamma
  const noz = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, 0.12, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0x4a4e5a, metalness: 0.7, roughness: 0.35, side: THREE.DoubleSide })); noz.rotation.x = Math.PI / 2; noz.position.z = -0.6; g.add(noz);
  const flameG = new THREE.ConeGeometry(0.12, 0.6, 14, 1, true); flameG.rotateX(-Math.PI / 2); flameG.translate(0, 0, -0.95);
  const flame = new THREE.Mesh(flameG, new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.2, 0.3), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  const core = new THREE.Mesh(flameG, new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 2.4, 1.6), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); core.scale.set(0.5, 0.5, 0.7); core.position.z = -0.25;
  g.add(flame, core); g.userData.flame = flame; g.userData.core = core;
  g.traverse(o => { if (o.isMesh && o !== flame && o !== core) o.castShadow = true; });
  g.scale.setScalar(1.25);
  return g;
}
