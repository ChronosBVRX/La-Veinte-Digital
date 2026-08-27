/**
 * Rutas de la biblioteca de comerciales.
 */
import type { ServerResponse } from "node:http";
import type { CommercialLibraryService } from "../services/commercial-service";
import type { Commercial } from "@la-veinte/studio-contract";

export interface CommercialRouteCtx {
  commercials: CommercialLibraryService;
  json: (res: ServerResponse, code: number, body: unknown) => void;
}

export async function routeCommercial(url: URL, req: import("node:http").IncomingMessage, res: ServerResponse, ctx: CommercialRouteCtx, readBody: () => Promise<Record<string, unknown>>): Promise<boolean> {
  const p = url.pathname;
  if (!p.startsWith("/commercials")) return false;
  const method = req.method ?? "GET";
  const segments = p.split("/").filter(Boolean);
  const id = segments[1] ?? "";

  if (method === "GET" && segments.length === 1) {
    const onlyActive = url.searchParams.get("onlyActive") === "true";
    const items = ctx.commercials.list({ onlyActive });
    ctx.json(res, 200, items);
    return true;
  }

  if (method === "POST" && segments.length === 1 && url.searchParams.get("seed") === "true") {
    const r = ctx.commercials.seedDefaults();
    ctx.json(res, 200, r);
    return true;
  }

  if (method === "POST" && segments.length === 1) {
    const body = await readBody();
    const commercial = ctx.commercials.create(body as Parameters<CommercialLibraryService["create"]>[0]);
    ctx.json(res, 201, commercial);
    return true;
  }

  if (id && segments.length === 2 && method === "POST") {
    const body = await readBody();
    const action = url.searchParams.get("action") ?? "update";
    let updated: Commercial | null = null;
    if (action === "archive") updated = ctx.commercials.archive(id);
    else if (action === "activate") updated = ctx.commercials.setActive(id, true);
    else if (action === "deactivate") updated = ctx.commercials.setActive(id, false);
    else updated = ctx.commercials.update(id, body as Record<string, never>);
    if (!updated) { ctx.json(res, 404, { error: "COMMERCIAL_NOT_FOUND" }); return true; }
    ctx.json(res, 200, updated);
    return true;
  }

  ctx.json(res, 404, { error: "ruta comercial desconocida" });
  return true;
}
