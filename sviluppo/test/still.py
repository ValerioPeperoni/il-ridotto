import asyncio, sys
from playwright.async_api import async_playwright
# uso: still.py pagina out.png cam1 out1 cam2 out2 ...
async def main():
    page=sys.argv[1]; pairs=list(zip(sys.argv[2::2], sys.argv[3::2]))
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
        pg = await b.new_page(viewport={'width':960,'height':540})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        for cam,out in pairs:
            await pg.goto(f"http://localhost:8123/{page}?debug&peer=127.0.0.1:9&cam={cam}")
            for i in range(150):
                await pg.wait_for_timeout(1000)
                if await pg.evaluate("!!window.__G"): break
            await pg.wait_for_timeout(5000)
            await pg.screenshot(path=out)
        print('errs', errs[:5]); await b.close()
asyncio.run(main())
