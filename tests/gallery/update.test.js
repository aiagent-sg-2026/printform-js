import { describe, expect, it, vi } from "vitest";
import { createUpdater } from "../../gallery/js/pwa-update.js";

function setup({ waiting = false, supported = true, running = "a" } = {}) {
  class Worker extends EventTarget {
    constructor(build) { super(); this.build = build; }
    postMessage(message, ports) {
      if (message.type === "GET_BUILD") { ports[0].postMessage({ type: "BUILD", build: this.build }); ports[0].close(); }
      else messages.push(message);
    }
  }
  const messages = [], states = [];
  const serviceWorker = new EventTarget();
  const registration = Object.assign(new EventTarget(), { active: new Worker("a"), waiting: waiting ? new Worker("b") : null, update: vi.fn(async () => {}) });
  serviceWorker.controller = registration.active;
  serviceWorker.getRegistration = vi.fn(async () => registration);
  serviceWorker.register = vi.fn();
  let online = true, busy = false, latest = waiting ? "b" : "a";
  const reload = vi.fn();
  const fetchLatest = vi.fn(async () => latest);
  const updater = createUpdater({ serviceWorker: supported ? serviceWorker : null, running, online: () => online, busy: () => busy, reload, fetchLatest, render: (state) => states.push(state) });
  return { updater, registration, serviceWorker, messages, states, reload, fetchLatest, Worker,
    controlWaiting() {
      registration.active = registration.waiting; registration.waiting = null;
      serviceWorker.controller = registration.active;
    },
    setOnline(value) { online = value; }, setBusy(value) { busy = value; }, setLatest(value) { latest = value; } };
}

describe("Gallery safe update controller", () => {
  it("clearly reports unsupported and same-version checks", async () => {
    const unsupported = setup({ supported: false });
    await unsupported.updater.start();
    expect(unsupported.states.at(-1).state).toBe("unsupported");
    const app = setup(); await app.updater.start();
    expect(app.states.at(-1).state).toBe("upToDate");
    expect(app.reload).not.toHaveBeenCalled();
  });
  it("offers shell B + legacy active A + waiting B without querying the legacy worker", async () => {
    const app = setup({ waiting: true, running: "b" });
    const legacyMessage = vi.spyOn(app.registration.active, "postMessage").mockImplementation(() => {});
    await app.updater.start();
    expect(app.states.at(-1)).toMatchObject({ state: "updateAvailable", available: "b", checking: false });
    await app.updater.check();
    expect(app.states.at(-1)).toMatchObject({ state: "updateAvailable", available: "b", checking: false });
    expect(legacyMessage).not.toHaveBeenCalled();
    expect(app.reload).not.toHaveBeenCalled();
    await app.updater.activate();
    expect(app.messages).toEqual([{ type: "SKIP_WAITING", build: "b" }]);
  });
  it("manual checking retries a failed initial registration lookup", async () => {
    const app = setup();
    app.serviceWorker.getRegistration.mockRejectedValueOnce(new Error("temporary failure"));
    await app.updater.start();
    expect(app.states.at(-1).state).toBe("updateFailed");
    await app.updater.check();
    expect(app.states.at(-1).state).toBe("upToDate");
    expect(app.serviceWorker.getRegistration).toHaveBeenCalledTimes(2);
  });
  it("never labels a network-only new build as installed/ready", async () => {
    const app = setup(); app.setLatest("b"); await app.updater.start();
    expect(app.states.at(-1)).toMatchObject({ state: "updateFailed", available: "" });
    expect(app.reload).not.toHaveBeenCalled();
  });
  it("blocks offline checking and activation, preserving the waiting build", async () => {
    const app = setup({ waiting: true }); await app.updater.start();
    app.setOnline(false); await app.updater.check(); await app.updater.activate();
    expect(app.states.at(-1)).toMatchObject({ state: "offline", available: "b" });
    expect(app.messages).toEqual([]);
    expect(app.reload).not.toHaveBeenCalled();
  });
  it("protects open previews and reloads at most once only after user activation", async () => {
    const app = setup({ waiting: true }); await app.updater.start();
    app.setBusy(true); await app.updater.activate();
    expect(app.messages).toEqual([]);
    expect(app.states.at(-1).state).toBe("updateDeferred");
    app.setBusy(false); await app.updater.activate();
    expect(app.messages).toEqual([{ type: "SKIP_WAITING", build: "b" }]);
    expect(app.reload).not.toHaveBeenCalled();
    app.controlWaiting();
    app.serviceWorker.dispatchEvent(new Event("controllerchange"));
    app.serviceWorker.dispatchEvent(new Event("controllerchange"));
    expect(app.reload).toHaveBeenCalledTimes(1);
  });
  it("another tab's controllerchange cannot force a reload", async () => {
    const app = setup(); await app.updater.start();
    app.registration.active.build = "b";
    app.serviceWorker.dispatchEvent(new Event("controllerchange"));
    await vi.waitFor(() => expect(app.states.at(-1).available).toBe("b"));
    expect(app.reload).not.toHaveBeenCalled();
    await app.updater.activate();
    expect(app.reload).toHaveBeenCalledTimes(1);
  });
  it("a stalled activation recovers and a retry uses the complete flow", async () => {
    const app = setup({ waiting: true }); await app.updater.start();
    vi.useFakeTimers();
    try {
      await app.updater.activate();
      await vi.advanceTimersByTimeAsync(10001);
      expect(app.states.at(-1)).toMatchObject({ state: "updateFailed", activating: false });
      expect(app.reload).not.toHaveBeenCalled();
      await app.updater.activate();
      app.controlWaiting();
      app.serviceWorker.dispatchEvent(new Event("controllerchange"));
      expect(app.reload).toHaveBeenCalledTimes(1);
      expect(app.messages).toHaveLength(2);
    } finally { vi.useRealTimers(); }
  });
  it("clears the equal-shell pending offer after another tab activates it, without reloading", async () => {
    const app = setup({ waiting: true, running: "b" }); await app.updater.start();
    expect(app.states.at(-1).available).toBe("b");
    app.controlWaiting(); app.serviceWorker.dispatchEvent(new Event("controllerchange"));
    await vi.waitFor(() => expect(app.states.at(-1)).toMatchObject({ state: "upToDate", available: "" }));
    expect(app.reload).not.toHaveBeenCalled();
  });
  it("keeps a waiting offer when the current controller is observed again", async () => {
    const app = setup({ waiting: true }); await app.updater.start();
    app.serviceWorker.dispatchEvent(new Event("controllerchange"));
    await vi.waitFor(() => expect(app.states.at(-1)).toMatchObject({ state: "updateAvailable", available: "b" }));
    expect(app.reload).not.toHaveBeenCalled();
  });
  it("ignores late offers from a replaced worker", async () => {
    const app = setup(); await app.updater.start();
    let reply;
    vi.spyOn(app.registration.active, "postMessage").mockImplementation((message, ports) => { reply = ports[0]; });
    app.serviceWorker.dispatchEvent(new Event("controllerchange"));
    app.registration.active = new app.Worker("b");
    app.serviceWorker.controller = app.registration.active;
    app.serviceWorker.dispatchEvent(new Event("controllerchange"));
    await vi.waitFor(() => expect(app.states.at(-1).available).toBe("b"));
    reply.postMessage({ type: "BUILD", build: "obsolete" }); reply.close();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(app.states.at(-1)).toMatchObject({ state: "updateAvailable", available: "b" });
    expect(app.reload).not.toHaveBeenCalled();
  });
  it("failed waiting identity clears pending action and remains retryable", async () => {
    const app = setup({ waiting: true, running: "b" }); await app.updater.start();
    const message = vi.spyOn(app.registration.waiting, "postMessage").mockImplementation((request, ports) => {
      ports[0].postMessage({ type: "BUILD", build: "invalid build!" }); ports[0].close();
    });
    await app.updater.check();
    expect(app.states.at(-1)).toMatchObject({ state: "updateFailed", available: "", checking: false });
    await app.updater.activate(); expect(app.messages).toEqual([]);
    message.mockRestore(); await app.updater.check();
    expect(app.states.at(-1)).toMatchObject({ state: "updateAvailable", available: "b" });
    expect(app.reload).not.toHaveBeenCalled();
  });
  it("does not reload on an unrelated controllerchange during activation", async () => {
    const app = setup({ waiting: true }); await app.updater.start();
    await app.updater.activate();
    app.serviceWorker.controller = new app.Worker("unrelated");
    app.serviceWorker.dispatchEvent(new Event("controllerchange"));
    expect(app.reload).not.toHaveBeenCalled();
    app.controlWaiting(); app.serviceWorker.dispatchEvent(new Event("controllerchange"));
    expect(app.reload).toHaveBeenCalledTimes(1);
  });
  it("failed network checks stay retryable without deleting user data", async () => {
    const app = setup(); app.fetchLatest.mockRejectedValueOnce(new Error("synthetic offline"));
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    await app.updater.start(); expect(app.states.at(-1).state).toBe("updateFailed");
    await app.updater.check(); expect(app.states.at(-1).state).toBe("upToDate");
    warning.mockRestore();
  });
});
