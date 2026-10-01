import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { admitPublicGateway, openEditor, openInspector, passLayoutReview } from "./studio-v2-helpers.js";
import { readClientStorage } from "./studio-v2-storage-inspection.js";

const SAVE_CANARY = "EXPLICIT-SAVE-CANARY-20260908";
const PROMPT_CANARY = "SYNTHETIC-PROMPT-CANARY-20260908";
const importedFixture = fs.readFileSync(path.resolve(process.cwd(), "site-dist/studio-v2/samples/sales-invoice-v2.html"));

async function makeRealCanary(page) {
  await page.goto("/studio-v2/");
  await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
  await openEditor(page);
  await page.locator("label.privacy-toggle").click();
  await expect(page.locator("#data-policy")).toHaveText(/Real data|真实数据/i);
  await admitPublicGateway(page);
  const editor = page.locator("#manifest-editor");
  const manifest = JSON.parse(await editor.inputValue());
  manifest.title = SAVE_CANARY;
  await editor.fill(JSON.stringify(manifest, null, 2));
  await page.locator("#apply-source-button").click();
  await page.locator("#source-diff-apply").click();
  await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
}

test("PROD-13 13-07 saves only the selected file and discloses user prompts", async ({ page }) => {
  await makeRealCanary(page);
  expect((await passLayoutReview(page)).ok).toBe(true);
  await expect(page.locator("#export-button")).toBeEnabled();
  await page.evaluate(() => {
    window.__p0SaveCapture = { html: null, options: null, closed: false };
    const picker = async (options) => {
      window.__p0SaveCapture.options = options;
      return {
      createWritable: async () => ({
        write: async (html) => { window.__p0SaveCapture.html = html; },
        close: async () => { window.__p0SaveCapture.closed = true; }
      })
      };
    };
    Object.defineProperty(window, "showSaveFilePicker", { configurable: true, writable: true, value: picker });
    window.confirm = () => true;
  });
  page.on("dialog", (dialog) => dialog.accept());
  const before = await readClientStorage(page);
  await page.locator("#export-button").click();
  await expect.poll(() => page.evaluate(() => window.__p0SaveCapture.closed)).toBe(true);
  await expect(page.locator("#save-state")).toHaveText("Saved");
  const saved = await page.evaluate(() => ({
    html: window.__p0SaveCapture.html,
    options: window.__p0SaveCapture.options,
    closed: window.__p0SaveCapture.closed
  }));
  expect(saved.options.suggestedName).toMatch(/\.html$/);
  expect(saved.html).toContain(SAVE_CANARY);
  expect(saved.closed).toBe(true);
  expect(await readClientStorage(page)).toEqual(before);

  await openInspector(page);
  await page.locator("#ai-designer-tab").click();
  await page.locator("#ai-settings-button").click();
  await page.locator("#ai-settings-tab-privacy").click();
  await expect(page.locator("#ai-settings-panel-privacy")).toContainText(/Text you type|你主动输入|Teks yang anda taip|入力したテキスト|Văn bản bạn nhập/i);
  await page.locator("#ai-settings-close").click();
  await page.evaluate(() => {
    window.__p0PromptRequest = null;
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, init = {}) => {
      if (String(input).endsWith('/demo/session')) return Promise.resolve(new Response(JSON.stringify({token:'dmo_privacy-fixture',expires_in:900}),{status:200,headers:{'content-type':'application/json'}}));
      if (!String(input).includes("gpt.yapweijun1996.com/demo/v1/responses")) return originalFetch(input, init);
      window.__p0PromptRequest = { body: JSON.parse(init.body) };
      return new Promise((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true }));
    };
  });
  await page.locator("#ai-prompt").fill(PROMPT_CANARY);
  await page.locator("#ai-send").click();
  await expect.poll(() => page.evaluate(() => Boolean(window.__p0PromptRequest))).toBe(true);
  const providerBody = await page.evaluate(() => window.__p0PromptRequest.body);
  expect(JSON.stringify(providerBody)).toContain(PROMPT_CANARY);
  await page.locator("#ai-stop").click();
});

test("PROD-13 13-08 falls back to memory and does not inherit Synthetic policy on import", async ({ page }) => {
  await page.addInitScript(() => {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (String(key).startsWith("printform:studio-v2:transactions:") || String(key).startsWith("printform:studio-v2:durable:") || key === "printform-studio-v2-recovery") {
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      }
      return originalSetItem.call(this, key, value);
    };
    const nativeIndexedDb = window.indexedDB;
    Object.defineProperty(window, "indexedDB", {
      configurable: true,
      value: {
        databases: (...args) => nativeIndexedDb.databases(...args),
        deleteDatabase: (...args) => nativeIndexedDb.deleteDatabase(...args),
        open() {
          const request = {};
          queueMicrotask(() => request.onerror?.({ target: { error: new Error("IndexedDB denied") } }));
          return request;
        }
      }
    });
  });
  await page.goto("/studio-v2/");
  await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
  await admitPublicGateway(page);
  const faultInjection = await page.evaluate(async () => {
    let durableBlocked = false;
    try { localStorage.setItem("printform:studio-v2:durable:probe", "probe"); } catch { durableBlocked = true; }
    return { durableBlocked, indexedDbNames: typeof indexedDB.databases === "function" ? await indexedDB.databases() : [] };
  });
  expect(faultInjection.durableBlocked).toBe(true);
  const storeState = await page.evaluate(async () => {
    const { DurableTransactionStore } = await import("/studio-v2/core/durable-transaction-store.js");
    const store = new DurableTransactionStore({ storage: localStorage, key: "printform:studio-v2:durable:probe", formId: "probe", initialProject: { manifest: { documentId: "probe" } } });
    return { persistenceState: store.persistenceState, persistent: store.persistent };
  });
  expect(storeState, JSON.stringify(storeState)).toMatchObject({ persistenceState: "volatile-fallback", persistent: false });
  await expect(page.locator("#data-policy")).toHaveText(/Persistence unavailable|持久化不可用|存储不可用/i);
  await openInspector(page);
  await page.locator("#ai-designer-tab").click();
  await expect(page.locator("#ai-status")).toHaveText(/session storage is unavailable|会话存储不可用|storan sesi tidak tersedia/i);
  await page.locator("#ai-new-session").click();
  await expect(page.locator("#ai-session-select")).not.toHaveValue("");

  await openEditor(page);
  const editor = page.locator("#manifest-editor");
  const manifest = JSON.parse(await editor.inputValue());
  manifest.title = "STORAGE-FAILURE-CANARY-20260908";
  await editor.fill(JSON.stringify(manifest, null, 2));
  await page.locator("#apply-source-button").click();
  await page.locator("#source-diff-apply").click();
  await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
  const summary = await page.evaluate(() => window.PrintFormStudioAgent.execute("get_project_summary"));
  expect(await editor.inputValue()).toContain("STORAGE-FAILURE-CANARY-20260908");
  expect(summary.result.revision).toBe(1);
  const failedStorage = await readClientStorage(page);
  expect(JSON.stringify(failedStorage)).not.toContain("STORAGE-FAILURE-CANARY-20260908");

  page.on("dialog", (dialog) => dialog.accept());
  await page.locator("#import-file").setInputFiles({ name: "unclassified.html", mimeType: "text/html", buffer: importedFixture });
  await expect(page.locator("#data-policy")).toHaveText(/Unknown data|未知数据/i);
  const capabilities = await page.evaluate(() => window.PrintFormStudioAgent.execute("get_capabilities"));
  expect(capabilities.result.capabilities.durableTransactions).toBe(false);
  expect(capabilities.result.capabilities.persistentAudit).toBe(false);
});
