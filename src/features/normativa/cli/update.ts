import { loadBootstrapManifest, REPO_ROOT } from "./shared";
import { runUpdate } from "../services/update";

async function main() {
  const manifest = loadBootstrapManifest();
  const mode = (process.argv[2] as "all" | "critical" | "expiring") ?? "all";
  console.log(`NormativeUpdateService — modo: ${mode}`);
  const summary = await runUpdate(REPO_ROOT, manifest, mode, { log: (m) => console.log(m) });
  console.log("");
  console.log(`Revisados: ${summary.checked} | Cambiados: ${summary.changed} | Sin cambios: ${summary.unchanged} | Errores: ${summary.errors}`);
  if (summary.alerts.length > 0) {
    console.log("\nAlertas:");
    for (const a of summary.alerts) {
      const icon = a.severity === "expired" ? "🔴" : a.severity === "expiring" ? "🟡" : "🔁";
      console.log(`  ${icon} ${a.document}: ${a.message}`);
    }
  }
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
