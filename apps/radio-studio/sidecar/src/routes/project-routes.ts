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
  type Project,
  type Commercial,
  type Script,
} from "@la-veinte/studio-contract";

export interface ProjectRouteCtx {
  store: ProjectStore;
  workflow: ProjectWorkflowService;
  commercials: CommercialLibraryService;
  json: (res: ServerResponse, code: number, body: unknown) => void;
  /** Dispara la cola de producción TTS real (implementada en index.ts). */
  startProduction?: (id: string, script: Script) => Promise<{ started: boolean; total: number }>;
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
    ctx.json(res, 200, project);
    return true;
  }

  if (method === "POST" && segments.length === 1) {
    const body = await readBody();
    const topic = String(body.topic ?? "").trim();
    if (!topic) { ctx.json(res, 400, { error: "topic vacío" }); return true; }
    const template = ProjectSchema.safeParse({
      id: "x", titulo: topic, topic, state: "DRAFT", createdAt: "", updatedAt: "", config: body.config,
    });
    const config = template.success ? template.data.config : undefined;
    const project = await ctx.workflow.create({ topic, config });
    ctx.json(res, 201, project);
    return true;
  }

  if (method === "POST" && segments.length === 3 && !id) return false;
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
      const started = await ctx.startProduction(id, project.script);
      ctx.json(res, 202, { project, started });
      return true;
    }
    ctx.json(res, 202, project);
    return true;
  }

  ctx.json(res, 404, { error: "ruta de proyecto desconocida" });
  return true;
}

/** Errores de flujo → mensaje amigable con código. */
export function friendlyProjectError(e: unknown): { code: string; message: string; userMessage: string } {
  const msg = e instanceof Error ? e.message : String(e);
  const codeMap: Record<string, { code: string; userMessage: string }> = {
    PROJECT_NOT_FOUND: { code: "UNKNOWN", userMessage: "No encuentro ese episodio. Vuelve a abrirlo desde la lista." },
    RESEARCH_REQUIRED: { code: "UNKNOWN", userMessage: "Primero reviso las fuentes antes de armar la propuesta." },
    PROPOSAL_REQUIRED: { code: "UNKNOWN", userMessage: "Falta aprobar la propuesta antes de generar el guion." },
    LOCAL_LIBRARY_UNAVAILABLE: { code: "LOCAL_LIBRARY_UNAVAILABLE", userMessage: "No encuentro la biblioteca necesaria para investigar este tema." },
    LOCAL_LLM_UNAVAILABLE: { code: "MOTOR_UNAVAILABLE", userMessage: "El motor local no está disponible. Puedo armar la propuesta de forma simple por ahora." },
  };
  for (const [k, v] of Object.entries(codeMap)) {
    if (msg.includes(k)) return { ...v, message: msg };
  }
  return { code: "UNKNOWN", message: msg, userMessage: "Algo salió mal en la creación del episodio." };
}
