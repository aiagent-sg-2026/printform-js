import { test, expect } from "@playwright/test";
const category = (page, id) => page.locator(`#category-filters [data-filter-value="${id}"]`);
test.use({ serviceWorkers: "block" });

test("categories combine with compact filters, keep focus and restore history", async ({ page }) => {
  await page.goto("/gallery/index.html");
  await expect(page.locator(".gallery-card")).toHaveCount(52);
  await expect(page.locator("#category-filters button")).toHaveCount(8);
  await page.locator('[data-language="zh"]').focus();
  await page.keyboard.press("Tab");
  await expect(category(page, "all")).toBeFocused();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(category(page, "sales")).toBeFocused();
  await expect(page.locator("#result-count")).toHaveText("9/52 designs");
  await page.locator("#type-filter").selectOption("Quotation");
  await expect(page.locator(".gallery-card")).toHaveCount(1);
  await page.locator("#paper-filter").selectOption("A4");
  await page.locator("#search").fill("PF-004");
  await expect(page.locator("#search")).toBeFocused();
  await expect(page.locator(".gallery-card")).toHaveCount(1);
  await page.locator("#search").fill("no such design");
  await expect(page.locator("#empty-state")).toBeVisible();
  await page.goBack();
  await expect(page.locator("#search")).toHaveValue("");
  await expect(page.locator(".gallery-card")).toHaveCount(1);
  await page.goForward();
  await expect(page.locator("#search")).toHaveValue("no such design");
  await page.locator("#clear-filters").click();
  await expect(page.locator(".gallery-card")).toHaveCount(52);
  await expect(page).not.toHaveURL(/category=|type=|paper=|q=/);
  await page.locator("#type-filter").selectOption("Quotation");
  await category(page, "purchasing").click();
  await expect(page.locator("#type-filter")).toHaveValue("all");
  await expect(page.locator(".gallery-card")).toHaveCount(6);
});

test("URL state is safe, reloadable and bilingual", async ({ page }) => {
  await page.goto("/gallery/index.html?category=sales&type=Quotation&paper=A4&q=PF-004");
  await expect(page.locator(".gallery-card")).toHaveCount(1);
  await page.reload();
  await expect(page.locator("#search")).toHaveValue("PF-004");
  await page.locator('[data-language="zh"]').click();
  await expect(category(page, "sales")).toHaveText("销售 (9)");
  await expect(page.locator("#active-filters")).toContainText("当前筛选");
  await page.locator("#clear-filters").click();
  await page.locator("#search").fill("北辰");
  await expect(page.locator(".gallery-card")).toHaveCount(1);
  await page.locator("#search").fill("Northstar");
  await expect(page.locator(".gallery-card")).toHaveCount(1);
  await page.goto("/gallery/index.html?category=unknown&type=bad&paper=bad&q=%3Cscript%3E");
  await expect(category(page, "all")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#active-filters")).toContainText("<script>");
  await expect(page.locator("#active-filters script")).toHaveCount(0);
  await expect(page.locator("#empty-state")).toBeVisible();
});

test("loading and failed manifests can be retried without duplicate controls", async ({ page }) => {
  let finish;
  await page.route("**/gallery/manifest.json", (route) => new Promise((resolve) => { finish = async () => { await route.fulfill({ status: 503, body: "unavailable" }); resolve(); }; }));
  await page.goto("/gallery/index.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#load-status")).toContainText("Loading designs");
  await expect(page.locator("#search")).toBeDisabled();
  await expect.poll(() => Boolean(finish)).toBe(true);
  await finish();
  await expect(page.locator("#load-status")).toContainText("Could not load designs");
  await expect(page.locator("#empty-state")).toBeHidden();
  await page.unroute("**/gallery/manifest.json");
  await page.locator("#retry-load").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".gallery-card")).toHaveCount(52);
  await expect(page.locator("#search")).toBeFocused();
  await expect(page.locator("#category-filters button")).toHaveCount(8);
  await expect(page.locator("#load-status")).toBeHidden();
});

test("modal retains ready-to-print, open-design and close-focus behavior", async ({ page }) => {
  await page.goto("/gallery/index.html?q=PF-004");
  const card = page.locator(".gallery-card").first();
  await card.click();
  await expect(page.locator("#design-modal")).toBeVisible();
  await expect(page.locator("[data-print]")).toBeEnabled();
  const frame = page.frames().find((frame) => frame.url().includes("/designs/"));
  await frame.evaluate(() => { window.print = () => { window.testPrintCalled = true; }; });
  await page.locator("[data-print]").click();
  expect(await frame.evaluate(() => window.testPrintCalled)).toBe(true);
  const [popup] = await Promise.all([page.waitForEvent("popup"), page.locator("[data-open]").click()]);
  await popup.waitForLoadState();
  expect(popup.url()).toBe(frame.url());
  await popup.close();
  await page.locator("[data-close]").click();
  await expect(card).toBeFocused();
  await card.press("Enter");
  await page.keyboard.press("Escape");
  await expect(card).toBeFocused();
});

for (const [name, width, colorScheme, language] of [["desktop-light", 1200, "light", "en"], ["mobile-dark-zh", 390, "dark", "zh"]]) {
  test(`responsive ${name} keeps controls within viewport`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme });
    await page.goto("/gallery/index.html");
    await expect(page.locator(".gallery-card")).toHaveCount(52);
    await page.locator(`[data-language="${language}"]`).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const control of await page.locator("#category-filters button, .controls select, #search").all()) {
      const box = await control.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    if (width === 1200) expect(await page.locator(".controls").evaluate((element) => element.offsetHeight)).toBeLessThan(300);
    await page.screenshot({ path: testInfo.outputPath(`${name}.jpg`), type: "jpeg", quality: 60 });
  });
}

test("malformed data shows a recoverable error rather than an empty gallery", async ({ page }) => {
  await page.route("**/gallery/manifest.json", (route) => route.fulfill({ json: [null] }));
  await page.goto("/gallery/index.html");
  await expect(page.locator("#load-status")).toContainText("Could not load designs");
  await expect(page.locator("#empty-state")).toBeHidden();
  await page.unroute("**/gallery/manifest.json");
  await page.locator("#retry-load").click();
  await expect(page.locator(".gallery-card")).toHaveCount(52);
});

test.describe("offline category navigation", () => {
  test.use({ serviceWorkers: "allow" });
  test("precache supports reload and filtering without the network", async ({ page, context }) => {
    await page.goto("/gallery/index.html");
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await expect(page.locator(".gallery-card")).toHaveCount(52);
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator(".gallery-card")).toHaveCount(52);
    await category(page, "hr-administration").click();
    await expect(page.locator("#result-count")).toHaveText("4/52 designs");
    await page.locator("#type-filter").selectOption("Work Order");
    await expect(page.locator(".gallery-card")).toHaveCount(1);
    await context.setOffline(false);
  });
});

test("closing a modal after history navigation restores a connected focus target", async ({ page }) => {
  await page.goto("/gallery/index.html");
  await category(page, "sales").click();
  const id = await page.locator(".gallery-card").first().getAttribute("data-design-id");
  await page.locator(".gallery-card").first().click();
  await page.goBack();
  await expect(category(page, "all")).toHaveAttribute("aria-pressed", "true");
  await page.locator("[data-close]").click();
  await expect(page.locator(".gallery-card").filter({ has: page.locator(`.card-id`, { hasText: "PF-001" }) })).toBeFocused();
  expect(await page.locator(":focus").getAttribute("data-design-id")).toBe(id);
  await category(page, "purchasing").click();
  await category(page, "sales").click();
  await page.locator(".gallery-card").first().click();
  await page.goBack();
  await expect(category(page, "purchasing")).toHaveAttribute("aria-pressed", "true");
  await page.locator("[data-close]").click();
  await expect(page.locator("#search")).toBeFocused();
});
