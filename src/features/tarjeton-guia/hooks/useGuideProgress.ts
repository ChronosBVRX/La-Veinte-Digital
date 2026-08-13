"use client"

import { useCallback, useEffect, useState } from "react"
import { hydrateProgress, markLessonComplete as applyCompletion, type GuideProgress } from "@/features/tarjeton-guia/lib/progress"

const STORAGE_KEY = "guia_tarjeton_progress_v1"

function loadProgress(): GuideProgress {
  if (typeof window === "undefined") return hydrateProgress(null)
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? hydrateProgress(JSON.parse(raw)) : hydrateProgress(null)
  } catch {
    return hydrateProgress(null)
  }
}

/** Progreso educativo persistido en localStorage (desacoplado y sin migraciones). */
export function useGuideProgress() {
  const [progress, setProgress] = useState<GuideProgress>(hydrateProgress(null))
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratación local desde localStorage (solo cliente)
    setProgress(loadProgress())
    setHydrated(true)
  }, [])

  const persist = useCallback((next: GuideProgress) => {
    setProgress(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      /* almacenamiento no disponible: se ignora */
    }
  }, [])

  const completeLesson = useCallback(
    (lessonId: string, pathId: string) => {
      persist(applyCompletion(loadProgress(), lessonId, pathId))
    },
    [persist]
  )

  return { progress, hydrated, completeLesson }
}
