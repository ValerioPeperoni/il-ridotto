import asyncio, time
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
        pg = await b.new_page(viewport={'width':960,'height':540})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8123/bowling.html?debug&peer=127.0.0.1:9')
        for i in range(120):
            await pg.wait_for_timeout(1000)
            if await pg.evaluate("!!window.__G"): break
        await pg.screenshot(path='test/L_lobby.png')
        await pg.fill('#localName','Valerio'); await pg.click('#addLocal'); await pg.click('[data-f="3"]'); await pg.click('#start')
        await pg.wait_for_timeout(2500); await pg.screenshot(path='test/L_aim.png')
        await pg.mouse.move(480,300); await pg.mouse.down()
        for k in range(12): await pg.mouse.move(470-k*2,300+k*16); await pg.wait_for_timeout(60)
        await pg.wait_for_timeout(800); await pg.screenshot(path='test/L_back.png')
        await pg.mouse.up(); await pg.wait_for_timeout(300); await pg.screenshot(path='test/L_rel.png')
        await pg.wait_for_timeout(1500); await pg.screenshot(path='test/L_roll.png')
        for i in range(60):
            await pg.wait_for_timeout(1000)
            ph = await pg.evaluate("__G.phase")
            if ph in ('react','replay'): await pg.wait_for_timeout(2500); await pg.screenshot(path='test/L_react.png'); break
        print(await pg.evaluate("JSON.stringify(__G.players.map(p=>p.sheet.frames))"), errs[:5]); await b.close()
asyncio.run(main())
