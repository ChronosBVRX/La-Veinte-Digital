// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { SalaryIncreaseCard } from "../components/SalaryIncreaseCard"

function mockWorkerContext(concepts: Array<{ conceptCode: string; lastAmount: number }>) {
  const context = {
    meta: { activePayslipId: "payslip-1", activePayslipPeriod: "2026-Q1", activeEmployeeNumber: "123456", selectionMode: "AUTO_LATEST", contextRevision: 1 },
    profile: { matricula: "123456" },
    payroll: { latestPeriod: "2026-Q1", recurringConcepts: concepts.map((c) => ({ ...c, source: "last_payslip", confirmed: true })) },
  }
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => context }) as Response))
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

describe("SalaryIncreaseCard", () => {
  it("10. muestra el mensaje exacto con el aumento y nunca menciona 8.55% ni definitivo", async () => {
    mockWorkerContext([
      { conceptCode: "002", lastAmount: 10000 },
      { conceptCode: "011", lastAmount: 8215 },
    ])
    render(<SalaryIncreaseCard />)
    const msg = await screen.findByText(/Con esta actualización salarial ganarías aproximadamente .* más brutos por quincena\./)
    expect(msg).toBeTruthy()
    expect(document.body.textContent).toContain("$929.55")
    expect(document.body.textContent).not.toContain("8.55%")
    expect(document.body.textContent).not.toContain("resultado es definitivo")
    expect(document.body.textContent).not.toContain("pago definitivo")
    expect(document.body.textContent).toContain("sujeta al convenio salarial definitivo")
  })

  it("11. sin tarjetón muestra invitación a importar y nunca $0.00", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => null }) as unknown as Response))
    render(<SalaryIncreaseCard />)
    const invite = await screen.findByText("Importa tu tarjetón más reciente para conocer tu aumento salarial estimado.")
    expect(invite).toBeTruthy()
    expect(document.body.textContent).not.toContain("$0.00")
    const link = document.querySelector('a[href="/profile/mi-informacion-laboral"]')
    expect(link).toBeTruthy()
  })

  it("11b. con tabular pero sin Concepto 11 pide revisar en lugar de calcular", async () => {
    mockWorkerContext([{ conceptCode: "002", lastAmount: 10000 }])
    render(<SalaryIncreaseCard />)
    await screen.findByText("Importa tu tarjetón más reciente para conocer tu aumento salarial estimado.")
    expect(document.body.textContent).not.toContain("$0.00")
  })

  it("12. no rompe el diseño móvil: sin anchos fijos ni overflow horizontal", async () => {
    window.innerWidth = 360
    mockWorkerContext([
      { conceptCode: "002", lastAmount: 10000 },
      { conceptCode: "011", lastAmount: 8215 },
    ])
    const { container } = render(<SalaryIncreaseCard />)
    await screen.findByTestId("salary-estimate-card")
    const elements = container.querySelectorAll("*")
    elements.forEach((el) => {
      const style = (el as HTMLElement).style
      if (style?.width?.endsWith("px")) {
        expect(parseInt(style.width, 10)).toBeLessThanOrEqual(360)
      }
    })
    const card = container.querySelector('[data-testid="salary-estimate-card"]') as HTMLElement | null
    expect(card?.style.maxWidth).toBe("100%")
  })
})
