import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";
import { validateExcelSecurity } from "./excel-security";
import { normalizeMatricula, normalizeLockerNumber } from "./row-parser";
import type {
  ImportSummary,
  PreviewRow,
  ImportPreviewResult,
  ImportConfirmResult,
  ImportRollbackResult,
  RowIssue,
  RowStatus,
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

const CHUNK_SIZE = 200;

export async function parseAndPreviewLockerImport(params: {
  fileBuffer: Buffer;
  fileName: string;
  delegationId: string;
  userId: string;
}): Promise<ImportPreviewResult> {
  const { fileBuffer, fileName, delegationId, userId } = params;

  // 1. Validar seguridad del archivo (.xlsx, macros, fórmulas, zip bomb)
  const security = validateExcelSecurity(fileBuffer, fileName);
  if (!security.valid) {
    throw new Error(security.error ?? "Archivo no permitido.");
  }

  // 2. Cargar Excel con ExcelJS
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileBuffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);

  const worksheet = workbook.getWorksheet("Hoja1") ?? workbook.worksheets[0];
  if (!worksheet || worksheet.rowCount < 2) {
    throw new Error("El archivo no contiene filas de datos o está vacío en la hoja principal.");
  }

  if (worksheet.rowCount > 25000) {
    throw new Error(`El archivo contiene ${worksheet.rowCount} filas, superando el límite permitido de 25,000.`);
  }

  // 3. Extraer y mapear encabezados de la fila 1
  const headerRow = worksheet.getRow(1);
  let matriculaCol = -1;
  let nombreCol = -1;
  let lockerCol = -1;
  let observacionesCol = -1;

  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    const raw = extractCellValue(cell.value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (raw.includes("matricula") || raw.includes("empleado")) matriculaCol = colNumber;
    else if (raw.includes("nombre") || raw.includes("trabajador")) nombreCol = colNumber;
    else if (raw.includes("locker") || raw.includes("casillero")) lockerCol = colNumber;
    else if (raw.includes("observacion") || raw.includes("comentario") || raw.includes("nota")) observacionesCol = colNumber;
  });

  // Fallbacks posicionales estándar si no se identificaron por nombre
  if (matriculaCol === -1) matriculaCol = 1;
  if (nombreCol === -1) nombreCol = 2;
  if (lockerCol === -1) {
    // Si hay al menos 9 columnas, típicamente la 9 es locker
    if (worksheet.columnCount >= 9) lockerCol = 9;
  }
  if (observacionesCol === -1 && worksheet.columnCount >= 10) observacionesCol = 10;

  // 4. Extraer filas del archivo ignorando deliberadamente campos laborales
  interface RawLockerRow {
    rowNumber: number;
    rawMatricula: string;
    normalizedMatricula: string;
    rawNombre: string;
    rawLocker: string;
    normalizedLocker: string;
    isSemanticLocker: boolean;
    observations: string;
  }

  const rawRows: RawLockerRow[] = [];
  for (let r = 2; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    const rawMatricula = matriculaCol > 0 ? extractCellValue(row.getCell(matriculaCol).value) : "";
    const rawNombre = nombreCol > 0 ? extractCellValue(row.getCell(nombreCol).value) : "";
    const rawLocker = lockerCol > 0 ? extractCellValue(row.getCell(lockerCol).value) : "";
    const observations = observacionesCol > 0 ? extractCellValue(row.getCell(observacionesCol).value) : "";

    if (!rawMatricula && !rawLocker && !rawNombre) {
      continue; // Fila vacía
    }

    const normMat = normalizeMatricula(rawMatricula);
    const { normalized: normLocker, isSemantic } = normalizeLockerNumber(rawLocker);

    rawRows.push({
      rowNumber: r,
      rawMatricula,
      normalizedMatricula: normMat,
      rawNombre,
      rawLocker,
      normalizedLocker: normLocker,
      isSemanticLocker: isSemantic,
      observations,
    });
  }

  if (rawRows.length === 0) {
    throw new Error("No se encontraron registros de datos en la hoja principal.");
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

  // Mapear por matrícula y por locker
  const workerByEmpNumber = new Map<string, (typeof dbWorkers)[0]>();
  for (const w of dbWorkers) {
    workerByEmpNumber.set(w.employee_number, w);
  }

  const lockerById = new Map(dbLockers.map((l) => [l.id, l]));
  const lockerByNumber = new Map(dbLockers.map((l) => [l.locker_number, l]));

  // Asignaciones activas por trabajador y por casillero
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

  // Detectar duplicados en el archivo (mismo casillero reclamado por múltiples matrículas)
  const lockerOccurrences = new Map<string, number[]>();
  for (const row of rawRows) {
    if (row.normalizedLocker && !row.isSemanticLocker) {
      const list = lockerOccurrences.get(row.normalizedLocker) ?? [];
      list.push(row.rowNumber);
      lockerOccurrences.set(row.normalizedLocker, list);
    }
  }

  // 6. Analizar cada fila de lockers
  interface LockerAnalyzedRow {
    rowNumber: number;
    matricula: string;
    fullName: string;
    category?: string;
    department?: string;
    lockerCurrent?: string;
    lockerExcel: string;
    isSemantic: boolean;
    observations: string;
    status: RowStatus;
    issues: RowIssue[];
    diff?: Record<string, unknown>;
    targetWorkerId: string | null;
  }

  const analyzedRows: LockerAnalyzedRow[] = [];
  let lockersDetected = 0;
  let newLockerAssignments = 0;
  let lockerChanges = 0;
  let unchangedLockers = 0;
  let duplicateLockersCount = 0;
  let unknownWorkersCount = 0;
  let conflictsCount = 0;
  let ignoredRowsCount = 0;

  const seenDbLockerNumbers = new Set(dbLockers.map((l) => l.locker_number));
  let newPhysicalLockers = 0;

  for (const r of rawRows) {
    const issues: RowIssue[] = [];
    let status: RowStatus = "unchanged";
    let targetWorkerId: string | null = null;
    let workerFullName = r.rawNombre;
    let category: string | undefined;
    let department: string | undefined;
    let currentLocker: string | undefined;

    // Fila sin casillero ni semántico
    if (!r.normalizedLocker && !r.isSemanticLocker) {
      ignoredRowsCount++;
      analyzedRows.push({
        rowNumber: r.rowNumber,
        matricula: r.normalizedMatricula,
        fullName: r.rawNombre,
        lockerExcel: "",
        isSemantic: false,
        observations: r.observations,
        status: "ignored",
        issues: [{ code: "NO_LOCKER_IN_ROW", message: "Fila sin número de casillero", severity: "warning" }],
        targetWorkerId: null,
      });
      continue;
    }

    if (r.isSemanticLocker) {
      ignoredRowsCount++;
      analyzedRows.push({
        rowNumber: r.rowNumber,
        matricula: r.normalizedMatricula,
        fullName: r.rawNombre,
        lockerExcel: r.rawLocker,
        isSemantic: true,
        observations: r.observations,
        status: "ignored",
        issues: [{ code: "SEMANTIC_LOCKER", message: `Casillero semántico no físico: "${r.rawLocker}"`, severity: "warning" }],
        targetWorkerId: null,
      });
      continue;
    }

    lockersDetected++;
    if (!seenDbLockerNumbers.has(r.normalizedLocker)) {
      newPhysicalLockers++;
      seenDbLockerNumbers.add(r.normalizedLocker);
    }

    // Verificar existencia del trabajador en padrón (REGLA MANDATORIA)
    const existingWorker = r.normalizedMatricula ? workerByEmpNumber.get(r.normalizedMatricula) : null;

    if (!existingWorker) {
      unknownWorkersCount++;
      conflictsCount++;
      status = "conflict";
      issues.push({
        code: "WORKER_NOT_FOUND_IN_ROSTER",
        message: "Trabajador no encontrado en el padrón",
        severity: "error",
      });
    } else {
      targetWorkerId = existingWorker.id;
      workerFullName = `${existingWorker.paternal_surname} ${existingWorker.maternal_surname ?? ""} ${existingWorker.first_name}`.trim();
      category = existingWorker.category;
      department = existingWorker.assignment;

      const activeAsgn = activeAssignmentByWorkerId.get(existingWorker.id);
      currentLocker = activeAsgn?.lockerNumber;

      // Verificar casillero duplicado en el archivo
      const rowsWithSameLocker = lockerOccurrences.get(r.normalizedLocker) ?? [];
      if (rowsWithSameLocker.length > 1) {
        duplicateLockersCount++;
        conflictsCount++;
        status = "conflict";
        issues.push({
          code: "DUPLICATE_LOCKER_IN_FILE",
          message: `El casillero ${r.normalizedLocker} aparece ${rowsWithSameLocker.length} veces en el archivo (filas ${rowsWithSameLocker.join(", ")}).`,
          severity: "error",
        });
      }

      // Verificar si el casillero en BD está ocupado por OTRO trabajador
      const dbLocker = lockerByNumber.get(r.normalizedLocker);
      if (dbLocker) {
        const lockerAsgn = activeAssignmentByLockerId.get(dbLocker.id);
        if (lockerAsgn && lockerAsgn.workerId !== existingWorker.id) {
          const otherWorker = dbWorkers.find((w) => w.id === lockerAsgn.workerId);
          conflictsCount++;
          status = "conflict";
          issues.push({
            code: "LOCKER_OCCUPIED_BY_OTHER",
            message: `El casillero ${r.normalizedLocker} actualmente está asignado a ${otherWorker ? `${otherWorker.paternal_surname} ${otherWorker.first_name} (${otherWorker.employee_number})` : "otro trabajador"}.`,
            severity: "error",
          });
        }
      }

      // Si no hubo conflictos bloqueantes, determinar acción de asignación
      if (status !== "conflict") {
        if (!currentLocker) {
          // Nueva asignación
          status = "new";
          newLockerAssignments++;
        } else if (currentLocker !== r.normalizedLocker) {
          // Cambio de casillero
          status = "updated";
          lockerChanges++;
        } else {
          // Sin cambios
          status = "unchanged";
          unchangedLockers++;
        }
      }
    }

    analyzedRows.push({
      rowNumber: r.rowNumber,
      matricula: r.normalizedMatricula,
      fullName: workerFullName,
      category,
      department,
      lockerCurrent: currentLocker,
      lockerExcel: r.normalizedLocker,
      isSemantic: false,
      observations: r.observations,
      status,
      issues,
      diff: {
        lockerChange: {
          currentLocker: currentLocker ?? null,
          excelLocker: r.normalizedLocker,
          action: currentLocker && currentLocker !== r.normalizedLocker ? "change_assignment" : "new_assignment",
        },
      },
      targetWorkerId,
    });
  }

  const summary: ImportSummary = {
    totalRows: analyzedRows.length,
    validWorkers: analyzedRows.filter((r) => r.status !== "ignored").length,
    newWorkers: 0,
    updatedWorkers: 0,
    unchangedWorkers: 0,
    duplicateMatriculas: 0,
    missingMatricula: unknownWorkersCount,
    lockersDetected,
    newLockers: newPhysicalLockers,
    lockerChanges,
    duplicateLockers: duplicateLockersCount,
    conflicts: conflictsCount,
    ignoredRows: ignoredRowsCount,
    missingInFileCount: 0,
    hasSupplementarySheet: false,
    supplementarySheetRows: 0,
    newCount: newLockerAssignments,
    updatedCount: lockerChanges,
    unchangedCount: unchangedLockers,
    warningsCount: analyzedRows.filter((r) => r.status === "warning").length,
    invalidCount: unknownWorkersCount,
    conflictsCount,
  };

  // 7. Crear lote en union_worker_import_batches con format_version = "UNION_LOCKERS_V1"
  const { data: batch, error: batchError } = await supabase
    .from("union_worker_import_batches")
    .insert({
      delegation_id: delegationId,
      imported_by: userId,
      file_name: fileName,
      file_size_bytes: fileBuffer.length,
      file_sha256: security.sha256,
      format_version: "UNION_LOCKERS_V1",
      status: "preview",
      total_rows: summary.totalRows,
      new_workers_count: 0,
      updated_workers_count: 0,
      unchanged_workers_count: 0,
      conflicts_count: conflictsCount,
      invalid_rows_count: unknownWorkersCount,
      new_lockers_count: newLockerAssignments,
      locker_changes_count: lockerChanges,
      summary_metadata: {
        domain: "LOCKER",
        lockersDetected,
        newPhysicalLockers,
        newLockerAssignments,
        lockerChanges,
        unchangedLockers,
        unknownWorkersCount,
      } as unknown as Json,
    })
    .select("id")
    .single();

  if (batchError || !batch) {
    throw new Error(`Error al registrar lote de casilleros: ${batchError?.message}`);
  }

  const batchId = batch.id;

  // 8. Insertar filas en union_worker_import_rows
  const stagingRows = analyzedRows.map((a) => {
    const actionTaken: "pending" | "applied" | "skipped" | "conflict_hold" =
      a.status === "conflict"
        ? "conflict_hold"
        : a.status === "ignored" || a.status === "invalid"
        ? "skipped"
        : "pending";

    return {
      batch_id: batchId,
      row_number: a.rowNumber,
      matricula: a.matricula || `ROW_${a.rowNumber}`,
      full_name: a.fullName || "",
      raw_data: ({ matricula: a.matricula, locker: a.lockerExcel, observations: a.observations } as unknown) as Json,
      parsed_data: ({
        matricula: a.matricula,
        locker: a.lockerExcel,
        is_semantic_locker: a.isSemantic,
        raw_observations: a.observations,
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

  // 9. Construir preview rows
  const previewRows: PreviewRow[] = analyzedRows.map((a) => ({
    rowNumber: a.rowNumber,
    matricula: a.matricula,
    fullName: a.fullName,
    category: a.category ?? "",
    department: a.department ?? "",
    plaza: "",
    lockerCurrent: a.lockerCurrent,
    lockerExcel: a.lockerExcel,
    observations: a.observations,
    status: a.status,
    issues: a.issues,
    diff: a.diff as PreviewRow["diff"],
  }));

  // 10. Auditoría
  await writeAuditLog({
    delegation_id: delegationId,
    entity_type: "union_worker_import_batches",
    entity_id: batchId,
    action: "union_locker_import_previewed",
    metadata: {
      format_version: "UNION_LOCKERS_V1",
      total_rows: summary.totalRows,
      lockers_detected: lockersDetected,
      new_assignments: newLockerAssignments,
      locker_changes: lockerChanges,
      conflicts: conflictsCount,
      unknown_workers: unknownWorkersCount,
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
  };
}

export async function applyLockerImportBatch(params: {
  batchId: string;
  delegationId: string;
  userId: string;
  resolutions?: Record<string, unknown>;
}): Promise<ImportConfirmResult> {
  const { batchId, delegationId, resolutions = {} } = params;
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("union_apply_locker_import", {
    p_batch_id: batchId,
    p_resolutions: resolutions as Json,
  });

  if (error) {
    throw new Error(`Error al aplicar la importación de casilleros: ${error.message}`);
  }

  const res = (data as unknown) as {
    new_locker_assignments: number;
    locker_changes: number;
    skipped_conflicts: number;
  };

  await writeAuditLog({
    delegation_id: delegationId,
    entity_type: "union_worker_import_batches",
    entity_id: batchId,
    action: "union_locker_import_applied",
    metadata: {
      format_version: "UNION_LOCKERS_V1",
      new_locker_assignments: res.new_locker_assignments ?? 0,
      locker_changes: res.locker_changes ?? 0,
      skipped_conflicts: res.skipped_conflicts ?? 0,
    },
  });

  return {
    batchId,
    status: "applied",
    appliedCount: 0, // Cero trabajadores nuevos
    updatedCount: 0, // Cero trabajadores actualizados
    unchangedCount: 0,
    newLockersCount: res.new_locker_assignments ?? 0,
    lockerChangesCount: res.locker_changes ?? 0,
    missingMarkedCount: 0,
    skippedConflicts: res.skipped_conflicts ?? 0,
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
    reverted_assignments: number;
    restored_assignments: number;
  };

  await writeAuditLog({
    delegation_id: delegationId,
    entity_type: "union_worker_import_batches",
    entity_id: batchId,
    action: "union_locker_import_rolled_back",
    metadata: {
      format_version: "UNION_LOCKERS_V1",
      reverted_assignments: res.reverted_assignments ?? 0,
      restored_assignments: res.restored_assignments ?? 0,
    },
  });

  return {
    batchId,
    status: "rolled_back",
    restoredFieldsCount: 0,
    deactivatedWorkersCount: 0,
    revertedAssignmentsCount: res.reverted_assignments ?? 0,
    restoredAssignmentsCount: res.restored_assignments ?? 0,
    deletedWorkersCount: 0,
  };
}
