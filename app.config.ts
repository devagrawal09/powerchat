import { defineConfig } from "@solidjs/start/config";
import tailwindcss from "@tailwindcss/vite";
import devtools from "solid-devtools/vite";

export default defineConfig({
  middleware: "src/middleware.ts",
  vite: {
    plugins: [tailwindcss(), devtools({ autoname: true })],
    optimizeDeps: {
      exclude: [
        "@powersync/web",
        "wa-sqlite",
        "wa-sqlite/dist/wa-sqlite.mjs",
        "wa-sqlite/dist/wa-sqlite.wasm",
        "WASQLiteDB.worker.js",
      ],
    },
    worker: {
      format: "es",
    },
  },
  ssr: false,
});
