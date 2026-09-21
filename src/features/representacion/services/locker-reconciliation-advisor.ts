import type {
  ReconciliationCandidate,
  ReconciliationConfidence,
  ReconciliationRecommendation,
  ReconciliationCaseType,
} from "./worker-importer/reconciliation-types";

export interface AdvisorContext {
  caseType: ReconciliationCaseType;
  targetWorkerName?: string;
  targetEmployeeNumber?: string;
  targetLockerNumber?: string;
  workerCurrentLockerNumber?: string | null;
  lockerCurrentWorkerName?: string | null;
  candidates: ReconciliationCandidate[];
}

export interface AdvisorResult {
  recommendation: ReconciliationRecommendation | null;
  confidence: ReconciliationConfidence;
  explanation: string;
  consequences: string[];
}

/**
 * Motor Determinista de Conciliación de Casilleros (100% reproducible, sin LLM).
 * Evalúa evidencia temporal (source_update_year), coherencia con base de datos,
 * estado físico del casillero, asignaciones manuales y superposiciones.
 */
export function adviseReconciliationCase(ctx: AdvisorContext): AdvisorResult {
  const { caseType, candidates } = ctx;

  if (!candidates || candidates.length === 0) {
    return {
      recommendation: null,
      confidence: "none",
      explanation: "No se encontraron candidatos para evaluar en este caso.",
      consequences: [],
    };
  }

  if (caseType === "WORKER_MULTIPLE_LOCKERS") {
    return adviseWorkerMultipleLockers(ctx);
  }

  if (caseType === "LOCKER_MULTIPLE_WORKERS") {
    return adviseLockerMultipleWorkers(ctx);
  }

  if (caseType === "WORKER_NOT_FOUND") {
    return adviseWorkerNotFound(ctx);
  }

  return adviseGeneralCase(ctx);
}

/**
 * Evaluación para: PERSONA CON MÁS DE UN CASILLERO
 */
function adviseWorkerMultipleLockers(ctx: AdvisorContext): AdvisorResult {
  const { candidates, targetWorkerName, workerCurrentLockerNumber } = ctx;
  const reasons: string[] = [];
  const warnings: string[] = [];
  const consequences: string[] = [];

  // 1. Analizar evidencia temporal (source_update_year)
  const candidatesWithYear = candidates.filter((c) => typeof c.updateYear === "number" && !isNaN(c.updateYear));
  let bestYearCandidate: ReconciliationCandidate | null = null;
  let hasYearConflict = false;

  if (candidatesWithYear.length > 0) {
    // Ordenar descendente por año
    const sortedByYear = [...candidatesWithYear].sort((a, b) => (b.updateYear ?? 0) - (a.updateYear ?? 0));
    const highestYear = sortedByYear[0].updateYear!;
    const topYearCandidates = sortedByYear.filter((c) => c.updateYear === highestYear);

    if (topYearCandidates.length === 1) {
      bestYearCandidate = topYearCandidates[0];
    } else {
      hasYearConflict = true;
    }
  }

  // 2. Analizar coincidencia con asignación actual
  const currentAssignmentCandidate = candidates.find((c) => c.isCurrentAssignment);

  // 3. Reglas de decisión jerárquicas
  let chosen: ReconciliationCandidate | null = null;
  let confidence: ReconciliationConfidence = "none";

  if (bestYearCandidate) {
    chosen = bestYearCandidate;
    const others = candidates.filter((c) => c.candidateId !== chosen!.candidateId);
    const otherYears = others
      .map((o) => (o.updateYear ? `${o.updateYear}` : "sin año"))
      .join(", ");

    reasons.push(
      `${chosen.label} parece ser el casillero más reciente porque el archivo lo registra actualizado en ${chosen.updateYear}, frente a las otras alternativas (${otherYears}).`
    );

    if (chosen.isCurrentAssignment) {
      reasons.push("Además, coincide con la asignación activa actual en la base de datos.");
      confidence = "high";
    } else {
      confidence = "high";
    }
  } else if (hasYearConflict) {
    warnings.push("Existen múltiples casilleros registrados con el mismo año de actualización en el archivo.");
    if (currentAssignmentCandidate) {
      chosen = currentAssignmentCandidate;
      reasons.push(
        `Aunque hay empate de año en el archivo, ${chosen.label} coincide con la asignación activa registrada actualmente.`
      );
      confidence = "medium";
    } else {
      confidence = "none";
    }
  } else if (currentAssignmentCandidate) {
    chosen = currentAssignmentCandidate;
    reasons.push(
      `${chosen.label} coincide con la asignación activa actual en la base de datos, aunque el archivo no incluye fecha explícita.`
    );
    confidence = "medium";
  }

  // 4. Verificaciones de bloqueo e integridad física sobre el elegido
  if (chosen) {
    if (chosen.hasConflict) {
      warnings.push(`El ${chosen.label} tiene incidencias o condiciones físicas particulares.`);
    }
    if (chosen.assignmentSource === "manual") {
      warnings.push(
        `El ${chosen.label} cuenta con una asignación manual posterior. Requiere confirmación humana para no sobrescribirla accidentalmente.`
      );
      if (confidence === "high") confidence = "medium";
    }

    // Calcular consecuencias reales antes de guardar
    const workerLabel = targetWorkerName || "el trabajador";
    consequences.push(`Se confirmará la asignación activa del ${chosen.label} para ${workerLabel}.`);

    if (workerCurrentLockerNumber && workerCurrentLockerNumber !== chosen.label.replace(/^Casillero\s*/i, "")) {
      consequences.push(
        `Se liberará la asignación previa del Casillero ${workerCurrentLockerNumber} (quedará disponible).`
      );
    }

    if (chosen.hasOtherActiveWorker) {
      consequences.push(
        `Se liberará la asignación del ocupante actual (${chosen.otherActiveWorkerName || "otro trabajador"}) en el ${chosen.label}.`
      );
    }

    consequences.push("El historial anterior se conservará íntegramente sin borrado físico.");
  }

  const explanation =
    reasons.length > 0
      ? reasons.join(" ")
      : hasYearConflict
      ? "Existen múltiples casilleros con el mismo año de actualización. Se requiere decisión manual."
      : "No se encontró evidencia temporal suficiente ni asignación previa para sugerir un casillero automáticamente.";

  const recommendation: ReconciliationRecommendation | null =
    chosen && confidence !== "none"
      ? {
          recommendedAction: "select_locker_for_worker",
          recommendedCandidateId: chosen.candidateId,
          recommendedCandidateLabel: chosen.label,
          confidence,
          reasons,
          warnings,
          consequences,
        }
      : null;

  return {
    recommendation,
    confidence,
    explanation,
    consequences,
  };
}

/**
 * Evaluación para: CASILLERO CON MÁS DE UNA PERSONA
 */
function adviseLockerMultipleWorkers(ctx: AdvisorContext): AdvisorResult {
  const { candidates, targetLockerNumber, lockerCurrentWorkerName } = ctx;
  const reasons: string[] = [];
  const warnings: string[] = [];
  const consequences: string[] = [];

  // 1. Evidencia temporal
  const candidatesWithYear = candidates.filter((c) => typeof c.updateYear === "number" && !isNaN(c.updateYear));
  let bestYearCandidate: ReconciliationCandidate | null = null;
  let hasYearConflict = false;

  if (candidatesWithYear.length > 0) {
    const sorted = [...candidatesWithYear].sort((a, b) => (b.updateYear ?? 0) - (a.updateYear ?? 0));
    const highestYear = sorted[0].updateYear!;
    const topCandidates = sorted.filter((c) => c.updateYear === highestYear);

    if (topCandidates.length === 1) {
      bestYearCandidate = topCandidates[0];
    } else {
      hasYearConflict = true;
    }
  }

  // 2. Coincidencia con asignación activa en el casillero
  const currentOccupantCandidate = candidates.find((c) => c.isCurrentAssignment);

  let chosen: ReconciliationCandidate | null = null;
  let confidence: ReconciliationConfidence = "none";

  if (bestYearCandidate) {
    chosen = bestYearCandidate;
    reasons.push(
      `${chosen.label} parece ser la asignación vigente porque es el registro más reciente en el archivo (año ${chosen.updateYear}).`
    );

    if (chosen.isCurrentAssignment) {
      reasons.push("Además coincide con la persona que actualmente ocupa el casillero.");
      confidence = "high";
    } else {
      confidence = "high";
    }
  } else if (hasYearConflict) {
    warnings.push("Varios candidatos tienen el mismo año de actualización.");
    if (currentOccupantCandidate) {
      chosen = currentOccupantCandidate;
      reasons.push(
        `Ante el empate en el archivo, ${chosen.label} es quien actualmente tiene la asignación activa.`
      );
      confidence = "medium";
    } else {
      confidence = "none";
    }
  } else if (currentOccupantCandidate) {
    chosen = currentOccupantCandidate;
    reasons.push(
      `${chosen.label} es quien actualmente tiene la asignación activa en el casillero, aunque el archivo no especifica año.`
    );
    confidence = "medium";
  }

  // Comprobar si los otros candidatos ya cuentan con otro casillero
  for (const c of candidates) {
    if (c.hasOtherActiveLocker && c.otherActiveLockerNumber) {
      warnings.push(`${c.label} ya cuenta con el Casillero ${c.otherActiveLockerNumber} asignado activamente.`);
    }
  }

  if (chosen) {
    const lockerNum = targetLockerNumber || "este casillero";
    consequences.push(`Se asignará formalmente el Casillero ${lockerNum} a ${chosen.label}.`);

    if (chosen.hasOtherActiveLocker && chosen.otherActiveLockerNumber) {
      consequences.push(
        `Se liberará el Casillero ${chosen.otherActiveLockerNumber} que ${chosen.label} tenía asignado previamente.`
      );
    }

    if (lockerCurrentWorkerName && lockerCurrentWorkerName !== chosen.label) {
      consequences.push(
        `Se liberará la asignación previa de ${lockerCurrentWorkerName} en el Casillero ${lockerNum}.`
      );
    }

    consequences.push("Las demás personas en disputa quedarán sin este casillero y registradas en historial.");
  }

  const explanation =
    reasons.length > 0
      ? reasons.join(" ")
      : hasYearConflict
      ? "Existen múltiples personas con la misma antigüedad en el archivo. Se requiere decisión del administrador."
      : "No se encontró evidencia temporal para recomendar un trabajador automáticamente.";

  const recommendation: ReconciliationRecommendation | null =
    chosen && confidence !== "none"
      ? {
          recommendedAction: "select_worker_for_locker",
          recommendedCandidateId: chosen.candidateId,
          recommendedCandidateLabel: chosen.label,
          confidence,
          reasons,
          warnings,
          consequences,
        }
      : null;

  return {
    recommendation,
    confidence,
    explanation,
    consequences,
  };
}

/**
 * Evaluación para: PERSONA NO ENCONTRADA EN EL PADRÓN
 */
function adviseWorkerNotFound(ctx: AdvisorContext): AdvisorResult {
  const { candidates, targetEmployeeNumber, targetLockerNumber } = ctx;
  const reasons: string[] = [];
  const warnings: string[] = [];
  const consequences: string[] = [];

  const exactMatch = candidates.find(
    (c) => targetEmployeeNumber && c.sublabel.includes(targetEmployeeNumber)
  );

  let chosen: ReconciliationCandidate | null = null;
  let confidence: ReconciliationConfidence = "none";

  if (exactMatch) {
    chosen = exactMatch;
    reasons.push(
      `Encontramos una coincidencia exacta por matrícula (${targetEmployeeNumber}) en la base de trabajadores sindicales.`
    );
    confidence = "high";

    if (chosen.hasOtherActiveLocker && chosen.otherActiveLockerNumber) {
      warnings.push(
        `Atención: esta persona ya tiene asignado el Casillero ${chosen.otherActiveLockerNumber}.`
      );
      if (confidence === "high") confidence = "medium";
    }

    consequences.push(
      `Se vinculará el Casillero ${targetLockerNumber || ""} con ${chosen.label} (Matrícula ${targetEmployeeNumber}).`
    );
    consequences.push("El registro pendiente quedará resuelto.");
  } else if (candidates.length > 0) {
    warnings.push("Se encontraron posibles coincidencias por nombre pero con matrícula distinta.");
    confidence = "low";
  }

  const explanation =
    reasons.length > 0
      ? reasons.join(" ")
      : "La persona registrada en el archivo no existe en el padrón de trabajadores. Requiere búsqueda manual.";

  const recommendation: ReconciliationRecommendation | null =
    chosen && confidence !== "none"
      ? {
          recommendedAction: "link_worker_to_locker",
          recommendedCandidateId: chosen.candidateId,
          recommendedCandidateLabel: chosen.label,
          confidence,
          reasons,
          warnings,
          consequences,
        }
      : null;

  return {
    recommendation,
    confidence,
    explanation,
    consequences,
  };
}

/**
 * Evaluación para otros casos o genéricos
 */
function adviseGeneralCase(ctx: AdvisorContext): AdvisorResult {
  const candidate = ctx.candidates[0] || null;
  return {
    recommendation: null,
    confidence: "none",
    explanation: candidate
      ? `Registro pendiente en ${candidate.label}. Requiere revisión manual.`
      : "Requiere revisión manual.",
    consequences: [],
  };
}
