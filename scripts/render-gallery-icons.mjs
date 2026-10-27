import fs from "node:fs";
import { chromium } from "../node_modules/playwright/index.mjs";
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH });
try {
  for (const [name, size, padding] of [["icon-192.png", 192, 0], ["icon-512.png", 512, 0], ["icon-maskable-512.png", 512, 76], ["apple-touch-icon-180.png", 180, 0]]) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await page.setContent(`<html><body style="margin:0;width:${size}px;height:${size}px;background:#1f65db;display:grid;place-items:center"><img style="width:${size - 2 * padding}px;height:${size - 2 * padding}px" src="file://${process.cwd()}/gallery/icons/icon.svg"></body></html>`);
    await page.locator("img").screenshot({ path: `gallery/icons/${name}`, omitBackground: false });
    await page.close();
  }
} finally { await browser.close(); }
