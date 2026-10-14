import { LIMITS, PROTOCOL_VERSION, TRUST } from "../core/constants.js";
import { PROGRESS_CLAIM_TEMPLATE, PROGRESS_CLAIM_THEME } from "./progress-claim-layout.js";

const rows = [
  ["1", "Preliminaries", "900,000.00", "520,000.00", "95,000.00", "615,000.00", "68.33%"],
  ["2", "Cleanroom Architectural Works", "2,600,000.00", "1,250,000.00", "310,000.00", "1,560,000.00", "60.00%"],
  ["3", "Mechanical & Ventilation", "3,100,000.00", "1,420,000.00", "410,000.00", "1,830,000.00", "59.03%"],
  ["4", "Electrical & Controls", "2,450,000.00", "1,060,000.00", "280,000.00", "1,340,000.00", "54.69%"],
  ["5", "Testing & Commissioning", "650,000.00", "95,000.00", "46,500.00", "141,500.00", "21.77%"],
  ["6", "External Utility Tie-In", "300,000.00", "105,000.00", "25,000.00", "130,000.00", "43.33%"]
];

const schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema", type: "object",
  required: ["company", "documentNo", "claimNo", "claimDate", "projectCode", "project", "customer", "contractRef", "currency", "contractSummary", "claimSummary", "valuationRows", "valuationTotal", "variations", "variationTotal", "settlement", "printedAt"],
  properties: {
    company: { type: "object", required: ["name", "subtitle"], properties: { name: { type: "string", minLength: 1 }, subtitle: { type: "string", minLength: 1 } }, additionalProperties: false },
    documentNo: { type: "string", minLength: 1 }, claimNo: { type: "string", minLength: 1 }, claimDate: { type: "string", minLength: 1 }, projectCode: { type: "string", minLength: 1 }, project: { type: "string", minLength: 1 }, customer: { type: "string", minLength: 1 }, contractRef: { type: "string", minLength: 1 }, currency: { type: "string", minLength: 1 }, printedAt: { type: "string", minLength: 1 },
    contractSummary: { type: "object", additionalProperties: { type: "string" } }, claimSummary: { type: "object", additionalProperties: { type: "string" } },
    valuationRows: { type: "array", minItems: 1, maxItems: 500, items: { type: "object", required: ["no", "description", "contractAmount", "previous", "thisClaim", "cumulative", "percentComplete"], properties: { no: { type: "string" }, description: { type: "string" }, contractAmount: { type: "string" }, previous: { type: "string" }, thisClaim: { type: "string" }, cumulative: { type: "string" }, percentComplete: { type: "string" } }, additionalProperties: false } },
    valuationTotal: { type: "object", additionalProperties: { type: "string" } },
    variations: { type: "array", minItems: 3, maxItems: 3, items: { type: "object", additionalProperties: { type: "string" } } },
    variationTotal: { type: "object", additionalProperties: { type: "string" } },
    settlement: { type: "object", additionalProperties: { type: "string" } }
  }, additionalProperties: false
};

export function createProgressClaimProject() {
  return {
    manifest: {
      protocolVersion: PROTOCOL_VERSION, title: "Progress Claim — Northpeak Buildworks", documentId: "progress-claim-northpeak", locale: "en-MY", currency: "SGD", timeZone: "Asia/Singapore",
      i18n: { supportedLocales: ["en-MY", "zh-CN", "ms-MY", "ja-JP", "vi-VN"], fallbackLocale: "en-MY" },
      acceptance: { maxHtmlBytes: LIMITS.htmlBytes, maxRows: LIMITS.rows, maxRowsPerTable: LIMITS.rowsPerTable, maxLogicalPages: LIMITS.logicalPages, requirePrintPreview: true },
      sampleScenarios: { collection: "/valuationRows" },
      assets: { inlineByDefault: true, allowExternalHttps: false, requiredSlots: ["letterhead-logo", "footer-logo"] }
    },
    schema, i18n: {}, themeCss: PROGRESS_CLAIM_THEME, templateHtml: PROGRESS_CLAIM_TEMPLATE,
    sampleData: {
      company: { name: "NORTHPEAK", subtitle: "BUILDWORKS PTE LTD" }, documentNo: "PCAR-2026-018", claimNo: "05", claimDate: "18 Aug 2026", projectCode: "NP-2419", project: "SKYLINE BIOTECH LAB EXPANSION", customer: "AURORA LIFE SCIENCES PTE LTD", contractRef: "ALS/LAB/2026-04", currency: "SGD", printedAt: "18 Aug 2026 10:15",
      contractSummary: { original: "12,800,000.00", approvedVariations: "780,000.00", revised: "13,580,000.00", previousCertified: "5,420,000.00", currentClaim: "1,486,500.00", cumulative: "6,906,500.00", balance: "6,673,500.00" },
      claimSummary: { physicalProgress: "50.80%", poc: "51.20%", cumulativeWork: "6,906,500.00", materials: "420,000.00", variationWork: "180,000.00", retention: "690,650.00", advanceRecovery: "250,000.00", netClaim: "1,486,500.00" },
      valuationRows: rows.map(([no, description, contractAmount, previous, thisClaim, cumulative, percentComplete]) => ({ no, description, contractAmount, previous, thisClaim, cumulative, percentComplete })),
      valuationTotal: { contractAmount: "10,000,000.00", previous: "4,450,000.00", thisClaim: "1,166,500.00", cumulative: "5,616,500.00", percentComplete: "56.17%" },
      variations: [{ number: "VO-01", description: "Additional cleanroom partitions", status: "Approved", approvedAmount: "220,000.00", thisClaim: "60,000.00", cumulative: "140,000.00" }, { number: "VO-02", description: "Chilled water rerouting", status: "Approved", approvedAmount: "340,000.00", thisClaim: "80,000.00", cumulative: "210,000.00" }, { number: "VO-03", description: "Utility monitoring upgrade", status: "Pending", approvedAmount: "220,000.00", thisClaim: "40,000.00", cumulative: "70,000.00" }],
      variationTotal: { approvedAmount: "780,000.00", thisClaim: "180,000.00", cumulative: "420,000.00" },
      settlement: { grossWorkDone: "5,616,500.00", materialsOnSite: "420,000.00", approvedVariations: "420,000.00", grossClaim: "6,456,500.00", retention: "(645,650.00)", advanceRecovery: "(250,000.00)", otherDeductions: "(35,000.00)", netBeforeGst: "5,525,850.00", gst: "497,326.50", totalClaim: "6,023,176.50" }
    },
    attestation: null, runtime: null, trust: TRUST.trusted, trustReasons: [], customScripts: [], sourceHtml: ""
  };
}
