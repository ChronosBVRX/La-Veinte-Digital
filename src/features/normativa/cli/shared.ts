import path from "node:path";
import { loadManifest, normativaRoot } from "../core/manifest";
import type { BootstrapManifest } from "../core/types";

export const REPO_ROOT = process.env.NORMATIVA_REPO_ROOT ?? process.cwd();
export const MANIFEST_FILE = path.join(REPO_ROOT, "resources", "normativa", "bootstrap-sources.yaml");
export const DATA_ROOT = normativaRoot(REPO_ROOT);

export function loadBootstrapManifest(): BootstrapManifest {
  return loadManifest(MANIFEST_FILE);
}
