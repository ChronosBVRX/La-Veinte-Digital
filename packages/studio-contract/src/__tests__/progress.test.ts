import { describe, it, expect } from "vitest";
import {
  CANONICAL_PROGRESS_STATES,
  CanonicalProgressStateSchema,
  PRODUCTION_PHASES,
  ProductionPhaseSchema,
  calculateOverallPercent,
  EpisodeProductionProgressSchema,
  TurnUpdatePayloadSchema,
  TurnRegeneratePayloadSchema,
  TurnAuditionPayloadSchema,
  CANONICAL_PROGRESS_LABELS,
} from "../progress";

describe("studio-contract progress", () => {
  it("contiene todos los estados canónicos esperados", () => {
    const expected = [
      "idle",
      "investigando",
      "generando_guion",
      "generando_voces",
      "mezclando_audio",
      "planificando_visuales",
      "renderizando_video",
      "exportando",
      "completado",
      "error",
      "cancelado",
    ];

    for (const state of expected) {
      expect(CANONICAL_PROGRESS_STATES).toContain(state);
      expect(CanonicalProgressStateSchema.parse(state)).toBe(state);
      expect(CANONICAL_PROGRESS_LABELS[state as keyof typeof CANONICAL_PROGRESS_LABELS]).toBeDefined();
    }
  });

  it("calcula el progreso global correctamente para audio_video", () => {
    // 0% al inicio
    expect(calculateOverallPercent("audio_video", {})).toBe(0);

    // Solo investigacion completa (10%)
    expect(calculateOverallPercent("audio_video", { investigacion: 1.0 })).toBe(10);

    // Investigacion + Guion completos (10% + 15% = 25%)
    expect(calculateOverallPercent("audio_video", { investigacion: 1.0, guion: 1.0 })).toBe(25);

    // Todo al 100% da 100%
    expect(
      calculateOverallPercent("audio_video", {
        investigacion: 1.0,
        guion: 1.0,
        voces: 1.0,
        audio: 1.0,
        visual: 1.0,
        video: 1.0,
        exportacion: 1.0,
      })
    ).toBe(100);

    // Mitad de video (10 + 15 + 20 + 15 + 10 + 12.5 = 82.5 -> 83%)
    expect(
      calculateOverallPercent("audio_video", {
        investigacion: 1.0,
        guion: 1.0,
        voces: 1.0,
        audio: 1.0,
        visual: 1.0,
        video: 0.5,
      })
    ).toBe(83);
  });

  it("calcula el progreso global correctamente para audio_only", () => {
    // Todo al 100% en audio_only da 100% (15 + 25 + 30 + 25 + 5)
    expect(
      calculateOverallPercent("audio_only", {
        investigacion: 1.0,
        guion: 1.0,
        voces: 1.0,
        audio: 1.0,
        visual: 1.0, // ignora visual/video en audio_only
        video: 1.0,
        exportacion: 1.0,
      })
    ).toBe(100);
  });

  it("valida el payload de actualización de turno", () => {
    const valid = {
      turnId: "turn-123",
      speakerId: "ANDREA",
      text: "Texto corregido",
      locked: true,
    };
    expect(TurnUpdatePayloadSchema.parse(valid)).toEqual(valid);

    const partial = {
      turnId: "turn-456",
      locked: true,
    };
    expect(TurnUpdatePayloadSchema.parse(partial)).toEqual(partial);
  });

  it("valida el esquema canónico completo de EpisodeProductionProgress", () => {
    const progress = {
      projectId: "proj-1",
      state: "renderizando_video",
      phase: "video",
      overallPercent: 78,
      currentStagePercent: 50,
      currentAction: "Renderizando escena 103 de 129...",
      counts: {
        current: 103,
        total: 129,
        unit: "escenas",
      },
      timings: {
        startedAt: "2026-09-14T03:00:00.000Z",
        updatedAt: "2026-09-14T03:05:00.000Z",
        elapsedSeconds: 300,
        estimatedRemainingSeconds: 90,
      },
      format: "audio_video",
      orientation: "9:16",
      outputs: {
        videoPath9x16: "data/tts/video/proj-1/episodio-proj-1-9x16.mp4",
        folderPath: "data/tts/video/proj-1",
      },
    };

    const parsed = EpisodeProductionProgressSchema.parse(progress);
    expect(parsed.projectId).toBe("proj-1");
    expect(parsed.overallPercent).toBe(78);
    expect(parsed.counts?.current).toBe(103);
  });
});
