import { describe, it, expect } from "vitest"
import {
  evaluateVacationRoleEligibility,
  diffCivilDays,
  subtractCivilDays,
  parseCivilDate,
  formatCivilMexicanDate,
} from "../domain/role-eligibility"
import { validateAnticipation } from "../domain/validation"
import { buildVacationPlan } from "../domain/annual-plan"
import type { VacationEntitlement, VacationPlanInput, VacationRole } from "../domain/types"

describe("Motor de Elegibilidad de Roles Vacacionales (evaluateVacationRoleEligibility)", () => {
  // 1. Semestral con vencimiento 14/10/2027 (120 días naturales)
  describe("1. Semestral con vencimiento 14/10/2027", () => {
    const dueDate = "2027-10-14"

    it("15/06/2027 (121 días de anticipación) queda bloqueado", () => {
      const res = evaluateVacationRoleEligibility({
        regime: "SEMESTRAL",
        entitlementKind: "ORDINARY",
        dueDate,
        dueDateConfidence: "CONFIRMED",
        roleStartDate: "2027-06-15",
        calendarStatus: "PUBLISHED",
      })

      expect(res.status).toBe("BLOCKED")
      expect(res.reasonCode).toBe("EXCEEDS_ANTICIPATION")
      expect(res.daysBeforeDue).toBe(121)
      expect(res.earliestAllowedDate).toBe("2027-06-16")
      expect(res.workerMessage).toContain("Tu derecho se genera el 14/10/2027")
      expect(res.workerMessage).toContain("120 días")
      expect(res.workerMessage).toContain("16/06/2027")
    })

    it("16/06/2027 (exactamente 120 días de anticipación) queda permitido", () => {
      const res = evaluateVacationRoleEligibility({
        regime: "SEMESTRAL",
        entitlementKind: "ORDINARY",
        dueDate,
        dueDateConfidence: "CONFIRMED",
        roleStartDate: "2027-06-16",
        calendarStatus: "PUBLISHED",
      })

      expect(res.status).toBe("ALLOWED")
      expect(res.reasonCode).toBe("ROLE_ALLOWED")
      expect(res.daysBeforeDue).toBe(120)
      expect(res.earliestAllowedDate).toBe("2027-06-16")
      expect(res.workerMessage).toBe("Sí puedes elegir este rol. Comienza dentro de las fechas permitidas para tu periodo.")
    })
  })

  // 2. Cuatrimestral con vencimiento 14/10/2027 (105 días naturales)
  describe("2. Cuatrimestral con vencimiento 14/10/2027", () => {
    const dueDate = "2027-10-14"

    it("30/06/2027 (106 días de anticipación) queda bloqueado", () => {
      const res = evaluateVacationRoleEligibility({
        regime: "CUATRIMESTRAL",
        entitlementKind: "ORDINARY",
        dueDate,
        dueDateConfidence: "CONFIRMED",
        roleStartDate: "2027-06-30",
        calendarStatus: "PUBLISHED",
      })

      expect(res.status).toBe("BLOCKED")
      expect(res.reasonCode).toBe("EXCEEDS_ANTICIPATION")
      expect(res.daysBeforeDue).toBe(106)
      expect(res.earliestAllowedDate).toBe("2027-07-01")
      expect(res.workerMessage).toContain("Tu derecho se genera el 14/10/2027")
      expect(res.workerMessage).toContain("105 días")
      expect(res.workerMessage).toContain("01/07/2027")
    })

    it("01/07/2027 (exactamente 105 días de anticipación) queda permitido", () => {
      const res = evaluateVacationRoleEligibility({
        regime: "CUATRIMESTRAL",
        entitlementKind: "ORDINARY",
        dueDate,
        dueDateConfidence: "CONFIRMED",
        roleStartDate: "2027-07-01",
        calendarStatus: "PUBLISHED",
      })

      expect(res.status).toBe("ALLOWED")
      expect(res.reasonCode).toBe("ROLE_ALLOWED")
      expect(res.daysBeforeDue).toBe(105)
      expect(res.earliestAllowedDate).toBe("2027-07-01")
      expect(res.workerMessage).toBe("Sí puedes elegir este rol. Comienza dentro de las fechas permitidas para tu periodo.")
    })
  })

  // 3. Primer periodo del trabajador
  describe("3. Primer periodo del trabajador", () => {
    const dueDate = "2027-05-15"

    it("Un día antes del vencimiento (14/05/2027) queda bloqueado", () => {
      const res = evaluateVacationRoleEligibility({
        regime: "SEMESTRAL",
        entitlementKind: "ORDINARY",
        dueDate,
        dueDateConfidence: "CONFIRMED",
        roleStartDate: "2027-05-14",
        isFirstEverVacationPeriod: true,
        calendarStatus: "PUBLISHED",
      })

      expect(res.status).toBe("BLOCKED")
      expect(res.reasonCode).toBe("FIRST_PERIOD_BEFORE_DUE_DATE")
      expect(res.workerMessage).toBe(
        "Este es tu primer periodo vacacional. Primero debes cumplir la fecha en la que generas el derecho."
      )
    })

    it("El mismo día del vencimiento (15/05/2027) queda permitido", () => {
      const res = evaluateVacationRoleEligibility({
        regime: "SEMESTRAL",
        entitlementKind: "ORDINARY",
        dueDate,
        dueDateConfidence: "CONFIRMED",
        roleStartDate: "2027-05-15",
        isFirstEverVacationPeriod: true,
        calendarStatus: "PUBLISHED",
      })

      expect(res.status).toBe("ALLOWED")
      expect(res.reasonCode).toBe("ROLE_ALLOWED")
      expect(res.daysBeforeDue).toBe(0)
    })
  })

  // 4. Estatuto
  describe("4. Personal sujeto al Estatuto", () => {
    const dueDate = "2027-08-01"

    it("Anticipación queda bloqueada (no autoriza anticipación automática)", () => {
      const res = evaluateVacationRoleEligibility({
        regime: "ESTATUTO",
        entitlementKind: "ORDINARY",
        dueDate,
        dueDateConfidence: "CONFIRMED",
        roleStartDate: "2027-07-20",
        calendarStatus: "PUBLISHED",
      })

      expect(res.status).toBe("BLOCKED")
      expect(res.reasonCode).toBe("ESTATUTO_NO_ANTICIPATION")
      expect(res.workerMessage).toContain("no cuenta con anticipación ordinaria automática")
    })

    it("A partir de la fecha de vencimiento sin anticipación queda permitido en calendario publicado", () => {
      const res = evaluateVacationRoleEligibility({
        regime: "ESTATUTO",
        entitlementKind: "ORDINARY",
        dueDate,
        dueDateConfidence: "CONFIRMED",
        roleStartDate: "2027-08-01",
        calendarStatus: "PUBLISHED",
      })

      expect(res.status).toBe("ALLOWED")
    })
  })

  // 5. Vacaciones V20
  describe("5. Reglas de Vacaciones por 20 Años (V20)", () => {
    const dueDate = "2027-09-01"

    it("Primer periodo V20 antes del vencimiento queda bloqueado", () => {
      const res = evaluateVacationRoleEligibility({
        regime: "SEMESTRAL",
        entitlementKind: "V20",
        v20Sequence: 1,
        dueDate,
        dueDateConfidence: "CONFIRMED",
        roleStartDate: "2027-08-20",
        calendarStatus: "PUBLISHED",
      })

      expect(res.status).toBe("BLOCKED")
      expect(res.reasonCode).toBe("V20_FIRST_PERIOD_NO_ANTICIPATION")
      expect(res.workerMessage).toContain("primer periodo de vacaciones por 20 años (V20) no puede disfrutarse antes de adquirir el derecho")
    })

    it("Periodo V20 posterior (secuencia 2) exactamente a 120 días queda permitido", () => {
      // 2027-09-01 - 120 días:
      // Septiembre: 1 día
      // Agosto: 31 días (32 acumulados)
      // Julio: 31 días (63 acumulados)
      // Junio: 30 días (93 acumulados)
      // Mayo: 120 - 93 = 27 días hacia atrás -> 31 - 27 + 1 = Mayo 4
      const earliest = subtractCivilDays(dueDate, 120)
      expect(earliest).toBe("2027-05-04")

      const res = evaluateVacationRoleEligibility({
        regime: "SEMESTRAL",
        entitlementKind: "V20",
        v20Sequence: 2,
        dueDate,
        dueDateConfidence: "CONFIRMED",
        roleStartDate: earliest,
        calendarStatus: "PUBLISHED",
      })

      expect(res.status).toBe("ALLOWED")
      expect(res.daysBeforeDue).toBe(120)
    })

    it("Periodo V20 posterior un día antes del límite (121 días) queda bloqueado", () => {
      const blockedDate = subtractCivilDays(dueDate, 121)
      const res = evaluateVacationRoleEligibility({
        regime: "SEMESTRAL",
        entitlementKind: "V20",
        v20Sequence: 2,
        dueDate,
        dueDateConfidence: "CONFIRMED",
        roleStartDate: blockedDate,
        calendarStatus: "PUBLISHED",
      })

      expect(res.status).toBe("BLOCKED")
      expect(res.reasonCode).toBe("V20_EXCEEDS_ANTICIPATION")
    })

    it("Marca 7 exige que el derecho venza en el año del calendario que se programa", () => {
      const resMismatch = evaluateVacationRoleEligibility({
        regime: "SEMESTRAL",
        entitlementKind: "V20",
        v20Sequence: 2,
        dueDate: "2028-01-15", // Vence en 2028
        dueDateConfidence: "CONFIRMED",
        roleStartDate: "2027-11-01",
        selectedMark: 7,
        calendarYear: 2027,
        calendarStatus: "PUBLISHED",
      })

      expect(resMismatch.status).toBe("BLOCKED")
      expect(resMismatch.reasonCode).toBe("V20_MARK_7_YEAR_MISMATCH")
      expect(resMismatch.workerMessage).toContain("marca 7 exige que el derecho vacacional venza en el mismo año")
    })

    it("Marca 8 (acumulación para jubilación) no debe anticiparse antes de su vencimiento", () => {
      const res = evaluateVacationRoleEligibility({
        regime: "SEMESTRAL",
        entitlementKind: "V20",
        v20Sequence: 2,
        dueDate,
        dueDateConfidence: "CONFIRMED",
        roleStartDate: "2027-08-15", // Antes de dueDate 2027-09-01
        selectedMark: 8,
        calendarStatus: "PUBLISHED",
      })

      expect(res.status).toBe("BLOCKED")
      expect(res.reasonCode).toBe("V20_MARK_8_NO_ANTICIPATION")
      expect(res.workerMessage).toContain("marca 8 (acumulación para jubilación) no puede anticiparse")
    })
  })

  // 6. Personal temporal
  describe("6. Personal temporal y vigencia contractual", () => {
    const contractEndDate = "2027-06-30"

    it("Rol que termina después del contrato queda bloqueado", () => {
      const res = evaluateVacationRoleEligibility({
        regime: "SEMESTRAL",
        entitlementKind: "ORDINARY",
        dueDate: "2027-05-01",
        dueDateConfidence: "CONFIRMED",
        roleStartDate: "2027-06-20",
        roleEndDate: "2027-07-05", // Termina después del contrato
        contractType: "TEMPORAL",
        contractEndDate,
        calendarStatus: "PUBLISHED",
      })

      expect(res.status).toBe("BLOCKED")
      expect(res.reasonCode).toBe("ROLE_ENDS_AFTER_CONTRACT")
      expect(res.workerMessage).toContain("termina (05/07/2027) después de la vigencia de tu contrato")
    })

    it("Rol que inicia después del contrato queda bloqueado", () => {
      const res = evaluateVacationRoleEligibility({
        regime: "SEMESTRAL",
        entitlementKind: "ORDINARY",
        dueDate: "2027-05-01",
        dueDateConfidence: "CONFIRMED",
        roleStartDate: "2027-07-01",
        contractType: "TEMPORAL",
        contractEndDate,
        calendarStatus: "PUBLISHED",
      })

      expect(res.status).toBe("BLOCKED")
      expect(res.reasonCode).toBe("ROLE_STARTS_AFTER_CONTRACT")
    })

    it("Rol con inicio y término dentro del contrato queda permitido", () => {
      const res = evaluateVacationRoleEligibility({
        regime: "SEMESTRAL",
        entitlementKind: "ORDINARY",
        dueDate: "2027-05-01",
        dueDateConfidence: "CONFIRMED",
        roleStartDate: "2027-06-01",
        roleEndDate: "2027-06-15",
        contractType: "TEMPORAL",
        contractEndDate,
        calendarStatus: "PUBLISHED",
      })

      expect(res.status).toBe("ALLOWED")
    })
  })

  // 7. Datos incompletos y fechas proyectadas
  describe("7. Fechas faltantes y fechas proyectadas", () => {
    it("Fecha faltante devuelve NEEDS_DATA", () => {
      const res = evaluateVacationRoleEligibility({
        regime: "SEMESTRAL",
        entitlementKind: "ORDINARY",
        dueDate: null,
        roleStartDate: "2027-06-01",
        calendarStatus: "PUBLISHED",
      })

      expect(res.status).toBe("NEEDS_DATA")
      expect(res.reasonCode).toBe("MISSING_DUE_DATE")
      expect(res.workerMessage).toContain("falta validar la fecha en la que generas este derecho")
    })

    it("Fecha proyectada/provisional devuelve REQUIRES_REVIEW y nunca ALLOWED", () => {
      const res = evaluateVacationRoleEligibility({
        regime: "SEMESTRAL",
        entitlementKind: "ORDINARY",
        dueDate: "2027-10-14",
        dueDateConfidence: "PROVISIONAL",
        roleStartDate: "2027-07-01", // Dentro de los 120 días
        calendarStatus: "PUBLISHED",
      })

      expect(res.status).toBe("REQUIRES_REVIEW")
      expect(res.status).not.toBe("ALLOWED")
      expect(res.reasonCode).toBe("PROVISIONAL_DUE_DATE")
      expect(res.workerMessage).toContain("Todavía no podemos confirmar este rol porque falta validar la fecha")
    })
  })

  // 8. Múltiples periodos independientes
  describe("8. Múltiples periodos independientes sin clonar fechas", () => {
    it("Cada periodo conserva su propio derecho vacacional sin duplicar la fecha de P1", () => {
      const entitlements: VacationEntitlement[] = [
        {
          id: "p1",
          sequence: 1,
          regime: "CUATRIMESTRAL",
          entitlementKind: "ORDINARY",
          dueDate: "2027-04-14",
          dueDateSource: "TARJETON",
          dueDateConfidence: "CONFIRMED",
        },
        {
          id: "p2",
          sequence: 2,
          regime: "CUATRIMESTRAL",
          entitlementKind: "ORDINARY",
          dueDate: "2027-08-14",
          dueDateSource: "OFFICIAL_RECORD",
          dueDateConfidence: "CONFIRMED",
        },
        {
          id: "p3",
          sequence: 3,
          regime: "CUATRIMESTRAL",
          entitlementKind: "ORDINARY",
          dueDate: null,
          dueDateSource: "MISSING",
          dueDateConfidence: "UNKNOWN",
        },
      ]

      const roles: VacationRole[] = [
        { id: "r1", roleNumber: 1, startDate: "2027-01-16", endDate: "2027-01-31", enabled: true },
        { id: "r2", roleNumber: 2, startDate: "2027-05-16", endDate: "2027-05-31", enabled: true },
        { id: "r3", roleNumber: 3, startDate: "2027-09-16", endDate: "2027-09-30", enabled: true },
      ]

      const planInput: VacationPlanInput = {
        workerProfile: {
          contractType: "BASE",
          effectiveSeniority: { years: 14, fortnights: 0, days: 0 },
          weeklyRestDays: [5, 6],
        },
        regime: "CUATRIMESTRAL",
        initialContinuity: 0,
        entitlements,
        calendar: { id: "cal-2027", year: 2027, version: "v1", status: "PUBLISHED", sourceName: "IMSS", roles },
        integratedMonthlySalary: 22058.6,
      }

      const plan = buildVacationPlan(planInput, {
        1: { mark: 0, role: roles[0] },
        2: { mark: 2, role: roles[1] },
        3: { mark: 5, role: roles[2] },
      })

      expect(plan.periods[0].dueDate).toBe("2027-04-14")
      expect(plan.periods[1].dueDate).toBe("2027-08-14")
      expect(plan.periods[2].dueDate).toBeUndefined()
      expect(plan.periods[0].dueDate).not.toBe(plan.periods[1].dueDate)
    })
  })

  // 9. Estado del calendario
  describe("9. Control de estatus del calendario", () => {
    it("Calendario DRAFT nunca devuelve ALLOWED; devuelve REQUIRES_REVIEW", () => {
      const res = evaluateVacationRoleEligibility({
        regime: "SEMESTRAL",
        entitlementKind: "ORDINARY",
        dueDate: "2027-10-14",
        dueDateConfidence: "CONFIRMED",
        roleStartDate: "2027-08-01",
        calendarStatus: "DRAFT",
      })

      expect(res.status).toBe("REQUIRES_REVIEW")
      expect(res.status).not.toBe("ALLOWED")
      expect(res.reasonCode).toBe("CALENDAR_DRAFT")
      expect(res.workerMessage).toContain("borrador preliminar")
    })

    it("Calendario PUBLISHED con fecha confirmada permite estado ALLOWED", () => {
      const res = evaluateVacationRoleEligibility({
        regime: "SEMESTRAL",
        entitlementKind: "ORDINARY",
        dueDate: "2027-10-14",
        dueDateConfidence: "CONFIRMED",
        roleStartDate: "2027-08-01",
        calendarStatus: "PUBLISHED",
      })

      expect(res.status).toBe("ALLOWED")
      expect(res.reasonCode).toBe("ROLE_ALLOWED")
    })
  })

  // 10. Prescripción: no existe el cálculo incorrecto dueDate + 730 días
  describe("10. Eliminación del cálculo erróneo de prescripción (dueDate + 730)", () => {
    it("No rechaza fechas posteriores a 730 días de la fecha de adquisición en validateAnticipation", () => {
      // Fecha solicitada 800 días posterior a dueDate
      const res = validateAnticipation("SEMESTRAL", "2025-01-01", "2027-04-01", false, 10)
      expect(res.reasonCode).not.toBe("PRESCRIPTION_EXCEEDED")
      expect(res.allowed).toBe(true)
    })
  })

  // 11. Aritmética de fecha civil y casos límite
  describe("11. Aritmética de fecha civil, años bisiestos y límites", () => {
    it("Años bisiestos: 2028-02-29 es válido y 2027-02-29 es inválido", () => {
      expect(parseCivilDate("2028-02-29")).toEqual({ year: 2028, month: 2, day: 29 })
      expect(parseCivilDate("2027-02-29")).toBeNull()
    })

    it("Resta de días naturales a través del cambio de mes y de año", () => {
      // 2027-01-10 menos 15 días -> 2026-12-26
      expect(subtractCivilDays("2027-01-10", 15)).toBe("2026-12-26")

      // 2027-03-01 menos 1 día -> 2027-02-28
      expect(subtractCivilDays("2027-03-01", 1)).toBe("2027-02-28")

      // 2028-03-01 menos 1 día (bisiesto) -> 2028-02-29
      expect(subtractCivilDays("2028-03-01", 1)).toBe("2028-02-29")
    })

    it("Diferencia de días civiles exacta", () => {
      expect(diffCivilDays("2027-10-14", "2027-07-01")).toBe(105)
      expect(diffCivilDays("2027-10-14", "2027-06-16")).toBe(120)
      expect(diffCivilDays("2027-10-14", "2027-10-14")).toBe(0)
      expect(diffCivilDays("2027-10-14", "2027-10-20")).toBe(-6)
    })

    it("Formato mexicano de fecha civil", () => {
      expect(formatCivilMexicanDate("2027-10-14")).toBe("14/10/2027")
      expect(formatCivilMexicanDate("2027-01-05")).toBe("05/01/2027")
    })
  })
})
