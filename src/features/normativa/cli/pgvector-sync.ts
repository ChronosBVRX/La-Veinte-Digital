import { REPO_ROOT } from "./shared";
import { runPgvectorSync } from "../services/pgvector-sync";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const maxFlag = process.argv.find((a) => a.startsWith("--max="));
  const maxItems = maxFlag ? Number(maxFlag.split("=")[1]) : undefined;

  console.log(`Sincronización corpus → Supabase pgvector${dryRun ? " (DRY RUN)" : ""}`);
  const metrics = await runPgvectorSync(REPO_ROOT, {
    log: (m) => console.log(m),
    dryRun,
    maxItems,
  });

  console.log("");
  console.log("════════ RESUMEN DE SINCRONIZACIÓN ════════");
  console.log(`Chunks locales:        ${metrics.localTotal}`);
  console.log(`Chunks remotos antes:  ${metrics.remoteTotalBefore}`);
  console.log(`Insertados:            ${metrics.inserted}`);
  console.log(`Actualizados:          ${metrics.updated}`);
  console.log(`Sin cambios:           ${metrics.unchanged}`);
  console.log(`Embeddings generados:  ${metrics.embeddingsGenerated}`);
  console.log(`Embeddings reutilizados: ${metrics.embeddingsReused}`);
  console.log(`Errores:               ${metrics.errors}`);
  console.log(`Duración:              ${((Date.now() - Date.parse(metrics.startedAt)) / 1000).toFixed(1)}s`);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
