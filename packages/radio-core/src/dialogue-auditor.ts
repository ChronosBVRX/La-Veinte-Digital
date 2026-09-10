/**
 * dialogue-auditor.ts — Auditor de continuidad conversacional y ritmo para AI Radio Studio.
 *
 * Evalúa la naturalidad del diálogo antes de pasar a la etapa de síntesis:
 * - Ausencia de saludos extemporáneos a mitad de programa.
 * - Ausencia de muletillas repetidas 3 veces seguidas.
 * - Desviación estándar y variedad de longitud de turnos.
 * - Distribución de pausas.
 * - Conversation Rhythm Score (0-100).
 */

import type { Script, Turn } from "@la-veinte/studio-contract";
import { calculatePauseDistribution, type PauseDistributionStats } from "./prosody-director";

export interface DialogueAuditReport {
  score: number;
  warnings: string[];
  passed: boolean;
  metrics: {
    totalTurns: number;
    wordCountStdDev: number;
    meanWordsPerTurn: number;
    minWordsPerTurn: number;
    maxWordsPerTurn: number;
    turnLengthDistribution: {
      microTurnsPct: number; // <= 4 palabras (reacciones)
      shortTurnsPct: number; // 5-15 palabras
      mediumTurnsPct: number; // 16-35 palabras
      longTurnsPct: number; // > 35 palabras
    };
    pauseDistribution: PauseDistributionStats;
    repeatedOpenersCount: number;
    midEpisodeGreetingsCount: number;
    preservedAuthorPausesCount: number;
  };
}

const GREETING_REGEX = /\b(bienvenidos?|bienvenidas?|buenos d[ií]as|buenas tardes|hola a todos|un saludo|empezamos el programa)\b/i;

/**
 * Normaliza las primeras dos palabras de una frase para detectar muletillas recurrentes.
 */
function extractOpener(text: string): string {
  const words = text
    .toLowerCase()
    .replace(/^[^a-záéíóúüñ]+/i, "")
    .split(/\s+/)
    .slice(0, 2);
  return words.join(" ");
}

/**
 * Audita la continuidad conversacional y el ritmo de un guion.
 */
export function auditDialogueContinuity(script: Script): DialogueAuditReport {
  const turns = script.turns || [];
  const warnings: string[] = [];

  if (turns.length === 0) {
    return {
      score: 0,
      warnings: ["El guion no contiene ningún turno de diálogo."],
      passed: false,
      metrics: {
        totalTurns: 0,
        wordCountStdDev: 0,
        meanWordsPerTurn: 0,
        minWordsPerTurn: 0,
        maxWordsPerTurn: 0,
        turnLengthDistribution: {
          microTurnsPct: 0,
          shortTurnsPct: 0,
          mediumTurnsPct: 0,
          longTurnsPct: 0,
        },
        pauseDistribution: calculatePauseDistribution([]),
        repeatedOpenersCount: 0,
        midEpisodeGreetingsCount: 0,
        preservedAuthorPausesCount: 0,
      },
    };
  }

  // 1. Análisis de longitud de turnos (en palabras)
  const wordCounts: number[] = turns.map((t) => {
    const txt = (t.ttsText || t.displayText || "").trim();
    return txt ? txt.split(/\s+/).filter(Boolean).length : 0;
  });

  const totalWords = wordCounts.reduce((a, b) => a + b, 0);
  const meanWords = totalWords / turns.length;
  const variance = wordCounts.reduce((acc, w) => acc + Math.pow(w - meanWords, 2), 0) / turns.length;
  const wordCountStdDev = Number(Math.sqrt(variance).toFixed(2));
  const minWords = Math.min(...wordCounts);
  const maxWords = Math.max(...wordCounts);

  const microTurns = wordCounts.filter((w) => w <= 4).length;
  const shortTurns = wordCounts.filter((w) => w > 4 && w <= 15).length;
  const mediumTurns = wordCounts.filter((w) => w > 15 && w <= 35).length;
  const longTurns = wordCounts.filter((w) => w > 35).length;

  // 2. Detección de saludos a mitad de programa (después del turno 8)
  let midEpisodeGreetings = 0;
  for (let i = 8; i < turns.length; i++) {
    const text = turns[i].ttsText || turns[i].displayText || "";
    if (GREETING_REGEX.test(text)) {
      midEpisodeGreetings++;
      warnings.push(`Turno ${i + 1} (${turns[i].speaker}): Saludo o bienvenida a mitad del episodio ("${text.slice(0, 45)}...")`);
    }
  }

  // 3. Detección de muletillas repetidas 3 veces seguidas
  let repeatedOpenersCount = 0;
  for (let i = 2; i < turns.length; i++) {
    const op1 = extractOpener(turns[i - 2].ttsText || "");
    const op2 = extractOpener(turns[i - 1].ttsText || "");
    const op3 = extractOpener(turns[i].ttsText || "");

    if (op1 && op1 === op2 && op2 === op3 && op1.length > 3) {
      repeatedOpenersCount++;
      warnings.push(`Turnos ${i - 1}-${i + 1}: Repetición consecutiva de la misma apertura ("${op1}")`);
    }
  }

  // 4. Conteo de acotaciones de autor preservadas
  const preservedAuthorPauses = turns.filter((t) => t.authorPause).length;

  // 5. Distribución de pausas
  const pauseStats = calculatePauseDistribution(turns);

  // 6. Cálculo del Conversation Rhythm Score (0 - 100)
  let score = 100;

  // Penalización por baja variación de longitud (monotonía estilo lectura)
  if (wordCountStdDev < 5) {
    score -= 15;
    warnings.push("La longitud de los turnos es excesivamente uniforme (baja variabilidad conversacional).");
  } else if (wordCountStdDev >= 8) {
    score += 5; // Premio por excelente dinámica de longitudes
  }

  // Verificar presencia de micro-reacciones (ojalá, exacto, claro, etc.)
  if (microTurns / turns.length < 0.08) {
    score -= 10;
    warnings.push("Faltan micro-reacciones e interjecciones rápidas (< 8% de turnos de 1-4 palabras).");
  }

  // Verificar distribución de pausas (evitar el mono-bloque de 300-350ms)
  if (pauseStats.under200MsPct < 5) {
    score -= 10;
    warnings.push("Menos del 5% de pausas rápidas (< 200 ms). Falta inmediatez en respuestas.");
  }
  if (pauseStats.over800MsPct < 3) {
    score -= 8;
    warnings.push("Menos del 3% de pausas estructurales o reflexivas (> 800 ms). Falta aire en transiciones.");
  }

  // Penalización por saludos desubicados
  score -= midEpisodeGreetings * 15;

  // Penalización por muletillas seguidas
  score -= repeatedOpenersCount * 10;

  // Clampeo a rango 0-100
  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    score,
    warnings,
    passed: score >= 60,
    metrics: {
      totalTurns: turns.length,
      wordCountStdDev,
      meanWordsPerTurn: Number(meanWords.toFixed(1)),
      minWordsPerTurn: minWords,
      maxWordsPerTurn: maxWords,
      turnLengthDistribution: {
        microTurnsPct: Number(((microTurns / turns.length) * 100).toFixed(1)),
        shortTurnsPct: Number(((shortTurns / turns.length) * 100).toFixed(1)),
        mediumTurnsPct: Number(((mediumTurns / turns.length) * 100).toFixed(1)),
        longTurnsPct: Number(((longTurns / turns.length) * 100).toFixed(1)),
      },
      pauseDistribution: pauseStats,
      repeatedOpenersCount,
      midEpisodeGreetingsCount: midEpisodeGreetings,
      preservedAuthorPausesCount: preservedAuthorPauses,
    },
  };
}
