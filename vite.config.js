import { defineConfig } from "vite";
import path from "node:path";

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: false,
    // Keep `dist/printform.js` readable for debugging and easier review.
    // If you need a smaller artifact for distribution, enable minify and/or add a separate `.min.js` output.
    minify: false,
    lib: {
      entry: path.resolve(__dirname, "src/vite-entry.js"),
      name: "PrintForm",
      formats: ["iife"],
      fileName: () => "printform.js"
    }
  },
  test: {
    environment: "jsdom",
    setupFiles: ["tests/setup/local-storage-polyfill.js"],
    include: ["tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}", "coding-runner/**/*.test.mjs"]
  }
});
