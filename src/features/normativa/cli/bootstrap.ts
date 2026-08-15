import fs from "node:fs";
import path from "node:path";
import { loadBootstrapManifest, REPO_ROOT } from "./shared";
import { runBootstrap } from "../services/bootstrap";
import { normativaRoot } from "../core/manifest";

async function main() {
  const manifest = loadBootstrapManifest();
  const report = await runBootstrap(REPO_ROOT, manifest, {
    log: (msg) => console.log(msg),
  });

  const ok = report.items.filter((i) => i.status === "DOWNLOADED").length;
  const err = report.items.filter((i) => i.status === "ERROR").length;
  const missing = report.items.filter((i) => i.status === "NOT_LOCATED").length;

  const md: string[] = [];
  md.push("# Reporte de Bootstrap — Biblioteca Normativa IMSS/SNTSS");
  md.push("");
  md.push(`- Fecha de corte: ${report.cutoff}`);
  md.push(`- Inicio: ${report.startedAt} / Fin: ${report.finishedAt}`);
  md.push(`- Descargados e indexados: **${ok}**`);
  md.push(`- Con error: **${err}**`);
  md.push(`- No localizados: **${missing}**`);
  md.push("");
  md.push("| Documento | Estado | Páginas | Secciones | Chunks | Vigencia | Reforma | SHA-256 |");
  md.push("|---|---|---|---|---|---|---|---|");
  for (const i of report.items) {
    const icon = i.status === "DOWNLOADED" ? "✅" : i.status === "ERROR" ? "❌" : i.status === "NOT_LOCATED" ? "🔎" : "⏭";
    md.push(
      `| ${i.id} | ${icon} ${i.status}${i.message ? ` — ${i.message}` : ""} | ${i.pages ?? "-"} | ${i.sections ?? "-"} | ${i.chunks ?? "-"} | ${i.validity ?? "-"} | ${i.lastReformDate ?? "-"} | ${i.sha256 ? i.sha256.slice(0, 16) + "…" : "-"} |`
    );
  }
  md.push("");
  md.push("## Totales del catálogo");
  md.push("");
  for (const [k, v] of Object.entries(report.counts)) {
    md.push(`- ${k}: ${v}`);
  }
  md.push("");

  const out = path.join(normativaRoot(REPO_ROOT), "normativa-bootstrap-report.md");
  fs.writeFileSync(out, md.join("\n"));
  console.log("");
  console.log(`Reporte: ${out}`);
  console.log(`OK=${ok} ERROR=${err} NOT_LOCATED=${missing}`);
  if (err > 0) process.exitCode = 2;
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
