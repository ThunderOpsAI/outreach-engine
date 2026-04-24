import sys
import json
import asyncio
from urllib.parse import urlparse
import ipaddress
import socket
from playwright.async_api import async_playwright


def is_internal_url(url: str) -> bool:
    """SSRF protection: reject localhost, 127.x, 10.x, 192.168.x, 169.254.x"""
    try:
        parsed = urlparse(url)
        scheme = parsed.scheme
        hostname = parsed.hostname

        if scheme not in ('http', 'https'):
            return True

        if not hostname:
            return True

        if hostname == 'localhost':
            return True

        if len(url) > 2048:
            return True

        ip = socket.gethostbyname(hostname)
        ip_obj = ipaddress.ip_address(ip)
        return ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_link_local
    except Exception:
        return True


async def scrape(url: str) -> dict:
    """Scrape a URL with Playwright. Returns scraped data or error dict."""
    if is_internal_url(url):
        return {"error": "SCRAPE_FAILED", "reason": "Internal URL rejected"}

    browser = None
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context()
            page = await context.new_page()

            # 3000ms hard timeout
            await page.goto(url, timeout=3000, wait_until="domcontentloaded")

            # Extract title
            title = await page.title()

            # Extract meta description
            meta_element = await page.query_selector('meta[name="description"]')
            meta = ""
            if meta_element:
                meta = await meta_element.get_attribute("content") or ""

            # Extract h1-h3 headings
            headings = []
            for tag in ['h1', 'h2', 'h3']:
                elements = await page.query_selector_all(tag)
                for el in elements:
                    text = await el.inner_text()
                    if text:
                        headings.append(text.strip())

            # Body text (first 500 words)
            body_element = await page.query_selector('body')
            body_text = ""
            if body_element:
                body_text = await body_element.inner_text()
            words = body_text.split()
            first_500_words = " ".join(words[:500])

            await context.close()
            await browser.close()
            browser = None

            return {
                "title": title,
                "meta": meta,
                "headings": headings,
                "body": first_500_words
            }
    except Exception as e:
        if browser:
            try:
                await browser.close()
            except Exception:
                pass
        return {"error": "SCRAPE_FAILED", "reason": str(e)}


async def main():
    try:
        if len(sys.argv) > 1:
            try:
                input_data = json.loads(sys.argv[1])
            except json.JSONDecodeError:
                input_data = {"url": sys.argv[1]}
        else:
            input_text = sys.stdin.read()
            input_data = json.loads(input_text)

        url = input_data.get("url")
        if not url:
            print(json.dumps({"error": "SCRAPE_FAILED", "reason": "No URL provided"}))
            return

        result = await scrape(url)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": "SCRAPE_FAILED", "reason": str(e)}))


if __name__ == "__main__":
    asyncio.run(main())
