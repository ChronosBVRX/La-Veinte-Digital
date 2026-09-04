import { describe, it, expect } from "vitest"
import { getCctAnnualDays, getEstatutoAnnualDays, getRadiationDaysForPeriod, determineVacationRegime, isEligibleForV20, getVacationDivision, getUnitsForInclusion } from "../domain/entitlement"
import { getSemestralTransition, getCompatibleSemestralInclusionMarks, isCycleClosed, applyInclusionMark, SEMESTRAL_CLOSED_STATES, getCompatibleV20Options } from "../domain/continuity"
import { validateAnticipation, calculateReturnDate, calculateVacationRange, validateModification, isFirstPeriod } from "../domain/validation"
import { getMandatoryRestDates, getMandatoryRestDatesForRange, isWeeklyRest } from "../domain/holidays"
import { getAccumulatedDayJourneys, getAccumulatedNightVeladas, isWorkDay, getWorkScheduleForProfile, getUnitType } from "../domain/schedules"
import { getCompatibleCuatrimestralOptions } from "../domain/continuity"
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
    expect(getRadiationDaysForPeriod(5, 0)).toBe(9)
    expect(getRadiationDaysForPeriod(5, 1)).toBe(10)
    expect(getRadiationDaysForPeriod(5, 2)).toBe(9)
    expect(getRadiationDaysForPeriod(6, 0)).toBe(10)
    expect(getRadiationDaysForPeriod(6, 1)).toBe(10)
    expect(getRadiationDaysForPeriod(6, 2)).toBe(10)
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

describe("getUnitsForInclusion", () => {
  it("uses full CCT days for continuous enjoyment (mark 0)", () => {
    expect(getUnitsForInclusion("SEMESTRAL", 16, 0, 14, 43)).toBe(16)
  })

  it("uses first half for fraction marks", () => {
    expect(getUnitsForInclusion("SEMESTRAL", 17, 1, 14, 43)).toBe(8)
    expect(getUnitsForInclusion("SEMESTRAL", 17, 2, 14, 43)).toBe(8)
    expect(getUnitsForInclusion("SEMESTRAL", 17, 4, 14, 43)).toBe(8)
  })

  it("uses second half for completion marks", () => {
    expect(getUnitsForInclusion("SEMESTRAL", 17, 3, 14, 43)).toBe(9)
    expect(getUnitsForInclusion("SEMESTRAL", 17, 9, 14, 43)).toBe(9)
  })

  it("uses RADIATION_DAYS table per period for CUATRIMESTRAL", () => {
    expect(getUnitsForInclusion("CUATRIMESTRAL", 20, 0, 0, 1)).toBe(7)
    expect(getUnitsForInclusion("CUATRIMESTRAL", 20, 0, 0, 2)).toBe(8)
    expect(getUnitsForInclusion("CUATRIMESTRAL", 20, 0, 0, 3)).toBe(7)
    expect(getUnitsForInclusion("CUATRIMESTRAL", 20, 0, 0, 4)).toBe(7)
  })

  it("uses normative units for V20 marks (0: 10, 6: 15, 7: 0, 8: 0)", () => {
    expect(getUnitsForInclusion("EXTRAORDINARIO_V20", 20, 0, 20, 1)).toBe(10)
    expect(getUnitsForInclusion("EXTRAORDINARIO_V20", 20, 6, 20, 1)).toBe(15)
    expect(getUnitsForInclusion("EXTRAORDINARIO_V20", 20, 7, 20, 1)).toBe(0)
    expect(getUnitsForInclusion("EXTRAORDINARIO_V20", 20, 8, 20, 1)).toBe(0)
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

describe("V20 Continuity State Machine", () => {
  it("allows all four independent normative choices [0, 6, 7, 8] without artificial chaining", () => {
    expect(getCompatibleV20Options(0)).toEqual([0, 6, 7, 8])
    expect(getCompatibleV20Options(1)).toEqual([0, 6, 7, 8])
    expect(getCompatibleV20Options(2)).toEqual([0, 6, 7, 8])
    expect(getCompatibleV20Options(3)).toEqual([0, 6, 7, 8])
  })

  it("each V20 option increments 1 UPO, never fractioned", () => {
    for (const mark of [0, 6, 7, 8]) {
      const t = applyInclusionMark("EXTRAORDINARIO_V20", 0, mark)
      if ("error" in t) throw new Error(t.error)
      expect(t.nextContinuity).toBe(0)
      expect(t.upoIncrement).toBe(1)
      expect(t.stage).toBe("FULL_OR_CLOSED_OPTION")
    }
  })

  it("blocks invalid marks not recognized by V20", () => {
    const bad = applyInclusionMark("EXTRAORDINARIO_V20", 0, 1)
    expect("error" in bad).toBe(true)
    const bad2 = applyInclusionMark("EXTRAORDINARIO_V20", 0, 2)
    expect("error" in bad2).toBe(true)
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

  it("v20 strictly requires 20 years", () => {
    const rejectedWith19 = validateAnticipation("EXTRAORDINARIO_V20", "2026-10-14", "2026-07-01", false, 19)
    expect(rejectedWith19.allowed).toBe(false)
    expect(rejectedWith19.reasonCode).toBe("V20_REQUIRES_20_YEARS")

    const allowedWith20 = validateAnticipation("EXTRAORDINARIO_V20", "2026-10-14", "2026-07-01", false, 20)
    expect(allowedWith20.allowed).toBe(true)
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

  it("allows 15-44 day changes only with normative review", () => {
    const result = validateModification("2026-10-14", "2026-09-20")
    expect(result.allowed).toBe(true)
    expect(result.requiresSpecialProcess).toBe(true)
    expect(result.requiresNormativeReview).toBe(true)
  })

  it("blocks changes within the exceptional 15-day margin", () => {
    const result = validateModification("2026-10-14", "2026-10-01")
    expect(result.allowed).toBe(false)
    expect(result.requiresNormativeReview).toBe(true)
  })

  it("cannot modify after start date", () => {
    const result = validateModification("2026-10-14", "2026-10-20")
    expect(result.allowed).toBe(false)
  })

  it("measures anticipation from the request date, not the new date", () => {
    const result = validateModification("2026-10-14", "2026-09-20", "2026-09-01")
    expect(result.allowed).toBe(true)
    expect(result.requiresNormativeReview).toBe(true)
  })

  it("blocks when the request is inside the exceptional 15-day margin", () => {
    const result = validateModification("2026-10-14", "2026-10-05", "2026-10-01")
    expect(result.allowed).toBe(false)
    expect(result.requiresNormativeReview).toBe(true)
  })

  it("blocks when the period already started at request time", () => {
    const result = validateModification("2026-10-14", "2026-10-20", "2026-10-16")
    expect(result.allowed).toBe(false)
  })

  it("blocks a new date earlier than the request date", () => {
    const result = validateModification("2026-10-14", "2026-08-01", "2026-09-01")
    expect(result.allowed).toBe(false)
  })
})

describe("calculateVacationRange", () => {
  it("consumes only workable dates for weekend-accumulated schedules", () => {
    const result = calculateVacationRange({
      startDate: "2026-07-25", // Saturday
      entitlementUnits: 3,
      unitType: "WORKDAY",
      weeklyRestDays: [0, 1, 2, 3, 4],
      mandatoryRestDates: [],
      workSchedule: { type: "ACCUMULATED_WEEKEND_DAY", workingDays: [5, 6] },
    })
    // Sáb 25, Dom 26, Lun 27 (no laborable, no consume) → Sáb 01-08
    expect(result.consumedDates).toEqual(["2026-07-25", "2026-07-26", "2026-08-01"])
    expect(result.totalVacationUnits).toBe(3)
    expect(result.returnToWorkDate).toBe("2026-08-02")
  })

  it("excludes mandatory rest dates without consuming units", () => {
    const result = calculateVacationRange({
      startDate: "2026-09-14",
      entitlementUnits: 4,
      unitType: "WORKDAY",
      weeklyRestDays: [5, 6],
      mandatoryRestDates: ["2026-09-15", "2026-09-16"],
      workSchedule: { type: "ORDINARY" },
    })
    expect(result.consumedDates).toContain("2026-09-14")
    expect(result.consumedDates).not.toContain("2026-09-15")
    expect(result.consumedDates).not.toContain("2026-09-16")
    expect(result.excludedMandatoryRestDates).toEqual(["2026-09-15", "2026-09-16"])
  })
})

describe("isFirstPeriod", () => {
  it("is true only when nothing was enjoyed and it is period 1", () => {
    expect(isFirstPeriod(1, 0, 0)).toBe(true)
  })

  it("is false when period number is greater than 1", () => {
    expect(isFirstPeriod(2, 0, 0)).toBe(false)
  })

  it("is false when there are expired periods or enjoyed days", () => {
    expect(isFirstPeriod(1, 1, 0)).toBe(false)
    expect(isFirstPeriod(1, 0, 8)).toBe(false)
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

  it("uses the real work schedule when provided", () => {
    const result = calculateReturnDate(
      "2026-07-25", 2, "JOURNEY", [0, 1, 2, 3, 4],
      [],
      getWorkScheduleForProfile({
        workScheduleType: "ACCUMULATED_WEEKEND_DAY",
        weeklyRestDays: [0, 1, 2, 3, 4],
      })
    )
    // Sáb 25 y Dom 26 son jornadas laborables; regresa el sábado siguiente 01-08
    expect(result.lastDate).toBe("2026-07-26")
    expect(result.returnDate).toBe("2026-08-01")
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

  it("uses full entitlement for continuous inclusion", () => {
    const result = buildSimulationResult(baseInput)
    expect(result.unitsUsed).toBe(20)
    expect(result.endDate).toBeDefined()
    expect(result.returnDate).toBeDefined()
  })

  it("uses half entitlement for first fraction inclusion", () => {
    const result = buildSimulationResult({ ...baseInput, selectedInclusionMark: 1 })
    expect(result.unitsUsed).toBe(10)
  })

  it("blocks invalid transitions without producing apparent data", () => {
    const result = buildSimulationResult({
      ...baseInput,
      continuityMark: 1, // primera parte pendiente
      selectedInclusionMark: 0, // inválida desde continuidad 1
    })
    expect(result.status).toBe("BLOCKED")
    expect(result.requiresSpecialProcess).toBe(true)
    expect(result.warnings.length).toBeGreaterThan(0)
    expect(result.endDate).toBeUndefined()
    expect(result.returnDate).toBeUndefined()
    expect(result.unitsUsed).toBeUndefined()
    expect(result.affectedUPO).toBeUndefined()
    expect(result.resultingContinuityMark).toBeUndefined()
    expect(result.anticipationResult).toBeUndefined()
    expect(result.compatibleOptions).toBeDefined()
    expect(result.compatibleOptions!.length).toBeGreaterThan(0)
    expect(result.compatibleOptions![0]).toContain("Completar la segunda parte")
    const trace = result.traces.find((t) => t.ruleCode === "APPLY_INCLUSION_MARK")
    expect(trace?.result).toBe("BLOCKED")
  })

  it("reports compatible options per regime for cuatrimestral blocks", () => {
    const result = buildSimulationResult({
      ...baseInput,
      regime: "CUATRIMESTRAL",
      continuityMark: 1, // solo Marca 0 es compatible
      selectedInclusionMark: 2, // inválida desde continuidad 1
    })
    expect(result.status).toBe("BLOCKED")
    expect(result.compatibleOptions).toEqual(["Periodo regular con ayuda (Marca 0)"])
  })

  it("reports compatible options for estatuto blocks", () => {
    const result = buildSimulationResult({
      ...baseInput,
      regime: "ESTATUTO",
      continuityMark: 3, // solo marca 3 es compatible
      selectedInclusionMark: 0,
    })
    expect(result.status).toBe("BLOCKED")
    expect(result.compatibleOptions).toEqual(["Completar la segunda parte del periodo"])
  })

  it("traces the complete-period unit split for marks 2 and 3", () => {
    const result = buildSimulationResult({ ...baseInput, selectedInclusionMark: 2 })
    expect(result.status).toBe("COMPUTED")
    expect(result.unitsUsed).toBe(10)
    const trace = result.traces.find((t) => t.ruleCode === "UNITS_COMPLETE_PERIOD")
    expect(trace).toBeDefined()
    expect(trace!.result).toBe("APPLIED")
    expect(String(trace!.explanation)).toContain("mitad semestral")
  })

  it("uses RADIATION_DAYS units for CUATRIMESTRAL regime", () => {
    const result = buildSimulationResult({
      ...baseInput,
      regime: "CUATRIMESTRAL",
      workerProfile: {
        ...baseInput.workerProfile,
        contractType: "BASE",
        radiologicalExposure: true,
        effectiveSeniority: { years: 0, fortnights: 0, days: 0 },
      },
      nextPeriodNumber: 2,
    })
    expect(result.unitsUsed).toBe(8) // RADIATION_DAYS[0][1]
  })

  it("blocks anticipation for first period before completing first year", () => {
    const result = buildSimulationResult({
      ...baseInput,
      workerProfile: {
        ...baseInput.workerProfile,
        effectiveSeniority: { years: 0, fortnights: 0, days: 0 },
      },
      nextPeriodNumber: 1,
      expiredVacationPeriods: 0,
      enjoyedVacationDays: 0,
    })
    expect(result.requiresSpecialProcess).toBe(true)
    expect(result.anticipationResult?.allowed).toBe(false)
    expect(result.anticipationResult?.reasonCode).toBe("FIRST_PERIOD_BEFORE_YEAR")
  })
})

describe("Cuatrimestral State Machine", () => {
  it("labels option A steps as CUATRIMESTRAL_SEQUENCE_A", () => {
    const steps = getCompatibleCuatrimestralOptions(0)
    expect(steps.filter((s) => s.option === "A").length).toBe(1)
    expect(steps.filter((s) => s.option === "B").length).toBe(1)
    const firstA = applyInclusionMark("CUATRIMESTRAL", 0, 0)
    if ("error" in firstA) throw new Error(firstA.error)
    expect(firstA.stage).toBe("CUATRIMESTRAL_SEQUENCE_A")
    const firstB = applyInclusionMark("CUATRIMESTRAL", 0, 2)
    if ("error" in firstB) throw new Error(firstB.error)
    expect(firstB.stage).toBe("CUATRIMESTRAL_SEQUENCE_B")
    expect(firstB.nextContinuity).toBe(4)
  })

  it("advances option A: 1 → 2 → 3", () => {
    const s1 = applyInclusionMark("CUATRIMESTRAL", 1, 0)
    if ("error" in s1) throw new Error(s1.error)
    expect(s1.nextContinuity).toBe(2)
    const s2 = applyInclusionMark("CUATRIMESTRAL", 2, 0)
    if ("error" in s2) throw new Error(s2.error)
    expect(s2.nextContinuity).toBe(3)
  })

  it("advances option B: 4 → 9 → 14", () => {
    const s1 = applyInclusionMark("CUATRIMESTRAL", 4, 5)
    if ("error" in s1) throw new Error(s1.error)
    expect(s1.nextContinuity).toBe(9)
    expect(s1.stage).toBe("CUATRIMESTRAL_SEQUENCE_B")
    const s2 = applyInclusionMark("CUATRIMESTRAL", 9, 5)
    if ("error" in s2) throw new Error(s2.error)
    expect(s2.nextContinuity).toBe(14)
  })

  it("blocks incompatible marks mid-sequence", () => {
    expect("error" in applyInclusionMark("CUATRIMESTRAL", 4, 0)).toBe(true)
    expect("error" in applyInclusionMark("CUATRIMESTRAL", 1, 5)).toBe(true)
    expect("error" in applyInclusionMark("CUATRIMESTRAL", 2, 5)).toBe(true)
    expect("error" in applyInclusionMark("CUATRIMESTRAL", 9, 2)).toBe(true)
  })

  it("reopens from closed state 14 with either option", () => {
    const a = applyInclusionMark("CUATRIMESTRAL", 14, 0)
    if ("error" in a) throw new Error(a.error)
    expect(a.stage).toBe("CUATRIMESTRAL_SEQUENCE_A")
    const b = applyInclusionMark("CUATRIMESTRAL", 14, 2)
    if ("error" in b) throw new Error(b.error)
    expect(b.stage).toBe("CUATRIMESTRAL_SEQUENCE_B")
  })
})

describe("Estatuto State Machine", () => {
  it("only allows mark 2 from a closed state, mark 3 from continuity 3", () => {
    const first = applyInclusionMark("ESTATUTO", 0, 2)
    if ("error" in first) throw new Error(first.error)
    expect(first.nextContinuity).toBe(3)
    expect(first.stage).toBe("FIRST_COMPLETE_PERIOD")

    const second = applyInclusionMark("ESTATUTO", 3, 3)
    if ("error" in second) throw new Error(second.error)
    expect(second.nextContinuity).toBe(6)
    expect(second.stage).toBe("SECOND_COMPLETE_PERIOD")
  })

  it("closes the cycle with mark 0 from continuity 6", () => {
    const closed = applyInclusionMark("ESTATUTO", 6, 0)
    if ("error" in closed) throw new Error(closed.error)
    expect(closed.nextContinuity).toBe(0)
    expect(closed.upoIncrement).toBe(2)
  })

  it("blocks invalid transitions", () => {
    expect("error" in applyInclusionMark("ESTATUTO", 6, 2)).toBe(true)
    expect("error" in applyInclusionMark("ESTATUTO", 0, 3)).toBe(true)
    expect("error" in applyInclusionMark("ESTATUTO", 3, 2)).toBe(true)
  })
})

describe("Vacation range limits", () => {
  it("flags truncation when the 365-day cap is hit", () => {
    const result = calculateVacationRange({
      startDate: "2026-01-01",
      entitlementUnits: 500,
      unitType: "WORKDAY",
      weeklyRestDays: [],
      mandatoryRestDates: [],
      workSchedule: { type: "ORDINARY" },
    })
    expect(result.truncated).toBe(true)
    expect(result.totalVacationUnits).toBe(500)
    expect(result.consumedDates.length).toBeLessThan(500)
  })

  it("does not flag truncation for normal entitlements", () => {
    const result = calculateVacationRange({
      startDate: "2026-01-01",
      entitlementUnits: 20,
      unitType: "WORKDAY",
      weeklyRestDays: [5, 6],
      mandatoryRestDates: [],
      workSchedule: { type: "ORDINARY" },
    })
    expect(result.truncated).toBe(false)
  })
})

describe("getMandatoryRestDatesForRange", () => {
  it("includes holidays from both years when the range crosses dic-ene", () => {
    const dates = getMandatoryRestDatesForRange("2026-12-20", 40)
    expect(dates).toContain("2026-12-25")
    expect(dates).toContain("2027-01-01")
    expect(dates).toContain("2026-01-01")
  })

  it("includes only the single year for short ranges", () => {
    const dates = getMandatoryRestDatesForRange("2026-06-01", 20)
    expect(dates).toContain("2026-09-15")
    expect(dates).not.toContain("2027-01-01")
  })
})

describe("getUnitType", () => {
  it("maps every schedule type to its unit", () => {
    expect(getUnitType("ORDINARY")).toBe("WORKDAY")
    expect(getUnitType("ACCUMULATED_WEEKEND_DAY")).toBe("JOURNEY")
    expect(getUnitType("ACCUMULATED_NIGHT")).toBe("VELADA")
    expect(getUnitType("ROTATING")).toBe("WORKDAY")
    expect(getUnitType("CUSTOM")).toBe("WORKDAY")
  })

  it("returns explicit schedule definitions for all types", () => {
    expect(getWorkScheduleForProfile({ workScheduleType: "ACCUMULATED_WEEKEND_DAY", weeklyRestDays: [] })).toEqual({ type: "ACCUMULATED_WEEKEND_DAY", workingDays: [5, 6] })
    expect(getWorkScheduleForProfile({ workScheduleType: "ACCUMULATED_NIGHT", weeklyRestDays: [] })).toEqual({ type: "ACCUMULATED_NIGHT", workingDays: [0, 1, 2, 3, 4, 5, 6] })
    expect(getWorkScheduleForProfile({ workScheduleType: "ROTATING", weeklyRestDays: [] })).toEqual({ type: "ROTATING", workingDays: [0, 1, 2, 3, 4, 5, 6] })
    expect(getWorkScheduleForProfile({ workScheduleType: "CUSTOM", weeklyRestDays: [] })).toEqual({ type: "CUSTOM", workingDays: [0, 1, 2, 3, 4, 5, 6] })
    expect(getWorkScheduleForProfile({ workScheduleType: "ORDINARY", weeklyRestDays: [] })).toEqual({ type: "ORDINARY" })
  })

  it("derives working days from declared rest days for accumulated schedules", () => {
    expect(getWorkScheduleForProfile({ workScheduleType: "ACCUMULATED_NIGHT", weeklyRestDays: [5, 6] })).toEqual({ type: "ACCUMULATED_NIGHT", workingDays: [0, 1, 2, 3, 4] })
    expect(getWorkScheduleForProfile({ workScheduleType: "ROTATING", weeklyRestDays: [0, 2] })).toEqual({ type: "ROTATING", workingDays: [1, 3, 4, 5, 6] })
    expect(getWorkScheduleForProfile({ workScheduleType: "CUSTOM", weeklyRestDays: [0, 1, 2, 3, 4, 5, 6] })).toEqual({ type: "CUSTOM", workingDays: [] })
  })

  it("night schedules respect declared rest days via isWorkDay", () => {
    const night = getWorkScheduleForProfile({ workScheduleType: "ACCUMULATED_NIGHT", weeklyRestDays: [5, 6] })
    // Monday July 27, 2026 → laborable; Saturday July 25 → descanso
    expect(isWorkDay("2026-07-27", night)).toBe(true)
    expect(isWorkDay("2026-07-25", night)).toBe(false)
  })
})

describe("semestral FIRST_COMPLETE_PERIOD marks", () => {
  it("mark 2 from a closed state enters FIRST_COMPLETE_PERIOD", () => {
    const t = getSemestralTransition(0, 2)
    expect(t).toBeDefined()
    expect(t!.stage).toBe("FIRST_COMPLETE_PERIOD")
    expect(t!.nextContinuity).toBe(3)
  })

  it("mark 3 completes the period only from continuity 3", () => {
    const t = getSemestralTransition(3, 3)
    expect(t).toBeDefined()
    expect(t!.stage).toBe("SECOND_COMPLETE_PERIOD")
    expect(t!.nextContinuity).toBe(6)
  })

  it("mark 3 is blocked from closed states", () => {
    const t = getSemestralTransition(0, 3)
    expect(t).toBeUndefined()
  })
})
