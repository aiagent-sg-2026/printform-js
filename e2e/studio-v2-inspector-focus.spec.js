import { expect, test } from "@playwright/test";

test("inspector transition focus yields to the user's composer input", async ({ page }) => {
  await page.clock.install();
  await page.goto("/studio-v2/");
  await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
  await page.clock.pauseAt(await page.evaluate(() => new Date(Date.now() + 100)));
  await page.locator("#inspector-toggle").click();
  await page.clock.runFor(350);
  const prompt = page.locator("#ai-prompt");
  const request = "Change the shared theme from this component";
  await prompt.fill(request);
  await page.clock.runFor(100);
  await expect(prompt).toBeFocused();
  await expect(prompt).toHaveValue(request);
  await expect(page.locator("#inspector-panel")).toHaveAttribute("aria-hidden", "false");
  // This focus-only scenario must leave the user's draft unsent.
  await expect(page.locator(".ai-message.user")).toHaveCount(0);
  await page.locator("#inspector-close").click();
  await page.clock.runFor(450);
  await expect(page.locator("#inspector-toggle")).toBeFocused();
  await expect(page.locator("#inspector-panel")).toHaveAttribute("aria-hidden", "true");
});
