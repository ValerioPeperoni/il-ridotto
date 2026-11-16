// Golf Caos sul telefono: la stessa isola vista da dietro il proprio personaggio.
// Il PC fa la partita e manda lo stato (~15 volte al secondo); qui si disegna e si interpola.
import * as THREE from 'three';
import { heightAt } from './course.js';
import { loadNature, wind } from './nature.js';
import * as FX from './fx.js';
import { buildWorld, boxGeo, boxMat, makeClub } from './world.js';
import { loadAvatarLibrary, makeAvatar } from '../avatar/avatar.js';

const AV_H = 2.0;
const lerpA = (a, b, k) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * k; };

export async function startPhoneView(canvas, ui, onProgress) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  const FOG = new THREE.Color(0xa9cbee); scene.background = FOG; scene.fog = new THREE.Fog(FOG, 70, 230);
  const camera = new THREE.PerspectiveCamera(62, 1, 0.3, 900);
  const W_ = buildWorld(scene, { shadow: 0, step: 2 });
  FX.initFx(scene);
  function resize() { const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w < h ? 68 : 55; camera.updateProjectionMatrix(); }
  addEventListener('resize', resize); resize();
  let a = 0, b = 0; const prog = () => onProgress && onProgress(a * 0.5 + b * 0.5);
  await Promise.all([loadAvatarLibrary(p => { a = p; prog(); }), loadNature(scene, { mobile: true, plants: 0.3, trees: 0.6, onProgress: p => { b = p; prog(); } })]);
  { const pm = new THREE.PMREMGenerator(renderer), es = new THREE.Scene(); es.add(W_.sky.clone()); scene.environment = pm.fromScene(es, 0.04).texture; pm.dispose(); }

  // ombre finte: un disco scuro sotto personaggi e palle (costa pochissimo)
  const blobTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(0,0,0,.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const blob = s => { const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false })); m.rotation.x = -Math.PI / 2; scene.add(m); return m; };

  // stato
  let players = [], me = -1, phase = '', boxes = [], projs = [], mines = [];
  const camPos = new THREE.Vector3(0, 40, 60), camLook = new THREE.Vector3(); let camYaw = 0, haveSnap = false;
  // freccia della mira e cerchio d'arrivo per il giocatore del telefono
  const arrowShape = (() => { const sh = new THREE.Shape(); sh.moveTo(-0.18, 0); sh.lineTo(0.18, 0); sh.lineTo(0.18, 0.75); sh.lineTo(0.42, 0.75); sh.lineTo(0, 1); sh.lineTo(-0.42, 0.75); sh.lineTo(-0.18, 0.75); sh.closePath(); const g = new THREE.ShapeGeometry(sh); g.rotateX(Math.PI / 2); return g; })();
  const arrow = new THREE.Mesh(arrowShape, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide })); arrow.visible = false; scene.add(arrow);
  const land = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.95, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, side: THREE.DoubleSide })); land.rotation.x = -Math.PI / 2; land.visible = false; scene.add(land);
  // segnalino grande sopra la propria palla
  const beacon = new THREE.Group();
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.9, 16), new THREE.MeshBasicMaterial({ color: 0xffffff })); cone.rotation.x = Math.PI; cone.position.y = 2.2; beacon.add(cone);
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 })); pillar.position.y = 1; beacon.add(pillar);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.5, 28), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; beacon.add(ring);
  scene.add(beacon);

  function setupPlayers(list) {
    for (const p of players) { p.av && p.av.dispose(); scene.remove(p.ball, p.bBlob, p.pBlob); }
    players = list.map((d, i) => {
      const av = makeAvatar({ ...(d.look || {}), prop: 'none' }, { height: AV_H });
      const hand = av.bones.handslotr || av.bones.handr; const club = makeClub(d.color); club.scale.setScalar(2.45 / AV_H); hand && hand.add(club);
      scene.add(av.root);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, emissive: new THREE.Color(d.color), emissiveIntensity: i === me ? 0.25 : 0.12 }));
      scene.add(ball);
      return { ...d, av, ball, bBlob: blob(0.45), pBlob: blob(1.4), pos: new THREE.Vector3(), tgt: new THREE.Vector3(), yaw: 0, tyaw: 0, bpos: new THREE.Vector3(), btgt: new THREE.Vector3(), clipN: -1, flags: 0, first: true };
    });
    const col = players[me] ? players[me].color : '#fff';
    for (const m of [cone.material, pillar.material, ring.material, arrow.material, land.material]) m.color.set(col);
  }
  function setupBoxes(list) { for (const b of boxes) scene.remove(b.m); boxes = list.map(([x, z]) => { const m = new THREE.Mesh(boxGeo, boxMat); m.position.set(x, heightAt(x, z) + 1.1, z); scene.add(m); return { m, x, z }; }); }

  const view = {
    me: () => players[me],
    camYaw: () => camYaw,
    onLooks(m) { me = m.me; setupPlayers(m.players); setupBoxes(m.boxes || []); },
    onSnap(m) {
      phase = m.ph; if (m.me != null) me = m.me;
      m.P.forEach((d, i) => {
        const p = players[i]; if (!p) return;
        p.tgt.set(d[0], d[1], d[2]); p.tyaw = d[3]; p.btgt.set(d[6], d[7], d[8]); p.flags = d[9]; p.aim = d[10]; p.charge = d[11]; p.lx = d[12]; p.lz = d[13]; p.item = d[14];
        if (p.first) { p.pos.copy(p.tgt); p.bpos.copy(p.btgt); p.yaw = p.tyaw; p.first = false; }
        if (d[5] !== p.clipN) { p.clipN = d[5]; p.av.play(d[4], { fade: 0.18, once: /Death|Cheer|Attack|Hit/.test(d[4]) && !/Cheer/.test(d[4]) ? true : false }); p.clip = d[4]; }
        // da una buca all'altra: salto netto
        if (p.tgt.distanceTo(p.pos) > 15) { p.pos.copy(p.tgt); }
        if (p.btgt.distanceTo(p.bpos) > 15) p.bpos.copy(p.btgt);
      });
      (m.B || []).forEach((v, i) => { if (boxes[i]) boxes[i].m.visible = !!v; });
      // proiettili
      const want = [...(m.M || []).map(x => ['r', x]), ...(m.Bo || []).map(x => ['b', x])];
      while (projs.length > want.length) scene.remove(projs.pop().m);
      want.forEach(([k, x], i) => {
        if (!projs[i] || projs[i].k !== k) { if (projs[i]) scene.remove(projs[i].m); const mm = k === 'r' ? new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.7, 4, 10), new THREE.MeshStandardMaterial({ color: 0xe8243c })) : new THREE.Mesh(new THREE.SphereGeometry(0.35, 14, 10), new THREE.MeshStandardMaterial({ color: 0x1d2030 })); scene.add(mm); projs[i] = { k, m: mm, tgt: new THREE.Vector3(...x) }; mm.position.set(...x); }
        projs[i].tgt.set(...x);
      });
      while (mines.length > (m.Mi || []).length) scene.remove(mines.pop());
      (m.Mi || []).forEach(([x, z], i) => { if (!mines[i]) { mines[i] = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.12, 14), new THREE.MeshStandardMaterial({ color: 0x3a4030 })); scene.add(mines[i]); } mines[i].position.set(x, heightAt(x, z) + 0.06, z); });
      haveSnap = true;
    },
    onFx(m) {
      const v = new THREE.Vector3(m.x, m.y, m.z);
      if (m.k === 'boom') { FX.explosion(v, m.r || 5, { shake: k => { shake = Math.max(shake, k * 0.6); } }); }
      else if (m.k === 'splash') FX.splash(v);
      else if (m.k === 'light') FX.lightning(v);
      else if (m.k === 'beam') FX.beam(new THREE.Vector3(...m.a), new THREE.Vector3(...m.b));
      else if (m.k === 'cup') FX.confetti(v);
    },
  };
  let shake = 0;

  // freccia a bordo schermo verso la propria palla quando non si vede
  const _v = new THREE.Vector3();
  function edgeArrow(p) {
    const el = ui.arrow; if (!p || p.flags & 1) { el.style.display = 'none'; return; }
    const dist = Math.hypot(p.pos.x - p.bpos.x, p.pos.z - p.bpos.z);
    _v.copy(p.bpos).project(camera);
    const behind = _v.z > 1, onScreen = !behind && Math.abs(_v.x) < 0.9 && Math.abs(_v.y) < 0.85;
    if (onScreen && dist < 60) { el.style.display = 'none'; return; }
    let x = _v.x, y = _v.y; if (behind) { x = -x; y = -Math.abs(y) - 0.5; }
    const ang = Math.atan2(y, x), r = 0.82;
    const k = Math.min(r / Math.abs(Math.cos(ang) || 1e-3), r / Math.abs(Math.sin(ang) || 1e-3));
    const sx = (0.5 + Math.cos(ang) * k * 0.5) * innerWidth, sy = (0.5 - Math.sin(ang) * k * 0.5) * innerHeight;
    el.style.display = ''; el.style.left = sx + 'px'; el.style.top = sy + 'px';
    el.querySelector('i').style.transform = `rotate(${-ang}rad)`; el.querySelector('b').textContent = Math.round(dist) + ' m';
  }

  let last = performance.now(), t = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now; t += dt; wind.value = t;
    W_.update(t);
    const k = 1 - Math.exp(-dt * 12);
    for (const p of players) {
      p.pos.lerp(p.tgt, k); p.yaw = lerpA(p.yaw, p.tyaw, k); p.bpos.lerp(p.btgt, 1 - Math.exp(-dt * 16));
      p.av.root.position.copy(p.pos); p.av.root.rotation.y = p.yaw; p.av.update(dt);
      p.av.mixer.timeScale = p.flags & 2 ? 0 : 1;
      p.ball.position.copy(p.bpos); p.ball.visible = !(p.flags & 1);
      p.bBlob.position.set(p.bpos.x, heightAt(p.bpos.x, p.bpos.z) + 0.03, p.bpos.z); p.bBlob.visible = p.ball.visible;
      p.pBlob.position.set(p.pos.x, heightAt(p.pos.x, p.pos.z) + 0.03, p.pos.z);
    }
    for (const b of boxes) { b.m.rotation.y += dt * 1.2; b.m.position.y = heightAt(b.x, b.z) + 1.1 + Math.sin(t * 2 + b.x) * 0.15; }
    for (const pr of projs) pr.m.position.lerp(pr.tgt, k);
    const p = players[me];
    if (p) {
      // segnalino sulla mia palla
      beacon.visible = !(p.flags & 1); beacon.position.copy(p.bpos); cone.position.y = 2.2 + Math.sin(t * 4) * 0.2;
      const dB = p.pos.distanceTo(p.bpos), s = 1 + Math.min(3, dB / 25); beacon.scale.setScalar(s); cone.visible = pillar.visible = dB > 7;
      // mira
      const aiming = p.flags & 16;
      arrow.visible = !!aiming; land.visible = !!(p.flags & 32) && p.lx;
      if (aiming) { const pw = p.flags & 32 ? Math.max(0.05, p.charge) : 0.3; arrow.position.set(p.bpos.x, heightAt(p.bpos.x, p.bpos.z) + 0.1, p.bpos.z); arrow.rotation.y = p.aim; arrow.scale.set(1 + pw * 0.6, 1, 1.5 + pw * 6); }
      if (land.visible) { land.position.set(p.lx, heightAt(p.lx, p.lz) + 0.1, p.lz); land.scale.setScalar(1 + Math.sin(t * 6) * 0.08); }
      // telecamera da dietro: mentre mira guarda nella direzione del tiro, mentre corre segue il personaggio
      let want = camYaw;
      if (aiming) want = p.aim;
      else if (p.tgt.distanceTo(p.pos) > 0.02 || p.clip === 'Running_A' || p.clip === 'Walking_A') want = p.yaw;
      camYaw = lerpA(camYaw, want, 1 - Math.exp(-dt * (aiming ? 6 : 2.2)));
      const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
      const focus = aiming ? p.bpos : p.pos;
      const dist = aiming ? 6.2 : 6.5, h = aiming ? 3.4 : 3.2, side = aiming ? 1.3 : 0; // mirando, la telecamera sta dal lato opposto al personaggio
      const cp = new THREE.Vector3(focus.x - fx * dist + fz * side, 0, focus.z - fz * dist - fx * side); cp.y = Math.max(heightAt(cp.x, cp.z) + 1.2, focus.y + h);
      const lk = new THREE.Vector3(focus.x + fx * (aiming ? 10 : 6), focus.y + 1.2, focus.z + fz * (aiming ? 10 : 6));
      const kk = 1 - Math.exp(-dt * 6);
      camPos.lerp(cp, kk); camLook.lerp(lk, kk);
    }
    shake = Math.max(0, shake - dt * 2);
    camera.position.copy(camPos).add(new THREE.Vector3((Math.random() - .5) * shake, (Math.random() - .5) * shake, 0)); camera.lookAt(camLook);
    W_.sky.position.copy(camera.position);
    FX.updateFx(dt, camera);
    edgeArrow(p);
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
  return view;
}
