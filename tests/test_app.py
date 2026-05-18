"""
MusicPlayerPro E2E Tests — Playwright
Start dev server first: npm run dev
Then run: python tests/test_app.py
"""
from playwright.sync_api import sync_playwright, expect
import sys

BASE = "http://localhost:5173"

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 390, "height": 844})
        page.set_default_timeout(5000)

        # ——— Test 1: Page loads ———
        print("[1/6] Page load & tabs...")
        page.goto(BASE, wait_until="networkidle")
        page.wait_for_timeout(500)
        # verify tabs exist
        tabs = page.locator("a").all()
        hrefs = [a.get_attribute("href") for a in tabs if a.get_attribute("href")]
        assert "/now-playing" in hrefs, f"Missing now-playing tab, got {hrefs}"
        assert "/playlists" in hrefs, "Missing playlists tab"
        assert "/artists" in hrefs, "Missing artists tab"
        assert "/favorites" in hrefs, "Missing favorites tab"
        print("  ✓ All tabs present")

        # ——— Test 2: Search bar visible ———
        print("[2/6] Search bar...")
        search_input = page.locator("input[placeholder]").first
        expect(search_input).to_be_visible()
        print("  ✓ Search bar visible")

        # ——— Test 3: Navigate to playlists ———
        print("[3/6] Navigate to playlists...")
        page.click("a[href='/playlists']")
        page.wait_for_load_state("networkidle")
        expect(page.locator("h1")).to_contain_text("歌单")
        print("  ✓ Playlists page loaded")

        # ——— Test 4: Navigate to artists ———
        print("[4/6] Navigate to artists...")
        page.click("a[href='/artists']")
        page.wait_for_load_state("networkidle")
        expect(page.locator("h1")).to_contain_text("歌手")
        print("  ✓ Artists page loaded")

        # ——— Test 5: Navigate to favorites ———
        print("[5/6] Navigate to favorites...")
        page.click("a[href='/favorites']")
        page.wait_for_load_state("networkidle")
        expect(page.locator("h1")).to_contain_text("收藏")
        print("  ✓ Favorites page loaded")

        # ——— Test 6: Back to Now Playing, verify empty state ———
        print("[6/6] Now Playing empty state...")
        page.click("a[href='/now-playing']")
        page.wait_for_load_state("networkidle")
        # empty state should show or search bar should be visible
        expect(page.locator("input[placeholder]")).to_be_visible()
        print("  ✓ Now Playing loaded")

        # ——— Done ———
        print("\n✅ All 6 tests passed")
        browser.close()

if __name__ == "__main__":
    run()
