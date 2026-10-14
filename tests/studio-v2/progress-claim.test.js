import { describe, expect, it } from "vitest";
import { validateProject } from "../../studio-v2/core/acceptance.js";
import { parseProjectHtml, serializeStandalone } from "../../studio-v2/core/project-model.js";
import { createProgressClaimProject } from "../../studio-v2/samples/progress-claim.js";
import { bindTemplate } from "../../studio-v2/core/binding.js";
import { resolvePointer } from "../../studio-v2/core/json.js";
import { PrintFormFormatter } from "../../src/printform/formatter/PrintFormFormatter.js";
import { getPrintformConfig } from "../../src/printform/config.js";

describe("Northpeak progress claim production sample", () => {
  it("ships a valid claim with reference-shaped sections and six valuation rows", () => {
    const project = createProgressClaimProject();
    expect(project.sampleData.valuationRows).toHaveLength(6);
    expect(project.sampleData.variations).toHaveLength(3);
    expect(validateProject(project)).toMatchObject({ valid: true, productionValid: true, errors: [] });
  });

  it("binds monetary source strings exactly without formatting percentages or accounting deductions", () => {
    const project = createProgressClaimProject(), template = document.createElement("template");
    template.innerHTML = project.templateHtml;
    const { fragment, report } = bindTemplate(template, project.sampleData, project.manifest);
    expect(report.errors).toEqual([]);
    for (const node of fragment.querySelectorAll('[data-pf-monetary="currency"]')) {
      const pointer = node.getAttribute("data-pf-text");
      const scope = pointer.startsWith("./") ? project.sampleData.valuationRows[Number(node.closest("[data-pf-row-index]").dataset.pfRowIndex)] : project.sampleData;
      expect(node.textContent).toBe(resolvePointer(project.sampleData, pointer, scope));
    }
    expect(fragment.querySelector('[data-pf-text="/settlement/retention"]').textContent).toBe("(645,650.00)");
    expect(fragment.querySelector('[data-pf-text="/claimSummary/physicalProgress"]').textContent).toBe(project.sampleData.claimSummary.physicalProgress);
    expect(fragment.querySelector('[data-pf-text="./percentComplete"]').textContent).toBe(project.sampleData.valuationRows[0].percentComplete);
  });

  it("emits every supplied valuation total exactly once through the actual final-footer consumer", () => {
    const project = createProgressClaimProject(), template = document.createElement("template");
    template.innerHTML = project.templateHtml;
    const bound = bindTemplate(template, project.sampleData, project.manifest);
    const form = bound.fragment.querySelector(".printform");
    const formatter = new PrintFormFormatter(form, getPrintformConfig(form));
    const sections = formatter.collectSections();
    formatter.markSectionsProcessed(sections);
    const finalPage = document.createElement("div"), continuationPage = document.createElement("div");
    formatter.appendRepeatingFooters(continuationPage, sections);
    formatter.appendFinalFooters(finalPage, sections);
    expect(continuationPage.querySelectorAll('[data-pf-text^="/valuationTotal/"]')).toHaveLength(0);
    const totals = Array.from(finalPage.querySelectorAll('[data-pf-text^="/valuationTotal/"]'));
    expect(totals).toHaveLength(5);
    for (const node of totals) expect(node.textContent).toBe(resolvePointer(project.sampleData, node.dataset.pfText));
    expect(totals.filter(node => node.dataset.pfMonetary === "currency").map(node => node.textContent)).toEqual([
      project.sampleData.valuationTotal.contractAmount, project.sampleData.valuationTotal.previous,
      project.sampleData.valuationTotal.thisClaim, project.sampleData.valuationTotal.cumulative
    ]);
  });

  it("round-trips as a trusted standalone document", async () => {
    const project = createProgressClaimProject();
    const html = await serializeStandalone(
      project,
      { documentRuntime: "runtime=true;", printform: "printform=true;", runtimeVersion: "2.0.0" },
      validateProject(project)
    );
    const parsed = parseProjectHtml(html);
    expect(parsed.manifest.documentId).toBe("progress-claim-northpeak");
    expect(parsed.sampleData.valuationRows).toHaveLength(6);
    expect(parsed.sampleData.settlement.totalClaim).toBe("6,023,176.50");
    expect(parsed.attestation.result).toBe("pass");
  });
});
