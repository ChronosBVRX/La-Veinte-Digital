import { describe, it, expect, vi } from "vitest";
import path from "node:path";
import { routeProject, type ProjectRouteCtx } from "../project-routes";
import { ProgressManager } from "../../services/progress-manager";
import { makeProjectStoreForRepo } from "../../services/project-store";
import type { EpisodeProductionProgress } from "@la-veinte/studio-contract";

describe("project-routes V1.1 — Progress & Turn Operations", () => {
  const repoRoot = path.resolve(__dirname, "../../../../../..");
  const store = makeProjectStoreForRepo(repoRoot);
  const progressManager = new ProgressManager(store, repoRoot);

  const mockProgress: EpisodeProductionProgress = {
    projectId: "be326400",
    state: "completado",
    phase: "exportacion",
    overallPercent: 100,
    currentStagePercent: 100,
    currentAction: "Episodio producido al 100%",
    timings: { updatedAt: new Date().toISOString(), elapsedSeconds: 10 },
    format: "audio_video",
    outputs: {
      folderPath: "/mock/be326400",
    },
  };
  vi.spyOn(progressManager, "getProgress").mockReturnValue(mockProgress);

  interface CapturedResponse {
    _captured?: { code: number; body: Record<string, unknown> };
  }

  const mockCtx: ProjectRouteCtx = {
    store,
    progressManager,
    repoRoot,
    workflow: {} as unknown as ProjectRouteCtx["workflow"],
    commercials: {} as unknown as ProjectRouteCtx["commercials"],
    json: (res, code, body) => {
      (res as unknown as CapturedResponse)._captured = { code, body: body as Record<string, unknown> };
    },
    cancelProduction: vi.fn().mockResolvedValue(true),
  };

  it("responde GET /projects/:id/progress con el progreso canónico", async () => {
    const mockRes = {} as unknown as import("node:http").ServerResponse & CapturedResponse;
    const url = new URL("http://127.0.0.1:3977/projects/be326400/progress");
    const req = { method: "GET" } as unknown as import("node:http").IncomingMessage;

    const handled = await routeProject(url, req, mockRes, mockCtx, async () => ({}));
    expect(handled).toBe(true);
    expect(mockRes._captured?.code).toBe(200);
    expect(mockRes._captured?.body.projectId).toBe("be326400");
    expect(mockRes._captured?.body.overallPercent).toBe(100);
    expect(mockRes._captured?.body.state).toBe("completado");
  });

  it("responde GET /projects/:id/open-folder con la ruta de salida", async () => {
    const mockRes = {} as unknown as import("node:http").ServerResponse & CapturedResponse;
    const url = new URL("http://127.0.0.1:3977/projects/be326400/open-folder");
    const req = { method: "GET" } as unknown as import("node:http").IncomingMessage;

    const handled = await routeProject(url, req, mockRes, mockCtx, async () => ({}));
    expect(handled).toBe(true);
    expect(mockRes._captured?.code).toBe(200);
    expect(mockRes._captured?.body.ok).toBe(true);
    expect(String(mockRes._captured?.body.path)).toContain("be326400");
  });

  it("responde POST /projects/:id/cancel cancelando la producción", async () => {
    const mockRes = {} as unknown as import("node:http").ServerResponse & CapturedResponse;
    const url = new URL("http://127.0.0.1:3977/projects/be326400/cancel");
    const req = { method: "POST" } as unknown as import("node:http").IncomingMessage;

    const handled = await routeProject(url, req, mockRes, mockCtx, async () => ({}));
    expect(handled).toBe(true);
    expect(mockRes._captured?.code).toBe(200);
    expect(mockRes._captured?.body.cancelled).toBe(true);
    expect(mockCtx.cancelProduction).toHaveBeenCalledWith("be326400");
  });
});
