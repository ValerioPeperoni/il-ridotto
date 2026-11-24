# Costruisce i personaggi "sportivi" stilizzati (testa grande, forme morbide, vestiti veri) sullo
# scheletro Quaternius già usato dal gioco: stesse ossa, quindi funzionano tutte le animazioni.
# Superfici implicite (capsule e ellissoidi uniti in modo morbido) -> marching cubes -> Blender
# (decimazione e lisciatura) -> pesi della pelle calcolati sulle ossa -> JSON per three.js.
import json, sys, math, numpy as np
from skimage.measure import marching_cubes
from rig import load

RIG = '/home/claude/ridotto/site/assets/sport/Superhero_Male_FullBody.gltf'
names, P, R, PAR = load(RIG)
P = {k: np.array(v, dtype=np.float64) for k, v in P.items()}
CHILD = {}
for n in names:
    if n in PAR and PAR[n] in P and PAR[n] not in CHILD: CHILD[PAR[n]] = n
CHILD['clavicle_r'] = 'upperarm_r'; CHILD['clavicle_l'] = 'upperarm_l'; CHILD['spine_03'] = 'neck_01'; CHILD['hand_r'] = 'middle_01_r'; CHILD['hand_l'] = 'middle_01_l'
CHILD['pelvis'] = 'spine_01'; CHILD['foot_r'] = 'ball_r'; CHILD['foot_l'] = 'ball_l'

def V(*a): return np.array(a, dtype=np.float64)
def lerp(a, b, t): return a + (b - a) * t

# ---------- primitive SDF (vettorizzate) ----------
def sd_roundcone(p, a, b, ra, rb):
    ba = b - a; l2 = ba @ ba; t = np.clip(((p - a) @ ba) / l2, 0, 1)
    c = a + t[..., None] * ba; return np.linalg.norm(p - c, axis=-1) - (ra + (rb - ra) * t)
def sd_ellipsoid(p, c, r):
    q = (p - c) / r; k0 = np.linalg.norm(q, axis=-1); k1 = np.linalg.norm(q / r, axis=-1)
    return k0 * (k0 - 1.0) / np.maximum(k1, 1e-9)
def smin(a, b, k):
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0, 1); return b * (1 - h) + a * h - k * h * (1 - h)

class Part:
    def __init__(s, tag, region, group, f, k=0.03, hard=False): s.tag, s.region, s.group, s.f, s.k, s.hard = tag, region, group, f, k, hard

def body_parts(female=False):
    L = []
    sp3, sp1, pel = P['spine_03'], P['spine_01'], P['pelvis']
    if not female:
        L.append(Part('chest', 'shirt', 'torso', lambda p: sd_ellipsoid(p, sp3 + V(0, 0.0, 0.02), V(0.175, 0.16, 0.125)), 0.07))
        L.append(Part('belly', 'shirt', 'torso', lambda p: sd_ellipsoid(p, sp1 + V(0, 0.03, 0.015), V(0.16, 0.15, 0.122)), 0.09))
        L.append(Part('hips', 'shorts', 'torso', lambda p: sd_ellipsoid(p, pel + V(0, -0.02, 0.01), V(0.16, 0.115, 0.115)), 0.05))
    else:
        L.append(Part('chest', 'shirt', 'torso', lambda p: sd_ellipsoid(p, sp3 + V(0, -0.005, 0.015), V(0.155, 0.15, 0.115)), 0.07))
        for s in (-1, 1): L.append(Part('bust', 'shirt', 'torso', (lambda s: lambda p: sd_ellipsoid(p, sp3 + V(0.062 * s, -0.045, 0.085), V(0.06, 0.055, 0.05)))(s), 0.05))
        L.append(Part('belly', 'shirt', 'torso', lambda p: sd_ellipsoid(p, sp1 + V(0, 0.03, 0.01), V(0.135, 0.14, 0.11)), 0.07))
        L.append(Part('hips', 'shorts', 'torso', lambda p: sd_ellipsoid(p, pel + V(0, -0.03, 0.0), V(0.172, 0.12, 0.12)), 0.06))
    # spalle (trapezio + deltoide) nel tronco: raccordano collo e braccio, niente maniche "a palloncino"
    for s in (-1, 1):
        ua = P['upperarm_l' if s > 0 else 'upperarm_r']
        L.append(Part('shoulder', 'shirt', 'torso', (lambda s, ua: lambda p: sd_roundcone(p, V(s * 0.045, 1.425, -0.02), ua + V(-s * 0.02, -0.02, 0.012), 0.072, 0.066 if not female else 0.06))(s, ua), 0.07))
    L.append(Part('neck', 'skin', 'torso', lambda p: sd_roundcone(p, P['neck_01'] + V(0, -0.04, 0), P['Head'] + V(0, 0.02, 0.005), 0.066, 0.056), 0.05))
    for sd in ('r', 'l'):
        ua, la, ha = P['upperarm_' + sd], P['lowerarm_' + sd], P['hand_' + sd]
        th, ca, ft, bl = P['thigh_' + sd], P['calf_' + sd], P['foot_' + sd], P['ball_' + sd]
        sh = 1 if sd == 'l' else -1
        arm = 'arm_' + sd; leg = 'leg_' + sd
        # (niente 'spalline': si staccavano dal braccio alzato)
        L.append(Part('sleeve', 'shirt', arm, (lambda ua, la: lambda p: np.maximum(sd_roundcone(p, ua + (la - ua) * 0.03, lerp(ua, la, 0.6), 0.064, 0.06), (p - lerp(ua, la, 0.48)) @ ((la - ua) / np.linalg.norm(la - ua))))(ua, la), 0.0, True))
        L.append(Part('uarm', 'skin', arm, (lambda ua, la: lambda p: sd_roundcone(p, ua, la, 0.059, 0.05))(ua, la), 0.02))
        L.append(Part('farm', 'skin', arm, (lambda la, ha: lambda p: sd_roundcone(p, la, ha + V(sh * 0.01, 0, 0), 0.051, 0.04))(la, ha), 0.02))
        L.append(Part('shortleg', 'shorts', leg, (lambda th, ca: lambda p: np.maximum(sd_roundcone(p, th + V(0, 0.03, 0), lerp(th, ca, 0.7), 0.1 if female else 0.096, 0.08), (p - lerp(th, ca, 0.6)) @ ((ca - th) / np.linalg.norm(ca - th))))(th, ca), 0.0, True))
        L.append(Part('thigh', 'skin', leg, (lambda th, ca: lambda p: sd_roundcone(p, th, ca, 0.086, 0.062))(th, ca), 0.03))
        L.append(Part('shin', 'skin', leg, (lambda ca, ft: lambda p: sd_roundcone(p, ca, ft + V(0, 0.03, 0), 0.062, 0.045))(ca, ft), 0.03))
        L.append(Part('calfm', 'skin', leg, (lambda ca, ft: lambda p: sd_ellipsoid(p, lerp(ca, ft, 0.25) + V(0, 0, -0.018), V(0.055, 0.1, 0.055)))(ca, ft), 0.04))
    return L

def shoe_parts():
    L = []
    for sd in ('r', 'l'):
        ft, bl = P['foot_' + sd], P['ball_' + sd]
        toe = bl + V(0, 0.0, 0.075); heel = V(ft[0], 0.05, ft[2] - 0.06)
        def f(p, ft=ft, toe=toe, heel=heel):
            d = sd_roundcone(p, heel, V(toe[0], 0.045, toe[2]), 0.058, 0.05)
            d = smin(d, sd_ellipsoid(p, V(ft[0], 0.07, ft[2] - 0.0), V(0.058, 0.07, 0.075)), 0.03)
            return np.maximum(d, -(p[..., 1] - 0.002))  # suola piatta
        L.append(Part('shoe', 'shoes', 'shoe_' + sd, f, 0.0, True))
        # suola bianca leggermente più larga
        def g(p, ft=ft, toe=toe, heel=heel):
            d = sd_roundcone(p, heel + V(0, -0.025, 0), V(toe[0], 0.02, toe[2] + 0.006), 0.063, 0.055)
            return np.maximum(np.maximum(d, -(p[..., 1] - 0.0)), p[..., 1] - 0.028)
        L.append(Part('sole', 'sole', 'shoe_' + sd, g, 0.0, True))
    return L

def hand_parts(sd):
    L = []; h = P['hand_' + sd]
    m1 = P['middle_01_' + sd]
    L.append(Part('palm', 'skin', 'hand_' + sd, lambda p: sd_ellipsoid(p, lerp(h, m1, 0.55) + V(0, -0.004, 0.0), V(0.058, 0.024, 0.05)), 0.012))
    for f, r0, r1 in (('index', 0.0125, 0.0105), ('middle', 0.013, 0.011), ('ring', 0.0125, 0.0105), ('pinky', 0.011, 0.0092), ('thumb', 0.0145, 0.0115)):
        ch = [P[f'{f}_0{k}_{sd}'] for k in (1, 2, 3)] + [P[f'{f}_04_leaf_{sd}']]
        for k in range(3):
            L.append(Part('finger', 'skin', 'hand_' + sd, (lambda a, b, ra, rb: lambda p: sd_roundcone(p, a, b, ra, rb))(ch[k], ch[k + 1], lerp(r0, r1, k / 3), lerp(r0, r1, (k + 1) / 3)), 0.006))
    L.append(Part('wrist', 'skin', 'hand_' + sd, lambda p: sd_roundcone(p, h + (h - m1) * 0.35, lerp(h, m1, 0.3), 0.036, 0.04), 0.015))
    return L

HC = P['Head'] + V(0, 0.105, 0.012)  # centro della testa
def head_parts(female=False):
    L = []
    L.append(Part('cranium', 'face', 'head', lambda p: sd_ellipsoid(p, HC, V(0.142, 0.152, 0.145)), 0.05))
    L.append(Part('jaw', 'face', 'head', lambda p: sd_ellipsoid(p, HC + V(0, -0.06, 0.022), V(0.112 if not female else 0.105, 0.092, 0.115)), 0.05))
    L.append(Part('nose', 'face', 'head', lambda p: sd_ellipsoid(p, HC + V(0, -0.028, 0.142), V(0.019, 0.024, 0.018)), 0.02))
    for s in (-1, 1): L.append(Part('ear', 'face', 'head', (lambda s: lambda p: sd_ellipsoid(p, HC + V(0.138 * s, -0.014, -0.005), V(0.02, 0.036, 0.026)))(s), 0.012))
    return L

# ---------- capigliature (sulla testa, legate all'osso Head) ----------
def hair_parts(style):
    L = []; c = HC
    cap = lambda p, r=V(0.152, 0.162, 0.156), off=V(0, 0.01, -0.006): sd_ellipsoid(p, c + off, r)
    def cut_front(d, p, y0):  # niente capelli sulla faccia: taglio con un piano inclinato davanti
        face = (p[..., 2] - c[2] - 0.07) * 0.9 - (p[..., 1] - c[1] - y0) * 0.6
        return np.maximum(d, -face) if False else np.maximum(d, np.minimum(-(p[..., 1] - (c[1] + y0)), face * -1) * -1 if False else d)
    def facecut(p, y0, zf=0.05):
        # tiene solo dove (y > y0) oppure (z < zf): niente capelli su occhi e guance
        # frangia con riga di lato: più alta da una parte, curva sulla fronte
        yy = c[1] + y0 + 0.22 * (p[..., 0] - c[0]) - 0.9 * (p[..., 0] - c[0]) ** 2
        return np.minimum(-(p[..., 1] - yy), (p[..., 2] - (c[2] + zf)))
    if style == 'short':
        f = lambda p: np.maximum(cap(p), facecut(p, 0.035, -0.02))
        L.append(Part('hair', 'hair', 'head', lambda p: np.maximum(f(p), -(p[..., 1] - (c[1] - 0.07 - 0.09 * np.clip((c[2] - p[..., 2]) / 0.12, 0, 1)))), 0.0, True))
    elif style == 'spiky':
        def f(p):
            d = np.maximum(cap(p), facecut(p, 0.04, -0.02)); d = np.maximum(d, -(p[..., 1] - (c[1] - 0.06 - 0.09 * np.clip((c[2] - p[..., 2]) / 0.12, 0, 1))))
            for k in range(7):
                a = -1.2 + k * 0.4; tip = c + V(math.sin(a) * 0.1, 0.22, math.cos(a) * 0.065 - 0.02)
                d = smin(d, sd_roundcone(p, c + V(math.sin(a) * 0.065, 0.09, math.cos(a) * 0.045 - 0.02), tip, 0.055, 0.012), 0.025)
            return d
        L.append(Part('hair', 'hair', 'head', f, 0.0, True))
    elif style == 'bob':
        def f(p):
            d = sd_ellipsoid(p, c + V(0, 0.0, -0.012), V(0.166, 0.176, 0.166))
            d = np.maximum(d, facecut(p, 0.045, -0.035)); return np.maximum(d, -(p[..., 1] - (c[1] - 0.12)))
        L.append(Part('hair', 'hair', 'head', f, 0.0, True))
    elif style == 'ponytail':
        def f(p):
            d = np.maximum(cap(p), facecut(p, 0.04, -0.03)); d = np.maximum(d, -(p[..., 1] - (c[1] - 0.06 - 0.09 * np.clip((c[2] - p[..., 2]) / 0.12, 0, 1))))
            d = smin(d, sd_roundcone(p, c + V(0, 0.06, -0.135), c + V(0, -0.15, -0.2), 0.048, 0.032), 0.03)
            return smin(d, sd_ellipsoid(p, c + V(0, 0.045, -0.155), V(0.038, 0.032, 0.032)), 0.02)
        L.append(Part('hair', 'hair', 'head', f, 0.0, True))
    elif style == 'buns':
        def f(p):
            d = np.maximum(cap(p), facecut(p, 0.04, -0.03)); d = np.maximum(d, -(p[..., 1] - (c[1] - 0.06 - 0.09 * np.clip((c[2] - p[..., 2]) / 0.12, 0, 1))))
            for s in (-1, 1): d = smin(d, sd_ellipsoid(p, c + V(0.095 * s, 0.145, -0.02), V(0.06, 0.06, 0.06)), 0.02)
            return d
        L.append(Part('hair', 'hair', 'head', f, 0.0, True))
    elif style == 'afro':
        def f(p):
            d = sd_ellipsoid(p, c + V(0, 0.05, -0.02), V(0.205, 0.19, 0.195))
            return np.maximum(np.maximum(d, facecut(p, 0.05, -0.01)), -(p[..., 1] - (c[1] - 0.05)))
        L.append(Part('hair', 'hair', 'head', f, 0.0, True))
    elif style == 'beard':
        def f(p):
            d = sd_ellipsoid(p, c + V(0, -0.06, 0.024), V(0.122, 0.102, 0.126))
            d = np.maximum(d, (p[..., 1] - (c[1] - 0.045)))           # solo sotto gli zigomi
            d = np.maximum(d, -(p[..., 2] - (c[2] - 0.02)))           # solo davanti
            mouth = sd_ellipsoid(p, c + V(0, -0.075, 0.13), V(0.04, 0.014, 0.05))
            return np.maximum(d, -mouth)
        L.append(Part('hair', 'hair', 'head', f, 0.0, True))
    elif style == 'long':
        def f(p):
            d = sd_ellipsoid(p, c + V(0, 0.005, -0.015), V(0.163, 0.175, 0.163))
            d = smin(d, sd_roundcone(p, c + V(0, -0.02, -0.075), c + V(0, -0.28, -0.1), 0.13, 0.095), 0.05)
            d = np.maximum(d, facecut(p, 0.045, -0.03)); return np.maximum(d, -(p[..., 1] - (c[1] - 0.32)))
        L.append(Part('hair', 'hair', 'head', f, 0.0, True))
    return L

# ---------- unione, marching cubes ----------
def field(parts, grid):
    d = None; owner = None
    for i, pt in enumerate(parts):
        di = pt.f(grid).astype(np.float32)
        if d is None: d, owner = di, np.zeros(di.shape, np.int16)
        else:
            nd = np.minimum(d, di) if (pt.hard or pt.k <= 0) else smin(d, di, pt.k).astype(np.float32)
            owner = np.where(di < d, i, owner); d = nd
    return d, owner

def mesh_from(parts, lo, hi, step):
    xs = [np.arange(lo[i], hi[i] + step, step) for i in range(3)]
    X, Y, Z = np.meshgrid(*xs, indexing='ij'); grid = np.stack([X, Y, Z], -1)
    d, owner = field(parts, grid)
    verts, faces, normals, _ = marching_cubes(d, 0.0, spacing=(step, step, step))
    verts += np.array(lo)
    return verts, faces

def owner_at(parts, v):
    ds = np.stack([pt.f(v) for pt in parts], -1); return np.argmin(ds, -1)

def decimate(verts, faces, ratio, smooth=1):
    import bpy, bmesh
    me = bpy.data.meshes.new('m'); me.from_pydata(verts.tolist(), [], faces.tolist()); me.update()
    ob = bpy.data.objects.new('o', me); bpy.context.collection.objects.link(ob)
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.triangulate(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
    m = ob.modifiers.new('d', 'DECIMATE'); m.ratio = ratio
    if smooth: s = ob.modifiers.new('s', 'SMOOTH'); s.factor = 0.5; s.iterations = smooth
    dg = bpy.context.evaluated_depsgraph_get(); e = ob.evaluated_get(dg); em = e.to_mesh()
    bm = bmesh.new(); bm.from_mesh(em); bmesh.ops.triangulate(bm, faces=bm.faces)
    v = np.array([x.co[:] for x in bm.verts]); f = np.array([[x.index for x in fa.verts] for fa in bm.faces])
    bm.free(); e.to_mesh_clear(); bpy.data.objects.remove(ob); bpy.data.meshes.remove(me)
    return v, f

# ---------- pesi della pelle ----------
GROUPS = {
    'torso': ['pelvis', 'spine_01', 'spine_02', 'spine_03', 'neck_01', 'clavicle_l', 'clavicle_r', 'upperarm_l', 'upperarm_r', 'thigh_l', 'thigh_r'],
    'head': ['Head', 'neck_01'],
}
for sd in ('r', 'l'):
    GROUPS['arm_' + sd] = ['upperarm_' + sd, 'lowerarm_' + sd, 'hand_' + sd]
    GROUPS['leg_' + sd] = ['pelvis', 'thigh_' + sd, 'calf_' + sd, 'foot_' + sd]
    GROUPS['shoe_' + sd] = ['foot_' + sd, 'ball_' + sd]
    GROUPS['hand_' + sd] = ['hand_' + sd] + [f'{f}_0{k}_{sd}' for f in ('index', 'middle', 'ring', 'pinky', 'thumb') for k in (1, 2, 3)]
def seg(b):
    a = P[b]; c = CHILD.get(b)
    if c and c in P: return a, P[c]
    pa = P[PAR[b]] if b in PAR and PAR[b] in P else a - V(0, 0.05, 0)
    return a, a + (a - pa) / max(1e-6, np.linalg.norm(a - pa)) * 0.03
def seg_dist(v, a, b):
    ba = b - a; t = np.clip(((v - a) @ ba) / max(1e-9, ba @ ba), 0, 1); return np.linalg.norm(v - (a + t[:, None] * ba), axis=1)
def weights(v, groups):
    n = len(v); idx = np.zeros((n, 4), np.int32); w = np.zeros((n, 4), np.float32)
    for g in set(groups):
        sel = np.where(groups == g)[0]
        if not len(sel): continue
        bones = GROUPS[g]; D = np.stack([seg_dist(v[sel], *seg(b)) for b in bones], 1)
        W = 1.0 / np.maximum(D, 0.012) ** 5
        K = min(4, len(bones)); order = np.argsort(-W, 1)[:, :K]
        Wt = np.take_along_axis(W, order, 1); Wt /= Wt.sum(1, keepdims=True)
        Wt[Wt < 0.02] = 0; Wt /= Wt.sum(1, keepdims=True)
        idx[sel, :K] = np.array([names.index(bones[k]) for k in range(len(bones))])[order]; w[sel, :K] = Wt
    return idx, w

def seg_t(v, a, b):
    ba = b - a; return ((v - a) @ ba) / (ba @ ba)
def pack(v, f, parts, extra=None):
    own = owner_at(parts, v)
    groups = np.array([parts[i].group for i in own]); regions = [parts[i].region for i in own]
    tags = [parts[i].tag for i in own]
    waist = P['pelvis'][1] + 0.075
    lim = np.zeros((len(v), 2), np.float32)  # tipo (0 tronco, 1 braccio, 2 gamba, 3 fisso), parametro lungo l'osso (o altezza)
    for k in range(len(v)):
        g = groups[k]
        if g == 'torso':
            # sopra il petto: colletto = distanza orizzontale dall'asse del collo (girocollo pulito); sotto: altezza (girovita)
            if v[k][1] > 1.38: lim[k] = (4, math.hypot(v[k][0], v[k][2] + 0.03))
            else: lim[k] = (0, v[k][1])
        elif g.startswith('arm_'): lim[k] = (1, seg_t(v[k], P['upperarm_' + g[-1]], P['lowerarm_' + g[-1]]))
        elif g.startswith('leg_'): lim[k] = (2, seg_t(v[k], P['thigh_' + g[-1]], P['calf_' + g[-1]]) if v[k][1] < waist - 0.004 else -1)
        else: lim[k] = (3, 0)
    for k in range(len(v)):
        g, y = groups[k], v[k][1]
        if g == 'torso':
            if y > 1.38: r = math.hypot(v[k][0], v[k][2] + 0.03); regions[k] = 'skin' if r < 0.082 else ('trim' if r < 0.094 else 'shirt')
            else: regions[k] = 'shirt' if y > waist + 0.012 else ('trim' if y > waist - 0.004 else 'shorts')
        elif g.startswith('arm_'):
            sd = g[-1]; t = seg_t(v[k], P['upperarm_' + sd], P['lowerarm_' + sd])
            regions[k] = 'shirt' if t < 0.44 else ('trim' if t < 0.485 else 'skin')
        elif g.startswith('leg_'):
            sd = g[-1]; t = seg_t(v[k], P['thigh_' + sd], P['calf_' + sd])
            if y > waist - 0.004: regions[k] = 'shorts'
            else: regions[k] = 'shorts' if t < 0.56 else ('trim' if t < 0.605 else 'skin')
    idx, w = weights(v, groups)
    # spalla morbida: vicino all'attaccatura il braccio segue in parte la clavicola (niente "palle" quando si alza)
    for k in range(len(v)):
        g = groups[k]
        if g.startswith('arm_'):
            sd = g[-1]; t = seg_t(v[k], P['upperarm_' + sd], P['lowerarm_' + sd])
            if t < 0.32:
                wu = float(np.clip((t + 0.12) / 0.44, 0.25, 1.0))
                ui = names.index('upperarm_' + sd); ci = names.index('clavicle_' + sd)
                cur = {int(idx[k, j]): float(w[k, j]) for j in range(4) if w[k, j] > 0}
                tot = sum(cur.values()); cur = {b: x / tot * wu for b, x in cur.items()}; cur[ci] = cur.get(ci, 0) + (1 - wu)
                items = sorted(cur.items(), key=lambda x: -x[1])[:4]
                idx[k] = 0; w[k] = 0
                for j, (b, x) in enumerate(items): idx[k, j] = b; w[k, j] = x
                w[k] /= w[k].sum()
    R = {'skin': 0, 'shirt': 1, 'shorts': 2, 'shoes': 3, 'sole': 4, 'face': 0, 'hair': 0, 'trim': 5}
    import base64
    b64 = lambda a: base64.b64encode(a.tobytes()).decode()
    out = {'lim': b64(lim), 'pos': b64(v.astype(np.float32)), 'idx': b64(f.astype(np.uint16)), 'si': b64(idx.astype(np.uint8)), 'sw': b64(np.round(w * 255).astype(np.uint8)), 'reg': b64(np.array([R[r] for r in regions], np.uint8))}
    if extra: out.update(extra(v))
    return out

def head_uv(v):
    d = v - HC; u = 0.5 + np.arctan2(d[:, 0], d[:, 2]) / (2 * np.pi); vv = 0.5 + d[:, 1] / 0.34
    import base64
    return {'uv': base64.b64encode(np.stack([u, vv], 1).astype(np.float32).tobytes()).decode()}

def build(female):
    print('corpo', 'F' if female else 'M', flush=True)
    bp = body_parts(female)
    v, f = mesh_from(bp, (-0.75, -0.02, -0.25), (0.75, 1.72, 0.27), 0.009); v, f = decimate(v, f, 0.16)
    body = pack(v, f, bp)
    sp = shoe_parts(); v, f = mesh_from(sp, (-0.25, -0.01, -0.22), (0.25, 0.16, 0.25), 0.005); v, f = decimate(v, f, 0.07)
    shoes = pack(v, f, sp)
    hands = []
    for sd in ('r', 'l'):
        hp = hand_parts(sd); h = P['hand_' + sd]; lo = h - V(0.03, 0.06, 0.08) if sd == 'r' else h - V(0.0, 0.06, 0.08)
        lo = V(min(h[0], P['middle_04_leaf_' + sd][0]) - 0.06, h[1] - 0.07, h[2] - 0.08); hi = V(max(h[0], P['middle_04_leaf_' + sd][0]) + 0.06, h[1] + 0.05, h[2] + 0.1)
        v, f = mesh_from(hp, lo, hi, 0.0035); v, f = decimate(v, f, 0.09); hands.append(pack(v, f, hp))
    hp = head_parts(female); v, f = mesh_from(hp, HC - V(0.17, 0.18, 0.17), HC + V(0.17, 0.17, 0.19), 0.005); v, f = decimate(v, f, 0.16)
    head = pack(v, f, hp, head_uv)
    return {'body': body, 'shoes': shoes, 'handR': hands[0], 'handL': hands[1], 'head': head}

if __name__ == '__main__':
    out = {'joints': names, 'M': build(False), 'F': build(True), 'hair': {}}
    for st in ('short', 'spiky', 'bob', 'ponytail', 'buns', 'afro', 'long', 'beard'):
        print('capelli', st, flush=True)
        hp = hair_parts(st); v, f = mesh_from(hp, HC - V(0.22, 0.42, 0.26), HC + V(0.22, 0.32, 0.22), 0.0055); v, f = decimate(v, f, 0.12)
        out['hair'][st] = pack(v, f, hp)
    s = json.dumps(out, separators=(',', ':'))
    open('/home/claude/ridotto/site/assets/sport/sportsmates.json', 'w').write(s)
    print('ok', len(s) // 1024, 'KB')
