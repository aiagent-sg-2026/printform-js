import { test, expect } from "@playwright/test";
const catalogueCount = 64;
const category = (page, id) => page.locator(`#category-filters [data-filter-value="${id}"]`);
test.use({ serviceWorkers: "block" });

test("categories combine with compact filters, keep focus and restore history", async ({ page }) => {
  await page.goto("/gallery/index.html");
  await expect(page.locator(".gallery-card")).toHaveCount(catalogueCount);
  await page.locator("#advanced-toggle").click();
  await expect(page.locator("#category-filters button")).toHaveCount(8);
  await expect(page.locator(".gallery-card .card-id").first()).toHaveText("PF-063");
  await expect(page.locator(".gallery-card .card-id").last()).toHaveText("PF-001");
  await page.locator('[data-language="zh"]').focus();
  await page.keyboard.press("Tab");
  await expect(page.locator("#search")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator("#advanced-toggle")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(category(page, "all")).toBeFocused();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(category(page, "sales")).toBeFocused();
  await expect(page.locator("#result-count")).toHaveText("18/64 designs");
  await page.locator("#type-filter").selectOption("Quotation");
  await expect(page.locator(".gallery-card")).toHaveCount(3);
  await page.locator("#paper-filter").selectOption("A4");
  await page.locator("#search").fill("PF-004");
  await expect(page.locator("#search")).toBeFocused();
  await expect(page.locator(".gallery-card")).toHaveCount(1);
  await page.locator("#search").fill("no such design");
  await expect(page.locator("#empty-state")).toBeVisible();
  await page.goBack();
  await expect(page.locator("#search")).toHaveValue("");
  await expect(page.locator(".gallery-card")).toHaveCount(3);
  await page.goForward();
  await expect(page.locator("#search")).toHaveValue("no such design");
  await page.locator("#clear-filters").click();
  await expect(page.locator(".gallery-card")).toHaveCount(catalogueCount);
  await expect(page).not.toHaveURL(/category=|type=|paper=|q=/);
  await page.locator("#type-filter").selectOption("Quotation");
  await category(page, "purchasing").click();
  await expect(page.locator("#type-filter")).toHaveValue("all");
  await expect(page.locator(".gallery-card")).toHaveCount(7);
});

test("URL state is safe, reloadable and bilingual", async ({ page }) => {
  await page.goto("/gallery/index.html?category=sales&type=Quotation&paper=A4&q=PF-004");
  await expect(page.locator(".gallery-card")).toHaveCount(1);
  await page.reload();
  await expect(page.locator("#search")).toHaveValue("PF-004");
  await page.locator('[data-language="zh"]').click();
  await expect(category(page, "sales")).toHaveText("销售 (18)");
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
  await expect(page.locator("#advanced-toggle")).toBeDisabled();
  await expect.poll(() => Boolean(finish)).toBe(true);
  await finish();
  await expect(page.locator("#load-status")).toContainText("Could not load designs");
  await expect(page.locator("#empty-state")).toBeHidden();
  await page.unroute("**/gallery/manifest.json");
  await page.locator("#retry-load").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".gallery-card")).toHaveCount(catalogueCount);
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
    await expect(page.locator(".gallery-card")).toHaveCount(catalogueCount);
    await page.locator(`[data-language="${language}"]`).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator("#advanced-toggle").click();
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
  await expect(page.locator(".gallery-card")).toHaveCount(catalogueCount);
});

test.describe("offline category navigation", () => {
  test.use({ serviceWorkers: "allow" });
  test("precache supports reload and filtering without the network", async ({ page, context }) => {
    await page.goto("/gallery/index.html");
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await expect(page.locator(".gallery-card")).toHaveCount(catalogueCount);
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator(".gallery-card")).toHaveCount(catalogueCount);
    await page.locator("#advanced-toggle").click();
    await category(page, "hr-administration").click();
    await expect(page.locator("#result-count")).toHaveText("4/64 designs");
    await page.locator("#type-filter").selectOption("Work Order");
    await expect(page.locator(".gallery-card")).toHaveCount(1);
    await category(page, "sales").click();
    await page.locator("#search").fill("PF-053");
    await expect(page.locator(".gallery-card")).toHaveCount(1);
    await page.locator(".gallery-card").click();
    await expect(page.locator("[data-print]")).toBeEnabled();
    await expect(page.frameLocator("iframe").locator(".printform_page")).toHaveCount(1);
    await page.locator("[data-close]").click();
    await page.locator("#search").fill("PF-054");
    await expect(page.locator(".gallery-card")).toHaveCount(1);
    await page.locator(".gallery-card").click();
    await expect(page.locator("[data-print]")).toBeEnabled();
    await expect(page.frameLocator("iframe").locator(".printform_page")).toHaveCount(5);
    await page.locator("[data-close]").click();
    await category(page, "sales").click();
    await page.locator("#search").fill("PF-055");
    await expect(page.locator(".gallery-card")).toHaveCount(1);
    await page.locator(".gallery-card").click();
    await expect(page.locator("[data-print]")).toBeEnabled();
    await expect(page.frameLocator("iframe").locator(".printform_page")).toHaveCount(20);
    await page.locator("[data-close]").click();
    await category(page, "finance").click();
    await page.locator("#search").fill("PF-056");
    await expect(page.locator(".gallery-card")).toHaveCount(1);
    await page.locator(".gallery-card").click();
    await expect(page.locator("[data-print]")).toBeEnabled();
    await expect(page.frameLocator("iframe").locator(".printform_page")).toHaveCount(4);
    await page.locator("[data-close]").click();
    await page.locator("#search").fill("PF-057");
    await expect(page.locator(".gallery-card")).toHaveCount(1);
    await page.locator(".gallery-card").click();
    await expect(page.locator("[data-print]")).toBeEnabled();
    await expect(page.frameLocator("iframe").locator(".printform_page")).toHaveCount(2);
    await expect(page.frameLocator("iframe").locator(".pf057-warning")).toHaveCount(2);
    await page.locator("[data-close]").click();
    await category(page, "sales").click();
    for (let number = 58; number <= 63; number++) {
      await page.locator("#search").fill(`PF-${String(number).padStart(3, "0")}`);
      await expect(page.locator(".gallery-card")).toHaveCount(1);
      await page.locator(".gallery-card").click();
      await expect(page.locator("[data-print]")).toBeEnabled();
      await expect(page.frameLocator("iframe").locator(".printform_page")).toHaveCount(1);
      await expect(page.frameLocator("iframe").locator("#print")).toBeEnabled();
      await page.locator("[data-close]").click();
    }
    await context.setOffline(false);
  });
});

test("closing a modal after history navigation restores a connected focus target", async ({ page }) => {
  await page.goto("/gallery/index.html");
  await page.locator("#advanced-toggle").click();
  await category(page, "sales").click();
  const id = await page.locator(".gallery-card").first().getAttribute("data-design-id");
  await page.locator(".gallery-card").first().click();
  await expect(page.locator("[data-print]")).toBeEnabled();
  await page.goBack();
  await expect(category(page, "all")).toHaveAttribute("aria-pressed", "true");
  await page.locator("[data-close]").click();
  await expect(page.locator(".gallery-card").filter({ has: page.locator(`.card-id`, { hasText: "PF-063" }) })).toBeFocused();
  expect(await page.locator(":focus").getAttribute("data-design-id")).toBe(id);
  await category(page, "purchasing").click();
  await category(page, "sales").click();
  await page.locator(".gallery-card").first().click();
  await expect(page.locator("[data-print]")).toBeEnabled();
  await page.goBack();
  await expect(category(page, "purchasing")).toHaveAttribute("aria-pressed", "true");
  await page.locator("[data-close]").click();
  await expect(page.locator("#search")).toBeFocused();
});

for (const overflow of [false, true]) {
  test(`PF053 real-engine ${overflow ? "overflow" : "default"} keeps rows and final totals intact`, async ({ page, browserName }, testInfo) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`/gallery/designs/sanyo-green-sales-quotation.html${overflow ? "?overflow=1" : ""}`);
    await page.waitForFunction(() => window.__printFormProcessed === true);
    const pages = page.locator(".printform_page");
    const count = await pages.count();
    if (overflow) expect(count).toBeGreaterThan(1);
    else expect(count).toBe(1);
    const metrics = await pages.evaluateAll((pages) => pages.map((page) => {
      const bounds = page.getBoundingClientRect();
      return {
        rows: [...page.querySelectorAll("[data-sample-row]")].map((row) => Number(row.dataset.sampleRow)),
        totals: page.querySelectorAll("#total").length,
        header: page.querySelectorAll("h1").length,
        number: page.querySelector("[data-page-number]")?.textContent,
        totalPages: page.querySelector("[data-page-total]")?.textContent,
        outside: [...page.querySelectorAll(".item-grid,.summary,.terms,.acceptance,.page-foot,.brand,.parties")].filter((node) => {
          const box = node.getBoundingClientRect();
          return box.left < bounds.left - .1 || box.right > bounds.right + .1 || box.top < bounds.top - .1 || box.bottom > bounds.bottom + .1;
        }).map((node) => node.className)
      };
    }));
    expect(metrics.flatMap(({ rows }) => rows)).toEqual(Array.from({ length: overflow ? 35 : 5 }, (_, index) => index + 1));
    expect(metrics.reduce((sum, value) => sum + value.totals, 0)).toBe(1);
    expect(metrics.at(-1).totals).toBe(1);
    for (const [index, item] of metrics.entries()) {
      expect(item.header).toBe(1);
      expect(item.number).toBe(String(index + 1));
      expect(item.totalPages).toBe(String(count));
      expect(item.outside).toEqual([]);
    }
    await expect(page.locator("#total")).toHaveText(overflow ? "27,032.25" : "3,861.75");
    expect(errors).toEqual([]);
    if (browserName === "chromium") await page.pdf({ path: testInfo.outputPath(`sanyo-${overflow ? "overflow" : "default"}.pdf`), preferCSSPageSize: true, printBackground: true });
    await page.screenshot({ path: testInfo.outputPath(`sanyo-${overflow ? "overflow" : "default"}.jpg`), type: "jpeg", quality: 60, fullPage: true });
  });
}
