import { solidStart } from "@solidjs/start/config";
import { nitroV2Plugin } from "@solidjs/vite-plugin-nitro-2";
import tailwindcss from "@tailwindcss/vite";
import devtools from "solid-devtools/vite";
import { defineConfig } from "vite";

export default defineConfig(() => ({
  plugins: [
    solidStart({
      ssr: false,
    }),
    nitroV2Plugin(),
    tailwindcss(),
    devtools({ autoname: true }),
  ],
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
    format: "es" as const,
  },
}));
