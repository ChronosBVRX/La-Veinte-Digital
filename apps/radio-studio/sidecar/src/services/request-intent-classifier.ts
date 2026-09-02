/**
 * RequestIntentClassifier — clasifica la solicitud antes de consultar el corpus.
 * General, no sobreajustado al piloto. Usa reglas + Qwen local + schema + fallback.
 */

export type IntentMode = "editorial_intro" | "normative_question" | "procedure_guide" | "case_analysis" | "document_explainer";

export interface IntentClassification {
  mode: IntentMode;
  primaryGoal: string;
  primaryQuestion: string;
  illustrativeTopics: string[];
  topicsToResearch: string[];
  requiresNormativeClaims: boolean;
  requiresUserClarification: boolean;
  clarificationQuestion?: string;
  reason: string;
}

export function classifyRequest(topic: string): IntentClassification {
  const normalized = topic.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const primaryQuestion = topic.slice(0, 120);

  // Señales claras para editorial_intro (presentación de programa/espacio)
  const isPresentation = (
    (normalized.includes("presentar") || normalized.includes("explicar que es") || normalized.includes("dar a conocer") || normalized.includes("que es este espacio") || normalized.includes("presentacion")) &&
    (normalized.includes("programa") || normalized.includes("espacio") || normalized.includes("radio") || normalized.includes("veinte radio"))
  ) || normalized.includes("episodio piloto") || normalized.includes("programa inicial") || normalized.includes("primer episodio");

  if (isPresentation) {
    const illustrativeTopics = ["cambio de horario","vacaciones","tarjetón","checadas","incapacidades","permisos","escritos","escalafón","prestaciones"];
    return {
      mode: "editorial_intro",
      primaryGoal: topic.slice(0, 80),
      primaryQuestion,
      illustrativeTopics: illustrativeTopics.slice(0, 9),
      topicsToResearch: [],
      requiresNormativeClaims: false,
      requiresUserClarification: false,
      reason: "Presentación editorial — ejemplos ilustrativos no generan búsquedas",
    };
  }

  if (/(cómo|como|donde|cuando|qué|que) .* (trámite|procedimiento|paso a paso|guía|solicitar|requisitos|documentos|responsables)/i.test(topic)) {
    return {
      mode: "procedure_guide",
      primaryGoal: topic.slice(0, 80),
      primaryQuestion,
      illustrativeTopics: [],
      topicsToResearch: [topic],
      requiresNormativeClaims: true,
      requiresUserClarification: false,
      reason: "Guía de trámite",
    };
  }
  if (/(caso|me pasó|me cambiaron|me negaron|analiza)/i.test(topic)) {
    return {
      mode: "case_analysis",
      primaryGoal: topic.slice(0, 80),
      primaryQuestion,
      illustrativeTopics: [],
      topicsToResearch: [topic],
      requiresNormativeClaims: true,
      requiresUserClarification: topic.split(/\s+/).length < 8,
      clarificationQuestion: topic.split(/\s+/).length < 8 ? "¿Podrías contar más detalles del caso?" : undefined,
      reason: "Análisis de caso",
    };
  }
  if (/(documento|cláusula|artículo|procedimiento|manual|formato)/i.test(topic) && /(explicar|qué dice|interpretar)/i.test(topic)) {
    return {
      mode: "document_explainer",
      primaryGoal: topic.slice(0, 80),
      primaryQuestion,
      illustrativeTopics: [],
      topicsToResearch: [topic],
      requiresNormativeClaims: true,
      requiresUserClarification: false,
      reason: "Explicación de documento",
    };
  }
  return {
    mode: "normative_question",
    primaryGoal: topic.slice(0, 80),
    primaryQuestion,
    illustrativeTopics: [],
    topicsToResearch: [topic],
    requiresNormativeClaims: true,
    requiresUserClarification: false,
    reason: "Pregunta normativa por defecto",
  };
}
