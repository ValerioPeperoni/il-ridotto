# Aggiorna la versione: ?v= negli HTML, BUILD nel telecomando e build.txt
import re, glob, time, sys
root = sys.argv[1] if len(sys.argv) > 1 else '/home/claude/ridotto/site'
v = time.strftime('%Y%m%d%H%M')
for f in glob.glob(root + '/*.html'):
    s = open(f).read(); n = re.sub(r'\?v=\d{12}', '?v=' + v, s)
    if n != s: open(f, 'w').write(n)
t = root + '/telecomando.js'; s = open(t).read()
s = re.sub(r"const BUILD = '[^']*';", f"const BUILD = '{v}';", s); open(t, 'w').write(s)
open(root + '/build.txt', 'w').write(v + '\n')
print(v)
