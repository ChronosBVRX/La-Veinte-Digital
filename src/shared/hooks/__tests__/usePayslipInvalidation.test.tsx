// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { usePayslipInvalidation } from "../usePayslipInvalidation"

const refreshMock = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: refreshMock,
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
}))

describe("usePayslipInvalidation", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    refreshMock.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("invoca router.refresh() tras el debounce cuando refreshRouter es true", () => {
    renderHook(() => usePayslipInvalidation({ refreshRouter: true, debounceMs: 100 }))

    act(() => {
      window.dispatchEvent(new CustomEvent("nomina_payslip_updated"))
    })

    // Antes de terminar el debounce no debe haberse llamado
    expect(refreshMock).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(refreshMock).toHaveBeenCalledTimes(1)
  })

  it("invoca el callback onInvalidate cuando se proporciona", () => {
    const onInvalidate = vi.fn()
    renderHook(() => usePayslipInvalidation({ onInvalidate, debounceMs: 80 }))

    act(() => {
      window.dispatchEvent(new CustomEvent("nomina_payslip_updated"))
    })

    expect(onInvalidate).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(80)
    })

    expect(onInvalidate).toHaveBeenCalledTimes(1)
    expect(refreshMock).not.toHaveBeenCalled()
  })

  it("aplica debounce ante múltiples emisiones rápidas para evitar múltiples refresh", () => {
    const onInvalidate = vi.fn()
    renderHook(() => usePayslipInvalidation({ refreshRouter: true, onInvalidate, debounceMs: 150 }))

    act(() => {
      window.dispatchEvent(new CustomEvent("nomina_payslip_updated"))
      vi.advanceTimersByTime(50)
      window.dispatchEvent(new CustomEvent("nomina_payslip_updated"))
      vi.advanceTimersByTime(50)
      window.dispatchEvent(new CustomEvent("nomina_payslip_updated"))
    })

    // Han pasado 100ms totales pero solo 0ms desde el último evento
    expect(refreshMock).not.toHaveBeenCalled()
    expect(onInvalidate).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(150)
    })

    // Debe llamarse exactamente una sola vez
    expect(refreshMock).toHaveBeenCalledTimes(1)
    expect(onInvalidate).toHaveBeenCalledTimes(1)
  })

  it("limpia el listener y cancela timeouts pendientes al desmontar", () => {
    const onInvalidate = vi.fn()
    const { unmount } = renderHook(() =>
      usePayslipInvalidation({ refreshRouter: true, onInvalidate, debounceMs: 100 }),
    )

    act(() => {
      window.dispatchEvent(new CustomEvent("nomina_payslip_updated"))
    })

    // Desmontar antes de que expire el timer
    unmount()

    act(() => {
      vi.advanceTimersByTime(200)
      // Disparar otro evento después de desmontar
      window.dispatchEvent(new CustomEvent("nomina_payslip_updated"))
      vi.advanceTimersByTime(200)
    })

    expect(refreshMock).not.toHaveBeenCalled()
    expect(onInvalidate).not.toHaveBeenCalled()
  })
})
