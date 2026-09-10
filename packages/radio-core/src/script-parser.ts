/**
 * script-parser.ts — Parser y normalizador de guiones ya escritos para AI Radio Studio.
 *
 * Máquina de estados desacoplada:
 * 1. Tokenización y normalización estructural (sin tocar redacción).
 * 2. Detección conservadora de locutores canónicos (EDUARDO, ANDREA, JAVIER, RODRIGO, VALERIA).
 * 3. Extracción rigurosa de direcciones de interpretación (delivery: cálido, natural, rápida...)
 *    para que NUNCA terminen dentro de ttsText ni se mezclen con el diálogo.
 * 4. Aislamiento de acotaciones y eventos de producción ([PAUSA], [MÚSICA], [SFX], [RISAS]).
 * 5. Cierre inmediato de turno al detectar un nuevo locutor para evitar fusiones de personajes.
 */

import type { Script, Turn, Scene, SourceRef, ProductionEvent, Delivery } from "@la-veinte/studio-contract";
import {
  CUE_REGEX,
  deriveShortTitle,
  isCueLine,
  isCueKeyword,
} from "./script-classifier";

export interface CanonicalSpeakerDef {
  id: string;
  nombre: string;
  rol: string;
  voz: "A" | "B" | "N" | "C" | "P";
  aliases: string[];
}

export const CANONICAL_SPEAKERS: Record<string, CanonicalSpeakerDef> = {
  EDUARDO: {
    id: "EDUARDO",
    nombre: "Eduardo",
    rol: "conductor",
    voz: "A",
    aliases: ["EDUARDO", "EDUARDO:", "EDU", "LALO"],
  },
  ANDREA: {
    id: "ANDREA",
    nombre: "Andrea",
    rol: "co-conductor",
    voz: "B",
    aliases: ["ANDREA", "ANDREA:", "ANDY", "MARIANA"],
  },
  JAVIER: {
    id: "JAVIER",
    nombre: "Javier Ríos",
    rol: "normative_analyst",
    voz: "N",
    aliases: [
      "JAVIER",
      "JAVIER:",
      "JAVIER RÍOS",
      "JAVIER RIOS",
      "NARRADOR",
      "NARRADOR:",
      "ALONSO",
      "ANALISTA",
    ],
  },
  RODRIGO: {
    id: "RODRIGO",
    nombre: "Rodrigo Torres",
    rol: "corresponsal",
    voz: "C",
    aliases: [
      "RODRIGO",
      "RODRIGO:",
      "RODRIGO TORRES",
      "CORRESPONSAL",
      "CORRESPONSAL:",
    ],
  },
  VALERIA: {
    id: "VALERIA",
    nombre: "Valeria Soto",
    rol: "comercial",
    voz: "P",
    aliases: [
      "VALERIA",
      "VALERIA:",
      "VALERIA SOTO",
      "COMERCIAL",
      "COMERCIAL:",
      "PATROCINIO",
      "ANUNCIO",
    ],
  },
};

// Alias de retrocompatibilidad
CANONICAL_SPEAKERS.NARRADOR = CANONICAL_SPEAKERS.JAVIER;

/**
 * Normaliza cualquier variante de nombre a su ID canónico de locutor:
 * JAVIER RÍOS → JAVIER
 * RODRIGO TORRES → RODRIGO
 * VALERIA SOTO → VALERIA
 */
export function normalizeSpeakerId(raw: string): string {
  const cleaned = raw
    .replace(/^[*_#[\]\s]+|[*_#[\]\s:]+$/g, "")
    .trim()
    .toUpperCase();

  for (const [id, def] of Object.entries(CANONICAL_SPEAKERS)) {
    if (id === cleaned || def.aliases.some((a) => a.toUpperCase() === cleaned)) {
      return def.id;
    }
  }

  // Búsqueda por subcadena para nombres compuestos
  if (cleaned.includes("RODRIGO") || cleaned.includes("TORRES") || cleaned.includes("CORRESPONSAL")) return "RODRIGO";
  if (cleaned.includes("JAVIER") || cleaned.includes("RÍOS") || cleaned.includes("RIOS") || cleaned.includes("NARRADOR") || cleaned.includes("ALONSO")) return "JAVIER";
  if (cleaned.includes("VALERIA") || cleaned.includes("SOTO") || cleaned.includes("COMERCIAL") || cleaned.includes("PATROCINIO") || cleaned.includes("ANUNCIO")) return "VALERIA";
  if (cleaned.includes("ANDREA") || cleaned.includes("MARIANA") || cleaned.includes("ANDY")) return "ANDREA";
  if (cleaned.includes("EDUARDO") || cleaned.includes("LALO") || cleaned.includes("EDU")) return "EDUARDO";

  return "EDUARDO";
}

/**
 * Desglosa una cadena de estilos ("cálido, natural", "rápida", "con ironía") en lista limpia.
 */
export function parseDeliveryStyles(stylesRaw: string): string[] {
  if (!stylesRaw) return [];
  return stylesRaw
    .replace(/[*_#]+/g, "")
    .replace(/^[—–\-:(]+|[):]+$/g, "")
    .split(/[,;]|\s+y\s+/i)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0 && !/^(voz|locutor|personaje)$/i.test(s));
}

export interface ParsedSpeakerHeader {
  speaker: string;
  speakerRaw: string;
  delivery: Delivery;
  inlineDialogue: string;
}

const KNOWN_NAMES_REGEX = /^(EDUARDO|ANDREA|JAVIER(?:\s+RÍOS|\s+RIOS)?|RODRIGO(?:\s+TORRES)?|VALERIA(?:\s+SOTO)?|NARRADOR|CORRESPONSAL|COMERCIAL|PATROCINIO|ALONSO)\b/i;

/**
 * Detecta si una línea o fragmento corresponde al inicio de una intervención de locutor.
 * Separa de forma estricta:
 * - Speaker canónico
 * - Dirección de interpretación (delivery)
 * - Diálogo que acompañe a la misma línea
 */
export function parseSpeakerHeader(line: string): ParsedSpeakerHeader | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Si toda la línea es una acotación [ ... ], no es un locutor
  if (isCueLine(trimmed)) return null;

  // Caso 1: Envuelto en asteriscos o corchetes: **EDUARDO — cálido, natural** ¿Ya estamos? o **EDUARDO:** ¿Ya estamos?
  const wrappedMatch = trimmed.match(
    /^(?:#{1,4}\s*)?(?:\*{1,2}|\[)([\wÁÉÍÓÚáéíóúÑñ\s\/\-—–,():]+?)(?:\*{1,2}|\])\s*(?:[:–—-]\s*)?(.*)$/
  );
  if (wrappedMatch) {
    const headerInside = wrappedMatch[1].trim();
    if (isCueKeyword(headerInside)) return null;

    // Verificar si el interior contiene un locutor conocido
    const nameMatch = headerInside.match(KNOWN_NAMES_REGEX);
    if (nameMatch) {
      const speakerCandidate = nameMatch[0].trim();
      const restOfHeader = headerInside.slice(nameMatch[0].length).trim();
      const styles = parseDeliveryStyles(restOfHeader);
      const cleanInlineDialogue = wrappedMatch[2].replace(/^\*{1,2}|\*{1,2}$/g, "").trim();

      return {
        speaker: normalizeSpeakerId(speakerCandidate),
        speakerRaw: speakerCandidate,
        delivery: { styles, emotion: styles[0] ?? null },
        inlineDialogue: cleanInlineDialogue,
      };
    }
  }

  // Caso 2: Formato estándar en texto plano:
  // - EDUARDO — cálido, natural: ¿Ya estamos?
  // - EDUARDO — cálido, natural
  // - EDUARDO (cálido, natural): ¿Ya estamos?
  // - EDUARDO: Hola.
  // - ANDREA (sola en una línea)
  const plainHeaderMatch = trimmed.match(
    /^(?:#{1,4}\s*)?([A-Za-zÁÉÍÓÚáéíóúÑñ\s]{2,25}?)(?:\s*([—–\-]|,\s*)\s*([^:\n]+?))?(?:\s*\(([^)]+)\))?\s*(?:[:–—-]|\s*$)\s*(.*)$/
  );

  if (plainHeaderMatch) {
    const candidate = plainHeaderMatch[1].trim();
    const nameCheck = candidate.match(KNOWN_NAMES_REGEX);
    if (nameCheck && !isCueKeyword(candidate)) {
      const speakerCandidate = nameCheck[0].trim();
      const dashStylesRaw = plainHeaderMatch[3] || "";
      const parenStylesRaw = plainHeaderMatch[4] || "";
      const styles = [...parseDeliveryStyles(dashStylesRaw), ...parseDeliveryStyles(parenStylesRaw)];
      const inlineDialogue = plainHeaderMatch[5].trim();

      return {
        speaker: normalizeSpeakerId(speakerCandidate),
        speakerRaw: speakerCandidate,
        delivery: { styles, emotion: styles[0] ?? null },
        inlineDialogue,
      };
    }
  }

  return null;
}

/**
 * Limpia y normaliza el texto conservadoramente insertando saltos de línea donde
 * ocurran transiciones de locutor inequívocas que hayan perdido el salto por el portapapeles.
 * NUNCA confunde menciones casuales (ej. "Andrea me comentó ayer que...") con cambio de turno.
 */
export function cleanAndNormalizeScriptText(input: string): string {
  if (!input) return "";
  let s = input.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // 1. Limpiar negritas rodeando corchetes: **[SFX: ...]** -> [SFX: ...]
  s = s.replace(/\*{1,2}(\[[^\]]+\])\*{1,2}/g, "$1");

  // 2. Insertar salto de línea antes de acotaciones de producción estructurales (música, sfx, cortinilla)
  // NO romper acotaciones intra-turno ([PAUSA], [RISAS]) dentro del diálogo para preservar breaks SSML
  s = s.replace(/(?<!^)(?<!\n)\s*(?=\[\s*(?:MÚSICA|MUSICA|SFX|EFECTO|CORTE|ENTRADA|SALIDA|FADE|CORTINILLA|VOZ EN OFF|LOCUCIÓN|LOCUCION)[^\]]*\])/gi, "\n");

  // 3. Insertar salto de línea antes de locutores en negritas: **ANDREA**, **EDUARDO — cálido**, etc.
  s = s.replace(/(?<!^)(?<!\n)\s*(?=\*\*(?:EDUARDO|ANDREA|JAVIER|RODRIGO|VALERIA|NARRADOR|CORRESPONSAL|COMERCIAL)[^*]{0,40}\*\*)/gi, "\n");

  // 4. Insertar salto de línea antes de locutores canónicos con dos puntos o guion: EDUARDO: ..., ANDREA — ...
  // Requiere no estar precedido de asteriscos para no romper cabeceras en negritas
  s = s.replace(/(?<!^)(?<!\n)(?<!\*)\s*(?=\b(?:EDUARDO|ANDREA|JAVIER|JAVIER RÍOS|JAVIER RIOS|RODRIGO|RODRIGO TORRES|VALERIA|VALERIA SOTO|NARRADOR)\s*[:–—-])/gi, "\n");

  // 5. Inserción conservadora para locutores sin dos puntos que perdieron el salto en el portapapeles:
  // Requiere puntuación de cierre de frase (. ? ! ” " …), no estar dentro de negritas y mayúscula de arranque
  s = s.replace(
    /(?<=[.!?…”"'])(?<!\*)\s*(?=\b(EDUARDO|ANDREA|JAVIER|RODRIGO|VALERIA)\b\s+[A-ZÁÉÍÓÚÑ¿¡“"])(?!\s+(?:DICE|DIJO|COMENTA|COMENTÓ|PREGUNTA|PREGUNTÓ|RESPONDE|RESPONDIÓ|EXPLICA|EXPLICÓ|AFIRMA|AFIRMÓ)\b)/g,
    "\n"
  );

  return s;
}

/**
 * Limpia el texto de acotaciones de producción en corchetes y direcciones para síntesis TTS.
 * Garantiza que palabras como "pausa", "risas", "música", o direcciones actorales
 * NUNCA sean vocalizadas por el motor de voz.
 */
export function sanitizeTtsText(raw: string): string {
  let s = raw
    .replace(CUE_REGEX, "")
    .replace(/\[[^\]]{1,120}\]/g, "")
    .replace(/^\s*\([^)]+\)\s*/g, "") // Limpiar dirección actoral entre paréntesis al inicio: (cálido, natural)
    .replace(/^\s*[—–\-]\s*[^:\n]+[:\s]*/g, "") // Limpiar dirección actoral tras guion al inicio
    .replace(/\*{1,3}/g, "")
    .replace(/_{1,3}/g, "")
    .replace(/^#+\s*/gm, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;?!])/g, "$1")
    .trim();

  return s;
}

/**
 * Extrae milisegundos de pausa a partir de acotaciones como [PAUSA: 500 ms], [PAUSA 2s], [PAUSA CORTA], [PAUSA LARGA].
 */
export function extractPauseMs(cueText: string): number {
  const msMatch = cueText.match(/(\d+)\s*ms/i);
  if (msMatch) return Math.min(5000, parseInt(msMatch[1], 10));

  const secMatch = cueText.match(/(\d+(?:\.\d+)?)\s*s(?:eg(?:undos?)?)?/i);
  if (secMatch) return Math.min(5000, Math.round(parseFloat(secMatch[1]) * 1000));

  if (/larga/i.test(cueText)) return 1000;
  if (/corta|breve/i.test(cueText)) return 300;
  return 600; // pausa explícita estándar
}

/**
 * Extrae un objeto ProductionEvent a partir de una acotación textual.
 */
export function extractCueEvent(cueStr: string, position: "before" | "inline" | "after"): ProductionEvent {
  const inner = cueStr.replace(/^[\*\s\[]+|[\]\*\s]+$/g, "").trim();
  const lower = inner.toLowerCase();

  if (/pausa|silencio/i.test(lower)) {
    const ms = extractPauseMs(inner);
    return {
      type: position === "inline" ? "break" : "pause",
      position,
      durationMs: ms,
      label: inner,
      cueText: cueStr,
      ssmlTag: `<break time="${ms}ms"/>`,
    };
  }
  if (/risa|risas/i.test(lower)) {
    const ms = /breve/i.test(lower) ? 350 : 500;
    return {
      type: "laughter",
      position,
      durationMs: ms,
      label: inner,
      cueText: cueStr,
      ssmlTag: `<break time="${ms}ms"/>`,
    };
  }
  if (/m[úu]sica|corte|fade|cortinilla|identidad/i.test(lower)) {
    return {
      type: "music",
      position,
      durationMs: 1200,
      label: inner,
      cueText: cueStr,
    };
  }
  if (/sfx|sonido|efecto|ruido|clic|interruptor/i.test(lower)) {
    return {
      type: "sfx",
      position,
      durationMs: 800,
      label: inner,
      cueText: cueStr,
    };
  }
  if (/suspira|titubea/i.test(lower)) {
    return {
      type: "reaction",
      position,
      durationMs: 350,
      label: inner,
      cueText: cueStr,
      ssmlTag: `<break time="350ms"/>`,
    };
  }
  return {
    type: "pause",
    position,
    durationMs: 500,
    label: inner,
    cueText: cueStr,
  };
}

export interface ProcessedDialogue {
  displayText: string;
  ttsText: string;
  ssml: string;
  events: ProductionEvent[];
  leadingPauseMs: number | null;
  trailingPauseMs: number | null;
  hasAuthorPause: boolean;
  inlineDeliveryStyles: string[];
}

/**
 * Procesa el texto de diálogo de un turno:
 * - Aísla acotaciones de producción en corchetes [ ... ]
 * - Extrae direcciones entre paréntesis iniciales (ej. "(cálido) Hola")
 * - Genera SSML limpio con etiquetas <break>
 * - Asegura que ttsText quede 100% libre de acotaciones y direcciones actorales
 */
export function processDialogueCues(rawText: string): ProcessedDialogue {
  let text = rawText.replace(/\s+/g, " ").trim();
  const events: ProductionEvent[] = [];
  const inlineDeliveryStyles: string[] = [];
  let leadingPauseMs: number | null = null;
  let trailingPauseMs: number | null = null;
  let hasAuthorPause = false;

  // 1. Extraer dirección actoral entre paréntesis al inicio del diálogo: "(cálido, natural) ¿Ya estamos?"
  const leadingParenMatch = text.match(/^\(([^)]+)\)\s*/);
  if (leadingParenMatch) {
    inlineDeliveryStyles.push(...parseDeliveryStyles(leadingParenMatch[1]));
    text = text.slice(leadingParenMatch[0].length).trim();
  }

  // 2. Extraer acotaciones iniciales en corchetes: "[PAUSA: 500 ms] Hola"
  const leadingCueRegex = /^(\s*(\*{1,2})?\[[^\]]+\](\*{1,2})?\s*)+/;
  const leadingMatch = text.match(leadingCueRegex);
  if (leadingMatch) {
    const matchedStr = leadingMatch[0];
    const cues = [...matchedStr.matchAll(/\[[^\]]+\]/g)].map((m) => m[0]);
    for (const c of cues) {
      const ev = extractCueEvent(c, "before");
      events.push(ev);
      if (ev.durationMs) {
        leadingPauseMs = Math.max(leadingPauseMs ?? 0, ev.durationMs);
        if (ev.type === "pause") hasAuthorPause = true;
      }
    }
    text = text.slice(matchedStr.length).trim();
  }

  // 3. Extraer acotaciones finales en corchetes: "Nos vemos. [PAUSA]"
  const trailingCueRegex = /(\s*(\*{1,2})?\[[^\]]+\](\*{1,2})?\s*)+$/;
  const trailingMatch = text.match(trailingCueRegex);
  if (trailingMatch) {
    const matchedStr = trailingMatch[0];
    const cues = [...matchedStr.matchAll(/\[[^\]]+\]/g)].map((m) => m[0]);
    for (const c of cues) {
      const ev = extractCueEvent(c, "after");
      events.push(ev);
      if (ev.durationMs) {
        trailingPauseMs = Math.max(trailingPauseMs ?? 0, ev.durationMs);
        if (ev.type === "pause") hasAuthorPause = true;
      }
    }
    text = text.slice(0, -matchedStr.length).trim();
  }

  // 4. Extraer acotaciones internas dentro del diálogo y convertirlas a breaks SSML
  const ssmlParts: string[] = [];
  let lastIndex = 0;
  const regex = new RegExp(CUE_REGEX.source, "gi");
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const textBefore = text.slice(lastIndex, match.index);
    if (textBefore) ssmlParts.push(textBefore);

    const cue = match[0];
    const event = extractCueEvent(cue, "inline");
    events.push(event);
    if (event.type === "break" || event.type === "pause") {
      hasAuthorPause = true;
    }

    if (event.ssmlTag) {
      ssmlParts.push(event.ssmlTag);
    }
    lastIndex = match.index + cue.length;
  }
  const remaining = text.slice(lastIndex);
  if (remaining) ssmlParts.push(remaining);

  const rawSsml = ssmlParts.length > 0 ? ssmlParts.join(" ").replace(/\s+/g, " ").trim() : text;
  const ttsText = sanitizeTtsText(text);

  return {
    displayText: text,
    ttsText,
    ssml: rawSsml,
    events,
    leadingPauseMs,
    trailingPauseMs,
    hasAuthorPause,
    inlineDeliveryStyles,
  };
}

export interface ParseScriptOptions {
  defaultTitle?: string;
  defaultTopic?: string;
}

/**
 * PARSER COMO MÁQUINA DE ESTADOS:
 * 1. Detectar speaker.
 * 2. Crear nuevo turno.
 * 3. Extraer delivery de la cabecera.
 * 4. Acumular exclusivamente diálogo.
 * 5. Detectar eventos [ ... ] y guardarlos aparte.
 * 6. Detectar siguiente speaker -> Cerrar inmediatamente turno actual.
 * 7. Iniciar siguiente turno sin fusionar locutores.
 */
export function parseScript(rawText: string, options: ParseScriptOptions = {}): Script {
  const text = (rawText ?? "").trim();
  if (!text) {
    throw new Error("No se pudo interpretar el guion importado: el texto está vacío.");
  }

  const normalized = cleanAndNormalizeScriptText(text);
  const lines = normalized.split(/\r?\n/);
  const derivedTitle = deriveShortTitle(text);
  const topic = options.defaultTopic || derivedTitle;

  const scenes: Scene[] = [];
  const turns: Turn[] = [];

  let currentSceneTitle = "Apertura y Desarrollo";
  let currentSceneTurns: Turn[] = [];

  // Estado del turno activo
  let activeSpeaker: string | null = null;
  let activeStyles: string[] = [];
  let activeLines: string[] = [];
  let activeEvents: ProductionEvent[] = [];
  let activePauseBeforeMs: number | null = null;
  let activePauseAfterMs: number | null = null;
  let activeAuthorPause = false;
  let activeTransition: string | null = null;

  // Eventos pendientes entre turnos
  let pendingEvents: ProductionEvent[] = [];
  let pendingPauseBeforeMs: number | null = null;
  let pendingAuthorPause = false;
  let pendingTransition: string | null = null;

  const closeCurrentTurn = (keepSpeaker = false) => {
    if (!activeSpeaker || activeLines.length === 0) {
      if (!keepSpeaker) {
        activeSpeaker = null;
        activeStyles = [];
      }
      activeLines = [];
      return;
    }

    const fullRawDialogue = activeLines.join(" ").trim();
    if (!fullRawDialogue) {
      if (!keepSpeaker) {
        activeSpeaker = null;
        activeStyles = [];
      }
      activeLines = [];
      return;
    }

    // Procesar diálogo y separar eventos/SSML/delivery
    const processed = processDialogueCues(fullRawDialogue);

    // Unir estilos declarados en cabecera con estilos parentéticos en línea
    const combinedStyles = [...new Set([...activeStyles, ...processed.inlineDeliveryStyles])];

    const pauseBeforeMs =
      processed.leadingPauseMs ??
      activePauseBeforeMs ??
      (turns.length === 0 ? 0 : activeAuthorPause ? 600 : 200);

    // REGLA CANÓNICA: ÚNICA FUENTE DE VERDAD PARA PAUSAS INTER-TURNO
    // La pausa entre el turno N y N+1 se registra exclusivamente en pauseBeforeMs de N+1.
    // pauseAfterMs se fija en 0 para garantizar matemáticamente que una directiva [PAUSA: X ms]
    // genere exactamente X ms en el timeline y jamás 2X (pauseAfter + pauseBefore).
    const pauseAfterMs = 0;
    if (processed.trailingPauseMs) {
      pendingPauseBeforeMs = processed.trailingPauseMs;
      pendingAuthorPause = true;
    }

    const authorPause = activeAuthorPause || processed.hasAuthorPause;
    const allEvents: ProductionEvent[] = [...activeEvents, ...processed.events];

    const turnIndex = turns.length + 1;
    const isAd = activeSpeaker === "VALERIA" || /comercial|patrocinio|anuncio/i.test(activeSpeaker);

    const delivery: Delivery | undefined =
      combinedStyles.length > 0
        ? {
            styles: combinedStyles,
            emotion: combinedStyles[0] ?? null,
          }
        : undefined;

    const turn: Turn = {
      id: `turn-import-${turnIndex}`,
      speaker: activeSpeaker,
      displayText: processed.displayText,
      ttsText: processed.ttsText,
      delivery,
      ssml: processed.ssml,
      productionEvents: allEvents,
      authorPause,
      relation: null, // Asignado por ProsodyDirector
      section: currentSceneTitle,
      intent: isAd ? "comercial" : "conversacional",
      pauseIntent: authorPause ? "reflective" : "normal",
      pauseBeforeMs,
      pauseAfterMs,
      canOverlap: false,
      claimRefs: [],
      sourceRefs: [],
      transition: activeTransition,
      kind: isAd ? "ad" : "dialogue",
      adSlot: isAd,
      adDurationSec: isAd ? 30 : null,
      sponsorName: null,
      sceneId: `scene-${scenes.length + 1}`,
    };

    turns.push(turn);
    currentSceneTurns.push(turn);

    // Resetear estado del diálogo del turno activo
    if (!keepSpeaker) {
      activeSpeaker = null;
      activeStyles = [];
    }
    activeLines = [];
    activeEvents = [];
    activePauseBeforeMs = null;
    activePauseAfterMs = null;
    activeAuthorPause = false;
    activeTransition = null;
  };

  const closeScene = () => {
    closeCurrentTurn(false);
    if (currentSceneTurns.length > 0) {
      scenes.push({
        id: `scene-${scenes.length + 1}`,
        titulo: currentSceneTitle,
        turns: [...currentSceneTurns],
      });
      currentSceneTurns = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine || /^[*_\-#\s]+$/.test(rawLine)) continue;

    // 1. Título o encabezado de sección/escena (# Escena ..., ## Bloque ...)
    if (rawLine.startsWith("#")) {
      const heading = rawLine.replace(/^#+\s*/, "").trim();
      closeScene();
      currentSceneTitle = heading;
      continue;
    }

    // Metadatos de cabecera como "Título:", "Tema:", etc.
    if (/^(?:T[ií]tulo|Tema|Episodio|Fecha|Formato|Duraci[oó]n)\s*[:–—-]/i.test(rawLine)) {
      continue;
    }

    // 2. Línea que es exclusivamente una acotación ([MÚSICA...], [PAUSA: 500 ms], [RISAS...])
    if (isCueLine(rawLine)) {
      const cueEv = extractCueEvent(rawLine, "before");
      const cueContent = rawLine.replace(/^[\*\s\[]+|[\]\*\s]+$/g, "").trim();
      const isPause = /PAUSA|SILENCIO/i.test(cueContent);
      const isLaughter = /RISA/i.test(cueContent);
      const ms = isPause
        ? extractPauseMs(cueContent)
        : isLaughter
        ? (cueEv.durationMs ?? 500)
        : 600;

      if (activeSpeaker && activeLines.length > 0) {
        // La acotación ocurre justo después de diálogo acumulado:
        // Cierra este nodo de habla para el locutor pero MANTIENE el activeSpeaker para diálogo posterior
        activeEvents.push(cueEv);
        activePauseAfterMs = 0; // Garantiza 0 duplicación: la pausa pertenecerá a pauseBeforeMs del siguiente bloque

        closeCurrentTurn(true /* keepSpeaker = true */);

        // La directiva queda pendiente para dar margen al siguiente bloque (del mismo locutor o del siguiente)
        pendingEvents.push(cueEv);
        pendingPauseBeforeMs = ms;
        pendingAuthorPause = true;
        if (!isPause && !isLaughter) {
          pendingTransition = cueContent.toLowerCase();
        }
      } else {
        // Acotación previa al siguiente turno o acotaciones consecutivas
        pendingEvents.push(cueEv);
        if (isPause) {
          pendingPauseBeforeMs = ms;
          pendingAuthorPause = true;
        } else if (isLaughter) {
          pendingPauseBeforeMs = ms;
          pendingAuthorPause = true;
        } else {
          pendingTransition = cueContent.toLowerCase();
        }
      }
      continue;
    }

    // 3. Detección de cabecera de locutor (SPEAKER / **SPEAKER — styles** / SPEAKER: ...)
    const speakerHeader = parseSpeakerHeader(rawLine);

    if (speakerHeader) {
      // Regla fundamental de la máquina de estados:
      // DETECTAR SIGUIENTE SPEAKER → CERRAR INMEDIATAMENTE EL TURNO ANTERIOR
      closeCurrentTurn(false);

      activeSpeaker = speakerHeader.speaker;
      activeStyles = [...speakerHeader.delivery.styles];
      activeLines = speakerHeader.inlineDialogue ? [speakerHeader.inlineDialogue] : [];

      // Conectar eventos pendientes anteriores a este turno
      activeEvents = [...pendingEvents];
      activePauseBeforeMs = pendingPauseBeforeMs;
      activeAuthorPause = pendingAuthorPause;
      activeTransition = pendingTransition;

      // Limpiar pendientes
      pendingEvents = [];
      pendingPauseBeforeMs = null;
      pendingAuthorPause = false;
      pendingTransition = null;

      continue;
    }

    // 4. Diálogo de continuación dentro del turno activo
    if (activeSpeaker) {
      // Si venimos de una directiva (ej. [PAUSA]) dentro de la intervención de este mismo locutor,
      // hidratar los eventos y pausas pendientes hacia este nuevo bloque de habla
      if (activeLines.length === 0 && pendingEvents.length > 0) {
        activeEvents = [...pendingEvents];
        activePauseBeforeMs = pendingPauseBeforeMs;
        activeAuthorPause = pendingAuthorPause;
        activeTransition = pendingTransition;

        pendingEvents = [];
        pendingPauseBeforeMs = null;
        pendingAuthorPause = false;
        pendingTransition = null;
      }
      activeLines.push(rawLine);
      continue;
    }

    // Si llegamos aquí con texto que no tiene locutor, no es acotación ni cabecera:
    throw new Error(
      `Texto no atribuido a ningún locutor en el guion: "${rawLine.slice(0, 60)}...". Asegúrate de indicar el locutor (ej. EDUARDO:, ANDREA:) antes de sus diálogos.`
    );
  }

  // Cerrar el último turno y escena
  closeScene();

  if (turns.length === 0) {
    throw new Error(
      "No se pudo interpretar el guion importado: no se identificaron líneas de diálogo válidas (ej. EDUARDO: ..., ANDREA: ...)."
    );
  }

  // Crear lista de locutores presentes con sus definiciones canónicas
  const presentSpeakerIds = [...new Set(turns.map((t) => t.speaker))];
  const speakers: SourceRef[] = presentSpeakerIds.map((id) => {
    const def = CANONICAL_SPEAKERS[id] ?? CANONICAL_SPEAKERS.EDUARDO;
    return {
      sourceId: def.id,
      document: def.nombre,
      section: def.rol,
      article: null,
      clause: null,
      procedure: null,
      page: null,
      excerpt: def.nombre,
      claimId: null,
    };
  });

  // Estimar duración en segundos (~150 palabras/minuto -> 2.5 palabras/segundo)
  const totalWords = turns.reduce((acc, t) => acc + (t.ttsText ?? t.displayText ?? "").split(/\s+/).length, 0);
  const totalPauseMs = turns.reduce((acc, t) => acc + (t.pauseBeforeMs ?? 200) + (t.pauseAfterMs ?? 0), 0);
  const estimacionDurSec = Math.round(totalWords / 2.5 + totalPauseMs / 1000);

  return {
    topic,
    formato: "EXPLICADOR",
    nivel: "natural",
    speakers,
    scenes,
    turns,
    cutoff: new Date().toISOString(),
    estimacionDurSec,
    generatedAt: new Date().toISOString(),
    promptVersion: "imported-v2",
  };
}

export type TimelineNodeType = "speech" | "pause" | "music" | "sfx";

export interface TimelineNode {
  type: TimelineNodeType;
  id: string;
  speaker?: string;
  text?: string;
  ttsText?: string;
  durationMs: number;
  cueText?: string;
  label?: string;
  source?: "directive" | "conversational";
}

export interface EpisodeManifest {
  totalSpeechNodes: number;
  totalPauseDirectives: number;
  totalMusicDirectives: number;
  totalSfxDirectives: number;
  totalSpeakableWords: number;
  orphanNodes: number;
  parserErrors: number;
  duplicateSpeechIds: string[];
  missingSpeechIds: string[];
  timeline: TimelineNode[];
}

export function buildEpisodeManifest(rawText: string, script?: Script): EpisodeManifest {
  const parsedScript = script ?? parseScript(rawText);

  // 1. Directivas explícitas encontradas en el texto fuente
  const pauseDirectiveMatches = rawText.match(/\[\s*(?:PAUSA|SILENCIO)[^\]]*\]/gi) || [];
  const musicDirectiveMatches = rawText.match(/\[\s*(?:MÚSICA|MUSICA)[^\]]*\]/gi) || [];
  const sfxDirectiveMatches = rawText.match(/\[\s*(?:SFX|EFECTO|CLIC|INTERRUPTOR)[^\]]*\]/gi) || [];

  const totalSpeechNodes = parsedScript.turns.length;
  const totalPauseDirectives = pauseDirectiveMatches.length;
  const totalMusicDirectives = musicDirectiveMatches.length;
  const totalSfxDirectives = sfxDirectiveMatches.length;

  // 2. Palabras hablables (excluyendo acotaciones eliminadas)
  const totalSpeakableWords = parsedScript.turns.reduce((acc, t) => {
    const words = (t.ttsText || "").trim().split(/\s+/).filter(Boolean);
    return acc + words.length;
  }, 0);

  // 3. Chequeo de IDs duplicados o faltantes
  const seenIds = new Set<string>();
  const duplicateSpeechIds: string[] = [];
  const missingSpeechIds: string[] = [];

  for (const t of parsedScript.turns) {
    if (!t.id) {
      missingSpeechIds.push(`turn-${parsedScript.turns.indexOf(t)}`);
    } else if (seenIds.has(t.id)) {
      duplicateSpeechIds.push(t.id);
    } else {
      seenIds.add(t.id);
    }
  }

  // 4. Verificación de errores de integridad
  let parserErrors = 0;
  for (const t of parsedScript.turns) {
    if (!t.speaker || !t.ttsText) {
      parserErrors++;
    }
  }

  // 5. Construcción canónica del timeline con nodos desacoplados y pausa única
  const timeline: TimelineNode[] = [];
  let nodeIdx = 1;

  for (let i = 0; i < parsedScript.turns.length; i++) {
    const t = parsedScript.turns[i];

    // Pausa anterior al turno: exactamente UNA pausa entre turnos adyacentes
    if (t.pauseBeforeMs && t.pauseBeforeMs > 0) {
      timeline.push({
        type: "pause",
        id: `node-pause-${nodeIdx++}`,
        durationMs: t.pauseBeforeMs,
        source: t.authorPause ? "directive" : "conversational",
        label: t.authorPause ? `Pausa editorial (${t.pauseBeforeMs} ms)` : `Handoff conversacional (${t.pauseBeforeMs} ms)`,
      });
    }

    // Nodo de habla
    timeline.push({
      type: "speech",
      id: t.id,
      speaker: t.speaker,
      text: t.displayText,
      ttsText: t.ttsText,
      durationMs: Math.round(((t.ttsText?.split(/\s+/).filter(Boolean).length || 1) / 2.5) * 1000),
      label: `${t.speaker}: ${(t.ttsText || "").slice(0, 35)}...`,
    });
  }

  return {
    totalSpeechNodes,
    totalPauseDirectives,
    totalMusicDirectives,
    totalSfxDirectives,
    totalSpeakableWords,
    orphanNodes: 0,
    parserErrors,
    duplicateSpeechIds,
    missingSpeechIds,
    timeline,
  };
}

