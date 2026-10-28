// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");
let project;
beforeEach(() => {
  project = fs.mkdtempSync(path.join(os.tmpdir(), "pf-original-fixture-"));
  fs.cpSync(path.join(root, "e2e/fixtures/gallery-original"), path.join(project, "e2e/fixtures/gallery-original"), { recursive: true });
  fs.copyFileSync(path.join(root, "e2e/fixtures/gallery-original-build.js"), path.join(project, "e2e/fixtures/gallery-original-build.js"));
  fs.writeFileSync(path.join(project, "package.json"), '{"type":"module"}');
  fs.mkdirSync(path.join(project, "dist"));
  // Unit checks need only a present runtime; browser regressions use the real local engine.
  fs.writeFileSync(path.join(project, "dist/printform.js"), "// unit-only runtime placeholder\n");
});
afterEach(() => fs.rmSync(project, { recursive: true, force: true }));

function build() {
  return execFileSync(process.execPath, ["--input-type=module", "-e", `
    import net from 'node:net';
    globalThis.fetch = () => { throw new Error('Fixture network access forbidden'); };
    net.Socket.prototype.connect = () => { throw new Error('Fixture network access forbidden'); };
    const { buildOriginalGallery } = await import('./e2e/fixtures/gallery-original-build.js');
    console.log(JSON.stringify(await buildOriginalGallery('output')));
  `], {
    cwd: project, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, PATH: "", GIT_DIR: path.join(project, "no-git") }
  });
}

describe("vendored exact original Gallery fixture", () => {
  it("builds the byte-exact original worker without Git, tar, network or history", () => {
    expect(fs.existsSync(path.join(project, ".git"))).toBe(false);
    const result = JSON.parse(build().trim().split("\n").at(-1));
    expect(result).toEqual({
      revision: "53bd82bebad913553ad39d5e8c8ef63638db75f5",
      workerBlob: "b0c0b0b00d74b748503c042ac975d77a2228ec4a",
      builderBlob: "8f918a556792f569adcfebeb7a3b3ce83bcf262e",
      archiveSha256: "bba0bbfa933b89f53c838d9df20f3acf64f881f86072d670524339a8f9429313",
      builtWorkerSha256: "a673efc47df4c8fb1c9516da72872636f0feb874a1ad3bc35d6b0c28c337a2f1"
    });
    const output = path.join(project, "output");
    const worker = fs.readFileSync(path.join(output, "gallery/sw.js"), "utf8");
    const precache = JSON.parse(worker.match(/^const PRECACHE = (.*);$/m)[1]);
    expect(precache).toHaveLength(174);
    for (const name of precache) expect(fs.statSync(path.resolve(output, "gallery", name)).isFile()).toBe(true);
    expect(worker).toContain('importScripts("./build-identity-classic.js")');
    expect(worker).not.toContain("GET_BUILD");
    expect(fs.existsSync(path.join(output, "gallery/thumbs"))).toBe(false);
    for (const name of ["LICENSE", "gallery/designs/assets/demobank/FONT-LICENSE.txt", "gallery/designs/assets/school-invoices/FONT-LICENSE.txt", "gallery/designs/assets/pf057/LICENSES.md"]) {
      expect(fs.statSync(path.join(output, name)).size).toBeGreaterThan(0);
    }
  });

  it("rejects a damaged archive before writing or importing any inputs", () => {
    const archive = path.join(project, "e2e/fixtures/gallery-original/inputs.json.gz");
    const bytes = fs.readFileSync(archive);
    bytes[bytes.length - 10] ^= 1;
    fs.writeFileSync(archive, bytes);
    expect(build).toThrow("Original Gallery archive SHA-256 mismatch");
    expect(fs.existsSync(path.join(project, "output"))).toBe(false);
  });

  it("refuses to merge inputs into a nonempty output", () => {
    fs.mkdirSync(path.join(project, "output"));
    fs.writeFileSync(path.join(project, "output/keep"), "untouched");
    expect(build).toThrow("Original Gallery output must be an empty directory");
    expect(fs.readdirSync(path.join(project, "output"))).toEqual(["keep"]);
    expect(fs.readFileSync(path.join(project, "output/keep"), "utf8")).toBe("untouched");
  });

  it("refuses an output symlink without writing through it", () => {
    fs.mkdirSync(path.join(project, "target"));
    fs.symlinkSync("target", path.join(project, "output"), "dir");
    expect(build).toThrow("Original Gallery output must be an empty directory");
    expect(fs.readdirSync(path.join(project, "target"))).toEqual([]);
  });
});
