import json, sys, math
d = json.load(open(sys.argv[1])); tr = d['trace']
print('steps', len(tr), 'score', d['score'])
bad = []; hits = 0
for i in range(1, len(tr)):
    a, b = tr[i-1], tr[i]
    dv = math.dist(a[4:7], b[4:7]); dp = math.dist(a[1:4], b[1:4]); m = b[7]
    if 'H' in m or 'R' in m: hits += 1
    if any(c in m for c in 'HRtncfST'): continue
    if dv > 0.3 or dp > 0.2: bad.append((b[0], 'salto' if dp > 0.2 else 'deviazione', round(dv, 2), round(dp, 3), b[1:4]))
# palla quasi ferma a mezz'aria
slow = 0
for r in tr:
    sp = math.hypot(*r[4:7])
    if sp < 0.6 and r[2] > 0.85: slow += 1
    else:
        if slow > 150: bad.append((r[0], 'ferma in aria', slow / 480))
        slow = 0
print('colpi', hits, 'anomalie', len(bad))
for x in bad[:30]: print(x)
