/**
 * Re-RAG + reconstrucción textual del episodio horario.
 * Fuentes verificadas manualmente por pertinencia (jornada/horario/CCT),
 * NO salario/inscripción. Solo texto — sin TTS.
 */
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { NormativeCatalog } from "@/features/normativa/services/catalog";
import { ScriptPipeline } from "../src/llm/pipeline";
import { conversationQualityScore, auditConversation, validateRoleFirewall, humanConversationGate, gateBloqueado } from "@la-veinte/radio-core";

const REPO = "/home/chronos/Escritorio/La Veinte";
const EP_ID = `ep-horario-${Date.now()}`;
const artifactsDir = path.join(REPO, "data", "tts", "episodes", EP_ID);
fs.mkdirSync(artifactsDir, { recursive: true });

async function main() {
  const catalog = new NormativeCatalog(REPO);

  // ── Fuentes objetivo por pertinencia directa al problema ──
  const OBJETIVOS = [
    "CCT-IMSS-SNTSS-2025-2027", // cláusulas 29 (jornadas), 45 (guardias), RIT
    "LFT",                       // Art. 61 duración jornada, 60 tipos
  ];
  const PALABRAS_RELEVANTES = /\b(jornada|horario|horarios|turno|turnos|cambio de turno|guardia[s]?|rol(es)? de trabajo|distribuci[oó]n)\b/i;
  const EXCLUIR = /\b(salario real|inscripci[oó]n del trabajador|maternidad|lactancia|permuta|comedor|colaci[oó]n)\b/i;

  function buscar(query: string, limite = 4) {
    const hits = catalog.searchNormativeCorpus(query, { limit: limite });
    return hits.filter((h) => {
      const docId = String(h.documentId ?? "");
      if (!OBJETIVOS.includes(docId)) return false;
      if (!PALABRAS_RELEVANTES.test(h.text)) return false;
      if (EXCLUIR.test(h.text)) return false;
      return true;
    });
  }

  const queries = [
    "cláusula acumulación distribución jornadas",
    "jornada semanal horas trabajo personal",
    "guardias roles servicios",
    "LFT duración jornada diurna nocturna",
    "cambio turno adscripción solicitud",
    "reglamento interior trabajo jornada",
  ];

  const vistos = new Map<string, unknown>();
  for (const q of queries) {
    for (const h of buscar(q)) {
      const docId = String(h.documentId ?? "?");
      const key = `${docId}::${(h.section ?? "").slice(0, 40)}::${normaliza(h.text).slice(0, 60)}`;
      if (!vistos.has(key)) {
        vistos.set(key, {
          id: `src_${String(vistos.size + 1).padStart(3, "0")}`,
          texto: h.text,
          documento: docId,
          seccion: h.section ?? null,
        });
      }
    }
  }
  function normaliza(s: string) { return s.toLowerCase().replace(/\s+/g, " ").trim(); }

  const fuentesArr = [...vistos.values()] as Array<{ id: string; texto: string; documento: string; seccion: string | null }>;
  console.log(`fuentes pertinentes recuperadas: ${fuentesArr.length}`);
  for (const f of fuentesArr) console.log(` [${f.id}] ${f.documento}${f.seccion ? ` :: ${f.seccion.slice(0,50)}` : ""} :: ${f.texto.slice(0,80)}`);
  if (fuentesArr.length < 3) { console.error("MUY POCAS FUENTES PERTINENTES — abortar"); process.exit(2); }

  const claims = fuentesArr.map((f) => ({
    id: f.id,
    texto: f.texto,
    documento: f.documento,
    clausula: f.seccion?.match(/Cl[áa]usula \d+/)?.[0] ?? null,
    articulo: f.seccion?.match(/Art[íi]culo \d+[^\s,]*/)?.[0] ?? null,
    pagina: null,
  }));

  const evidencePack = {
    episodeId: EP_ID,
    topic: "¿me pueden cambiar el horario sin avisar?",
    cutoff: "2026-08-14",
    sources: fuentesArr.map((f) => ({
      sourceId: f.id, document: f.documento, section: f.seccion,
      article: null as string | null, clause: null as string | null, page: null as number | null,
      excerpt: f.texto.slice(0, 600),
      hash: crypto.createHash("sha256").update(f.id + f.texto).digest("hex").slice(0, 16),
    })),
  };
  fs.writeFileSync(path.join(artifactsDir, "00-evidence-pack.json"), JSON.stringify(evidencePack, null, 1));

  const speakers = [
    { id: "EDUARDO", nombre: "Eduardo", rol: "conductor" as const, voz: "A" },
    { id: "ANDREA", nombre: "Andrea", rol: "co-conductor" as const, voz: "B" },
    { id: "NARRADOR", nombre: "Javier Ríos", rol: "normative_analyst" as const, voz: "N" },
    { id: "RODRIGO", nombre: "Rodrigo Torres", rol: "corresponsal" as const, voz: "C", participa: true },
  ];

  const pipeline = new ScriptPipeline();
  const resultado = await pipeline.run({
    tema: evidencePack.topic,
    duracionMin: 9,
    speakers: speakers as never,
    nivel: "natural",
    claims,
    cutoff: evidencePack.cutoff,
    fuentes: evidencePack.sources.map((s) => ({ id: s.sourceId, title: s.document, versionLabel: "2025-2027", sha256: s.hash })),
    modoCita: "natural",
    evidencePack: evidencePack as never,
    artifactsDir,
  });

  // ── Gates finales ──
  const gateV = humanConversationGate(resultado.turns);
  const gate = gateBloqueado(gateV);
  const score = conversationQualityScore(resultado.turns);
  const qaFails = auditConversation(resultado.turns).filter((q) => !q.pass);
  const fw = validateRoleFirewall(resultado.turns);

  console.log("\n═══ GATES FINALES ═══");
  console.log("crítico:", resultado.scoreFinal, "| determinista:", score.score, "| aprobado:", score.aprobarGeneracion);
  console.log("QA conversacional fails:", qaFails.map((q) => q.check));
  console.log("firewall:", fw.length ? fw : "OK");
  console.log(`humanGate: ${gate.fatales} fatales / bloquear=${gate.bloquear}`);
  for (const r of gate.resumen) console.log(" ", r);

  fs.writeFileSync(path.join(artifactsDir, "guion-final.json"), JSON.stringify({ turns: resultado.turns, scoreCritico: resultado.scoreFinal, gates: { determinista: score.score, qaFails: qaFails.map((q) => q.check), gate: gate.resumen } }, null, 1));
  console.log("\nguion →", path.join(artifactsDir, "guion-final.json"));

  // ── Mostrar el guion completo para revisión humana ──
  console.log("\n═════════ GUION FINAL PARA REVISIÓN ═════════");
  let prevSpeaker = "";
  for (const t of resultado.turns) {
    const sep = t.speaker !== prevSpeaker ? "\n──" : "  ·";
    console.log(`${sep} [${t.id}] ${t.speaker} (${t.intent}): ${t.text}`);
    if (t.citations?.length) console.log(`        ↳ citas: ${t.citations.join(", ")}`);
    prevSpeaker = t.speaker;
  }


}

main().catch((e) => { console.error("FATAL:", e.message ?? e); process.exit(1); });
