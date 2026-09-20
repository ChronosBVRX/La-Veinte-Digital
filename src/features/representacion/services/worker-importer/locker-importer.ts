import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";
import { validateExcelSecurity } from "./excel-security";
import {
  normalizeMatricula,
  normalizeLockerNumber,
  extractSourceUpdateYear,
} from "./row-parser";
import type {
  ImportSummary,
  PreviewRow,
  ImportPreviewResult,
  ImportConfirmResult,
  ImportRollbackResult,
  RowIssue,
  RowStatus,
  LockerConflictReasonCode,
} from "./types";
import { writeAuditLog } from "../audit";

function extractCellValue(val: ExcelJS.CellValue): string {
  if (val === null || val === undefined) return "";
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  if (typeof val === "object") {
    if ("result" in val && val.result !== undefined && val.result !== null) {
      return String(val.result).trim();
    }
    if ("richText" in val && Array.isArray(val.richText)) {
      return val.richText.map((t) => t.text).join("").trim();
    }
    if ("text" in val && typeof val.text === "string") {
      return val.text.trim();
    }
  }
  return String(val).trim();
}

function getColLetter(colNumber: number): string {
  let temp = "";
  let num = colNumber;
  while (num > 0) {
    const rem = (num - 1) % 26;
    temp = String.fromCharCode(65 + rem) + temp;
    num = Math.floor((num - 1) / 26);
  }
  return temp;
}

const CHUNK_SIZE = 200;

export async function parseAndPreviewLockerImport(params: {
  fileBuffer: Buffer;
  fileName: string;
  delegationId: string;
  userId: string;
}): Promise<ImportPreviewResult> {
  const { fileBuffer, fileName, delegationId, userId } = params;

  // 1. Validar seguridad del archivo (.xlsx, macros, fórmulas ejecutables, zip bomb)
  const security = validateExcelSecurity(fileBuffer, fileName);
  if (!security.valid) {
    throw new Error(security.error ?? "Archivo no permitido.");
  }

  // 2. Cargar Excel con ExcelJS y validar estrictamente Hoja1
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileBuffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);

  const worksheet = workbook.getWorksheet("Hoja1");
  if (!worksheet) {
    throw new Error('El archivo no contiene la hoja requerida "Hoja1". Hoja1 debe ser la única fuente a procesar.');
  }

  if (worksheet.rowCount < 2) {
    throw new Error('La hoja "Hoja1" no contiene filas de datos o está vacía.');
  }

  if (worksheet.rowCount > 25000) {
    throw new Error(`El archivo contiene ${worksheet.rowCount} filas, superando el límite permitido de 25,000.`);
  }

  // 3. Extraer y mapear columnas canónicas y complementarias
  const headerRow = worksheet.getRow(1);
  let matriculaCol = 1;
  let nombreCol = 2;
  let plazaCol = 3;
  let turnoCol = 4;
  let categoriaCol = 5;
  let horarioCol = 6;
  let lockerCol = 9;

  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    const raw = extractCellValue(cell.value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (raw.includes("matricula") || raw.includes("empleado")) matriculaCol = colNumber;
    else if (raw.includes("nombre") || raw.includes("trabajador")) nombreCol = colNumber;
    else if (raw.includes("plaza")) plazaCol = colNumber;
    else if (raw.includes("turno")) turnoCol = colNumber;
    else if (raw.includes("categoria") || raw.includes("puesto")) categoriaCol = colNumber;
    else if (raw.includes("horario")) horarioCol = colNumber;
    else if (raw.includes("locker") || raw.includes("casillero")) lockerCol = colNumber;
  });

  // 4. Extraer filas preservando todas las celdas crudas (raw_cells)
  interface RawLockerRow {
    rowNumber: number;
    rawCells: Record<string, string>;
    rawMatricula: string;
    normalizedMatricula: string;
    rawNombre: string;
    rawPlaza: string;
    rawTurno: string;
    rawCategoria: string;
    rawHorario: string;
    rawLocker: string;
    normalizedLocker: string;
    isPhysicalLocker: boolean;
    isSemanticLocker: boolean;
    observations: string;
    colG: string;
    colH: string;
    colJ: string;
    colK: string;
    colL: string;
    colM: string;
    sourceUpdateYear: number | null;
    supplementaryData: Record<string, unknown>;
  }

  const rawRows: RawLockerRow[] = [];
  for (let r = 2; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    const rawCells: Record<string, string> = {};
    let hasAny = false;

    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const v = extractCellValue(cell.value);
      if (v) {
        rawCells[getColLetter(colNumber)] = v;
        hasAny = true;
      }
    });

    if (!hasAny) {
      continue; // Fila vacía
    }

    const rawMatricula = matriculaCol > 0 ? extractCellValue(row.getCell(matriculaCol).value) : "";
    const rawNombre = nombreCol > 0 ? extractCellValue(row.getCell(nombreCol).value) : "";
    const rawPlaza = plazaCol > 0 ? extractCellValue(row.getCell(plazaCol).value) : "";
    const rawTurno = turnoCol > 0 ? extractCellValue(row.getCell(turnoCol).value) : "";
    const rawCategoria = categoriaCol > 0 ? extractCellValue(row.getCell(categoriaCol).value) : "";
    const rawHorario = horarioCol > 0 ? extractCellValue(row.getCell(horarioCol).value) : "";
    const rawLocker = lockerCol > 0 ? extractCellValue(row.getCell(lockerCol).value) : "";

    const rawColG = extractCellValue(row.getCell(7).value);
    const rawColH = extractCellValue(row.getCell(8).value);
    const rawColJ = extractCellValue(row.getCell(10).value);
    const rawColK = extractCellValue(row.getCell(11).value);
    const rawColL = extractCellValue(row.getCell(12).value);
    const rawColM = extractCellValue(row.getCell(13).value);

    const normMat = normalizeMatricula(rawMatricula);
    const { normalized: normLocker, isPhysical, isSemantic } = normalizeLockerNumber(rawLocker);
    const yearJ = extractSourceUpdateYear(rawColJ);

    const supplementaryData: Record<string, unknown> = {
      col_G: rawColG || null,
      col_H: rawColH || null,
      col_J: rawColJ || null,
      col_K: rawColK || null,
      col_L: rawColL || null,
      col_M: rawColM || null,
      source_update_year: yearJ,
    };

    rawRows.push({
      rowNumber: r,
      rawCells,
      rawMatricula,
      normalizedMatricula: normMat,
      rawNombre,
      rawPlaza,
      rawTurno,
      rawCategoria,
      rawHorario,
      rawLocker,
      normalizedLocker: normLocker,
      isPhysicalLocker: isPhysical,
      isSemanticLocker: isSemantic,
      observations: rawColJ,
      colG: rawColG,
      colH: rawColH,
      colJ: rawColJ,
      colK: rawColK,
      colL: rawColL,
      colM: rawColM,
      sourceUpdateYear: yearJ,
      supplementaryData,
    });
  }

  if (rawRows.length === 0) {
    throw new Error('No se encontraron registros de datos en la hoja "Hoja1".');
  }

  // 5. Consultar SOLO LECTURA el padrón de trabajadores, lockers y asignaciones activas
  const supabase = await createClient();

  const [workersRes, lockersRes, assignmentsRes] = await Promise.all([
    supabase
      .from("union_workers")
      .select("id, employee_number, first_name, paternal_surname, maternal_surname, category, assignment")
      .eq("delegation_id", delegationId),
    supabase
      .from("union_lockers")
      .select("id, locker_number, status")
      .eq("delegation_id", delegationId),
    supabase
      .from("union_locker_assignments")
      .select("id, locker_id, worker_id, status")
      .eq("status", "active"),
  ]);

  if (workersRes.error) {
    throw new Error(`Error al consultar padrón de trabajadores: ${workersRes.error.message}`);
  }

  const dbWorkers = workersRes.data ?? [];
  const dbLockers = lockersRes.data ?? [];
  const dbAssignments = assignmentsRes.data ?? [];

  const workerByEmpNumber = new Map<string, (typeof dbWorkers)[0]>();
  for (const w of dbWorkers) {
    workerByEmpNumber.set(w.employee_number, w);
  }

  const lockerById = new Map(dbLockers.map((l) => [l.id, l]));
  const lockerByNumber = new Map(dbLockers.map((l) => [l.locker_number, l]));

  const activeAssignmentByWorkerId = new Map<string, { id: string; lockerId: string; lockerNumber: string }>();
  const activeAssignmentByLockerId = new Map<string, { id: string; workerId: string }>();

  for (const asgn of dbAssignments) {
    const locker = lockerById.get(asgn.locker_id);
    if (locker) {
      activeAssignmentByWorkerId.set(asgn.worker_id, {
        id: asgn.id,
        lockerId: locker.id,
        lockerNumber: locker.locker_number,
      });
      activeAssignmentByLockerId.set(locker.id, {
        id: asgn.id,
        workerId: asgn.worker_id,
      });
    }
  }

  // 6. Indexar ocurrencias en el archivo por casillero y por matrícula
  const rowsByLocker = new Map<string, RawLockerRow[]>();
  const rowsByMatricula = new Map<string, RawLockerRow[]>();
  const uniquePhysicalLockers = new Set<string>();
  const uniqueMatriculasWithLocker = new Set<string>();

  for (const row of rawRows) {
    if (row.isPhysicalLocker && row.normalizedLocker) {
      uniquePhysicalLockers.add(row.normalizedLocker);
      const list = rowsByLocker.get(row.normalizedLocker) ?? [];
      list.push(row);
      rowsByLocker.set(row.normalizedLocker, list);
    }
    if (row.normalizedMatricula) {
      const list = rowsByMatricula.get(row.normalizedMatricula) ?? [];
      list.push(row);
      rowsByMatricula.set(row.normalizedMatricula, list);
      if (row.isPhysicalLocker) {
        uniqueMatriculasWithLocker.add(row.normalizedMatricula);
      }
    }
  }

  // 7. Análisis multi-pase y clasificación exhaustiva de cada fila
  interface LockerAnalyzedRow {
    rowNumber: number;
    rawCells: Record<string, string>;
    rawMatricula: string;
    matricula: string;
    rawNombre: string;
    fullName: string;
    rawPlaza: string;
    rawTurno: string;
    rawCategoria: string;
    rawHorario: string;
    category?: string;
    department?: string;
    lockerCurrent?: string;
    rawLocker: string;
    lockerExcel: string;
    isSemantic: boolean;
    observations: string;
    supplementaryData: Record<string, unknown>;
    status: RowStatus;
    classification: string;
    conflictReasonCode?: LockerConflictReasonCode;
    autoResolvable?: boolean;
    duplicateOfRow?: number;
    issues: RowIssue[];
    diff?: Record<string, unknown>;
    targetWorkerId: string | null;
  }

  const analyzedRows: LockerAnalyzedRow[] = [];
  const conflictBreakdown: Record<LockerConflictReasonCode, number> = {
    WORKER_NOT_FOUND: 0,
    WORKER_NOT_FOUND_CREATED_FROM_SOURCE: 0,
    DUPLICATE_LOCKER_SAME_WORKER: 0,
    DUPLICATE_LOCKER_DIFFERENT_WORKERS: 0,
    WORKER_MULTIPLE_LOCKERS: 0,
    LOCKER_ASSIGNED_TO_OTHER_WORKER: 0,
    DUPLICATE_IDENTICAL_ROW: 0,
    INVALID_LOCKER: 0,
    ROW_WITHOUT_LOCKER: 0,
    INVALID_EMPLOYEE_NUMBER: 0,
    SEMANTIC_LOCKER: 0,
    LOCKER_WITHOUT_WORKER: 0,
    HISTORICAL_SUPERSEDED: 0,
    AMBIGUOUS_HISTORY: 0,
    DUPLICATE_PHYSICAL_NUMBER: 0,
    OTHER: 0,
  };

  let newLockerAssignments = 0;
  let lockerChanges = 0;
  let unchangedLockers = 0;
  let duplicateLockersCount = 0;
  let ignoredRowsCount = 0;
  let workersMatchedInRoster = 0;
  let newWorkersFromExcel = 0;
  let lockersWithoutWorkerCount = 0;
  let historicalSupersededCount = 0;
  let semanticLockersCount = 0;
  let rowsWithoutLockerCount = 0;
  let duplicateRowsCount = 0;

  for (const r of rawRows) {
    const issues: RowIssue[] = [];
    let status: RowStatus = "unchanged";
    let classification = "";
    let targetWorkerId: string | null = null;
    let workerFullName = r.rawNombre;
    let category: string | undefined = r.rawCategoria;
    let department: string | undefined = undefined;
    let currentLocker: string | undefined;
    let conflictReasonCode: LockerConflictReasonCode | undefined;
    let autoResolvable: boolean | undefined;
    let duplicateOfRow: number | undefined;

    // Caso 1: Fila sin valor en columna de casillero
    if (!r.rawLocker) {
      status = "ignored";
      classification = "ROW_WITHOUT_LOCKER";
      conflictReasonCode = "ROW_WITHOUT_LOCKER";
      conflictBreakdown.ROW_WITHOUT_LOCKER++;
      autoResolvable = false;
      rowsWithoutLockerCount++;
      ignoredRowsCount++;
      issues.push({
        code: "ROW_WITHOUT_LOCKER",
        message: "Fila con datos laborales pero sin casillero en Columna # LOCKER.",
        severity: "warning",
      });
    }
    // Caso 2: Casillero semántico no físico (S/N, etc.)
    else if (r.isSemanticLocker) {
      status = "ignored";
      classification = "SEMANTIC_LOCKER";
      conflictReasonCode = "SEMANTIC_LOCKER";
      conflictBreakdown.SEMANTIC_LOCKER++;
      autoResolvable = false;
      semanticLockersCount++;
      ignoredRowsCount++;
      issues.push({
        code: "SEMANTIC_LOCKER",
        message: `Casillero semántico no físico: "${r.rawLocker}". Preservado sin inventariar.`,
        severity: "warning",
      });
    }
    // Caso 3: Casillero físico válido pero sin matrícula (LOCKER_WITHOUT_WORKER)
    else if (r.isPhysicalLocker && !r.normalizedMatricula) {
      const dbLocker = lockerByNumber.get(r.normalizedLocker);
      status = dbLocker ? "unchanged" : "new";
      classification = "LOCKER_WITHOUT_WORKER";
      conflictReasonCode = "LOCKER_WITHOUT_WORKER";
      conflictBreakdown.LOCKER_WITHOUT_WORKER++;
      autoResolvable = true;
      lockersWithoutWorkerCount++;
      issues.push({
        code: "LOCKER_WITHOUT_WORKER",
        message: "Casillero físico sin trabajador asociado. Quedará disponible en inventario.",
        severity: "warning",
      });
    }
    // Caso 4: Casillero físico con matrícula válida
    else {
      const matRows = rowsByMatricula.get(r.normalizedMatricula) ?? [];
      const lockRows = rowsByLocker.get(r.normalizedLocker) ?? [];

      // Subcaso 4A: Fila idéntica duplicada para la misma matrícula y casillero
      const identicalRows = matRows.filter((x) => x.normalizedLocker === r.normalizedLocker);
      if (identicalRows.length > 1 && identicalRows[0].rowNumber !== r.rowNumber) {
        status = "conflict";
        classification = "DUPLICATE_ROW";
        conflictReasonCode = "DUPLICATE_IDENTICAL_ROW";
        conflictBreakdown.DUPLICATE_IDENTICAL_ROW++;
        autoResolvable = true;
        duplicateOfRow = identicalRows[0].rowNumber;
        duplicateRowsCount++;
        issues.push({
          code: "DUPLICATE_IDENTICAL_ROW",
          message: `Fila duplicada para la misma matrícula y casillero (duplicado de fila #${identicalRows[0].rowNumber}). Se resolverá como una sola asignación.`,
          severity: "warning",
        });
      } else {
        // Subcaso 4B: Mismo trabajador asociado a diferentes casilleros en el archivo
        const physMatRows = matRows.filter((x) => x.isPhysicalLocker);
        const distinctLockersForMat = new Set(physMatRows.map((x) => x.normalizedLocker));

        if (distinctLockersForMat.size > 1) {
          const years = physMatRows
            .map((x) => x.sourceUpdateYear)
            .filter((y): y is number => y !== null);
          const maxYear = years.length > 0 ? Math.max(...years) : null;

          if (maxYear !== null && r.sourceUpdateYear !== null && r.sourceUpdateYear < maxYear) {
            status = "ignored";
            classification = "HISTORICAL_SUPERSEDED";
            conflictReasonCode = "HISTORICAL_SUPERSEDED";
            conflictBreakdown.HISTORICAL_SUPERSEDED++;
            autoResolvable = true;
            historicalSupersededCount++;
            issues.push({
              code: "HISTORICAL_SUPERSEDED",
              message: `Registro histórico de casillero ${r.normalizedLocker} (${r.sourceUpdateYear}) superado por actualización más reciente del trabajador (${maxYear}).`,
              severity: "warning",
            });
          } else {
            const rowsWithMax = physMatRows.filter((x) => x.sourceUpdateYear === maxYear);
            if (rowsWithMax.length > 1 || maxYear === null) {
              status = "conflict";
              classification = "REAL_CONFLICT";
              conflictReasonCode = "WORKER_MULTIPLE_LOCKERS";
              conflictBreakdown.WORKER_MULTIPLE_LOCKERS++;
              autoResolvable = false;
              issues.push({
                code: "WORKER_MULTIPLE_LOCKERS",
                message: `El trabajador ${r.normalizedMatricula} aparece asociado a múltiples casilleros sin resolución temporal única (${Array.from(distinctLockersForMat).join(", ")}). Requiere decisión manual.`,
                severity: "error",
              });
            }
          }
        }

        // Subcaso 4C: Múltiples trabajadores reclamando el mismo casillero en el archivo
        if (!classification) {
          const distinctMatsForLock = new Set(
            lockRows.map((x) => x.normalizedMatricula).filter(Boolean)
          );
          if (distinctMatsForLock.size > 1) {
            const years = lockRows
              .map((x) => x.sourceUpdateYear)
              .filter((y): y is number => y !== null);
            const maxYear = years.length > 0 ? Math.max(...years) : null;

            if (maxYear !== null && r.sourceUpdateYear !== null && r.sourceUpdateYear < maxYear) {
              status = "ignored";
              classification = "HISTORICAL_SUPERSEDED";
              conflictReasonCode = "HISTORICAL_SUPERSEDED";
              conflictBreakdown.HISTORICAL_SUPERSEDED++;
              autoResolvable = true;
              historicalSupersededCount++;
              issues.push({
                code: "HISTORICAL_SUPERSEDED",
                message: `Registro histórico para casillero ${r.normalizedLocker} (${r.sourceUpdateYear}) superado por asignación más reciente (${maxYear}).`,
                severity: "warning",
              });
            } else {
              const rowsWithMax = lockRows.filter((x) => x.sourceUpdateYear === maxYear);
              if (rowsWithMax.length > 1 || maxYear === null) {
                status = "conflict";
                classification = "REAL_CONFLICT";
                conflictReasonCode = "DUPLICATE_LOCKER_DIFFERENT_WORKERS";
                conflictBreakdown.DUPLICATE_LOCKER_DIFFERENT_WORKERS++;
                autoResolvable = false;
                duplicateLockersCount++;
                issues.push({
                  code: "DUPLICATE_LOCKER_DIFFERENT_WORKERS",
                  message: `El casillero ${r.normalizedLocker} es reclamado por diferentes trabajadores (filas ${lockRows.map((lr) => lr.rowNumber).join(", ")}). Requiere decisión manual.`,
                  severity: "error",
                });
              }
            }
          }
        }

        // Subcaso 4D: Casillero actualmente ocupado por otro trabajador en BD
        if (!classification) {
          const dbLocker = lockerByNumber.get(r.normalizedLocker);
          if (dbLocker) {
            const lockerAsgn = activeAssignmentByLockerId.get(dbLocker.id);
            const existingWorker = workerByEmpNumber.get(r.normalizedMatricula);
            if (lockerAsgn && (!existingWorker || lockerAsgn.workerId !== existingWorker.id)) {
              const otherWorker = dbWorkers.find((w) => w.id === lockerAsgn.workerId);
              status = "conflict";
              classification = "REAL_CONFLICT";
              conflictReasonCode = "LOCKER_ASSIGNED_TO_OTHER_WORKER";
              conflictBreakdown.LOCKER_ASSIGNED_TO_OTHER_WORKER++;
              autoResolvable = false;
              issues.push({
                code: "LOCKER_ASSIGNED_TO_OTHER_WORKER",
                message: `El casillero ${r.normalizedLocker} está asignado en sistema a ${otherWorker ? `${otherWorker.paternal_surname} ${otherWorker.first_name} (${otherWorker.employee_number})` : "otro trabajador"}. Requiere autorización o resolución.`,
                severity: "error",
              });
            }
          }
        }

        // Subcaso 4E: Asignación lista (sin conflicto bloqueante)
        if (!classification) {
          const existingWorker = workerByEmpNumber.get(r.normalizedMatricula);
          if (existingWorker) {
            workersMatchedInRoster++;
            targetWorkerId = existingWorker.id;
            workerFullName = `${existingWorker.paternal_surname} ${existingWorker.maternal_surname ?? ""} ${existingWorker.first_name}`.trim();
            category = existingWorker.category;
            department = existingWorker.assignment;

            const activeAsgn = activeAssignmentByWorkerId.get(existingWorker.id);
            currentLocker = activeAsgn?.lockerNumber;

            if (!currentLocker) {
              status = "new";
              classification = "ASSIGNMENT_NEW";
              newLockerAssignments++;
            } else if (currentLocker !== r.normalizedLocker) {
              status = "updated";
              classification = "ASSIGNMENT_UPDATED";
              lockerChanges++;
            } else {
              status = "unchanged";
              classification = "ASSIGNMENT_UNCHANGED";
              unchangedLockers++;
            }
          } else {
            // Trabajador nuevo creado desde fuente Locker Excel
            newWorkersFromExcel++;
            status = "new";
            classification = "ASSIGNMENT_NEW";
            conflictReasonCode = "WORKER_NOT_FOUND_CREATED_FROM_SOURCE";
            conflictBreakdown.WORKER_NOT_FOUND_CREATED_FROM_SOURCE++;
            autoResolvable = true;
            newLockerAssignments++;
            issues.push({
              code: "WORKER_NOT_FOUND_CREATED_FROM_SOURCE",
              message: "Trabajador no registrado en padrón. Se dará de alta automáticamente con procedencia Locker Excel.",
              severity: "warning",
            });
          }
        }
      }
    }

    analyzedRows.push({
      rowNumber: r.rowNumber,
      rawCells: r.rawCells,
      rawMatricula: r.rawMatricula,
      matricula: r.normalizedMatricula,
      rawNombre: r.rawNombre,
      fullName: workerFullName,
      rawPlaza: r.rawPlaza,
      rawTurno: r.rawTurno,
      rawCategoria: r.rawCategoria,
      rawHorario: r.rawHorario,
      category,
      department,
      lockerCurrent: currentLocker,
      rawLocker: r.rawLocker,
      lockerExcel: r.normalizedLocker,
      isSemantic: r.isSemanticLocker,
      observations: r.observations,
      supplementaryData: r.supplementaryData,
      status,
      classification,
      conflictReasonCode,
      autoResolvable,
      duplicateOfRow,
      issues,
      diff: {
        conflictReasonCode,
        autoResolvable,
        duplicateOfRow,
        classification,
        lockerChange: {
          currentLocker: currentLocker ?? null,
          excelLocker: r.normalizedLocker,
          action: currentLocker && currentLocker !== r.normalizedLocker ? "change_assignment" : "new_assignment",
        },
      },
      targetWorkerId,
    });
  }

  // 8. Reconciliación matemática exacta
  const safeAssignmentsCount = newLockerAssignments + lockerChanges + unchangedLockers;
  const realConflictsCount =
    conflictBreakdown.DUPLICATE_LOCKER_DIFFERENT_WORKERS +
    conflictBreakdown.WORKER_MULTIPLE_LOCKERS +
    conflictBreakdown.LOCKER_ASSIGNED_TO_OTHER_WORKER +
    conflictBreakdown.OTHER;

  const autoResolvableCount =
    conflictBreakdown.DUPLICATE_IDENTICAL_ROW +
    conflictBreakdown.HISTORICAL_SUPERSEDED +
    conflictBreakdown.WORKER_NOT_FOUND_CREATED_FROM_SOURCE +
    lockersWithoutWorkerCount;

  const totalRowsAccounted =
    safeAssignmentsCount +
    lockersWithoutWorkerCount +
    historicalSupersededCount +
    duplicateRowsCount +
    realConflictsCount +
    semanticLockersCount +
    rowsWithoutLockerCount;

  const existingLockersCount = Array.from(uniquePhysicalLockers).filter((l) => lockerByNumber.has(l)).length;
  const newPhysicalLockers = uniquePhysicalLockers.size - existingLockersCount;

  const summary: ImportSummary = {
    totalRows: analyzedRows.length,
    validWorkers: workersMatchedInRoster + newWorkersFromExcel,
    newWorkers: newWorkersFromExcel,
    updatedWorkers: lockerChanges,
    unchangedWorkers: unchangedLockers,
    duplicateMatriculas: conflictBreakdown.WORKER_MULTIPLE_LOCKERS,
    missingMatricula: lockersWithoutWorkerCount,
    lockersDetected: uniquePhysicalLockers.size,
    newLockers: newPhysicalLockers,
    lockerChanges,
    duplicateLockers: duplicateLockersCount,
    conflicts: realConflictsCount,
    ignoredRows: ignoredRowsCount,
    missingInFileCount: 0,
    hasSupplementarySheet: false,
    supplementarySheetRows: 0,
    newCount: newLockerAssignments,
    updatedCount: lockerChanges,
    unchangedCount: unchangedLockers,
    warningsCount: analyzedRows.filter((r) => r.status === "warning" || r.autoResolvable).length,
    invalidCount: 0,
    conflictsCount: realConflictsCount,
    conflictBreakdown,
    autoResolvableCount,
    workerNotFoundCount: newWorkersFromExcel,
    realConflictsCount,
    // V2 Hoja1 Métricas Explícitas
    physicalLockersDetected: rawRows.filter((r) => r.isPhysicalLocker).length,
    uniquePhysicalLockers: uniquePhysicalLockers.size,
    lockersExisting: existingLockersCount,
    workersMatchedInRoster,
    newWorkersFromExcel,
    safeAssignmentsCount,
    lockersWithoutWorkerCount,
    historicalSupersededCount,
    semanticLockersCount,
    rowsWithoutLockerCount,
    totalRowsAccounted,
  };

  // 8b. Verificar si este mismo archivo ya fue importado y confirmado previamente para la misma delegación
  const { data: existingConfirmed } = await supabase
    .from("union_worker_import_batches")
    .select("id, confirmed_at, created_at")
    .eq("delegation_id", delegationId)
    .eq("file_sha256", security.sha256)
    .in("status", ["confirmed", "applied"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // 9. Crear lote en union_worker_import_batches con format_version = "UNION_LOCKERS_V2"
  const { data: batch, error: batchError } = await supabase
    .from("union_worker_import_batches")
    .insert({
      delegation_id: delegationId,
      imported_by: userId,
      file_name: fileName,
      file_size_bytes: fileBuffer.length,
      file_sha256: security.sha256,
      format_version: "UNION_LOCKERS_V2",
      status: "preview",
      total_rows: summary.totalRows,
      new_workers_count: newWorkersFromExcel,
      updated_workers_count: 0,
      unchanged_workers_count: 0,
      conflicts_count: realConflictsCount,
      invalid_rows_count: 0,
      new_lockers_count: newPhysicalLockers,
      locker_changes_count: lockerChanges,
      summary_metadata: {
        domain: "LOCKER_V2_HOJA1",
        lockersDetected: uniquePhysicalLockers.size,
        uniquePhysicalLockers: uniquePhysicalLockers.size,
        newPhysicalLockers,
        existingLockersCount,
        safeAssignmentsCount,
        newLockerAssignments,
        lockerChanges,
        unchangedLockers,
        workersMatchedInRoster,
        newWorkersFromExcel,
        lockersWithoutWorkerCount,
        historicalSupersededCount,
        realConflictsCount,
        semanticLockersCount,
        rowsWithoutLockerCount,
        totalRowsAccounted,
      } as unknown as Json,
    })
    .select("id")
    .single();

  if (batchError || !batch) {
    throw new Error(`Error al registrar lote de casilleros: ${batchError?.message}`);
  }

  const batchId = batch.id;

  // 10. Persistir filas fuente en union_locker_import_source_rows
  const sourceRowsToInsert = analyzedRows.map((a) => ({
    batch_id: batchId,
    delegation_id: delegationId,
    sheet_name: "Hoja1",
    row_number: a.rowNumber,
    raw_cells: (a.rawCells as unknown) as Json,
    matricula_raw: a.rawMatricula,
    matricula_normalized: a.matricula,
    worker_name_raw: a.rawNombre,
    plaza_raw: a.rawPlaza,
    turn_raw: a.rawTurno,
    category_raw: a.rawCategoria,
    schedule_raw: a.rawHorario,
    locker_raw: a.rawLocker,
    locker_normalized: a.lockerExcel,
    observations_raw: a.observations,
    supplementary_data: (a.supplementaryData as unknown) as Json,
    classification: a.classification,
    resolution_state: "pending",
    matched_worker_id: a.targetWorkerId,
    matched_locker_id: null,
    matched_assignment_id: null,
  }));

  for (let i = 0; i < sourceRowsToInsert.length; i += CHUNK_SIZE) {
    const chunk = sourceRowsToInsert.slice(i, i + CHUNK_SIZE);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: srcError } = await (supabase as any)
      .from("union_locker_import_source_rows")
      .insert(chunk);
    if (srcError) {
      await supabase
        .from("union_worker_import_batches")
        .update({ status: "failed", notes: srcError.message })
        .eq("id", batchId);
      throw new Error(`Error al guardar filas fuente de casilleros: ${srcError.message}`);
    }
  }

  // 11. Insertar filas en union_worker_import_rows (Staging estándar para RPC)
  const stagingRows = analyzedRows.map((a) => {
    const actionTaken: "pending" | "applied" | "skipped" | "conflict_hold" =
      a.classification === "REAL_CONFLICT"
        ? "conflict_hold"
        : a.classification === "HISTORICAL_SUPERSEDED" ||
          a.classification === "DUPLICATE_ROW" ||
          a.classification === "SEMANTIC_LOCKER" ||
          a.classification === "ROW_WITHOUT_LOCKER"
        ? "skipped"
        : "pending";

    return {
      batch_id: batchId,
      row_number: a.rowNumber,
      matricula: a.matricula || `ROW_${a.rowNumber}`,
      full_name: a.fullName || a.rawNombre || "",
      raw_data: ({
        matricula: a.rawMatricula,
        locker: a.rawLocker,
        nombre: a.rawNombre,
        plaza: a.rawPlaza,
        turno: a.rawTurno,
        categoria: a.rawCategoria,
        horario: a.rawHorario,
        observations: a.observations,
      } as unknown) as Json,
      parsed_data: ({
        matricula: a.matricula,
        locker: a.lockerExcel,
        nombre: a.fullName,
        plaza: a.rawPlaza,
        turno: a.rawTurno,
        categoria: a.category ?? a.rawCategoria,
        horario: a.rawHorario,
        is_semantic_locker: a.isSemantic,
        conflict_reason_code: a.conflictReasonCode,
        classification: a.classification,
      } as unknown) as Json,
      row_status: a.status,
      action_taken: actionTaken,
      diff: ((a.diff ?? {}) as unknown) as Json,
      issues: (a.issues as unknown) as Json,
      target_worker_id: a.targetWorkerId,
    };
  });

  for (let i = 0; i < stagingRows.length; i += CHUNK_SIZE) {
    const chunk = stagingRows.slice(i, i + CHUNK_SIZE);
    const { error: chunkError } = await supabase.from("union_worker_import_rows").insert(chunk);
    if (chunkError) {
      await supabase
        .from("union_worker_import_batches")
        .update({ status: "failed", notes: chunkError.message })
        .eq("id", batchId);
      throw new Error(`Error al guardar filas de casilleros: ${chunkError.message}`);
    }
  }

  // 12. Construir preview rows para la UI
  const previewRows: PreviewRow[] = analyzedRows.map((a) => ({
    rowNumber: a.rowNumber,
    matricula: a.matricula,
    fullName: a.fullName,
    category: a.category ?? a.rawCategoria ?? "",
    department: a.department ?? "",
    plaza: a.rawPlaza,
    turn: a.rawTurno,
    schedule: a.rawHorario,
    lockerCurrent: a.lockerCurrent,
    lockerExcel: a.lockerExcel,
    observations: a.observations,
    status: a.status,
    conflictReasonCode: a.conflictReasonCode,
    autoResolvable: a.autoResolvable,
    duplicateOfRow: a.duplicateOfRow,
    issues: a.issues,
    diff: a.diff as PreviewRow["diff"],
  }));

  // 13. Auditoría
  await writeAuditLog({
    delegation_id: delegationId,
    entity_type: "union_worker_import_batches",
    entity_id: batchId,
    action: "union_locker_import_previewed",
    metadata: {
      format_version: "UNION_LOCKERS_V2",
      total_rows: summary.totalRows,
      lockers_detected: uniquePhysicalLockers.size,
      new_assignments: newLockerAssignments,
      locker_changes: lockerChanges,
      unchanged_lockers: unchangedLockers,
      conflicts: realConflictsCount,
      new_workers_from_excel: newWorkersFromExcel,
      workers_matched: workersMatchedInRoster,
    },
  });

  return {
    batchId,
    fileName,
    fileSizeBytes: fileBuffer.length,
    fileSha256: security.sha256,
    summary,
    rows: previewRows,
    missingWorkers: [],
    alreadyConfirmedAt: existingConfirmed ? (existingConfirmed.confirmed_at || existingConfirmed.created_at) : null,
    alreadyConfirmedBatchId: existingConfirmed?.id ?? null,
  };
}

export async function applyLockerImportBatch(params: {
  batchId: string;
  delegationId: string;
  userId: string;
  resolutions?: Record<string, unknown>;
  options?: { allowReimport?: boolean };
}): Promise<ImportConfirmResult> {
  const { batchId, delegationId, resolutions = {}, options = {} } = params;
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("union_apply_locker_import", {
    p_batch_id: batchId,
    p_resolutions: resolutions as Json,
    p_options: options as Json,
  });

  if (error) {
    throw new Error(`Error al aplicar la importación de casilleros: ${error.message}`);
  }

  const res = (data as unknown) as {
    new_locker_assignments?: number;
    locker_changes?: number;
    unchanged_assignments?: number;
    new_workers_created?: number;
    new_lockers_inventoried?: number;
    skipped_conflicts?: number;
    pending_review_count?: number;
  };

  await writeAuditLog({
    delegation_id: delegationId,
    entity_type: "union_worker_import_batches",
    entity_id: batchId,
    action: "union_locker_import_applied",
    metadata: {
      format_version: "UNION_LOCKERS_V2",
      new_locker_assignments: res.new_locker_assignments ?? 0,
      locker_changes: res.locker_changes ?? 0,
      unchanged_assignments: res.unchanged_assignments ?? 0,
      new_workers_created: res.new_workers_created ?? 0,
      new_lockers_inventoried: res.new_lockers_inventoried ?? 0,
      skipped_conflicts: res.skipped_conflicts ?? 0,
      pending_review_count: res.pending_review_count ?? 0,
    },
  });

  return {
    batchId,
    status: "confirmed",
    appliedCount: res.new_workers_created ?? 0,
    updatedCount: res.locker_changes ?? 0,
    unchangedCount: res.unchanged_assignments ?? 0,
    newLockersCount: res.new_lockers_inventoried ?? 0,
    newLockerAssignments: res.new_locker_assignments ?? 0,
    lockerChangesCount: res.locker_changes ?? 0,
    pendingReviewCount: res.pending_review_count ?? 0,
    missingMarkedCount: 0,
    skippedConflicts: res.skipped_conflicts ?? 0,
    workersCreatedCount: res.new_workers_created ?? 0,
    lockersInventoriedCount: res.new_lockers_inventoried ?? 0,
  };
}

export async function rollbackLockerImportBatch(params: {
  batchId: string;
  delegationId: string;
  userId: string;
}): Promise<ImportRollbackResult> {
  const { batchId, delegationId } = params;
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("union_rollback_locker_import", {
    p_batch_id: batchId,
  });

  if (error) {
    throw new Error(`Error al revertir la importación de casilleros: ${error.message}`);
  }

  const res = (data as unknown) as {
    reverted_assignments?: number;
    restored_assignments?: number;
    deactivated_workers?: number;
    cancelled_review_items?: number;
  };

  await writeAuditLog({
    delegation_id: delegationId,
    entity_type: "union_worker_import_batches",
    entity_id: batchId,
    action: "union_locker_import_rolled_back",
    metadata: {
      format_version: "UNION_LOCKERS_V2",
      reverted_assignments: res.reverted_assignments ?? 0,
      restored_assignments: res.restored_assignments ?? 0,
      deactivated_workers: res.deactivated_workers ?? 0,
      cancelled_review_items: res.cancelled_review_items ?? 0,
    },
  });

  return {
    batchId,
    status: "rolled_back",
    restoredFieldsCount: 0,
    deactivatedWorkersCount: res.deactivated_workers ?? 0,
    revertedAssignmentsCount: res.reverted_assignments ?? 0,
    restoredAssignmentsCount: res.restored_assignments ?? 0,
    cancelledReviewItemsCount: res.cancelled_review_items ?? 0,
    deletedWorkersCount: 0,
  };
}
