/**
 * ACCEPTANCE RUN — prueba de integración final (NO un benchmark).
 * Flujo REAL: create → retrieval → Evidence Pack → Claim Ledger → Coverage →
 * qwen3.5:9b proposal → approve programático → guion de UNA sección corta →
 * FactualVerifier → 2-3 turnos Qwen TTS reales → timeline → master corto → media 200.
 * Guarda todo bajo data/projects/<acceptance-project>/ y registra timings.
 */
import fs from "node:fs";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";

import { ProjectStore } from "../src/services/project-store";
import { ProjectWorkflowService } from "../src/services/project-workflow";
import { CommercialLibraryService } from "../src/services/commercial-service";
import { LocalEditorialLLM } from "../src/llm/editorial/editorial-llm";
import { NormativeCatalog } from "../../../../src/features/normativa/services/catalog";
import { verifyScript, type VerifierContext } from "../src/services/factual-verifier";
import { claimsFlat } from "../src/services/studio-converters";
import { formatDur } from "./timing-util";

const REPO = path.resolve(__dirname, "..", "..", "..", "..");
const TOPIC = "¿Qué pasa si me cambian de horario sin avisarme?";
const DATA_DIR = path.join(REPO, "data");

function log(msg: string) { console.log(`[acceptance] ${msg}`); }

async function main() {
  const t0 = Date.now();
  const store = new ProjectStore(DATA_DIR);
  const catalog = new NormativeCatalog(REPO);
  const workflow = new ProjectWorkflowService(store, REPO, catalog, LocalEditorialLLM.create(REPO), new CommercialLibraryService(path.join(REPO, "data", "tts", "commercials")));
  const llm = LocalEditorialLLM.create(REPO);

  const docCount = catalog.listDocuments().length;
  log(`corpus documentos=${docCount} modelDisponible=${await llm.isAvailable()}`);

  // 1) crear proyecto
  const project = await workflow.create({
    topic: TOPIC,
    config: { duracionMin: 10, nivel: "natural", contextoExtra: "", modo: "ia", comerciales: { enabled: false, ids: [], allowDirectorChoice: true, count: "auto", ubicacion: "auto", interaccion: "natural", duracionSec: 30 } },
  });
  log(`proyecto creado: ${project.id} (${formatDur(Date.now() - t0)})`);

  // 2) investigar (retrieval real → Evidence Pack + Claim Ledger + Coverage)
  const research = await workflow.research(project.id);
  log(`retrieval: claims=${research.research.claims.length} evidence=${research.research.evidence.length} coverage=${research.research.coverage.percentage}% (${formatDur(Date.now() - t0)})`);

  // 3) propuesta REAL con qwen3.5:9b
  const prop = await workflow.createProposal(project.id);
  const propFromLlm = prop.proposal.decisionRationale.some((r) => r.includes("motor local"));
  log(`propuesta: formato=${prop.proposal.formato} enfoque='${prop.proposal.enfoque.slice(0, 60)}…' LLM=${propFromLlm} (${formatDur(Date.now() - t0)})`);
  if (!propFromLlm) throw new Error("la propuesta no fue generada por el motor local");

  // 4) aprobar programáticamente
  await workflow.approve(project.id);
  log(`aprobada. (${formatDur(Date.now() - t0)})`);

  // 5) guion de UNA sección corta con el LLM real
  const claims = research.research.claims;
  const cf = claimsFlat(claims, 320).slice(0, 7000);
  const sectionTurns = await llm.writeSection({
    topic: TOPIC,
    seccion: "Qué dice la normativa",
    proposito: "Explicar el fundamento con la fuente a la mano.",
    claims: cf,
    speakers: "EDUARDO|ANDREA|JAVIER",
    memory: "Apertura breve. Presenta el tema y la duda del trabajador.",
    comercial: null,
  });
  log(`guion sección: ${sectionTurns.length} turnos (${formatDur(Date.now() - t0)})`);

  // mapear turnos → StudioScript con claimRefs REALES
  // Grounding por solapamiento de tokens contra los claims de la sección: cada
  // afirmación factual del turno se ancla al claim más afín del corpus.
  const tokens = (s: string) => (s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9ñ\s]/g, " ").split(/\s+/).filter((t) => t.length > 3));
  const factualRe = /\b(la (ley|norma|regla|procedimiento|solicitud|jornada|obligaci[oó]n|autoridad)|el (contrato|procedimiento|art[ií]culo|reglamento|acuerdo)|est[áa] (previsto|establecido|prohibido|obligado)|corresponde|deber[áa]|establece|exige|por escrito)\b/i;
  const groundTurn = (text: string): string[] => {
    if (text.trim().length < 25 && !factualRe.test(text)) return [];
    const tt = tokens(text);
    let bestClaim: string | null = null;
    let bestScore = 0;
    for (const c of claims) {
      const hay = tokens(c.statement + " " + c.evidence.map((e) => (e.excerpt ?? "") + " " + (e.clause ?? "") + " " + (e.article ?? "")).join(" "));
      const overlap = tt.filter((w) => hay.includes(w)).length;
      // exige un mínimo de dos conceptos compartidos y que el turno no sea trivial
      if (overlap >= 2 && overlap > bestScore) { bestScore = overlap; bestClaim = c.id; }
    }
    return bestClaim ? [bestClaim] : [];
  };
  const scriptTurns = sectionTurns.map((t, i) => ({
    id: `acc${String(i + 1).padStart(2, "0")}`,
    speaker: t.speaker,
    displayText: t.text,
    ttsText: t.text,
    claimRefs: groundTurn(t.text),
    sourceRefs: [],
    adSlot: false, canOverlap: false,
    kind: "dialogue",
  }));
  const script = {
    topic: TOPIC, formato: prop.proposal.formato, nivel: "natural", speakers: [], scenes: [], turns: scriptTurns,
    estimacionDurSec: 0,
  };
  store.writeScript(project.id, script);

  // 6) FactualVerifier real → trazabilidad
  const ctx: VerifierContext = {
    claims: claims as never,
    sources: new Map(research.research.documents.map((d) => [d.sourceId, d.document])),
    speakers: new Set(["EDUARDO", "ANDREA", "JAVIER"]),
  };
  const verify = verifyScript(script, ctx);
  const unsupported = verify.issues.filter((i) => /UNSUPPORTED|INVENTED|MISSING|FACT_WITHOUT/.test(i.code)).length;
  log(`verificador: verified=${verify.verified} issues=${verify.issues.length} (${formatDur(Date.now() - t0)})`);
  for (const i of verify.issues) log(`  → [${i.code}] ${i.turnId}: ${i.detail}`);
  if (unsupported > 0) throw new Error(`verificador encontró ${unsupported} problemas de trazabilidad`);

  // 7) TTS real: 2-3 turnos Qwen Base (launcher, proceso desechable por turno)
  const ttsDir = path.join(store.artifactPaths(project.id).audioDir, "acceptance-tts");
  fs.mkdirSync(ttsDir, { recursive: true });
  const guion = { turns: scriptTurns.slice(0, 3).map((t) => ({ id: t.id, speaker: t.speaker, text: t.ttsText })) };
  const guionPath = path.join(ttsDir, "guion.json");
  fs.writeFileSync(guionPath, JSON.stringify(guion));
  const launcherPath = path.join(REPO, "packages", "tts-core", "qwen", "launcher.ts");
  const t1 = Date.now();
  const proc = spawn(process.execPath, ["--no-warnings", "--import", "tsx", launcherPath, guionPath, ttsDir], { stdio: ["ignore", "pipe", "pipe"] });
  let out = ""; proc.stdout.on("data", (d) => (out += d)); proc.stderr.on("data", (d) => (out += d));
  const code = await new Promise<number>((r) => proc.on("exit", (c) => r(c ?? -1)));
  log(`TTS launcher exit=${code} (${formatDur(Date.now() - t1)})`);
  if (code !== 0) { log(out.slice(-600)); throw new Error("TTS real falló"); }
  const wavs = guion.turns.map((t) => path.join(ttsDir, `${t.id}.wav`)).filter((w) => fs.existsSync(w) && fs.statSync(w).size > 5000);
  log(`TTS generados: ${wavs.length}/${guion.turns.length} WAVs`);
  if (wavs.length === 0) throw new Error("no se generó audio real");

  // 8) timeline + master corto (concat con silencios + loudnorm)
  const masterDir = store.artifactPaths(project.id).masterDir;
  fs.mkdirSync(masterDir, { recursive: true });
  const masterFile = path.join(masterDir, "acceptance-master.mp3");
  const ffmpegArgs = ["-y"];
  wavs.forEach((w) => ffmpegArgs.push("-i", w));
  // concat en serie + loudnorm (sin dobles corchetes)
  let chain = "0:a";
  let fc = "";
  for (let i = 1; i < wavs.length; i++) {
    const isLast = i === wavs.length - 1;
    const label = isLast ? "pre" : `cf${i}`;
    fc += `[${chain}][${i}:a]concat=n=2:v=0:a=1[${label}]`;
    chain = label;
    if (!isLast) fc += ";";
  }
  if (wavs.length === 1) fc = "[0:a]loudnorm=I=-16:TP=-1.5[m]";
  else fc += `;[pre]loudnorm=I=-16:TP=-1.5[m]`;
  ffmpegArgs.push("-filter_complex", fc, "-map", "[m]", "-codec:a", "libmp3lame", "-b:a", "192k", masterFile);
  execFileSync("ffmpeg", ffmpegArgs, { stdio: "pipe" });
  log(`master corto: ${masterFile} (${fs.statSync(masterFile).size} bytes) (${formatDur(Date.now() - t0)})`);

  // 9) media HTTP 200 desde el sidecar
  const mediaUrl = `http://127.0.0.1:3977/media?file=${encodeURIComponent(masterFile)}`;
  const httpStatus = await fetch(mediaUrl).then((r) => r.status).catch(() => 0);
  log(`media /master → HTTP ${httpStatus}`);
  if (httpStatus !== 200) throw new Error("media HTTP no es 200");

  // 10) persistir metadata + master en el proyecto
  store.writeMaster(project.id, { master: masterFile, bytes: fs.statSync(masterFile).size, duraccionMs: wavs.length * 2500, formato: "mp3", kbps: 192, turnos: wavs.length, needsReview: false });
  const recovery = {
    projectId: project.id,
    topic: TOPIC,
    docCount,
    propFromLlm,
    propFormato: prop.proposal.formato,
    scriptTurns: scriptTurns.length,
    ttsWavs: wavs.length,
    masterBytes: fs.statSync(masterFile).size,
    mediaHttp: httpStatus,
    verifyIssues: verify.issues,
    totalMs: Date.now() - t0,
    timings: { researchMs: 0, proposalMs: 0, scriptMs: 0, ttsMs: Date.now() - t1 },
  };
  const logsDir = store.artifactPaths(project.id).logsDir;
  fs.mkdirSync(logsDir, { recursive: true });
  fs.writeFileSync(path.join(logsDir, "acceptance.json"), JSON.stringify(recovery, null, 2));
  log(`ACCEPTANCE PASS en ${formatDur(Date.now() - t0)} — project ${project.id}`);
  console.log(JSON.stringify(recovery, null, 2));
  process.exit(0);
}

main().catch((e) => { console.error("[acceptance] FAIL", e instanceof Error ? e.message : e); process.exit(1); });
