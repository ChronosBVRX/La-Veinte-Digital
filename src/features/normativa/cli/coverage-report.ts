import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT, loadBootstrapManifest } from "./shared";
import { NormativeCatalog } from "../services/catalog";
import { buildCoverage } from "../services/coverage";
import { normativaRoot } from "../core/manifest";

const TOPICS = [
  "Contrato colectivo",
  "Estatutos",
  "Vacaciones",
  "Guardias",
  "Tiempo extraordinario",
  "Nómina",
  "Fondo de ahorro",
  "Antigüedad",
  "Permisos y licencias",
  "Sanciones",
  "Escalafón",
  "Cambio de rama",
  "Bolsa de trabajo",
  "Plantillas",
  "Profesiogramas",
  "Jubilaciones y pensiones",
  "Vivienda e INFONAVIT",
  "AFORE/SAR",
  "FONACOT",
  "Riesgos de trabajo",
  "Seguridad e higiene",
  "Acoso y violencia laboral",
  "Discriminación",
  "Radiología",
  "Enfermería",
  "Urgencias",
  "RPBI",
  "Becas",
  "Capacitación",
  "Jornada 40 horas / reformas 2026",
  "Ley Silla / bipedestación",
  "Teletrabajo",
  "Discapacidad",
  "Expediente clínico",
];

function classify(catalog: NormativeCatalog, manifestIds: Set<string>) {
  const buckets = {
    currentVerified: [] as string[],
    pendingReview: [] as string[],
    superseded: [] as string[],
    historical: [] as string[],
    missing: [] as string[],
    sourceMismatch: [] as string[],
  };

  const docs = catalog.listDocuments();
  const byId = new Map(docs.map((d) => [d.id, d]));

  for (const id of manifestIds) {
    if (!byId.has(id)) {
      // Índices de descubrimiento sin contenido propio no cuentan como faltantes.
      const isIndex = /INDEX|MARCO-NORMATIVO|DOCUMENTOS|LEYES-REGLAMENTOS|CONSEJO-TECNICO|CAMARA-LEYES/.test(id);
      if (!isIndex) buckets.missing.push(id);
    }
  }

  for (const d of docs) {
    const v = d.currentVersion ? catalog.getVersion(d.currentVersion) : null;
    if (!v && manifestIds.has(d.id)) {
      buckets.missing.push(d.id);
      continue;
    }
    if (v?.status === "SOURCE_MISMATCH") {
      buckets.sourceMismatch.push(d.id);
      continue;
    }
    switch (d.validity) {
      case "CURRENT":
        buckets.currentVerified.push(d.id);
        break;
      case "HISTORICAL":
        buckets.historical.push(d.id);
        break;
      case "SUPERSEDED":
      case "REPEALED":
        buckets.superseded.push(d.id);
        break;
      case "PENDING_REVIEW":
        buckets.pendingReview.push(d.id);
        break;
      default:
        buckets.pendingReview.push(d.id);
    }
  }
  return buckets;
}

async function main() {
  const manifest = loadBootstrapManifest();
  const catalog = new NormativeCatalog(REPO_ROOT);
  const manifestIds = new Set(manifest.sources.filter((s) => s.type !== "index").map((s) => s.id));
  const b = classify(catalog, manifestIds);

  const lines: string[] = [];
  lines.push("# Reporte de Cobertura Normativa");
  lines.push("");
  lines.push(`Generado: ${new Date().toISOString()}`);
  lines.push(`Fecha de corte del manifiesto: ${manifest.cutoff}`);
  lines.push("");

  lines.push("## Clasificación de documentos");
  lines.push("");
  const section = (title: string, ids: string[], note?: string) => {
    lines.push(`### ${title} (${ids.length})`);
    if (note) lines.push(note);
    for (const id of ids.sort()) lines.push(`- ${id}`);
    lines.push("");
  };
  section("CURRENT VERIFIED", b.currentVerified, "*Vigencia CURRENT con versión local verificada.*");
  section(
    "PENDING REVIEW",
    b.pendingReview,
    "*Requieren verificación editorial/vigencia antes de usarse como fuente definitiva.*"
  );
  section("SUPERSEDED", b.superseded);
  section("HISTORICAL", b.historical, "*Disponibles solo para recuperación histórica explícita.*");
  section("MISSING", [...new Set(b.missing)], "*En el manifiesto pero sin documento local.*");
  section("SOURCE MISMATCH", b.sourceMismatch, "*La clave del documento no coincide con la fuente. NO activar en RAG.*");

  lines.push("## Cobertura temática");
  lines.push("");
  lines.push("| Tema | Cobertura | Faltantes | Sustento |");
  lines.push("|---|---|---|---|");

  let full = 0;
  let partial = 0;
  let missingCount = 0;
  for (const topic of TOPICS) {
    const r = buildCoverage(catalog, topic);
    const label = r.critical.length === 0 && r.available === r.total ? "FULL" : r.available > 0 ? "PARTIAL" : "MISSING";
    if (label === "FULL") full++;
    else if (label === "PARTIAL") partial++;
    else missingCount++;
    const sustento = r.items
      .filter((i) => i.status !== "unavailable")
      .map((i) => i.id)
      .join(", ");
    lines.push(`| ${topic} | ${label} (${r.coverage}%) | ${r.critical.map((c) => c.id).join(", ") || "—"} | ${sustento || "—"} |`);
  }
  lines.push("");
  lines.push(`Resumen temático: **FULL=${full}, PARTIAL=${partial}, MISSING=${missingCount}** de ${TOPICS.length}.`);
  lines.push("");

  const h = catalog.health();
  lines.push("## Salud general");
  lines.push("");
  lines.push(`- Documentos en catálogo: ${h.documents}`);
  lines.push(`- Versiones: ${h.versions}`);
  lines.push(`- Secciones: ${h.sections}`);
  lines.push(`- Chunks: ${h.chunks}`);
  lines.push(`- Referencias no localizadas: ${h.missingRefs}`);
  lines.push("");

  const out = path.join(normativaRoot(REPO_ROOT), "normativa-coverage-report.md");
  fs.writeFileSync(out, lines.join("\n"), "utf8");
  console.log(`Reporte generado: ${out}`);
}

main();
