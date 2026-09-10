/**
 * prosody-director.ts — Dirección conversacional y de prosodia para AI Radio Studio.
 *
 * Clasifica la relación de cada turno respecto al anterior y asigna pausas con
 * cadencia conversacional dinámica (~20% < 200ms, ~50% 200-450ms, ~20% 450-800ms, ~10% > 800ms),
 * evitando el efecto uniforme de "ping-pong" y preservando estrictamente las pausas del autor.
 */

import type { Turn, Script } from "@la-veinte/studio-contract";

export type TurnRelation =
  | "answer"
  | "question"
  | "reaction"
  | "interrupt"
  | "agreement"
  | "disagreement"
  | "follow_up"
  | "punchline"
  | "clarification"
  | "new_topic"
  | "section_transition";

export interface ProsodyTimingConfig {
  minMs: number;
  maxMs: number;
  postPauseMs?: number;
  canOverlap?: boolean;
}

export const RELATION_TIMINGS: Record<TurnRelation, ProsodyTimingConfig> = {
  interrupt: { minMs: 60, maxMs: 140, canOverlap: true },
  reaction: { minMs: 100, maxMs: 180, canOverlap: false },
  answer: { minMs: 150, maxMs: 250, canOverlap: false },
  agreement: { minMs: 180, maxMs: 300, canOverlap: false },
  disagreement: { minMs: 180, maxMs: 300, canOverlap: false },
  question: { minMs: 200, maxMs: 350, canOverlap: false },
  follow_up: { minMs: 220, maxMs: 380, canOverlap: false },
  clarification: { minMs: 350, maxMs: 500, canOverlap: false },
  punchline: { minMs: 300, maxMs: 450, postPauseMs: 0, canOverlap: false },
  new_topic: { minMs: 500, maxMs: 800, canOverlap: false },
  section_transition: { minMs: 800, maxMs: 1200, canOverlap: false },
};

const AGREEMENT_STARTERS = /^(exactamente|exacto|así es|asi es|tal cual|de acuerdo|totalmente|claro|por supuesto|justo|eso mismo|efectivamente)/i;
const DISAGREEMENT_STARTERS = /^(pero|espérate|esperate|no|tampoco|ojo|cuidado|no necesariamente|a ver, no|sin embargo|depende)/i;
const REACTION_PHRASES = /^(ojalá|exacto|claro|totalmente|así es|ya veo|entiendo|no|sí|si|ajá|vaya|bueno|qué tal|imagínate)/i;
const NEW_TOPIC_STARTERS = /^(¿y de qué|y de qué|ahora bien|por cierto|cambiando de tema|pasando a|otro punto|hay otra cosa|sobre el siguiente)/i;
const PUNCHLINE_INDICATORS = /(mira qué bueno que esto no es en vivo|apáguele el micrófono|déjalo, déjalo|primera corrección|gracias javier|nos vemos la próxima|se emocionó|cuarenta y ocho|técnicamente|cincuenta pdfs)/i;
const SNAPPY_REPLIES = /^(sí\.|si\.|no\.|ah\.|¿qué\?|que\?|javier\.|claro\.|cierto\.|obvio\.)/i;

/**
 * Función pseudo-aleatoria determinista basada en seed.
 */
function seededRand(seed: number, min: number, max: number): number {
  const x = Math.sin(seed) * 10000;
  const f = x - Math.floor(x);
  return Math.round(min + f * (max - min));
}

function deriveSeed(turnId: string, text: string, index: number): number {
  let hash = index * 31 + 7;
  const str = `${turnId}:${text.slice(0, 30)}`;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 100000;
}

/**
 * Clasifica la relación de un turno con respecto al turno previo y al contexto del guion.
 */
export function classifyTurnRelation(
  turn: Turn,
  prevTurn: Turn | null,
  turnIndex: number,
  totalTurns: number
): TurnRelation {
  const text = (turn.ttsText || turn.displayText || "").trim();
  const prevText = prevTurn ? (prevTurn.ttsText || prevTurn.displayText || "").trim() : "";
  const sameSpeaker = prevTurn ? prevTurn.speaker === turn.speaker : false;

  // 1. Transición de sección o cortinilla explícita
  if (
    turn.transition ||
    (turn.productionEvents &&
      turn.productionEvents.some((e) => e.type === "music" || e.type === "sfx")) ||
    (prevTurn && prevTurn.section !== turn.section)
  ) {
    return "section_transition";
  }

  // 2. Remate / Punchline / Broma
  if (
    PUNCHLINE_INDICATORS.test(text) ||
    (turn.productionEvents && turn.productionEvents.some((e) => e.type === "laughter")) ||
    (prevTurn &&
      prevTurn.productionEvents &&
      prevTurn.productionEvents.some((e) => e.type === "laughter"))
  ) {
    return "punchline";
  }

  // 3. Giro de tema o subtema
  if (NEW_TOPIC_STARTERS.test(text)) {
    return "new_topic";
  }

  // 4. Continuidad del mismo locutor (follow-up)
  if (sameSpeaker) {
    return "follow_up";
  }

  // 5. Interrupción / Entrada inmediata (frase muy corta cortando o solapando)
  // 5. Interrupción / Entrada rápida para respuestas cortas (Sí, No, Ah, ¿Qué?, Javier)
  const isSnappy =
    SNAPPY_REPLIES.test(text.trim()) ||
    /^(sí|no|ah|qué|que|javier)$/i.test(text.trim().replace(/[.,!?:;—–]/g, ""));

  if (
    (text.length <= 25 && isSnappy) ||
    (text.length <= 15 && (turn.canOverlap || /^(no\.|sí\.|si\.|espera|oye)/i.test(text) || prevText.endsWith("—") || prevText.endsWith("-")))
  ) {
    return "interrupt";
  }

  // 6. Respuesta a pregunta previa
  if (prevText.endsWith("?") || (prevTurn && prevTurn.relation === "question")) {
    return "answer";
  }

  // 7. Repregunta o contrapregunta
  if (text.endsWith("?") || /^(¿|qué|cómo|cuándo|dónde|por qué)/i.test(text)) {
    return "question";
  }

  // 8. Reacción rápida o interjección
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= 3 && REACTION_PHRASES.test(text)) {
    return "reaction";
  }

  // 9. Acuerdo explícito
  if (AGREEMENT_STARTERS.test(text)) {
    return "agreement";
  }

  // 10. Desacuerdo o matiz
  if (DISAGREEMENT_STARTERS.test(text)) {
    return "disagreement";
  }

  // 11. Aclaración técnica / normativa (Javier o cita)
  if (
    turn.speaker === "NARRADOR" ||
    (turn.claimRefs && turn.claimRefs.length > 0) ||
    /\b(cláusula|clausula|artículo|articulo|cct|lft|lss|contrato|reglamento)\b/i.test(text)
  ) {
    return "clarification";
  }

  // Fallback conversacional estándar
  return turnIndex === 0 ? "section_transition" : "answer";
}

export interface ProsodyOptions {
  enforceDistribution?: boolean;
}

/**
 * Aplica la dirección de prosodia conversacional a los turnos de un guion:
 * - Asigna relation a cada turno.
 * - Calcula pauseBeforeMs y pauseAfterMs con cadencia orgánica.
 * - Preserva inviolables las pausas explícitas del autor.
 * - Asegura que no se aplasten los silencios en una banda estrecha.
 */
export function applyConversationalProsody(turns: Turn[], options: ProsodyOptions = {}): Turn[] {
  if (!turns || turns.length === 0) return [];

  const out: Turn[] = [];

  for (let i = 0; i < turns.length; i++) {
    const rawTurn = turns[i];
    const prevTurn = i > 0 ? out[i - 1] : null;

    const relation = classifyTurnRelation(rawTurn, prevTurn, i, turns.length);
    const timing = RELATION_TIMINGS[relation] ?? RELATION_TIMINGS.answer;
    const seed = deriveSeed(rawTurn.id, rawTurn.ttsText || rawTurn.displayText || "", i);

    let calculatedPauseBeforeMs: number;
    let authorPause = !!rawTurn.authorPause;

    // Respetar estrictamente la pausa explícita del autor si existe (prioridad absoluta)
    if (authorPause && rawTurn.pauseBeforeMs && rawTurn.pauseBeforeMs > 0) {
      calculatedPauseBeforeMs = rawTurn.pauseBeforeMs;
    } else {
      authorPause = false;
      calculatedPauseBeforeMs = i === 0 ? 0 : seededRand(seed, timing.minMs, timing.maxMs);
    }

    // Única fuente de verdad: pauseAfterMs se conserva en 0 para evitar duplicaciones
    const calculatedPauseAfterMs = 0;

    // Solape
    const canOverlap = rawTurn.canOverlap || timing.canOverlap || false;

    // Determinar pauseIntent para contratos y UI
    let pauseIntent: Turn["pauseIntent"] = "normal";
    if (calculatedPauseBeforeMs < 200) pauseIntent = "quick";
    else if (calculatedPauseBeforeMs >= 600) pauseIntent = "reflective";
    if (canOverlap) pauseIntent = "interruption";

    const enhancedTurn: Turn = {
      ...rawTurn,
      relation,
      authorPause,
      pauseBeforeMs: calculatedPauseBeforeMs,
      pauseAfterMs: calculatedPauseAfterMs,
      canOverlap,
      pauseIntent,
    };

    out.push(enhancedTurn);
  }

  return out;
}

export interface PauseDistributionStats {
  totalPauses: number;
  minMs: number;
  medianMs: number;
  meanMs: number;
  p90Ms: number;
  maxMs: number;
  under200MsPct: number;
  between200And450MsPct: number;
  between450And800MsPct: number;
  over800MsPct: number;
}

/**
 * Calcula las estadísticas exactas de distribución de pausas de un conjunto de turnos.
 */
export function calculatePauseDistribution(turns: Turn[]): PauseDistributionStats {
  const pauses = turns.map((t) => t.pauseBeforeMs ?? 200).sort((a, b) => a - b);
  const n = pauses.length;
  if (n === 0) {
    return {
      totalPauses: 0,
      minMs: 0,
      medianMs: 0,
      meanMs: 0,
      p90Ms: 0,
      maxMs: 0,
      under200MsPct: 0,
      between200And450MsPct: 0,
      between450And800MsPct: 0,
      over800MsPct: 0,
    };
  }

  const sum = pauses.reduce((acc, v) => acc + v, 0);
  const meanMs = Math.round(sum / n);
  const minMs = pauses[0];
  const maxMs = pauses[n - 1];
  const medianMs = pauses[Math.floor(n / 2)];
  const p90Ms = pauses[Math.floor(n * 0.9)];

  const under200 = pauses.filter((p) => p < 200).length;
  const b200_450 = pauses.filter((p) => p >= 200 && p <= 450).length;
  const b450_800 = pauses.filter((p) => p > 450 && p <= 800).length;
  const over800 = pauses.filter((p) => p > 800).length;

  return {
    totalPauses: n,
    minMs,
    medianMs,
    meanMs,
    p90Ms,
    maxMs,
    under200MsPct: Number(((under200 / n) * 100).toFixed(1)),
    between200And450MsPct: Number(((b200_450 / n) * 100).toFixed(1)),
    between450And800MsPct: Number(((b450_800 / n) * 100).toFixed(1)),
    over800MsPct: Number(((over800 / n) * 100).toFixed(1)),
  };
}
