/**
 * Rutas de la API Visual para AI Radio Studio.
 * Catálogo de assets, referencias, edición de plan visual y renderizado multiformato.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { VisualBeat } from "@la-veinte/studio-contract";
import { VisualAssetService } from "../services/visual-asset-service";

export interface VisualRouteCtx {
  assetService: VisualAssetService;
  json: (res: ServerResponse, code: number, body: unknown) => void;
  startVisualProduction?: (id: string, formats?: string[]) => Promise<void>;
}

export async function routeVisual(
  url: URL,
  req: IncomingMessage,
  res: ServerResponse,
  ctx: VisualRouteCtx,
  readBody: () => Promise<Record<string, unknown>>
): Promise<boolean> {
  const p = url.pathname;
  const method = req.method ?? "GET";
  const segments = p.split("/").filter(Boolean);

  // ── 1. Endpoints de Catálogo de Assets (/assets) ──
  if (segments[0] === "assets") {
    // GET /assets
    if (method === "GET" && segments.length === 1) {
      const category = url.searchParams.get("category") || undefined;
      const typeParam = url.searchParams.get("type");
      const type = (typeParam === "official" || typeParam === "reference_based" || typeParam === "generic" || typeParam === "user_provided")
        ? typeParam
        : undefined;
      const query = url.searchParams.get("q") || undefined;
      const tag = url.searchParams.get("tag") || undefined;
      const onlyFavorites = url.searchParams.get("favorites") === "true";

      const assets = ctx.assetService.listAssets({ category, type, query, tag, onlyFavorites });
      ctx.json(res, 200, assets);
      return true;
    }

    // POST /assets/upload
    if (method === "POST" && segments.length === 2 && segments[1] === "upload") {
      const body = await readBody();
      const filename = String(body.filename || "upload.png");
      const base64Data = String(body.base64 || "");
      if (!base64Data) {
        ctx.json(res, 400, { error: "base64 requerido para la subida de imagen" });
        return true;
      }
      const buffer = Buffer.from(base64Data.replace(/^data:image\/\w+;base64,/, ""), "base64");
      const uploadType = body.type === "reference_based" ? "reference_based" : "user_provided";
      const newAsset = ctx.assetService.saveUploadedAsset(filename, buffer, {
        entity: String(body.entity || "Material propio"),
        category: String(body.category || "general"),
        type: uploadType,
        tags: Array.isArray(body.tags) ? body.tags.map(String) : ["propio"],
        source: String(body.source || "Aportado por el usuario"),
      });
      ctx.json(res, 201, newAsset);
      return true;
    }

    // POST /assets/:id/favorite
    if (method === "POST" && segments.length === 3 && segments[2] === "favorite") {
      const assetId = segments[1];
      const result = ctx.assetService.toggleFavorite(assetId);
      ctx.json(res, 200, result);
      return true;
    }

    // POST /assets/:id/block
    if (method === "POST" && segments.length === 3 && segments[2] === "block") {
      const assetId = segments[1];
      const result = ctx.assetService.toggleBlock(assetId);
      ctx.json(res, 200, result);
      return true;
    }

    // POST /assets/research
    if (method === "POST" && segments.length === 2 && segments[1] === "research") {
      const body = await readBody();
      const entity = String(body.entity || "").trim();
      if (!entity) {
        ctx.json(res, 400, { error: "entity requerida" });
        return true;
      }
      const ref = await ctx.assetService.research(entity);
      ctx.json(res, 200, { entity, reference: ref });
      return true;
    }

    // POST /assets/generate
    if (method === "POST" && segments.length === 2 && segments[1] === "generate") {
      const body = await readBody();
      const entity = String(body.entity || "").trim();
      if (!entity) {
        ctx.json(res, 400, { error: "entity requerida" });
        return true;
      }
      const result = await ctx.assetService.generate({
        entity,
        category: body.category ? String(body.category) : undefined,
        investigateReferences: body.investigateReferences !== false,
        orientations: Array.isArray(body.orientations) ? body.orientations.map(String) : ["16:9", "9:16"],
        stylePrompt: body.stylePrompt ? String(body.stylePrompt) : undefined,
      });
      ctx.json(res, 200, result);
      return true;
    }
  }

  // ── 2. Endpoints de Plan Visual y Referencias de Proyecto (/projects/:id/...) ──
  if (segments[0] === "projects" && segments.length >= 3) {
    const projectId = segments[1];
    const action = segments[2];
    const subAction = segments[3];

    // GET /projects/:id/visual-plan
    if (method === "GET" && action === "visual-plan") {
      const plan = ctx.assetService.getProjectVisualPlan(projectId);
      if (!plan) {
        ctx.json(res, 404, { error: "PLAN_NOT_FOUND", message: "Aún no se ha generado el plan visual para este proyecto." });
        return true;
      }
      ctx.json(res, 200, plan);
      return true;
    }

    // PATCH /projects/:id/visual-plan/:beatId
    if (method === "PATCH" && action === "visual-plan" && subAction) {
      const beatId = subAction;
      const body = await readBody();
      const updatedPlan = ctx.assetService.updateProjectVisualBeat(projectId, beatId, body as Partial<VisualBeat>);
      if (!updatedPlan) {
        ctx.json(res, 404, { error: "BEAT_NOT_FOUND", message: `No se encontró el beat ${beatId} en el plan visual.` });
        return true;
      }
      ctx.json(res, 200, { ok: true, beatId, plan: updatedPlan });
      return true;
    }

    // GET /projects/:id/references
    if (method === "GET" && action === "references") {
      const refs = ctx.assetService.getProjectReferences(projectId);
      if (!refs) {
        ctx.json(res, 404, { error: "REFERENCES_NOT_FOUND", message: "Aún no se ha generado el reporte de referencias para este proyecto." });
        return true;
      }
      ctx.json(res, 200, refs);
      return true;
    }

    // POST /projects/:id/render-visual (con soporte de formatos selectivos: preview o all)
    if (method === "POST" && action === "render-visual") {
      const body = await readBody();
      const formats = Array.isArray(body.formats) ? body.formats.map(String) : ["preview", "16x9", "9x16"];
      if (ctx.startVisualProduction) {
        await ctx.startVisualProduction(projectId, formats);
      }
      ctx.json(res, 202, { ok: true, projectId, formats, started: true });
      return true;
    }
  }

  return false;
}
