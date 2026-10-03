// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { VacationReturnCalculator } from "../components/VacationReturnCalculator"

// Mock useLiveWorkerContext
vi.mock("@/shared/hooks/useLiveWorkerContext", () => ({
  useLiveWorkerContext: () => null,
}))

// Mock Supabase client
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
    },
  }),
}))

describe("VacationReturnCalculator Component", () => {
  it("renderiza el título y los controles de configuración", () => {
    render(<VacationReturnCalculator initialContext={null} />)

    expect(screen.getByText(/Calculadora de Fecha de Regreso de Vacaciones/i)).toBeDefined()
    expect(screen.getByText(/Cláusula 47 y 46 CCT/i)).toBeDefined()
    expect(screen.getByText(/Fecha de inicio de vacaciones/i)).toBeDefined()
    expect(screen.getByText(/¿Tienes días a cuenta de vacaciones tomados previamente\?/i)).toBeDefined()
  })

  it("calcula y muestra la fecha oficial de reanudación de labores", () => {
    render(<VacationReturnCalculator initialContext={null} />)

    expect(screen.getByText(/Fecha Oficial de Reanudación de Labores/i)).toBeDefined()
    expect(screen.getAllByText(/Último día de vacaciones:/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/Descanso continuo total:/i)).toBeDefined()
  })

  it("permite modificar días a cuenta de vacaciones y actualiza los días hábiles", () => {
    render(<VacationReturnCalculator initialContext={null} />)

    // El input numérico de días a cuenta
    const accountInput = screen.getByRole("spinbutton")
    fireEvent.change(accountInput, { target: { value: "3" } })

    expect(screen.getByText(/Se descontaron/i)).toBeDefined()
    expect(screen.getAllByText(/3 días/i).length).toBeGreaterThanOrEqual(1)
  })

  it("ofrece el botón para copiar los datos para el formato de solicitud", () => {
    render(<VacationReturnCalculator initialContext={null} />)

    const copyBtn = screen.getByText(/Copiar datos para formato de solicitud/i)
    expect(copyBtn).toBeDefined()
  })
})
