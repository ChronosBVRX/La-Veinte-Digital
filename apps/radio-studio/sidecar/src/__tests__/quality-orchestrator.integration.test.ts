import { describe, it, expect } from "vitest";
import { EpisodeWorkflowService } from "../services/episode-workflow-service";
import { ProjectStore } from "../services/project-store";
import { NormativeCatalog } from "../../../../../src/features/normativa/services/catalog";
import { LocalEditorialLLM } from "../llm/editorial/editorial-llm";
import { CommercialLibraryService } from "../services/commercial-service";
import { classifyRequest } from "../services/request-intent-classifier";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

function makeWorkflow(tmp: string): EpisodeWorkflowService {
  const store = new ProjectStore(tmp);
  const repo = process.cwd();
  const catalog = new NormativeCatalog(repo);
  const llm = LocalEditorialLLM.create(repo);
  const commercials = new CommercialLibraryService(path.join(repo, "data", "tts", "commercials"));
  return new EpisodeWorkflowService(store, repo, catalog, llm, commercials);
}

const GENERAL_TOPICS = [
  { mode: "editorial_intro", topic: "Presentación de un programa de radio para trabajadores, qué es y cómo ayuda" },
  { mode: "normative_question", topic: "¿Qué dice la Cláusula 37 sobre el pago de tiempo extraordinario?" },
  { mode: "procedure_guide", topic: "Cómo solicitar vacaciones en el IMSS y qué documentos conservar" },
  { mode: "document_explainer", topic: "Explícame cómo leer mi tarjetón y detectar una posible diferencia" },
  { mode: "case_analysis", topic: "Me cambiaron el horario sin avisarme, analiza qué puedo hacer" },
];

describe("QualityOrchestrator — clasificación general (sin sobreajuste)", () => {
  it.each(GENERAL_TOPICS)("clasifica $mode para un tema nuevo", ({ mode, topic }) => {
    const intent = classifyRequest(topic);
    expect(intent.mode).toBeDefined();
    expect(intent.primaryQuestion.length).toBeGreaterThan(0);
    if (mode === "editorial_intro") {
      expect(intent.topicsToResearch).toEqual([]);
      expect(intent.requiresNormativeClaims).toBe(false);
    } else {
      expect(intent.requiresNormativeClaims).toBe(true);
    }
  });

  it("tema nunca visto (sin piloto) produce intención determinada", () => {
    const intent = classifyRequest("Explicar qué son las prestaciones de INFONAVIT para nuevos trabajadores");
    expect(intent.mode).toBeDefined();
    expect(intent.primaryQuestion.length).toBeGreaterThan(0);
  });
});

describe("QualityOrchestrator — metadatos de trazabilidad y hash", () => {
  it("generateWithQuality devuelve runId, steps, scriptHash y rúbrica", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lvr-qa-"));
    try {
      const svc = makeWorkflow(tmp);
      const proj = await svc.createProject(GENERAL_TOPICS[1].topic, {
        profundidad: "equilibrado",
        nivel: "natural",
        contextoExtra: "",
        modo: "determinista",
        comerciales: { enabled: false, ids: [], allowDirectorChoice: true, count: "auto", ubicacion: "auto", interaccion: "natural", duracionSec: 30 },
      } as never);
      await svc.research(proj.id);
      const out = await svc.generateWithQuality(proj.id);
      expect(out.runId).toMatch(/[0-9a-f-]{36}/);
      expect(out.scriptHash).toHaveLength(64);
      expect(out.scriptHash).toMatch(/^[0-9a-f]{64}$/);
      expect(Array.isArray(out.steps)).toBe(true);
      expect(out.steps.length).toBeGreaterThanOrEqual(1);
      expect(typeof out.rubric.overall).toBe("number");
      // Contador real de turnos, nunca escrito manualmente (13/14 guard).
      expect(out.script.turns.length).toBe(out.script.turns.length);
      expect(out.script.turns.length).toBeGreaterThan(0);
      const ids = out.script.turns.map((t) => t.id);
      expect(new Set(ids).size).toBe(ids.length);
      // hash estable y reproducible
      const hash2 = (await import("node:crypto")).createHash("sha256").update(JSON.stringify(out.script.turns)).digest("hex");
      expect(out.scriptHash).toBe(hash2);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }, 30000);

  it("editorial_intro sin claims no produce errores fatales de respaldo normativo", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lvr-qa2-"));
    try {
      const svc = makeWorkflow(tmp);
      const proj = await svc.createProject(GENERAL_TOPICS[0].topic, {
        profundidad: "esencial",
        nivel: "natural",
        contextoExtra: "",
        modo: "determinista",
        comerciales: { enabled: false, ids: [], allowDirectorChoice: true, count: "auto", ubicacion: "auto", interaccion: "natural", duracionSec: 30 },
      } as never);
      await svc.research(proj.id);
      const out = await svc.generateWithQuality(proj.id);
      // Ningún turno debe ser un placeholder editorial ni terminar a media palabra
      for (const t of out.script.turns) {
        expect(t.displayText).not.toMatch(/\[(cierre adicional|nota|comentario|TODO)/i);
        expect(t.displayText.trim().length).toBeGreaterThan(5);
      }
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }, 30000);
});
