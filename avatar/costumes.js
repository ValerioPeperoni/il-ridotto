// Costumi buffi (stile Fall Guys) costruiti in stile low-poly come i personaggi KayKit.
// Ogni pezzo è agganciato a un osso: si muove con le animazioni.
// Unità del rig KayKit: personaggio alto ~2.45, testa ~1.08 di lato, origine della testa sul collo, faccia verso +z.
import * as THREE from 'three';

const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.65, flatShading: true, ...o });
const mesh = (g, m, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) => { const x = new THREE.Mesh(g, m); x.position.set(...p); x.rotation.set(...r); x.scale.set(...s); x.castShadow = true; return x; };
function eyes(g, y, z, sep = 0.2, size = 0.11, look = 0) {
  for (const s of [-1, 1]) {
    g.add(mesh(new THREE.SphereGeometry(size, 12, 10), M(0xffffff, { roughness: 0.3, flatShading: false }), [s * sep, y, z]));
    g.add(mesh(new THREE.SphereGeometry(size * 0.48, 10, 8), M(0x111111, { flatShading: false }), [s * sep + look * 0.02, y - 0.01, z + size * 0.72]));
  }
}
function smile(g, y, z, w = 0.16, open = false) {
  const m = mesh(new THREE.TorusGeometry(w, 0.025, 6, 16, Math.PI), M(0x3a1010), [0, y, z], [0, 0, Math.PI]);
  g.add(m);
  if (open) g.add(mesh(new THREE.CircleGeometry(w * 0.95, 16, Math.PI, Math.PI), M(0x7a1a1a, { side: THREE.DoubleSide }), [0, y, z - 0.01]));
}
// lathe deformato lungo una curva (banana)
function bentLathe(profile, segs, bend) {
  const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segs);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setZ(i, p.getZ(i) + bend(y)); }
  g.computeVertexNormals(); return g;
}

// ---------- costumi interi o teste ----------
export const COSTUMES = {
  banana: {
    name: 'Banana', hides: ['head', 'hat', 'body', 'cape'],
    parts: [{ bone: 'hips', build() {
      const g = new THREE.Group(), yel = M(0xffd83a), brown = M(0x6b4a1e);
      const prof = [[0.02, -0.2], [0.22, -0.1], [0.5, 0.25], [0.6, 0.7], [0.58, 1.2], [0.5, 1.6], [0.32, 1.95], [0.12, 2.15], [0.03, 2.2]];
      g.add(mesh(bentLathe(prof, 7, y => -0.35 * Math.sin(Math.max(0, y) / 2.2 * Math.PI) + 0.06 * y), yel));
      g.add(mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.25, 6), brown, [0, 2.3, 0.05 - 0.02], [0.3, 0, 0]));
      g.add(mesh(new THREE.ConeGeometry(0.1, 0.12, 6), brown, [0, -0.25, 0], [Math.PI, 0, 0]));
      // bucce aperte
      for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2 + 0.5; const p = mesh(new THREE.ConeGeometry(0.22, 0.75, 4, 1, true), M(0xf7c62a, { side: THREE.DoubleSide }), [Math.cos(a) * 0.45, 0.05, Math.sin(a) * 0.45 - 0.05], [Math.PI + Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9]); g.add(p); }
      eyes(g, 1.28, 0.36, 0.2, 0.12); smile(g, 1.0, 0.42, 0.17, true);
      for (const s of [-1, 1]) g.add(mesh(new THREE.SphereGeometry(0.07, 8, 6), M(0xff8a6a), [s * 0.36, 1.08, 0.3]));
      g.position.y = -0.05; return g;
    } }],
  },
  hotdog: {
    name: 'Hot dog', hides: ['head', 'hat', 'body', 'cape'],
    parts: [{ bone: 'hips', build() {
      const g = new THREE.Group(), bun = M(0xd9944a), saus = M(0xc0392b);
      for (const s of [-1, 1]) g.add(mesh(new THREE.CapsuleGeometry(0.32, 1.35, 4, 8), bun, [s * 0.33, 1.0, -0.05], [0, 0, 0], [1, 1, 0.9]));
      g.add(mesh(new THREE.CapsuleGeometry(0.34, 1.55, 4, 10), saus, [0, 1.1, 0.12]));
      const pts = []; for (let i = 0; i <= 14; i++) pts.push(new THREE.Vector3(Math.sin(i * 1.4) * 0.15, 0.35 + i * 0.1, 0.46 - Math.abs(Math.sin(i * 0.2)) * 0.02));
      g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.035, 6), M(0xffd400)));
      eyes(g, 1.55, 0.42, 0.15, 0.1); smile(g, 1.32, 0.46, 0.13, true);
      return g;
    } }],
  },
  dino: {
    name: 'Dinosauro', hides: ['hat'],
    parts: [
      { bone: 'head', build() {
        const g = new THREE.Group(), gr = M(0x5cbf4a), dk = M(0x3f8f32), w = M(0xffffff);
        g.add(mesh(new THREE.SphereGeometry(0.72, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.62), gr, [0, 0.5, -0.05], [0, 0, 0], [1, 1.05, 1.15]));
        g.add(mesh(new THREE.BoxGeometry(0.95, 0.32, 0.7), gr, [0, 1.0, 0.55], [0.15, 0, 0]));
        for (let i = 0; i < 6; i++) { const x = -0.36 + i * 0.145; g.add(mesh(new THREE.ConeGeometry(0.06, 0.14, 4), w, [x, 0.82, 0.85], [Math.PI, 0, 0])); }
        for (const s of [-1, 1]) { g.add(mesh(new THREE.SphereGeometry(0.13, 8, 6), w, [s * 0.3, 1.24, 0.5])); g.add(mesh(new THREE.SphereGeometry(0.06, 6, 5), M(0x111111), [s * 0.3, 1.26, 0.62])); g.add(mesh(new THREE.SphereGeometry(0.035, 6, 4), dk, [s * 0.14, 1.06, 0.9])); }
        for (let i = 0; i < 4; i++) g.add(mesh(new THREE.ConeGeometry(0.11, 0.26, 4), M(0xff9a3a), [0, 1.18 - i * 0.18, -0.45 - i * 0.2], [-0.6 - i * 0.25, 0, 0]));
        return g;
      } },
      { bone: 'hips', build() {
        const g = new THREE.Group(), gr = M(0x5cbf4a);
        let r = 0.28, z = -0.3, y = 0.15;
        for (let i = 0; i < 5; i++) { g.add(mesh(new THREE.SphereGeometry(r, 7, 5), gr, [0, y, z])); g.add(mesh(new THREE.ConeGeometry(r * 0.45, r * 0.9, 4), M(0xff9a3a), [0, y + r * 0.9, z])); z -= r * 1.2; y -= 0.06; r *= 0.78; }
        return g;
      } },
    ],
  },
  squalo: {
    name: 'Squalo', hides: ['hat'],
    parts: [{ bone: 'head', build() {
      const g = new THREE.Group(), gr = M(0x7f93a8), wh = M(0xeef3f6), w = M(0xffffff);
      g.add(mesh(new THREE.SphereGeometry(0.74, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.6), gr, [0, 0.48, -0.05], [0, 0, 0], [1, 1.15, 1.2]));
      g.add(mesh(new THREE.ConeGeometry(0.62, 0.7, 7), gr, [0, 1.05, 0.65], [Math.PI / 2 + 0.25, 0, 0], [1, 1, 0.55]));
      g.add(mesh(new THREE.ConeGeometry(0.22, 0.6, 3), gr, [0, 1.55, -0.2], [-0.35, 0, 0], [0.4, 1, 1]));
      for (let i = 0; i < 7; i++) { const a = (i / 6 - 0.5) * 2.2; g.add(mesh(new THREE.ConeGeometry(0.05, 0.13, 3), w, [Math.sin(a) * 0.55, 0.82, 0.55 + Math.cos(a) * 0.12], [Math.PI, 0, 0])); }
      for (const s of [-1, 1]) { g.add(mesh(new THREE.SphereGeometry(0.08, 6, 5), M(0x111111), [s * 0.55, 1.1, 0.45])); g.add(mesh(new THREE.BoxGeometry(0.02, 0.18, 0.1), M(0x5d6f82), [s * 0.66, 0.9, 0.15 + 0.08 * s * 0])); }
      g.add(mesh(new THREE.SphereGeometry(0.5, 8, 5, 0, Math.PI * 2, Math.PI * 0.6, Math.PI * 0.4), wh, [0, 0.95, 0.35], [0.3, 0, 0], [1, 0.5, 1]));
      return g;
    } }],
  },
  maiale: {
    name: 'Testa di maiale', hides: ['head', 'hat'],
    parts: [{ bone: 'head', build() {
      const g = new THREE.Group(), pk = M(0xf5a3b3), dk = M(0xe07d93);
      g.add(mesh(new THREE.SphereGeometry(0.62, 9, 7), pk, [0, 0.55, 0], [0, 0, 0], [1, 0.92, 0.95]));
      g.add(mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.22, 10), dk, [0, 0.42, 0.62], [Math.PI / 2, 0, 0]));
      for (const s of [-1, 1]) { g.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 6), M(0x5a2030), [s * 0.09, 0.42, 0.74], [Math.PI / 2, 0, 0])); g.add(mesh(new THREE.ConeGeometry(0.2, 0.36, 4), dk, [s * 0.42, 1.04, 0.05], [0.4, 0, s * 0.6])); }
      eyes(g, 0.72, 0.5, 0.24, 0.09, 1);
      smile(g, 0.2, 0.5, 0.12);
      return g;
    } }],
  },
  pollo: {
    name: 'Pollo', hides: ['head', 'hat'],
    parts: [{ bone: 'head', build() {
      const g = new THREE.Group(), wh = M(0xfbfbf4), red = M(0xe32d2d), yel = M(0xffb400);
      g.add(mesh(new THREE.SphereGeometry(0.58, 9, 7), wh, [0, 0.58, 0], [0, 0, 0], [0.95, 1.1, 0.95]));
      for (let i = 0; i < 3; i++) g.add(mesh(new THREE.SphereGeometry(0.15 - i * 0.02, 6, 5), red, [0, 1.2 - i * 0.02, 0.15 - i * 0.2]));
      g.add(mesh(new THREE.ConeGeometry(0.15, 0.36, 4), yel, [0, 0.55, 0.68], [Math.PI / 2, 0, 0]));
      g.add(mesh(new THREE.SphereGeometry(0.09, 6, 5), red, [0, 0.33, 0.58], [0, 0, 0], [1, 1.6, 1]));
      eyes(g, 0.8, 0.45, 0.22, 0.09);
      return g;
    } }],
  },
  cactus: {
    name: 'Cactus', hides: ['head', 'hat', 'body', 'cape'],
    parts: [{ bone: 'hips', build() {
      const g = new THREE.Group(), gr = M(0x3fa34d), dk = M(0x2c7a38), fl = M(0xff5fa2);
      g.add(mesh(new THREE.CapsuleGeometry(0.52, 1.5, 4, 8), gr, [0, 1.15, 0]));
      for (const s of [-1, 1]) { g.add(mesh(new THREE.CapsuleGeometry(0.17, 0.45, 3, 6), gr, [s * 0.75, 1.35, 0])); g.add(mesh(new THREE.CapsuleGeometry(0.17, 0.3, 3, 6), gr, [s * 0.58, 1.12, 0], [0, 0, s * Math.PI / 2])); }
      for (let i = 0; i < 26; i++) { const a = i * 2.4, y = 0.5 + (i % 9) * 0.2; const sp = mesh(new THREE.ConeGeometry(0.018, 0.12, 3).rotateX(Math.PI / 2), M(0xfff4c2), [Math.cos(a) * 0.53, y, Math.sin(a) * 0.53]); sp.lookAt(Math.cos(a) * 2, y, Math.sin(a) * 2); g.add(sp); }
      g.add(mesh(new THREE.SphereGeometry(0.16, 7, 5), fl, [0.15, 2.18, 0.1]));
      eyes(g, 1.6, 0.47, 0.18, 0.1); smile(g, 1.35, 0.5, 0.13, true);
      return g;
    } }],
  },
};

// ---------- cappelli buffi ----------
export const FUN_HATS = {
  unicorno: { name: 'Corno di unicorno', build() { const g = new THREE.Group(); g.add(mesh(new THREE.ConeGeometry(0.13, 0.7, 8), M(0xfff1a8, { metalness: 0.2 }), [0, 1.35, 0.22], [0.25, 0, 0])); for (let i = 0; i < 4; i++) g.add(mesh(new THREE.SphereGeometry(0.13, 6, 5), M([0xff7ac8, 0x9b7bff, 0x6ad4ff, 0xffd34a][i]), [-0.3 + i * 0.2, 1.08 - Math.abs(i - 1.5) * 0.05, -0.35])); return g; } },
  cono: { name: 'Cono stradale', build() { const g = new THREE.Group(); g.add(mesh(new THREE.ConeGeometry(0.32, 0.8, 10), M(0xff6a00), [0, 1.42, 0])); g.add(mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.12, 10), M(0xffffff), [0, 1.42, 0])); g.add(mesh(new THREE.BoxGeometry(0.75, 0.06, 0.75), M(0xff6a00), [0, 1.05, 0])); return g; } },
  pentola: { name: 'Pentola', build() { const g = new THREE.Group(); const m = M(0xb8c2cc, { metalness: 0.8, roughness: 0.35 }); g.add(mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.42, 14, 1, true), m, [0, 1.2, 0])); g.add(mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.03, 14), m, [0, 1.41, 0])); g.add(mesh(new THREE.BoxGeometry(0.5, 0.05, 0.08), M(0x222222), [0.6, 1.25, 0])); return g; } },
  elica: { name: 'Cappellino a elica', build() { const g = new THREE.Group(); for (let i = 0; i < 4; i++) g.add(mesh(new THREE.SphereGeometry(0.46, 8, 5, i * Math.PI / 2, Math.PI / 2, 0, Math.PI / 2), M([0xff4d4d, 0xffd34a, 0x4dc3ff, 0x6ad46a][i]), [0, 1.0, 0])); g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.2), M(0x333333), [0, 1.53, 0])); const p = new THREE.Group(); p.position.set(0, 1.63, 0); p.add(mesh(new THREE.BoxGeometry(0.7, 0.02, 0.1), M(0xffd34a))); p.userData.spin = 14; g.add(p); g.userData.spin = p; return g; } },
  corona: { name: 'Corona', build() { const g = new THREE.Group(); const m = M(0xffd34a, { metalness: 0.9, roughness: 0.3 }); g.add(mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.24, 8, 1, true), new THREE.MeshStandardMaterial({ color: 0xffd34a, metalness: 0.9, roughness: 0.3, side: THREE.DoubleSide, flatShading: true }), [0, 1.2, 0])); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; g.add(mesh(new THREE.ConeGeometry(0.07, 0.2, 4), m, [Math.cos(a) * 0.42, 1.4, Math.sin(a) * 0.42])); } g.add(mesh(new THREE.SphereGeometry(0.07, 6, 5), M(0xe0245e), [0, 1.22, 0.43])); return g; } },
  pizza: { name: 'Pizza', build() { const g = new THREE.Group(); g.add(mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.06, 16), M(0xe8b05a), [0, 1.12, 0], [0.12, 0, 0])); g.add(mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.065, 16), M(0xd7352a), [0, 1.13, 0], [0.12, 0, 0])); for (let i = 0; i < 7; i++) { const a = i * 2.1, r = 0.15 + (i % 3) * 0.13; g.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.07, 8), M(i % 2 ? 0xa3201f : 0xfff3d0), [Math.cos(a) * r, 1.17, Math.sin(a) * r], [0.12, 0, 0])); } return g; } },
};
