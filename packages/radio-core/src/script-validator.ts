/**
 * script-validator.ts — Validador de integridad estructural de guiones para AI Radio Studio.
 *
 * Realiza una auditoría estricta antes de habilitar la generación de audio TTS:
 * - Existencia de turnos y locutores canónicos válidos.
 * - Ausencia de texto de diálogo vacío.
 * - Ausencia de contaminación cruzada de locutores (etiquetas incrustadas en diálogo de otro personaje).
 * - Ausencia de direcciones de interpretación (delivery) contaminando ttsText.
 * - Ausencia de acotaciones de producción sin procesar en ttsText.
 * - Coherencia del reparto de personajes.
 */

import type { Script } from "@la-veinte/studio-contract";

export const CANONICAL_SPEAKER_IDS = ["EDUARDO", "ANDREA", "JAVIER", "NARRADOR", "RODRIGO", "VALERIA"] as const;

export interface ScriptIntegrityIssue {
  severity: "error" | "warning";
  turnIndex?: number;
  turnId?: string;
  speaker?: string;
  message: string;
  detail?: string;
}

export interface ScriptIntegrityStats {
  totalTurns: number;
  speakerCounts: Record<string, number>;
  totalPauses: number;
  totalMusicEvents: number;
  totalSfxEvents: number;
  totalLaughterEvents: number;
  deliveryDirectivesCount: number;
}

export interface ScriptIntegrityReport {
  isValid: boolean;
  canProduceAudio: boolean;
  errors: ScriptIntegrityIssue[];
  warnings: ScriptIntegrityIssue[];
  stats: ScriptIntegrityStats;
}

/**
 * Valida la integridad completa de un guion antes de permitir la producción de audio.
 */
export function validateScriptIntegrity(script: Script | null | undefined): ScriptIntegrityReport {
  const errors: ScriptIntegrityIssue[] = [];
  const warnings: ScriptIntegrityIssue[] = [];

  const stats: ScriptIntegrityStats = {
    totalTurns: 0,
    speakerCounts: {},
    totalPauses: 0,
    totalMusicEvents: 0,
    totalSfxEvents: 0,
    totalLaughterEvents: 0,
    deliveryDirectivesCount: 0,
  };

  if (!script || !script.turns || script.turns.length === 0) {
    errors.push({
      severity: "error",
      message: "El guion no contiene intervenciones de diálogo.",
      detail: "No se identificaron turnos válidos con locutores canónicos.",
    });
    return {
      isValid: false,
      canProduceAudio: false,
      errors,
      warnings,
      stats,
    };
  }

  stats.totalTurns = script.turns.length;

  // Lista de nombres canónicos para detectar contaminación cruzada
  const canonicalNames = ["EDUARDO", "ANDREA", "JAVIER", "RODRIGO", "VALERIA"];

  for (let idx = 0; idx < script.turns.length; idx++) {
    const t = script.turns[idx];
    const turnNum = idx + 1;
    const speakerNorm = (t.speaker || "").trim().toUpperCase();

    // 1. Contador por locutor
    stats.speakerCounts[speakerNorm] = (stats.speakerCounts[speakerNorm] || 0) + 1;

    // 2. Contador de pausas y eventos
    if (t.authorPause || (t.pauseBeforeMs && t.pauseBeforeMs > 100) || (t.pauseAfterMs && t.pauseAfterMs > 100)) {
      stats.totalPauses++;
    }
    if (t.productionEvents && t.productionEvents.length > 0) {
      for (const ev of t.productionEvents) {
        if (ev.type === "pause" || ev.type === "break") stats.totalPauses++;
        else if (ev.type === "music") stats.totalMusicEvents++;
        else if (ev.type === "sfx") stats.totalSfxEvents++;
        else if (ev.type === "laughter") stats.totalLaughterEvents++;
      }
    }

    // 3. Contador de direcciones actorales (delivery)
    if (t.delivery?.styles && t.delivery.styles.length > 0) {
      stats.deliveryDirectivesCount += t.delivery.styles.length;
    }

    // 4. Verificación de locutor canónico válido
    const isValidSpeaker = CANONICAL_SPEAKER_IDS.some(
      (c) => speakerNorm === c || speakerNorm.includes(c)
    );
    if (!isValidSpeaker) {
      errors.push({
        severity: "error",
        turnIndex: idx,
        turnId: t.id,
        speaker: t.speaker,
        message: `Turno ${turnNum} asignado a un locutor no reconocido ("${t.speaker}").`,
        detail: "Los locutores válidos son Eduardo, Andrea, Javier, Rodrigo y Valeria.",
      });
    }

    // 5. Diálogo vacío
    const ttsClean = (t.ttsText || "").trim();
    if (!ttsClean && !t.adSlot) {
      errors.push({
        severity: "error",
        turnIndex: idx,
        turnId: t.id,
        speaker: t.speaker,
        message: `El Turno ${turnNum} (${t.speaker}) tiene texto de diálogo vacío.`,
      });
    }

    // 6. Contaminación cruzada de locutores dentro de ttsText
    const otherSpeakers = canonicalNames.filter(
      (s) => s !== speakerNorm && !(s === "JAVIER" && speakerNorm === "NARRADOR")
    );

    for (const other of otherSpeakers) {
      // Detección estricta: etiqueta seguida de dos puntos, guion o mayúscula de arranque
      const colonPattern = new RegExp(`\\b${other}\\s*[:–—-]`, "i");
      const blockPattern = new RegExp(`(?<=[.!?…”"']|^)\\s*\\b${other}\\b\\s+[A-ZÁÉÍÓÚÑ¿¡“"]`);

      if (colonPattern.test(ttsClean) || blockPattern.test(ttsClean)) {
        errors.push({
          severity: "error",
          turnIndex: idx,
          turnId: t.id,
          speaker: t.speaker,
          message: `Se encontraron posibles etiquetas de ${other} dentro de una intervención de ${t.speaker} (Turno ${turnNum}).`,
          detail: `Fragmento detectado: "${ttsClean.slice(0, 70)}..."`,
        });
      }
    }

    // 7. Contaminación de acotaciones de delivery en ttsText
    if (t.delivery?.styles && t.delivery.styles.length > 0) {
      for (const st of t.delivery.styles) {
        const styleWord = st.toLowerCase().trim();
        if (styleWord.length >= 4) {
          const startsWithStyle = new RegExp(`^${styleWord}\\b`, "i").test(ttsClean);
          if (startsWithStyle) {
            errors.push({
              severity: "error",
              turnIndex: idx,
              turnId: t.id,
              speaker: t.speaker,
              message: `Dirección de interpretación ("${st}") detectada dentro del texto hablado del Turno ${turnNum} (${t.speaker}).`,
              detail: `El texto para voz comienza con: "${ttsClean.slice(0, 50)}"`,
            });
          }
        }
      }
    }

    // 8. Contaminación de corchetes de producción sin procesar en ttsText
    const unparsedCueMatch = ttsClean.match(/\[\s*(?:PAUSA|MÚSICA|MUSICA|SFX|RISAS|EFECTO|FADE|CORTE)[^\]]*\]/i);
    if (unparsedCueMatch) {
      errors.push({
        severity: "error",
        turnIndex: idx,
        turnId: t.id,
        speaker: t.speaker,
        message: `Acotaciones de producción sin procesar ("${unparsedCueMatch[0]}") detectadas en el texto hablado del Turno ${turnNum}.`,
      });
    }
  }

  // 9. Coherencia global de personajes
  const uniqueSpeakers = Object.keys(stats.speakerCounts);
  if (stats.totalTurns >= 4 && uniqueSpeakers.length < 2) {
    warnings.push({
      severity: "warning",
      message: `El guion tiene ${stats.totalTurns} intervenciones pero solo se detectó un locutor (${uniqueSpeakers[0]}).`,
      detail: "Revisa si el formato del guion omitió las etiquetas de los otros personajes.",
    });
  }

  const isValid = errors.length === 0;

  return {
    isValid,
    canProduceAudio: isValid,
    errors,
    warnings,
    stats,
  };
}
