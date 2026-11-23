import { describe, it, expect } from "vitest"
import {
  decodeSiapDate,
  decodeSiapDateRange,
  decodeSiapFortnight,
  decodeQiFortnight,
  decodeGuardiaDetails,
  decodeFaltaDetails,
  decodeVacacionesDetails,
  decodeRetroactivoDetails,
} from "../lib/siap-incidence-decoder"
import type { GuidePayslip } from "../lib/types"

describe("siap-incidence-decoder", () => {
  describe("decodeSiapDate", () => {
    it("decodifica formato continuo AAAAMMDD de 8 dígitos", () => {
      const res = decodeSiapDate("20260614")
      expect(res).not.toBeNull()
      expect(res?.isoDate).toBe("2026-06-14")
      expect(res?.dayOfWeek).toBe("domingo")
      expect(res?.formatted).toBe("domingo 14 de junio de 2026")
    })

    it("decodifica formato continuo DDMMYYYY de 8 dígitos", () => {
      const res = decodeSiapDate("14062026")
      expect(res).not.toBeNull()
      expect(res?.isoDate).toBe("2026-06-14")
      expect(res?.formatted).toBe("domingo 14 de junio de 2026")
    })

    it("decodifica formato continuo AAMMDD de 6 dígitos", () => {
      const res = decodeSiapDate("260614")
      expect(res).not.toBeNull()
      expect(res?.isoDate).toBe("2026-06-14")
      expect(res?.formatted).toBe("domingo 14 de junio de 2026")
    })

    it("decodifica formato continuo DDMMAA de 6 dígitos como 160926 al 16 de septiembre de 2026", () => {
      const res = decodeSiapDate("160926")
      expect(res).not.toBeNull()
      expect(res?.isoDate).toBe("2026-09-16")
      expect(res?.formatted).toBe("miércoles 16 de septiembre de 2026")
    })

    it("decodifica con separadores civiles", () => {
      const res = decodeSiapDate("14/06/2026")
      expect(res).not.toBeNull()
      expect(res?.isoDate).toBe("2026-06-14")
    })

    it("decodifica mes nombrado", () => {
      const res = decodeSiapDate("14-JUN-2026")
      expect(res).not.toBeNull()
      expect(res?.isoDate).toBe("2026-06-14")
    })

    it("extrae la fecha contenida dentro de notas libres de guardia o incidencia", () => {
      const res = decodeSiapDate("GUARDIA DEVENGADA 20260715 TURNO 3")
      expect(res).not.toBeNull()
      expect(res?.isoDate).toBe("2026-07-15")
      expect(res?.dayOfWeek).toBe("miércoles")
    })

    it("decodifica fechas de guardia con formato DDMMYYYY como 16092026", () => {
      const res = decodeSiapDate("16092026")
      expect(res).not.toBeNull()
      expect(res?.isoDate).toBe("2026-09-16")
      expect(res?.formatted).toBe("miércoles 16 de septiembre de 2026")
    })

    it("retorna null para valores inválidos o vacíos", () => {
      expect(decodeSiapDate("")).toBeNull()
      expect(decodeSiapDate(null)).toBeNull()
      expect(decodeSiapDate("99999999")).toBeNull()
    })
  })

  describe("decodeSiapDateRange", () => {
    it("decodifica rangos de fechas de guardia en formato 16092026-16092026 (mismo día festivo)", () => {
      const res = decodeSiapDateRange("16092026-16092026")
      expect(res).not.toBeNull()
      expect(res?.isSingleDay).toBe(true)
      expect(res?.startDate.isoDate).toBe("2026-09-16")
      expect(res?.formatted).toBe("miércoles 16 de septiembre de 2026")
    })

    it("decodifica rangos de fechas distintas", () => {
      const res = decodeSiapDateRange("15092026-16092026")
      expect(res).not.toBeNull()
      expect(res?.isSingleDay).toBe(false)
      expect(res?.startDate.isoDate).toBe("2026-09-15")
      expect(res?.endDate.isoDate).toBe("2026-09-16")
      expect(res?.formatted).toContain("15 de septiembre")
      expect(res?.formatted).toContain("16 de septiembre")
    })
  })

  describe("decodeQiFortnight", () => {
    it("decodifica leyendas de Quincena de Incidencia como QI 18", () => {
      const qi18 = decodeQiFortnight("QI 18", 2026)
      expect(qi18).not.toBeNull()
      expect(qi18?.fortnight).toBe(18)
      expect(qi18?.half).toBe(2)
      expect(qi18?.month).toBe(9)
      expect(qi18?.label).toBe("2.ª quincena de septiembre de 2026 (Quincena 18)")
    })
  })

  describe("decodeSiapFortnight", () => {
    it("decodifica quincenas en formato 7 dígitos AAAASSS", () => {
      const q14 = decodeSiapFortnight("2026014")
      expect(q14).not.toBeNull()
      expect(q14?.year).toBe(2026)
      expect(q14?.fortnight).toBe(14)
      expect(q14?.half).toBe(2)
      expect(q14?.month).toBe(7)
      expect(q14?.label).toBe("2.ª quincena de julio de 2026")

      const q1 = decodeSiapFortnight("2026001")
      expect(q1?.label).toBe("1.ª quincena de enero de 2026")
    })
  })

  describe("decodeGuardiaDetails", () => {
    it("interpreta guardia extraordinaria 037 con fecha y horas", () => {
      const guardia = decodeGuardiaDetails(
        [
          {
            conceptCode: "037",
            amount: 1450.5,
            units: 8,
            controlNumber: "20260614",
            notes: "GUARDIA NOCTURNA T3",
          },
        ],
        { code: "037", description: "Tiempo extraordinario", amount: 1450.5, kind: "earning" }
      )

      expect(guardia).not.toBeNull()
      expect(guardia?.code).toBe("037")
      expect(guardia?.date?.formatted).toBe("domingo 14 de junio de 2026")
      expect(guardia?.units).toBe(8)
      expect(guardia?.unitType).toBe("horas")
      expect(guardia?.shiftType).toBe("nocturna")
      expect(guardia?.summary).toContain("domingo 14 de junio de 2026")
      expect(guardia?.summary).toContain("nocturna")
    })

    it("interpreta concepto 035 Guardias con formato 16092026-16092026 y 8 horas", () => {
      const guardia = decodeGuardiaDetails(
        [
          {
            conceptCode: "035",
            amount: 1470.56,
            units: 8,
            notes: "16092026-16092026",
          },
        ],
        { code: "035", description: "Guardias", amount: 1470.56, kind: "earning" }
      )

      expect(guardia).not.toBeNull()
      expect(guardia?.code).toBe("035")
      expect(guardia?.conceptName).toBe("Guardias")
      expect(guardia?.units).toBe(8)
      expect(guardia?.unitType).toBe("horas")
      expect(guardia?.incidenceText).toContain("16 de septiembre de 2026")
      expect(guardia?.summary).toContain("16 de septiembre de 2026")
      expect(guardia?.summary).toContain("8 horas")
      expect(guardia?.summary).toContain("Guardias (035)")
    })

    it("clasifica guardia devengada pasada como ya cobrada sin necesidad de reclamación", () => {
      const periodInfo = {
        year: 2026,
        month: 10,
        half: 2 as const,
        fortnight: 20,
        label: "2.ª quincena de octubre de 2026",
        shortLabel: "2.ª de octubre 2026",
        dateRangeText: "del 16 al 31 de octubre de 2026",
        estimatedPaymentDate: "30 de octubre de 2026",
        laggingFortnight: {
          year: 2026,
          month: 9,
          half: 2 as const,
          fortnight: 18,
          label: "2.ª quincena de septiembre de 2026",
          shortLabel: "2.ª de septiembre 2026",
          dateRangeText: "del 16 al 30 de septiembre de 2026",
        },
      }

      const guardia = decodeGuardiaDetails(
        [
          {
            conceptCode: "035",
            amount: 1470.56,
            units: 8,
            notes: "16092026-16092026",
          },
        ],
        { code: "035", description: "Guardias", amount: 1470.56, kind: "earning" },
        periodInfo
      )

      expect(guardia?.timing).toBe("past")
      expect(guardia?.timingStatusLabel).toContain("Ya cobrada")
      expect(guardia?.actionAdvice).toContain("NO necesitas meter reporte de reclamación sindical")
    })

    it("clasifica guardia futura como programada por adelantado", () => {
      const periodInfo = {
        year: 2026,
        month: 10,
        half: 2 as const,
        fortnight: 20,
        label: "2.ª quincena de octubre de 2026",
        shortLabel: "2.ª de octubre 2026",
        dateRangeText: "del 16 al 31 de octubre de 2026",
        estimatedPaymentDate: "30 de octubre de 2026",
        laggingFortnight: {
          year: 2026,
          month: 9,
          half: 2 as const,
          fortnight: 18,
          label: "2.ª quincena de septiembre de 2026",
          shortLabel: "2.ª de septiembre 2026",
          dateRangeText: "del 16 al 30 de septiembre de 2026",
        },
      }

      const guardia = decodeGuardiaDetails(
        [
          {
            conceptCode: "035",
            amount: 1470.56,
            units: 8,
            notes: "01112026-01112026",
          },
        ],
        { code: "035", description: "Guardias", amount: 1470.56, kind: "earning" },
        periodInfo
      )

      expect(guardia?.timing).toBe("future")
      expect(guardia?.timingStatusLabel).toContain("Guardia programada")
      expect(guardia?.actionAdvice).toContain("acudir a laborar")
    })

    it("interpreta tiempo extra 037 con unidades y fecha exacta", () => {
      const extra = decodeGuardiaDetails(
        [
          {
            conceptCode: "037",
            amount: 1470.56,
            units: 8,
            controlNumber: "16092026",
            notes: "16092026",
          },
        ],
        { code: "037", description: "Tiempo extraordinario", amount: 1470.56, kind: "earning" }
      )

      expect(extra).not.toBeNull()
      expect(extra?.code).toBe("037")
      expect(extra?.conceptName).toBe("Tiempo Extraordinario")
      expect(extra?.units).toBe(8)
      expect(extra?.unitType).toBe("horas")
      expect(extra?.date?.isoDate).toBe("2026-09-16")
      expect(extra?.incidenceText).toContain("16 de septiembre de 2026")
      expect(extra?.incidenceText).toContain("8 horas extra")
      expect(extra?.summary).toContain("8 horas extra")
      expect(extra?.summary).toContain("16 de septiembre de 2026")
    })

    it("recupera unidades de tiempo extra cuando se desfasaron a duePeriod", () => {
      const extra = decodeGuardiaDetails(
        [
          {
            conceptCode: "037",
            amount: 1470.56,
            duePeriod: "8",
            controlNumber: "16092026",
          },
        ],
        { code: "037", description: "Tiempo extraordinario", amount: 1470.56, kind: "earning" }
      )

      expect(extra?.units).toBe(8)
      expect(extra?.unitType).toBe("horas")
      expect(extra?.date?.isoDate).toBe("2026-09-16")
    })

    it("interpreta guardia por Convenio T.A.T. (076)", () => {
      const tat = decodeGuardiaDetails(
        [
          {
            conceptCode: "076",
            amount: 980,
            controlNumber: "98765432",
            notes: "20260510 COBERTURA GUARDIA",
          },
        ],
        { code: "076", description: "Reintegro convenio TAT", amount: 980, kind: "earning" }
      )

      expect(tat).not.toBeNull()
      expect(tat?.code).toBe("076")
      expect(tat?.date?.isoDate).toBe("2026-05-10")
      expect(tat?.partnerMatricula).toBe("98765432")
      expect(tat?.summary).toContain("Convenio Trabajador a Trabajador")
    })
  })

  describe("decodeFaltaDetails", () => {
    it("interpreta falta 172 con fecha y efecto normativo en estímulos", () => {
      const falta = decodeFaltaDetails(
        [
          {
            conceptCode: "172",
            amount: 550,
            controlNumber: "20260603",
            units: 1,
            notes: "FALTA INJUSTIFICADA",
          },
        ],
        { code: "172", description: "Falta injustificada", amount: -550, kind: "deduction" }
      )

      expect(falta).not.toBeNull()
      expect(falta?.date?.formatted).toBe("miércoles 3 de junio de 2026")
      expect(falta?.impactOnIncentives).toBe(true)
      expect(falta?.summary).toContain("miércoles 3 de junio de 2026")
      expect(falta?.summary).toContain("anula automáticamente los estímulos")
      expect(falta?.actionAdvice).toContain("reloj biométrico")
    })

    it("interpreta falta 172 con fecha en formato DDMMYYYY 16092026 y dice el día exacto", () => {
      const falta = decodeFaltaDetails(
        [
          {
            conceptCode: "172",
            amount: 850,
            units: 1,
            controlNumber: "16092026",
            notes: "16092026",
          },
        ],
        { code: "172", description: "Falta injustificada", amount: -850, kind: "deduction" }
      )

      expect(falta).not.toBeNull()
      expect(falta?.code).toBe("172")
      expect(falta?.conceptName).toBe("Falta Injustificada")
      expect(falta?.units).toBe(1)
      expect(falta?.date?.isoDate).toBe("2026-09-16")
      expect(falta?.incidenceText).toContain("miércoles 16 de septiembre de 2026")
      expect(falta?.incidenceText).toContain("1 día")
      expect(falta?.summary).toContain("miércoles 16 de septiembre de 2026")
      expect(falta?.summary).toContain("anula automáticamente los estímulos")
      expect(falta?.actionAdvice).toContain("miércoles 16 de septiembre de 2026")
      expect(falta?.actionAdvice).toContain("reloj biométrico")
    })

    it("interpreta múltiples observaciones de falta con distintas fechas", () => {
      const falta = decodeFaltaDetails(
        [
          {
            conceptCode: "172",
            amount: 850,
            units: 1,
            controlNumber: "16092026",
          },
          {
            conceptCode: "172",
            amount: 850,
            units: 1,
            controlNumber: "17092026",
          },
        ],
        { code: "172", description: "Falta injustificada", amount: -1700, kind: "deduction" }
      )

      expect(falta).not.toBeNull()
      expect(falta?.units).toBe(2)
      expect(falta?.incidenceText).toContain("16 de septiembre")
      expect(falta?.incidenceText).toContain("17 de septiembre")
      expect(falta?.incidenceText).toContain("2 días")
    })

    it("interpreta retardos 174 con unidades y fecha exacta", () => {
      const retardo = decodeFaltaDetails(
        [
          {
            conceptCode: "174",
            amount: 320,
            units: 2,
            controlNumber: "15092026",
            notes: "15092026 RETARDO",
          },
        ],
        { code: "174", description: "Retardos acumulados", amount: -320, kind: "deduction" }
      )

      expect(retardo).not.toBeNull()
      expect(retardo?.code).toBe("174")
      expect(retardo?.units).toBe(2)
      expect(retardo?.incidenceText).toContain("martes 15 de septiembre de 2026")
      expect(retardo?.incidenceText).toContain("2 retardos")
    })

    it("interpreta licencia sin sueldo 171 con fecha y recomendación de aclaración sindical", () => {
      const licencia = decodeFaltaDetails(
        [
          {
            conceptCode: "171",
            amount: 720,
            notes: "14092026-15092026",
            units: 2,
          },
        ],
        { code: "171", description: "Licencia sin sueldo < 4 dias", amount: -720, kind: "deduction" }
      )

      expect(licencia).not.toBeNull()
      expect(licencia?.conceptName).toContain("Licencia sin sueldo")
      expect(licencia?.dateRange?.formatted).toContain("septiembre de 2026")
      expect(licencia?.impactOnIncentives).toBe(true)
      expect(licencia?.actionAdvice).toContain("representación sindical")
    })
  })

  describe("decodeVacacionesDetails", () => {
    it("detecta vacaciones con fechas de salida y regreso", () => {
      const payslip: GuidePayslip = {
        id: "vac-1",
        source: "local",
        earnings: [
          { code: "002", description: "Sueldo", amount: 8000, kind: "earning" },
          { code: "029", description: "Prima vacacional", amount: 2000, kind: "earning" },
        ],
        deductions: [],
        observations: [
          {
            conceptCode: "029",
            units: 15,
            notes: "VACACIONES DEL 20260701 AL 20260715",
          },
        ],
      }

      const vac = decodeVacacionesDetails(payslip)
      expect(vac.hasVacaciones).toBe(true)
      expect(vac.departureDate?.formatted).toBe("miércoles 1 de julio de 2026")
      expect(vac.endDate?.formatted).toBe("miércoles 15 de julio de 2026")
      expect(vac.returnDate?.formatted).toBe("jueves 16 de julio de 2026")
      expect(vac.summary).toContain("salida es el miércoles 1 de julio de 2026")
      expect(vac.summary).toContain("regreso a labores es el jueves 16 de julio de 2026")
    })
  })

  describe("decodeRetroactivoDetails", () => {
    it("identifica conceptos retroactivos", () => {
      const payslip: GuidePayslip = {
        id: "retro-1",
        source: "local",
        earnings: [
          { code: "002", description: "SUELDO RETROACTIVO", amount: 1500, kind: "earning" },
        ],
        deductions: [],
        observations: [
          {
            conceptCode: "002",
            duePeriod: "2026018",
            notes: "AJUSTE REVISION",
          },
        ],
      }

      const retro = decodeRetroactivoDetails(payslip)
      expect(retro.length).toBe(1)
      expect(retro[0].code).toBe("002")
      expect(retro[0].targetPeriod).toBe("2.ª quincena de septiembre de 2026")
      expect(retro[0].summary).toContain("Pago retroactivo")
    })
  })
})
