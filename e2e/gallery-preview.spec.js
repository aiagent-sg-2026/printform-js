import { test, expect } from "@playwright/test";
test.use({ serviceWorkers: "block" });
const metrics = (frame) => frame.evaluate(() => {
  const node = document.scrollingElement;
  return { top: node.scrollTop, height: node.scrollHeight, viewport: node.clientHeight };
});
async function frameReady(page, number) {
  await page.locator("#search").fill(`PF-${number}`);
  await page.locator(".gallery-card").click();
  await expect(page.locator("[data-print]")).toBeEnabled();
  return page.frames().find((frame) => frame.url().includes("/designs/"));
}
async function layout(page) {
  const result = await page.locator("dialog").evaluate((dialog) => {
    const wrap = dialog.querySelector(".frame-wrap"), footer = dialog.querySelector("footer").getBoundingClientRect();
    return { dialogOverflow: dialog.scrollHeight - dialog.clientHeight, wrapOverflow: wrap.scrollHeight - wrap.clientHeight, footerBottom: footer.bottom, viewport: innerHeight };
  });
  expect(result.dialogOverflow).toBeLessThanOrEqual(1);
  expect(result.wrapOverflow).toBeLessThanOrEqual(1);
  expect(result.footerBottom).toBeLessThanOrEqual(result.viewport);
}
for (const [name, width, height] of [["desktop", 1365, 900], ["short", 1365, 480], ["mobile", 390, 844]]) {
  test(`PF062 native scroll, controls, focus and background lock: ${name}`, async ({ browser }, info) => {
    const context = await browser.newContext({ baseURL: info.project.use.baseURL, viewport: { width, height }, hasTouch: name === "mobile", serviceWorkers: "block" });
    const page = await context.newPage();
    try {
      await page.goto("/gallery/index.html");
      await expect(page.locator(".gallery-card")).toHaveCount(63);
      await page.locator("#search").fill("PF-062");
      await page.locator(".gallery-card").scrollIntoViewIfNeeded();
      const position = await page.evaluate(() => scrollY);
      await page.locator(".gallery-card").click();
      await expect(page.locator("[data-print]")).toBeEnabled();
      const frame = page.frames().find((frame) => frame.url().includes("/designs/"));
      await layout(page);
      const lockedTop = await page.locator("body").evaluate((body) => body.getBoundingClientRect().top);
      const header = await page.locator(".modal-header").boundingBox();
      await page.mouse.move(header.x + 20, header.y + 20);
      await page.mouse.wheel(0, 1200);
      await page.waitForTimeout(150);
      expect(await page.locator("body").evaluate((body) => body.getBoundingClientRect().top)).toBe(lockedTop);
      await frame.locator("#sample").selectOption("long");
      await expect(frame.locator(".printform_page")).not.toHaveCount(1);
      const box = await page.locator("iframe").boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.wheel(0, 900);
      await expect.poll(async () => (await metrics(frame)).top).toBeGreaterThan(100);
      await frame.locator("body").click({ position: { x: 30, y: 200 } });
      const previous = (await metrics(frame)).top;
      await page.keyboard.press("PageDown");
      await expect.poll(async () => (await metrics(frame)).top).toBeGreaterThan(previous);
      await page.keyboard.press("PageUp");
      await expect.poll(async () => (await metrics(frame)).top).toBeLessThan(previous + 50);
      if (name === "mobile") {
        const cdp = await context.newCDPSession(page);
        const start = (await metrics(frame)).top;
        const x = box.x + box.width / 2, y = box.y + box.height - 40;
        await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
        for (let step = 1; step <= 8; step++) {
          await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y - step * 35 }] });
          await page.waitForTimeout(25);
        }
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await expect.poll(async () => (await metrics(frame)).top).toBeGreaterThan(start + 100);
        await cdp.detach();
      }
      await page.keyboard.press("Control+End");
      await expect.poll(async () => { const m = await metrics(frame); return m.height - m.viewport - m.top; }).toBeLessThan(2);
      await page.screenshot({ path: info.outputPath(`pf062-long-last-${name}.png`) });
      await page.keyboard.press("Control+Home");
      await expect.poll(async () => (await metrics(frame)).top).toBe(0);
      await frame.locator("#paper").selectOption("A5");
      await frame.locator("#sample").selectOption("short");
      await expect(frame.locator(".printform_page")).toHaveCount(1);
      await layout(page);
      await page.screenshot({ path: info.outputPath(`pf062-a5-first-${name}.png`) });
      await frame.locator("#sample").focus();
      await page.keyboard.press("Escape");
      await expect(page.locator("dialog")).not.toBeVisible();
      await expect(page.locator(".gallery-card")).toBeFocused();
      expect(await page.evaluate(() => scrollY)).toBe(position);
      expect(await page.evaluate(() => document.body.style.position)).toBe("");
    } finally { await context.close(); }
  });
}

test("long PF055/056, bilingual PF057/063, repeated opens, resize, Tab and recovery", async ({ page }, info) => {
  await page.goto("/gallery/index.html");
  for (const [number, count] of [["055", 20], ["056", 4], ["057", 2], ["063", 1]]) {
    const frame = await frameReady(page, number);
    await expect(frame.locator(".printform_page")).toHaveCount(count);
    await layout(page);
    const box = await page.locator("iframe").boundingBox();
    await page.mouse.move(box.x + 200, box.y + 200);
    await page.mouse.wheel(0, 100000);
    await expect.poll(async () => { const m = await metrics(frame); return m.height - m.viewport - m.top; }).toBeLessThan(2);
    await page.mouse.wheel(0, -100000);
    await expect.poll(async () => (await metrics(frame)).top).toBe(0);
    await page.setViewportSize({ width: 1000, height: 520 });
    await layout(page);
    await page.locator("[data-close]").focus();
    for (let index = 0; index < 12; index++) {
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => document.querySelector("dialog").contains(document.activeElement))).toBe(true);
    }
    await page.locator("[data-close]").click();
  }
  await page.route("**/designs/premium-international-school-invoice.html", (route) => route.fulfill({ status: 503, contentType: "text/html", body: "Synthetic failed preview" }));
  await page.locator("#search").fill("PF-062");
  await page.locator(".gallery-card").click();
  await expect(page.locator(".preview-status")).toContainText("could not load", { timeout: 15000 });
  await expect(page.locator("[data-open]")).toHaveAttribute("href", /premium-international/);
  await expect(page.locator("[data-print]")).toBeDisabled();
  await page.screenshot({ path: info.outputPath("recoverable-preview-error.png") });
  await page.locator("[data-close]").click();
  await page.unrouteAll();
  await frameReady(page, "062");
  await page.locator("[data-close]").click();
});
