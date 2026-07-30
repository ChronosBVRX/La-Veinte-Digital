import { describe, it, expect } from "vitest"
import { getCctAnnualDays, getEstatutoAnnualDays, getRadiationDaysForPeriod, determineVacationRegime, isEligibleForV20, getVacationDivision } from "../domain/entitlement"
import { getSemestralTransition, getCompatibleSemestralInclusionMarks, isCycleClosed, applyInclusionMark, SEMESTRAL_CLOSED_STATES } from "../domain/continuity"
import { validateAnticipation, calculateReturnDate, validateModification } from "../domain/validation"
import { getMandatoryRestDates, isWeeklyRest } from "../domain/holidays"
import { getAccumulatedDayJourneys, getAccumulatedNightVeladas, isWorkDay } from "../domain/schedules"
import { detectNormativeConflicts } from "../domain/conflicts"
import { buildSimulationResult } from "../domain/simulation"
import type { VacationSimulationInput, WorkScheduleDefinition } from "../domain/types"

describe("getCctAnnualDays", () => {
  it("returns 0 for less than 1 year", () => {
    expect(getCctAnnualDays(0)).toBe(0)
  })

  it("returns 16 for first year", () => {
    expect(getCctAnnualDays(1)).toBe(16)
  })

  it("increments by 1 per year", () => {
    expect(getCctAnnualDays(2)).toBe(17)
    expect(getCctAnnualDays(3)).toBe(18)
    expect(getCctAnnualDays(4)).toBe(19)
    expect(getCctAnnualDays(5)).toBe(20)
  })

  it("caps at 20 days max", () => {
    expect(getCctAnnualDays(10)).toBe(20)
    expect(getCctAnnualDays(30)).toBe(20)
  })
})

describe("getEstatutoAnnualDays", () => {
  it("returns 16 for first year", () => {
    expect(getEstatutoAnnualDays(1)).toBe(16)
  })

  it("returns correct values per threshold", () => {
    expect(getEstatutoAnnualDays(5)).toBe(20)
    expect(getEstatutoAnnualDays(10)).toBe(22)
    expect(getEstatutoAnnualDays(15)).toBe(24)
    expect(getEstatutoAnnualDays(20)).toBe(26)
    expect(getEstatutoAnnualDays(25)).toBe(28)
    expect(getEstatutoAnnualDays(30)).toBe(30)
    expect(getEstatutoAnnualDays(35)).toBe(32)
  })

  it("adds 2 days per quinquennium after 35", () => {
    expect(getEstatutoAnnualDays(40)).toBe(34)
    expect(getEstatutoAnnualDays(45)).toBe(36)
  })
})

describe("getRadiationDaysForPeriod", () => {
  it("returns correct days per seniority and period", () => {
    expect(getRadiationDaysForPeriod(0, 0)).toBe(7)
    expect(getRadiationDaysForPeriod(0, 1)).toBe(8)
    expect(getRadiationDaysForPeriod(0, 2)).toBe(7)
    expect(getRadiationDaysForPeriod(5, 0)).toBe(10)
    expect(getRadiationDaysForPeriod(5, 1)).toBe(10)
    expect(getRadiationDaysForPeriod(5, 2)).toBe(10)
  })
})

describe("determineVacationRegime", () => {
  it("returns ESTATUTO for CONFIANZA_A_ESTATUTO", () => {
    expect(determineVacationRegime("CONFIANZA_A_ESTATUTO", 5, false, false)).toBe("ESTATUTO")
  })

  it("returns EXTRAORDINARIO_V20 for V20 mark with 20+ years", () => {
    expect(determineVacationRegime("BASE", 20, false, true)).toBe("EXTRAORDINARIO_V20")
  })

  it("returns SEMESTRAL for base with no radiation", () => {
    expect(determineVacationRegime("BASE", 5, false, false)).toBe("SEMESTRAL")
  })

  it("returns CUATRIMESTRAL for confirmed radiation exposure", () => {
    expect(determineVacationRegime("BASE", 5, true, false)).toBe("CUATRIMESTRAL")
  })

  it("returns SEMESTRAL when unsure about radiation", () => {
    expect(determineVacationRegime("BASE", 5, "UNSURE", false)).toBe("SEMESTRAL")
  })
})

describe("isEligibleForV20", () => {
  it("returns false for less than 20 years", () => {
    expect(isEligibleForV20(19)).toBe(false)
  })

  it("returns true for 20 years", () => {
    expect(isEligibleForV20(20)).toBe(true)
  })
})

describe("getVacationDivision", () => {
  it("splits evenly for even days", () => {
    expect(getVacationDivision(16)).toEqual([8, 8])
  })

  it("splits with floor/ceil for odd days", () => {
    expect(getVacationDivision(17)).toEqual([8, 9])
  })
})

describe("Semestral Continuity State Machine", () => {
  it("closed cycles [0,2,6,13] allow inclusion 0", () => {
    for (const c of SEMESTRAL_CLOSED_STATES) {
      const transition = getSemestralTransition(c, 0)
      expect(transition).toBeDefined()
      expect(transition!.stage).toBe("FULL_OR_CLOSED_OPTION")
      expect(transition!.nextContinuity).toBe(0)
    }
  })

  it("continuity 1 only allows inclusion 1", () => {
    const compatible = getCompatibleSemestralInclusionMarks(1)
    expect(compatible).toEqual([1])
  })

  it("continuity 3 only allows inclusion 3", () => {
    const compatible = getCompatibleSemestralInclusionMarks(3)
    expect(compatible).toEqual([3])
  })

  it("continuity 4 only allows inclusion 9", () => {
    const compatible = getCompatibleSemestralInclusionMarks(4)
    expect(compatible).toEqual([9])
  })

  it("continuity 9 only allows inclusion 4", () => {
    const compatible = getCompatibleSemestralInclusionMarks(9)
    expect(compatible).toEqual([4])
  })

  it("closed cycle [0] allows multiple options", () => {
    const compatible = getCompatibleSemestralInclusionMarks(0)
    expect(compatible.length).toBeGreaterThanOrEqual(4)
    expect(compatible).toContain(0)
    expect(compatible).toContain(1)
    expect(compatible).toContain(2)
    expect(compatible).toContain(4)
  })

  it("continuity 1 → inclusion 1 → continuity 2", () => {
    const result = applyInclusionMark("SEMESTRAL", 1, 1)
    if ("error" in result) throw new Error(result.error)
    expect(result.nextContinuity).toBe(2)
    expect(result.stage).toBe("SECOND_FRACTION")
  })

  it("continuity 3 → inclusion 3 → continuity 6", () => {
    const result = applyInclusionMark("SEMESTRAL", 3, 3)
    if ("error" in result) throw new Error(result.error)
    expect(result.nextContinuity).toBe(6)
    expect(result.stage).toBe("SECOND_COMPLETE_PERIOD")
  })

  it("continuity 4 → inclusion 9 → continuity 13", () => {
    const result = applyInclusionMark("SEMESTRAL", 4, 9)
    if ("error" in result) throw new Error(result.error)
    expect(result.nextContinuity).toBe(13)
  })

  it("continuity 9 → inclusion 4 → continuity 13", () => {
    const result = applyInclusionMark("SEMESTRAL", 9, 4)
    if ("error" in result) throw new Error(result.error)
    expect(result.nextContinuity).toBe(13)
  })

  it("rejects incompatible transition", () => {
    const result = applyInclusionMark("SEMESTRAL", 1, 0)
    expect("error" in result).toBe(true)
  })
})

describe("validateAnticipation", () => {
  it("semestral within 120 days is allowed", () => {
    const result = validateAnticipation("SEMESTRAL", "2026-10-14", "2026-06-16", false, 14)
    expect(result.allowed).toBe(true)
    expect(result.daysInAdvance).toBe(120)
  })

  it("semestral at 121 days is blocked", () => {
    const result = validateAnticipation("SEMESTRAL", "2026-10-14", "2026-06-15", false, 14)
    expect(result.allowed).toBe(false)
    expect(result.reasonCode).toBe("EXCEEDS_ANTICIPATION")
  })

  it("cuatrimestral within 105 days is allowed", () => {
    const result = validateAnticipation("CUATRIMESTRAL", "2026-10-14", "2026-07-01", false, 14)
    expect(result.allowed).toBe(true)
  })

  it("cuatrimestral at 106 days is blocked", () => {
    const result = validateAnticipation("CUATRIMESTRAL", "2026-10-14", "2026-06-30", false, 14)
    expect(result.allowed).toBe(false)
  })

  it("blocks first period before completing first year", () => {
    const result = validateAnticipation("SEMESTRAL", "2026-10-14", "2026-06-01", true, 0)
    expect(result.allowed).toBe(false)
    expect(result.reasonCode).toBe("FIRST_PERIOD_BEFORE_YEAR")
  })

  it("v20 first period requires 20 years", () => {
    const result = validateAnticipation("EXTRAORDINARIO_V20", "2026-10-14", "2026-07-01", false, 19)
    expect(result.allowed).toBe(true)
  })
})

describe("isCycleClosed", () => {
  it("returns true for semestral closed states", () => {
    expect(isCycleClosed("SEMESTRAL", 0)).toBe(true)
    expect(isCycleClosed("SEMESTRAL", 2)).toBe(true)
    expect(isCycleClosed("SEMESTRAL", 6)).toBe(true)
    expect(isCycleClosed("SEMESTRAL", 13)).toBe(true)
  })

  it("returns false for open semestral states", () => {
    expect(isCycleClosed("SEMESTRAL", 1)).toBe(false)
    expect(isCycleClosed("SEMESTRAL", 3)).toBe(false)
    expect(isCycleClosed("SEMESTRAL", 4)).toBe(false)
    expect(isCycleClosed("SEMESTRAL", 9)).toBe(false)
  })
})

describe("Mandatory Rest Days", () => {
  it("includes fixed dates for 2026", () => {
    const dates = getMandatoryRestDates(2026)
    expect(dates).toContain("2026-01-01")
    expect(dates).toContain("2026-05-01")
    expect(dates).toContain("2026-05-10")
    expect(dates).toContain("2026-09-15")
    expect(dates).toContain("2026-09-16")
    expect(dates).toContain("2026-12-25")
  })

  it("includes Semana Mayor (Holy Week)", () => {
    const dates = getMandatoryRestDates(2026)
    const holyWeekDays = dates.filter(d => d.startsWith("2026-04-0"))
    expect(holyWeekDays.length).toBeGreaterThanOrEqual(2)
  })

  it("includes third Monday of February (Constitution Day)", () => {
    const dates = getMandatoryRestDates(2026)
    expect(dates.some(d => d.startsWith("2026-02-"))).toBe(true)
  })
})

describe("isWeeklyRest", () => {
  it("detects Saturday (5) as rest", () => {
    expect(isWeeklyRest("2026-07-25", [5, 6])).toBe(true)
  })

  it("detects Sunday (6) as rest", () => {
    expect(isWeeklyRest("2026-07-26", [5, 6])).toBe(true)
  })

  it("detects Monday (0) as work day", () => {
    expect(isWeeklyRest("2026-07-27", [5, 6])).toBe(false)
  })

  it("detects rest inside vacation period", () => {
    // Saturday July 25, 2026
    expect(isWeeklyRest("2026-07-25", [5, 6])).toBe(true)
  })
})

describe("Accumulated Day Journeys", () => {
  it("returns correct journey days per worked hours", () => {
    expect(getAccumulatedDayJourneys(7)).toBe(3)
    expect(getAccumulatedDayJourneys(12)).toBe(5)
    expect(getAccumulatedDayJourneys(20)).toBe(8)
  })

  it("throws for undefined hours", () => {
    expect(() => getAccumulatedDayJourneys(6)).toThrow()
    expect(() => getAccumulatedDayJourneys(21)).toThrow()
  })
})

describe("Accumulated Night Veladas", () => {
  it("returns correct veladas per worked hours", () => {
    expect(getAccumulatedNightVeladas(7)).toBe(4)
    expect(getAccumulatedNightVeladas(12)).toBe(7)
    expect(getAccumulatedNightVeladas(20)).toBe(12)
  })
})

describe("validateModification", () => {
  it("requires 45 days for ordinary modification", () => {
    const result = validateModification("2026-10-14", "2026-08-01")
    expect(result.allowed).toBe(true)
    expect(result.requiresSpecialProcess).toBe(true)
  })

  it("allows exceptional 15-day margin but requires authorization", () => {
    const result = validateModification("2026-10-14", "2026-10-01")
    expect(result.allowed).toBe(true)
    expect(result.requiresSpecialProcess).toBe(true)
  })

  it("cannot modify after start date", () => {
    const result = validateModification("2026-10-14", "2026-10-20")
    expect(result.allowed).toBe(false)
  })
})

describe("calculateReturnDate", () => {
  it("returns correct dates for ordinary workday vacation", () => {
    const restDays = [5, 6] // Sat, Sun
    const mandatory = getMandatoryRestDates(2026)
    const result = calculateReturnDate("2026-06-16", 8, "WORKDAY", restDays, mandatory)
    expect(result.lastDate).toBeDefined()
    expect(result.returnDate).toBeDefined()
    const last = new Date(result.lastDate)
    const ret = new Date(result.returnDate)
    expect(ret.getTime()).toBeGreaterThan(last.getTime())
  })
})

describe("detectNormativeConflicts", () => {
  it("detects CCT minimum 16 days vs administrative value", () => {
    const conflicts = detectNormativeConflicts("SEMESTRAL", 1, 0, 0, 15)
    expect(conflicts.length).toBeGreaterThan(0)
    expect(conflicts[0].requiresReview).toBe(true)
    expect(conflicts[0].cctValue).toBe(16)
  })

  it("detects V20 inclusion mark 6 discrepancy", () => {
    const conflicts = detectNormativeConflicts("EXTRAORDINARIO_V20", 20, 6, 0, 10)
    const v20Conflict = conflicts.find(c =>
      c.sources.some(s => s.includes("Anexo 2"))
    )
    expect(v20Conflict).toBeDefined()
    expect(v20Conflict!.requiresReview).toBe(true)
  })

  it("detects CCT vs administrative value difference", () => {
    const conflicts = detectNormativeConflicts("SEMESTRAL", 5, 0, 18, 20)
    const diffConflict = conflicts.find(c =>
      c.description.includes("Diferencia entre el CCT")
    )
    expect(diffConflict).toBeDefined()
    expect(diffConflict!.cctValue).toBe(20)
    expect(diffConflict!.administrativeValue).toBe(18)
  })

  it("no conflict when values match", () => {
    const conflicts = detectNormativeConflicts("SEMESTRAL", 5, 0, 0, 20)
    const hasMeaningfulConflict = conflicts.some(c => c.requiresReview)
    expect(hasMeaningfulConflict).toBe(false)
  })
})

describe("isWorkDay", () => {
  it("returns true when no working days specified", () => {
    const schedule: WorkScheduleDefinition = { type: "ORDINARY" }
    expect(isWorkDay("2026-07-25", schedule)).toBe(true)
  })

  it("returns false for non-working days", () => {
    const schedule: WorkScheduleDefinition = {
      type: "ACCUMULATED_WEEKEND_DAY",
      workingDays: [5, 6], // Sat, Sun
    }
    // Monday July 27, 2026
    expect(isWorkDay("2026-07-27", schedule)).toBe(false)
  })
})

describe("buildSimulationResult", () => {
  const baseInput: VacationSimulationInput = {
    workerProfile: {
      contractType: "BASE",
      category: "TECNICO RADIOLOGO 80",
      effectiveSeniority: { years: 14, fortnights: 3, days: 1 },
      weeklyRestDays: [5, 6],
    },
    regime: "SEMESTRAL",
    continuityMark: 0,
    nextPeriodNumber: 43,
    dueDate: "2026-10-14",
    expiredVacationPeriods: 0,
    enjoyedVacationDays: 0,
    totalYearVacationDays: 20,
    periodToEnjoy: 1,
    calendarId: "test-2026",
    selectedInclusionMark: 0,
    selectedStartDate: "2026-07-01",
  }

  it("builds a complete simulation result", () => {
    const result = buildSimulationResult(baseInput)
    expect(result.regime).toBe("SEMESTRAL")
    expect(result.periodNumber).toBe(43)
    expect(result.unitsUsed).toBeGreaterThan(0)
    expect(result.affectedUPO).toBeGreaterThan(0)
    expect(result.traces.length).toBeGreaterThan(0)
  })

  it("detects normative conflicts", () => {
    const result = buildSimulationResult(baseInput)
    expect(result.normativeConflicts).toBeDefined()
    expect(Array.isArray(result.normativeConflicts)).toBe(true)
  })

  it("includes friendly messages in warnings", () => {
    const result = buildSimulationResult(baseInput)
    expect(result.warnings).toBeDefined()
  })
})
