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
import { LocalLLMService } from "./local-llm";
import { withGpu } from "./gpu-manager";
import {
  AnalystReportSchema, EpisodePlanSchema, ConversationDirectionSchema,
  DialogueScriptSchema, NormativeAuditSchema, ConversationCritiqueSchema,
  RepairedTurnsSchema,
} from "./schemas";

const PROMPTS_DIR = path.join(__dirname, "..", "prompts");
const REPO_ROOT = path.resolve(__dirname, "..", "..", "..", "..");
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
    let critica!: Critique;

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
          system: prompt("director.v1.txt"),
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
          system: prompt("writer.v1.txt"),
          user: `DIRECCIÓN DE TURNOS:\n${JSON.stringify(direccion.turns)}\n\nFUENTES:\n${fuentes}`,
          jsonSchema: toSchema(DialogueScriptSchema),
          validate: (raw) => DialogueScriptSchema.parse(raw),
        }).then((r) => new Map(r.turns.map((t) => [t.id, t.text])))
      );
      this.artifact(artifactsDir, "04-borrador", Object.fromEntries(textos));
    });

    // ensamblar borrador como DialogueTurn[]
    const draftTurns: DialogueTurn[] = direccion.turns.map((t) => ({
      id: t.id,
      speaker: t.speaker,
      text: textos.get(t.id) ?? "",
      pauseBeforeMs: 250, pauseAfterMs: 250,
      energy: Math.max(1, Math.min(5, Math.round(t.energy * 5))) as DialogueTurn["energy"],
      pace: "normal",
      canOverlap: false,
      transition: null,
      citations: t.sourceIds,
      intent: t.intent as DialogueTurn["intent"],
      respondsTo: t.respondsTo,
      sceneId: t.sceneId,
      editorial: true,
    }));

    // ── PASS 5: Auditor normativo ──
    await paso("P5-auditor", async () => {
      auditoria = await withGpu("llm", () =>
        this.llm.generateStructured({
          task: "citation_audit",
          system: prompt("normative-auditor.v1.txt"),
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

    // ── PASS 6: Crítico conversacional ──
    let intentosCritica = 0;
    for (;;) {
      await paso(`P6-critico${intentosCritica > 0 ? `-${intentosCritica}` : ""}`, async () => {
        critica = await withGpu("llm", () =>
          this.llm.generateStructured({
            task: "qa",
            system: prompt("conversation-critic.v1.txt"),
            user: `GUION:\n${JSON.stringify(draftTurns.map((t) => ({ id: t.id, speaker: t.speaker, intent: t.intent, respondsTo: t.respondsTo, text: t.text })))}`,
            jsonSchema: toSchema(ConversationCritiqueSchema),
            validate: (raw) => ConversationCritiqueSchema.parse(raw),
          })
        );
        this.artifact(artifactsDir, `06-critica-${intentosCritica}`, critica);
      });

      const cumpleUmbral = critica.conversationQualityScore >= 85 && critica.criticalIssues.length === 0;
      if (cumpleUmbral || intentosCritica >= 3) break;

      // ── PASS 7: Reparación dirigida ──
      await paso(`P7-reparacion-${intentosCritica}`, async () => {
        for (const r of critica.repairsNeeded.slice(0, 12)) {
          const idx = draftTurns.findIndex((t) => t.id === r.turnId);
          if (idx < 0) continue;
          try {
            const rep = await withGpu("llm", () =>
              this.llm.generateStructured({
                task: "repair",
                system: prompt("repair.v1.txt"),
                user: `TURNO A REPARAR:\n${JSON.stringify(draftTurns[idx])}\nANTERIOR:\n${JSON.stringify(draftTurns[idx - 1]?.text ?? null)}\nPOSTERIOR:\n${JSON.stringify(draftTurns[idx + 1]?.text ?? null)}\nMOTIVO: ${r.motivo}`,
                jsonSchema: toSchema(RepairedTurnsSchema),
                validate: (raw) => RepairedTurnsSchema.parse(raw),
              })
            );
            for (const rt of rep.turns) {
              const target = draftTurns.find((t) => t.id === rt.id);
              if (target) target.text = rt.text;
            }
          } catch { /* continuar con el siguiente */ }
        }
      });
      intentosCritica++;
    }

    // ── PASS 8: Validación final determinista (siempre en código, no LLM) ──
    const scoreDeterminista = conversationQualityScore(draftTurns);
    const qaConv = auditConversation(draftTurns);
    const firewall = validateRoleFirewall(draftTurns);
    const validacionFinal = {
      scoreDeterminista: scoreDeterminista.score,
      qaConversacional: qaConv,
      firewallValeria: firewall,
      aprobado: scoreDeterminista.aprobarGeneracion && firewall.length === 0 && qaConv.every((q) => q.pass),
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
  repairsNeeded: Array<{ turnId: string; motivo: string }>;
};

/** Convierte un ZodObject a JSON Schema para structured outputs de Ollama. */
import { z } from "zod";
function toSchema(schema: z.ZodType): object {
  return z.toJSONSchema(schema, { io: "input" }) as object;
}
