/* eslint-disable no-console */

import { DEFAULT_CONFIG, DEFAULT_PADDT_CONFIG, getPrintformConfig } from "./printform/config.js";
import { DomHelpers } from "./printform/dom.js";
import { PrintFormFormatter } from "./printform/formatter.js";
import { PRINTFORM_VERSION } from "./version.js";

// 检测是否为移动设备
function isMobileDevice() {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
}

// 根据设备类型获取适当的延迟时间
function getDeviceDelay() {
  return isMobileDevice() ? 50 : 1; // 移动端使用 50ms,桌面使用 1ms
}

function withDividerClassAppend(globalScope, classAppend, fn) {
  const prior = globalScope.__printFormDividerClassAppend;
  globalScope.__printFormDividerClassAppend = typeof classAppend === "string" ? classAppend : "";
  try {
    return fn();
  } finally {
    if (prior === undefined) {
      delete globalScope.__printFormDividerClassAppend;
    } else {
      globalScope.__printFormDividerClassAppend = prior;
    }
  }
}

function pauseInMilliseconds(time) {
  return new Promise((resolve, reject) => {
    if (typeof time === "number" && time > 0) {
      setTimeout(resolve, time);
    } else {
      reject(new Error("Invalid time value"));
    }
  });
}

let pendingFormat = null;

function formatAllPrintForms(overrides = {}) {
  if (pendingFormat) return pendingFormat;
  const globalScope = typeof window !== "undefined" ? window : globalThis;
  globalScope.__printFormProcessing = true;
  pendingFormat = formatBatch(globalScope, overrides).finally(() => {
    pendingFormat = null;
    globalScope.__printFormProcessing = false;
  });
  return pendingFormat;
}

async function formatBatch(globalScope, overrides) {
  const doc = globalScope.document;
  const forms = doc ? Array.from(doc.querySelectorAll(".printform")) : [];
  const errors = [];
  const report = { formattedCount: 0, failedCount: 0 };
  globalScope.__printFormProcessed = false;
  for (let index = 0; index < forms.length; index += 1) {
    const formEl = forms[index];
    const perFormOverrides = { ...overrides };
    if (perFormOverrides.divPageBreakBeforeClassAppend === undefined && formEl.dataset) {
      const value = formEl.dataset.divPageBreakBeforeClassAppend;
      if (typeof value === "string" && value.trim()) {
        perFormOverrides.divPageBreakBeforeClassAppend = value.trim();
      }
    }
    const dividerClassAppend = perFormOverrides.divPageBreakBeforeClassAppend;
    try {
      await pauseInMilliseconds(getDeviceDelay());
      const config = getPrintformConfig(formEl, perFormOverrides);
      const formatted = withDividerClassAppend(globalScope, dividerClassAppend, () => {
        const formatter = new PrintFormFormatter(formEl, config, perFormOverrides);
        return formatter.format();
      });
      if (report.formattedCount > 0 && formatted?.parentNode) {
        formatted.parentNode.insertBefore(DomHelpers.createPageBreakDivider(dividerClassAppend), formatted);
      }
      report.formattedCount += 1;
    } catch (error) {
      errors.push(error);
      report.failedCount += 1;
    }
  }
  globalScope.__printFormProcessed = errors.length === 0;
  if (errors.length) {
    const error = new AggregateError(errors, `${errors.length} print form(s) failed to paginate`);
    error.report = report;
    throw error;
  }
  return report;
}

function formatSinglePrintForm(formEl, overrides = {}) {
  const globalScope = typeof window !== "undefined" ? window : globalThis;
  const perFormOverrides = { ...overrides };
  if (perFormOverrides.divPageBreakBeforeClassAppend === undefined && formEl && formEl.dataset) {
    const datasetValue = formEl.dataset.divPageBreakBeforeClassAppend;
    if (typeof datasetValue === "string" && datasetValue.trim()) {
      perFormOverrides.divPageBreakBeforeClassAppend = datasetValue.trim();
    }
  }
  const dividerClassAppend = perFormOverrides.divPageBreakBeforeClassAppend;
  const config = getPrintformConfig(formEl, perFormOverrides);
  return withDividerClassAppend(globalScope, dividerClassAppend, () => {
    const formatter = new PrintFormFormatter(formEl, config, perFormOverrides);
    return formatter.format();
  });
}

const api = {
  version: PRINTFORM_VERSION,
  formatAll: formatAllPrintForms,
  format: formatSinglePrintForm,
  DEFAULT_CONFIG,
  DEFAULT_PADDT_CONFIG
};

const globalScope = typeof window !== "undefined" ? window : null;
if (globalScope) {
  if (globalScope.__printFormScriptLoaded__) {
    globalScope.PrintForm = globalScope.PrintForm || api;
  } else {
    globalScope.__printFormScriptLoaded__ = true;
    globalScope.PrintForm = globalScope.PrintForm || {};
    Object.assign(globalScope.PrintForm, api);
    const doc = globalScope.document;
    if (doc && doc.addEventListener) {
      // 改进的加载时机处理,特别针对移动端
      function ensureReadyAndFormat() {
        const isMobile = isMobileDevice();
        const delay = isMobile ? 150 : 50; // 移动端需要更多时间让样式完全应用

        if (doc.readyState === 'complete') {
          // 文档已完全加载,添加延迟确保样式已应用
          setTimeout(() => {
            formatAllPrintForms().catch(error => console.error("printform format error", error));
          }, delay);
        } else {
          // 使用 load 事件而不是 DOMContentLoaded,确保 CSS 已加载
          globalScope.addEventListener('load', () => {
            setTimeout(() => {
              formatAllPrintForms().catch(error => console.error("printform format error", error));
            }, delay);
          });
        }
      }

      // 若脚本在 DOMContentLoaded 之后才注入（动态加载场景），事件不会再触发，需立即执行
      if (doc.readyState === "loading") {
        doc.addEventListener("DOMContentLoaded", ensureReadyAndFormat);
      } else {
        ensureReadyAndFormat();
      }
    }
  }
}

export default api;
