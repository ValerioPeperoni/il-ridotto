import asyncio, sys, time
from playwright.async_api import async_playwright
async def main():
    mode = sys.argv[1] if len(sys.argv)>1 else 'classica'
    tag = sys.argv[2] if len(sys.argv)>2 else 'X'
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
        pg = await b.new_page(viewport={'width':960,'height':540})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: m.type in ('error','warning') and errs.append(m.text))
        await pg.goto(f'http://localhost:8123/bowling.html?debug&auto={mode}&frames=2&peer=127.0.0.1:9')
        t0=time.time()
        while time.time()-t0<120:
            await pg.wait_for_timeout(1000)
            if await pg.evaluate("!!window.__G"): break
        print('loaded', round(time.time()-t0), errs[:5], flush=True)
        last=''; seen=set()
        while time.time()-t0 < 700:
            await pg.wait_for_timeout(500)
            st = await pg.evaluate("JSON.stringify({ph:__G.phase, cur:__G.cur, spec:__G.spec, sc:__G.players.map(p=>p.sheet&&p.sheet.frames.map(f=>f.join(',')).join('|')), big:document.querySelector('#big').classList.contains('show')?document.querySelector('#big').textContent:''})")
            ph = st.split('"ph":"')[1].split('"')[0]
            key=ph
            if ph in ('aim','roll','deck','react','sweep','replay') and key not in seen:
                seen.add(key)
                if ph=='aim':
                    for k in range(5):
                        await pg.wait_for_timeout(350); await pg.screenshot(path=f'test/{tag}_{mode}_aim{k}.png')
                await pg.screenshot(path=f'test/{tag}_{mode}_{ph}.png', timeout=120000)
            if st!=last: print(round(time.time()-t0), st, flush=True); last=st
            if ph=='over': await pg.wait_for_timeout(1500); await pg.screenshot(path=f'test/{tag}_{mode}_over.png'); break
        print('errs', errs[:8]); await b.close()
asyncio.run(main())
