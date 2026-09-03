import { describe, it, expect } from "vitest"
import {
  getCompatibleSemestralInclusionMarks,
  getSemestralTransition,
  SEMESTRAL_TRANSITIONS,
  SEMESTRAL_CLOSED_STATES,
} from "../domain/continuity"
import type { SemestralContinuity, SemestralInclusionMark } from "../domain/types"

describe("Asesor Vacacional y Roles Normativos", () => {
  describe("Comportamiento estricto de secuencias de continuidad", () => {
    it("Secuencia 1 -> 1: primera fracción (inclusión 1 -> continuidad 1) y segunda fracción (inclusión 1 -> continuidad 2)", () => {
      // 1. Al inicio de ciclo (continuidad 0), tomar marca 1
      const firstStep = getSemestralTransition(0, 1)
      expect(firstStep).toBeDefined()
      expect(firstStep?.stage).toBe("FIRST_FRACTION")
      expect(firstStep?.nextContinuity).toBe(1)
      expect(firstStep?.upoIncrement).toBe(1)

      // 2. Con continuidad 1, la única opción semestral permitida es marca 1
      const allowedInOne = getCompatibleSemestralInclusionMarks(1)
      expect(allowedInOne).toEqual([1])

      // 3. Al tomar marca 1 desde continuidad 1, concluye la segunda fracción cerrando en continuidad 2
      const secondStep = getSemestralTransition(1, 1)
      expect(secondStep).toBeDefined()
      expect(secondStep?.stage).toBe("SECOND_FRACTION")
      expect(secondStep?.nextContinuity).toBe(2)
      expect(SEMESTRAL_CLOSED_STATES).toContain(2)
    })

    it("Secuencia 2 -> 3: primer periodo semestral completo y segundo periodo", () => {
      // 1. Al inicio de ciclo (continuidad 0), tomar marca 2
      const firstStep = getSemestralTransition(0, 2)
      expect(firstStep).toBeDefined()
      expect(firstStep?.stage).toBe("FIRST_COMPLETE_PERIOD")
      expect(firstStep?.nextContinuity).toBe(3)

      // 2. Con continuidad 3, la única opción semestral permitida es marca 3
      const allowedInThree = getCompatibleSemestralInclusionMarks(3)
      expect(allowedInThree).toEqual([3])

      // 3. Al tomar marca 3 desde continuidad 3, avanza a continuidad 6 (ciclo cerrado)
      const secondStep = getSemestralTransition(3, 3)
      expect(secondStep).toBeDefined()
      expect(secondStep?.stage).toBe("SECOND_COMPLETE_PERIOD")
      expect(secondStep?.nextContinuity).toBe(6)
      expect(SEMESTRAL_CLOSED_STATES).toContain(6)
    })

    it("Secuencia 4 -> 9: modalidad con pago (marca 4 -> continuidad 4, luego marca 9 -> continuidad 13)", () => {
      // 1. Desde continuidad inicial, tomar marca 4
      const firstStep = getSemestralTransition(0, 4)
      expect(firstStep).toBeDefined()
      expect(firstStep?.stage).toBe("FIRST_FRACTION_4_9")
      expect(firstStep?.nextContinuity).toBe(4)

      // 2. Con continuidad 4, solo se permite marca 9
      const allowedInFour = getCompatibleSemestralInclusionMarks(4)
      expect(allowedInFour).toEqual([9])

      // 3. Al tomar marca 9 desde continuidad 4, concluye en continuidad 13
      const secondStep = getSemestralTransition(4, 9)
      expect(secondStep).toBeDefined()
      expect(secondStep?.stage).toBe("SECOND_FRACTION_4_9")
      expect(secondStep?.nextContinuity).toBe(13)
      expect(SEMESTRAL_CLOSED_STATES).toContain(13)
    })

    it("Secuencia 9 -> 4: modalidad con pago inversa (marca 9 -> continuidad 9, luego marca 4 -> continuidad 13)", () => {
      // 1. Desde continuidad inicial, tomar marca 9
      const firstStep = getSemestralTransition(0, 9)
      expect(firstStep).toBeDefined()
      expect(firstStep?.stage).toBe("FIRST_FRACTION_9_4")
      expect(firstStep?.nextContinuity).toBe(9)

      // 2. Con continuidad 9, solo se permite marca 4
      const allowedInNine = getCompatibleSemestralInclusionMarks(9)
      expect(allowedInNine).toEqual([4])

      // 3. Al tomar marca 4 desde continuidad 9, concluye en continuidad 13
      const secondStep = getSemestralTransition(9, 4)
      expect(secondStep).toBeDefined()
      expect(secondStep?.stage).toBe("SECOND_FRACTION_9_4")
      expect(secondStep?.nextContinuity).toBe(13)
      expect(SEMESTRAL_CLOSED_STATES).toContain(13)
    })
  })

  describe("Bloqueo de opciones no permitidas según el estado actual", () => {
    it("No permite marca 3 si la continuidad no es 3", () => {
      const allowedInZero = getCompatibleSemestralInclusionMarks(0)
      expect(allowedInZero).not.toContain(3)

      const allowedInOne = getCompatibleSemestralInclusionMarks(1)
      expect(allowedInOne).not.toContain(3)
    })

    it("No permite marca 0 cuando hay una fracción o periodo abierto", () => {
      const allowedInOne = getCompatibleSemestralInclusionMarks(1)
      expect(allowedInOne).not.toContain(0)

      const allowedInThree = getCompatibleSemestralInclusionMarks(3)
      expect(allowedInThree).not.toContain(0)

      const allowedInFour = getCompatibleSemestralInclusionMarks(4)
      expect(allowedInFour).not.toContain(0)

      const allowedInNine = getCompatibleSemestralInclusionMarks(9)
      expect(allowedInNine).not.toContain(0)
    })
  })

  describe("Reglas de integridad de calendarios y roles A/B", () => {
    it("Un rol de vacaciones soporta grupos A y B y fecha de término", () => {
      const roleA: import("../domain/types").VacationRole = {
        id: "role-1",
        roleNumber: 1,
        startDate: "2027-01-16",
        endDate: "2027-01-31",
        roleGroup: "A",
        enabled: true,
      }
      expect(roleA.roleGroup).toBe("A")
      expect(roleA.endDate).toBeDefined()
      expect(roleA.endDate! >= roleA.startDate).toBe(true)

      const roleB: import("../domain/types").VacationRole = {
        id: "role-2",
        roleNumber: 2,
        startDate: "2027-02-01",
        endDate: "2027-02-15",
        roleGroup: "B",
        enabled: true,
      }
      expect(roleB.roleGroup).toBe("B")
      expect(roleB.endDate! >= roleB.startDate).toBe(true)
    })

    it("Detecta roles incompletos sin fecha de término", () => {
      const roles: import("../domain/types").VacationRole[] = [
        { id: "1", roleNumber: 1, startDate: "2027-01-01", endDate: "2027-01-15", enabled: true },
        { id: "2", roleNumber: 2, startDate: "2027-01-16", enabled: true }, // Falta endDate
      ]

      const missing = roles.filter((r) => r.enabled && !r.endDate)
      expect(missing.length).toBe(1)
      expect(missing[0].roleNumber).toBe(2)
    })
  })
})
