import type {
  ReconciliationCase,
  ReconciliationCandidate,
  ReconciliationCaseType,
  SafeMatchesSummary,
  SafeMatchItem,
} from "./worker-importer/reconciliation-types";
import { adviseReconciliationCase } from "./locker-reconciliation-advisor";
import type { LockerReviewItem } from "./worker-importer/types";

export interface SourceRowData {
  batch_id?: string | null;
  row_number: number;
  matricula_raw: string | null;
  matricula_normalized: string | null;
  worker_name_raw: string | null;
  plaza_raw: string | null;
  turn_raw: string | null;
  category_raw: string | null;
  schedule_raw: string | null;
  locker_raw: string | null;
  locker_normalized: string | null;
  observations_raw: string | null;
  supplementary_data: Record<string, unknown> | null;
}

export interface LockerData {
  id: string;
  locker_number: string;
  status: string;
  condition: string | null;
  zone_id: string | null;
  bank_id: string | null;
  notes: string | null;
}

export interface AssignmentData {
  id: string;
  locker_id: string;
  worker_id: string;
  status: string;
  source: string | null;
  assigned_at: string | null;
  admin_override?: boolean;
}

export interface WorkerData {
  id: string;
  employee_number: string;
  first_name: string;
  paternal_surname: string;
  maternal_surname: string | null;
  category?: string | null;
  turn?: string | null;
  assignment?: string | null;
  adscripcion?: string | null;
}

export interface BuildCasesParams {
  items: LockerReviewItem[];
  sourceRows: SourceRowData[];
  lockers: LockerData[];
  workers: WorkerData[];
  assignments: AssignmentData[];
  search?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
}

export interface BuildCasesResult {
  cases: ReconciliationCase[];
  totalCases: number;
  totalReviewItems: number;
  caseCounts: {
    total: number;
    workerNotFound: number;
    multipleWorkers: number;
    multipleLockers: number;
    other: number;
  };
  itemCounts: {
    total: number;
    workerNotFound: number;
    multipleWorkers: number;
    multipleLockers: number;
    other: number;
  };
  safeMatchesSummary: SafeMatchesSummary;
}

/**
 * Normaliza cadenas para comparaciones fonéticas y de búsqueda sin acentos
 */
function normalizeStr(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Extrae año de actualización de observaciones o supplementary_data
 */
function extractUpdateYear(
  observations: string | null | undefined,
  supplementary: Record<string, unknown> | null | undefined
): number | null {
  if (supplementary && typeof supplementary.source_update_year === "number") {
    return supplementary.source_update_year;
  }
  if (!observations) return null;

  // Buscar año de 4 dígitos entre 2000 y 2030 (ej. "ACTUALIZADO 2025", "2024", etc.)
  const match = observations.match(/\b(20[12][0-9])\b/);
  if (match) {
    const y = parseInt(match[1], 10);
    if (!isNaN(y)) return y;
  }
  return null;
}

/**
 * Agrupa review items en casos de conciliación con contexto enriquecido y sugerencias deterministas
 */
export function buildReconciliationCases(params: BuildCasesParams): BuildCasesResult {
  const {
    items,
    sourceRows,
    lockers,
    workers,
    assignments,
    search = "",
    sort = "easy",
    page = 1,
    pageSize = 25,
  } = params;

  // Índices rápidos
  const lockerByNumber = new Map<string, LockerData>();
  const lockerById = new Map<string, LockerData>();
  for (const l of lockers) {
    lockerByNumber.set(l.locker_number, l);
    lockerById.set(l.id, l);
  }

  const workerByEmpNo = new Map<string, WorkerData>();
  const workerById = new Map<string, WorkerData>();
  for (const w of workers) {
    workerByEmpNo.set(w.employee_number, w);
    workerById.set(w.id, w);
  }

  // Asignaciones activas
  const activeAsgByLockerId = new Map<string, AssignmentData>();
  const activeAsgByWorkerId = new Map<string, AssignmentData>();
  for (const a of assignments) {
    if (a.status === "active") {
      activeAsgByLockerId.set(a.locker_id, a);
      activeAsgByWorkerId.set(a.worker_id, a);
    }
  }

  // Filas del archivo por locker_number, por matrícula y por clave compuesta (batch_id:row_number)
  const sourceRowsByLocker = new Map<string, SourceRowData[]>();
  const sourceRowsByEmpNo = new Map<string, SourceRowData[]>();
  const sourceRowsByBatchAndRow = new Map<string, SourceRowData>();
  const sourceRowsByRowNumber = new Map<number, SourceRowData>();

  for (const sr of sourceRows) {
    if (sr.row_number) {
      sourceRowsByRowNumber.set(sr.row_number, sr);
      if (sr.batch_id) {
        sourceRowsByBatchAndRow.set(`${sr.batch_id}:${sr.row_number}`, sr);
      }
    }
    if (sr.locker_normalized) {
      const arr = sourceRowsByLocker.get(sr.locker_normalized) || [];
      arr.push(sr);
      sourceRowsByLocker.set(sr.locker_normalized, arr);
    }
    if (sr.matricula_normalized) {
      const arr = sourceRowsByEmpNo.get(sr.matricula_normalized) || [];
      arr.push(sr);
      sourceRowsByEmpNo.set(sr.matricula_normalized, arr);
    }
  }

  const getSourceRow = (batchId?: string | null, rowNum?: number | null): SourceRowData | null => {
    if (!rowNum) return null;
    if (batchId) {
      const byBatch = sourceRowsByBatchAndRow.get(`${batchId}:${rowNum}`);
      if (byBatch) return byBatch;
    }
    return sourceRowsByRowNumber.get(rowNum) || null;
  };

  // Conteos de filas individuales
  const itemCounts = {
    total: items.length,
    workerNotFound: 0,
    multipleWorkers: 0,
    multipleLockers: 0,
    other: 0,
  };

  for (const it of items) {
    if (it.reason === "WORKER_NOT_FOUND") itemCounts.workerNotFound++;
    else if (
      it.reason === "LOCKER_MULTIPLE_WORKERS" ||
      it.reason === "DUPLICATE_LOCKER_DIFFERENT_WORKERS" ||
      it.reason === "LOCKER_ASSIGNED_TO_OTHER_WORKER"
    ) {
      itemCounts.multipleWorkers++;
    } else if (it.reason === "WORKER_MULTIPLE_LOCKERS") {
      itemCounts.multipleLockers++;
    } else {
      itemCounts.other++;
    }
  }

  // 1. Agrupación en casos con contexto de lote para evitar mezclar evidencias de snapshots distintos
  const casesMap = new Map<string, {
    caseId: string;
    type: ReconciliationCaseType;
    items: LockerReviewItem[];
    empNo?: string;
    lockerNumber?: string;
    batchId?: string;
  }>();

  for (const it of items) {
    let groupKey: string;
    let caseType: ReconciliationCaseType;
    const batchPrefix = it.source_batch_id ? `batch_${it.source_batch_id}_` : "";

    if (it.reason === "WORKER_MULTIPLE_LOCKERS") {
      caseType = "WORKER_MULTIPLE_LOCKERS";
      const empNo = it.source_employee_number || it.source_worker_name || it.id;
      groupKey = `${batchPrefix}worker_${empNo}`;
      const existing = casesMap.get(groupKey);
      if (existing) {
        existing.items.push(it);
      } else {
        casesMap.set(groupKey, {
          caseId: groupKey,
          type: caseType,
          items: [it],
          empNo: it.source_employee_number ?? undefined,
          batchId: it.source_batch_id ?? undefined,
        });
      }
    } else if (
      it.reason === "LOCKER_MULTIPLE_WORKERS" ||
      it.reason === "DUPLICATE_LOCKER_DIFFERENT_WORKERS" ||
      it.reason === "LOCKER_ASSIGNED_TO_OTHER_WORKER"
    ) {
      caseType = "LOCKER_MULTIPLE_WORKERS";
      const lockerNum = it.locker_number;
      groupKey = `${batchPrefix}locker_${lockerNum}`;
      const existing = casesMap.get(groupKey);
      if (existing) {
        existing.items.push(it);
      } else {
        casesMap.set(groupKey, {
          caseId: groupKey,
          type: caseType,
          items: [it],
          lockerNumber: lockerNum,
          batchId: it.source_batch_id ?? undefined,
        });
      }
    } else if (it.reason === "WORKER_NOT_FOUND") {
      caseType = "WORKER_NOT_FOUND";
      const empNo = it.source_employee_number || "sin_mat";
      groupKey = `${batchPrefix}notfound_${empNo}_${it.locker_number}`;
      const existing = casesMap.get(groupKey);
      if (existing) {
        existing.items.push(it);
      } else {
        casesMap.set(groupKey, {
          caseId: groupKey,
          type: caseType,
          items: [it],
          empNo: it.source_employee_number ?? undefined,
          lockerNumber: it.locker_number,
          batchId: it.source_batch_id ?? undefined,
        });
      }
    } else {
      caseType = "OTHER";
      groupKey = `${batchPrefix}other_${it.locker_number}_${it.id}`;
      casesMap.set(groupKey, {
        caseId: groupKey,
        type: caseType,
        items: [it],
        lockerNumber: it.locker_number,
        empNo: it.source_employee_number ?? undefined,
        batchId: it.source_batch_id ?? undefined,
      });
    }
  }

  // 2. Construcción detallada de cada ReconciliationCase
  const builtCases: ReconciliationCase[] = [];

  for (const group of casesMap.values()) {
    const { caseId, type, items: groupItems, empNo, lockerNumber } = group;
    const reviewItemIds = groupItems.map((i) => i.id);
    const sourceRowNumbers = [
      ...new Set(groupItems.map((i) => i.source_row_number).filter((n): n is number => typeof n === "number")),
    ];

    if (type === "WORKER_MULTIPLE_LOCKERS") {
      const first = groupItems[0];
      const workerEmpNo = empNo || first.source_employee_number || "";
      const workerRecord = workerByEmpNo.get(workerEmpNo);
      const wFullName = workerRecord
        ? `${workerRecord.paternal_surname} ${workerRecord.maternal_surname ?? ""} ${workerRecord.first_name}`.trim()
        : "";
      const workerName =
        wFullName ||
        first.source_worker_name ||
        (workerEmpNo ? `Matrícula ${workerEmpNo}` : "Trabajador no especificado");

      const activeAsg = workerRecord ? activeAsgByWorkerId.get(workerRecord.id) : undefined;
      const activeLocker = activeAsg ? lockerById.get(activeAsg.locker_id) : undefined;

      // Recolectar todos los casilleros candidatos asociados a este trabajador
      const candidateLockersMap = new Map<string, {
        lockerNumber: string;
        rowNumber: number | null;
        observations: string | null;
        updateYear: number | null;
      }>();

      // Desde los review items del grupo
      for (const it of groupItems) {
        if (it.locker_number) {
          const sr = getSourceRow(it.source_batch_id, it.source_row_number);
          const obs = sr?.observations_raw || it.source_notes || null;
          const yr = extractUpdateYear(obs, sr?.supplementary_data);
          candidateLockersMap.set(it.locker_number, {
            lockerNumber: it.locker_number,
            rowNumber: it.source_row_number,
            observations: obs,
            updateYear: yr,
          });
        }
      }

      // También desde sourceRows si este trabajador apareció en otras filas
      if (workerEmpNo) {
        const matchingSourceRows = sourceRowsByEmpNo.get(workerEmpNo) || [];
        for (const sr of matchingSourceRows) {
          if (sr.batch_id && group.batchId && sr.batch_id !== group.batchId) continue;
          if (sr.locker_normalized && !candidateLockersMap.has(sr.locker_normalized)) {
            const yr = extractUpdateYear(sr.observations_raw, sr.supplementary_data);
            candidateLockersMap.set(sr.locker_normalized, {
              lockerNumber: sr.locker_normalized,
              rowNumber: sr.row_number,
              observations: sr.observations_raw,
              updateYear: yr,
            });
          }
        }
      }

      const candidates: ReconciliationCandidate[] = [];
      for (const cand of candidateLockersMap.values()) {
        const lRecord = lockerByNumber.get(cand.lockerNumber);
        const lActiveAsg = lRecord ? activeAsgByLockerId.get(lRecord.id) : undefined;
        const isCurrent = Boolean(activeLocker && activeLocker.locker_number === cand.lockerNumber);

        let currentStatus = "Disponible";
        let hasConflict = false;
        let hasOtherWorker = false;
        let otherWorkerName: string | null = null;
        let asgSource: "import" | "manual" | "reservation" | "legacy" | null = null;

        if (lRecord?.condition && lRecord.condition !== "ok") {
          currentStatus = `Condición: ${lRecord.condition}`;
          hasConflict = true;
        } else if (isCurrent) {
          currentStatus = "Asignado actualmente a esta persona";
          asgSource = lActiveAsg?.source === "manual" ? "manual" : "import";
        } else if (lActiveAsg) {
          const otherW = workerById.get(lActiveAsg.worker_id);
          const otherWName = otherW
            ? `${otherW.paternal_surname} ${otherW.first_name}`.trim()
            : "";
          otherWorkerName = otherWName || (otherW?.employee_number ? `Matrícula ${otherW.employee_number}` : "otro trabajador");
          currentStatus = `Asignado actualmente a ${otherWorkerName}`;
          hasConflict = true;
          hasOtherWorker = true;
          asgSource = lActiveAsg.source === "manual" ? "manual" : "import";
        }

        candidates.push({
          candidateId: lRecord?.id || cand.lockerNumber,
          label: `Casillero ${cand.lockerNumber}`,
          sublabel: cand.rowNumber ? `Fila ${cand.rowNumber}` : "",
          rowNumber: cand.rowNumber,
          observations: cand.observations,
          updateYear: cand.updateYear,
          currentStatus,
          hasConflict,
          isCurrentAssignment: isCurrent,
          isRecommended: false,
          assignmentSource: asgSource,
          hasOtherActiveWorker: hasOtherWorker,
          otherActiveWorkerName: otherWorkerName,
        });
      }

      // Ordenar candidatos por número natural de casillero
      candidates.sort((a, b) => naturalCompare(a.label, b.label));

      // Asesor determinista
      const advisor = adviseReconciliationCase({
        caseType: "WORKER_MULTIPLE_LOCKERS",
        targetWorkerName: workerName,
        targetEmployeeNumber: workerEmpNo,
        workerCurrentLockerNumber: activeLocker?.locker_number ?? null,
        candidates,
      });

      // Marcar candidato recomendado
      if (advisor.recommendation?.recommendedCandidateId) {
        for (const c of candidates) {
          if (c.candidateId === advisor.recommendation.recommendedCandidateId) {
            c.isRecommended = true;
          }
        }
      }

      builtCases.push({
        caseId,
        type,
        title: workerName,
        subtitle: workerEmpNo ? `Matrícula ${workerEmpNo}` : "Sin matrícula",
        reviewItemIds,
        sourceRowNumbers,
        worker: {
          id: workerRecord?.id,
          employeeNumber: workerEmpNo,
          name: workerName,
          currentLockerNumber: activeLocker?.locker_number ?? null,
          currentLockerStatus: activeLocker ? "assigned" : "available",
          category: workerRecord?.category,
          turn: workerRecord?.turn,
          assignment: workerRecord?.assignment || workerRecord?.adscripcion || null,
          adscripcion: workerRecord?.assignment || workerRecord?.adscripcion || null,
        },
        candidates,
        currentDatabaseState: {
          workerActiveLockerNumber: activeLocker?.locker_number ?? null,
          assignmentSource: activeAsg?.source ?? null,
          assignedAt: activeAsg?.assigned_at ?? null,
        },
        evidence: candidates
          .filter((c) => c.updateYear)
          .map((c) => ({
            type: "temporal",
            label: c.label,
            detail: `Actualizado en ${c.updateYear}`,
            year: c.updateYear,
          })),
        recommendation: advisor.recommendation,
        confidence: advisor.confidence,
        explanation: advisor.explanation,
        consequences: advisor.consequences,
      });
    } else if (type === "LOCKER_MULTIPLE_WORKERS") {
      const lockerNum = lockerNumber || groupItems[0].locker_number;
      const lRecord = lockerByNumber.get(lockerNum);
      const lActiveAsg = lRecord ? activeAsgByLockerId.get(lRecord.id) : undefined;
      const currentWorker = lActiveAsg ? workerById.get(lActiveAsg.worker_id) : undefined;
      const currentWorkerFullName = currentWorker
        ? `${currentWorker.paternal_surname} ${currentWorker.maternal_surname ?? ""} ${currentWorker.first_name}`.trim()
        : null;

      // Recolectar personas candidatas para este casillero
      const candidateWorkersMap = new Map<string, {
        employeeNumber: string;
        workerName: string;
        rowNumber: number | null;
        observations: string | null;
        updateYear: number | null;
      }>();

      for (const it of groupItems) {
        const emp = it.source_employee_number || it.source_worker_name || it.id;
        const sr = getSourceRow(it.source_batch_id, it.source_row_number);
        const obs = sr?.observations_raw || it.source_notes || null;
        const yr = extractUpdateYear(obs, sr?.supplementary_data);

        candidateWorkersMap.set(emp, {
          employeeNumber: it.source_employee_number || "",
          workerName: it.source_worker_name || "Sin nombre",
          rowNumber: it.source_row_number,
          observations: obs,
          updateYear: yr,
        });
      }

      // También desde sourceRows por casillero
      const matchingSourceRows = sourceRowsByLocker.get(lockerNum) || [];
      for (const sr of matchingSourceRows) {
        if (sr.batch_id && group.batchId && sr.batch_id !== group.batchId) continue;
        const emp = sr.matricula_normalized || sr.worker_name_raw || "";
        if (emp && !candidateWorkersMap.has(emp)) {
          const yr = extractUpdateYear(sr.observations_raw, sr.supplementary_data);
          candidateWorkersMap.set(emp, {
            employeeNumber: sr.matricula_normalized || "",
            workerName: sr.worker_name_raw || "Sin nombre",
            rowNumber: sr.row_number,
            observations: sr.observations_raw,
            updateYear: yr,
          });
        }
      }

      const candidates: ReconciliationCandidate[] = [];
      for (const cand of candidateWorkersMap.values()) {
        const wRecord = cand.employeeNumber ? workerByEmpNo.get(cand.employeeNumber) : undefined;
        const wActiveAsg = wRecord ? activeAsgByWorkerId.get(wRecord.id) : undefined;
        const wActiveLocker = wActiveAsg ? lockerById.get(wActiveAsg.locker_id) : undefined;
        const isCurrent = Boolean(currentWorker && currentWorker.employee_number === cand.employeeNumber);

        let currentStatus = "Sin otro casillero";
        let hasConflict = false;
        let hasOtherLocker = false;
        let otherLockerNum: string | null = null;

        if (isCurrent) {
          currentStatus = `Asignación activa actual de este casillero`;
        } else if (wActiveLocker) {
          otherLockerNum = wActiveLocker.locker_number;
          currentStatus = `Actualmente tiene Casillero ${otherLockerNum}`;
          hasConflict = true;
          hasOtherLocker = true;
        }

        const wFullName = wRecord
          ? `${wRecord.paternal_surname} ${wRecord.maternal_surname ?? ""} ${wRecord.first_name}`.trim()
          : "";
        const fullName =
          wFullName ||
          cand.workerName ||
          (cand.employeeNumber ? `Matrícula ${cand.employeeNumber}` : "Trabajador no especificado");

        candidates.push({
          candidateId: wRecord?.id || cand.employeeNumber || cand.workerName,
          label: fullName,
          sublabel: cand.employeeNumber
            ? `Matrícula ${cand.employeeNumber}${cand.rowNumber ? ` · Fila ${cand.rowNumber}` : ""}`
            : cand.rowNumber
            ? `Fila ${cand.rowNumber}`
            : "",
          rowNumber: cand.rowNumber,
          observations: cand.observations,
          updateYear: cand.updateYear,
          currentStatus,
          hasConflict,
          isCurrentAssignment: isCurrent,
          isRecommended: false,
          assignmentSource: isCurrent ? (lActiveAsg?.source === "manual" ? "manual" : "import") : null,
          hasOtherActiveLocker: hasOtherLocker,
          otherActiveLockerNumber: otherLockerNum,
        });
      }

      // Asesor determinista
      const advisor = adviseReconciliationCase({
        caseType: "LOCKER_MULTIPLE_WORKERS",
        targetLockerNumber: lockerNum,
        lockerCurrentWorkerName: currentWorkerFullName,
        candidates,
      });

      if (advisor.recommendation?.recommendedCandidateId) {
        for (const c of candidates) {
          if (c.candidateId === advisor.recommendation.recommendedCandidateId) {
            c.isRecommended = true;
          }
        }
      }

      builtCases.push({
        caseId,
        type,
        title: `Casillero ${lockerNum}`,
        subtitle: `${candidates.length} personas relacionadas en el archivo`,
        reviewItemIds,
        sourceRowNumbers,
        locker: {
          id: lRecord?.id,
          lockerNumber: lockerNum,
          condition: lRecord?.condition ?? "ok",
          currentWorkerId: currentWorker?.id,
          currentWorkerName: currentWorkerFullName,
          currentWorkerEmployeeNumber: currentWorker?.employee_number,
          currentAssignmentSource: lActiveAsg?.source ?? null,
        },
        candidates,
        currentDatabaseState: {
          assignedWorkerId: currentWorker?.id,
          assignedWorkerName: currentWorkerFullName,
          assignedWorkerEmployeeNumber: currentWorker?.employee_number,
          assignmentSource: lActiveAsg?.source ?? null,
          assignedAt: lActiveAsg?.assigned_at ?? null,
          lockerCondition: lRecord?.condition ?? "ok",
        },
        evidence: candidates
          .filter((c) => c.updateYear)
          .map((c) => ({
            type: "temporal",
            label: c.label,
            detail: `Actualizado en ${c.updateYear}`,
            year: c.updateYear,
          })),
        recommendation: advisor.recommendation,
        confidence: advisor.confidence,
        explanation: advisor.explanation,
        consequences: advisor.consequences,
      });
    } else if (type === "WORKER_NOT_FOUND") {
      const it = groupItems[0];
      const emp = it.source_employee_number;
      const rawName = it.source_worker_name || "Sin nombre";
      const sr = getSourceRow(it.source_batch_id, it.source_row_number);
      const lRecord = it.locker_number ? lockerByNumber.get(it.locker_number) : undefined;
      const lActiveAsg = lRecord ? activeAsgByLockerId.get(lRecord.id) : undefined;

      // Buscar candidato exacto en union_workers si se dio de alta posteriormente
      const exactWorker = emp ? workerByEmpNo.get(emp) : undefined;
      const candidates: ReconciliationCandidate[] = [];

      if (exactWorker) {
        const wActiveAsg = activeAsgByWorkerId.get(exactWorker.id);
        const wActiveLocker = wActiveAsg ? lockerById.get(wActiveAsg.locker_id) : undefined;
        const wFullName = `${exactWorker.paternal_surname} ${exactWorker.maternal_surname ?? ""} ${exactWorker.first_name}`.trim();

        candidates.push({
          candidateId: exactWorker.id,
          label: wFullName,
          sublabel: `Matrícula ${exactWorker.employee_number} (Coincidencia exacta)`,
          rowNumber: it.source_row_number,
          observations: sr?.observations_raw || it.source_notes,
          updateYear: extractUpdateYear(sr?.observations_raw, sr?.supplementary_data),
          currentStatus: wActiveLocker ? `Tiene Casillero ${wActiveLocker.locker_number}` : "Sin casillero asignado",
          hasConflict: Boolean(wActiveLocker),
          isCurrentAssignment: false,
          isRecommended: true,
          assignmentSource: null,
          hasOtherActiveLocker: Boolean(wActiveLocker),
          otherActiveLockerNumber: wActiveLocker?.locker_number,
        });
      }

      const advisor = adviseReconciliationCase({
        caseType: "WORKER_NOT_FOUND",
        targetEmployeeNumber: emp ?? undefined,
        targetWorkerName: rawName,
        targetLockerNumber: it.locker_number,
        candidates,
      });

      builtCases.push({
        caseId,
        type,
        title: rawName,
        subtitle: `Casillero ${it.locker_number}${emp ? ` · Matrícula ${emp}` : ""}`,
        reviewItemIds,
        sourceRowNumbers,
        worker: {
          employeeNumber: emp || "",
          name: rawName,
          category: sr?.category_raw || exactWorker?.category || null,
          turn: sr?.turn_raw || null,
          plaza: sr?.plaza_raw || null,
          schedule: sr?.schedule_raw || null,
          assignment: exactWorker?.assignment || exactWorker?.adscripcion || null,
          adscripcion: exactWorker?.assignment || exactWorker?.adscripcion || null,
        },
        locker: {
          id: lRecord?.id,
          lockerNumber: it.locker_number,
          condition: lRecord?.condition ?? "ok",
        },
        candidates,
        currentDatabaseState: {
          lockerCondition: lRecord?.condition ?? "ok",
          assignmentSource: lActiveAsg?.source ?? null,
        },
        evidence: [
          {
            type: "identity",
            label: "Datos del archivo",
            detail: `Nombre: ${rawName}, Matrícula: ${emp || "N/A"}`,
          },
        ],
        recommendation: advisor.recommendation,
        confidence: advisor.confidence,
        explanation: advisor.explanation,
        consequences: advisor.consequences,
      });
    } else {
      const it = groupItems[0];
      builtCases.push({
        caseId,
        type: "OTHER",
        title: `Casillero ${it.locker_number}`,
        subtitle: it.source_worker_name || "Revisión general",
        reviewItemIds,
        sourceRowNumbers,
        candidates: [],
        currentDatabaseState: {},
        evidence: [],
        recommendation: null,
        confidence: "none",
        explanation: it.source_notes || "Requiere confirmación manual del administrador.",
        consequences: [],
      });
    }
  }

  // 3. Resumen de Coincidencias Seguras (Safe Matches)
  const safeMatches: SafeMatchItem[] = [];
  let requiresLockerReview = 0;
  let clashesWithManual = 0;
  let blockedOrMaintenance = 0;
  let alreadyHasLocker = 0;
  let totalFound = 0;

  for (const it of items) {
    if (it.reason === "WORKER_NOT_FOUND" && it.source_employee_number) {
      const w = workerByEmpNo.get(it.source_employee_number);
      if (w) {
        totalFound++;
        const l = lockerByNumber.get(it.locker_number);
        const lActiveAsg = l ? activeAsgByLockerId.get(l.id) : undefined;
        const wActiveAsg = activeAsgByWorkerId.get(w.id);

        if (l?.condition && l.condition !== "ok") {
          blockedOrMaintenance++;
        } else if (lActiveAsg?.source === "manual" || lActiveAsg?.admin_override) {
          clashesWithManual++;
        } else if (lActiveAsg) {
          requiresLockerReview++;
        } else if (wActiveAsg) {
          alreadyHasLocker++;
        } else if (l) {
          const wName = `${w.paternal_surname} ${w.maternal_surname ?? ""} ${w.first_name}`.trim();
          safeMatches.push({
            reviewItemId: it.id,
            workerId: w.id,
            lockerId: l.id,
            workerName: wName,
            employeeNumber: w.employee_number,
            lockerNumber: l.locker_number,
          });
        }
      }
    }
  }

  const safeMatchesSummary: SafeMatchesSummary = {
    totalFound,
    safeMatches,
    requiresLockerReview,
    clashesWithManual,
    blockedOrMaintenance,
    alreadyHasLocker,
  };

  // 4. Filtrar por término de búsqueda (search)
  let filteredCases = builtCases;
  if (search.trim()) {
    const qNorm = normalizeStr(search);
    filteredCases = builtCases.filter((c) => {
      if (normalizeStr(c.title).includes(qNorm)) return true;
      if (normalizeStr(c.subtitle).includes(qNorm)) return true;
      if (c.worker?.employeeNumber && normalizeStr(c.worker.employeeNumber).includes(qNorm)) return true;
      if (c.locker?.lockerNumber && normalizeStr(c.locker.lockerNumber).includes(qNorm)) return true;
      for (const cand of c.candidates) {
        if (normalizeStr(cand.label).includes(qNorm)) return true;
        if (normalizeStr(cand.sublabel).includes(qNorm)) return true;
      }
      return false;
    });
  }

  // Conteos de casos
  const caseCounts = {
    total: builtCases.length,
    workerNotFound: builtCases.filter((c) => c.type === "WORKER_NOT_FOUND").length,
    multipleWorkers: builtCases.filter((c) => c.type === "LOCKER_MULTIPLE_WORKERS").length,
    multipleLockers: builtCases.filter((c) => c.type === "WORKER_MULTIPLE_LOCKERS").length,
    other: builtCases.filter((c) => c.type === "OTHER").length,
  };

  // 5. Ordenamiento
  filteredCases.sort((a, b) => {
    if (sort === "rec_high" || sort === "easy") {
      const confScore = (conf: string) => (conf === "high" ? 3 : conf === "medium" ? 2 : conf === "low" ? 1 : 0);
      const diff = confScore(b.confidence) - confScore(a.confidence);
      if (diff !== 0) return diff;
      return naturalCompare(a.title, b.title);
    }
    if (sort === "rec_med") {
      const isMedA = a.confidence === "medium" ? 1 : 0;
      const isMedB = b.confidence === "medium" ? 1 : 0;
      if (isMedB !== isMedA) return isMedB - isMedA;
      return naturalCompare(a.title, b.title);
    }
    if (sort === "rec_none") {
      const isNoneA = a.confidence === "none" ? 1 : 0;
      const isNoneB = b.confidence === "none" ? 1 : 0;
      if (isNoneB !== isNoneA) return isNoneB - isNoneA;
      return naturalCompare(a.title, b.title);
    }
    if (sort === "name") {
      return naturalCompare(a.title, b.title);
    }
    if (sort === "locker_asc") {
      const lA = a.locker?.lockerNumber || a.candidates[0]?.label || "";
      const lB = b.locker?.lockerNumber || b.candidates[0]?.label || "";
      return naturalCompare(lA, lB);
    }
    return 0;
  });

  const totalCases = filteredCases.length;
  const startIndex = (page - 1) * pageSize;
  const pagedCases = filteredCases.slice(startIndex, startIndex + pageSize);

  return {
    cases: pagedCases,
    totalCases,
    totalReviewItems: items.length,
    caseCounts,
    itemCounts,
    safeMatchesSummary,
  };
}

/**
 * Comparador natural para cadenas numéricas (ej. "Locker 2" antes de "Locker 10")
 */
function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}
