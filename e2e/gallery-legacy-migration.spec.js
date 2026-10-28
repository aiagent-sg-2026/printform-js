import fs from "node:fs";
import { test, expect } from "@playwright/test";
import { galleryServer } from "./gallery-upgrade-server.js";

const legacyBuild = "53bd82bebad9", candidateBuild = "bbbbbbbbbbbb";
test.use({ serviceWorkers: "allow", viewport: { width: 1365, height: 900 } });

async function snapshot(page, context) {
  const state = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    const identity = (worker) => new Promise((resolve) => {
      if (!worker) { resolve(null); return; }
      const channel = new MessageChannel();
      const timer = setTimeout(() => { channel.port1.close(); resolve("no-GET_BUILD"); }, 300);
      channel.port1.onmessage = ({ data }) => { clearTimeout(timer); channel.port1.close(); resolve(data.build); };
      worker.postMessage({ type: "GET_BUILD" }, [channel.port2]);
    });
    return {
      shell: document.querySelector('meta[name="printform-build"]')?.content || "original-unversioned",
      running: document.querySelector("#running-version")?.textContent,
      status: document.querySelector("#update-state")?.textContent,
      bannerHidden: document.querySelector("#update-banner").hidden,
      action: document.querySelector("#update-button").textContent,
      actionDisabled: document.querySelector("#update-button").disabled,
      controller: await identity(navigator.serviceWorker.controller),
      active: await identity(registration.active), waiting: await identity(registration.waiting),
      activeState: registration.active?.state, waitingState: registration.waiting?.state,
      catalogue: document.querySelectorAll(".gallery-card").length,
      userData: localStorage.getItem("synthetic-user-data"),
      sessionData: sessionStorage.getItem("synthetic-session-data"),
      studioCache: await (await caches.open("synthetic-studio-user-cache")).match("/synthetic-user-data").then((value) => value?.text())
    };
  });
  // Browser inspection, not a fabricated GET_BUILD implementation on old A.
  state.installedWorkers = await Promise.all(context.serviceWorkers().map((worker) => worker.evaluate(() => BUILD)));
  return state;
}

test("exact public original worker migrates shell B / active A / waiting B only on explicit action", async ({ page, context }, info) => {
  test.setTimeout(90000);
  const server = await galleryServer({ legacy: true });
  const evidence = { provenance: server.provenance, errors: [], stages: {} };
  const save = () => fs.writeFileSync(info.outputPath("legacy-migration.json"), JSON.stringify(evidence, null, 2));
  page.on("pageerror", (error) => evidence.errors.push(error.message));
  try {
    await page.goto(`${server.url}?category=sales&paper=A4&q=PF-062`);
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await page.reload();
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
    await page.evaluate(async () => {
      localStorage.setItem("synthetic-user-data", "preserve");
      sessionStorage.setItem("synthetic-session-data", "preserve-session");
      await (await caches.open("synthetic-studio-user-cache")).put("/synthetic-user-data", new Response("preserve-cache"));
    });
    evidence.stages.original = await snapshot(page, context);
    expect(evidence.stages.original.installedWorkers).toEqual([legacyBuild]);
    expect(evidence.stages.original.controller).toBe("no-GET_BUILD");
    server.switchBuild("b");
    // Ordinary navigation under the ACTUAL original network-first worker.
    await page.reload();
    await expect(page.locator("#running-version")).toHaveText(candidateBuild);
    await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).waiting?.state), { timeout: 35000 }).toBe("installed");
    await expect(page.locator("#check-update")).toBeEnabled();
    evidence.stages.beforeManualCheck = await snapshot(page, context);
    await page.locator("#check-update").click();
    await expect(page.locator("#check-update")).toBeEnabled();
    evidence.stages.beforeActivation = await snapshot(page, context);
    await page.screenshot({ path: info.outputPath("legacy-before-activation.png") });
    save();
    expect(evidence.stages.beforeActivation).toMatchObject({ shell: candidateBuild, controller: "no-GET_BUILD", active: "no-GET_BUILD", waiting: candidateBuild, waitingState: "installed" });
    expect(evidence.stages.beforeActivation.installedWorkers.sort()).toEqual([legacyBuild, candidateBuild].sort());
    await expect(page.locator("#update-banner")).toBeVisible();
    await expect(page.locator("#update-state")).toHaveText(`New version available · ${candidateBuild}`);
    await expect(page.locator("#update-button")).toBeEnabled();

    const other = await context.newPage();
    other.on("pageerror", (error) => evidence.errors.push(error.message));
    await other.goto(server.url);
    await expect(other.locator("#update-button")).toBeEnabled();
    let reloads = 0, otherReloads = 0;
    // Count document requests, not same-document filter pushState events.
    page.on("request", (request) => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) reloads++; });
    other.on("request", (request) => { if (request.isNavigationRequest() && request.frame() === other.mainFrame()) otherReloads++; });
    await page.locator(".gallery-card").click();
    await expect(page.locator("[data-print]")).toBeEnabled();
    await expect(page.locator("#update-button")).toBeDisabled();
    expect(reloads).toBe(0);
    await page.locator("[data-close]").click();
    await page.locator("#update-button").click();
    await expect(page.locator("#update-state")).toHaveText("Up to date", { timeout: 20000 });
    await expect(page.locator("#running-version")).toHaveText(candidateBuild);
    await expect(page.locator("#search")).toHaveValue("PF-062");
    await expect(page).toHaveURL(/category=sales.*paper=A4.*q=PF-062/);
    await page.locator("#running-version").scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath("legacy-after-update-status.png") });
    await other.locator("#check-update").click();
    await expect(other.locator("#update-state")).toHaveText("Up to date");
    await expect(other.locator("#update-banner")).toBeHidden();
    await page.locator("#clear-filters").click();
    await expect(page.locator(".gallery-card")).toHaveCount(64);
    await expect(page.locator(".card-id").first()).toHaveText("PF-064");
    evidence.stages.afterActivation = await snapshot(page, context);
    evidence.stages.otherTab = await snapshot(other, context);
    evidence.reloads = reloads; evidence.otherReloads = otherReloads;
    await page.screenshot({ path: info.outputPath("legacy-after-activation.png") });
    await page.locator("#running-version").scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath("legacy-after-update-footer.png") });
    save();
    expect(evidence.stages.afterActivation).toMatchObject({ shell: candidateBuild, running: candidateBuild, controller: candidateBuild, active: candidateBuild, waiting: null, bannerHidden: true, catalogue: 64, userData: "preserve", sessionData: "preserve-session", studioCache: "preserve-cache" });
    expect(evidence.stages.otherTab).toMatchObject({ shell: candidateBuild, controller: candidateBuild, active: candidateBuild, waiting: null });
    expect(reloads).toBe(1);
    expect(otherReloads).toBe(0);
    expect(evidence.errors).toEqual([]);
  } finally { save(); await server.close(); }
});
