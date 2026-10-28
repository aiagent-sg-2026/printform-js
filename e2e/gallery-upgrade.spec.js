import { test, expect } from "@playwright/test";
import { galleryServer } from "./gallery-upgrade-server.js";

test.use({ serviceWorkers: "allow" });
test.describe.configure({ mode: "serial" });
let server;
test.beforeAll(async () => { server = await galleryServer(); });
test.afterAll(async () => { await server?.close(); });
test.beforeEach(() => server.switchBuild("a"));
async function ready(page, url) {
  await page.goto(url || server.url);
  await expect(page.locator("#result-count")).toContainText("/64");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect(page.locator("#running-version")).toHaveText("aaaaaaaaaaaa");
}

test("real A to B waiting worker, safe manual activation, immutable old tab and offline", async ({ page, context }, info) => {
  test.setTimeout(90000);
  await ready(page, `${server.url}?category=sales&paper=A4&q=PF-062`);
  const other = await context.newPage();
  await ready(other);
  let navigations = 0;
  page.on("framenavigated", (frame) => { if (frame === page.mainFrame()) navigations++; });
  server.switchBuild("b");
  await page.locator("#check-update").click();
  await expect(page.locator("#update-banner")).toContainText("bbbbbbbbbbbb", { timeout: 35000 });
  await expect(page.locator("#running-version")).toHaveText("aaaaaaaaaaaa");
  expect(await page.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration()).waiting))).toBe(true);
  await page.reload();
  await expect(page.locator("#running-version")).toHaveText("aaaaaaaaaaaa");
  await expect(page.locator("#update-button")).toBeEnabled();
  navigations = 0;
  await page.locator(".gallery-card").click();
  await expect(page.locator("[data-print]")).toBeEnabled();
  await expect(page.locator("#update-button")).toBeDisabled();
  await page.locator("[data-close]").click();
  await page.screenshot({ path: info.outputPath("waiting-A-to-B.png") });
  await page.locator("#update-button").click();
  await expect(page.locator("#running-version")).toHaveText("bbbbbbbbbbbb", { timeout: 20000 });
  await expect(page.locator("#search")).toHaveValue("PF-062");
  await expect(page).toHaveURL(/category=sales.*paper=A4.*q=PF-062/);
  expect(navigations).toBe(1);
  // The other tab remains running A even though B controls it now.
  await expect(other.locator("#running-version")).toHaveText("aaaaaaaaaaaa");
  await other.locator("#search").fill("PF-055");
  await other.locator(".gallery-card").click();
  await expect(other.locator("[data-print]")).toBeEnabled();
  await expect(other.frameLocator("iframe").locator(".printform_page")).toHaveCount(20);
  expect(other.frames().find((frame) => frame.url().includes("/designs/"))?.url()).toContain("releases/aaaaaaaaaaaa/");
  await other.locator("[data-close]").click();
  await other.locator("#check-update").click();
  await expect(other.locator("#update-button")).toBeEnabled();
  await other.locator("#update-button").click();
  await expect(other.locator("#running-version")).toHaveText("bbbbbbbbbbbb");
  await page.locator("#check-update").click();
  await expect(page.locator("#update-state")).toHaveText("Up to date");
  await context.setOffline(true);
  await page.locator("#check-update").click();
  await expect(page.locator("#update-state")).toHaveText("Offline");
  await context.setOffline(false);
  await expect(page.locator("#update-state")).toHaveText("Up to date");
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("#running-version")).toHaveText("bbbbbbbbbbbb");
  await expect(page.locator(".gallery-card")).toHaveCount(1);
  await page.locator("#clear-filters").click();
  await expect(page.locator(".gallery-card .card-id").first()).toHaveText("PF-064");
  await context.setOffline(false);
  // Chromium may report navigator.onLine=true after an offline cached reload,
  // so no new online event is guaranteed. The real manual retry must work too.
  await page.locator("#check-update").click();
  await expect(page.locator("#update-state")).toHaveText("Up to date");
  await page.screenshot({ path: info.outputPath("updated-B.png") });
});

test("legacy Update now message remains a working user-driven migration path", async ({ page }) => {
  await ready(page);
  await page.goto(server.url.replace("index.html", "legacy.html"));
  server.switchBuild("b");
  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
  await expect(page.locator("button")).toBeEnabled({ timeout: 35000 });
  await page.locator("button").click();
  await expect(page.locator("#running-version")).toHaveText("bbbbbbbbbbbb");
});

test("unsupported worker browser keeps a usable catalogue and truthful state", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(Navigator.prototype, "serviceWorker", { get: () => undefined, configurable: true }));
  await page.goto(server.url);
  await expect(page.locator(".gallery-card")).toHaveCount(64);
  await expect(page.locator("#update-state")).toHaveText("Updates are not supported in this browser");
  await page.locator("#check-update").click();
  await expect(page.locator("#update-state")).toHaveText("Updates are not supported in this browser");
});

for (const corrupt of [false, true]) test(`failed ${corrupt ? "integrity" : "download"} preserves A and permits retry`, async ({ page }) => {
  test.setTimeout(90000);
  await ready(page);
  await page.evaluate(() => localStorage.setItem("synthetic-user-data", "preserve"));
  server.switchBuild("b", !corrupt, corrupt);
  await page.locator("#check-update").click();
  await expect(page.locator("#update-state")).toContainText("Update failed", { timeout: 35000 });
  await expect(page.locator("#running-version")).toHaveText("aaaaaaaaaaaa");
  await page.reload();
  await expect(page.locator(".gallery-card")).toHaveCount(64);
  expect(await page.evaluate(() => localStorage.getItem("synthetic-user-data"))).toBe("preserve");
  server.switchBuild("b");
  await page.locator("#check-update").click();
  await expect(page.locator("#update-button")).toBeEnabled({ timeout: 35000 });
  await page.locator("#update-button").click();
  await expect(page.locator("#running-version")).toHaveText("bbbbbbbbbbbb");
});
