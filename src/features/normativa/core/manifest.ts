import fs from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import type { BootstrapManifest, SourceSpec } from "./types";
import { sha256Hex } from "./hashing";

export function loadManifest(filePath: string): BootstrapManifest {
  const raw = fs.readFileSync(filePath, "utf8");
  const data = parse(raw) as BootstrapManifest;
  if (!data || !Array.isArray(data.sources) || data.sources.length === 0) {
    throw new Error(`Manifest inválido: ${filePath}`);
  }
  const ids = new Set<string>();
  for (const s of data.sources) {
    if (!s.id) throw new Error("Fuente sin id en manifest");
    if (ids.has(s.id)) throw new Error(`id duplicado en manifest: ${s.id}`);
    ids.add(s.id);
  }
  return data;
}

export function sourceSpecHash(spec: SourceSpec): string {
  return sha256Hex(
    JSON.stringify({
      id: spec.id,
      url: spec.url ?? null,
      title: spec.title,
      effectiveFrom: spec.effectiveFrom ?? null,
      effectiveUntil: spec.effectiveUntil ?? null,
      priority: spec.priority ?? "medium",
    })
  );
}

export const CATEGORY_DIRS: Record<string, string> = {
  cct: "cct",
  sntss: "sntss",
  federal: "federal",
  imss: "imss",
  procedimientos: "procedimientos",
  "seguridad-salud": "seguridad-salud",
  nom: "nom",
  "riesgos-trabajo": "riesgos-trabajo",
  integridad: "integridad",
  tabuladores: "tabuladores",
  otros: "otros",
};

export function categoryDir(category: string): string {
  return CATEGORY_DIRS[category] ?? "otros";
}

export function normativaRoot(repoRoot: string): string {
  return path.join(repoRoot, "data", "normativa");
}

export function ensureDirs(root: string): string[] {
  const dirs = [
    root,
    path.join(root, "documents"),
    path.join(root, "indexes"),
    ...Object.values(CATEGORY_DIRS).map((d) => path.join(root, "documents", d)),
  ];
  for (const d of dirs) {
    fs.mkdirSync(d, { recursive: true });
  }
  return dirs;
}

export function versionDirFor(root: string, docId: string, category: string, label: string): string {
  return path.join(root, "documents", categoryDir(category), docId, label);
}
