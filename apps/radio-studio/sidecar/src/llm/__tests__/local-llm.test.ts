import { describe, expect, it } from "vitest";
import { LocalLLMService, TASK_PROFILES, loadLlmConfig } from "../local-llm";
import {
  AnalystReportSchema, EpisodePlanSchema, ConversationDirectionSchema,
  NormativeAuditSchema, ConversationCritiqueSchema,
} from "../schemas";

function svc(): LocalLLMService {
  return new LocalLLMService({ ...loadLlmConfig(), baseUrl: "http://127.0.0.1:9" /* puerto cerrado */ }, "/tmp/opencode/llm-test-state");
}

describe("TASK_PROFILES", () => {
  it("temperaturas por etapa dentro de los rangos de dirección", () => {
    expect(TASK_PROFILES.analysis.temperature).toBeLessThan(TASK_PROFILES.planning.temperature);
    expect(TASK_PROFILES.planning.temperature).toBeLessThan(TASK_PROFILES.direction.temperature);
    expect(TASK_PROFILES.dialogue.temperature).toBeGreaterThan(0.6);
    expect(TASK_PROFILES.citation_audit.temperature).toBeLessThan(0.25);
    expect(TASK_PROFILES.qa.temperature).toBeLessThan(0.3);
  });
});

describe("circuit breaker", () => {
  it("generateStructured falla limpio con servidor inalcanzable (sin colgar)", async () => {
    const s = svc();
    await expect(s.generateStructured({
      task: "qa",
      system: "test",
      user: "test",
      jsonSchema: { type: "object" },
      validate: (x) => x,
    })).rejects.toThrow(/LLM_HARD_FAILURE|CIRCUIT_OPEN/);
  });

  it("health con servidor caído responde ok:false rápido", async () => {
    const s = svc();
    const t0 = Date.now();
    const h = await s.health(1500);
    expect(h.ok).toBe(false);
    expect(Date.now() - t0).toBeLessThan(3000);
  });
});

describe("schemas del pipeline", () => {
  it("AnalystReport rechaza finding sin sourceIds", () => {
    const r = AnalystReportSchema.safeParse({
      centralQuestion: "¿pueden cambiar mi horario?",
      workerProblem: "le cambiaron el horario sin aviso escrito",
      keyFacts: ["a", "b"],
      normativeFindings: [{ fact: "algo", sourceIds: [], certainty: "alta" }],
      uncertainties: [], dangerousClaims: [],
      questionsToAnswer: ["q1", "q2"], recommendedAngle: "caso práctico primero",
    });
    expect(r.success).toBe(false);
  });

  it("ConversationDirection rechaza hablante fuera del elenco editorial", () => {
    const r = ConversationDirectionSchema.safeParse({
      turns: [{ id: "t001", sceneId: "s1", speaker: "VALERIA", intent: "statement", respondsTo: null, purpose: "x", energy: 0.5, sourceIds: [] }],
    });
    expect(r.success).toBe(false); // Valeria jamás en dirección editorial
  });

  it("NormativeAudit acepta issues tipificados", () => {
    const r = NormativeAuditSchema.safeParse({
      valid: false,
      issues: [{ turnId: "t042", severity: "critical", type: "unsupported_claim", reason: "sin fuente" }],
    });
    expect(r.success).toBe(true);
  });

  it("EpisodePlan limita escenas a 9", () => {
    const scenes = Array.from({ length: 10 }, (_, i) => ({
      id: `s${i}`, purpose: "x", dramaticQuestion: "y?", factsIntroduced: [], factsResolved: [],
      sourcesRequired: [], preferredSpeakers: ["EDUARDO" as const],
    }));
    expect(EpisodePlanSchema.safeParse({ scenes }).success).toBe(false);
  });

  it("Critique exige subscores completos", () => {
    const base = { conversationQualityScore: 88, criticalIssues: [], repairsNeeded: [] };
    const incompleto = ConversationCritiqueSchema.safeParse({
      ...base,
      subscores: { naturalness: 90, coherence: 90 }, // faltan 6
    });
    expect(incompleto.success).toBe(false);
    const completo = ConversationCritiqueSchema.safeParse({
      ...base,
      subscores: { naturalness: 90, coherence: 90, turnVariety: 80, interaction: 85, speakerBalance: 75, transitionQuality: 82, nonRepetition: 88, actionability: 91 },
    });
    expect(completo.success).toBe(true);
  });
});
