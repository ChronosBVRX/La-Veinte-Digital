import type {
  CalculatorPrefillData,
  EmployeePayrollProfile,
  ResolvedSalaryCategory,
  CalculatedPayrollConcept,
} from "../lib/types"

export function getCalculatorPrefillData(
  profile: EmployeePayrollProfile,
  category: ResolvedSalaryCategory | null,
  calculatedConcepts: Map<string, CalculatedPayrollConcept>,
  _targetDate: string
): CalculatorPrefillData {
  void _targetDate
  const data: CalculatorPrefillData = {}

  if (category) {
    data.categoryId = category.categoryId
    data.categoryName = category.categoryName
    data.workdayHours = category.workdayHours
  }

  const c002 = calculatedConcepts.get("002")
  if (c002) data.concept002 = c002.amount

  const c011 = calculatedConcepts.get("011")
  if (c011) data.concept011 = c011.amount

  const c020 = calculatedConcepts.get("020")
  if (c020) data.concept020 = c020.amount

  const c022 = calculatedConcepts.get("022")
  if (c022) data.concept022 = c022.amount

  const c050 = calculatedConcepts.get("050")
  if (c050) data.concept050 = c050.amount

  const c054 = calculatedConcepts.get("054")
  if (c054) data.concept054 = c054.amount

  if (profile.workdayHours) data.workdayHours = profile.workdayHours
  if (profile.effectiveSeniorityDate) data.effectiveSeniorityDate = profile.effectiveSeniorityDate
  if (profile.displayedSeniorityAtLastPayslip?.years) {
    data.seniorityYears = profile.displayedSeniorityAtLastPayslip.years
  }

  return data
}
