import { useState, useRef, useEffect, useCallback } from "react"

const MAX_HISTORY = 100
const DEBOUNCE_MS = 300

interface HistoryState {
  past: string[]
  present: string
  future: string[]
}

export function useEscritoEditorHistory(initialText: string, draftId: string) {
  const [history, setHistory] = useState<HistoryState>({
    past: [],
    present: initialText,
    future: [],
  })

  const currentDraftIdRef = useRef(draftId)
  const initialTextRef = useRef(initialText)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const lastRecordedPresentRef = useRef(initialText)

  // Si cambia el documento (draftId), reiniciamos completamente el historial
  useEffect(() => {
    if (draftId !== currentDraftIdRef.current) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
      currentDraftIdRef.current = draftId
      initialTextRef.current = initialText
      lastRecordedPresentRef.current = initialText
      setHistory({
        past: [],
        present: initialText,
        future: [],
      })
    }
  }, [draftId, initialText])

  const pushImmediateSnapshot = useCallback((newText: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }

    setHistory((prev) => {
      if (prev.present === newText) return prev
      const newPast = [...prev.past, prev.present].slice(-MAX_HISTORY)
      lastRecordedPresentRef.current = newText
      return {
        past: newPast,
        present: newText,
        future: [],
      }
    })
  }, [])

  const handleChangeText = useCallback((newText: string) => {
    // Actualizar inmediatamente el presente en pantalla para que el textarea sea reactivo y fluido
    setHistory((prev) => ({
      ...prev,
      present: newText,
    }))

    // Agrupar los cambios de escritura rápida con debounce
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(() => {
      setHistory((prev) => {
        if (prev.present === lastRecordedPresentRef.current) return prev
        const newPast = [...prev.past, lastRecordedPresentRef.current].slice(-MAX_HISTORY)
        lastRecordedPresentRef.current = prev.present
        return {
          past: newPast,
          present: prev.present,
          future: [],
        }
      })
      debounceTimerRef.current = null
    }, DEBOUNCE_MS)
  }, [])

  const undo = useCallback(() => {
    // Si hay un debounce pendiente, consolidarlo primero
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }

    setHistory((prev) => {
      if (prev.past.length === 0) return prev
      const previous = prev.past[prev.past.length - 1]
      const newPast = prev.past.slice(0, prev.past.length - 1)
      lastRecordedPresentRef.current = previous
      return {
        past: newPast,
        present: previous,
        future: [prev.present, ...prev.future],
      }
    })
  }, [])

  const redo = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }

    setHistory((prev) => {
      if (prev.future.length === 0) return prev
      const next = prev.future[0]
      const newFuture = prev.future.slice(1)
      const newPast = [...prev.past, prev.present].slice(-MAX_HISTORY)
      lastRecordedPresentRef.current = next
      return {
        past: newPast,
        present: next,
        future: newFuture,
      }
    })
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const isMac = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent)
      const modifier = isMac ? e.metaKey : e.ctrlKey

      if (modifier && !e.altKey) {
        if (e.key === "z" && !e.shiftKey) {
          e.preventDefault()
          undo()
        } else if ((e.key === "z" && e.shiftKey) || e.key === "y") {
          e.preventDefault()
          redo()
        }
      }
    },
    [undo, redo]
  )

  const isDirty = history.present !== initialText

  return {
    text: history.present,
    setText: handleChangeText,
    pushImmediateSnapshot,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    handleKeyDown,
    isDirty,
  }
}
