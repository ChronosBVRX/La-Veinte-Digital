import { describe, it, expect } from "vitest";
import {
  classifyTurnRelation,
  applyConversationalProsody,
  calculatePauseDistribution,
  type TurnRelation,
} from "../prosody-director";
import { auditDialogueContinuity } from "../dialogue-auditor";
import { parseScript } from "../script-parser";
import type { Turn, Script } from "@la-veinte/studio-contract";

describe("ProsodyDirector & DialogueAuditor", () => {
  it("clasifica correctamente relaciones conversacionales típicas", () => {
    const tQuestion: Turn = {
      id: "t1",
      speaker: "ANDREA",
      displayText: "¿Ya estamos grabando?",
      ttsText: "¿Ya estamos grabando?",
      canOverlap: false,
      claimRefs: [],
      sourceRefs: [],
      productionEvents: [],
      authorPause: false,
      adSlot: false,
    };

    const tAnswer: Turn = {
      id: "t2",
      speaker: "EDUARDO",
      displayText: "Según yo, sí.",
      ttsText: "Según yo, sí.",
      canOverlap: false,
      claimRefs: [],
      sourceRefs: [],
      productionEvents: [],
      authorPause: false,
      adSlot: false,
    };

    const tInterrupt: Turn = {
      id: "t3",
      speaker: "ANDREA",
      displayText: "No.",
      ttsText: "No.",
      canOverlap: true,
      claimRefs: [],
      sourceRefs: [],
      productionEvents: [],
      authorPause: false,
      adSlot: false,
    };

    const tAgreement: Turn = {
      id: "t4",
      speaker: "EDUARDO",
      displayText: "Exactamente, ese es el punto.",
      ttsText: "Exactamente, ese es el punto.",
      canOverlap: false,
      claimRefs: [],
      sourceRefs: [],
      productionEvents: [],
      authorPause: false,
      adSlot: false,
    };

    const tPunchline: Turn = {
      id: "t5",
      speaker: "RODRIGO",
      displayText: "Por favor, alguien apáguele el micrófono.",
      ttsText: "Por favor, alguien apáguele el micrófono.",
      canOverlap: false,
      claimRefs: [],
      sourceRefs: [],
      productionEvents: [],
      authorPause: false,
      adSlot: false,
    };

    const tTransition: Turn = {
      id: "t0",
      speaker: "EDUARDO",
      displayText: "Bienvenidos al programa.",
      ttsText: "Bienvenidos al programa.",
      transition: "música de apertura",
      canOverlap: false,
      claimRefs: [],
      sourceRefs: [],
      productionEvents: [{ type: "music", position: "before", label: "música de apertura" }],
      authorPause: false,
      adSlot: false,
    };

    expect(classifyTurnRelation(tTransition, null, 0, 6)).toBe("section_transition");
    expect(classifyTurnRelation(tQuestion, tTransition, 1, 6)).toBe("question");
    expect(classifyTurnRelation(tAnswer, tQuestion, 2, 6)).toBe("answer");
    expect(classifyTurnRelation(tInterrupt, tAnswer, 3, 6)).toBe("interrupt");
    expect(classifyTurnRelation(tAgreement, tInterrupt, 4, 6)).toBe("agreement");
    expect(classifyTurnRelation(tPunchline, tAgreement, 5, 6)).toBe("punchline");
  });

  it("preserva estrictamente las pausas explícitas del autor", () => {
    const raw = `
**ANDREA:** ¿Ya inauguramos oficialmente La Veinte Radio?
**EDUARDO:** [PAUSA: 600 ms] Creo que sí.
**JAVIER:** [PAUSA: 800 ms] Técnicamente sí.
`;
    const script = parseScript(raw);
    const directed = applyConversationalProsody(script.turns);

    expect(directed[1].authorPause).toBe(true);
    expect(directed[1].pauseBeforeMs).toBe(600);

    expect(directed[2].authorPause).toBe(true);
    expect(directed[2].pauseBeforeMs).toBe(800);
  });

  it("calcula distribución de pausas con estadísticas no uniformes", () => {
    const turns: Turn[] = [
      { id: "1", speaker: "A", displayText: "r1", pauseBeforeMs: 120, canOverlap: false, claimRefs: [], sourceRefs: [], productionEvents: [], authorPause: false, adSlot: false },
      { id: "2", speaker: "B", displayText: "r2", pauseBeforeMs: 150, canOverlap: false, claimRefs: [], sourceRefs: [], productionEvents: [], authorPause: false, adSlot: false },
      { id: "3", speaker: "A", displayText: "c1", pauseBeforeMs: 300, canOverlap: false, claimRefs: [], sourceRefs: [], productionEvents: [], authorPause: false, adSlot: false },
      { id: "4", speaker: "B", displayText: "c2", pauseBeforeMs: 350, canOverlap: false, claimRefs: [], sourceRefs: [], productionEvents: [], authorPause: false, adSlot: false },
      { id: "5", speaker: "A", displayText: "c3", pauseBeforeMs: 400, canOverlap: false, claimRefs: [], sourceRefs: [], productionEvents: [], authorPause: false, adSlot: false },
      { id: "6", speaker: "B", displayText: "ref1", pauseBeforeMs: 650, canOverlap: false, claimRefs: [], sourceRefs: [], productionEvents: [], authorPause: false, adSlot: false },
      { id: "7", speaker: "A", displayText: "ref2", pauseBeforeMs: 700, canOverlap: false, claimRefs: [], sourceRefs: [], productionEvents: [], authorPause: false, adSlot: false },
      { id: "8", speaker: "B", displayText: "trans", pauseBeforeMs: 1100, canOverlap: false, claimRefs: [], sourceRefs: [], productionEvents: [], authorPause: false, adSlot: false },
    ];

    const stats = calculatePauseDistribution(turns);
    expect(stats.totalPauses).toBe(8);
    expect(stats.minMs).toBe(120);
    expect(stats.maxMs).toBe(1100);
    expect(stats.under200MsPct).toBe(25); // 2 de 8
    expect(stats.between200And450MsPct).toBe(37.5); // 3 de 8
    expect(stats.between450And800MsPct).toBe(25); // 2 de 8
    expect(stats.over800MsPct).toBe(12.5); // 1 de 8
  });

  it("DialogueAuditor detecta saludos a mitad de programa y calcula el Rhythm Score", () => {
    // Generar guion simulado de 15 turnos con un saludo indebido en turno 10
    const turns: Turn[] = Array.from({ length: 15 }, (_, i) => ({
      id: `t${i + 1}`,
      speaker: i % 2 === 0 ? "EDUARDO" : "ANDREA",
      displayText: i === 9 ? "Hola a todos de nuevo, bienvenidos al programa." : `Esta es una frase conversacional número ${i} que tiene varias palabras.`,
      ttsText: i === 9 ? "Hola a todos de nuevo, bienvenidos al programa." : `Esta es una frase conversacional número ${i} que tiene varias palabras.`,
      pauseBeforeMs: 150 + (i * 50) % 700,
      canOverlap: false,
      claimRefs: [],
      sourceRefs: [],
      productionEvents: [],
      authorPause: false,
      adSlot: false,
    }));

    const script: Script = {
      topic: "Prueba de Auditoría",
      formato: "EXPLICADOR",
      nivel: "natural",
      speakers: [],
      scenes: [],
      turns,
      estimacionDurSec: 120,
    };

    const report = auditDialogueContinuity(script);
    expect(report.metrics.totalTurns).toBe(15);
    expect(report.metrics.midEpisodeGreetingsCount).toBe(1);
    expect(report.warnings.some((w) => w.includes("Saludo o bienvenida"))).toBe(true);
    expect(report.score).toBeLessThan(100);
  });
});
