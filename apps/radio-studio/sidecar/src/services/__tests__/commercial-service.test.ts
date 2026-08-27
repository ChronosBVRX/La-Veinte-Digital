import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { CommercialLibraryService, commercialFirewall, safeBridge, planCommercialPlacements, validateCommercialFirewallPass } from "../commercial-service";
import type { Commercial, CommercialSelection } from "@la-veinte/studio-contract";

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "lv-com-"));

}

let dir: string;
let svc: CommercialLibraryService;

beforeEach(() => { dir = tmp(); svc = new CommercialLibraryService(dir); });
afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

function makeCommercial(): Commercial {
  return svc.create({
    name: "Comercial A", type: "COMMERCIAL", baseText: "Este espacio es de nuestro patrocinador.", targetDuration: 20, presenter: "VALERIA", tags: [], version: 1,
  });
}

describe("commercial library", () => {
  it("crea, lista y actualiza", () => {
    const c = makeCommercial();
    expect(svc.list({ onlyActive: true })).toHaveLength(1);
    svc.setActive(c.id, false);
    expect(svc.list({ onlyActive: true })).toHaveLength(0);
    const archived = svc.archive(c.id);
    expect(archived?.state).toBe("archived");
    expect(svc.list()).toHaveLength(0);
  });

  it("siembra defaults solo si está vacía", () => {
    const a = svc.seedDefaults();
    expect(a.added).toBe(2);
    const b = svc.seedDefaults();
    expect(b.added).toBe(0);
  });
});

describe("commercial firewall", () => {
  it("bloquea voz comercial fuera de bloque comercial", () => {
    const v = commercialFirewall([{ id: "t1", speaker: "VALERIA", text: "Hola, esto es un tema importante." }]);
    expect(v.length).toBeGreaterThan(0);
  });

  it("bloquea contenido jurídico en voz comercial", () => {
    const v = commercialFirewall([{ id: "t1", speaker: "VALERIA", text: "Recuerda que el plazo es de 30 días según el artículo 47.", adSlot: true }]);
    expect(v.some((x) => x.regla === "VALERIA_CONTENIDO_JURIDICO")).toBe(true);
  });

  it("permite comercial puro", () => {
    const rows = [{ id: "t1", speaker: "VALERIA", text: "Gracias por acompañarnos, patrocinador La Veinte.", adSlot: true }];
    expect(validateCommercialFirewallPass(rows)).toBe(true);
  });
});

describe("commercial bridge", () => {
  it("genera un bridge determinista seguro", () => {
    const c = makeCommercial();
    const b = safeBridge({ commercialId: c.id, topicBefore: "x", topicAfter: "y", speakerBefore: "A", speakerAfter: "B", interactionMode: "natural", placementReason: "" }, c);
    expect(b.bridgeIn).toBeTruthy();
    expect(b.bridgeOut).toBeTruthy();
    expect(b.firewallPassed).toBe(true);
    expect(commercialFirewall([{ id: "b", speaker: "VALERIA", text: b.commercialText ?? "", adSlot: true }])).toHaveLength(0);
  });
});

describe("planCommercialPlacements", () => {
  it("no coloca si está desactivado o sin ids", () => {
    const sel: CommercialSelection = { enabled: false, ids: [], allowDirectorChoice: true, count: "auto", ubicacion: "auto", interaccion: "natural", duracionSec: 30 };
    const turns = Array.from({ length: 20 }, (_, i) => ({ id: `t${i}`, speaker: "E", text: `línea ${i}` }));
    expect(planCommercialPlacements(turns, sel, [makeCommercial()])).toHaveLength(0);
  });

  it("coloca comerciales en transiciones naturales", () => {
    const c = makeCommercial();
    const sel: CommercialSelection = { enabled: true, ids: [c.id], allowDirectorChoice: false, count: "1", ubicacion: "auto", interaccion: "natural", duracionSec: 20 };
    const turns = Array.from({ length: 24 }, (_, i) => ({ id: `t${i}`, speaker: "E", text: `línea ${i}`, transition: i === 12 ? "cambio editorial" : null }));
    const placements = planCommercialPlacements(turns, sel, [c]);
    expect(placements.length).toBe(1);
    expect(placements[0].atIndex).toBe(12);
  });
});
