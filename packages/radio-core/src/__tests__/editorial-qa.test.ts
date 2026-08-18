import { describe, expect, it } from "vitest";
import { auditEditorialScript, DEFAULT_SPEAKERS, sanitizeEditorialScript, type EpisodeScript } from "@la-veinte/radio-core";

function turn(i: number, text: string, extra: Partial<EpisodeScript["turns"][number]> = {}): EpisodeScript["turns"][number] {
  return {
    id: `t${String(i).padStart(3, "0")}`,
    speaker: i % 2 === 0 ? "ANDREA" : "EDUARDO",
    text,
    pauseBeforeMs: 520,
    pauseAfterMs: 480,
    energy: 3,
    pace: "normal",
    canOverlap: false,
    transition: null,
    citations: [],
    ...extra,
  };
}

function makeScript(): EpisodeScript {
  const turns = [
    turn(1, "Hoy vamos a hablar de tiempo extraordinario en el IMSS."),
    turn(2, "Primero, qué cuenta como tiempo extra."),
    turn(3, "Nos vemos en el próximo segmento."),
    turn(4, "Bueno, la ley aplica también a pilotos de avión y tripulantes de vuelo."),
    turn(5, "El pago debe revisarse en el recibo."),
    turn(6, "La orden debe ser clara y por escrito."),
    turn(7, "Si tu relevo no llegó, hay que revisar cómo quedó registrada la jornada."),
    turn(8, "Otra duda frecuente es si se compensa con descanso."),
    turn(9, "Lo importante es revisar el documento y pedir orientación."),
    turn(10, "Ahora vamos con un caso práctico."),
    turn(11, "Imagina que trabajaste después de tu salida."),
    turn(12, "La pregunta es cómo se registró ese tiempo."),
    turn(13, "El recibo debe cuadrar con lo trabajado."),
    turn(14, "Si no cuadra, pide revisión."),
    turn(15, "Cerramos con pasos concretos.", { transition: null }),
  ];
  return {
    tema: "Tiempo extraordinario en el IMSS",
    formato: "magazine informativo",
    nivel: "natural",
    modoCita: "natural",
    speakers: DEFAULT_SPEAKERS,
    scenes: [{ id: "s1", titulo: "Programa", turns }],
    turns,
    cutoff: "2026-08-14",
    fuentes: [],
    estimacionDurSec: 300,
  };
}

describe("editorial QA", () => {
  it("detecta problemas editoriales antes de producir audio", () => {
    const qa = auditEditorialScript(makeScript());
    expect(qa.issues.some((i) => i.tipo === "pausas_excesivas")).toBe(true);
    expect(qa.issues.some((i) => i.tipo === "cierre_prematuro")).toBe(true);
    expect(qa.issues.some((i) => i.tipo === "tema_desviado")).toBe(true);
  });

  it("sanea cierres prematuros, temas desviados y pausas largas", () => {
    const result = sanitizeEditorialScript(makeScript());
    expect(result.cambios).toBeGreaterThan(0);
    expect(result.script.turns.some((t) => /pilotos|avion|vuelo/i.test(t.text))).toBe(false);
    expect(result.script.turns.slice(0, -5).some((t) => /nos vemos/i.test(t.text))).toBe(false);
    expect(result.script.turns.every((t) => t.pauseBeforeMs <= 260 && t.pauseAfterMs <= 360)).toBe(true);
  });

  it("convierte cortinillas internas en cambios editoriales silenciosos", () => {
    const script = makeScript();
    script.turns[8] = { ...script.turns[8], transition: "cortinilla de sección" };
    const result = sanitizeEditorialScript(script);
    expect(result.script.turns.some((t, i) => i > 1 && i < result.script.turns.length - 2 && /cortinilla/i.test(t.transition ?? ""))).toBe(false);
    expect(result.script.turns.some((t) => t.transition === "cambio editorial")).toBe(true);
  });
});
