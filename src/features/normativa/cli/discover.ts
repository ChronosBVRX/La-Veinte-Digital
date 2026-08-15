import { loadBootstrapManifest, REPO_ROOT } from "./shared";
import { runDiscovery } from "../services/discovery";

async function main() {
  const manifest = loadBootstrapManifest();
  const report = await runDiscovery(REPO_ROOT, manifest, { log: (m) => console.log(m) });
  console.log("");
  console.log(`Relaciones: ${report.relationsFound} (HAVE=${report.states.HAVE}, MISSING=${report.states.MISSING}, NOT_LOCATED=${report.states.NOT_LOCATED}, REVIEW=${report.states.REVIEW_REQUIRED})`);
  console.log(`Targets: ${report.targets.map((t) => `${t.key}:${t.state}`).join(", ")}`);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
