// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useEscritoEditorHistory } from "../hooks/useEscritoEditorHistory"

describe("useEscritoEditorHistory (Undo/Redo & Aislamiento de Historial)", () => {
  it("permite escribir manualmente, registrar cambios y deshacer/rehacer", () => {
    vi.useFakeTimers()
    const { result } = renderHook(() =>
      useEscritoEditorHistory("Texto inicial", "draft_1")
    )

    expect(result.current.text).toBe("Texto inicial")
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(false)

    // Edición 1
    act(() => {
      result.current.setText("Texto inicial con párrafo 1.")
    })
    act(() => {
      vi.advanceTimersByTime(350)
    })

    expect(result.current.text).toBe("Texto inicial con párrafo 1.")
    expect(result.current.canUndo).toBe(true)

    // Edición 2
    act(() => {
      result.current.setText("Texto inicial con párrafo 1 y párrafo 2.")
    })
    act(() => {
      vi.advanceTimersByTime(350)
    })

    expect(result.current.text).toBe("Texto inicial con párrafo 1 y párrafo 2.")

    // Deshacer (Undo) -> vuelve a Edición 1
    act(() => {
      result.current.undo()
    })
    expect(result.current.text).toBe("Texto inicial con párrafo 1.")
    expect(result.current.canRedo).toBe(true)

    // Deshacer (Undo) de nuevo -> vuelve al Texto inicial
    act(() => {
      result.current.undo()
    })
    expect(result.current.text).toBe("Texto inicial")

    // Rehacer (Redo) -> avanza a Edición 1
    act(() => {
      result.current.redo()
    })
    expect(result.current.text).toBe("Texto inicial con párrafo 1.")

    // Rehacer (Redo) de nuevo -> avanza a Edición 2
    act(() => {
      result.current.redo()
    })
    expect(result.current.text).toBe("Texto inicial con párrafo 1 y párrafo 2.")

    vi.useRealTimers()
  })

  it("abrir dos documentos distintos reinicia el historial y no mezcla estados", () => {
    vi.useFakeTimers()
    let currentDraftId = "draft_doc_A"
    let currentText = "Contenido del documento A"

    const { result, rerender } = renderHook(() =>
      useEscritoEditorHistory(currentText, currentDraftId)
    )

    // Editamos documento A
    act(() => {
      result.current.setText("Contenido del documento A modificado")
    })
    act(() => {
      vi.advanceTimersByTime(350)
    })

    expect(result.current.canUndo).toBe(true)

    // Cambiamos a documento B
    currentDraftId = "draft_doc_B"
    currentText = "Contenido original del documento B"
    rerender()

    // El historial debe haberse reiniciado por completo para el documento B
    expect(result.current.text).toBe("Contenido original del documento B")
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(false)

    vi.useRealTimers()
  })

  it("captura atajos de teclado Ctrl+Z y Ctrl+Y", () => {
    const { result } = renderHook(() =>
      useEscritoEditorHistory("Texto base", "draft_kbd")
    )

    act(() => {
      result.current.pushImmediateSnapshot("Texto modificado")
    })
    expect(result.current.text).toBe("Texto modificado")

    // Simular evento Ctrl+Z
    const preventDefaultZ = vi.fn()
    act(() => {
      result.current.handleKeyDown({
        key: "z",
        ctrlKey: true,
        metaKey: false,
        shiftKey: false,
        altKey: false,
        preventDefault: preventDefaultZ,
      } as unknown as React.KeyboardEvent<HTMLTextAreaElement>)
    })

    expect(preventDefaultZ).toHaveBeenCalled()
    expect(result.current.text).toBe("Texto base")

    // Simular evento Ctrl+Y
    const preventDefaultY = vi.fn()
    act(() => {
      result.current.handleKeyDown({
        key: "y",
        ctrlKey: true,
        metaKey: false,
        shiftKey: false,
        altKey: false,
        preventDefault: preventDefaultY,
      } as unknown as React.KeyboardEvent<HTMLTextAreaElement>)
    })

    expect(preventDefaultY).toHaveBeenCalled()
    expect(result.current.text).toBe("Texto modificado")
  })
})
