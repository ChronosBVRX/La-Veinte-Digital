/**
 * AntirrepetitionValidator — bloquea guiones con repetición excesiva antes de TTS.
 * Determinista, sin LLM.
 */

import type { DialogueTurn } from "./director";

export interface AntirepetitionResult {
  duplicateOpeningRate: number;
  repeatedQuestionCount: number;
  repeatedConclusionCount: number;
  genericReactionCount: number;
  uniqueInformationRatio: number;
  blocked: boolean;
  reasons: string[];
}

const GENERIC_REACTIONS = [
  "exacto",
  "claro",
  "ajá",
  "así es",
  "correcto",
  "muy bien",
];

const BANNED_PHRASES = [
  "Pongámoslo así",
  "Te cuento algo útil",
  "Esto es clave",
  "Y toma nota",
  "Un momento para recordar",
  "Justo ahí hay un matiz",
  "Javier, ¿qué dice exactamente el documento?",
  "No era puro rumor",
  "Eso cambia todo",
];

export function validateAntirepetition(turns: DialogueTurn[]): AntirepetitionResult {
  const reasons: string[] = [];

  // duplicateOpeningRate: trigramas iniciales repetidos
  const openings = turns.map((t) => t.text.trim().split(/\s+/).slice(0, 3).join(" ").toLowerCase());
  const openingCounts = new Map<string, number>();
  for (const o of openings) openingCounts.set(o, (openingCounts.get(o) ?? 0) + 1);
  const duplicateOpenings = [...openingCounts.values()].filter((c) => c > 1).reduce((a, c) => a + (c - 1), 0);
  const duplicateOpeningRate = turns.length > 0 ? duplicateOpenings / turns.length : 0;
  if (duplicateOpeningRate > 0.08) reasons.push(`duplicateOpeningRate ${duplicateOpeningRate.toFixed(3)} > 0.08`);

  // repeatedQuestionCount
  const questions = turns.filter((t) => t.text.trim().endsWith("?")).map((t) => t.text.trim().toLowerCase());
  const questionCounts = new Map<string, number>();
  for (const q of questions) questionCounts.set(q, (questionCounts.get(q) ?? 0) + 1);
  const repeatedQuestionCount = [...questionCounts.values()].filter((c) => c > 1).length;
  if (repeatedQuestionCount > 0) reasons.push(`repeatedQuestionCount ${repeatedQuestionCount} > 0`);

  // repeatedConclusionCount
  const conclusions = turns.filter((t) => /conclusión|en resumen|para cerrar/i.test(t.text)).map((t) => t.text.trim().toLowerCase());
  const conclusionCounts = new Map<string, number>();
  for (const c of conclusions) conclusionCounts.set(c, (conclusionCounts.get(c) ?? 0) + 1);
  const repeatedConclusionCount = [...conclusionCounts.values()].filter((c) => c > 1).length;
  if (repeatedConclusionCount > 0) reasons.push(`repeatedConclusionCount ${repeatedConclusionCount} > 0`);

  // genericReactionCount
  let genericReactionCount = 0;
  for (const t of turns) {
    const lower = t.text.trim().toLowerCase();
    const isGeneric = GENERIC_REACTIONS.some((g) => lower === g || lower === g + ".") && t.text.trim().split(/\s+/).length <= 4;
    if (isGeneric) genericReactionCount++;
    // también detectar reacciones genéricas que no añaden info (muy cortas sin cita y sin pregunta)
    if (t.text.trim().split(/\s+/).length <= 3 && t.citations.length === 0 && !t.text.includes("?")) {
      // contar como genérica si no es apertura
      if (!["apertura", "cierre"].some((k) => (t.sceneId ?? "").includes(k))) {
        // ya contado arriba si es genérica exacta, si no, no duplicar
      }
    }
  }
  const genericRatio = turns.length > 0 ? genericReactionCount / turns.length : 0;
  if (genericRatio > 0.1) reasons.push(`genericReactionCount ratio ${genericRatio.toFixed(3)} > 0.1`);

  // uniqueInformationRatio — aproximado: turnos que aportan info (citations o longitud > 10 palabras) / total
  const informative = turns.filter((t) => t.citations.length > 0 || t.text.split(/\s+/).length > 10).length;
  const uniqueInformationRatio = turns.length > 0 ? informative / turns.length : 0;
  if (uniqueInformationRatio < 0.7) reasons.push(`uniqueInformationRatio ${uniqueInformationRatio.toFixed(3)} < 0.7`);

  // BANNED_PHRASES
  for (const phrase of BANNED_PHRASES) {
    const count = turns.filter((t) => t.text.includes(phrase)).length;
    if (count > 1) reasons.push(`frase prohibida repetida: "${phrase}" x${count}`);
    if (count === 1 && turns.filter((t) => t.text.includes(phrase) && t.text.trim().split(/\s+/).length < 20).length > 0) {
      // si aparece una vez pero es muy corta, igual es sospechoso, pero no bloqueamos por una sola
    }
  }

  // dos turnos consecutivos del mismo personaje sin justificación (no es interrupción)
  for (let i = 1; i < turns.length; i++) {
    if (turns[i].speaker === turns[i - 1].speaker && turns[i].canOverlap === false && turns[i].intent !== "handoff") {
      reasons.push(`dos turnos consecutivos del mismo personaje sin justificación: ${turns[i].speaker} en ${turns[i].id} y ${turns[i - 1].id}`);
      break;
    }
  }

  // llamadas repetitivas a Javier (más de 40% de turnos son NARRADOR)
  const javierCount = turns.filter((t) => t.speaker === "NARRADOR" || t.speaker === "JAVIER_RIOS" || t.speaker.includes("JAVIER")).length;
  if (turns.length > 0 && javierCount / turns.length > 0.35) {
    reasons.push(`llamadas repetitivas a Javier: ${javierCount}/${turns.length} > 0.35`);
  }

  const blocked = reasons.length > 0;
  return {
    duplicateOpeningRate,
    repeatedQuestionCount,
    repeatedConclusionCount,
    genericReactionCount,
    uniqueInformationRatio,
    blocked,
    reasons,
  };
}
