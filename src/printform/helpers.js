/* eslint-disable no-console */
import { PAPER_SIZES_MM } from "./paper-sizes.js";

const TRUE_TOKENS = new Set(["y", "yes", "true", "1"]);
const FALSE_TOKENS = new Set(["n", "no", "false", "0"]);

export function parseBooleanFlag(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const lowered = String(value).trim().toLowerCase();
  if (TRUE_TOKENS.has(lowered)) return true;
  if (FALSE_TOKENS.has(lowered)) return false;
  return fallback;
}

export function parseNumber(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export function parseString(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  return String(value);
}

function normalizeOrientation(value) {
  const token = String(value || "").trim().toLowerCase();
  if (token === "landscape") return "landscape";
  if (token === "portrait") return "portrait";
  return "";
}

function normalizePaperSize(value) {
  const token = String(value || "").trim();
  if (!token) return "";
  const upper = token.toUpperCase();
  if (Object.hasOwn(PAPER_SIZES_MM, upper)) {
    return upper;
  }
  if (upper === "US_LETTER" || upper === "USLETTER") return "LETTER";
  if (upper === "US_LEGAL" || upper === "USLEGAL") return "LEGAL";
  return "";
}

function mmToPx(mm, dpi) {
  const mmValue = Number(mm);
  const dpiValue = Number(dpi);
  if (!Number.isFinite(mmValue) || !Number.isFinite(dpiValue) || dpiValue <= 0) return 0;
  return Math.round((mmValue / 25.4) * dpiValue);
}


export function resolvePaperDimensions(options) {
  const paperSize = normalizePaperSize(options && options.paperSize);
  if (!paperSize) return null;
  const preset = PAPER_SIZES_MM[paperSize];
  if (!preset) return null;
  const dpi = Number(options && options.dpi);
  const width = mmToPx(preset.widthMm, dpi);
  const height = mmToPx(preset.heightMm, dpi);
  if (!width || !height) return null;
  const orientation = normalizeOrientation(options && options.orientation) || "portrait";
  if (orientation === "landscape") {
    return { width: height, height: width };
  }
  return { width, height };
}

export function normalizeHeight(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  // On iOS/Android browsers (especially WebKit), layout measurements often include
  // fractional pixels. Rounding down can accumulate and cause content to overflow
  // the configured page height (leading to unexpected extra page breaks).
  // We bias upward (ceil) with a tiny epsilon to avoid floating point noise.
  const epsilon = 1e-6;
  return Math.max(0, Math.ceil(num - epsilon));
}

export function selectIncludingRoot(element, selector) {
  const targets = Array.from(element.querySelectorAll(selector));
  if (element.matches?.(selector)) targets.unshift(element);
  return targets;
}

function ensurePageNumberPlaceholder(element) {
  if (!element) return null;
  if (element.__pageNumberPlaceholder) {
    return element.__pageNumberPlaceholder;
  }
  const doc = element.ownerDocument || (typeof document !== "undefined" ? document : null);
  if (!doc) return null;
  let container = element.matches?.("[data-page-number-container]")
    ? element : element.querySelector("[data-page-number-container]");
  if (!container) {
    container = element.querySelector("td:last-child") || element.querySelector("td") || element;
  }
  const placeholder = doc.createElement("span");
  placeholder.className = "printform_page_number_placeholder";
  container.appendChild(placeholder);
  element.__pageNumberPlaceholder = placeholder;
  return placeholder;
}

function ensurePhysicalPageNumberPlaceholder(element) {
  if (!element) return null;
  if (element.__physicalPageNumberPlaceholder) {
    return element.__physicalPageNumberPlaceholder;
  }
  const doc = element.ownerDocument || (typeof document !== "undefined" ? document : null);
  if (!doc) return null;
  let container = element.matches?.("[data-physical-page-number-container]")
    ? element : element.querySelector("[data-physical-page-number-container]");
  if (!container) {
    container = element.querySelector("td:last-child") || element.querySelector("td") || element;
  }
  const placeholder = doc.createElement("span");
  placeholder.className = "printform_physical_page_number_placeholder";
  container.appendChild(placeholder);
  element.__physicalPageNumberPlaceholder = placeholder;
  return placeholder;
}

export function updatePageNumberContent(element, pageNumber, totalPages) {
  if (!element) return;
  const numberTargets = selectIncludingRoot(element, "[data-page-number]");
  if (numberTargets.length > 0) {
    numberTargets.forEach(function(target) {
      target.textContent = pageNumber;
    });
  }
  const totalTargets = selectIncludingRoot(element, "[data-page-total]");
  const totalValue = totalPages !== undefined && totalPages !== null ? totalPages : "";
  if (totalTargets.length > 0) {
    totalTargets.forEach(function(target) {
      target.textContent = totalValue;
    });
  }
  if (numberTargets.length === 0 && totalTargets.length === 0) {
    const fallback = ensurePageNumberPlaceholder(element);
    if (fallback) {
      fallback.textContent = totalPages !== undefined && totalPages !== null
        ? "Page " + pageNumber + " of " + totalPages
        : "Page " + pageNumber;
    }
  }
}

export function updatePhysicalPageNumberContent(element, pageNumber, totalPages) {
  if (!element) return;
  const numberTargets = selectIncludingRoot(element, "[data-physical-page-number]");
  if (numberTargets.length > 0) {
    numberTargets.forEach(function(target) {
      target.textContent = pageNumber;
    });
  }
  const totalTargets = selectIncludingRoot(element, "[data-physical-page-total]");
  const totalValue = totalPages !== undefined && totalPages !== null ? totalPages : "";
  if (totalTargets.length > 0) {
    totalTargets.forEach(function(target) {
      target.textContent = totalValue;
    });
  }
  if (numberTargets.length === 0 && totalTargets.length === 0) {
    const fallback = ensurePhysicalPageNumberPlaceholder(element);
    if (fallback) {
      fallback.textContent = totalPages !== undefined && totalPages !== null
        ? "Sheet " + pageNumber + " of " + totalPages
        : "Sheet " + pageNumber;
    }
  }
}
