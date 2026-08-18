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

await build({
  entryPoints: [path.join(here, "..", "src", "index.ts")],
  outfile: path.join(here, "..", "dist", "sidecar.js"),
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  external: ["edge-tts"],
  alias: {
    "@la-veinte/tts-core": path.join(root, "packages", "tts-core", "src", "index.ts"),
  },
  banner: { js: "/* AI Radio Studio sidecar (bundled) */" },
  logLevel: "info",
});

console.log("sidecar empaquetado en dist/sidecar.js");
