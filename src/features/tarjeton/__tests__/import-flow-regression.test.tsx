// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { ImportSuccess } from "../components/ImportSuccess"
import { selectSalaryEstimateInputs } from "@/features/salary-estimate/services/salary-estimate-selector"
import { calculateSalaryIncrease } from "@/features/salary-estimate/lib/calculate-salary-increase"
import { SalaryIncreaseCard } from "@/features/salary-estimate/components/SalaryIncreaseCard"
import type { ConfirmTarjetonResponse, ParsedImssTarjeton } from "@/shared/contracts/tarjeton-import"
import type { WorkerContext } from "@/shared/server/worker-context-builder"

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

const mockAuthUser = { id: "user-live-flow-123" }

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: { user: mockAuthUser } },
        error: null,
      })),
      onAuthStateChange: vi.fn((callback: (event: string, session: unknown) => void) => {
        callback("INITIAL_SESSION", { user: mockAuthUser })
        return {
          data: {
            subscription: {
              unsubscribe: vi.fn(),
            },
          },
        }
      }),
    },
  }),
}))

vi.mock("@/features/tarjeton/lib/pdfjs-client", () => ({
  loadPdfDocument: vi.fn(async () => ({
    pdf: { numPages: 1 },
    loadingTask: { destroy: vi.fn() },
  })),
}))

vi.mock("@/features/tarjeton/lib/extract-native-pdf", () => ({
  extractNativePdfText: vi.fn(async () => ({
    items: [{ str: "texto", x: 0, y: 0, page: 1 }],
    pageTexts: [
      "Instituto Mexicano del Seguro Social Tarjeton de Percepciones y Deducciones para el Trabajador Quincena y Periodo de Pago IMSS Delegacion y Matricula Confirmada Conceptos y Deducciones Oficiales",
    ],
  })),
}))

vi.mock("@/features/tarjeton/lib/imss-tarjeton-parser", () => ({
  parseImssTarjeton: vi.fn(async () => ({
    ok: true,
    parsed: mockParsed,
  })),
}))

import { useTarjetonImporter } from "../hooks/useTarjetonImporter"

const mockParsed: ParsedImssTarjeton = {
  schemaVersion: "1.0",
  document: {
    type: "imss_payroll_receipt",
    pageCount: 1,
    periodRaw: "2A-AGO-2026",
    year: 2026,
    month: 8,
    half: 2,
  },
  employee: {
    employeeNumber: "123456",
    fullName: "Trabajador Prueba",
    categoryName: "ENFERMERA GENERAL 80",
  },
  attendance: {},
  vacations: {},
  payroll: {
    earnings: [
      { lineIndex: 0, code: "002", description: "SUELDO BASE", amount: 4000, kind: "earning", confidence: 1, confirmedByUser: true },
      { lineIndex: 1, code: "011", description: "AYUDA RENTA", amount: 3200, kind: "earning", confidence: 1, confirmedByUser: true },
    ],
    deductions: [],
    observations: [],
    totalEarnings: 7200,
    totalDeductions: 0,
    netPay: 7200,
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

const mockResponse: ConfirmTarjetonResponse = {
  schemaVersion: "1.0",
  id: "payslip-test-456",
  duplicate: false,
  profileUpdated: true,
  payrollContextUpdated: true,
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe("Regresión: ImportSuccess y estado fijado vs guardado", () => {
  it("distingue estado guardado del estado fijado: muestra fallo visible al fijar", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 500,
        json: async () => ({ error: "Error interno al fijar tarjetón activo." }),
      }) as unknown as Response),
    )

    render(
      <ImportSuccess
        parsed={mockParsed}
        response={mockResponse}
        onStartOver={vi.fn()}
      />,
    )

    // El tarjetón debe estar en estado "Guardado", NO "Fijado como activo"
    expect(screen.getByText("Guardado")).not.toBeNull()
    expect(screen.queryByText("Fijado como activo")).toBeNull()

    // Intentar fijar el tarjetón
    const pinBtn = screen.getByRole("button", { name: /Usar este tarjetón en mis herramientas/i })
    fireEvent.click(pinBtn)

    await waitFor(() => {
      expect(screen.getByRole("alert")).not.toBeNull()
    })

    expect(screen.getByRole("alert").textContent).toContain("Error interno al fijar tarjetón activo.")
    // Sigue sin estar fijado como activo
    expect(screen.queryByText("Fijado como activo")).toBeNull()
  })

  it("cuando fijar tiene éxito, actualiza estado a 'Fijado como activo'", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      }) as unknown as Response),
    )

    render(
      <ImportSuccess
        parsed={mockParsed}
        response={mockResponse}
        onStartOver={vi.fn()}
      />,
    )

    const pinBtn = screen.getByRole("button", { name: /Usar este tarjetón en mis herramientas/i })
    fireEvent.click(pinBtn)

    await waitFor(() => {
      expect(screen.getByText("Fijado como activo")).not.toBeNull()
    })
    expect(screen.queryByRole("alert")).toBeNull()
  })
})

describe("Regresión: Confirmación exitosa seguida de actualización del aumento", () => {
  it("al confirmar un tarjetón con 002 y 011, el aumento salarial estimado se calcula correctamente", () => {
    // 1. Simulación de contexto antes de confirmar (sin tarjetón)
    const emptyContext = {
      meta: { activePayslipId: null },
      payroll: { recurringConcepts: [] },
    } as unknown as WorkerContext

    const emptyInputs = selectSalaryEstimateInputs(emptyContext)
    expect(emptyInputs.hasPayslip).toBe(false)
    const emptyCalc = calculateSalaryIncrease(emptyInputs)
    expect(emptyCalc.calculationStatus).toBe("missing-payslip")
    expect(emptyCalc.estimatedFortnightlyIncrease).toBe(0)

    // 2. Simulación de contexto post-confirmación (con tarjetón activo 2A-AGO-2026 y líneas confirmadas)
    const updatedContext = {
      meta: {
        activePayslipId: "payslip-test-456",
        activePayslipPeriod: "2A-AGO-2026",
      },
      payroll: {
        latestPeriod: "2A-AGO-2026",
        recurringConcepts: [
          { conceptCode: "002", lastAmount: 10000, lastSeenAt: "2A-AGO-2026", payslipId: "payslip-test-456", confirmed: true },
          { conceptCode: "011", lastAmount: 8215, lastSeenAt: "2A-AGO-2026", payslipId: "payslip-test-456", confirmed: true },
        ],
      },
    } as unknown as WorkerContext

    const updatedInputs = selectSalaryEstimateInputs(updatedContext)
    expect(updatedInputs.hasPayslip).toBe(true)
    expect(updatedInputs.tabular).toBe(10000)
    expect(updatedInputs.concept11).toBe(8215)

    // 3. El selector alimenta calculateSalaryIncrease
    const updatedCalc = calculateSalaryIncrease(updatedInputs)
    expect(updatedCalc.calculationStatus).toBe("ok")
    // 10000 * 2.9% = 290; 8215 * 86.05% * 2.9% = 639.55; total = 929.55
    expect(updatedCalc.estimatedFortnightlyIncrease).toBe(929.55)
  })

  it("flujo real del importador: confirmación exitosa vía useTarjetonImporter emite evento, vuelve a consultar /api/worker-context y actualiza SalaryIncreaseCard", async () => {
    let payslipConfirmed = false
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown) => {
        const urlStr = String(url)
        if (urlStr.includes("/api/tarjeton/confirm")) {
          payslipConfirmed = true
          return {
            ok: true,
            status: 200,
            json: async () => ({
              id: "payslip-live-789",
              duplicate: false,
              profileUpdated: true,
              payrollContextUpdated: true,
            }),
          } as unknown as Response
        }

        if (urlStr.includes("/api/worker-context")) {
          if (!payslipConfirmed) {
            return {
              ok: true,
              status: 200,
              json: async () => ({
                userId: "user-live-flow-123",
                meta: { activePayslipId: null, userId: "user-live-flow-123" },
                payroll: { recurringConcepts: [] },
              }),
            } as unknown as Response
          }

          return {
            ok: true,
            status: 200,
            json: async () => ({
              userId: "user-live-flow-123",
              meta: { activePayslipId: "payslip-live-789", activePayslipPeriod: "2A-AGO-2026", userId: "user-live-flow-123" },
              payroll: {
                latestPeriod: "2A-AGO-2026",
                recurringConcepts: [
                  { conceptCode: "002", lastAmount: 10000, lastSeenAt: "2A-AGO-2026", confirmed: true, payslipId: "payslip-live-789" },
                  { conceptCode: "011", lastAmount: 8215, lastSeenAt: "2A-AGO-2026", confirmed: true, payslipId: "payslip-live-789" },
                ],
              },
            }),
          } as unknown as Response
        }

        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true }),
        } as unknown as Response
      }),
    )

    function RealImportFlowHarness({ userId }: { userId: string }) {
      const { state, start, confirm } = useTarjetonImporter(null, userId)
      return (
        <div>
          <SalaryIncreaseCard />
          <button
            data-testid="start-import-btn"
            onClick={() => {
              const fakeFile = new File(["%PDF-1.4 contenido de prueba"], "tarjeton.pdf", {
                type: "application/pdf",
              })
              void start(fakeFile)
            }}
          >
            Iniciar importación
          </button>
          {state.step === "review" && (
            <button
              data-testid="confirm-tarjeton-btn"
              onClick={() => {
                void confirm({
                  profileUpdates: { matricula: false },
                  acknowledgeTotalDifference: false,
                  authorizeServerStorage: true,
                  conceptLines: mockParsed.payroll.earnings.map((e) => ({
                    lineIndex: e.lineIndex,
                    code: e.code,
                    description: e.description,
                    amount: e.amount,
                    kind: "earning" as const,
                    confidence: e.confidence ?? 1,
                    confirmedByUser: true,
                  })),
                })
              }}
            >
              Confirmar tarjetón
            </button>
          )}
          {state.step === "done" && <span data-testid="done-badge">Confirmado</span>}
        </div>
      )
    }

    // 1. Antes de confirmar: se muestra la invitación en la tarjeta
    render(<RealImportFlowHarness userId="user-live-flow-123" />)
    await screen.findByTestId("salary-estimate-empty")
    expect(screen.getByText("Importa tu tarjetón más reciente para conocer tu aumento salarial estimado.")).not.toBeNull()

    // 2. Se inicia el procesamiento del tarjetón mediante el hook real
    const startBtn = screen.getByTestId("start-import-btn")
    fireEvent.click(startBtn)

    // 3. El importador pasa a fase 'review' y habilita la confirmación
    const confirmBtn = await screen.findByTestId("confirm-tarjeton-btn")
    expect(confirmBtn).not.toBeNull()

    // 4. El usuario confirma el tarjetón con useTarjetonImporter.confirm()
    fireEvent.click(confirmBtn)

    // 5. El hook real ejecuta confirmTarjetonClient, emite el evento 'nomina_payslip_updated'
    // y completa su ciclo a step: 'done'
    await screen.findByTestId("done-badge")

    // 6. SalaryIncreaseCard detecta el evento de actualización emitido por el importador,
    // vuelve a consultar /api/worker-context y actualiza el cálculo en vivo a $929.55
    await waitFor(() => {
      expect(screen.getByTestId("salary-estimate-card")).not.toBeNull()
    })
    expect(document.body.textContent).toContain("$929.55")
  })
})
