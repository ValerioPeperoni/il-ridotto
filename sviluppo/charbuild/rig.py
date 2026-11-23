# Legge lo scheletro del personaggio Quaternius (gltf) e calcola le posizioni delle ossa a riposo (mondo, Y in su).
import json, numpy as np
def qmat(q):
    x, y, z, w = q
    return np.array([[1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)], [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)], [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)]])
def load(path):
    j = json.load(open(path)); nodes = j['nodes']
    parent = {}
    for i, n in enumerate(nodes):
        for c in n.get('children', []): parent[c] = i
    def local(i):
        n = nodes[i]; M = np.eye(4)
        M[:3, :3] = qmat(n.get('rotation', [0, 0, 0, 1])) @ np.diag(n.get('scale', [1, 1, 1])); M[:3, 3] = n.get('translation', [0, 0, 0]); return M
    W = {}
    def world(i):
        if i in W: return W[i]
        M = local(i); W[i] = (world(parent[i]) @ M) if i in parent else M; return W[i]
    joints = j['skins'][0]['joints']
    names = [nodes[i]['name'] for i in joints]
    pos = {nodes[i]['name']: world(i)[:3, 3].copy() for i in joints}
    rot = {nodes[i]['name']: world(i)[:3, :3].copy() for i in joints}
    par = {nodes[i]['name']: nodes[parent[i]]['name'] for i in joints if i in parent}
    return names, pos, rot, par
if __name__ == '__main__':
    names, pos, rot, par = load('/home/claude/ridotto/site/assets/sport/Superhero_Male_FullBody.gltf')
    for n in names:
        if any(k in n for k in ['pelvis', 'spine', 'neck', 'Head', 'clavicle_r', 'upperarm_r', 'lowerarm_r', 'hand_r', 'thigh_r', 'calf_r', 'foot_r', 'ball_r', 'index_01_r', 'thumb_01_r', 'middle_03_r', 'root']):
            print(n, np.round(pos[n], 3))
