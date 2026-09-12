import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

let gitCommit = "unknown";
let gitBranch = "unknown";
try {
  gitCommit = execSync("git rev-parse --short HEAD").toString().trim();
  gitBranch = execSync("git rev-parse --abbrev-ref HEAD").toString().trim();
} catch {}
const buildTime = new Date().toISOString();

const writeBuildInfoPlugin: Plugin = {
  name: "write-build-info",
  writeBundle(options) {
    const outDir = options.dir || path.resolve(__dirname, "dist");
    try {
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(
        path.join(outDir, "build-info.json"),
        JSON.stringify({ gitBranch, gitCommit, buildTime }, null, 2)
      );
    } catch {}
  },
};

const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), writeBuildInfoPlugin],
  define: {
    __BUILD_GIT_BRANCH__: JSON.stringify(gitBranch),
    __BUILD_GIT_SHA__: JSON.stringify(gitCommit),
    __BUILD_TIME__: JSON.stringify(buildTime),
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
