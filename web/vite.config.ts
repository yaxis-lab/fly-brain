import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],

  base: "",

  resolve: {
    conditions: [
      "neuroglancer/datasource:none_by_default",
      "neuroglancer/datasource/precomputed:enabled",
    ],
  },

  worker: {
    format: "es",
  },

  build: {
    chunkSizeWarningLimit: 2 * 1024 * 1024,
  },

  optimizeDeps: {
    entries: [
      "index.html",
      "node_modules/neuroglancer/src/main.bundle.js",
      "node_modules/neuroglancer/src/async_computation.bundle.js",
      "node_modules/neuroglancer/src/chunk_worker.bundle.js",
    ],

    exclude: ["neuroglancer"],
  },
});
