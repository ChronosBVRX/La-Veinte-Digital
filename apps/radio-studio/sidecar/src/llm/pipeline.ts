/**
 * ScriptPipeline — pipeline multipasso Qwen local:
 *   P1 analista → P2 arquitecto → P3 director conversacional
 *   → P4 guionista → P5 auditor normativo → P6 crítico
 *   → P7 reparación dirigida → P8 validación final.
 *
 * Cada paso guarda artefactos en data/tts/episodes/<episodeId>/.
 * La salida es un EpisodeScript-compatible con el worker/mixer existentes.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { DialogueTurn, DirectorInput } from "@la-veinte/radio-core";
import { conversationQualityScore, auditConversation, validateRoleFirewall } from "@la-veinte/radio-core";
import { humanConversationGate, gateBloqueado } from "@la-veinte/radio-core";
import { LocalLLMService } from "./local-llm";
import { withGpu } from "./gpu-manager";
import {
  AnalystReportSchema, EpisodePlanSchema, ConversationDirectionSchema,
  DialogueScriptSchema, NormativeAuditSchema, ConversationCritiqueSchema,
  RepairedTurnsSchema,
} from "./schemas";

function resolverPromptsDir(): string {
  // busca el directorio prompts subiendo desde __dirname hasta encontrarlo
  let cur = __dirname;
  for (let i = 0; i < 6; i++) {
    const cand = path.join(cur, "prompts");
    if (fs.existsSync(path.join(cand, "analyst.v1.txt"))) return cand;
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return path.join(__dirname, "..", "prompts");
}
const PROMPTS_DIR = resolverPromptsDir();
function resolverRepoRoot(): string {
  // sube desde PROMPTS_DIR (sidecar/prompts) hasta encontrar package.json del repo
  let cur = path.dirname(PROMPTS_DIR); // sidecar
  for (let i = 0; i < 4; i++) {
    if (fs.existsSync(path.join(cur, "resources", "normativa"))) return cur;
    cur = path.dirname(cur);
  }
  return process.cwd();
}
const REPO_ROOT = process.env.LVD_REPO_ROOT ?? resolverRepoRoot();

/** Carga artefactos previos para re-iterar sin repetir P1-P5. */
export function cargarArtefactos(artifactsDir: string): {
  analisis: unknown; plan: unknown; direccion: z_infer_Direction; textos: Map<string, string>; fuentes: string;
} | null {
  try {
    const j = (f: string) => JSON.parse(fs.readFileSync(path.join(artifactsDir, f), "utf8"));
    const analisis = j("01-analisis.json");
    const plan = j("02-escaleta.json");
    const direccionRaw = j("03-direccion.json");
    const borrador = j("04-borrador.json");
    const ep = j("00-evidence-pack.json") as EvidencePackV2;
    const fuentes = ep.sources.map((s) => `[${s.sourceId}] ${s.document}${s.clause ? `, ${s.clause}` : ""}${s.article ? `, ${s.article}` : ""}: ${s.excerpt}`).join("\n\n");
    const direccion: z_infer_Direction = { turns: direccionRaw.turns };
    const textos = new Map<string, string>(Object.entries(borrador));
    return { analisis, plan, direccion, textos, fuentes };
  } catch {
    return null;
  }
}
import { loadLlmConfig } from "./local-llm";

function prompt(name: string): string {
  return fs.readFileSync(path.join(PROMPTS_DIR, name), "utf8");
}

export interface SourceRef { sourceId: string; document: string; section?: string | null; article?: string | null; clause?: string | null; page?: number | null; excerpt: string; hash: string }

export interface EvidencePackV2 {
  episodeId: string;
  topic: string;
  cutoff: string;
  sources: SourceRef[];
}

function readPromptVersion(file: string): string {
  return file.split(".").filter((x) => x.startsWith("v")).join(".") || "v1";
}

export interface PipelineResult {
  episodeId: string;
  turns: DialogueTurn[];
  artifactsDir: string;
  scoreFinal: number;
  auditoriaNormativa: { valid: boolean; issues: Array<{ turnId: string; severity: string; type: string; reason: string }> };
  pasos: Record<string, { status: string; ms: number; retries?: number }>;
  modo: "local-ia" | "fallback-determinista";
  motivoFallback?: string;
}

/** Construye el Evidence Pack v2 desde los claims del catálogo normativo. */
export function buildEvidencePackV2(episodeId: string, topic: string, claims: Array<{ id: string; texto: string; documento: string; clausula: string | null; articulo: string | null; pagina: number | null }>, cutoff: string): EvidencePackV2 {
  return {
    episodeId,
    topic,
    cutoff,
    sources: claims.map((c) => ({
      sourceId: c.id,
      document: c.documento,
      clause: c.clausula,
      article: c.articulo,
      page: c.pagina,
      excerpt: c.texto.slice(0, 600),
      hash: crypto.createHash("sha256").update(`${c.id}|${c.texto}`).digest("hex").slice(0, 16),
    })),
  };
}

export class ScriptPipeline {
  private llm = new LocalLLMService(loadLlmConfig(), path.join(REPO_ROOT, "data", "tts"));

  private artifact(dir: string, name: string, data: unknown): void {
    fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(data, null, 1));
  }

  async run(input: DirectorInput & { evidencePack: EvidencePackV2; artifactsDir: string }): Promise<PipelineResult> {
    const { artifactsDir, evidencePack } = input;
    fs.mkdirSync(artifactsDir, { recursive: true });
    this.artifact(artifactsDir, "00-evidence-pack", evidencePack);
    const pasos: PipelineResult["pasos"] = {};
    const paso = async (name: string, fn: () => Promise<void>) => {
      const t0 = Date.now();
      await fn();
      pasos[name] = { status: "ok", ms: Date.now() - t0 };
      console.log(`[pipeline] ${name} ✓ (${Date.now() - t0}ms)`);
    };

    const fuentes = evidencePack.sources.map((s) => `[${s.sourceId}] ${s.document}${s.clause ? `, ${s.clause}` : ""}${s.article ? `, ${s.article}` : ""}: ${s.excerpt}`).join("\n\n");

    let analisis!: unknown;
    let plan!: unknown;
    let direccion!: z_infer_Direction;
    let textos!: Map<string, string>;
    let auditoria!: { valid: boolean; issues: NormativeIssueLite[] };

    // ── PASS 1: Analista ──
    await paso("P1-analista", async () => {
      analisis = await withGpu("llm", () =>
        this.llm.generateStructured({
          task: "analysis",
          system: prompt("analyst.v1.txt"),
          user: `TEMA: ${input.tema}\n\nEVIDENCIA:\n${fuentes}`,
          jsonSchema: toSchema(AnalystReportSchema),
          validate: (raw) => AnalystReportSchema.parse(raw),
        })
      );
      this.artifact(artifactsDir, "01-analisis", analisis);
    });

    // ── PASS 2: Arquitecto ──
    await paso("P2-arquitecto", async () => {
      plan = await withGpu("llm", () =>
        this.llm.generateStructured({
          task: "planning",
          system: prompt("architect.v1.txt"),
          user: `TEMA: ${input.tema}\n\nANÁLISIS:\n${JSON.stringify(analisis)}`,
          jsonSchema: toSchema(EpisodePlanSchema),
          validate: (raw) => EpisodePlanSchema.parse(raw),
        })
      );
      this.artifact(artifactsDir, "02-escaleta", plan);
    });

    // ── PASS 3: Director conversacional ──
    await paso("P3-director", async () => {
      direccion = await withGpu("llm", () =>
        this.llm.generateStructured({
          task: "direction",
          system: prompt("director.v2.txt"),
          user: `ESCALETA:\n${JSON.stringify(plan)}\n\nHECHOS DISPONIBLES:\n${fuentes}\n\nGenera la dirección de turnos completa del episodio.`,
          jsonSchema: toSchema(ConversationDirectionSchema),
          validate: (raw) => ConversationDirectionSchema.parse(raw),
        })
      );
      this.artifact(artifactsDir, "03-direccion", direccion);
    });

    // ── PASS 4: Guionista ──
    await paso("P4-guionista", async () => {
      textos = await withGpu("llm", () =>
        this.llm.generateStructured({
          task: "dialogue",
          system: prompt("writer.v2.txt"),
          user: `DIRECCIÓN DE TURNOS:\n${JSON.stringify(direccion.turns)}\n\nFUENTES:\n${fuentes}`,
          jsonSchema: toSchema(DialogueScriptSchema),
          validate: (raw) => DialogueScriptSchema.parse(raw),
        }).then((r) => new Map(r.turns.map((t) => [t.id, t.text])))
      );
      this.artifact(artifactsDir, "04-borrador", Object.fromEntries(textos));
    });

    // ── Guardarrails de roles (determinista, antes del guionista) ──
    // Alonso SOLO fundamento: cualquier otro intent suyo se convierte en normative_answer
    // con la fuente más cercana declarada por dirección.
    for (const t of direccion.turns) {
      if (t.speaker === "NARRADOR" && !["normative_answer", "statement", "handoff"].includes(t.intent)) {
        t.intent = "normative_answer";
        if (t.sourceIds.length === 0) {
          const conFuente = direccion.turns.filter((x) => x.sourceIds.length > 0);
          if (conFuente.length > 0) {
            const nearest = conFuente.reduce((a, b) =>
              Math.abs(direccion.turns.indexOf(b) - direccion.turns.indexOf(t)) <
              Math.abs(direccion.turns.indexOf(a) - direccion.turns.indexOf(t)) ? b : a);
            t.sourceIds = [...nearest.sourceIds];
          }
        }
      }
      // NARRADOR no pregunta ni interrumpe
      if (t.speaker === "NARRADOR" && ["interrupt_question", "interrupt_correction", "normative_request", "question"].includes(t.intent)) {
        t.speaker = "EDUARDO";
      }
    }

    // ensamblar borrador como DialogueTurn[]
    const ES_PREGUNTA_REAL = (texto: string) => /\?\s*$/.test(texto.trim()) || /^(qué |qué,|cómo |cuándo |dónde |quién |quién,|cuánto |por qué |y si )/i.test(texto.trim());
    const draftTurns: DialogueTurn[] = direccion.turns.map((t) => ({
      id: t.id,
      speaker: t.speaker,
      text: textos.get(t.id) ?? "",
      pauseBeforeMs: 250, pauseAfterMs: 250,
      // normalizar energía: si viene en 0-1 escalar a 1-5; si ya es 1-5, redondear
      energy: (() => {
        const e = t.energy;
        if (e <= 1) return Math.max(1, Math.min(5, Math.round(e * 5))) as DialogueTurn["energy"];
        return Math.max(1, Math.min(5, Math.round(e))) as DialogueTurn["energy"];
      })(),
      pace: "normal",
      canOverlap: false,
      transition: null,
      citations: t.sourceIds,
      intent: t.intent as DialogueTurn["intent"],
      respondsTo: t.respondsTo,
      sceneId: t.sceneId,
      editorial: true,
    }));

    // ── Saneo estructural: nadie se dirige a sí mismo por su nombre ──
    for (let i = 1; i < draftTurns.length; i++) {
      const t = draftTurns[i];
      const m = /^(Rodrigo|Eduardo|Andrea|Alonso|Narrador)\b[,:]\s*/i.exec(t.text);
      if (m) {
        const mencionado = m[1].toUpperCase().replace("NARRADOR", "NARRADOR");
        const propio = t.speaker.toUpperCase() === mencionado || (mencionado === "NARRADOR" && /NARRADOR/i.test(t.speaker));
        if (propio && i > 0) {
          // el texto estaba destinado a este locutor pero lo dice él mismo:
          // reasignar al hablante anterior distinto (era un handoff mal asignado)
          for (let j = i - 1; j >= 0; j--) {
            if (draftTurns[j].speaker !== t.speaker) { t.speaker = draftTurns[j].speaker; break; }
          }
          if (t.intent === "question" || t.intent === "statement") t.intent = "handoff";
        }
      }
    }
    // pregunta respondida por el MISMO hablante inmediatamente → no era pregunta
    for (let i = 0; i < draftTurns.length - 1; i++) {
      const a = draftTurns[i], b = draftTurns[i + 1];
      if (a.speaker === b.speaker && (a.intent === "question") && b.respondsTo === a.id) {
        a.intent = "statement";
      }
    }

    // ── Saneo Alonso: institucional siempre, sin muletillas casuales ──
    const CASUAL_PREFIX_RE = /^(¡)?(Exacto[^.!]*[.!]\s*|Muy bien[^.!]*[.!]\s*|Correcto[^.!]*[.!]\s*|Tienes toda la razón[^.!]*[.!]\s*)/i;
    for (const t of draftTurns) {
      if (/NARRADOR/i.test(t.speaker) && CASUAL_PREFIX_RE.test(t.text)) {
        t.text = t.text.replace(CASUAL_PREFIX_RE, "").trim();
        if (!t.text) t.text = "Conforme a la normativa vigente.";
        t.text = t.text.charAt(0).toUpperCase() + t.text.slice(1);
      }
    }
    // ── Colapso de monólogo NARRADOR: dos normativos seguidos → fusionar ──
    for (let i = 0; i < draftTurns.length - 1; i++) {
      if (/NARRADOR/i.test(draftTurns[i].speaker) && /NARRADOR/i.test(draftTurns[i + 1].speaker)) {
        draftTurns[i].text = `${draftTurns[i].text.trim()} ${draftTurns[i + 1].text.trim()}`;
        draftTurns[i].citations = [...new Set([...(draftTurns[i].citations ?? []), ...(draftTurns[i + 1].citations ?? [])])];
        draftTurns.splice(i + 1, 1);
        i--;
      }
    }

    // ── Normalización determinista de intents (alinear metadato con texto real) ──
    for (const t of draftTurns) {
      if ((t.intent === "question" || t.intent === "interrupt_question") && !ES_PREGUNTA_REAL(t.text)) {
        t.intent = t.speaker === "EDUARDO" ? "handoff" : "statement";
      }
      // un statement que sí es pregunta → question (para exigir respuesta)
      if (t.intent === "statement" && ES_PREGUNTA_REAL(t.text)) {
        t.intent = "question";
      }
    }

    // ── PASS 5: Auditor normativo ──
    await paso("P5-auditor", async () => {
      auditoria = await withGpu("llm", () =>
        this.llm.generateStructured({
          task: "citation_audit",
          system: prompt("normative-auditor.v2.txt"),
          user: `TURNOS:\n${JSON.stringify(draftTurns.map((t) => ({ id: t.id, speaker: t.speaker, text: t.text, sourceIds: t.citations })))}\n\nEVIDENCIA:\n${fuentes}`,
          jsonSchema: toSchema(NormativeAuditSchema),
          validate: (raw) => NormativeAuditSchema.parse(raw),
        })
      );
      this.artifact(artifactsDir, "05-auditoria-normativa", auditoria);
    });

    // reparación normativa dirigida (ventana ±1)
    if (!auditoria.valid && auditoria.issues.length > 0) {
      await paso("P5b-reparacion-citas", async () => {
        const criticos = new Set(auditoria.issues.filter((i) => i.severity === "critical").map((i) => i.turnId));
        for (const tid of criticos) {
          const idx = draftTurns.findIndex((t) => t.id === tid);
          if (idx < 0) continue;
          try {
            const rep = await withGpu("llm", () =>
              this.llm.generateStructured({
                task: "repair",
                system: prompt("repair.v1.txt"),
                user: `TURNO PROBLEMÁTICO:\n${JSON.stringify(draftTurns[idx])}\n\nANTERIOR:\n${JSON.stringify(draftTurns[idx - 1] ?? null)}\nPOSTERIOR:\n${JSON.stringify(draftTurns[idx + 1] ?? null)}\nMOTIVO: ${auditoria.issues.filter((i) => i.turnId === tid).map((i) => i.reason).join("; ")}\nEVIDENCIA RELEVANTE:\n${fuentes.slice(0, 3000)}`,
                jsonSchema: toSchema(RepairedTurnsSchema),
                validate: (raw) => RepairedTurnsSchema.parse(raw),
                useCache: false,
              })
            );
            for (const rt of rep.turns) {
              const target = draftTurns.find((t) => t.id === rt.id);
              if (target) target.text = rt.text;
            }
          } catch { /* turno individual fallido no aborta el episodio */ }
        }
      });
    }

    // ── PASS 6/7: Crítico ↔ Reparación iterativa (máx 3 rondas) ──
    let critica!: Critique;
    let intentosCritica = 0;
    let mejorDraft = [...draftTurns];
    let mejorScore = -1;

    const clonar = (ts: DialogueTurn[]) => ts.map((t) => ({ ...t }));

    for (;;) {
      await paso(`P6-critico-${intentosCritica}`, async () => {
        critica = await withGpu("llm", () =>
          this.llm.generateStructured({
            task: "qa",
            system: prompt("conversation-critic.v2.txt"),
            user: `GUION:\n${JSON.stringify(draftTurns.map((t) => ({ id: t.id, speaker: t.speaker, intent: t.intent, respondsTo: t.respondsTo, text: t.text })))}`,
            jsonSchema: toSchema(ConversationCritiqueSchema),
            validate: (raw) => ConversationCritiqueSchema.parse(raw),
          })
        );
        this.artifact(artifactsDir, `06-critica-r${intentosCritica}`, critica);
      });

      const scoreDeterministaRonda = conversationQualityScore(draftTurns).score;
      // conservar la MEJOR versión (critic score + sin regresión determinista severa)
      const scoreCombinado = Math.round(critica.conversationQualityScore * 0.6 + scoreDeterministaRonda * 0.4);
      if (scoreCombinado > mejorScore) {
        mejorScore = scoreCombinado;
        mejorDraft = clonar(draftTurns);
      }

      const pasaUmbral =
        critica.conversationQualityScore >= 85 &&
        critica.criticalIssues.length === 0 &&
        auditConversation(draftTurns).every((q) => q.pass);
      if (pasaUmbral || intentosCritica >= 3) break;

      // ── PASS 7: reparación por ventanas locales con instrucción concreta ──
      await paso(`P7-reparacion-${intentosCritica}`, async () => {
        // cola combinada: issues del crítico LLM + fallos deterministas con instrucción local
        const qaRonda = auditConversation(draftTurns);
        const detIssues: Critique["issues"] = [];
        for (const f of qaRonda.filter((q) => !q.pass)) {
          const idsMencionados = (f.detalle.match(/t\d{3}/g) ?? []);
          for (const tid of idsMencionados.slice(0, 4)) {
            if (f.check.startsWith("cada pregunta")) {
              detIssues.push({ turnId: tid, issueType: "unanswered_question", problema: "El guion plantea esto como pregunta pero nadie responde después", evidencia: f.detalle, esperabaEscuchar: "Otra persona responde con información concreta o se reconoce que quedará abierta", repairInstruction: "O bien convierte este turno en afirmación/handoff si no era pregunta real, o asegúrate de que el turno siguiente responda con contenido concreto.", severidad: "alta" });
            } else if (f.check.startsWith("ninguna cita")) {
              detIssues.push({ turnId: tid, issueType: "quote_without_landing", problema: "Alonso dio un fundamento y el turno siguiente no reacciona a ese dato", evidencia: f.detalle, esperabaEscuchar: "Eduardo o Andrea interpretan qué significa ese fundamento para el trabajador", repairInstruction: "El turno posterior a esta cita debe interpretar la consecuencia práctica del dato citado — no continuar como si nadie lo hubiera escuchado.", severidad: "alta" });
            }
          }
        }
        const todas = [...critica.issues, ...detIssues]
          .filter((v, i, a) => a.findIndex((x) => x.turnId === v.turnId && x.issueType === v.issueType) === i)
          .sort((a, b) => (a.severidad === b.severidad ? 0 : a.severidad === "alta" ? -1 : 1)).slice(0, 12);
        for (const issue of todas) {
          const idx = draftTurns.findIndex((t) => t.id === issue.turnId);
          if (idx < 0) continue;
          const ventana = draftTurns.slice(Math.max(0, idx - 2), Math.min(draftTurns.length, idx + 3));
          try {
            const rep = await withGpu("llm", () =>
              this.llm.generateStructured({
                task: "repair",
                system: prompt("repair.v1.txt"),
                user: `VENTANA DE CONVERSACIÓN (±2 turnos):
${JSON.stringify(ventana.map((t) => ({ id: t.id, speaker: t.speaker, intent: t.intent, respondsTo: t.respondsTo, text: t.text })))}

TURNO A REPARAR: ${issue.turnId}
TIPO DE DEFECTO: ${issue.issueType}
PROBLEMA: ${issue.problema}
EVIDENCIA: ${issue.evidencia}
LO QUE SE ESPERABA ESCUCHAR: ${issue.esperabaEscuchar}
INSTRUCCIÓN DE REPARACIÓN: ${issue.repairInstruction}

Reescribe SOLO el turno ${issue.turnId}. Debe reaccionar genuinamente a su contexto.`,
                jsonSchema: toSchema(RepairedTurnsSchema),
                validate: (raw) => RepairedTurnsSchema.parse(raw),
                useCache: false,
              })
            );
            for (const rt of rep.turns) {
              const target = draftTurns.find((t) => t.id === rt.id);
              if (target && rt.text.length > 2) target.text = rt.text;
            }
          } catch { /* un turno que no se pudo reparar no aborta el episodio */ }
        }
      });
      intentosCritica++;
    }

    // adoptar la mejor versión encontrada
    for (let i = 0; i < draftTurns.length && i < mejorDraft.length; i++) {
      draftTurns[i].text = mejorDraft[i].text;
    }

    // ── PASS 8: Validación final determinista (siempre en código, no LLM) ──
    const scoreDeterminista = conversationQualityScore(draftTurns);
    const qaConv = auditConversation(draftTurns);
    const firewall = validateRoleFirewall(draftTurns);
    // ── Human Conversation Gate (bloqueante pre-TTS) ──
    const gateViolaciones = humanConversationGate(draftTurns);
    const gate = gateBloqueado(gateViolaciones);

    const validacionFinal = {
      scoreDeterminista: scoreDeterminista.score,
      qaConversacional: qaConv,
      firewallValeria: firewall,
      humanGate: { bloquear: gate.bloquear, fatales: gate.fatales, resumen: gate.resumen },
      aprobado: scoreDeterminista.aprobarGeneracion
        && firewall.length === 0
        && qaConv.every((q) => q.pass)
        && !gate.bloquear,
      motivoBloqueo: gate.bloquear ? gate.resumen.filter((r) => r.startsWith("[fatal]")) : [],
    };
    this.artifact(artifactsDir, "08-validacion-final", validacionFinal);

    return {
      episodeId: evidencePack.episodeId,
      turns: draftTurns,
      artifactsDir,
      scoreFinal: critica?.conversationQualityScore ?? scoreDeterminista.score,
      auditoriaNormativa: { valid: auditoria.valid, issues: auditoria.issues },
      pasos,
      modo: "local-ia",
    };
  }
}

// tipos locales para no importar zod aquí arriba
type z_infer_Direction = {
  turns: Array<{
    id: string; sceneId: string; speaker: "EDUARDO" | "ANDREA" | "NARRADOR" | "RODRIGO";
    intent: string; respondsTo: string | null; purpose: string; energy: number; sourceIds: string[];
  }>;
};
type NormativeIssueLite = { turnId: string; severity: string; type: string; reason: string };
type Critique = {
  conversationQualityScore: number;
  subscores: Record<string, number>;
  criticalIssues: Array<{ turnId: string; issue: string }>;
  issues: Array<{
    turnId: string; issueType: string; problema: string; evidencia: string;
    esperabaEscuchar: string; repairInstruction: string; severidad?: string;
  }>;
};

/** Convierte un ZodObject a JSON Schema para structured outputs de Ollama. */
import { z } from "zod";
function toSchema(schema: z.ZodType): object {
  return z.toJSONSchema(schema, { io: "input" }) as object;
}
