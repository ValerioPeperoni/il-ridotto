// Braccio con la racchetta guidato a mano (cinematica inversa a due ossa): la mano va dove serve,
// la racchetta è orientata come in un vero dritto o rovescio e nel momento del colpo la testa
// della racchetta è esattamente sulla palla. Le gambe e il busto restano quelli dell'animazione.
import * as THREE from 'three';

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m = new THREE.Matrix4();
const _s = new THREE.Vector3(), _e = new THREE.Vector3(), _h = new THREE.Vector3(), _t = new THREE.Vector3(), _p = new THREE.Vector3();

export function makeArm(av, racket) {
  const S = av.bones.upperarm_r, E = av.bones.lowerarm_r, H = av.bones.hand_r, SP = av.bones.spine_03;
  av.root.updateMatrixWorld(true);
  const l1 = S.getWorldPosition(_s).distanceTo(E.getWorldPosition(_e)), l2 = _e.distanceTo(H.getWorldPosition(_h));
  // testa della racchetta nel sistema della mano
  const headLocal = new THREE.Vector3(0, 0.08, 0).multiply(racket.scale).applyQuaternion(racket.quaternion).add(racket.position);

  function worldQ(o, out) { o.updateWorldMatrix(true, false); o.matrixWorld.decompose(_p, out, _w); return out; }
  function setWorldQ(o, qw, k) {
    const pq = worldQ(o.parent, _q2.clone());
    const local = pq.invert().multiply(qw);
    o.quaternion.slerp(local, k);
  }
  // gira l'osso in modo che punti (verso il figlio) a "target"
  function aim(bone, child, target, k) {
    bone.updateWorldMatrix(true, true);
    const p = bone.getWorldPosition(new THREE.Vector3()), c = child.getWorldPosition(new THREE.Vector3());
    const cur = c.sub(p).normalize(), des = target.clone().sub(p).normalize();
    const d = new THREE.Quaternion().setFromUnitVectors(cur, des);
    const qw = worldQ(bone, new THREE.Quaternion()); setWorldQ(bone, d.multiply(qw), k);
  }
  return {
    l1, l2,
    // twist: rotazione del busto (rad, + = verso sinistra), racketUp/face: direzioni nel mondo, head: dove deve stare la testa della racchetta
    apply({ head, racketUp, face, pole, twist = 0, k = 1, leftAxis = null }) {
      if (SP && twist) { const qw = worldQ(SP, new THREE.Quaternion()); setWorldQ(SP, new THREE.Quaternion().setFromAxisAngle(_v.set(0, 1, 0), twist).multiply(qw), k); }
      // orientamento voluto della mano (= della racchetta): asse y lungo la racchetta, asse z = faccia
      const Y = racketUp.clone().normalize(), Z = face.clone().sub(Y.clone().multiplyScalar(face.dot(Y))).normalize(), X = new THREE.Vector3().crossVectors(Y, Z);
      const handQ = new THREE.Quaternion().setFromRotationMatrix(_m.makeBasis(X, Y, Z));
      // scala del mondo per la mano
      H.updateWorldMatrix(true, false); H.matrixWorld.decompose(_p, _q2, _w);
      const off = headLocal.clone().multiply(_w).applyQuaternion(handQ);
      const T = head.clone().sub(off); // dove deve andare il polso
      // palla bassa o lontana: ci si piega in avanti col busto
      if (leftAxis && SP) {
        S.updateWorldMatrix(true, false); const s0 = S.getWorldPosition(new THREE.Vector3()), need = T.distanceTo(s0) - (l1 + l2 - 0.02);
        if (need > 0) { const ang = Math.min(0.4, need / 0.6); const qw = worldQ(SP, new THREE.Quaternion()); setWorldQ(SP, new THREE.Quaternion().setFromAxisAngle(leftAxis.clone().normalize(), ang).multiply(qw), k); av.root.updateMatrixWorld(true); }
      }
      // due ossa: gomito sul piano del "pole"
      S.updateWorldMatrix(true, false); const s = S.getWorldPosition(new THREE.Vector3());
      let d = T.distanceTo(s); const dir = T.clone().sub(s).normalize();
      d = Math.min(Math.max(d, Math.abs(l1 - l2) + 0.01), l1 + l2 - 0.005);
      const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), hh = Math.sqrt(Math.max(0, l1 * l1 - a * a));
      const pp = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
      const elbow = s.clone().addScaledVector(dir, a).addScaledVector(pp, hh), wrist = s.clone().addScaledVector(dir, d);
      aim(S, E, elbow, k); aim(E, H, wrist, k);
      setWorldQ(H, handQ, k);
      av.root.updateMatrixWorld(true);
    },
  };
}

// ---------- gambe: piedi appoggiati a terra e passi laterali "a scivolo" (come i giocatori veri) ----------
export function makeLegs(av) {
  const sides = {};
  av.root.updateMatrixWorld(true);
  for (const sd of ['l', 'r']) {
    const T = av.bones['thigh_' + sd], C = av.bones['calf_' + sd], F = av.bones['foot_' + sd];
    const l1 = T.getWorldPosition(new THREE.Vector3()).distanceTo(C.getWorldPosition(new THREE.Vector3()));
    const l2 = C.getWorldPosition(new THREE.Vector3()).distanceTo(F.getWorldPosition(new THREE.Vector3()));
    sides[sd] = { T, C, F, l1: l1 * 1, l2, p: null, from: new THREE.Vector3(), to: new THREE.Vector3(), t: 1 };
  }
  const wq = o => { o.updateWorldMatrix(true, false); const q = new THREE.Quaternion(); o.matrixWorld.decompose(_p, q, _w); return q; };
  function setWQ(o, qw) { const pq = wq(o.parent).invert(); o.quaternion.copy(pq.multiply(qw)); o.updateMatrixWorld(true); }
  function aimB(bone, child, target) {
    bone.updateWorldMatrix(true, true);
    const p = bone.getWorldPosition(new THREE.Vector3()), c = child.getWorldPosition(new THREE.Vector3());
    const d = new THREE.Quaternion().setFromUnitVectors(c.sub(p).normalize(), target.clone().sub(p).normalize());
    setWQ(bone, d.multiply(wq(bone)));
  }
  return {
    // fwd: direzione in cui guarda il corpo (mondo), vel: velocità del corpo, dt
    // pose (facoltativa): { k: 0..1, l: Vector3, r: Vector3 } posizioni dei piedi imposte (es. la scivolata del bowling)
    update(fwd, vel, dt, pose) {
      const s = av.root.scale.x, left = new THREE.Vector3(fwd.z, 0, -fwd.x); // sinistra del personaggio
      const base = av.root.position, floorY = 0;
      const neutral = sd => new THREE.Vector3(base.x, 0, base.z).addScaledVector(left, (sd === 'l' ? 0.17 : -0.17) * s).addScaledVector(fwd, (sd === 'l' ? 0.07 : -0.05) * s);
      const lead = vel.clone().multiplyScalar(0.13);
      for (const sd of ['l', 'r']) {
        const S = sides[sd]; if (!S.p) { S.p = neutral(sd); S.t = 1; }
        const other = sides[sd === 'l' ? 'r' : 'l'];
        if (S.t >= 1) {
          const far = S.p.distanceTo(neutral(sd));
          if (far > 0.13 * s && (other.t >= 1 || far > 0.42 * s)) { S.from.copy(S.p); S.to.copy(neutral(sd)).add(lead); S.t = 0; }
        }
        if (S.t < 1) { S.t = Math.min(1, S.t + dt / 0.13); const e = S.t * S.t * (3 - 2 * S.t); S.p.copy(S.from).lerp(S.to, e); S.lift = Math.sin(S.t * Math.PI) * 0.07 * s; } else S.lift = 0;
        // caviglia: sopra il punto del piede; ginocchio in avanti e un po' in fuori
        const footQ = wq(S.F);
        let ank = new THREE.Vector3(S.p.x, (0.086 * s) + S.lift, S.p.z);
        if (pose && pose.k > 0 && pose[sd]) { ank.lerp(pose[sd], pose.k); S.p.set(ank.x, 0, ank.z); }
        const hip = S.T.getWorldPosition(new THREE.Vector3());
        let d = ank.distanceTo(hip); const l1 = S.l1, l2 = S.l2;
        const dir = ank.clone().sub(hip).normalize(); d = Math.min(Math.max(d, Math.abs(l1 - l2) + 0.01), l1 + l2 - 0.002);
        const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), hh = Math.sqrt(Math.max(0, l1 * l1 - a * a));
        const pole = fwd.clone().addScaledVector(left, sd === 'l' ? 0.25 : -0.25);
        const pp = pole.sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
        const knee = hip.clone().addScaledVector(dir, a).addScaledVector(pp, hh), foot = hip.clone().addScaledVector(dir, d);
        aimB(S.T, S.C, knee); aimB(S.C, S.F, foot); setWQ(S.F, footQ);
      }
    },
  };
}
// braccio libero (sinistro) in posa pronta davanti al petto
export function makeFreeArm(av) {
  const S = av.bones.upperarm_l, E = av.bones.lowerarm_l, H = av.bones.hand_l;
  av.root.updateMatrixWorld(true);
  const l1 = S.getWorldPosition(new THREE.Vector3()).distanceTo(E.getWorldPosition(new THREE.Vector3())), l2 = E.getWorldPosition(new THREE.Vector3()).distanceTo(H.getWorldPosition(new THREE.Vector3()));
  const wq = o => { o.updateWorldMatrix(true, false); const q = new THREE.Quaternion(); o.matrixWorld.decompose(_p, q, _w); return q; };
  function setWQ(o, qw, k) { const pq = wq(o.parent).invert(); o.quaternion.slerp(pq.multiply(qw), k); o.updateMatrixWorld(true); }
  function aimB(bone, child, target, k) {
    bone.updateWorldMatrix(true, true);
    const p = bone.getWorldPosition(new THREE.Vector3()), c = child.getWorldPosition(new THREE.Vector3());
    const d = new THREE.Quaternion().setFromUnitVectors(c.sub(p).normalize(), target.clone().sub(p).normalize());
    setWQ(bone, d.multiply(wq(bone)), k);
  }
  return {
    apply(T, pole, k = 1) {
      const s = S.getWorldPosition(new THREE.Vector3()); let d = T.distanceTo(s); const dir = T.clone().sub(s).normalize();
      d = Math.min(Math.max(d, Math.abs(l1 - l2) + 0.01), l1 + l2 - 0.005);
      const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), hh = Math.sqrt(Math.max(0, l1 * l1 - a * a));
      const pp = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
      aimB(S, E, s.clone().addScaledVector(dir, a).addScaledVector(pp, hh), k); aimB(E, H, s.clone().addScaledVector(dir, d), k);
    },
  };
}
