import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ProjectStore } from "../project-store";
import { autoFormat, autoCast, evaluateProposalQuality } from "../project-workflow";
import type { Project, Proposal, ResearchBundle } from "@la-veinte/studio-contract";

let dir: string;
let store: ProjectStore;

beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), "lv-store-")); store = new ProjectStore(dir); });
afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

describe("ProjectStore", () => {
  it("crea y persiste un proyecto", () => {
    const p = store.create({ topic: "Cambio de horario", config: { duracionMin: 15, profundidad: "estandar", nivel: "natural", contextoExtra: "", modo: "ia", comerciales: { enabled: false, ids: [], allowDirectorChoice: true, count: "auto", ubicacion: "auto", interaccion: "natural", duracionSec: 30 } } });
    expect(p.state).toBe("DRAFT");
    expect(store.get(p.id)?.topic).toBe("Cambio de horario");
    expect(store.has(p.id)).toBe(true);
    // re-leer desde disco nuevo (persistencia)
    const store2 = new ProjectStore(dir);
    expect(store2.get(p.id)?.id).toBe(p.id);
  });

  it("actualiza estado y escribe artefactos", () => {
    const p = store.create({ topic: "Vacaciones" });
    store.updateState(p.id, "RESEARCHED");
    store.writeResearch(p.id, { topic: "Vacaciones", queryExpansion: [], cutoff: "x", evidence: [], claims: [], coverage: { percentage: 100, recommended: true, items: [], known: [], missing: [], strong: [], partial: [], unanswered: [], warnings: [], confirmed: 1, withoutSupport: 0 }, documents: [], discarded: [], createdAt: new Date().toISOString() });
    const updated = store.get(p.id);
    expect(updated?.state).toBe("RESEARCHED");
    expect(store.readClaims(p.id)).not.toBeNull();
  });

  it("lista ordenado por actualización descendente", async () => {
    const a = store.create({ topic: "A" });
    await new Promise((r) => setTimeout(r, 8));
    const b = store.create({ topic: "B" });
    const list = store.list();
    expect(list[0].id).toBe(b.id);
    expect(list.length).toBe(2);
    void a;
  });

  it("registra eventos y trunca el log", () => {
    const p = store.create({ topic: "Eventos" });
    store.logEvent(p.id, { type: "research.started" });
    store.logEvent(p.id, { type: "research.completed" });
    const logs = store.readArtifact(p.id, "logs.json") as Array<{ type: string }>;
    expect(logs.length).toBe(2);
    expect(logs[1].type).toBe("research.completed");
  });

  it("borra proyectos", () => {
    const p = store.create({ topic: "Borrar" });
    store.delete(p.id);
    expect(store.has(p.id)).toBe(false);
  });
});

describe("autoFormat", () => {
  it("mapea temas a formatos", () => {
    expect(autoFormat("¿Cómo solicito vacaciones?")).toBe("GUIA_PASO_A_PASO");
    expect(autoFormat("¿Me pueden cambiar el horario?")).toBe("CASO_PRACTICO");
    expect(autoFormat("¿Qué cambió en el CCT?")).toBe("EXPLICADOR");
    expect(autoFormat("Accidente de trabajo")).toBe("CONSULTORIO");
  });
});

describe("autoCast", () => {
  it("incluye al especialista normativo cuando hay claims legales", () => {
    const ids = autoCast("horario", true, false);
    expect(ids).toContain("EDUARDO");
    expect(ids).toContain("ANDREA");
    expect(ids).toContain("NARRADOR");
    expect(ids).not.toContain("VALERIA");
  });

  it("añade a Valeria con comerciales y Rodrigo en campo", () => {
    const ids = autoCast("horario en hospital", true, true);
    expect(ids).toContain("VALERIA");
    expect(ids).toContain("RODRIGO");
  });
});

describe("evaluateProposalQuality", () => {
  it("rechaza propuestas genéricas", () => {
    const research = {
      topic: "Cambio de horario", queryExpansion: [], cutoff: "x", evidence: [], claims: [],
      coverage: { percentage: 100, recommended: true, items: [], known: [], missing: [], strong: [], partial: [], unanswered: [], warnings: [], confirmed: 1, withoutSupport: 0 },
      documents: [], discarded: [], createdAt: new Date().toISOString(),
    } as ResearchBundle;
    const genericProposal = {
      enfoque: "Explicar qué dice la normativa, cómo se aplica y qué revisar.",
      estructura: [{ seccion: "A", proposito: "P" }],
      participantes: [{ id: "EDUARDO", nombre: "Eduardo", rol: "conductor", funcionEditorial: null, voz: "A", participa: true }],
    };
    const res = evaluateProposalQuality("Cambio de horario", genericProposal as Partial<Proposal>, research);
    expect(res.valid).toBe(false);
    expect(res.issues.length).toBeGreaterThanOrEqual(1);
  });

  it("exige marcas de inclusión y vencimiento en vacaciones", () => {
    const research = {
      topic: "Vacaciones inclusión y vencimiento", queryExpansion: [], cutoff: "x", evidence: [], claims: [],
      coverage: { percentage: 100, recommended: true, items: [], known: [], missing: [], strong: [], partial: [], unanswered: [], warnings: [], confirmed: 1, withoutSupport: 0 },
      documents: [], discarded: [], createdAt: new Date().toISOString(),
    } as ResearchBundle;
    const partialProposal = {
      enfoque: "Análisis sobre los periodos vacacionales del personal y cómo programarlos.",
      estructura: [
        { seccion: "Apertura", proposito: "Inicio" },
        { seccion: "Desarrollo", proposito: "Reglas" },
        { seccion: "Cierre", proposito: "Fin" },
      ],
      participantes: [
        { id: "EDUARDO", nombre: "Eduardo", rol: "conductor", funcionEditorial: null, voz: "A", participa: true },
        { id: "ANDREA", nombre: "Andrea", rol: "conductora", funcionEditorial: null, voz: "B", participa: true },
      ],
    };
    const res = evaluateProposalQuality("Vacaciones con inclusión y fechas de vencimiento", partialProposal as Partial<Proposal>, research);
    expect(res.valid).toBe(false);
    expect(res.issues.some((i) => i.includes("inclusión"))).toBe(true);
    expect(res.issues.some((i) => i.includes("vencimiento"))).toBe(true);
  });
});
