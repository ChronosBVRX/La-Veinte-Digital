export type ReconciliationCaseType =
  | "WORKER_MULTIPLE_LOCKERS"
  | "LOCKER_MULTIPLE_WORKERS"
  | "WORKER_NOT_FOUND"
  | "OTHER";

export type ReconciliationConfidence = "high" | "medium" | "low" | "none";

export interface ReconciliationCandidate {
  /** ID del casillero (en casos de trabajador) o ID/matrícula del trabajador (en casos de casillero) */
  candidateId: string;
  /** Etiqueta principal (ej. "Casillero 625" o "Juan Pérez") */
  label: string;
  /** Subetiqueta descriptiva (ej. "Matrícula 87654321 · Turno Matutino") */
  sublabel: string;
  /** Número de fila en el archivo de importación Hoja1 */
  rowNumber: number | null;
  /** Observaciones originales del archivo (ej. "ACTUALIZADO 2025") */
  observations: string | null;
  /** Año extraído de la evidencia temporal (ej. 2025) */
  updateYear: number | null;
  /** Estado en la base de datos actual (ej. "Disponible", "Asignado actualmente a esta persona", "Tiene Locker 350") */
  currentStatus: string;
  /** Indica si esta opción presenta conflicto o bloqueo físico */
  hasConflict: boolean;
  /** Indica si coincide con la asignación activa registrada en BD */
  isCurrentAssignment: boolean;
  /** Indica si es la opción recomendada por el motor determinista */
  isRecommended: boolean;
  /** Procedencia de la asignación si existe */
  assignmentSource: "import" | "manual" | "reservation" | "legacy" | null;
  /** Información cruzada si la persona tiene otro casillero activo */
  hasOtherActiveLocker?: boolean;
  otherActiveLockerNumber?: string | null;
  /** Información cruzada si el casillero tiene otro ocupante activo */
  hasOtherActiveWorker?: boolean;
  otherActiveWorkerName?: string | null;
}

export interface ReconciliationTargetWorker {
  id?: string;
  employeeNumber: string;
  name: string;
  currentLockerNumber?: string | null;
  currentLockerStatus?: string | null;
  category?: string | null;
  turn?: string | null;
  plaza?: string | null;
  schedule?: string | null;
  assignment?: string | null;
  adscripcion?: string | null;
}

export interface ReconciliationTargetLocker {
  id?: string;
  lockerNumber: string;
  condition?: string;
  currentWorkerId?: string | null;
  currentWorkerName?: string | null;
  currentWorkerEmployeeNumber?: string | null;
  currentAssignmentSource?: string | null;
  zoneName?: string | null;
}

export interface ReconciliationEvidenceItem {
  type: "temporal" | "assignment" | "status" | "identity";
  label: string;
  detail: string;
  year?: number | null;
}

export interface ReconciliationRecommendation {
  recommendedAction: string;
  recommendedCandidateId: string;
  recommendedCandidateLabel: string;
  confidence: ReconciliationConfidence;
  reasons: string[];
  warnings: string[];
  consequences: string[];
}

export interface ReconciliationHistoryEvent {
  date: string;
  event: string;
  source: string;
}

export interface ReconciliationCase {
  caseId: string;
  type: ReconciliationCaseType;
  title: string;
  subtitle: string;
  reviewItemIds: string[];
  sourceRowNumbers: number[];

  worker?: ReconciliationTargetWorker;
  locker?: ReconciliationTargetLocker;

  candidates: ReconciliationCandidate[];

  currentDatabaseState: {
    assignedWorkerId?: string | null;
    assignedWorkerName?: string | null;
    assignedWorkerEmployeeNumber?: string | null;
    assignmentSource?: string | null;
    assignedAt?: string | null;
    lockerCondition?: string;
    workerActiveLockerNumber?: string | null;
  };

  evidence: ReconciliationEvidenceItem[];

  recommendation?: ReconciliationRecommendation | null;
  confidence: ReconciliationConfidence;
  explanation: string;
  consequences: string[];

  history?: ReconciliationHistoryEvent[];
}

export interface SafeMatchItem {
  reviewItemId: string;
  workerId: string;
  lockerId: string;
  workerName: string;
  employeeNumber: string;
  lockerNumber: string;
}

export interface SafeMatchesSummary {
  totalFound: number;
  safeMatches: SafeMatchItem[];
  requiresLockerReview: number;
  clashesWithManual: number;
  blockedOrMaintenance: number;
  alreadyHasLocker: number;
}
