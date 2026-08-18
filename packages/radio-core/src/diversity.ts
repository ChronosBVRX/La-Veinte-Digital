/**
 * DialogueDiversityAnalyzer — detector de monotonía conversacional.
 * Informa muletillas repetidas, inicios similares, intervenciones largas,
 * dominancia de un locutor y alternancia A/B/A/B demasiado perfecta.
 */

import type { EpisodeScript } from "./director";
import { stripAccents } from "./text-utils";

export interface DiversityIssue {
  tipo:
    | "muletilla"
    | "inicio_similar"
    | "intervencion_larga"
    | "dominancia"
    | "alternancia_perfecta"
    | "texto_repetido";
  severidad: "baja" | "media" | "alta";
  detalle: string;
  ocurrencias: number;
}

export interface DiversityReport {
  issues: DiversityIssue[];
  score: number; // 0-100, más alto = más diverso
  stats: {
    turnos: number;
    locutores: Record<string, number>;
    largaMaxChars: number;
    reacciones: number;
    solapes: number;
  };
}

const MULETILLAS = [
  "exactamente",
  "exacto",
  "asi es",
  "claro que si",
  "vamos con un punto concreto",
  "aqui conviene separar dos cosas",
  "por ejemplo imagina",
  "en resumen",
  "justo",
];

const INICIOS_SIMILARES = ["vamos", "aqui", "y esto", "por ejemplo", "exacto", "claro", "justo", "en resumen"];

function primerasPalabras(texto: string): string {
  const t = stripAccents(texto.toLowerCase()).replace(/[^a-z0-9ñ\s]/g, " ").trim().split(/\s+/).slice(0, 3).join(" ");
  return t.slice(0, 24);
}

export function analyzeDiversity(script: EpisodeScript): DiversityReport {
  const issues: DiversityIssue[] = [];
  const turns = script.turns;
  const locutores: Record<string, number> = {};

  for (const t of turns) {
    locutores[t.speaker] = (locutores[t.speaker] ?? 0) + 1;
  }

  // Muletillas
  const normalized = turns.map((t) => stripAccents(t.text.toLowerCase()));
  for (const muletilla of MULETILLAS) {
    const count = normalized.filter((t) => t.includes(muletilla)).length;
    if (count >= 3) {
      issues.push({
        tipo: "muletilla",
        severidad: count >= 6 ? "alta" : "media",
        detalle: `"${muletilla}" aparece ${count} veces`,
        ocurrencias: count,
      });
    }
  }

  // Inicios similares
  const inicios = new Map<string, number>();
  for (const t of turns) {
    if (t.text.trim().length < 30) continue;
    const ini = primerasPalabras(t.text);
    for (const patron of INICIOS_SIMILARES) {
      if (ini.startsWith(patron)) {
        inicios.set(patron, (inicios.get(patron) ?? 0) + 1);
        break;
      }
    }
  }
  for (const [patron, count] of inicios) {
    if (count >= 4) {
      issues.push({
        tipo: "inicio_similar",
        severidad: count >= 7 ? "media" : "baja",
        detalle: `${count} intervenciones empiezan con "${patron}…"`,
        ocurrencias: count,
      });
    }
  }

  // Intervenciones largas
  const largas = turns.filter((t) => t.text.length > 380);
  if (largas.length > 0) {
    issues.push({
      tipo: "intervencion_larga",
      severidad: largas.length > 3 ? "media" : "baja",
      detalle: `${largas.length} intervenciones superan 380 caracteres (máx ${Math.max(...largas.map((t) => t.text.length))})`,
      ocurrencias: largas.length,
    });
  }

  // Dominancia
  const total = turns.length;
  const maxShare = total > 0 ? Math.max(...Object.values(locutores)) / total : 0;
  if (maxShare > 0.6 && total >= 20) {
    issues.push({
      tipo: "dominancia",
      severidad: maxShare > 0.7 ? "alta" : "media",
      detalle: `Un locutor concentra el ${Math.round(maxShare * 100)}% de los turnos`,
      ocurrencias: 1,
    });
  }

  // Alternancia perfecta A/B/A/B
  const speakers = Object.keys(locutores);
  if (speakers.length >= 2 && total >= 16) {
    let perfectas = 0;
    for (let i = 2; i < turns.length; i++) {
      if (turns[i].speaker === turns[i - 2].speaker && turns[i].speaker !== turns[i - 1].speaker) {
        perfectas++;
      }
    }
    const ratio = perfectas / Math.max(1, turns.length - 2);
    if (ratio > 0.85) {
      issues.push({
        tipo: "alternancia_perfecta",
        severidad: "media",
        detalle: `Alternancia A/B/A/B casi perfecta (${Math.round(ratio * 100)}%) — la conversación real rompe el patrón`,
        ocurrencias: perfectas,
      });
    }
  }

  // Textos idénticos
  const seen = new Map<string, number>();
  for (const t of turns) {
    const key = stripAccents(t.text.trim().toLowerCase());
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  const repetidos = [...seen.entries()].filter(([, c]) => c >= 2);
  if (repetidos.length > 0) {
    issues.push({
      tipo: "texto_repetido",
      severidad: repetidos.some(([, c]) => c >= 3) ? "alta" : "media",
      detalle: `${repetidos.length} textos idénticos repetidos (${repetidos.map(([, c]) => c).join(", ")} veces)`,
      ocurrencias: repetidos.length,
    });
  }

  const score = Math.max(0, Math.min(100, 100 - issues.reduce((a, i) => a + (i.severidad === "alta" ? 15 : i.severidad === "media" ? 8 : 3), 0)));

  return {
    issues,
    score,
    stats: {
      turnos: total,
      locutores,
      largaMaxChars: largas.length ? Math.max(...largas.map((t) => t.text.length)) : 0,
      reacciones: turns.filter((t) => t.text.trim().length <= 30).length,
      solapes: turns.filter((t) => t.canOverlap).length,
    },
  };
}
