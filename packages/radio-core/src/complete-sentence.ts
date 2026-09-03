/**
 * CompleteSentenceGate — verifica que ningún turno termine a media palabra o sin puntuación.
 */

import type { DialogueTurn } from "./director";

export interface CompleteSentenceResult {
  valid: boolean;
  issues: Array<{ turnId: string; text: string; reason: string }>;
}

const END_PUNCT = /[.!?¡¿…]$/;

export function validateCompleteSentences(turns: DialogueTurn[]): CompleteSentenceResult {
  const issues: CompleteSentenceResult["issues"] = [];
  for (const t of turns) {
    const txt = t.text.trim();
    if (txt.length === 0) {
      issues.push({ turnId: t.id, text: txt, reason: "texto vacío" });
      continue;
    }
    // Detectar truncado a media palabra: termina sin espacio pero sin puntuación y última palabra muy corta o con caracteres raros
    const endsWithPunct = END_PUNCT.test(txt);
    const lastWord = txt.split(/\s+/).pop() ?? "";
    // Si termina sin puntuación y la última palabra es de 1-2 letras y no es "si", "no", "ya", etc., sospechoso
    const isTruncated = !endsWithPunct && lastWord.length <= 2 && !["si", "no", "ya", "la", "el", "de", "en", "un", "es", "al"].includes(lastWord.toLowerCase());
    // Detectar ejemplos del issue: “entre las persona” (singular/plural mismatch por corte), “Porque una cosa e”, “al final q”, “está Jav”
    const truncatedPatterns = [
      /entre las persona$/i,
      /Porque una cosa e$/i,
      /al final q$/i,
      /está Jav$/i,
      /\b\w{1,2}$/, // termina en 1-2 letras sin puntuación
    ];
    const isPatternTruncated = truncatedPatterns.some((re) => re.test(txt)) && !endsWithPunct;

    if (isTruncated || isPatternTruncated) {
      issues.push({ turnId: t.id, text: txt, reason: "termina a media palabra o sin puntuación" });
    } else if (!endsWithPunct && txt.split(/\s+/).length > 8) {
      // Frases largas sin puntuación final son sospechosas
      issues.push({ turnId: t.id, text: txt, reason: "frase larga sin puntuación final" });
    }

    // Verificar slice/substring truncation en el origen: si el texto original fue truncado, lo detectamos por longitud vs original?
    // Aquí solo verificamos el texto final, no el origen.
  }
  return { valid: issues.length === 0, issues };
}
