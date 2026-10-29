import { test, expect } from "@playwright/test";
import { galleryServer } from "./gallery-upgrade-server.js";
test.use({ serviceWorkers: "allow" });
test.describe.configure({ mode: "serial" });
let server;
test.beforeAll(async () => { server = await galleryServer(); });
test.afterAll(async () => { await server?.close(); });

test("topbar loaded build, languages, responsive controls and long status", async ({ page }, info) => {
  await page.goto(server.url);
  await expect(page.locator(".gallery-card")).toHaveCount(67);
  await expect(page.locator("#running-version")).toHaveText("aaaaaaaaaaaa");
  for (const width of [320, 390, 801, 1440]) for (const language of ["en", "zh"]) {
    await page.setViewportSize({ width, height: 844 });
    await page.locator('[data-language="' + language + '"]').click();
    const check = page.locator("#check-update");
    await expect(check).toHaveText(language === "en" ? "Check for updates" : "检查更新");
    await expect(check).toBeEnabled();
    await page.locator('[data-language="zh"]').focus();
    await page.keyboard.press("Tab");
    await expect(check).toBeFocused();
    expect(await check.evaluate(e => e.matches(":focus-visible"))).toBe(true);
    const metrics = await page.locator(".topbar").evaluate(bar => ({
      rect: bar.getBoundingClientRect().toJSON(),
      buttons: [...bar.querySelectorAll("button")].map(e => e.getBoundingClientRect().toJSON()),
      overflow: document.documentElement.scrollWidth > innerWidth
    }));
    expect(metrics.overflow).toBe(false);
    for (const rect of metrics.buttons) {
      expect(rect.width).toBeGreaterThanOrEqual(44); expect(rect.height).toBeGreaterThanOrEqual(44);
      expect(rect.left).toBeGreaterThanOrEqual(0); expect(rect.right).toBeLessThanOrEqual(width);
      expect(rect.top).toBeGreaterThanOrEqual(metrics.rect.top); expect(rect.bottom).toBeLessThanOrEqual(metrics.rect.bottom);
    }
    await page.screenshot({ path: info.outputPath(width + "-" + language + ".png") });
  }
  await page.locator("#search").focus();
  await page.evaluate(() => scrollTo(0, 600));
  await expect(page.locator(".topbar")).toHaveClass(/topbar-hidden/);
  await page.keyboard.press("Shift+Tab");
  await expect(page.locator("#check-update")).toBeFocused();
  await expect.poll(async () => (await page.locator("#check-update").boundingBox()).y).toBeGreaterThanOrEqual(0);
  await page.evaluate(() => scrollTo(0, 0));
  await page.setViewportSize({ width: 320, height: 844 });
  // Layout-only worst-case fixture, not a fabricated production build.
  await page.locator("#running-version").evaluate(e => e.textContent = "a".repeat(80));
  await page.locator("#update-state").evaluate(e => e.textContent = "Updates are not supported in this browser. Update failed. Retry when online.");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const bar = await page.locator(".topbar").boundingBox(), state = await page.locator("#update-state").boundingBox();
  expect(state.y + state.height).toBeLessThanOrEqual(bar.y + bar.height);
  await page.screenshot({ path: info.outputPath("320-long-status.png") });
  await page.setViewportSize({ width: 801, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("801-long-status.png") });
});

test("real workers: check current, offline, failure, then explicit N to N+1 activation", async ({ page, context }, info) => {
  test.setTimeout(90000);
  await page.goto(server.url + "?q=PF-027&paper=LETTER");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect(page.locator("#running-version")).toHaveText("aaaaaaaaaaaa");
  const check = page.locator("#check-update");
  await check.focus(); await page.keyboard.press("Enter");
  await expect(page.locator("#update-state")).toHaveText("Up to date");
  await context.setOffline(true);
  await check.click();
  await expect(page.locator("#update-state")).toHaveText("Offline");
  await context.setOffline(false);
  server.switchBuild("b", true);
  await check.click();
  await expect(page.locator("#update-state")).toHaveText("Update failed. Retry when online.", { timeout: 35000 });
  await page.screenshot({ path: info.outputPath("check-error.png") });
  await expect(page.locator("#running-version")).toHaveText("aaaaaaaaaaaa");
  await page.evaluate(() => localStorage.setItem("topbar-synthetic-user-data", "preserve"));
  let reloads = 0;
  page.on("framenavigated", frame => { if (frame === page.mainFrame()) reloads++; });
  server.switchBuild("b");
  await check.click();
  await expect(page.locator("#update-banner")).toContainText("bbbbbbbbbbbb", { timeout: 35000 });
  await expect(page.locator("#running-version")).toHaveText("aaaaaaaaaaaa");
  expect(reloads).toBe(0);
  await page.locator(".gallery-card").click();
  await expect(page.locator("#update-button")).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(page.locator("#update-button")).toBeEnabled();
  await page.screenshot({ path: info.outputPath("waiting-build.png") });
  await page.locator("#update-button").click();
  await expect(page.locator("#running-version")).toHaveText("bbbbbbbbbbbb", { timeout: 20000 });
  await expect(page.locator("#search")).toHaveValue("PF-027");
  await expect(page).toHaveURL(/q=PF-027&paper=LETTER/);
  expect(reloads).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem("topbar-synthetic-user-data"))).toBe("preserve");
  await page.screenshot({ path: info.outputPath("updated-build.png") });
});
