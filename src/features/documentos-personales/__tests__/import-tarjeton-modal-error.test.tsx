// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { ImportTarjetonModal } from "../components/ImportTarjetonModal"
import type { ParsedImssTarjeton } from "@/shared/contracts/tarjeton-import"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

vi.mock("@/shared/components/ui/FullscreenPortal", () => ({
  FullscreenPortal: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div>{children}</div> : null,
}))

vi.mock("@/features/tarjeton/components/Review", () => ({
  Review: () => <div data-testid="mock-review-component">Formulario de Revisión</div>,
}))

const mockParsed: ParsedImssTarjeton = {
  schemaVersion: "1.0",
  document: {
    type: "imss_payroll_receipt",
    pageCount: 1,
    periodRaw: "2A-AGO-2026",
  },
  employee: {
    fullName: "Trabajador Prueba",
  },
  attendance: {},
  vacations: {},
  payroll: {
    earnings: [],
    deductions: [],
    observations: [],
    totalEarnings: 5000,
    totalDeductions: 1000,
    netPay: 4000,
  },
  extraction: {
    method: "native_text",
    globalConfidence: 1,
    warnings: [],
    validations: {
      templateDetected: true,
      earningsTotalMatches: null,
      deductionsTotalMatches: null,
      netPayMatches: null,
      employeeMatchesProfile: null,
      categoryResolved: null,
    },
  },
}

vi.mock("@/features/tarjeton/hooks/useTarjetonImporter", () => ({
  useTarjetonImporter: () => ({
    state: {
      step: "review",
      error: {
        code: "totals_mismatch",
        message: "Los totales del tarjetón no coinciden con la suma de conceptos.",
      },
      parsed: mockParsed,
      fileName: "tarjeton.pdf",
    },
    start: vi.fn(),
    confirm: vi.fn(),
    reset: vi.fn(),
  }),
}))

describe("ImportTarjetonModal - Error en etapa de revisión", () => {
  it("muestra el mensaje de error visible con role='alert' durante el paso de revisión", () => {
    render(
      <ImportTarjetonModal
        open={true}
        file={new File(["%PDF-1.4"], "tarjeton.pdf", { type: "application/pdf" })}
        profile={null}
        userId="user-test-123"
        onClose={vi.fn()}
      />,
    )

    // El formulario de revisión debe estar visible
    expect(screen.getByTestId("mock-review-component")).not.toBeNull()

    // El contenedor de alerta de error debe ser visible durante review
    const alert = screen.getByRole("alert")
    expect(alert).not.toBeNull()
    expect(alert.textContent).toContain("Los totales del tarjetón no coinciden con la suma de conceptos.")
    expect(alert.textContent).toContain("totals_mismatch")
  })
})
