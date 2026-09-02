/**
 * ClaimEntailmentGate — verifica respaldo real entre afirmación y fuente.
 * Comparación local determinista (sin LLM) del texto de la fuente vs afirmación.
 */

export interface EntailmentResult {
  supported: boolean;
  exactSupport: string | null;
  contradiction: boolean;
  topicMatch: boolean;
  reason: string;
}

const GENERIC_PHRASES = [
  "conforme a la normativa aplicable",
  "de acuerdo con la normativa",
  "según la ley",
  "lo que establece la norma",
];

export function checkEntailment(claimText: string, excerpt: string, document: string, primaryQuestion: string): EntailmentResult {
  const normalizedClaim = claimText.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const normalizedExcerpt = excerpt.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const normalizedDoc = document.toLowerCase();

  // Detectar frases genéricas de Javier sin respaldo
  for (const phrase of GENERIC_PHRASES) {
    if (normalizedClaim.includes(phrase) && normalizedExcerpt.length < 20) {
      return {
        supported: false,
        exactSupport: null,
        contradiction: false,
        topicMatch: false,
        reason: `Javier dice frase genérica "${phrase}" sin explicar qué establece realmente la fuente`,
      };
    }
  }

  // Verificar que la afirmación no introduce plazo/derecho/trámite no presente en la fuente
  const claimHasPlazo = /\b(\d+\s*(días|horas|años|meses)|plazo de)\b/i.test(claimText);
  const excerptHasPlazo = /\b(\d+\s*(días|horas|años|meses)|plazo de)\b/i.test(excerpt);
  if (claimHasPlazo && !excerptHasPlazo) {
    return {
      supported: false,
      exactSupport: null,
      contradiction: false,
      topicMatch: false,
      reason: "La afirmación introduce un plazo no presente en la fuente",
    };
  }

  // Verificar que no se afirma exigencia por escrito sin respaldo
  if (/puede exigirse por escrito|debe solicitar por escrito/i.test(claimText) && !/por escrito|escrito/i.test(excerpt)) {
    return {
      supported: false,
      exactSupport: null,
      contradiction: false,
      topicMatch: false,
      reason: "Se afirma exigencia por escrito sin respaldo en la fuente",
    };
  }

  // Topic match simple: debe compartir al menos una palabra clave con la pregunta central
  const questionWords = primaryQuestion.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
  const claimWords = normalizedClaim.split(/\s+/);
  const topicMatch = questionWords.some((w) => claimWords.includes(w) || normalizedExcerpt.includes(w));

  // Soporte exacto: buscar si el excerpt contiene palabras clave de la afirmación
  const claimKeywords = normalizedClaim.split(/\s+/).filter((w) => w.length > 4);
  const excerptWords = new Set(normalizedExcerpt.split(/\s+/));
  const overlap = claimKeywords.filter((w) => excerptWords.has(w)).length;
  const hasSupport = claimKeywords.length > 0 ? overlap / claimKeywords.length >= 0.5 : normalizedExcerpt.includes(normalizedClaim.slice(0, 20));

  if (!hasSupport) {
    return {
      supported: false,
      exactSupport: null,
      contradiction: false,
      topicMatch,
      reason: "La fuente no respalda la afirmación — solo coincide en palabras generales o no hay soporte exacto",
    };
  }

  return {
    supported: true,
    exactSupport: claimKeywords.slice(0,2).join(" "),
    contradiction: false,
    topicMatch: true,
    reason: "Respaldo encontrado",
  };
}

function extractTrigrams(text: string): string[] {
  const words = text.split(/\s+/).filter((w) => w.length > 3);
  const trigrams: string[] = [];
  for (let i = 0; i < words.length - 2; i++) {
    trigrams.push(words.slice(i, i + 3).join(" "));
  }
  return trigrams.slice(0, 5);
}

export function validateClaimEntailment(
  claims: Array<{ text: string; sourceIds: string[]; excerpt: string; document: string }>,
  primaryQuestion: string
): Array<{ claimText: string; result: EntailmentResult }> {
  return claims.map((c) => ({
    claimText: c.text,
    result: checkEntailment(c.text, c.excerpt, c.document, primaryQuestion),
  }));
}
