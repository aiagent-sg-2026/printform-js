import { test, expect } from "@playwright/test";

test.use({ serviceWorkers: "block" });
for (const width of [320, 390, 768, 1440]) {
  test(`Gallery controls retain readable input text and touch sizes at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/gallery/index.html");
    await expect(page.locator("#search")).toBeEnabled();
    for (const locale of ["en", "zh"]) {
      await page.locator(`[data-language="${locale}"]`).click();
      for (const selector of ["#search", "#type-filter", "#paper-filter"]) {
        const control = page.locator(selector);
        expect(await control.evaluate(node => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(16);
        expect((await control.boundingBox()).height).toBeGreaterThanOrEqual(44);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    }
    await page.locator("#search").fill("PF-064");
    await expect(page.locator(".gallery-card")).toHaveCount(1);
    const card = page.locator(".gallery-card");
    await card.click();
    await expect(page.locator("[data-close]")).toBeFocused();
    for (const selector of ["[data-close]", "[data-open]", "[data-print]"]) {
      const box = await page.locator(selector).boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.y + box.height).toBeLessThanOrEqual(844);
    }
    await page.keyboard.press("Escape");
    await expect(card).toBeFocused();
    await page.locator("#clear-filters").click();
    expect(await page.locator(".gallery-card").count()).toBeGreaterThan(1);
  });
}
