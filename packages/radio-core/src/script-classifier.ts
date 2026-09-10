/**
 * script-classifier.ts — Clasificador local multicriterio para distinguir
 * entre tema/prompt ("Explica cómo...") y guion ya escrito ("EDUARDO: ...").
 *
 * Incluye derivación de títulos cortos y limpios para cabeceras.
 */

export interface ClassificationStats {
  lineCount: number;
  speakerLineCount: number;
  speakerRatio: number;
  cuesCount: number;
  uniqueSpeakersFound: string[];
  detectedSpeakers: string[];
  turnsCount: number;
  wordCount: number;
  hasPromptKeywords: boolean;
}

export interface InputClassification {
  type: "script" | "prompt" | "ambiguous";
  kind: "script" | "prompt" | "ambiguous";
  confidence: number; // 0.0 a 1.0
  stats: ClassificationStats;
  suggestedTitle: string;
}

// Lista de nombres y variantes canónicas reconocidas
const KNOWN_SPEAKER_NAMES = [
  "EDUARDO",
  "ANDREA",
  "JAVIER",
  "JAVIER RÍOS",
  "JAVIER RIOS",
  "NARRADOR",
  "ALONSO",
  "RODRIGO",
  "RODRIGO TORRES",
  "CORRESPONSAL",
  "VALERIA",
  "VALERIA SOTO",
  "COMERCIAL",
  "PATROCINIO",
  "MARIANA",
];

// Marcadores de acotaciones de producción en corchetes
export const CUE_REGEX =
  /\[\s*(MÚSICA|MUSICA|SFX|EFECTO|PAUSA|RISAS|CORTE|ENTRADA|SALIDA|FADE|SILENCIO|APLAUSOS|SUSPIRO|CORTINILLA|VOZ EN OFF|LOCUCIÓN|LOCUCION)[^\]]*\]/gi;

export function isCueLine(line: string): boolean {
  const t = line.trim();
  if (t.startsWith("[") && t.endsWith("]")) return true;
  if (t.startsWith("**[") && t.endsWith("]**")) return true;
  return t.length > 0 && t.replace(CUE_REGEX, "").trim() === "";
}

// Marcadores típicos de un prompt o instrucción a la IA
const PROMPT_PATTERNS = [
  /^(?:explica|explícame|explicar|describe|analiza|resume|haz|escribe|crea|redacta|genera)\b/i,
  /^(?:¿?\s*(?:qué|cómo|cuándo|dónde|por qué|cuál|cuánto|quién))\b/i,
  /\b(?:guion sobre|episodio sobre|programa sobre|habla de|cuéntame de|trata sobre)\b/i,
  /\b(?:para trabajadores|del imss|de acuerdo a la ley|contrato colectivo)\b/i,
];

export function isKnownSpeaker(name: string): boolean {
  const norm = name.trim().toUpperCase();
  return KNOWN_SPEAKER_NAMES.some((k) => norm === k || norm.startsWith(k + " ") || norm.endsWith(" " + k));
}

export function isCueKeyword(name: string): boolean {
  return /^(SFX|EFECTO|MÚSICA|MUSICA|PAUSA|RISAS|FADE|CORTE|SILENCIO|CORTINILLA|APLAUSOS|SUSPIRO|LOCUCIÓN|LOCUCION)/i.test(name.trim());
}

const KNOWN_SPEAKERS_SPLIT_REGEX = new RegExp(
  `(?<!^)(?<!\\n)(?<!\\[)\\s*(?=\\b(?:${KNOWN_SPEAKER_NAMES.map((n) => n.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")).join("|")})\\s*[:–—-])`,
  "gi"
);

/**
 * Normaliza y desdobla textos pegados en una sola línea o con formato Markdown
 * separando adecuadamente acotaciones entre corchetes y locutores.
 */
function cleanAndNormalizeScriptText(input: string): string {
  if (!input) return "";
  let s = input.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Limpiar negritas rodeando corchetes: **[SFX: ...]** -> [SFX: ...]
  s = s.replace(/\*{1,2}(\[[^\]]+\])\*{1,2}/g, "$1");

  // Insertar salto de línea antes de acotaciones estructurales de producción: [MÚSICA...], [SFX...], etc.
  s = s.replace(/(?<!^)(?<!\n)\s*(?=\[\s*(?:MÚSICA|MUSICA|SFX|EFECTO|CORTE|ENTRADA|SALIDA|FADE|CORTINILLA|VOZ EN OFF|LOCUCIÓN|LOCUCION)[^\]]*\])/gi, "\n");

  // Insertar salto de línea antes de locutores en negritas: **ANDREA**, **EDUARDO**, etc.
  s = s.replace(/(?<!^)(?<!\n)\s*(?=\*\*[A-ZÁÉÍÓÚÑ\s\/\-]{2,30}\*\*)/g, "\n");

  // Insertar salto de línea antes de locutores canónicos conocidos con dos puntos
  s = s.replace(KNOWN_SPEAKERS_SPLIT_REGEX, "\n");

  return s;
}

export interface MatchedSpeakerLine {
  speaker: string;
  dialogue: string;
}

/**
 * Detecta si una línea corresponde a un locutor:
 * 1. Formato Markdown/corchetes con o sin dos puntos: **EDUARDO:** según yo sí / [EDUARDO]: audio
 * 2. Formato estándar con dos puntos o guion: EDUARDO: Hola equipo
 */
export function matchSpeakerLine(line: string): MatchedSpeakerLine | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Caso 1: Envuelto en asteriscos o corchetes: **ANDREA** diálogo o **EDUARDO:** diálogo
  const wrappedMatch = trimmed.match(
    /^(?:#{1,4}\s*)?(?:\*{1,2}|\[)([\wÁÉÍÓÚáéíóúÑñ\s\/\-]+?)[:–—-]?(?:\*{1,2}|\])\s*(?:[:–—-]\s*|\s*)(.*)$/
  );
  if (wrappedMatch) {
    const speakerCandidate = wrappedMatch[1].trim();
    if (isCueKeyword(speakerCandidate)) return null;
    return { speaker: speakerCandidate, dialogue: wrappedMatch[2].trim() };
  }

  // Caso 2: Nombre simple seguido estrictamente por dos puntos o guion: EDUARDO: diálogo
  const plainMatch = trimmed.match(
    /^(?:#{1,4}\s*)?([A-Za-zÁÉÍÓÚáéíóúÑñ\s]{2,25})\s*[:–—-]\s*(.*)$/
  );
  if (plainMatch) {
    const speakerCandidate = plainMatch[1].trim();
    if (isCueKeyword(speakerCandidate)) return null;
    return { speaker: speakerCandidate, dialogue: plainMatch[2].trim() };
  }

  return null;
}

/**
 * Deriva un título corto, legible y limpio a partir del texto ingresado.
 * Garantiza una longitud máxima de entre 80 y 120 caracteres y elimina Markdown.
 */
export function deriveShortTitle(text: string, maxLength = 95): string {
  const normalized = cleanAndNormalizeScriptText(text ?? "").trim();
  if (!normalized) return "Episodio sin título";

  const lines = normalized.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return "Episodio sin título";

  let candidate = "";

  // 1. Buscar encabezados explícitos de título (# ..., Título: ..., Tema: ...)
  for (const rawLine of lines.slice(0, 5)) {
    const lineWithoutCues = rawLine.replace(CUE_REGEX, "").trim();
    if (!lineWithoutCues) continue;

    // Direct header: # Titulo o **### Titulo**
    const mdHeaderMatch = lineWithoutCues.match(/^(?:\*{1,2})?#{1,4}\s*(.+?)(?:\*{1,2})?$/);
    if (mdHeaderMatch && mdHeaderMatch[1].trim()) {
      candidate = mdHeaderMatch[1].trim();
      break;
    }

    // Label: Título: ..., Tema: ..., Episodio: ...
    const labelMatch = lineWithoutCues.match(/^(?:(?:\*{1,2})?(?:T[ií]tulo|Tema|Episodio)[:–—-]?(?:\*{1,2})?\s*[:–—-]?\s*)(.*)$/i);
    if (labelMatch && labelMatch[1].trim()) {
      candidate = labelMatch[1].trim();
      break;
    }
  }

  // 2. Si no hay encabezado explícito, examinar la primera línea con contenido útil
  if (!candidate) {
    for (const rawLine of lines.slice(0, 6)) {
      const lineWithoutCues = rawLine.replace(CUE_REGEX, "").trim();
      if (!lineWithoutCues) continue;

      const speakerMatch = matchSpeakerLine(lineWithoutCues);
      if (speakerMatch && !isCueKeyword(speakerMatch.speaker)) {
        const dialogueText = speakerMatch.dialogue.replace(CUE_REGEX, "").trim();
        if (dialogueText.length >= 10) {
          candidate = dialogueText;
          break;
        }
      } else if (!speakerMatch && !isCueLine(lineWithoutCues)) {
        candidate = lineWithoutCues;
        break;
      }
    }
  }

  if (!candidate) candidate = lines[0] ?? "Episodio de radio";

  // Limpiar Markdown (asteriscos, corchetes, almohadillas, comillas)
  let cleanTitle = candidate
    .replace(/^#+\s*/, "")
    .replace(/\*{1,3}/g, "")
    .replace(/_{1,3}/g, "")
    .replace(/^["'«“]+|["'»”]+$/g, "")
    .replace(CUE_REGEX, "")
    .replace(/\s+/g, " ")
    .trim();

  // Si termina con dos puntos residuales, quitarlos
  cleanTitle = cleanTitle.replace(/[:–—\s]+$/, "");

  if (!cleanTitle) cleanTitle = "Episodio de radio";

  // Si tiene puntuación de oración (punto, interrogación, etc.) temprana, cortar ahí si tiene buena longitud
  const sentenceEnd = cleanTitle.search(/[.?!]/);
  if (sentenceEnd > 20 && sentenceEnd <= maxLength) {
    cleanTitle = cleanTitle.slice(0, sentenceEnd + 1).trim();
  }

  // Truncar con elipsis limpia respetando límite
  if (cleanTitle.length > maxLength) {
    const sub = cleanTitle.slice(0, maxLength - 1);
    const lastSpace = sub.lastIndexOf(" ");
    if (lastSpace > 40) {
      cleanTitle = sub.slice(0, lastSpace) + "…";
    } else {
      cleanTitle = sub + "…";
    }
  }

  return cleanTitle;
}

/**
 * Clasificador local multicriterio. Analiza las señales del texto para determinar
 * si se trata de un tema/prompt o de un guion ya estructurado.
 */
export function classifyInput(text: string): InputClassification {
  const trimmed = (text ?? "").trim();
  const suggestedTitle = deriveShortTitle(trimmed);

  if (!trimmed) {
    return {
      type: "prompt",
      kind: "prompt",
      confidence: 1,
      stats: {
        lineCount: 0,
        speakerLineCount: 0,
        speakerRatio: 0,
        cuesCount: 0,
        uniqueSpeakersFound: [],
        detectedSpeakers: [],
        turnsCount: 0,
        wordCount: 0,
        hasPromptKeywords: false,
      },
      suggestedTitle: "Episodio sin título",
    };
  }

  const normalized = cleanAndNormalizeScriptText(trimmed);
  const rawLines = normalized.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const words = trimmed.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const lineCount = rawLines.length;

  let speakerLineCount = 0;
  const uniqueSpeakers = new Set<string>();
  let cuesCount = 0;

  // Evaluar líneas de locutor y acotaciones
  for (const line of rawLines) {
    if (isCueLine(line)) {
      cuesCount++;
      continue;
    }

    const spkMatch = matchSpeakerLine(line);
    if (spkMatch) {
      const candidateName = spkMatch.speaker.trim().toUpperCase();
      if (isCueKeyword(candidateName)) {
        cuesCount++;
        continue;
      }
      if (isKnownSpeaker(candidateName)) {
        speakerLineCount++;
        uniqueSpeakers.add(candidateName);
      } else if (candidateName.length >= 3 && candidateName.length <= 25 && /^[A-ZÁÉÍÓÚÑ\s\/\-]+$/.test(candidateName)) {
        speakerLineCount++;
        uniqueSpeakers.add(candidateName);
      }
    }

    const cueMatches = line.match(CUE_REGEX);
    if (cueMatches) {
      cuesCount += cueMatches.length;
    }
  }

  const speakerRatio = lineCount > 0 ? speakerLineCount / lineCount : 0;
  const uniqueSpeakersFound = [...uniqueSpeakers];
  const turnsCount = speakerLineCount;

  // Detección de marcadores de prompt
  const hasPromptKeywords = PROMPT_PATTERNS.some((p) => p.test(trimmed));

  const stats: ClassificationStats = {
    lineCount,
    speakerLineCount,
    speakerRatio,
    cuesCount,
    uniqueSpeakersFound,
    detectedSpeakers: uniqueSpeakersFound,
    turnsCount,
    wordCount,
    hasPromptKeywords,
  };

  // Puntuación
  let scriptScore = 0;

  if (turnsCount >= 2) {
    scriptScore += 35;
    scriptScore += Math.min(turnsCount * 6, 40);
  } else if (turnsCount === 1) {
    scriptScore += 10;
  }

  if (uniqueSpeakersFound.length >= 2) {
    scriptScore += 30;
  } else if (uniqueSpeakersFound.length === 1) {
    scriptScore += 15;
  }

  if (cuesCount > 0) {
    scriptScore += Math.min(cuesCount * 15, 35);
  }

  if (speakerRatio >= 0.35) {
    scriptScore += 25;
  } else if (speakerRatio >= 0.2) {
    scriptScore += 10;
  }

  if (hasPromptKeywords && turnsCount < 2) {
    scriptScore -= 35;
  }

  if (lineCount <= 2 && turnsCount === 0) {
    scriptScore -= 50;
  }

  if (scriptScore >= 60) {
    return {
      type: "script",
      kind: "script",
      confidence: Math.min(0.99, 0.6 + (scriptScore - 60) / 100),
      stats,
      suggestedTitle,
    };
  }

  if (scriptScore <= 15) {
    return {
      type: "prompt",
      kind: "prompt",
      confidence: Math.min(0.99, 0.7 + (15 - Math.max(0, scriptScore)) / 50),
      stats,
      suggestedTitle,
    };
  }

  return {
    type: "ambiguous",
    kind: "ambiguous",
    confidence: 0.5,
    stats,
    suggestedTitle,
  };
}
