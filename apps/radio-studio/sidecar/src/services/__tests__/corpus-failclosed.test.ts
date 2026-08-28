import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ProjectStore } from "../project-store";
import { ProjectWorkflowService } from "../project-workflow";
import { CommercialLibraryService } from "../commercial-service";
import { LocalEditorialLLM } from "../../llm/editorial/editorial-llm";
import { NormativeCatalog } from "../../../../../../src/features/normativa/services/catalog";

describe("fail-closed con corpus ausente", () => {
  it("lanza LOCAL_LIBRARY_UNAVAILABLE en vez de usar conocimiento paramétrico", async () => {
    // Repo raíz SIN biblioteca normativa (data/normativa vacía o inexistente)
    const emptyRepo = fs.mkdtempSync(path.join(os.tmpdir(), "lv-nolib-"));
    const store = new ProjectStore(path.join(emptyRepo, "data"));
    const workflow = new ProjectWorkflowService(
      store,
      emptyRepo,
      new NormativeCatalog(emptyRepo),
      LocalEditorialLLM.create(emptyRepo),
      new CommercialLibraryService(path.join(emptyRepo, "commercials"))
    );
    const p = store.create({ topic: "Cambio de horario" });
    await expect(workflow.research(p.id)).rejects.toThrow(/LOCAL_LIBRARY_UNAVAILABLE/);
    // el proyecto no debe fingir investigación ni iniciar nada
    const after = store.get(p.id);
    expect(after?.state).toBe("DRAFT");
    fs.rmSync(emptyRepo, { recursive: true, force: true });
  });
});
