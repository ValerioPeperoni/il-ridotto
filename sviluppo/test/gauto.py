import asyncio, sys, time
from playwright.async_api import async_playwright
async def main():
    tag=sys.argv[1]; dur=int(sys.argv[2]); every=float(sys.argv[3]); extra=sys.argv[4] if len(sys.argv)>4 else ''
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
        pg = await b.new_page(viewport={'width':960,'height':540})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: (m.type=='error' or 'knock' in m.text) and errs.append(m.text[:160]))
        await pg.goto('http://localhost:8123/golf.html?debug&peer=127.0.0.1:9&auto'+extra)
        t0=time.time()
        for i in range(150):
            await pg.wait_for_timeout(1000)
            if await pg.evaluate("!!window.__G"): break
        print('loaded', round(time.time()-t0), errs[:3], flush=True)
        k=0; t1=time.time()
        while time.time()-t1<dur:
            await pg.wait_for_timeout(int(every*1000))
            st=await pg.evaluate("JSON.stringify({ph:__G.phase,h:__G.hole,t:__G.time.toFixed(1),p:__G.players.map(p=>[p.state,p.strokes,p.score,p.item||'',p.ball&&p.ball.moving?1:0,p.done?1:0]),b:__G.players.map(p=>p.ball&&[p.ball.pos.x.toFixed(2),p.ball.pos.y.toFixed(2),p.ball.pos.z.toFixed(2),p.ball.vel.length().toFixed(3),p.ball.air?1:0])})")
            print(round(time.time()-t0), st, flush=True)
            await pg.screenshot(path=f'test/{tag}_{k}.png'); k+=1
        print('errs', [e for e in errs if 'WebSocket' not in e][:12]); await b.close()
asyncio.run(main())
