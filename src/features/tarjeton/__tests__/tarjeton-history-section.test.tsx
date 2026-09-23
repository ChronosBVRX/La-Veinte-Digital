// @vitest-environment jsdom
import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { TarjetonHistorySection, type PreviousImport } from "../components/TarjetonHistorySection"

const mockPush = vi.fn()
const mockRefresh = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}))

describe("TarjetonHistorySection - Borrado y Selección Activa Desconocida", () => {
  const sampleImports: PreviousImport[] = [
    {
      id: "payslip-1",
      periodRaw: "2026-16",
      extractionMethod: "native_text",
      globalConfidence: 1,
      createdAt: "2026-08-31T12:00:00Z",
      totalNet: 8000,
      employeeName: "TRABAJADOR EJEMPLO",
    },
    {
      id: "payslip-2",
      periodRaw: "2026-15",
      extractionMethod: "native_text",
      globalConfidence: 1,
      createdAt: "2026-08-15T12:00:00Z",
      totalNet: 8000,
      employeeName: "TRABAJADOR EJEMPLO",
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  it("muestra el aviso de borrado exitoso con selección activa desconocida, sin convertirla a AUTO_LATEST por defecto", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        deleted: true,
        activePayslipId: null,
        selectionMode: "UNKNOWN",
        activePayslipUpdated: false,
        warning: "El tarjetón fue eliminado, pero ocurrió un problema al actualizar la preferencia activa.",
      }),
    })
    global.fetch = mockFetch as unknown as typeof fetch

    render(
      <TarjetonHistorySection
        imports={sampleImports}
        activePayslipId="payslip-1"
        latestPayslipId="payslip-1"
        selectionMode="AUTO_LATEST"
      />
    )

    // Inicialmente payslip-1 tiene badge ACTIVO
    expect(screen.getByText("ACTIVO")).toBeTruthy()

    // Abrimos el modal de confirmación de eliminación para payslip-1
    const deleteTriggers = screen.getAllByRole("button", { name: "Eliminar tarjetón" })
    fireEvent.click(deleteTriggers[0])

    // Confirmamos la eliminación en el diálogo de confirmación
    const confirmButtons = screen.getAllByRole("button", { name: "Eliminar tarjetón" })
    const confirmDeleteBtn = confirmButtons[confirmButtons.length - 1]
    fireEvent.click(confirmDeleteBtn)

    // Verificamos que se llame al endpoint de borrado
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/tarjeton/delete", expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ id: "payslip-1" }),
      }))
    })

    // Comprobamos que el aviso de éxito con advertencia visible aparezca en pantalla
    await waitFor(() => {
      const notice = screen.getByRole("status")
      expect(notice).toBeTruthy()
      expect(notice.textContent).toContain(
        "El tarjetón fue eliminado, pero ocurrió un problema al actualizar la preferencia activa."
      )
    })

    // payslip-1 fue eliminado de la lista
    expect(screen.queryByTestId("tarjeton-card-payslip-1")).toBeNull()

    // payslip-2 sigue presente pero NO debe tener el badge ACTIVO (no se convirtió automáticamente a AUTO_LATEST)
    expect(screen.getByTestId("tarjeton-card-payslip-2")).toBeTruthy()
    expect(screen.queryByText("ACTIVO")).toBeNull()

    // El tarjetón restante debe ofrecer la acción de activarlo manualmente
    expect(screen.getByRole("button", { name: "Usar este tarjetón" })).toBeTruthy()
  })

  it("muestra el aviso de advertencia cuando se elimina el único tarjetón y la lista queda vacía", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        deleted: true,
        activePayslipId: null,
        selectionMode: "UNKNOWN",
        activePayslipUpdated: false,
        warning: "El tarjetón fue eliminado, pero ocurrió un problema al actualizar la preferencia activa.",
      }),
    })
    global.fetch = mockFetch as unknown as typeof fetch

    render(
      <TarjetonHistorySection
        imports={[sampleImports[0]]}
        activePayslipId="payslip-1"
        latestPayslipId="payslip-1"
        selectionMode="AUTO_LATEST"
      />
    )

    const deleteTriggers = screen.getAllByRole("button", { name: "Eliminar tarjetón" })
    fireEvent.click(deleteTriggers[0])

    const confirmButtons = screen.getAllByRole("button", { name: "Eliminar tarjetón" })
    const confirmDeleteBtn = confirmButtons[confirmButtons.length - 1]
    fireEvent.click(confirmDeleteBtn)

    await waitFor(() => {
      const notice = screen.getByRole("status")
      expect(notice).toBeTruthy()
      expect(notice.textContent).toContain(
        "El tarjetón fue eliminado, pero ocurrió un problema al actualizar la preferencia activa."
      )
    })

    // Muestra el estado vacío pero con el aviso superior
    expect(screen.getByText("No tienes tarjetones importados")).toBeTruthy()
  })
})
