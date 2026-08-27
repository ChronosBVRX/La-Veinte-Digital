import { describe, it, expect } from "vitest";
import { verifyScript, type VerifierContext } from "../factual-verifier";
import type { Script } from "@la-veinte/studio-contract";

function ctx(): VerifierContext {
  return {
    claims: [
      {
        id: "C001",
        statement: "La solicitud debe presentarse por escrito.",
        locator: "pasos 1-4",
        evidence: [{ sourceId: "src_008", document: "1A74-003-032", excerpt: "La solicitud deberá presentarse por escrito.", clause: "pasos 1-4" }],
      },
      {
        id: "C002",
        statement: "El plazo es de 30 días naturales.",
        locator: "30 días",
        evidence: [{ sourceId: "src_008", document: "1A74-003-032", excerpt: "El trabajador dispone de 30 días naturales para presentar la solicitud." }],
      },
    ],
    sources: new Map([["src_008", "1A74-003-032"]]),
    speakers: new Set(["EDUARDO", "ANDREA", "JAVIER"]),
  };
}

function script(turns: Array<Partial<import("@la-veinte/studio-contract").Turn> & { id: string; speaker: string; displayText: string }>): Script {
  return {
    topic: "t", formato: "CASO_PRACTICO", nivel: "natural", speakers: [], scenes: [],
    turns: turns.map((t) => ({ id: t.id, speaker: t.speaker, displayText: t.displayText, claimRefs: t.claimRefs ?? [], sourceRefs: t.sourceRefs ?? [], adSlot: false, canOverlap: false })),
    estimacionDurSec: 0,
  };
}

describe("factual verifier", () => {
  it("pasa un guion bien anclado", () => {
    const s = script([
      { id: "t1", speaker: "JAVIER", displayText: "El procedimiento establece que la solicitud debe hacerse por escrito.", claimRefs: ["C001"] },
      { id: "t2", speaker: "ANDREA", displayText: "A ver, ahí tengo una duda.", claimRefs: [] },
    ]);
    const r = verifyScript(s, ctx());
    expect(r.verified).toBe(true);
  });

  it("marca afirmación factual sin claimRefs", () => {
    const s = script([{ id: "t1", speaker: "JAVIER", displayText: "La ley exige que la solicitud se presente por escrito.", claimRefs: [] }]);
    const r = verifyScript(s, ctx());
    expect(r.verified).toBe(false);
    expect(r.issues.some((i) => i.code === "FACT_WITHOUT_EVIDENCE")).toBe(true);
  });

  it("marca claimRef inexistente", () => {
    const s = script([{ id: "t1", speaker: "JAVIER", displayText: "La solicitud debe presentarse por escrito.", claimRefs: ["C999"] }]);
    const r = verifyScript(s, ctx());
    expect(r.verified).toBe(false);
    expect(r.issues.some((i) => i.code === "CLAIM_REF_MISSING")).toBe(true);
  });

  it("marca valor numérico sin respaldo en el ledger", () => {
    const s = script([{ id: "t1", speaker: "JAVIER", displayText: "El trámite tarda 17 días.", claimRefs: ["C001"] }]);
    const r = verifyScript(s, ctx());
    expect(r.issues.some((i) => i.code === "UNSUPPORTED_NUMERIC_CLAIM")).toBe(true);
  });

  it("NO marca un número que sí está en el ledger", () => {
    const s = script([{ id: "t1", speaker: "JAVIER", displayText: "El plazo es de 30 días naturales.", claimRefs: ["C002"] }]);
    const r = verifyScript(s, ctx());
    expect(r.issues.some((i) => i.code === "UNSUPPORTED_NUMERIC_CLAIM")).toBe(false);
  });

  it("marca fuente inventada", () => {
    const s = script([
      { id: "t1", speaker: "JAVIER", displayText: "La solicitud debe presentarse por escrito.", claimRefs: ["C001"], sourceRefs: [{ sourceId: "src_fake", document: "X" }] },
    ]);
    const r = verifyScript(s, ctx());
    expect(r.issues.some((i) => i.code === "INVENTED_SOURCE")).toBe(true);
  });

  it("marca locutor fuera del reparto", () => {
    const s = script([{ id: "t1", speaker: "ERNESTO", displayText: "La solicitud debe presentarse por escrito.", claimRefs: ["C001"] }]);
    const r = verifyScript(s, ctx());
    expect(r.issues.some((i) => i.code === "INVALID_SPEAKER")).toBe(true);
  });

  it("la conversación pura no se marca", () => {
    const s = script([
      { id: "t1", speaker: "ANDREA", displayText: "¿Y eso aplica también si me lo dicen en la oficina?" },
      { id: "t2", speaker: "EDUARDO", displayText: "Una cosa es la regla escrita y otra lo que te cuenten en el pasillo." },
    ]);
    const r = verifyScript(s, ctx());
    expect(r.verified).toBe(true);
  });
});
