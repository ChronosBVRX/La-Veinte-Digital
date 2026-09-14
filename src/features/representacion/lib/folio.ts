// Folios internos legibles: XXI-2026-LIC-000001, etc.
// Nunca sustituyen números institucionales (SIAP, etc.).

export type UnionCaseType = "maternity" | "lactation" | "locker" | "passage_026" | "passage_027" | "license";

export function casePrefix(caseType: UnionCaseType): string {
  switch (caseType) {
    case "maternity":
      return "MAT";
    case "lactation":
      return "LAC";
    case "locker":
      return "LOK";
    case "passage_026":
    case "passage_027":
      return "PAS";
    case "license":
      return "LIC";
  }
}

export function buildFolio(delegationCode: string, year: number, caseType: UnionCaseType, seq: number): string {
  return `${delegationCode}-${year}-${casePrefix(caseType)}-${String(seq).padStart(6, "0")}`;
}
