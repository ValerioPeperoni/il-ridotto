// Visuale 3D individuale del giocatore sul telefono.
// La fisica resta autorevole sul PC: qui si interpolano soltanto gli stati ricevuti.
import * as THREE from 'three';
import { HOLES, WATER, heightAt, terrainMesh } from './course.js';
import { loadNature, wind } from './nature.js';
import { loadAvatarLibrary, makeAvatar, DEFAULT_LOOK } from '../avatar/avatar.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mixAngle = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;

export function createGolfView({ canvas, arrow, readout } = {}) {
  let renderer, scene, camera, sky, raf = 0, last = 0, ready = false, starting = false, disposed = false, failed = false;
  let latest = null, myId = null, time = 0;
  const actors = new Map();
  const camTarget = new THREE.Vector3(), camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
  const tmp = new THREE.Vector3();

  function makeSky() {
    const sky = new THREE.Mesh(new THREE.SphereGeometry(700, 24, 12), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      vertexShader: 'varying vec3 vP; void main(){vP=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: `varying vec3 vP; void main(){float h=clamp(vP.y,-0.15,1.0);vec3 a=vec3(.77,.87,.96);vec3 b=vec3(.35,.63,.88);vec3 c=vec3(.17,.34,.62);vec3 col=mix(a,b,smoothstep(-.05,.38,h));col=mix(col,c,smoothstep(.38,.95,h));float cloud=sin(vP.x*8.0+sin(vP.z*5.0))*sin(vP.z*7.0+vP.x*3.0);col=mix(col,vec3(1.0),smoothstep(.5,.9,cloud)*smoothstep(.0,.3,h)*.22);gl_FragColor=vec4(col,1.0);}`
    }));
    scene.add(sky);
    return sky;
  }

  function makeFlags() {
    HOLES.forEach((h, i) => {
      const x = h.green[0] + h.cup[0], z = h.green[1] + h.cup[1], y = h.cupY;
      const g = new THREE.Group(); g.position.set(x, y, z);
      const cup = new THREE.Mesh(new THREE.CircleGeometry(.32, 20), new THREE.MeshBasicMaterial({ color: 0x18211a }));
      cup.rotation.x = -Math.PI / 2; cup.position.y = .025; g.add(cup);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(.025, .035, 2.5, 8), new THREE.MeshStandardMaterial({ color: 0xf7f7f4, roughness: .45 })); pole.position.y = 1.25; g.add(pole);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(.92, .58), new THREE.MeshStandardMaterial({ color: [0xff5c9a, 0xffcf3a, 0x3d7bff, 0x39b982, 0x9a70ef, 0xff895c][i], side: THREE.DoubleSide, roughness: .82 }));
      flag.position.set(.44, 2.12, 0); flag.castShadow = true; g.add(flag);
      scene.add(g);
    });
  }

  function makeLabel(name, color) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = color; g.beginPath(); g.roundRect(12, 14, 488, 100, 42); g.fill();
    g.fillStyle = '#fff'; g.font = '700 54px Fredoka,Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = 'rgba(0,0,0,.2)'; g.shadowBlur = 8; g.fillText(String(name || 'Giocatore').slice(0, 16), 256, 66);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })); s.scale.set(2.6, .65, 1); s.position.y = 2.8;
    return s;
  }

  function makeClub(color) {
    const g = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.018, .022, 1.0, 8), new THREE.MeshStandardMaterial({ color: 0xd9dde6, metalness: .8, roughness: .25 }));
    shaft.position.y = -.42; g.add(shaft);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .22, 8), new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(.7), roughness: .8 }));
    grip.position.y = 0; g.add(grip);
    const head = new THREE.Mesh(new THREE.BoxGeometry(.1, .07, .2), new THREE.MeshStandardMaterial({ color: 0x8a90a0, metalness: .9, roughness: .2 }));
    head.position.set(0, -.93, .06); g.add(head);
    return g;
  }

  function makeActor(s) {
    const avatar = makeAvatar(s.look || DEFAULT_LOOK, { height: 2.0 });
    avatar.root.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    const hand = avatar.bones.handslotr || avatar.bones.handr;
    const club = makeClub(s.color || '#3d7bff');
    if (hand) { hand.add(club); club.scale.setScalar(2.45 / 2.0); }
    scene.add(avatar.root);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(.11, 20, 16), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: .22, clearcoat: .8, clearcoatRoughness: .18 }));
    scene.add(ball);
    const ring = new THREE.Mesh(new THREE.RingGeometry(.25, .34, 28), new THREE.MeshBasicMaterial({ color: s.color || '#3d7bff', transparent: true, opacity: .9, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; scene.add(ring);
    const beacon = new THREE.Group();
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(.035, .11, 1.0, 8), new THREE.MeshBasicMaterial({ color: s.color || '#3d7bff', transparent: true, opacity: .78, depthWrite: false }));
    beam.position.y = .72; beacon.add(beam);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(.18, .32, 10), new THREE.MeshBasicMaterial({ color: s.color || '#3d7bff' })); cap.position.y = 1.32; beacon.add(cap);
    scene.add(beacon);
    const label = makeLabel(s.name, s.color || '#3d7bff'); avatar.root.add(label);
    return {
      id: s.id, avatar, club, ball, ring, beacon, label, lookKey: JSON.stringify(s.look || DEFAULT_LOOK),
      pos: new THREE.Vector3(s.x || 0, s.y || 0, s.z || 0), targetPos: new THREE.Vector3(s.x || 0, s.y || 0, s.z || 0),
      ballPos: new THREE.Vector3(s.bx || 0, s.by || 0, s.bz || 0), targetBall: new THREE.Vector3(s.bx || 0, s.by || 0, s.bz || 0),
      yaw: s.yaw || 0, targetYaw: s.yaw || 0, cameraYaw: s.cyaw ?? s.yaw ?? 0, targetCameraYaw: s.cyaw ?? s.yaw ?? 0, anim: '', color: s.color || '#3d7bff', name: s.name || 'Giocatore',
      item: '', seen: time,
    };
  }

  function updateActors(snap) {
    if (!snap || !Array.isArray(snap.players)) return;
    myId = snap.me || myId;
    const seen = new Set();
    for (const s of snap.players) {
      seen.add(s.id);
      let a = actors.get(s.id);
      if (!a) { a = makeActor(s); actors.set(s.id, a); }
      const lookKey = JSON.stringify(s.look || DEFAULT_LOOK); if (lookKey !== a.lookKey) { a.avatar.setLook(s.look || DEFAULT_LOOK); a.lookKey = lookKey; }
      a.targetPos.set(s.x, s.y, s.z); a.targetBall.set(s.bx, s.by, s.bz); a.targetYaw = s.yaw || 0; a.targetCameraYaw = s.cyaw ?? s.yaw ?? 0;
      a.name = s.name || a.name; a.item = s.item || ''; a.done = !!s.done; a.moving = !!s.moving; a.charge = s.charge || 0;
      if (s.anim && s.anim !== a.anim) {
        a.anim = s.anim;
        const clip = s.anim === 'swing' ? '1H_Melee_Attack_Slice_Horizontal' : s.anim === 'swipe' ? '1H_Melee_Attack_Slice_Horizontal' : s.anim === 'ko' ? 'Death_A' : s.anim;
        a.avatar.play(clip, { fade: .16 });
      }
      if (s.state === 'frozen' && a.anim !== 'Lie_Idle') { a.anim = 'Lie_Idle'; a.avatar.play('Lie_Idle', { fade: .18 }); }
      a.ball.visible = !a.done; a.ring.visible = !a.done; a.beacon.visible = !a.done && s.id === myId;
      a.seen = time;
    }
    for (const [id, a] of actors) if (!seen.has(id)) {
      scene.remove(a.ball, a.ring, a.beacon);
      a.club.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      a.avatar.dispose(); a.label.material.map.dispose(); a.label.material.dispose(); actors.delete(id);
    }
  }

  function resize() {
    if (!renderer) return;
    const w = Math.max(1, canvas.clientWidth || innerWidth), h = Math.max(1, canvas.clientHeight || innerHeight);
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = h > w ? 70 : 58; camera.updateProjectionMatrix();
  }

  async function start() {
    if (ready || starting || disposed || failed) return;
    starting = true;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'low-power' });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.03;
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, .9));
      renderer.shadowMap.enabled = false;

      scene = new THREE.Scene();
      scene.background = new THREE.Color(0xb8d9f2);
      scene.fog = new THREE.Fog(0xb8d9f2, 95, 300);
      camera = new THREE.PerspectiveCamera(70, 1, .1, 1000);
      sky = makeSky();
      scene.add(new THREE.HemisphereLight(0xe6f3ff, 0x64734e, 1.05));
      const sun = new THREE.DirectionalLight(0xfff1d9, 2.0);
      sun.position.set(-80, 110, 55);
      scene.add(sun);
      const sea = new THREE.Mesh(new THREE.PlaneGeometry(1000, 1000), new THREE.MeshStandardMaterial({ color: 0x2f93b6, roughness: .32, metalness: .03 }));
      sea.rotation.x = -Math.PI / 2;
      sea.position.y = WATER;
      scene.add(sea);
      scene.add(terrainMesh(2.4));
      makeFlags();

      await Promise.all([
        loadAvatarLibrary(),
        loadNature(scene, { mobile: true, plants: .12, trees: .55 }),
      ]);
      if (disposed) return;
      resize();
      addEventListener('resize', resize);
      ready = true;
      starting = false;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    } catch (error) {
      starting = false;
      failed = true;
      if (renderer) { renderer.dispose(); renderer = null; }
      throw error;
    }
  }

  function frame(now) {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    const dt = clamp((now - last) / 1000, 0, .05); last = now; time += dt; wind.value = time;
    const snap = latest;
    if (ready && snap) updateActors(snap);
    // Interpola i bersagli una sola volta per frame: anche la rotazione della
    // camera segue il personaggio senza scatti tra i pacchetti di rete.
    const actorK = 1 - Math.exp(-dt * 16);
    for (const a of actors.values()) {
      a.pos.lerp(a.targetPos, actorK);
      a.ballPos.lerp(a.targetBall, actorK);
      a.yaw = mixAngle(a.yaw, a.targetYaw, actorK);
      a.cameraYaw = mixAngle(a.cameraYaw, a.targetCameraYaw, actorK);
    }
    const follow = myId && actors.get(myId);
    if (follow) {
      const forwardX = Math.sin(follow.cameraYaw), forwardZ = Math.cos(follow.cameraYaw);
      const desiredLook = camTarget.set(follow.pos.x + forwardX * 1.15, follow.pos.y + 1.25, follow.pos.z + forwardZ * 1.15);
      const desiredPos = tmp.set(follow.pos.x - forwardX * 4.7, follow.pos.y + 2.6, follow.pos.z - forwardZ * 4.7);
      if (!camPos.lengthSq()) { camPos.copy(desiredPos); camLook.copy(desiredLook); }
      const k = 1 - Math.exp(-dt * 8.5); camPos.lerp(desiredPos, k); camLook.lerp(desiredLook, k);
      camera.position.copy(camPos); camera.lookAt(camLook);
      if (readout) {
        const d = Math.hypot(follow.pos.x - follow.ballPos.x, follow.pos.z - follow.ballPos.z);
        readout.textContent = `PALLA · ${d < 10 ? d.toFixed(1).replace('.', ',') : Math.round(d)} m`;
      }
      if (arrow) {
        const projected = tmp.copy(follow.ballPos); projected.y += .5; projected.project(camera);
        const visible = projected.z >= -1 && projected.z <= 1 && Math.abs(projected.x) < .82 && Math.abs(projected.y) < .82;
        arrow.style.display = visible ? 'none' : 'grid';
        if (!visible) {
          const w = innerWidth, h = innerHeight, cx = w / 2, cy = h / 2;
          const dx = projected.x * w / 2, dy = -projected.y * h / 2;
          const mag = Math.max(1, Math.hypot(dx, dy)), radius = Math.min(w, h) * .34;
          arrow.style.left = `${clamp(cx + dx / mag * radius, 28, w - 28)}px`;
          arrow.style.top = `${clamp(cy + dy / mag * radius, 64, h - 210)}px`;
          arrow.style.transform = `translate(-50%,-50%) rotate(${Math.atan2(dy, dx) + Math.PI / 2}rad)`;
        }
      }
    } else if (readout && snap && snap.phase === 'intro') readout.textContent = 'PREPARATI';
    if (sky) sky.position.copy(camera.position);
    for (const a of actors.values()) {
      a.avatar.root.position.copy(a.pos); a.avatar.root.rotation.y = a.yaw;
      a.avatar.update(dt);
      a.ball.position.copy(a.ballPos); a.ring.position.set(a.ballPos.x, heightAt(a.ballPos.x, a.ballPos.z) + .04, a.ballPos.z);
      a.beacon.position.set(a.ballPos.x, a.ballPos.y, a.ballPos.z); a.beacon.children[0].scale.y = .95 + Math.sin(time * 4) * .08;
    }
    renderer.render(scene, camera);
  }

  function setState(s) { latest = s; if (!ready && !starting && !disposed && !failed) start().catch(e => { starting = false; failed = true; if (readout) readout.textContent = 'Visuale non disponibile'; console.error('Golf phone view:', e); }); }
  function destroy() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(raf);
    removeEventListener('resize', resize);
    for (const a of actors.values()) {
      a.club.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      a.avatar.dispose();
      a.label.material.map?.dispose();
      a.label.material.dispose();
    }
    actors.clear();
    if (scene) {
      const geometries = new Set(), materials = new Set(), textures = new Set();
      scene.traverse(o => {
        if (o.geometry) geometries.add(o.geometry);
        const list = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
        for (const m of list) {
          materials.add(m);
          for (const value of Object.values(m)) if (value && value.isTexture) textures.add(value);
        }
      });
      for (const t of textures) t.dispose();
      for (const m of materials) m.dispose();
      for (const g of geometries) g.dispose();
      scene.clear();
    }
    if (renderer) { renderer.dispose(); renderer = null; }
    ready = false;
  }
  return { start, setState, destroy };
}
