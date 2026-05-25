import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        
        page.on("console", lambda msg: print(f"Browser Console: {msg.type}: {msg.text}"))
        page.on("pageerror", lambda err: print(f"Browser Error: {err}"))
        
        await page.goto("http://localhost:5174/#access_token=foo&type=recovery")
        await page.wait_for_timeout(2000)
        
        await browser.close()

asyncio.run(main())
