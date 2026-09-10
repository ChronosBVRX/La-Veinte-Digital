/**
 * Empaqueta el sidecar en un solo archivo JS (dist/sidecar.js) con esbuild,
 * resolviendo @la-veinte/tts-core y los imports relativos del corpus normativo.
 * Para distribución: empaquetar node.exe junto a este archivo como sidecar Tauri.
 */
import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..", "..", "..");

import { execSync } from "node:child_process";

let gitCommit = "unknown";
try {
  gitCommit = execSync("git rev-parse --short HEAD", { cwd: root }).toString().trim();
} catch {}
const buildTime = new Date().toISOString();

await build({
  entryPoints: [path.join(here, "..", "src", "index.ts")],
  outfile: path.join(here, "..", "dist", "sidecar.js"),
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  external: [],
  alias: {
    "@la-veinte/tts-core": path.join(root, "packages", "tts-core", "src", "index.ts"),
  },
  define: {
    "process.env.SIDECAR_GIT_COMMIT": JSON.stringify(gitCommit),
    "process.env.SIDECAR_BUILD_TIME": JSON.stringify(buildTime),
  },
  banner: { js: "/* AI Radio Studio sidecar (bundled) */" },
  logLevel: "info",
});

console.log("sidecar empaquetado en dist/sidecar.js");
