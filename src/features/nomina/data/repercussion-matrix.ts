export interface ConceptImpactRule {
  sourceConceptCode: string
  targetConceptCode: string
  effectiveFrom: string
  effectiveTo?: string
  verificationStatus: "regulation_verified" | "pending_validation"
}

export function getImpactMatrixEffectiveAt(date: string): ConceptImpactRule[] {
  const impacts: ConceptImpactRule[] = []

  const verifiedImpacts: Record<string, string[]> = {
    "012": [
      "029", "030", "032", "033", "035", "037", "043", "047", "048",
      "049", "107", "108", "111", "129", "152", "155", "164", "175", "177",
    ],
    "072": ["107", "108", "111", "152", "155", "164"],
  }

  for (const [source, targets] of Object.entries(verifiedImpacts)) {
    for (const target of targets) {
      impacts.push({
        sourceConceptCode: source,
        targetConceptCode: target,
        effectiveFrom: "2025-01-01",
        verificationStatus: "regulation_verified",
      })
    }
  }

  return impacts.filter(
    (i) => date >= i.effectiveFrom && (!i.effectiveTo || date <= i.effectiveTo)
  )
}
