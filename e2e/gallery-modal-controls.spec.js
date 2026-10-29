import { test, expect } from "@playwright/test";
test.use({ serviceWorkers: "block" });
for (const width of [320, 390, 1440]) for (const colorScheme of ["light", "dark"]) {
  test(`modal controls at ${width}px ${colorScheme}: pointer, keyboard and footer`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ colorScheme });
    await page.goto("/gallery/index.html?q=PF-027");
    const card = page.locator(".gallery-card"), close = page.locator("[data-close]");
    await card.click();
    await expect(close).toBeFocused();
    await expect(page.locator("[data-studio]")).toBeHidden();
    await expect(close).toHaveAccessibleName("Close viewer");
    const pointer = await close.evaluate(node => ({ visible: node.matches(":focus-visible"), border: getComputedStyle(node).borderStyle }));
    expect(pointer.visible).toBe(false);
    expect(pointer.border).not.toBe("outset");
    const icon = await close.locator("svg").boundingBox(), box = await close.boundingBox();
    expect(icon.width).toBe(20); expect(icon.height).toBe(20);
    expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44);
    expect(Math.abs(icon.x + icon.width / 2 - box.x - box.width / 2)).toBeLessThan(1);
    const englishFooter = await page.locator(".modal-actions").evaluate(footer => {
      const style = getComputedStyle(footer), rect = footer.getBoundingClientRect();
      return { right: rect.right - parseFloat(style.paddingRight), buttons: [...footer.querySelectorAll(".button")].filter(node => node.getClientRects().length).map(node => node.getBoundingClientRect().toJSON()) };
    });
    expect(englishFooter.buttons).toHaveLength(2);
    expect(Math.abs(englishFooter.buttons[1].right - englishFooter.right)).toBeLessThan(1);
    expect(englishFooter.buttons[1].left - englishFooter.buttons[0].right).toBeGreaterThanOrEqual(8);
    for (const button of englishFooter.buttons) {
      expect(button.left).toBeGreaterThanOrEqual(0); expect(button.right).toBeLessThanOrEqual(width);
      expect(button.width).toBeGreaterThanOrEqual(44); expect(button.height).toBeGreaterThanOrEqual(44);
    }
    await page.screenshot({ path: info.outputPath("pointer.png") });
    await close.click();
    await expect(card).toBeFocused();
    await card.press("Enter");
    await expect(close).toBeFocused();
    expect(await close.evaluate(node => node.matches(":focus-visible"))).toBe(true);
    await expect(close).toHaveCSS("outline-style", "solid");
    await expect(close).toHaveCSS("outline-width", "2px");
    await page.screenshot({ path: info.outputPath("keyboard.png") });
    await page.keyboard.press("Escape");
    await expect(card).toBeFocused();
    await page.locator('[data-language="zh"]').click();
    await card.click();
    await expect(close).toHaveAccessibleName("关闭预览");
    for (const thirdAction of [false, true]) {
      if (thirdAction) {
        // Layout-only fixture: current catalogue has no Studio actions.
        await page.locator("[data-studio]").evaluate(node => { node.hidden = false; node.textContent = "在 Studio 中打开"; node.href = "#"; });
      }
      const geometry = await page.locator(".modal-actions").evaluate(footer => {
        const style = getComputedStyle(footer), rect = footer.getBoundingClientRect();
        return { right: rect.right - parseFloat(style.paddingRight) - parseFloat(style.borderRightWidth), buttons: [...footer.querySelectorAll(".button")].filter(node => !node.hidden).map(node => ({ action: node.hasAttribute("data-open") ? "open" : node.hasAttribute("data-print") ? "print" : "studio", ...node.getBoundingClientRect().toJSON() })) };
      });
      expect(geometry.buttons.map(node => node.action)).toEqual(thirdAction ? ["open", "print", "studio"] : ["open", "print"]);
      expect(Math.abs(geometry.buttons.at(-1).right - geometry.right)).toBeLessThan(1);
      for (const button of geometry.buttons) {
        expect(button.width).toBeGreaterThanOrEqual(44); expect(button.height).toBeGreaterThanOrEqual(44);
        expect(button.left).toBeGreaterThanOrEqual(0); expect(button.right).toBeLessThanOrEqual(width);
        expect(button.bottom).toBeLessThanOrEqual(844);
      }
      const [open, print] = geometry.buttons;
      if (open.y === print.y) expect(print.left - open.right).toBeGreaterThanOrEqual(8);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}
