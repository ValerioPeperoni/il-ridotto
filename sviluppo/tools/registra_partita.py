# Registra una partita a passi fissi: fotogrammi + traccia della palla
import asyncio, sys, json, os
from playwright.async_api import async_playwright
url, frames, out = sys.argv[1], int(sys.argv[2]), sys.argv[3]
every = int(sys.argv[4]) if len(sys.argv) > 4 else 1   # salva un fotogramma ogni N
os.makedirs(out, exist_ok=True)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
        pg = await b.new_page(viewport={'width':640,'height':360})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
        await pg.goto(url)
        for i in range(120):
            await pg.wait_for_timeout(500)
            if await pg.evaluate("!!window.__adv && !!window.__G && __G.phase!=='lobby'"): break
        k = 0
        for f in range(frames):
            await pg.evaluate("__adv(1)")
            if f % every == 0:
                await pg.screenshot(path=f'{out}/f{k:05d}.jpg', type='jpeg', quality=70); k += 1
        tr = await pg.evaluate("JSON.stringify({trace: __G.trace || [], log: __G.log || [], score: __G.score, st: {ph: __G.phase, srv: __G.serving, toss: __G.toss, ideal: __G.ideal && {t: __G.ideal.t, tried: __G.ideal.tried}, cpu: __G.cpuSwing, time: __G.time, ball: __G.ball && [__G.ball.x, __G.ball.y, __G.ball.z, __G.ball.held]}})")
        open(f'{out}/trace.json','w').write(tr)
        print('frames', k, 'errs', errs[:5]); await b.close()
asyncio.run(main())
