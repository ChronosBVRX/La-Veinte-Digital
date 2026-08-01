import type { CalculatedPayrollConcept } from "./types"
import { getImpactMatrixEffectiveAt } from "../data/repercussion-matrix"

export interface ConceptBaseResult {
  targetConceptCode: string
  baseAmount: number
  integratedConcepts: { code: string; amount: number }[]
  pendingImpacts: string[]
}

export function buildBaseForConcept(
  targetConceptCode: string,
  concepts: ReadonlyMap<string, CalculatedPayrollConcept>,
  date: string,
): ConceptBaseResult {
  const impactMatrix = getImpactMatrixEffectiveAt(date)
  const relevantImpacts = impactMatrix.filter((i) => i.targetConceptCode === targetConceptCode)

  const integratedConcepts: { code: string; amount: number }[] = []
  const pendingImpacts: string[] = []
  let baseAmount = 0

  for (const impact of relevantImpacts) {
    const sourceConcept = concepts.get(impact.sourceConceptCode)
    if (!sourceConcept || !sourceConcept.included) continue

    if (impact.verificationStatus === "regulation_verified") {
      baseAmount += sourceConcept.amount
      integratedConcepts.push({ code: sourceConcept.code, amount: sourceConcept.amount })
    } else {
      pendingImpacts.push(`${impact.sourceConceptCode} -> ${impact.targetConceptCode}`)
    }
  }

  return {
    targetConceptCode,
    baseAmount,
    integratedConcepts,
    pendingImpacts,
  }
}

export function buildAllBases(
  concepts: ReadonlyMap<string, CalculatedPayrollConcept>,
  date: string,
): Map<string, ConceptBaseResult> {
  const targetCodes = new Set<string>()
  const impactMatrix = getImpactMatrixEffectiveAt(date)
  for (const impact of impactMatrix) {
    targetCodes.add(impact.targetConceptCode)
  }

  const results = new Map<string, ConceptBaseResult>()
  for (const targetCode of targetCodes) {
    results.set(targetCode, buildBaseForConcept(targetCode, concepts, date))
  }
  return results
}
