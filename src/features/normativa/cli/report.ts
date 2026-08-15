import { REPO_ROOT } from "./shared";
import { NormativeCatalog } from "../services/catalog";

async function main() {
  const catalog = new NormativeCatalog(REPO_ROOT);
  const h = catalog.health();
  console.log("════════ PANEL DE SALUD DEL CORPUS ════════");
  console.log(`Documentos: ${h.documents}`);
  console.log(`  🟢 Vigentes: ${h.vigentes}`);
  console.log(`  🟡 Revisar: ${h.revisar}`);
  console.log(`  🔵 Históricos: ${h.historicos}`);
  console.log(`  🔴 Error: ${h.errores}`);
  console.log(`Secciones indexadas: ${h.sections}`);
  console.log(`Chunks: ${h.chunks}`);
  console.log(`Última actualización: ${h.latestUpdate ?? "nunca"}`);
  console.log(`Próxima expiración: ${h.nextExpiration ? `${h.nextExpiration.document} — ${h.nextExpiration.date}` : "ninguna"}`);
  console.log(`Referencias aún no localizadas: ${h.missingRefs}`);
  console.log("════════════════════════════════════════════");

  console.log("\nDocumentos:");
  for (const d of catalog.listDocuments()) {
    const v = d.currentVersion ? catalog.getVersion(d.currentVersion) : null;
    console.log(
      `  [${d.validity}] ${d.id} | ${d.title.slice(0, 70)} | págs=${v?.pages ?? "-"} | ${d.effectiveFrom ?? "-"} → ${d.effectiveUntil ?? "-"}${d.lastReformDate ? ` | reforma ${d.lastReformDate}` : ""}`
    );
  }
}

main();
