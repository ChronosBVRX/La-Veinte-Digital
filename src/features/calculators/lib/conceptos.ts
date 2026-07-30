import { roundCurrency } from "./money"

const CLAUSE_63_BIS_C_DAYS: Record<number, number> = {
  5: 60, 6: 63, 7: 66, 8: 69, 9: 72, 10: 75,
  11: 81, 12: 87, 13: 93, 14: 99, 15: 105,
  16: 114, 17: 123, 18: 132, 19: 141, 20: 150,
  21: 156, 22: 162, 23: 168, 24: 174, 25: 180,
  26: 186, 27: 192, 28: 198, 29: 204, 30: 210,
  31: 216, 32: 222, 33: 228, 34: 234, 35: 240,
  36: 246, 37: 252, 38: 258, 39: 264, 40: 270,
}

export function calcularConcepto011(c002: number): number {
  return roundCurrency(c002 * 0.8215)
}

export function calcularConcepto022(c002: number, seniorityYears: number): number {
  if (seniorityYears < 5) return 0
  const days = CLAUSE_63_BIS_C_DAYS[seniorityYears] ?? 270
  const dailyValue = c002 / 15
  return roundCurrency(dailyValue * days)
}

export function parseSeniorityYears(value: string | null | undefined): number {
  if (!value) return 0
  const cleaned = value.trim().toLowerCase().replace("años", "").replace("anos", "").replace("year", "").replace("years", "").trim()
  const num = parseInt(cleaned, 10)
  return isNaN(num) ? 0 : Math.max(0, num)
}
