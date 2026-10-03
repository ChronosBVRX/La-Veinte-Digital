import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ProgressManager } from "../progress-manager";
import { ProjectStore } from "../project-store";

describe("ProgressManager", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "progress-test-"));
  const store = new ProjectStore(path.join(tempDir, "data"));
  const manager = new ProgressManager(store, tempDir);

  beforeAll(() => {
    const projDir = path.join(tempDir, "data", "projects", "proj-comp-1");
    fs.mkdirSync(projDir, { recursive: true });

    fs.writeFileSync(
      path.join(projDir, "project.json"),
      JSON.stringify({
        id: "proj-comp-1",
        title: "Episodio de prueba",
        topic: "Prueba",
        state: "DONE",
        createdAt: "2026-09-14T00:00:00.000Z",
        updatedAt: "2026-09-14T01:00:00.000Z",
        config: {
          topic: "Prueba",
          tone: "profesional",
          targetDurationMinutes: 5,
          editorial: { sourcesAllowed: ["cct"], claimsMode: "estricto" },
          productionPreferences: { mode: "audio_video", outputFormats: ["9:16"] },
        },
      }),
      "utf8"
    );

    fs.writeFileSync(
      path.join(projDir, "script.json"),
      JSON.stringify({
        topic: "Prueba",
        turns: [{ id: "t1", speaker: "EDUARDO", displayText: "Hola" }],
      }),
      "utf8"
    );

    const masterDir = path.join(tempDir, "data", "tts", "master");
    fs.mkdirSync(masterDir, { recursive: true });
    fs.writeFileSync(path.join(masterDir, "programa-proj-comp-1.mp3"), Buffer.alloc(2000));

    const videoDir = path.join(tempDir, "data", "tts", "video", "proj-comp-1");
    fs.mkdirSync(videoDir, { recursive: true });
    fs.writeFileSync(path.join(videoDir, "episodio-proj-comp-1-9x16.mp4"), Buffer.alloc(60000));
  });

  afterAll(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it("calcula correctamente el progreso canónico de un proyecto completado", () => {
    const progress = manager.getProgress("proj-comp-1");
    expect(progress.projectId).toBe("proj-comp-1");
    expect(progress.overallPercent).toBe(100);
    expect(progress.state).toBe("completado");
    expect(progress.phase).toBe("exportacion");
    expect(progress.outputs?.videoPath9x16).toBeDefined();
    expect(progress.outputs?.folderPath).toBeDefined();
  });

  it("devuelve estado de error para un proyecto inexistente", () => {
    const progress = manager.getProgress("no-existe-xyz");
    expect(progress.projectId).toBe("no-existe-xyz");
    expect(progress.state).toBe("error");
    expect(progress.error).toBeDefined();
  });
});
