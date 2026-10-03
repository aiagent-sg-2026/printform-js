import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bindAppUi } from "../../studio-v2/ui/app-bindings.js";
import { setUiLocale, t } from "../../studio-v2/ui/ui-i18n.js";

const html = readFileSync("studio-v2/index.html", "utf8");
const $ = (selector) => document.querySelector(selector);
const noop = () => {};
let bindings, windowListeners, documentListeners;

beforeEach(async () => {
  vi.useFakeTimers();
  document.body.innerHTML = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)[1];
  await setUiLocale("en-MY", document, false);
  windowListeners = vi.spyOn(window, "addEventListener");
  documentListeners = vi.spyOn(document, "addEventListener");
  bindings = bindAppUi({
    $, actions: {}, getBus: noop, renderer: {}, renderQuality: noop, toast: noop, t,
    onLocaleChange: noop, refreshLocalizedUi: () => bindings.refresh(),
    onDataPolicyChange: noop, onSample: noop, onHistoryAction: noop,
    getLastValidation: noop, isDirty: () => false, versions: {}
  });
});

afterEach(() => {
  for (const args of windowListeners.mock.calls) window.removeEventListener(...args);
  for (const args of documentListeners.mock.calls) document.removeEventListener(...args);
  vi.clearAllTimers();
  vi.restoreAllMocks();
  vi.useRealTimers();
  document.body.innerHTML = "";
  document.body.className = "";
});

function openEditor() {
  $("#editor-toggle").focus();
  $("#editor-toggle").click();
}

describe("source editor focus", () => {
  it("focuses the opened editor and restores its launcher without a timer", () => {
    openEditor();
    expect($("#editor-panel").getAttribute("aria-hidden")).toBe("false");
    expect(document.activeElement).toBe($("#editor-panel-close"));
    $("#editor-panel-close").click();
    expect($("#editor-panel").getAttribute("aria-hidden")).toBe("true");
    expect(document.activeElement).toBe($("#editor-toggle"));
    vi.runAllTimers();
    expect(document.activeElement).toBe($("#editor-toggle"));
  });

  it("keeps a newer editor selection when the old opening delay would elapse", () => {
    openEditor();
    vi.advanceTimersByTime(20);
    $("#manifest-editor").focus();
    $("#manifest-editor").value = '{"title":"User edit"}';
    vi.advanceTimersByTime(30);
    expect(document.activeElement).toBe($("#manifest-editor"));
    expect($("#manifest-editor").value).toBe('{"title":"User edit"}');
  });

  it.each(["en-MY", "zh-CN", "ms-MY", "ja-JP", "vi-VN"])(
    "keeps manifest focus across %s refresh before the old opening delay", async (locale) => {
      openEditor();
      vi.advanceTimersByTime(20);
      $("#manifest-editor").focus();
      await setUiLocale(locale, document, false);
      expect(document.activeElement).toBe($("#manifest-editor"));
      vi.advanceTimersByTime(30);
      expect(document.activeElement).toBe($("#manifest-editor"));
    }
  );

  it("does not restore the launcher over a newer selection after closing", () => {
    openEditor();
    vi.runAllTimers();
    $("#editor-panel-close").click();
    vi.advanceTimersByTime(20);
    $("#validate-button").focus();
    vi.advanceTimersByTime(30);
    expect(document.activeElement).toBe($("#validate-button"));
  });

  it("does not replay an obsolete close after the editor reopens", () => {
    openEditor();
    vi.runAllTimers();
    $("#editor-panel-close").click();
    vi.advanceTimersByTime(10);
    openEditor();
    $("#manifest-editor").focus();
    vi.advanceTimersByTime(40);
    expect($("#editor-panel").getAttribute("aria-hidden")).toBe("false");
    expect(document.activeElement).toBe($("#manifest-editor"));
    vi.runAllTimers();
    expect(document.activeElement).toBe($("#manifest-editor"));
  });
});
