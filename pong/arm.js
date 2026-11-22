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
        if (need > 0) { const ang = Math.min(0.6, need / 0.45); const qw = worldQ(SP, new THREE.Quaternion()); setWorldQ(SP, new THREE.Quaternion().setFromAxisAngle(leftAxis.clone().normalize(), ang).multiply(qw), k); av.root.updateMatrixWorld(true); }
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
