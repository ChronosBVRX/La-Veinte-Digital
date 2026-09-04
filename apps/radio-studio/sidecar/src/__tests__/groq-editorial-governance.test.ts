import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import * as RadioCore from "@la-veinte/radio-core";
import { ProjectWorkflowService } from "../services/project-workflow";
import { ProjectStore } from "../services/project-store";
import { NormativeCatalog } from "../../../../../src/features/normativa/services/catalog";
import { LocalEditorialLLM } from "../llm/editorial/editorial-llm";
import { CommercialLibraryService } from "../services/commercial-service";
import { _overrideEditorialProviderForTests, _resetLLMFactoryForTests, type ILLMProvider } from "../llm/llm-factory";
import {
  GroqUnavailableError,
  InsufficientEvidenceError,
  ScriptQualityFailedError,
  ProductionBlockedError,
  ProposalGenerationFailedError,
} from "../errors/editorial-errors";
import type { Proposal, Script } from "@la-veinte/studio-contract";

describe("Groq Editorial Governance — Reglas Arquitectónicas", () => {
  let tmpDir: string;
  let store: ProjectStore;
  let repoRoot: string;
  let catalog: NormativeCatalog;
  let commercials: CommercialLibraryService;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "groq-gov-"));
    store = new ProjectStore(tmpDir);
    repoRoot = process.cwd();
    catalog = new NormativeCatalog(repoRoot);
    commercials = new CommercialLibraryService(path.join(tmpDir, "commercials"));
    _resetLLMFactoryForTests();
  });

  afterEach(() => {
    _resetLLMFactoryForTests();
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("Test 1 (Groq Caído): si Groq falla, se lanza error y NUNCA se invoca directRadioEpisode, deterministicProposal ni Ollama", async () => {
    const directRadioSpy = vi.spyOn(RadioCore, "directRadioEpisode");

    // Simular proveedor Groq caído
    const mockFailingGroq: ILLMProvider = {
      provider: "groq",
      model: "openai/gpt-oss-120b",
      supportsStrictSchema: true,
      promptsVersion: "v3",
      health: async () => ({ ok: false, error: "Conexión rechazada por Groq API" }),
      generateText: async () => { throw new Error("Groq API 503 Service Unavailable"); },
      generateStructured: async () => { throw new Error("Groq API 503 Service Unavailable"); },
    };

    _overrideEditorialProviderForTests(mockFailingGroq);
    const llm = new LocalEditorialLLM(mockFailingGroq);
    const workflow = new ProjectWorkflowService(store, repoRoot, catalog, llm, commercials);

    const project = await workflow.create({
      topic: "Vacaciones del personal",
      config: {
        duracionMin: 15,
        profundidad: "estandar",
        nivel: "natural",
        contextoExtra: "",
        modo: "ia",
        comerciales: { enabled: false, ids: [], allowDirectorChoice: false, count: "auto", ubicacion: "auto", interaccion: "natural", duracionSec: 30 },
      },
    });

    await workflow.research(project.id);

    // Intentar crear propuesta debe fallar con GroqUnavailableError
    await expect(workflow.createProposal(project.id)).rejects.toThrow(GroqUnavailableError);

    // Verificar explícitamente que NUNCA se invocó directRadioEpisode
    expect(directRadioSpy).not.toHaveBeenCalled();

    // Intentar generar guion debe fallar y tampoco llamar a directRadioEpisode
    await expect(workflow.generateScript(project.id)).rejects.toThrow();
    expect(directRadioSpy).not.toHaveBeenCalled();

    // Intentar producir sin guion válido debe fallar con ProductionBlockedError
    await expect(workflow.produce(project.id)).rejects.toThrow(ProductionBlockedError);
  });

  it("Test 2 (Groq JSON Inválido): si Groq devuelve JSON no parseable y falla la reparación, lanza error sin fallback determinista", async () => {
    const directRadioSpy = vi.spyOn(RadioCore, "directRadioEpisode");

    const mockMalformedGroq: ILLMProvider = {
      provider: "groq",
      model: "openai/gpt-oss-120b",
      supportsStrictSchema: true,
      promptsVersion: "v3",
      health: async () => ({ ok: true }),
      generateText: async () => "RESPUESTA_NO_JSON_INCORRECTA",
      generateStructured: async () => {
        throw new Error("GROQ_SCHEMA_FAIL: JSON no parseable o estructura no válida");
      },
    };

    _overrideEditorialProviderForTests(mockMalformedGroq);
    const llm = new LocalEditorialLLM(mockMalformedGroq);
    const workflow = new ProjectWorkflowService(store, repoRoot, catalog, llm, commercials);

    const project = await workflow.create({ topic: "Pago de aguinaldo" });
    await workflow.research(project.id);

    await expect(workflow.createProposal(project.id)).rejects.toThrow();
    expect(directRadioSpy).not.toHaveBeenCalled();
  });

  it("Test 3 (Guion Malo / Quality Fail): si el guion no supera la verificación factual tras reparaciones, se detiene con SCRIPT_QUALITY_FAILED y bloquea Speechify", async () => {
    // Proveedor Groq que genera propuesta válida pero un guion con afirmaciones inventadas/sin soporte
    const mockGroqWithBadScript: ILLMProvider = {
      provider: "groq",
      model: "openai/gpt-oss-120b",
      supportsStrictSchema: true,
      promptsVersion: "v3",
      health: async () => ({ ok: true }),
      generateText: async () => "ok",
      generateStructured: async (opts) => {
        if (opts.task === "analysis") {
          if (opts.system.includes("EVALUACIÓN DE EVIDENCIA") || JSON.stringify(opts.jsonSchema).includes("faltantes")) {
            return { fuerte: ["CCT"], parcial: [], faltantes: [], preguntasSinResponder: [], advertencias: [] };
          }
          return { enfoque: "Análisis específico sobre jornada y descansos", preguntas: ["¿Cómo se aplica?"], subtemas: ["Jornada"], riesgos: [], publicable: true };
        }
        if (opts.task === "planning") {
          return { scenes: [{ id: "s1", purpose: "Inicio", dramaticQuestion: "¿Qué aplica?" }] };
        }
        if (opts.task === "direction") {
          return {
            turns: [
              { id: "t001", sceneId: "s1", speaker: "EDUARDO", intent: "statement", respondsTo: null, purpose: "intro", energy: 3, sourceIds: [] },
              { id: "t002", sceneId: "s1", speaker: "ANDREA", intent: "statement", respondsTo: "t001", purpose: "dato", energy: 3, sourceIds: ["FUENTE_INEXISTENTE_999"] },
              { id: "t003", sceneId: "s1", speaker: "NARRADOR", intent: "statement", respondsTo: "t002", purpose: "cierre", energy: 3, sourceIds: [] },
              { id: "t004", sceneId: "s1", speaker: "EDUARDO", intent: "statement", respondsTo: "t003", purpose: "fin", energy: 3, sourceIds: [] },
            ],
          };
        }
        if (opts.task === "dialogue") {
          return {
            turns: [
              { id: "t001", text: "Bienvenidos al programa de hoy." },
              // Afirmación factual con fuente inexistente
              { id: "t002", text: "De acuerdo con el artículo 99999 inventado, son 500 días de salario obligatorio según la ley." },
              { id: "t003", text: "Conforme a la normativa vigente." },
              { id: "t004", text: "Gracias por acompañarnos en esta emisión." },
            ],
          };
        }
        if (opts.task === "citation_audit") {
          return { valid: false, issues: [{ turnId: "t002", severity: "critical", type: "invented_claim", reason: "Artículo inexistente" }] };
        }
        if (opts.task === "qa") {
          return { conversationQualityScore: 60, subscores: {}, criticalIssues: [{ turnId: "t002", issue: "Factual fail" }], issues: [] };
        }
        if (opts.task === "proposal") {
          return {
            enfoque: "Explicar las condiciones concretas de descanso y salario del personal con detalle normativo",
          formato: "EXPLICADOR",
          duracionEstimadaMin: 15,
          participantes: [
            { id: "EDUARDO", nombre: "Eduardo", rol: "conductor", funcionEditorial: null, voz: "A", participa: true },
            { id: "ANDREA", nombre: "Andrea", rol: "conductora", funcionEditorial: null, voz: "B", participa: true },
          ],
          estructura: [
            { seccion: "Apertura", proposito: "P1", notas: null },
            { seccion: "Normativa", proposito: "P2", notas: null },
            { seccion: "Cierre", proposito: "P3", notas: null },
          ],
          fuentes: ["CCT"],
          huecos: [],
          advertencias: [],
          };
        }
        return {};
      },
    };

    _overrideEditorialProviderForTests(mockGroqWithBadScript);
    const llm = new LocalEditorialLLM(mockGroqWithBadScript);
    const workflow = new ProjectWorkflowService(store, repoRoot, catalog, llm, commercials);

    const project = await workflow.create({ topic: "Descanso obligatorio" });
    await workflow.research(project.id);
    await workflow.createProposal(project.id);
    await workflow.approve(project.id);

    // Generar guion debe fallar por Quality Gate factual
    await expect(workflow.generateScript(project.id)).rejects.toThrow(ScriptQualityFailedError);

    // Intentar producir en estado fallido debe ser bloqueado terminantemente
    await expect(workflow.produce(project.id)).rejects.toThrow(ProductionBlockedError);
  });

  it("Test 4 (Evidencia Insuficiente): si el tema no cuenta con evidencia suficiente, se detiene con INSUFFICIENT_EVIDENCE sin consultar a Groq", async () => {
    const mockGroqCalledSpy = vi.fn();
    const mockGroq: ILLMProvider = {
      provider: "groq",
      model: "openai/gpt-oss-120b",
      supportsStrictSchema: true,
      promptsVersion: "v3",
      health: async () => ({ ok: true }),
      generateText: async () => { mockGroqCalledSpy(); return ""; },
      generateStructured: async () => { mockGroqCalledSpy(); return {}; },
    };

    _overrideEditorialProviderForTests(mockGroq);
    const llm = new LocalEditorialLLM(mockGroq);
    const workflow = new ProjectWorkflowService(store, repoRoot, catalog, llm, commercials);

    // Crear proyecto y simular investigación sin claims
    const project = await workflow.create({ topic: "Tema Fantasma Absolutamente Desconocido En El Corpus" });
    store.writeResearch(project.id, {
      topic: project.topic,
      queryExpansion: [],
      cutoff: "2026-08-14",
      evidence: [],
      claims: [], // 0 claims
      coverage: { percentage: 0, recommended: false, items: [], known: [], missing: ["Todo el tema"], strong: [], partial: [], unanswered: [], warnings: ["Sin respaldo"], confirmed: 0, withoutSupport: 0 },
      documents: [],
      discarded: [],
      createdAt: new Date().toISOString(),
    });

    await expect(workflow.createProposal(project.id)).rejects.toThrow(InsufficientEvidenceError);

    // Groq NO debe ser consultado para inventar hechos
    expect(mockGroqCalledSpy).not.toHaveBeenCalled();
  });

  it("Test 5 (Prompt Principal de Vacaciones): genera con Groq-Only, aborda inclusión, continuidad y vencimiento, y aprueba verificación", async () => {
    const directRadioSpy = vi.spyOn(RadioCore, "directRadioEpisode");

    // Mock de Groq que responde de forma excelente abordando los 3 conceptos requeridos
    const mockGroqVacaciones: ILLMProvider = {
      provider: "groq",
      model: "openai/gpt-oss-120b",
      supportsStrictSchema: true,
      promptsVersion: "v3",
      health: async () => ({ ok: true }),
      generateText: async () => "ok",
      generateStructured: async (opts) => {
        if (opts.task === "analysis") {
          if (opts.system.includes("EVALUACIÓN DE EVIDENCIA") || JSON.stringify(opts.jsonSchema).includes("faltantes")) {
            return { fuerte: ["CCT"], parcial: [], faltantes: [], preguntasSinResponder: [], advertencias: [] };
          }
          return {
            enfoque: "Análisis exhaustivo sobre el derecho a vacaciones, marcas de inclusión y continuidad laboral, así como plazos y fechas de vencimiento.",
            preguntas: ["¿Qué es la inclusión?", "¿Cómo computa la continuidad?", "¿Cuándo vencen?"],
            subtemas: ["Inclusión", "Continuidad", "Vencimiento"],
            riesgos: [],
            publicable: true,
          };
        }
        if (opts.task === "planning") {
          return {
            scenes: [
              { id: "s1", purpose: "Marcas de inclusión", dramaticQuestion: "¿Cómo se acredita la inclusión?" },
              { id: "s2", purpose: "Continuidad y vencimiento", dramaticQuestion: "¿Qué plazo hay antes del vencimiento?" },
            ],
          };
        }
        if (opts.task === "direction") {
          return {
            turns: [
              { id: "t001", sceneId: "s1", speaker: "EDUARDO", intent: "statement", respondsTo: null, purpose: "inicio", energy: 3, sourceIds: [] },
              { id: "t002", sceneId: "s1", speaker: "ANDREA", intent: "statement", respondsTo: "t001", purpose: "inclusión y continuidad", energy: 3, sourceIds: ["claim-1"] },
              { id: "t003", sceneId: "s2", speaker: "NARRADOR", intent: "statement", respondsTo: "t002", purpose: "vencimiento", energy: 3, sourceIds: ["claim-1"] },
              { id: "t004", sceneId: "s2", speaker: "EDUARDO", intent: "statement", respondsTo: "t003", purpose: "cierre práctico", energy: 3, sourceIds: [] },
            ],
          };
        }
        if (opts.task === "dialogue") {
          return {
            turns: [
              { id: "t001", text: "Hoy revisamos un tema fundamental para la base trabajadora: el periodo vacacional y sus reglas de aplicación." },
              { id: "t002", text: "Es indispensable verificar las marcas de inclusión en el sistema y asegurar la continuidad en el cómputo de la antigüedad." },
              { id: "t003", text: "Conforme a la normativa vigente, se debe respetar la fecha de vencimiento establecida para ejercer el derecho." },
              { id: "t004", text: "Documenten con oportunidad su solicitud para proteger sus días de descanso ganado." },
            ],
          };
        }
        if (opts.task === "citation_audit") {
          return { valid: true, issues: [] };
        }
        if (opts.task === "qa") {
          return { conversationQualityScore: 92, subscores: {}, criticalIssues: [], issues: [] };
        }
        if (opts.task === "proposal") {
          return {
            enfoque: "Guía paso a paso sobre vacaciones: comprensión de las marcas de inclusión, protección de la continuidad de antigüedad y vigilancia de las fechas de vencimiento.",
          formato: "GUIA_PASO_A_PASO",
          duracionEstimadaMin: 15,
          participantes: [
            { id: "EDUARDO", nombre: "Eduardo", rol: "conductor", funcionEditorial: null, voz: "A", participa: true },
            { id: "ANDREA", nombre: "Andrea", rol: "conductora", funcionEditorial: null, voz: "B", participa: true },
            { id: "NARRADOR", nombre: "Javier", rol: "normativo", funcionEditorial: null, voz: "N", participa: true },
          ],
          estructura: [
            { seccion: "Apertura", proposito: "Presentar el tema y las marcas de inclusión", notas: null },
            { seccion: "Continuidad y cómputo", proposito: "Explicar la continuidad de servicios", notas: null },
            { seccion: "Vencimiento y trámite", proposito: "Fechas de vencimiento y plazos", notas: null },
          ],
          fuentes: ["CCT Cláusula 47"],
          huecos: [],
          advertencias: [],
          publicable: true,
          };
        }
        return {};
      },
    };

    _overrideEditorialProviderForTests(mockGroqVacaciones);
    const llm = new LocalEditorialLLM(mockGroqVacaciones);
    const workflow = new ProjectWorkflowService(store, repoRoot, catalog, llm, commercials);

    const promptExacto = "Vacaciones, que son las marcas de inclusion y continuidad asi como fechas de vencimiento";
    const project = await workflow.create({ topic: promptExacto });

    // Preparar investigación con un claim de respaldo
    store.writeResearch(project.id, {
      topic: promptExacto,
      queryExpansion: ["vacaciones", "inclusión", "continuidad", "vencimiento"],
      cutoff: "2026-08-14",
      evidence: [],
      claims: [
        {
          id: "claim-1",
          statement: "El personal tiene derecho a vacaciones con respeto a su continuidad y marcas de inclusión.",
          evidence: [{ sourceId: "cct-2025", document: "CCT", clause: "47", article: null, page: 50, excerpt: "vacaciones continuidad inclusión vencimiento" }],
        },
      ],
      coverage: { percentage: 100, recommended: true, items: [], known: ["vacaciones"], missing: [], strong: [], partial: [], unanswered: [], warnings: [], confirmed: 1, withoutSupport: 0 },
      documents: [{ sourceId: "cct-2025", document: "CCT", title: "Contrato Colectivo de Trabajo", versionLabel: "2025-2027", sha256: "abc1234" }],
      discarded: [],
      createdAt: new Date().toISOString(),
    });

    // 1. Generación de propuesta con Groq
    const { proposal } = await workflow.createProposal(project.id);
    expect(proposal.enfoque).toContain("inclusión");
    expect(proposal.enfoque).toContain("continuidad");
    expect(proposal.enfoque).toContain("vencimiento");

    // 2. Aprobación
    await workflow.approve(project.id);

    // 3. Generación de guion con Groq Pipeline
    const { script, verify } = await workflow.generateScript(project.id);

    // Comprobaciones obligatorias:
    expect(verify.verified).toBe(true);
    expect(script.turns.length).toBeGreaterThanOrEqual(4);
    const joinedText = script.turns.map((t) => t.displayText).join(" ").toLowerCase();
    expect(joinedText).toContain("inclusión");
    expect(joinedText).toContain("continuidad");
    expect(joinedText).toContain("vencimiento");

    // Comprobar terminantemente que directRadioEpisode NUNCA fue ejecutado
    expect(directRadioSpy).not.toHaveBeenCalled();

    // 4. Producción permitida al estar verificado
    const updatedProject = await workflow.produce(project.id);
    expect(updatedProject.state).toBe("PRODUCING");
  });
});
