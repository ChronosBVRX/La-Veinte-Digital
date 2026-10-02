import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ProjectStore } from "../project-store";
import { ProjectWorkflowService } from "../project-workflow";
import { CommercialLibraryService } from "../commercial-service";
import { friendlyProjectError } from "../../routes/project-routes";
import {
  classifyInput,
  parseScript,
  deriveShortTitle,
  sanitizeTtsText,
} from "@la-veinte/radio-core";
import {
  InsufficientEvidenceError,
  GroqRateLimitedError,
  ScriptQualityFailedError,
} from "../../errors/editorial-errors";

let tempDir: string;
let store: ProjectStore;
let workflow: ProjectWorkflowService;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lv-workflow-test-"));
  store = new ProjectStore(tempDir);
  const commDir = path.join(tempDir, "commercials");
  fs.mkdirSync(commDir, { recursive: true });
  const commService = new CommercialLibraryService(commDir);
  // Workflow con mocks mínimos (el catálogo y llm no se invocan para guiones importados)
  const mockCatalog = {} as unknown as ConstructorParameters<typeof ProjectWorkflowService>[2];
  const mockLlm = {} as unknown as ConstructorParameters<typeof ProjectWorkflowService>[3];
  workflow = new ProjectWorkflowService(
    store,
    tempDir,
    mockCatalog,
    mockLlm,
    commService
  );
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe("Flujo Inteligente de Guion Importado vs Tema", () => {
  it("1. Clasifica correctamente un prompt corto como tema", () => {
    const prompt = "Explica cómo funcionan las vacaciones en el IMSS";
    const cl = classifyInput(prompt);
    expect(cl.kind).toBe("prompt");
    expect(cl.type).toBe("prompt");
    expect(deriveShortTitle(prompt)).toBe("Explica cómo funcionan las vacaciones en el IMSS");
  });

  it("2. Clasifica correctamente un prompt largo de varios párrafos como tema", () => {
    const longPrompt = `Quiero un episodio completo sobre el tiempo extraordinario.
Debe cubrir los turnos continuos, las guardias de fin de semana y los límites de la Cláusula 25.
Asegúrate de explicar cómo tramitar el pago y cuáles son las responsabilidades del jefe de servicio.`;
    const cl = classifyInput(longPrompt);
    expect(cl.kind).toBe("prompt");
    const title = deriveShortTitle(longPrompt);
    expect(title.length).toBeLessThanOrEqual(120);
    expect(title).toContain("tiempo extraordinario");
  });

  it("3. Clasifica y parsea un guion completo con 4 personajes + comercial", () => {
    const rawScript = `# Episodio Especial: Jornadas y Descansos
[MÚSICA DE APERTURA]

**EDUARDO:** Bienvenidos a La Veinte Radio. [PAUSA 1s] Hoy tenemos un tema crucial.

**ANDREA:** Así es, Eduardo. [RISAS] Muchos compañeros tienen dudas sobre el descanso semanal.

**JAVIER RÍOS:** De conformidad con la Cláusula 22 del CCT, el descanso es obligatorio e irrenunciable.

[SFX: timbre de notificación]

**RODRIGO TORRES:** Reportando desde el HGZ 1, donde nos informan sobre la asignación de guardias.

**VALERIA:** Espacio patrocinado por la Caja de Ahorro Magisterial y de Salud. Solicita tu préstamo hoy.

[MÚSICA DE CIERRE]`;

    const cl = classifyInput(rawScript);
    expect(cl.kind).toBe("script");
    expect(cl.stats.detectedSpeakers).toContain("EDUARDO");
    expect(cl.stats.detectedSpeakers).toContain("ANDREA");

    const script = parseScript(rawScript);
    expect(script.turns.length).toBe(5);
    expect(script.turns[0].speaker).toBe("EDUARDO");
    expect(script.turns[1].speaker).toBe("ANDREA");
    expect(script.turns[2].speaker).toBe("JAVIER");
    expect(script.turns[3].speaker).toBe("RODRIGO");
    expect(script.turns[4].speaker).toBe("VALERIA");
    expect(script.turns[4].adSlot).toBe(true);
    expect(script.turns[4].kind).toBe("ad");

    // Acotaciones deben eliminarse de ttsText
    expect(script.turns[0].ttsText).not.toContain("[PAUSA 1s]");
    expect(script.turns[1].ttsText).not.toContain("[RISAS]");
  });

  it("4. Parsea correctamente guion en texto plano sin Markdown", () => {
    const plainScript = `EDUARDO: Hola a todos en el hospital.
ANDREA: Saludos cordiales.
JAVIER: El artículo 123 constitucional respalda esta prestación.`;

    const cl = classifyInput(plainScript);
    expect(cl.kind).toBe("script");

    const script = parseScript(plainScript);
    expect(script.turns.length).toBe(3);
    expect(script.turns[0].speaker).toBe("EDUARDO");
    expect(script.turns[1].speaker).toBe("ANDREA");
    expect(script.turns[2].speaker).toBe("JAVIER");
  });

  it("5. Elimina rigurosamente acotaciones de síntesis TTS", () => {
    const raw = "Inicio [MÚSICA SUBE] diálogo importante [SFX: campana] [PAUSA 2s] [RISAS] final.";
    const clean = sanitizeTtsText(raw);
    expect(clean).toBe("Inicio diálogo importante final.");
  });

  it("6. Guarda guion importado en SCRIPT_READY con título corto sin cabecera gigantesca", () => {
    const hugeMarkdownScript = `# Guion Completo de Nómina y Salarios en el IMSS
[MÚSICA]
EDUARDO: Bienvenidos al episodio número cincuenta.
ANDREA: Hoy revisamos conceptos de cobro y deducciones indebidas.`;

    const cleanTitle = deriveShortTitle(hugeMarkdownScript);
    expect(cleanTitle).toBe("Guion Completo de Nómina y Salarios en el IMSS");
    expect(cleanTitle.length).toBeLessThan(80);

    const parsedScript = parseScript(hugeMarkdownScript);
    const p = store.create({
      topic: hugeMarkdownScript,
      titulo: cleanTitle,
      script: parsedScript,
    });

    expect(p.state).toBe("SCRIPT_READY");
    expect(p.titulo).toBe("Guion Completo de Nómina y Salarios en el IMSS");
    expect(p.research).toBeNull();
    expect(p.proposal).toBeNull();
    expect(p.script).not.toBeNull();
    expect(store.readScript(p.id)).not.toBeNull();
  });

  it("7. workflow.verify y workflow.produce funcionan para guiones importados sin requerir research.json", async () => {
    const rawScript = `EDUARDO: Buenas tardes a toda la audiencia.
ANDREA: Buenas tardes. Analizamos los derechos de suplencia.`;

    const parsedScript = parseScript(rawScript);
    const p = store.create({
      topic: rawScript,
      script: parsedScript,
    });

    // verify no debe lanzar RESEARCH_REQUIRED
    const verifyResult = await workflow.verify(p.id);
    expect(verifyResult.verified).toBe(true);
    expect(verifyResult.claimsTotal).toBe(0);
    expect(verifyResult.speakerValid).toBe(true);

    // produce debe pasar a PRODUCING
    const producingProject = await workflow.produce(p.id);
    expect(producingProject.state).toBe("PRODUCING");
  });

  it("8. Diagnóstico de errores sin filtrar API keys ni tokens", () => {
    const keyError = new Error("Groq request failed with 401: Unauthorized gsk_abcdef1234567890XYZ secret");
    const friendly1 = friendlyProjectError(keyError);
    expect(friendly1.message).not.toContain("gsk_abcdef1234567890XYZ");
    expect(friendly1.message).toContain("gsk_***");

    const evidenceError = new InsufficientEvidenceError("Concepto 37");
    const friendly2 = friendlyProjectError(evidenceError);
    expect(friendly2.code).toBe("INSUFFICIENT_EVIDENCE");
    expect(friendly2.userMessage).toContain("suficiente información verificada");
    expect(friendly2.error).toContain("suficiente información verificada");

    const rateError = new GroqRateLimitedError(30);
    const friendly3 = friendlyProjectError(rateError);
    expect(friendly3.code).toBe("GROQ_RATE_LIMITED");
    expect(friendly3.userMessage).toContain("límite de solicitudes");

    const qualityError = new ScriptQualityFailedError(["Turno 3 sin respaldo factual"]);
    const friendly4 = friendlyProjectError(qualityError);
    expect(friendly4.code).toBe("SCRIPT_QUALITY_FAILED");
    expect(friendly4.userMessage).toContain("calidad");
  });

  it("9. Reanudación y persistencia de proyecto tras fallo", () => {
    const p = store.create({ topic: "Tema de prueba" });
    expect(p.state).toBe("DRAFT");

    // Simular que falló en propuesta
    store.updateState(p.id, "PROPOSAL_GENERATION_FAILED");
    const failedP = store.get(p.id);
    expect(failedP?.state).toBe("PROPOSAL_GENERATION_FAILED");

    // Reabrir store desde disco (simular reinicio de app)
    const freshStore = new ProjectStore(tempDir);
    const reloadedP = freshStore.get(p.id);
    expect(reloadedP?.state).toBe("PROPOSAL_GENERATION_FAILED");
    // No debe estar atorado en "GENERATING_PROPOSALS" ni "RESEARCHING"
    expect(reloadedP?.state).not.toBe("GENERATING_PROPOSALS");
    expect(reloadedP?.state).not.toBe("RESEARCHING");

    // Simular reintento exitoso
    freshStore.updateState(p.id, "PROPOSAL_READY");
    expect(freshStore.get(p.id)?.state).toBe("PROPOSAL_READY");
  });

  it("10. Soporta guion real de 10,000 caracteres colapsado en una sola línea con negritas sin dos puntos", () => {
    const rawCollapsed = `**[SFX: clic de interruptor. Se enciende equipo de estudio. Unos segundos de ambiente. Se escucha mover ligeramente un micrófono.]**  **ANDREA** ¿Ya estamos grabando?  **EDUARDO** Según yo, sí.  **RODRIGO** Eso inspira muchísima confianza para ser el primer programa.  **ANDREA** Espérate, que todavía puede salir peor.  **JAVIER** Técnicamente, mientras el indicador esté encendido, ya estamos al aire.  **ANDREA** Javier…  **JAVIER** ¿Qué?  **ANDREA** Llevamos como diez segundos y ya dijiste “técnicamente”.  **RODRIGO** Yo digo que lo dejemos. Que la gente vaya conociendo desde ahorita lo que le espera.  **[RISAS BREVES]**  **EDUARDO** Bueno…  Ahora sí.  Bienvenidas y bienvenidos.  Esto es **La Veinte Radio**.`;

    const cl = classifyInput(rawCollapsed);
    expect(cl.kind).toBe("script");
    expect(cl.confidence).toBeGreaterThanOrEqual(0.9);
    expect(cl.suggestedTitle).toBe("¿Ya estamos grabando?");

    const parsed = parseScript(rawCollapsed);
    expect(parsed.turns.length).toBeGreaterThanOrEqual(8);
    expect(parsed.turns[0].speaker).toBe("ANDREA");
    expect(parsed.turns[0].displayText).toBe("¿Ya estamos grabando?");
    expect(parsed.turns[1].speaker).toBe("EDUARDO");
    expect(parsed.turns[1].displayText).toBe("Según yo, sí.");

    // Al crearlo en el store a través de workflow de importación
    const project = store.create({
      topic: rawCollapsed,
      title: cl.suggestedTitle,
      kind: "script",
      script: parsed,
      state: "SCRIPT_READY",
      research: null,
      proposal: null,
    });

    expect(project.state).toBe("SCRIPT_READY");
    expect(project.titulo).toBe("¿Ya estamos grabando?");
    expect(project.script).not.toBeNull();
    expect(project.research).toBeNull();
    expect(project.proposal).toBeNull();
  });
});