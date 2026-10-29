import fs from "node:fs";
import { expect, it } from "vitest";
it("keeps one updater and loaded-version display in the topbar beside language controls", () => {
  document.body.innerHTML = fs.readFileSync("gallery/index.html", "utf8").match(/<body>([\s\S]*)<\/body>/)[1];
  const bar = document.querySelector(".topbar");
  for (const id of ["running-version", "update-state", "check-update"]) {
    expect(document.querySelectorAll("#" + id)).toHaveLength(1);
    expect(bar.contains(document.getElementById(id))).toBe(true);
  }
  expect(document.querySelector("#update-state").getAttribute("role")).toBe("status");
  expect(document.querySelector("#check-update").getAttribute("type")).toBe("button");
  expect([...bar.querySelectorAll("button")].map(e => e.id || e.dataset.language)).toEqual(["en", "zh", "check-update"]);
  expect(document.querySelectorAll("#update-button")).toHaveLength(1);
});
