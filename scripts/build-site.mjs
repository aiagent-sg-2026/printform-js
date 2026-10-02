import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";
import { createSalesInvoiceProject } from "../studio-v2/samples/sales-invoice.js";
import { createPurchaseOrderProject } from "../studio-v2/samples/purchase-order.js";
import { createProgressClaimProject } from "../studio-v2/samples/progress-claim.js";
import { validateProject } from "../studio-v2/core/acceptance.js";
import { serializeStandalone } from "../studio-v2/core/project-model.js";
import { collectAppShell } from "./app-shell.mjs";
import { buildPi00 } from "./build-pi-00.mjs";
import { buildPi01 } from "./build-pi-01.mjs";
import { buildPi02 } from "./build-pi-02.mjs";
import { buildPi03 } from "./build-pi-03.mjs";
import { buildPi04 } from "./build-pi-04.mjs";
import { buildStudioV3 } from './build-studio-v3.mjs';
import { finalizeStudioV3Pwa } from './studio-v3-pwa.mjs';

const root = process.cwd();
const output = path.resolve(root, "site-dist");
const allowedDirectories = ["dist", "docs", "img", "studio", "studio-v2", "studio-v3"];
const allowedRootFiles = ["index.html", "README.md", "README.zh-CN.md"];

function copy(source, destination) {
  fs.cpSync(source, destination, { recursive: true, filter: (entry) => !entry.includes("site-dist") });
}

function prepareOutput() {
  if (path.basename(output) !== "site-dist") throw new Error("Refusing to clean an unexpected output path");
  fs.rmSync(output, { recursive: true, force: true });
  fs.mkdirSync(output, { recursive: true });
}

function copyAllowlist() {
  allowedRootFiles.forEach((name) => {
    const source = path.resolve(root, name);
    if (fs.existsSync(source)) copy(source, path.resolve(output, name));
  });
  fs.readdirSync(root).filter((name) => /^(demo|index\d|delivery_order|index_subtotal).*\.html$/.test(name)).forEach((name) => copy(path.resolve(root, name), path.resolve(output, name)));
  allowedDirectories.forEach((name) => {
    const source = path.resolve(root, name);
    if (fs.existsSync(source)) copy(source, path.resolve(output, name));
  });
}

async function writePilotExports() {
  const runtimeSource = fs.readFileSync(path.resolve(root, "dist/printform-document.js"), "utf8");
  const printformSource = fs.readFileSync(path.resolve(root, "dist/printform.js"), "utf8");
  globalThis.DOMParser = new JSDOM("").window.DOMParser;
  const samples = path.resolve(output, "studio-v2/samples");
  fs.mkdirSync(samples, { recursive: true });
  const pilots = [
    ["sales-invoice-v2.html", createSalesInvoiceProject()],
    ["purchase-order-red-v2.html", createPurchaseOrderProject()],
    ["progress-claim-northpeak-v2.html", createProgressClaimProject()]
  ];
  for (const [filename, project] of pilots) {
    const validation = validateProject(project);
    const html = await serializeStandalone(project, { documentRuntime: runtimeSource, printform: printformSource, runtimeVersion: "2.0.0" }, validation);
    fs.writeFileSync(path.resolve(samples, filename), html, "utf8");
  }
}

function finalizePwa() {
  const serviceWorker = path.resolve(output, "studio-v2/sw.js");
  const buildId = (process.env.GITHUB_SHA || "local").slice(0, 12);
  const source = fs.readFileSync(serviceWorker, "utf8");
  if (!source.includes("__PRINTFORM_BUILD__")) {
    // Without the placeholder the SW cache version never changes and every
    // returning visitor keeps the previous release forever — fail the build
    // loudly instead of deploying that silently.
    throw new Error("studio-v2/sw.js is missing the __PRINTFORM_BUILD__ placeholder");
  }
  if (!source.includes('"__PRINTFORM_APP_SHELL__"')) {
    // Same reasoning: a missing placeholder here ships a service worker that
    // precaches nothing, and offline simply stops working with no error.
    throw new Error("studio-v2/sw.js is missing the __PRINTFORM_APP_SHELL__ placeholder");
  }
  const appShell = collectAppShell(output);
  const stamped = source
    .replaceAll("__PRINTFORM_BUILD__", buildId)
    .replace('"__PRINTFORM_APP_SHELL__"', JSON.stringify(appShell));
  fs.writeFileSync(serviceWorker, stamped, "utf8");
  console.log(`Service worker precache manifest: ${appShell.length} entries`);
}

prepareOutput();
copyAllowlist();
await writePilotExports();
await buildStudioV3({ root, output });
await buildPi00({ root, output });
await buildPi01({ root, output });
await buildPi02({ root, output });
await buildPi03({ root, output });
await buildPi04({ root, output });
finalizePwa();
finalizeStudioV3Pwa(output);
console.log(`GitHub Pages artifact ready: ${output}`);
