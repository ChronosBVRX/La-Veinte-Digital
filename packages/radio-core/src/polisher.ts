/**
 * DialoguePolisher — segunda pasada de naturalidad.
 * Modifica SOLO estilo (reacciones, pausas, ritmo, transiciones), nunca el
 * contenido factual: las líneas con citas quedan intactas. Después de pulir,
 * el llamador DEBE re-ejecutar el ScriptVerifier.
 */

import type { DialogueTurn, EpisodeScript } from "./director";
import type { DiversityReport } from "./diversity";
import { analyzeDiversity } from "./diversity";

const REACCIONES_AMPLIADAS = [
  "Exacto.",
  "Claro que sí.",
  "Mmm, ahí está el detalle.",
  "Eso mismo.",
  "Justo.",
  "Ajá, y eso es importante.",
  "Totalmente.",
  "Sí, y agrégale que no es tan simple.",
  "Buen punto.",
  "Lo que acabas de decir es clave.",
  "Ahí está la clave.",
  "Así es, sin rodeos.",
];

const TRANSICIONES = [
  "cambio de sección",
  "cambio editorial",
  "pase de tema",
  "transición suave",
];

export interface PolishResult {
  script: EpisodeScript;
  cambios: number;
  informe: DiversityReport;
  lineasFactualesIntactas: boolean;
}

function esFactual(t: DialogueTurn): boolean {
  return t.citations.length > 0;
}

export function polishDialogue(script: EpisodeScript, seed = 7): PolishResult {
  const turns = script.turns.map((t) => ({ ...t }));
  let cambios = 0;

  // PRNG determinista con semilla
  let s = seed;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };

  // 1) Reacciones repetidas: reemplazar a partir de la 3ª ocurrencia de la misma.
  const counts = new Map<string, number>();
  for (const t of turns) {
    if (esFactual(t)) continue;
    const key = t.text.trim().toLowerCase();
    const n = (counts.get(key) ?? 0) + 1;
    counts.set(key, n);
    if (n >= 3 && t.text.trim().length <= 40) {
      const otras = REACCIONES_AMPLIADAS.filter((r) => r.toLowerCase() !== key);
      t.text = otras[Math.floor(rnd() * otras.length)];
      cambios++;
    }
  }

  // 2) Romper alternancia perfecta A/B/A/B: cada ~7 turnos, el conductor
  //    encadena una aclaración breve sin cita (contenido neutro).
  const speakers = [...new Set(turns.map((t) => t.speaker))];
  const conductor = speakers[0];
  const insertos = [
    "Y subrayemos esto: no hay prisa, la información está en las fuentes del episodio.",
    "Pongámoslo así: mejor entenderlo bien desde el principio.",
    "Un momento para recordar que esto es información general, no asesoría individual.",
  ];
  const out: DialogueTurn[] = [];
  let sinceInsert = 0;
  for (const t of turns) {
    sinceInsert++;
    out.push(t);
    if (
      !esFactual(t) &&
      sinceInsert >= 7 &&
      speakers.length >= 2 &&
      conductor &&
      t.speaker !== conductor &&
      t.text.trim().length > 25
    ) {
      const turno: DialogueTurn = {
        id: `pol-${out.length}`,
        speaker: conductor,
        text: insertos[Math.floor(rnd() * insertos.length)],
        pauseBeforeMs: 120 + Math.floor(rnd() * 120),
        pauseAfterMs: 150 + Math.floor(rnd() * 120),
        energy: 3,
        pace: "normal",
        canOverlap: false,
        transition: null,
        citations: [],
      };
      out.push(turno);
      sinceInsert = 0;
      cambios++;
    }
  }

  // 3) Variar pausas casi idénticas (jitter ±30%) y energía de reacciones.
  for (const t of out) {
    if (esFactual(t)) continue;
    if (t.pauseBeforeMs > 0) {
      const j = Math.round(t.pauseBeforeMs * (0.7 + rnd() * 0.6));
      if (Math.abs(j - t.pauseBeforeMs) > 40) {
        t.pauseBeforeMs = j;
        cambios++;
      }
    }
    if (t.text.trim().length <= 40 && t.energy < 4) {
      t.energy = 4;
      cambios++;
    }
  }

  // 4) Transiciones repetidas: rotar texto.
  const seenTrans = new Map<string, number>();
  for (const t of out) {
    if (!t.transition || !/sección|cortinilla/i.test(t.transition)) continue;
    const n = (seenTrans.get(t.transition) ?? 0) + 1;
    seenTrans.set(t.transition, n);
    if (n >= 2) {
      t.transition = TRANSICIONES[Math.floor(rnd() * TRANSICIONES.length)];
      cambios++;
    }
  }

  const polished: EpisodeScript = { ...script, turns: out };
  return {
    script: polished,
    cambios,
    informe: analyzeDiversity(polished),
    lineasFactualesIntactas: script.turns.every((orig) => {
      if (!esFactual(orig)) return true;
      const nuevo = polished.turns.find((x) => x.id === orig.id);
      return !!nuevo && nuevo.text === orig.text && nuevo.citations.length === orig.citations.length;
    }),
  };
}
