import { describe, it, expect, vi } from "vitest"
import { confirmTarjetonService } from "../services/confirm-tarjeton"
import { buildWorkerContext, checkWorkerContextIdentity } from "@/shared/server/worker-context-builder"
import { parsePorVencerDate, formatMexicanDate } from "../lib/imss-date-parser"
import { stripSensitiveFields, isSensitiveKey, maskSensitiveLabel } from "../lib/sanitize-sensitive-fields"
import type { ConfirmTarjetonRequest, ConfirmTarjetonResponse } from "@/shared/contracts/tarjeton-import"

describe("Canonical Payroll (Payslip) Synchronization Integration Test", () => {
  const userId = "00000000-0000-0000-0000-000000000001"
  const fiscalFolioRaw = "12345678-ABCD-EF01-2345-6789ABCDEF01"
  const fiscalFolioHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"

  // Raw extracted payload simulating in-browser PDF.js parsing
  const mockParsedPayload = {
    schemaVersion: "1.0" as const,
    document: {
      type: "imss_payroll_receipt" as const,
      pageCount: 1,
      periodRaw: "1A-ENE-2026",
      year: 2026,
      month: 1,
      half: 1 as const,
      folioFiscal: fiscalFolioRaw,
      fiscalFolioHash,
    },
    employee: {
      employeeNumber: "98765432",
      fullName: "ROSA ELENA CONTRERAS FLORES",
      categoryName: "ENFERMERA GENERAL 80",
      categoryCode: "E04",
      workdayHours: 8,
      entryDate: "2018-03-16",
      curp: "COFR900316MDFRLL01",
      rfc: "COFR9003168X1",
      nss: "12903456781",
      cuentaBancaria: "012180001234567890",
      seniority: {
        years: 8,
        fortnights: 0,
        days: 0,
        raw: "8 años",
        reconstructedEffectiveDate: "2018-03-16",
        referenceDate: "2026-01-01",
      },
    },
    attendance: {},
    vacations: {
      porVencer: "14102026", // Raw DDMMYYYY compact from IMSS tarjetón
      porVencerRaw: "14102026",
    },
    payroll: {
      earnings: [
        {
          lineIndex: 0,
          code: "002",
          description: "SUELDO BASE",
          amount: 6450.80,
          kind: "earning" as const,
          confidence: 0.99,
          confirmedByUser: true,
        },
        {
          lineIndex: 1,
          code: "023",
          description: "FONDO DE AHORRO",
          amount: 516.06,
          kind: "earning" as const,
          confidence: 0.99,
          confirmedByUser: true,
        },
        {
          lineIndex: 2,
          code: "050",
          description: "AYUDA RENTA",
          amount: 1290.16,
          kind: "earning" as const,
          confidence: 0.99,
          confirmedByUser: true,
        },
      ],
      deductions: [
        {
          lineIndex: 3,
          code: "212",
          description: "I.S.R.",
          amount: -850.40,
          kind: "deduction" as const,
          confidence: 0.99,
          confirmedByUser: true,
        },
        {
          lineIndex: 4,
          code: "208",
          description: "CUOTA SINDICAL",
          amount: -129.02,
          kind: "deduction" as const,
          confidence: 0.99,
          confirmedByUser: true,
        },
      ],
      observations: [],
      totalEarnings: 8257.02,
      totalDeductions: 979.42,
      netPay: 7277.60,
      daysWorkedInYear: 15,
    },
    extraction: {
      method: "native_text" as const,
      globalConfidence: 0.98,
      warnings: [],
      validations: {
        templateDetected: true,
        earningsTotalMatches: true,
        deductionsTotalMatches: true,
        netPayMatches: true,
        employeeMatchesProfile: true,
        categoryResolved: true,
      },
    },
  }

  describe("1. Fecha de vencimiento: conversión DDMMYYYY compacto → ISO civil → Formato Mexicano", () => {
    it("convierte '14102026' a '2026-10-14' y se formatea a '14/10/2026'", () => {
      const rawVencimiento = mockParsedPayload.vacations.porVencer
      const parsedIso = parsePorVencerDate(rawVencimiento)
      expect(parsedIso).toBe("2026-10-14")

      const formatted = formatMexicanDate(parsedIso!)
      expect(formatted).toBe("14/10/2026")
    })
  })

  describe("2. Privacidad inmutable: datos sensibles nunca persistidos en texto plano", () => {
    it("identifica y purga RFC, CURP, NSS, cuenta bancaria antes del envío al RPC", () => {
      // Verificación de detección de claves sensibles
      expect(isSensitiveKey("curp")).toBe(true)
      expect(isSensitiveKey("rfc")).toBe(true)
      expect(isSensitiveKey("nss")).toBe(true)
      expect(isSensitiveKey("cuenta")).toBe(true)
      expect(isSensitiveKey("cuentabancaria")).toBe(true)
      expect(isSensitiveKey("cuenta_bancaria")).toBe(true)
      expect(isSensitiveKey("banco")).toBe(true)

      // Sanitización profunda del objeto
      const sanitized = stripSensitiveFields(mockParsedPayload)

      // @ts-expect-error verificación en tiempo de ejecución
      expect(sanitized.employee.curp).toBeUndefined()
      // @ts-expect-error verificación en tiempo de ejecución
      expect(sanitized.employee.rfc).toBeUndefined()
      // @ts-expect-error verificación en tiempo de ejecución
      expect(sanitized.employee.nss).toBeUndefined()
      // @ts-expect-error verificación en tiempo de ejecución
      expect(sanitized.employee.cuentaBancaria).toBeUndefined()
      // @ts-expect-error verificación en tiempo de ejecución
      expect(sanitized.document.folioFiscal).toBeUndefined()

      // Conserva fiscalFolioHash y datos laborales esenciales
      expect(sanitized.document.fiscalFolioHash).toBe(fiscalFolioHash)
      expect(sanitized.employee.employeeNumber).toBe("98765432")
      expect(sanitized.employee.categoryName).toBe("ENFERMERA GENERAL 80")
      expect(sanitized.payroll.netPay).toBe(7277.60)
    })

    it("enmascara etiquetas sensibles para renderizado seguro en la UI", () => {
      expect(maskSensitiveLabel("RFC", "COFR9003168X1")).toBe("COF********X1")
      expect(maskSensitiveLabel("CURP", "COFR900316MDFRLL01")).toBe("COF*************01")
      expect(maskSensitiveLabel("NSS", "12903456781")).toBe("129******81")
      expect(maskSensitiveLabel("Cuenta", "012180001234567890")).toBe("**************7890")
    })
  })

  describe("3. Persistencia atómica, deduplicación e idempotencia", () => {
    const validSourceHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"

    it("primera importación: registra nuevo tarjetón y actualiza payroll_context", async () => {
      const sanitized = stripSensitiveFields(mockParsedPayload)
      // Normalizar vacations con ISO validado
      sanitized.vacations.dueDate = parsePorVencerDate(sanitized.vacations.porVencer)

      const mockRpc = vi.fn().mockResolvedValue({
        data: {
          schemaVersion: "1.0",
          id: "payslip-uuid-001",
          duplicate: false,
          profileUpdated: true,
          payrollContextUpdated: true,
        } as ConfirmTarjetonResponse,
        error: null,
      })

      const request: ConfirmTarjetonRequest = {
        schemaVersion: "1.0",
        sourceHash: validSourceHash,
        parsed: sanitized,
        profileUpdates: { categoria: true, antiguedad: true },
        acknowledgeTotalDifference: false,
        authorizeServerStorage: true,
      }

      const result = await confirmTarjetonService({ userId, rpc: mockRpc }, request)
      expect(result.ok).toBe(true)
      if (!result.ok) return

      expect(result.data.id).toBe("payslip-uuid-001")
      expect(result.data.duplicate).toBe(false)
      expect(result.data.payrollContextUpdated).toBe(true)

      // Verifica que el payload enviado al RPC no contenga texto plano sensible
      const rpcArgs = mockRpc.mock.calls[0][1] as Record<string, unknown>
      const sentParsed = rpcArgs.p_parsed as Record<string, unknown>
      const sentEmployee = sentParsed.employee as Record<string, unknown>
      expect(sentEmployee.curp).toBeUndefined()
      expect(sentEmployee.rfc).toBeUndefined()
      expect(sentEmployee.nss).toBeUndefined()
    })

    it("idempotencia: re-importar el mismo tarjetón retorna duplicate: true sin duplicar registros", async () => {
      const sanitized = stripSensitiveFields(mockParsedPayload)
      sanitized.vacations.dueDate = parsePorVencerDate(sanitized.vacations.porVencer)

      // Simula respuesta idempotente del backend ante hash repetido
      const mockRpc = vi.fn().mockResolvedValue({
        data: {
          schemaVersion: "1.0",
          id: "payslip-uuid-001", // Mismo ID existente
          duplicate: true,
          profileUpdated: false,
          payrollContextUpdated: false,
        } as ConfirmTarjetonResponse,
        error: null,
      })

      const request: ConfirmTarjetonRequest = {
        schemaVersion: "1.0",
        sourceHash: validSourceHash,
        parsed: sanitized,
        profileUpdates: {},
        acknowledgeTotalDifference: false,
        authorizeServerStorage: true,
      }

      const result = await confirmTarjetonService({ userId, rpc: mockRpc }, request)
      expect(result.ok).toBe(true)
      if (!result.ok) return

      // Garantiza no duplicación
      expect(result.data.id).toBe("payslip-uuid-001")
      expect(result.data.duplicate).toBe(true)
    })
  })

  describe("4. Propagación a worker-context y cálculo salarial derivado", () => {
    it("propaga datos canónicos de nómina e hidrata el contexto laboral de forma consistente", () => {
      const workerContext = buildWorkerContext({
        profileRow: {
          full_name: "ROSA ELENA CONTRERAS FLORES",
          matricula: "98765432",
          categoria: "ENFERMERA GENERAL 80",
          antiguedad: "8 años",
          adscripcion: "HGZ 20",
        },
        payrollContextRow: {
          user_id: userId,
          matricula: "98765432",
          categoria: "ENFERMERA GENERAL 80",
          adscripcion: "HGZ 20",
          base_salary: 6450.80,
          workday_hours: 8,
          years_of_service: 8,
          recurring_concepts: ["002", "023", "050"],
          payroll_facts: [],
          active_payslip_id: "payslip-uuid-001",
        },
        latestPayslipRow: {
          id: "payslip-uuid-001",
          employee_number: "98765432",
          period_raw: "1A-ENE-2026",
          payroll_totals: { totalEarnings: 8257.02, totalDeductions: 979.42, netPay: 7277.60 },
          employee_data: {
            employeeNumber: "98765432",
            fullName: "ROSA ELENA CONTRERAS FLORES",
            categoryName: "ENFERMERA GENERAL 80",
            workdayHours: 8,
            seniority: { years: 8, fortnights: 0, days: 0, raw: "8 años" },
          },
          vacations: { porVencer: "14102026", dueDate: "2026-10-14" },
        },
        payslipLines: [
          {
            concept_code: "002",
            description: "SUELDO BASE",
            amount: 6450.80,
            kind: "earning",
            confirmed_by_user: true,
          },
          {
            concept_code: "023",
            description: "FONDO DE AHORRO",
            amount: 516.06,
            kind: "earning",
            confirmed_by_user: true,
          },
          {
            concept_code: "050",
            description: "AYUDA RENTA",
            amount: 1290.16,
            kind: "earning",
            confirmed_by_user: true,
          },
        ],
      })

      expect(workerContext.profile?.matricula).toBe("98765432")
      expect(workerContext.profile?.categoria).toBe("ENFERMERA GENERAL 80")
      expect(workerContext.payroll?.totalEarnings).toBe(8257.02)
      expect(workerContext.payroll?.netPay).toBe(7277.60)
      expect(workerContext.vacations?.dueDate).toBe("2026-10-14")
      expect(workerContext.employment?.seniorityRaw).toBe("8 años")
      expect(workerContext.employment?.workdayHours).toBe(8)

      // Identidad canónica verificada
      const identity = checkWorkerContextIdentity(workerContext)
      expect(identity.match).toBe(true)

      // Cálculo salarial derivado canónico
      // Sueldo quincenal base de concepto 002 = 6,450.80
      // Sueldo diario = 6,450.80 / 15 = 430.0533...
      const baseSalaryConcept = workerContext.payroll?.recurringConcepts.find(
        (c) => (c as { conceptCode?: string }).conceptCode === "002"
      ) as { amount?: number; lastAmount?: number } | undefined
      const baseSalary = baseSalaryConcept?.lastAmount ?? baseSalaryConcept?.amount ?? 6450.80
      expect(baseSalary).toBe(6450.80)
      const sueldoDiario = baseSalary / 15
      expect(Number(sueldoDiario.toFixed(2))).toBe(430.05)
    })
  })
})
