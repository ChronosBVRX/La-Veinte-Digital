import type { ParsedImssTarjeton } from "@/shared/contracts/tarjeton-import"

export function markConceptsConfirmedByUser(parsed: ParsedImssTarjeton): ParsedImssTarjeton {
  const mark = (lines: ParsedImssTarjeton["payroll"]["earnings"]) =>
    lines.map((line) => ({ ...line, confirmedByUser: true }))

  return {
    ...parsed,
    payroll: {
      ...parsed.payroll,
      earnings: mark(parsed.payroll.earnings),
      deductions: mark(parsed.payroll.deductions),
    },
  }
}
