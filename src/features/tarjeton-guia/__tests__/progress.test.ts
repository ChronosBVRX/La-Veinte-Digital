import { describe, it, expect } from "vitest"
import {
  EMPTY_PROGRESS,
  hydrateProgress,
  completionForPath,
  percentForPath,
  lessonIdsForPath,
  markLessonComplete,
  isLessonComplete,
  PRIMEROS_PASOS_LESSON_IDS,
} from "../lib/progress"

describe("hydrateProgress", () => {
  it("tolera datos corruptos y devuelve estado vacío", () => {
    expect(hydrateProgress(null)).toEqual(EMPTY_PROGRESS)
    expect(hydrateProgress("garbage")).toEqual(EMPTY_PROGRESS)
    expect(hydrateProgress({ completed: "no", started: 42, updatedAt: 7 })).toEqual(EMPTY_PROGRESS)
  })

  it("filtra entradas no string", () => {
    const p = hydrateProgress({ completed: ["a", 1, null], started: ["x"], updatedAt: "2026-01-01" })
    expect(p.completed).toEqual(["a"])
    expect(p.started).toEqual(["x"])
  })
})

describe("completionForPath / percentForPath", () => {
  it("calcula avance de Primeros pasos", () => {
    const progress = {
      ...EMPTY_PROGRESS,
      completed: ["que-es-tarjeton", "estructura"],
    }
    const result = completionForPath(progress, "primeros-pasos")
    expect(result.completed).toBe(2)
    expect(result.total).toBe(PRIMEROS_PASOS_LESSON_IDS.length)
    expect(percentForPath(progress, "primeros-pasos", PRIMEROS_PASOS_LESSON_IDS.length)).toBe(25)
  })

  it("marca ruta completa al completar todas", () => {
    const progress = {
      ...EMPTY_PROGRESS,
      completed: [...PRIMEROS_PASOS_LESSON_IDS],
    }
    expect(completionForPath(progress, "primeros-pasos").done).toBe(true)
    expect(percentForPath(progress, "primeros-pasos", PRIMEROS_PASOS_LESSON_IDS.length)).toBe(100)
  })
})

describe("markLessonComplete", () => {
  it("agrega la lección y registra la ruta iniciada", () => {
    let progress = EMPTY_PROGRESS
    progress = markLessonComplete(progress, "que-es-tarjeton", "primeros-pasos")
    expect(isLessonComplete(progress, "que-es-tarjeton")).toBe(true)
    expect(progress.started).toContain("primeros-pasos")
    expect(progress.lastLessonId).toBe("que-es-tarjeton")
    expect(progress.updatedAt).toEqual(expect.any(String))
  })

  it("es idempotente", () => {
    let progress = markLessonComplete(EMPTY_PROGRESS, "codigos", "primeros-pasos")
    progress = markLessonComplete(progress, "codigos", "primeros-pasos")
    expect(progress.completed.filter((x) => x === "codigos").length).toBe(1)
  })
})

describe("lessonIdsForPath", () => {
  it("genera ids consistentes para Primeros pasos", () => {
    const ids = lessonIdsForPath("primeros-pasos", PRIMEROS_PASOS_LESSON_IDS.length)
    expect(ids[0]).toBe("que-es-tarjeton")
    expect(ids.length).toBe(PRIMEROS_PASOS_LESSON_IDS.length)
  })
})
