# Personaggi stile "Mii": corpo da uno scheletro di punti con raggi (modificatore Skin di Blender +
# suddivisione => superficie liscia e pulita, niente bozzi), testa grande, mani a pallina.
# Riusa da build.py lo scheletro, i pesi, le scarpe, la testa e i capelli.
import json, sys, math, numpy as np
sys.argv = [sys.argv[0]]
import build as B
from build import P, V, lerp, Part, sd_ellipsoid, sd_roundcone, smin, mesh_from, decimate, pack, head_uv, HC, body_parts, shoe_parts, head_parts, hair_parts

for _s in ('r', 'l'): B.GROUPS['mitt_' + _s] = ['hand_' + _s]
HEAD_S = float(__import__('os').environ.get('HEAD_S', '1.36'))

def skin_body(female=False):
    import bpy, bmesh
    w = 0.95 if female else 1.0
    nodes, radii, edges = [], [], []
    def add(p, r, parent=None):
        nodes.append(list(p)); radii.append(r); i = len(nodes) - 1
        if parent is not None: edges.append((parent, i))
        return i
    pel = add((0, 0.93, -0.01), (0.19 * (1.06 if female else 1), 0.15))
    bel = add((0, 1.08, 0.0), (0.18 * w, 0.145), pel)
    che = add((0, 1.27, 0.0), (0.2 * w, 0.145), bel)
    nec = add((0, 1.47, -0.025), (0.07, 0.068), che)
    for s in (-1, 1):
        sd = 'l' if s > 0 else 'r'
        ua, la, ha = P['upperarm_' + sd], P['lowerarm_' + sd], P['hand_' + sd]
        sh = add((s * 0.15, 1.41, -0.035), (0.085, 0.085), che)
        u = add(ua + V(s * 0.02, 0, 0), (0.075 * w, 0.075 * w), sh)
        e = add(la, (0.063 * w, 0.063 * w), u)
        add(ha - V(s * 0.015, 0, 0), (0.05, 0.05), e)
    for s in (-1, 1):
        sd = 'l' if s > 0 else 'r'
        th, ca, ft = P['thigh_' + sd], P['calf_' + sd], P['foot_' + sd]
        h = add(th + V(s * -0.01, -0.03, 0), (0.115, 0.115), pel)
        k = add(ca, (0.083, 0.083), h)
        add(ft + V(0, 0.05, 0.025), (0.064, 0.064), k)
    me = bpy.data.meshes.new('sk'); me.from_pydata(nodes, edges, []); me.update()
    ob = bpy.data.objects.new('sk', me); bpy.context.collection.objects.link(ob)
    sm = ob.modifiers.new('skin', 'SKIN'); sm.branch_smoothing = 0.6; sm.use_smooth_shade = True
    for i, r in enumerate(radii):
        sv = me.skin_vertices[0].data[i]; sv.radius = r; sv.use_root = (i == 0)
    ss = ob.modifiers.new('sub', 'SUBSURF'); ss.levels = 3; ss.render_levels = 3
    dg = bpy.context.evaluated_depsgraph_get(); e = ob.evaluated_get(dg); em = e.to_mesh()
    bm = bmesh.new(); bm.from_mesh(em); bmesh.ops.triangulate(bm, faces=bm.faces)
    v = np.array([x.co[:] for x in bm.verts]); f = np.array([[x.index for x in fa.verts] for fa in bm.faces])
    bm.free(); e.to_mesh_clear(); bpy.data.objects.remove(ob); bpy.data.meshes.remove(me)
    return v, f

def mitten_parts(sd):
    # mano "a pallina" come i Mii, con un pollice morbido appena accennato
    h, m1, t1 = P['hand_' + sd], P['middle_01_' + sd], P['thumb_01_' + sd]
    c = lerp(h, m1, 0.45)
    tip = lerp(h, t1, 1.5) + V(0, 0.0, 0.01)
    def f(p):
        d = sd_ellipsoid(p, c, V(0.064, 0.057, 0.06))
        return smin(d, sd_ellipsoid(p, lerp(h, t1, 1.1), V(0.03, 0.028, 0.03)), 0.035)
    return [Part('palm', 'skin', 'mitt_' + sd, f, 0.02)]

def scaled(v, s):
    return HC + (v - HC) * s

def build(female):
    print('corpo2', 'F' if female else 'M', flush=True)
    v, f = skin_body(female)
    body = pack(v, f, body_parts(female))
    sp = shoe_parts(); v, f = mesh_from(sp, (-0.25, -0.01, -0.22), (0.25, 0.16, 0.25), 0.005); v, f = decimate(v, f, 0.07)
    shoes = pack(v, f, sp)
    hands = []
    for sd in ('r', 'l'):
        hp = mitten_parts(sd); h = P['hand_' + sd]
        v, f = mesh_from(hp, h - V(0.16, 0.09, 0.09), h + V(0.16, 0.09, 0.09), 0.004); v, f = decimate(v, f, 0.12)
        hands.append(pack(v, f, hp))
    hp = head_parts(female); v, f = mesh_from(hp, HC - V(0.17, 0.18, 0.17), HC + V(0.17, 0.17, 0.19), 0.005); v, f = decimate(v, f, 0.16)
    uv = head_uv(v)                      # UV calcolate sulla testa originale: la faccia resta al suo posto
    head = pack(scaled(v, HEAD_S), f, [Part(p.tag, p.region, p.group, (lambda g: lambda q: g(HC + (q - HC) / HEAD_S))(p.f), p.k) for p in hp])
    head.update(uv)
    return {'body': body, 'shoes': shoes, 'handR': hands[0], 'handL': hands[1], 'head': head}

if __name__ == '__main__':
    out = {'joints': B.names, 'M': build(False), 'F': build(True), 'hair': {}, 'headScale': HEAD_S}
    for st in ('short', 'spiky', 'bob', 'ponytail', 'buns', 'afro', 'long', 'beard'):
        print('capelli', st, flush=True)
        hp = hair_parts(st); v, f = mesh_from(hp, HC - V(0.22, 0.42, 0.26), HC + V(0.22, 0.32, 0.22), 0.0055); v, f = decimate(v, f, 0.12)
        out['hair'][st] = pack(scaled(v, HEAD_S), f, [Part(p.tag, p.region, p.group, (lambda g: lambda q: g(HC + (q - HC) / HEAD_S))(p.f), p.k, p.hard) for p in hp])
    s = json.dumps(out, separators=(',', ':'))
    open('/home/claude/ridotto/site/assets/sport/sportsmates.json', 'w').write(s)
    print('ok', len(s) // 1024, 'KB')
