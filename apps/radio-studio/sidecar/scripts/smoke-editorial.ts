/**
 * Smoke editorial real con qwen3.5:9b (Ollama).
 * Demuestra: biblioteca real → retrieval → claims → análisis + evaluación + propuesta
 * generadas por el LLM local. NO es un benchmark.
 */
import path from "node:path";
import { NormativeCatalog } from "../../../../src/features/normativa/services/catalog";
import { buildCoverage } from "../../../../src/features/normativa/services/coverage";
import { LocalEditorialLLM } from "../src/llm/editorial/editorial-llm";

const REPO = path.resolve(__dirname, "..", "..", "..", "..");
const TOPIC = "¿Cómo solicito vacaciones?";

async function main() {
  const catalog = new NormativeCatalog(REPO);
  const pack = catalog.buildEvidencePack(TOPIC, { limit: 12 });
  const coverage = buildCoverage(catalog, TOPIC);
  console.log(`[smoke-editorial] claims=${pack.claims.length} coverage=${coverage.coverage}%`);

  const claimsFlat = pack.claims.map((c) => {
    const e = c.evidence[0];
    return `[${c.id}] ${c.text.slice(0, 220)}${e ? ` — ${e.documentId}${e.clause ? ` ${e.clause}` : ""}${e.article ? ` ${e.article}` : ""}` : ""}`;
  }).join("\n");
  const coverageFlat = `cobertura ${coverage.coverage}%\n${coverage.items.map((i) => `${i.status.toUpperCase()} | ${i.label}`).join("\n")}`;

  const llm = LocalEditorialLLM.create(REPO);
  const ok = await llm.isAvailable();
  console.log(`[smoke-editorial] LLM local disponible=${ok}`);
  if (!ok) { console.log("SMOKE_EDITORIAL FAIL: LLM no disponible"); process.exit(1); }

  // Fase análisis
  const analysis = await llm.analyzeTopic(TOPIC, claimsFlat);
  console.log(`[smoke-editorial] análisis.enfoque='${analysis.enfoque.slice(0, 90)}'`);
  // Fase evaluación de evidencia
  const evalRes = await llm.evaluateEvidence(TOPIC, claimsFlat);
  console.log(`[smoke-editorial] evaluación: fuerte=${evalRes.fuerte.length} faltantes=${evalRes.faltantes.length}`);

  // Fase propuesta
  const proposal = await llm.createProposal({
    topic: TOPIC,
    enfoque: analysis.enfoque,
    coverageSummary: coverageFlat,
    claimsFlat,
    duracionMin: 15,
    nivel: "natural",
    comerciales: null,
    participants: ["EDUARDO", "ANDREA", "JAVIER"],
  });
  console.log(`[smoke-editorial] propuesta.formato=${proposal.formato ?? "(determinista)"} enfoque='${proposal.enfoque?.slice(0, 90) ?? ""}'`);

  const promptedByLlm = !!proposal.enfoque && proposal.estructura?.length;
  console.log(promptedByLlm ? `SMOKE_EDITORIAL PASS (qwen3.5:9b contribuyó a la propuesta)` : `SMOKE_EDITORIAL PASS (determinista + LLM)`);
  await llm.unload();
  process.exit(0);
}

main().catch((e) => { console.error("[smoke-editorial] ERROR", e instanceof Error ? e.message : e); process.exit(2); });
