import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { focusInspectorElement } from "../../studio-v2/ui/inspector-focus.js";

let panel, close, toggle, prompt;

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '<button id="toggle">Open</button><section class="is-open"><button id="close">Close</button><textarea></textarea></section>';
  panel = document.querySelector("section");
  close = document.querySelector("#close");
  toggle = document.querySelector("#toggle");
  prompt = document.querySelector("textarea");
  for (const element of [close, toggle, prompt]) vi.spyOn(element, "getClientRects").mockReturnValue([{}]);
});

afterEach(() => {
  vi.runAllTimers();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("inspector transition focus", () => {
  it("keeps the composer focused when the user starts typing before a delayed focus retry", () => {
    close.focus();
    focusInspectorElement(panel, close, true);
    vi.advanceTimersByTime(350);
    prompt.focus();
    prompt.value = "Change the shared theme from this component";
    vi.advanceTimersByTime(100);
    expect(document.activeElement).toBe(prompt);
    expect(prompt.value).toBe("Change the shared theme from this component");
  });

  it("preserves normal initial close focus and launcher restoration", () => {
    close.focus();
    focusInspectorElement(panel, close, true);
    vi.runAllTimers();
    expect(document.activeElement).toBe(close);
    panel.classList.remove("is-open");
    toggle.focus();
    focusInspectorElement(panel, toggle, false);
    vi.runAllTimers();
    expect(document.activeElement).toBe(toggle);
  });

  it("waits until a transition target is visible when focus has not moved", () => {
    close.style.visibility = "hidden";
    toggle.focus();
    focusInspectorElement(panel, close, true);
    vi.advanceTimersByTime(50);
    expect(document.activeElement).toBe(toggle);
    close.style.visibility = "visible";
    vi.advanceTimersByTime(150);
    expect(document.activeElement).toBe(close);
  });

  it("does not refocus a panel after its open state changed", () => {
    focusInspectorElement(panel, close, true);
    panel.classList.remove("is-open");
    toggle.focus();
    vi.runAllTimers();
    expect(document.activeElement).toBe(toggle);
  });
});
