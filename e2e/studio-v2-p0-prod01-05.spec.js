import { expect, test } from "@playwright/test";
import { admitPublicGateway, openEditor, openInspector } from "./studio-v2-helpers.js";

test.describe.configure({ timeout: 180_000 });

test.describe("Studio v2 PROD-01 01-05 indirect global effects", () => {
  test("rejects global effects under component scope and keeps repeatHeader local", async ({ page }) => {
    const browserErrors = [];
    const browserDiagnostics = [];
    const knownFirefoxAgrunCspDiagnostic = (message) => test.info().project.name === "firefox"
      && /Content-Security-Policy:[\s\S]*blocked a JavaScript eval[\s\S]*agrun\.min\.js/i.test(message);
    page.on("pageerror", (error) => browserErrors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") browserDiagnostics.push(message.text()); });

    await page.goto("/studio-v2/?sample=sales-invoice");
    await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
    await openEditor(page);
    await page.locator("#template-editor").evaluate((editor) => {
      const parsed = new DOMParser().parseFromString(editor.value, "text/html");
      const root = parsed.querySelector(".printform");
      const header = root?.querySelector(".prowheader");
      const row = root?.querySelector(".prowitem");
      if (!root || !header || !row) throw new Error("Synthetic two-table fixture could not find the invoice tables");
      root.setAttribute("data-repeat-rowheader", "n");
      const mark = (table, tableId, marker, role) => {
        table.setAttribute("data-pf-table-id", tableId);
        table.setAttribute("data-scope-canary", marker);
        table.classList.add(`scope-table-${tableId}-${role}`);
      };
      mark(header, "a", "A", "header");
      mark(row, "a", "A", "row");
      const comparison = parsed.createElement("section");
      comparison.className = "ptac scope-table-b-container";
      comparison.innerHTML = `<table class="pf-grid scope-table-b-header" data-pf-table-id="b" data-scope-canary="B"><thead><tr><th style="width:7%">B No.</th><th style="width:43%">B Description</th><th style="width:11%">B Qty</th><th style="width:16%">B Unit</th><th style="width:18%">B Amount</th></tr></thead><tbody><tr><td style="width:7%">B-1</td><td style="width:43%">Static comparison row</td><td style="width:11%">1</td><td style="width:16%">RM 1.00</td><td style="width:18%">RM 1.00</td></tr></tbody></table>`;
      root.append(comparison);
      editor.value = root.outerHTML;
      editor.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.locator("#apply-source-button").click();
    await expect(page.locator("#source-diff-modal")).toBeVisible();
    await page.locator("#source-diff-apply").click();
    await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
    await openInspector(page);
    await expect(page.locator("#ai-context-scope-select option[value='component:table-a-header']")).toHaveCount(1);
    await page.locator("#ai-context-scope-select").selectOption("component:table-a-header");
    await expect(page.locator("#ai-context-scope-select")).toHaveValue("component:table-a-header");
    await admitPublicGateway(page);

    const baseline = await page.evaluate(async () => {
      const revision = await window.PrintFormStudioAgent.execute("get_revision");
      return { revision: revision.result.revision, projectHash: revision.result.projectHash, source: document.querySelector("#template-editor").value };
    });
    await page.locator("#ai-mode-preview").click();
    await page.evaluate((baselineRevision) => {
      const control = { runs: 0, actionCalls: 0, errors: [], results: [] };
      let runtimeOptions;
      const session = {
        getState: () => ({ cumulativeUsage: { totalTokens: 0 } }),
        runStream() {
          control.runs += 1;
          return (async function* () {
            const action = runtimeOptions.customActions.find((item) => item.name === "printform_preview_changes");
            control.actionCalls += 1;
            const operations = structuredClone(control.nextOperations);
            try {
              control.results.push(await action.execute({}, { expectedRevision: baselineRevision, operations }));
            } catch (error) {
              control.errors.push({ code: error.code, message: error.message });
              throw error;
            }
            yield { type: "completed", detail: { terminalKind: "done", result: { output: { text: "Preview ready" } } } };
          }());
        }
      };
      window.__p0Prod0105 = { control };
      window.Agrun = {
        defineAction: (definition) => definition,
        createInMemorySessionStore: () => ({}),
        createRuntime: (options) => {
          runtimeOptions = options;
          return { createSession: async () => session, openSession: async () => session, getAgentSkills: () => [] };
        },
        openaiBrowserSkill: {},
        geminiBrowserSkill: {}
      };
    }, baseline.revision);

    const runRejected = async (operations, prompt) => {
      await page.evaluate((nextOperations) => { window.__p0Prod0105.control.nextOperations = nextOperations; }, operations);
      await page.locator("#ai-prompt").fill(prompt);
      await expect(page.locator("#ai-prompt")).toHaveValue(prompt);
      await page.locator("#ai-send").click();
      await expect(page.locator(".ai-message.system").last()).toContainText("outside the selected scope", { timeout: 20_000 });
      await expect(page.locator("#ai-proposal-card")).toBeHidden();
      await expect(page.locator("#ai-apply-proposal")).toHaveCount(0);
      await expect(page.locator("#candidate-preview-banner")).toBeHidden();
      await expect(page.locator("#ai-context-scope-select")).toHaveValue("component:table-a-header");
      const after = await page.evaluate(async () => {
        const revision = await window.PrintFormStudioAgent.execute("get_revision");
        return { revision: revision.result.revision, projectHash: revision.result.projectHash, source: document.querySelector("#template-editor").value };
      });
      expect(after).toEqual(baseline);
    };

    await runRejected([{ type: "set_brand_color", hex: "#854d0e" }], "Change the shared theme from this component");
    await runRejected([{ type: "set_column_widths", tableSelector: ".scope-table-a-header, .scope-table-b-header", widths: ["12%", "43%", "11%", "16%", "18%"] }], "Resize both tables from this component");

    await page.evaluate(() => {
      window.__p0Prod0105.control.nextOperations = [{ type: "set_pagination_rule", componentId: "table-a-header", rule: "repeatHeader", value: true }];
    });
    await page.locator("#ai-prompt").fill("Repeat only table A's header");
    await expect(page.locator("#ai-prompt")).toHaveValue("Repeat only table A's header");
    await page.locator("#ai-send").click();
    await expect(page.locator("#ai-apply-proposal")).toBeVisible({ timeout: 20_000 });
    const frame = page.frameLocator("#preview-frame");
    const candidateA = frame.locator("table.scope-table-a-header").first();
    await expect(candidateA).toBeVisible({ timeout: 20_000 });
    const candidateFlags = await candidateA.evaluate((table) => ({
      a: table.getAttribute("data-pf-repeat-rowheader"),
      b: table.ownerDocument.querySelector(".scope-table-b-header")?.getAttribute("data-pf-repeat-rowheader") || null,
      pages: Array.from(table.ownerDocument.querySelectorAll(".printform_page"), (page) => page.querySelectorAll(".scope-table-a-header.prowheader_processed").length)
    }));
    expect(candidateFlags.a).toBe("y");
    expect(candidateFlags.b).toBeNull();
    expect(candidateFlags.pages.filter((count) => count > 0).length).toBeGreaterThan(1);
    expect(await page.locator("#template-editor").inputValue()).toBe(baseline.source);
    const control = await page.evaluate(() => window.__p0Prod0105.control);
    expect(control.runs).toBe(3);
    expect(control.actionCalls).toBe(3);
    expect(control.errors.map((item) => item.code)).toEqual(["SCOPE_VIOLATION", "SCOPE_VIOLATION"]);
    expect(control.results).toHaveLength(1);
    expect(browserErrors).toEqual([]);
    expect(browserDiagnostics.filter((message) => !knownFirefoxAgrunCspDiagnostic(message))).toEqual([]);
    if (browserDiagnostics.some(knownFirefoxAgrunCspDiagnostic)) test.info().annotations.push({
      type: "known-browser-diagnostic",
      description: "Firefox reports the existing AGRUN CSP eval diagnostic; no functional page error was observed."
    });
  });
});
