import fs from 'node:fs/promises';
import path from 'node:path';
import {createCanvas, loadImage} from '@napi-rs/canvas';
export async function capture(page, out, name, indices) {
  await page.evaluate(() => window.scrollTo(0, 0));
  const rects = await page.locator('.physical_page_wrapper').evaluateAll(ns => ns.map(n => {
    const r = n.getBoundingClientRect(); return {x:r.left + scrollX, y:r.top + scrollY, width:r.width, height:r.height};
  }));
  const image = await loadImage(await page.screenshot({fullPage:true}));
  for (const i of indices || rects.map((_, i) => i)) {
    const r = rects[i], canvas = createCanvas(Math.ceil(r.width), Math.ceil(r.height));
    canvas.getContext('2d').drawImage(image, Math.floor(r.x), Math.floor(r.y), canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
    await fs.writeFile(path.join(out, `${name}-page-${i + 1}.png`), canvas.toBuffer('image/png'));
  }
}
export async function pdf(page, out, name, dom) {
  await page.emulateMedia({media:'print'});
  await page.pdf({path:path.join(out, `${name}.pdf`), preferCSSPageSize:true, printBackground:true});
  await page.emulateMedia({media:'screen'});
  await fs.writeFile(path.join(out, `${name}-dom.json`), JSON.stringify(dom, null, 2));
}
