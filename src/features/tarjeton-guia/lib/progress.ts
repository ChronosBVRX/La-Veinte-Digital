/**
 * Progreso educativo de la Guía de mi Tarjetón.
 *
 * Persistencia local simple y desacoplada (sin migraciones). Las piezas puras
 * viven aquí para poder probarlas; el acceso a localStorage está en el hook.
 */
export interface GuideProgress {
  /** Lecciones completadas por ruta. */
  completed: string[]
  /** Rutas iniciadas. */
  started: string[]
  lastLessonId?: string
  /** Timestamp (ISO) del último avance. */
  updatedAt: string
}

export const EMPTY_PROGRESS: GuideProgress = {
  completed: [],
  started: [],
  updatedAt: new Date(0).toISOString(),
}

export function lessonIdsForPath(pathId: string, total: number): string[] {
  return Array.from({ length: total }, (_, i) => (pathId === "primeros-pasos" ? PRIMEROS_PASOS_LESSON_IDS[i] ?? String(i) : `${pathId}:${i}`))
}

export const PRIMEROS_PASOS_LESSON_IDS = [
  "que-es-tarjeton",
  "estructura",
  "percepciones-deducciones",
  "codigos",
  "incidencia",
  "vacaciones",
  "observaciones",
  "conservar",
]

export function percentForPath(progress: GuideProgress, pathId: string, totalLessons: number): number {
  if (totalLessons === 0) return 0
  const pathCompletion = completionForPath(progress, pathId)
  return Math.round((pathCompletion.completed / totalLessons) * 100)
}

export function completionForPath(progress: GuideProgress, pathId: string): { completed: number; total: number; done: boolean } {
  const ids = pathId === "primeros-pasos" ? PRIMEROS_PASOS_LESSON_IDS : []
  const total = ids.length
  const completed = ids.filter((id) => progress.completed.includes(id)).length
  return { completed, total, done: completed === total && total > 0 }
}

export function markLessonComplete(progress: GuideProgress, lessonId: string, pathId: string): GuideProgress {
  const completed = progress.completed.includes(lessonId) ? progress.completed : [...progress.completed, lessonId]
  const started = progress.started.includes(pathId) ? progress.started : [...progress.started, pathId]
  return {
    ...progress,
    completed,
    started,
    lastLessonId: lessonId,
    updatedAt: new Date().toISOString(),
  }
}

export function isLessonComplete(progress: GuideProgress, lessonId: string): boolean {
  return progress.completed.includes(lessonId)
}

/** Mezcla una progresión guardada con la vacía tolerando datos corruptos. */
export function hydrateProgress(raw: unknown): GuideProgress {
  if (!raw || typeof raw !== "object") return EMPTY_PROGRESS
  const p = raw as Partial<GuideProgress>
  return {
    completed: Array.isArray(p.completed) ? p.completed.filter((x): x is string => typeof x === "string") : [],
    started: Array.isArray(p.started) ? p.started.filter((x): x is string => typeof x === "string") : [],
    lastLessonId: typeof p.lastLessonId === "string" ? p.lastLessonId : undefined,
    updatedAt: typeof p.updatedAt === "string" ? p.updatedAt : EMPTY_PROGRESS.updatedAt,
  }
}
