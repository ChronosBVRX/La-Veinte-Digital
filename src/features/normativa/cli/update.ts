import { loadBootstrapManifest, REPO_ROOT } from "./shared";
import { runUpdate } from "../services/update";

async function main() {
  const manifest = loadBootstrapManifest();
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const mode = (args[0] as "all" | "critical" | "expiring") ?? "all";
  const idsFlag = process.argv.find((a) => a.startsWith("--ids="));
  const ids = idsFlag ? idsFlag.split("=")[1].split(",").map((s) => s.trim()).filter(Boolean) : undefined;
  console.log(`NormativeUpdateService — modo: ${mode}${ids ? ` | fuentes: ${ids.length}` : ""}`);
  const summary = await runUpdate(REPO_ROOT, manifest, mode, { log: (m) => console.log(m), ids });
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
