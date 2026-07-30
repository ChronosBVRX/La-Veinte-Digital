import type { NormativeConflict, VacationRegime } from "./types";

export function detectNormativeConflicts(
  regime: VacationRegime,
  completedYears: number,
  inclusionMark: number,
  administrativeDays: number,
  cctDays: number
): NormativeConflict[] {
  const conflicts: NormativeConflict[] = [];

  if (cctDays < 16 && regime !== "ESTATUTO") {
    conflicts.push({
      requiresReview: true,
      sources: ["CCT 2025-2027 - Cláusula 47", "Procedimiento 1A74-003-025 - Anexo 1"],
      description: `El CCT vigente establece un mínimo de 16 días hábiles, pero el valor calculado es de ${cctDays} días. Se utilizará el valor del CCT vigente como derecho sustantivo.`,
      cctValue: 16,
      administrativeValue: cctDays,
    });
  }

  if (administrativeDays > 0 && cctDays > 0 && administrativeDays !== cctDays) {
    conflicts.push({
      requiresReview: true,
      sources: ["CCT 2025-2027 - Cláusula 47", "Procedimiento 1A74-003-025 - Anexo 1"],
      description: `Diferencia entre el CCT (${cctDays} días) y el valor administrativo (${administrativeDays} días). El derecho sustantivo del CCT prevalece.`,
      cctValue: cctDays,
      administrativeValue: administrativeDays,
    });
  }

  if (regime === "EXTRAORDINARIO_V20" && inclusionMark === 6) {
    conflicts.push({
      requiresReview: true,
      sources: ["CCT 2025-2027 - Cláusula 47", "Procedimiento 1A74-003-025 - Anexo 2"],
      description: "La marca 6 del periodo V20 indica disfrute continuo de 15 días según tabla administrativa, pero podría diferir de la redacción del CCT sobre el periodo extraordinario. Esta combinación requiere validación con Servicios de Personal.",
      cctValue: undefined,
      administrativeValue: 15,
    });
  }

  return conflicts;
}
