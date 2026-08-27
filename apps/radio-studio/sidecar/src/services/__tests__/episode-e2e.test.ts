import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ProjectStore } from "../project-store";
import { ProjectWorkflowService } from "../project-workflow";
import { CommercialLibraryService } from "../commercial-service";
import { LocalEditorialLLM } from "../../llm/editorial/editorial-llm";
import { NormativeCatalog } from "../../../../../../src/features/normativa/services/catalog";

const REPO = path.resolve(__dirname, "..", "..", "..", "..", "..", "..");

// Tema pequeño y determinista para el E2E (sin Qwen TTS real; guion determinista).
const TOPIC = "¿Qué pasa si me cambian de horario sin avisarme?";

let store: ProjectStore;
let workflow: ProjectWorkflowService;
let dir: string;

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "lv-e2e-"));
  store = new ProjectStore(dir);
  workflow = new ProjectWorkflowService(
    store,
    REPO,
    new NormativeCatalog(REPO),
    LocalEditorialLLM.create(REPO),
    new CommercialLibraryService(path.join(dir, "commercials"))
  );
});

async function baseProject(comerciales: boolean) {
  return store.create({
    topic: TOPIC,
    config: {
      duracionMin: 15,
      nivel: "natural",
      contextoExtra: "",
      modo: "determinista",
      comerciales: comerciales
        ? { enabled: true, ids: ["com-colabora", "com-protege"], allowDirectorChoice: true, count: "auto", ubicacion: "auto", interaccion: "natural", duracionSec: 30 }
        : { enabled: false, ids: [], allowDirectorChoice: true, count: "auto", ubicacion: "auto", interaccion: "natural", duracionSec: 30 },
    },
  });
}

describe("E2E determinista del flujo de episodio", () => {
  it("recorre crear -> investigar -> propuesta -> aprobar -> guion -> verificar (sin comerciales)", async () => {
    const p = await baseProject(false);
    expect(p.state).toBe("DRAFT");

    const r = await workflow.research(p.id);
    expect(r.project.state).toBe("RESEARCHED");
    expect(r.research.claims.length).toBeGreaterThan(0);
    expect(r.research.coverage.percentage).toBeGreaterThanOrEqual(0);

    const pr = await workflow.createProposal(p.id);
    expect(pr.project.state).toBe("PROPOSAL_READY");
    expect(pr.proposal.participantes.length).toBeGreaterThanOrEqual(3);
    expect(["EDUARDO", "ANDREA", "JAVIER"]).toContain(pr.proposal.participantes[0].id);

    const ap = await workflow.approve(p.id);
    expect(ap.state).toBe("PROPOSAL_APPROVED");

    const s = await workflow.generateScript(p.id);
    expect(s.project.state).toBe("SCRIPT_READY");
    expect(s.script.turns.length).toBeGreaterThan(10);
    expect(s.verify.verified).toBe(true);
    expect(s.script.turns.every((t) => !t.adSlot)).toBe(true);

    const v = await workflow.verify(p.id);
    expect(v.verified).toBe(true);
  });

  it("inserta comerciales contextuales con firewall limpio", async () => {
    const workflow2 = new ProjectWorkflowService(
      store,
      REPO,
      new NormativeCatalog(REPO),
      LocalEditorialLLM.create(REPO),
      new CommercialLibraryService(path.join(dir, "commercials"))
    );
    // sembrar la biblioteca
    workflow2.commercials.seedDefaults();

    const p = await baseProject(true);
    await workflow2.research(p.id);
    await workflow2.createProposal(p.id);
    await workflow2.approve(p.id);
    const s = await workflow2.generateScript(p.id);

    const ads = s.script.turns.filter((t) => t.adSlot);
    expect(ads.length).toBeGreaterThan(0);
    // firewall: ninguna voz comercial fuera de bloque
    const fw = s.script.turns.filter((t) => t.adSlot).map((t) => ({ id: t.id, speaker: t.speaker, text: t.displayText, adSlot: true }));
    const { commercialFirewall } = await import("../commercial-service");
    expect(commercialFirewall(fw)).toHaveLength(0);
  });

  it("marca NEEDS_REVIEW si el verificador detecta un problema", async () => {
    // simulamos un script con una afirmación sin respaldo y lo verificamos
    const project = await baseProject(false);
    await workflow.research(project.id);
    await workflow.createProposal(project.id);
    await workflow.approve(project.id);
    const s = await workflow.generateScript(project.id);
    expect(s.project.state).toBe("SCRIPT_READY");
    // forzamos un turno sin claimRefs factual para probar el gate determinista
    const bad = { ...s.script, turns: s.script.turns.map((t, i) => (i === 3 ? { ...t, displayText: "La ley exige presentar la solicitud por escrito.", claimRefs: [] } : t)) };
    const { verifyScript } = await import("../factual-verifier");
    const research = store.readArtifact<import("@la-veinte/studio-contract").ResearchBundle>(project.id, "research.json")!;
    const ctx = {
      claims: research.claims,
      sources: new Map(research.documents.map((d) => [d.sourceId, d.document])),
      speakers: new Set(bad.turns.map((t) => t.speaker.toUpperCase())),
    };
    const v = verifyScript(bad, ctx);
    expect(v.issues.some((i) => i.code === "FACT_WITHOUT_EVIDENCE")).toBe(true);
  });

  it("produce desde un guion aprobado", async () => {
    const p = await baseProject(false);
    await workflow.research(p.id);
    await workflow.createProposal(p.id);
    await workflow.approve(p.id);
    await workflow.generateScript(p.id);
    const prod = await workflow.produce(p.id);
    expect(prod.state).toBe("PRODUCING");
  });
});
