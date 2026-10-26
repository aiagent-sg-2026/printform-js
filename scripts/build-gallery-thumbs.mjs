import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(root, "gallery/manifest.json");
const designs = JSON.parse(await fs.readFile(manifestPath, "utf8"));
await fs.mkdir(path.join(root, "gallery/thumbs"), { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });

try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 1100 }, deviceScaleFactor: 1 });
  page.on("pageerror", (error) => { throw error; });
  for (const design of designs) {
    const designPath = path.join(root, "gallery", design.file);
    await page.goto(pathToFileURL(designPath).href, { waitUntil: "load" });
    await page.waitForFunction(() => window.__printFormProcessed === true, null, { timeout: 30000 });
    const firstPage = page.locator(".printform_page").first();
    const bounds = await firstPage.boundingBox();
    if (!bounds) throw new Error(`No rendered first page for ${design.id}`);
    const thumbPath = path.join(root, "gallery", "thumbs", `${design.id}.png`);
    await firstPage.screenshot({ path: thumbPath, type: "png", animations: "disabled" });
    design.pages = await page.locator(".printform_page").count();
    design.width = Math.round(bounds.width);
    design.height = Math.round(bounds.height);
    console.log(`${design.id}: ${design.pages} page(s) → ${path.relative(root, thumbPath)}`);
  }
  await fs.writeFile(manifestPath, `${JSON.stringify(designs, null, 2)}\n`);
} finally {
  await browser.close();
}

 
