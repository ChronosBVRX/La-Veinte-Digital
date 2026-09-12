/**
 * Rutas de proyecto (proposal-first). Empaquetadas en un módulo aparte para
 * no engordar index.ts: un handler por ruta, inyección de servicios vía ctx.
 */
import type { ServerResponse } from "node:http";
import type { ProjectWorkflowService } from "../services/project-workflow";
import type { ProjectStore } from "../services/project-store";
import type { CommercialLibraryService } from "../services/commercial-service";
import {
  ProjectSchema,
  ScriptSchema,
  type Project,
  type Commercial,
  type Script,
} from "@la-veinte/studio-contract";
import {
  classifyInput,
  parseScript,
  deriveShortTitle,
} from "@la-veinte/radio-core";

export interface ProjectRouteCtx {
  store: ProjectStore;
  workflow: ProjectWorkflowService;
  commercials: CommercialLibraryService;
  json: (res: ServerResponse, code: number, body: unknown) => void;
  /** Dispara la cola de producción TTS real (implementada en index.ts). */
  startProduction?: (id: string, script: Script) => Promise<{ started: boolean; total: number }>;
  /** Dispara la producción visual en segundo plano (implementada en index.ts). */
  startVisualProduction?: (id: string) => Promise<void>;
  /** Limpia un trabajo de producción activo asociado al proyecto (implementada en index.ts). */
  onDelete?: (id: string) => void;
  /** Consulta el estado del job visual para reportar progreso en tiempo real */
  getVisualJob?: (id: string) => unknown;
}

function parseId(raw: string): string {
  const parts = raw.split("/").filter(Boolean);
  return parts.length >= 3 ? parts[1] : "";
}

export async function routeProject(url: URL, req: import("node:http").IncomingMessage, res: ServerResponse, ctx: ProjectRouteCtx, readBody: () => Promise<Record<string, unknown>>): Promise<boolean> {
  const p = url.pathname;
  if (!p.startsWith("/projects")) return false;
  const method = req.method ?? "GET";
  const segments = p.split("/").filter(Boolean);

  if (method === "GET" && segments.length === 1) {
    ctx.json(res, 200, ctx.store.list());
    return true;
  }

  const id = segments[1] ?? "";
  if (method === "GET" && segments.length === 2 && id) {
    const project = ctx.store.get(id);
    if (!project) { ctx.json(res, 404, { error: "PROJECT_NOT_FOUND" }); return true; }
    const vj = ctx.getVisualJob?.(id);
    if (vj && vj.status === "RENDERING" && vj.progress) {
      ctx.json(res, 200, {
        ...project,
        visual: {
          ...(project.visual || {}),
          status: "RENDERING",
          progress: vj.progress,
        },
      });
      return true;
    }
    ctx.json(res, 200, project);
    return true;
  }

  if (method === "DELETE" && segments.length === 2 && id) {
    const project = ctx.store.get(id);
    if (!project) { ctx.json(res, 404, { error: "PROJECT_NOT_FOUND" }); return true; }
    // limpiar un trabajo de producción activo de este proyecto antes de borrar el disco
    try { ctx.onDelete?.(id); } catch { /* mejor esfuerzo */ }
    ctx.store.delete(id);
    ctx.json(res, 200, { deleted: true, id });
    return true;
  }

function sanitizeScriptTurns(script: Script): Script {
  for (const turn of script.turns) {
    if (turn.displayText) {
      turn.displayText = turn.displayText
        .replace(/\[(?:PAUSA|PAUSE|SILENCIO)[\s\S]*?\]/gi, " ")
        .replace(/\[(?:MÚSICA|MUSICA|MUSIC|SFX|CORTE|AUDIO|TRANSICIÓN|TRANSICION)[\s\S]*?\]/gi, " ")
        .replace(/\s{2,}/g, " ")
        .trim();
    }
  }
  return script;
}

  if (method === "POST" && segments.length === 1) {
    const body = await readBody();
    const topic = String(body.topic ?? "").trim();
    if (!topic) { ctx.json(res, 400, { error: "topic vacío" }); return true; }

    // Detección automática o guion explícito provisto
    let scriptToStore: Script | null = null;
    const classification = classifyInput(topic);
    if (classification.kind === "script") {
      try {
        scriptToStore = parseScript(topic);
      } catch (e) {
        ctx.json(res, 400, {
          error: e instanceof Error ? e.message : "No se pudo interpretar el guion importado",
        });
        return true;
      }
    } else if (body.script && typeof body.script === "object") {
      const parsed = ScriptSchema.safeParse(body.script);
      if (parsed.success) {
        scriptToStore = parsed.data;
      }
    }

    if (scriptToStore) {
      sanitizeScriptTurns(scriptToStore);
    }

    const shortTitle = deriveShortTitle(body.titulo ? String(body.titulo) : topic);

    const template = ProjectSchema.safeParse({
      id: "x",
      titulo: shortTitle,
      topic,
      state: scriptToStore ? "SCRIPT_READY" : "DRAFT",
      createdAt: "",
      updatedAt: "",
      config: body.config,
    });
    const config = template.success ? template.data.config : undefined;
    const project = await ctx.workflow.create({
      topic,
      titulo: shortTitle,
      config,
      script: scriptToStore,
      state: scriptToStore ? "SCRIPT_READY" : "DRAFT",
    });
    ctx.json(res, 201, project);
    return true;
  }

  if (method === "POST" && segments.length >= 3 && !id) return false;
  const action = segments[2];
  const subAction = segments[3];

  if (action === "research") {
    const { project, research } = await ctx.workflow.research(id);
    ctx.json(res, 200, { project, research });
    return true;
  }
  if (action === "proposal" && subAction === "update") {
    const body = await readBody();
    const patch = (body.patch ?? body) as Partial<import("@la-veinte/studio-contract").Proposal>;
    const project = await ctx.workflow.updateProposal(id, patch);
    ctx.json(res, 200, project);
    return true;
  }
  if (action === "proposal") {
    const { project, proposal } = await ctx.workflow.createProposal(id);
    ctx.json(res, 200, { project, proposal });
    return true;
  }
  if (action === "approve") {
    const project = await ctx.workflow.approve(id);
    ctx.json(res, 200, project);
    return true;
  }
  if (action === "script" && subAction === "import") {
    const body = await readBody();
    let scriptObj: Script;
    if (body.rawScript && typeof body.rawScript === "string") {
      scriptObj = parseScript(body.rawScript);
    } else if (body.script && typeof body.script === "object") {
      scriptObj = ScriptSchema.parse(body.script);
    } else {
      ctx.json(res, 400, { error: "Falta script o rawScript" });
      return true;
    }
    sanitizeScriptTurns(scriptObj);
    const project = await ctx.workflow.importScript(id, scriptObj);
    ctx.json(res, 200, project);
    return true;
  }
  if (action === "script") {
    const { project, script, verify } = await ctx.workflow.generateScript(id);
    ctx.json(res, 200, { project, script, verify });
    return true;
  }
  if (action === "verify") {
    const verify = await ctx.workflow.verify(id);
    ctx.json(res, 200, verify);
    return true;
  }
  if (action === "produce") {
    const project = await ctx.workflow.produce(id);
    if (ctx.startProduction && project.script) {
      try {
        const started = await ctx.startProduction(id, project.script);
        ctx.json(res, 202, { project, started });
      } catch (e) {
        if (/producción en curso|produccion en curso/i.test(e instanceof Error ? e.message : String(e))) {
          ctx.json(res, 409, { error: "ya hay una producción en curso", project });
          return true;
        }
        throw e;
      }
      return true;
    }
    ctx.json(res, 202, project);
    return true;
  }
  if (action === "render-visual") {
    const project = ctx.store.get(id);
    if (!project) { ctx.json(res, 404, { error: "PROJECT_NOT_FOUND" }); return true; }
    if (!project.master?.master) {
      ctx.json(res, 400, { error: "Se requiere haber generado el master de audio antes de renderizar video" });
      return true;
    }
    if (ctx.startVisualProduction) {
      await ctx.startVisualProduction(id);
    }
    const updated = ctx.store.get(id);
    ctx.json(res, 202, { project: updated, started: true });
    return true;
  }

  ctx.json(res, 404, { error: "ruta de proyecto desconocida" });
  return true;
}

/** Errores de flujo → mensaje amigable con código y sanitización de credenciales. */
export function friendlyProjectError(e: unknown): { error: string; code: string; message: string; userMessage: string } {
  const rawMsg = e instanceof Error ? e.message : String(e);
  // Sanitizar llaves y secretos para no exponer credenciales jamás
  const sanitizedMsg = rawMsg
    .replace(/gsk_[a-zA-Z0-9_-]{15,}/gi, "gsk_***")
    .replace(/(?:Bearer|key|secret)\s*[:=]?\s*[a-zA-Z0-9._-]{15,}/gi, "$1 ***");

  // Si es un error tipado de dominio
  if (typeof e === "object" && e !== null && "code" in e && "userMessage" in e) {
    const domainError = e as { code: unknown; userMessage: unknown };
    const code = String(domainError.code ?? "UNKNOWN");
    const userMessage = String(domainError.userMessage ?? "");
    return {
      error: userMessage,
      code,
      message: sanitizedMsg,
      userMessage,
    };
  }

  const codeMap: Record<string, { code: string; userMessage: string }> = {
    PROJECT_NOT_FOUND: { code: "UNKNOWN", userMessage: "No encuentro ese episodio. Vuelve a abrirlo desde la lista." },
    RESEARCH_REQUIRED: { code: "UNKNOWN", userMessage: "Primero reviso las fuentes antes de armar la propuesta." },
    PROPOSAL_REQUIRED: { code: "UNKNOWN", userMessage: "Falta aprobar la propuesta antes de generar el guion." },
    LOCAL_LIBRARY_UNAVAILABLE: { code: "LOCAL_LIBRARY_UNAVAILABLE", userMessage: "No encuentro la biblioteca necesaria para investigar este tema." },
    GROQ_UNAVAILABLE: { code: "GROQ_UNAVAILABLE", userMessage: "El motor editorial no está disponible. Tu investigación y el proyecto están guardados." },
    GROQ_RATE_LIMITED: { code: "GROQ_RATE_LIMITED", userMessage: "El servicio alcanzó temporalmente su límite de solicitudes. Tu investigación y el proyecto están guardados." },
    INSUFFICIENT_EVIDENCE: { code: "INSUFFICIENT_EVIDENCE", userMessage: "La biblioteca no contiene suficiente información verificada para explicar este tema con seguridad." },
    PROPOSAL_GENERATION_FAILED: { code: "PROPOSAL_GENERATION_FAILED", userMessage: "No fue posible generar una propuesta editorial que cumpla con los estándares de calidad." },
    SCRIPT_QUALITY_FAILED: { code: "SCRIPT_QUALITY_FAILED", userMessage: "El episodio no alcanzó el nivel de calidad necesario y no se generará audio. Puedes volver a intentarlo." },
    SCRIPT_GENERATION_FAILED: { code: "SCRIPT_GENERATION_FAILED", userMessage: "No pudimos generar el episodio en este momento. Tu investigación y el proyecto están guardados." },
    PRODUCTION_BLOCKED: { code: "PRODUCTION_BLOCKED", userMessage: "La producción de audio está bloqueada porque el guion no cuenta con verificación aprobada." },
    "producción en curso": { code: "UNKNOWN", userMessage: "Ya hay un episodio en producción. Espera a que termine o detén la producción actual." },
    "produccion en curso": { code: "UNKNOWN", userMessage: "Ya hay un episodio en producción. Espera a que termine o detén la producción actual." },
  };
  for (const [k, v] of Object.entries(codeMap)) {
    if (sanitizedMsg.includes(k)) return { error: v.userMessage, ...v, message: sanitizedMsg };
  }
  return {
    error: "Algo salió mal en la creación del episodio.",
    code: "UNKNOWN",
    message: sanitizedMsg,
    userMessage: "Algo salió mal en la creación del episodio.",
  };
}
