import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";
import { validateExcelSecurity } from "./excel-security";
import { mapHeaders } from "./header-mapper";
import {
  parseWorkerRow,
  maskRfc,
  maskCurp,
  maskNss,
} from "./row-parser";
import {
  detectConflictsAndDiff,
  type ExistingWorkerRecord,
  type ExistingLockerRecord,
} from "./conflict-detector";
import type {
  SiapRawRow,
  ImportSummary,
  PreviewRow,
  ImportPreviewResult,
  ImportConfirmResult,
  ImportRollbackResult,
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

export async function parseAndPreviewBatch(params: {
  fileBuffer: Buffer;
  fileName: string;
  delegationId: string;
  userId: string;
}): Promise<ImportPreviewResult> {
  const { fileBuffer, fileName, delegationId, userId } = params;

  // 1. Validar seguridad del archivo (macro, extensiones, binarios embebidos, zip)
  const security = validateExcelSecurity(fileBuffer, fileName);
  if (!security.valid) {
    throw new Error(security.error ?? "Archivo no permitido.");
  }

  // 2. Cargar Excel con ExcelJS en memoria
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileBuffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);

  // Validar hojas con datos (máximo 3)
  const nonEmptySheets = workbook.worksheets.filter((ws) => ws.rowCount > 0);
  if (nonEmptySheets.length > 3) {
    throw new Error(`El libro contiene ${nonEmptySheets.length} hojas con datos. El máximo permitido es 3.`);
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet || worksheet.rowCount < 2) {
    throw new Error("El archivo no contiene filas de datos o está vacío.");
  }

  // Validar límites de dimensiones
  if (worksheet.rowCount > 20000) {
    throw new Error(`El archivo contiene ${worksheet.rowCount} filas, superando el límite de 20,000 filas.`);
  }

  if (worksheet.columnCount > 50) {
    throw new Error(`El archivo contiene ${worksheet.columnCount} columnas, superando el límite de 50 columnas.`);
  }

  // Protección contra inyección de fórmulas en celdas de datos
  for (let r = 2; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    row.eachCell({ includeEmpty: false }, (cell) => {
      if (cell.formula) {
        throw new Error(`Por seguridad no se permiten fórmulas en el archivo (detectada en fila ${r}, columna ${cell.col}).`);
      }
      if (typeof cell.value === "string" && cell.value.trim().startsWith("=")) {
        throw new Error(`Por seguridad no se permiten fórmulas en el archivo (detectada en fila ${r}, columna ${cell.col}).`);
      }
    });
  }

  // 3. Extraer encabezados de la fila 1
  const headerRow = worksheet.getRow(1);
  const rawHeaders: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    rawHeaders[colNumber - 1] = extractCellValue(cell.value);
  });

  const headerMapping = mapHeaders(rawHeaders);
  if (!headerMapping.valid) {
    throw new Error(headerMapping.error);
  }

  // 4. Extraer filas de datos
  const rawRows: Array<{ raw: SiapRawRow; rowNumber: number }> = [];
  for (let r = 2; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    let hasContent = false;
    const rowData: SiapRawRow = {};

    headerMapping.columnMap.forEach((canonicalKey, colIndex) => {
      const cell = row.getCell(colIndex);
      const val = extractCellValue(cell.value);
      if (val) hasContent = true;
      rowData[canonicalKey] = val;
    });

    if (hasContent) {
      rawRows.push({ raw: rowData, rowNumber: r });
    }
  }

  if (rawRows.length === 0) {
    throw new Error("No se encontraron registros válidos de trabajadores en la hoja.");
  }

  // 5. Parsear cada fila según diccionario SIAP y reglas de normalización
  const parsedRows = rawRows.map(({ raw, rowNumber }) => {
    const res = parseWorkerRow(raw, rowNumber);
    return {
      raw,
      rowNumber,
      parsed: res.parsed,
      issues: res.issues,
      isValid: res.isValid,
    };
  });

  // 6. Consultar trabajadores existentes en la base de datos para la delegación
  const supabase = await createClient();
  const { data: dbWorkers, error: fetchError } = await supabase
    .from("union_workers")
    .select(`
      id, employee_number, siap_full_name, first_name, paternal_surname, maternal_surname,
      category, assignment, turn, schedule, plaza_code, rfc, curp, nss,
      responsibility_area_code, plaza_type_code, shift_code, position_code, department_code,
      schedule_code, associated_concepts_mask, seniority_raw, occupation_start_date,
      occupation_limit_date, employment_start_date, reemployment_date, source_status_code,
      termination_code, termination_date, micro_group_code, contract_type_code, active
    `)
    .eq("delegation_id", delegationId);

  if (fetchError) {
    throw new Error(`Error al consultar el padrón existente: ${fetchError.message}`);
  }

  const existingMap = new Map<string, ExistingWorkerRecord>();
  for (const w of dbWorkers ?? []) {
    existingMap.set(w.employee_number, w);
  }

  // 7. Detectar conflictos y calcular diferencias
  const analyzedRows = detectConflictsAndDiff(
    parsedRows.map((p) => ({
      parsed: p.parsed,
      issues: p.issues,
      isValid: p.isValid,
      rowNumber: p.rowNumber,
    })),
    existingMap
  );

  // 8. Identificar trabajadores ausentes en el archivo
  const fileMatriculas = new Set(
    parsedRows.map((p) => p.parsed.matricula).filter(Boolean)
  );

  const missingWorkers = (dbWorkers ?? [])
    .filter((w) => w.active && !fileMatriculas.has(w.employee_number))
    .map((w) => ({
      id: w.id,
      employee_number: w.employee_number,
      full_name: w.siap_full_name || `${w.paternal_surname || ""} ${w.maternal_surname || ""} ${w.first_name || ""}`.trim(),
      category: w.category,
      department: w.assignment,
    }));

  // 9. Calcular conteos del resumen
  let newCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;
  let warningsCount = 0;
  let invalidCount = 0;
  let conflictsCount = 0;

  for (const row of analyzedRows) {
    if (row.status === "new") newCount++;
    else if (row.status === "updated") updatedCount++;
    else if (row.status === "unchanged") unchangedCount++;
    else if (row.status === "warning") warningsCount++;
    else if (row.status === "invalid") invalidCount++;
    else if (row.status === "conflict") conflictsCount++;
  }

  const summary: ImportSummary = {
    totalRows: analyzedRows.length,
    newCount,
    updatedCount,
    unchangedCount,
    warningsCount,
    invalidCount,
    conflictsCount,
    missingInFileCount: missingWorkers.length,
  };

  // 10. Crear lote de importación en staging (union_worker_import_batches)
  const { data: batch, error: batchError } = await supabase
    .from("union_worker_import_batches")
    .insert({
      delegation_id: delegationId,
      imported_by: userId,
      file_name: fileName,
      file_size_bytes: fileBuffer.length,
      file_sha256: security.sha256,
      format_version: "SIAP_2026",
      total_rows: summary.totalRows,
      new_workers_count: summary.newCount,
      updated_workers_count: summary.updatedCount,
      unchanged_workers_count: summary.unchangedCount,
      warnings_count: summary.warningsCount,
      invalid_rows_count: summary.invalidCount,
      conflicts_count: summary.conflictsCount,
      missing_in_file_count: summary.missingInFileCount,
      status: "preview",
    })
    .select("id")
    .single();

  if (batchError || !batch) {
    throw new Error(`Error al registrar el lote de importación: ${batchError?.message}`);
  }

  const batchId = batch.id;

  // 11. Insertar filas en union_worker_import_rows en chunks
  const stagingRowsToInsert = analyzedRows.map((a, idx) => {
    const rawData = parsedRows[idx].raw;
    const parsedData = a.parsed;
    const actionTaken: "pending" | "applied" | "skipped" | "conflict_hold" =
      a.status === "conflict"
        ? "conflict_hold"
        : a.status === "invalid"
        ? "skipped"
        : "pending";

    return {
      batch_id: batchId,
      row_number: a.rowNumber,
      matricula: a.parsed.matricula || `ROW_${a.rowNumber}`,
      full_name: a.parsed.siap_full_name || `${a.parsed.paternal_surname} ${a.parsed.maternal_surname} ${a.parsed.first_name}`.trim(),
      raw_data: (rawData as unknown) as Json,
      parsed_data: (parsedData as unknown) as Json,
      row_status: a.status as "new" | "updated" | "unchanged" | "warning" | "invalid" | "conflict",
      action_taken: actionTaken,
      issues: (a.issues as unknown) as Json,
      diff: ((a.diff ?? {}) as unknown) as Json,
      target_worker_id: a.existingWorkerId ?? null,
    };
  });

  for (let i = 0; i < stagingRowsToInsert.length; i += CHUNK_SIZE) {
    const chunk = stagingRowsToInsert.slice(i, i + CHUNK_SIZE);
    const { error: chunkError } = await supabase
      .from("union_worker_import_rows")
      .insert(chunk);

    if (chunkError) {
      await supabase
        .from("union_worker_import_batches")
        .update({ status: "failed", notes: chunkError.message })
        .eq("id", batchId);
      throw new Error(`Error al guardar filas de importación: ${chunkError.message}`);
    }
  }

  // 12. Generar preview rows con PII enmascarada (NUNCA raw_data ni PII completa)
  const previewRows: PreviewRow[] = analyzedRows.map((a) => ({
    rowNumber: a.rowNumber,
    matricula: a.parsed.matricula,
    fullName: a.parsed.siap_full_name || `${a.parsed.paternal_surname} ${a.parsed.maternal_surname} ${a.parsed.first_name}`.trim(),
    category: a.parsed.position_description,
    department: a.parsed.department_description,
    plaza: a.parsed.plaza_code,
    maskedRfc: maskRfc(a.parsed.rfc),
    maskedCurp: maskCurp(a.parsed.curp),
    maskedNss: maskNss(a.parsed.nss),
    status: a.status,
    issues: a.issues,
    diff: a.diff,
  }));

  return {
    batchId,
    fileName,
    fileSizeBytes: fileBuffer.length,
    fileSha256: security.sha256,
    summary,
    rows: previewRows,
    missingWorkers,
  };
}

export async function confirmImportBatch(params: {
  batchId: string;
  delegationId: string;
  userId: string;
}): Promise<ImportConfirmResult> {
  const { batchId, delegationId } = params;
  const supabase = await createClient();

  // Ejecución atómica en PostgreSQL dentro de una única transacción
  const { data, error } = await supabase.rpc("union_confirm_worker_import", {
    p_batch_id: batchId,
  });

  if (error) {
    throw new Error(`Error al confirmar la importación: ${error.message}`);
  }

  const result = data as {
    applied_count: number;
    unchanged_count: number;
    missing_marked_count: number;
    history_records_created: number;
  };

  await writeAuditLog({
    delegation_id: delegationId,
    entity_type: "union_worker_import_batches",
    entity_id: batchId,
    action: "confirm_import_batch",
    metadata: {
      applied_count: result.applied_count,
      unchanged_count: result.unchanged_count,
      missing_marked_count: result.missing_marked_count,
      history_records_created: result.history_records_created,
    },
  });

  return {
    batchId,
    status: "confirmed",
    appliedCount: result.applied_count,
    unchangedCount: result.unchanged_count,
    missingMarkedCount: result.missing_marked_count,
    historyRecordsCreated: result.history_records_created,
  };
}

export async function rollbackImportBatch(params: {
  batchId: string;
  delegationId: string;
  userId: string;
}): Promise<ImportRollbackResult> {
  const { batchId, delegationId } = params;
  const supabase = await createClient();

  // 1. Obtener formato del lote
  const { data: batch, error: fetchError } = await supabase
    .from("union_worker_import_batches")
    .select("format_version")
    .eq("id", batchId)
    .single();

  if (fetchError || !batch) {
    throw new Error(`Lote no encontrado: ${fetchError?.message ?? batchId}`);
  }

  let restoredFieldsCount = 0;
  let deactivatedWorkersCount = 0;
  let revertedAssignmentsCount = 0;
  let restoredAssignmentsCount = 0;

  if (batch.format_version === "UNION_LOCKERS_V1") {
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
    revertedAssignmentsCount = res.reverted_assignments ?? 0;
    restoredAssignmentsCount = res.restored_assignments ?? 0;
  } else if (batch.format_version === "UNION_MASTER_LOCKERS_V1") {
    const { data, error } = await supabase.rpc("union_rollback_master_import", {
      p_batch_id: batchId,
    });
    if (error) {
      throw new Error(`Error al revertir la importación maestra: ${error.message}`);
    }
    const res = (data as unknown) as {
      deactivated_workers: number;
      restored_fields: number;
      reverted_assignments: number;
      restored_assignments: number;
    };
    restoredFieldsCount = res.restored_fields ?? 0;
    deactivatedWorkersCount = res.deactivated_workers ?? 0;
    revertedAssignmentsCount = res.reverted_assignments ?? 0;
    restoredAssignmentsCount = res.restored_assignments ?? 0;
  } else {
    const { data, error } = await supabase.rpc("union_rollback_worker_import", {
      p_batch_id: batchId,
    });
    if (error) {
      throw new Error(`Error al revertir la importación SIAP: ${error.message}`);
    }
    const res = (data as unknown) as {
      restored_fields_count: number;
      deactivated_workers_count: number;
    };
    restoredFieldsCount = res.restored_fields_count ?? 0;
    deactivatedWorkersCount = res.deactivated_workers_count ?? 0;
  }

  await writeAuditLog({
    delegation_id: delegationId,
    entity_type: "union_worker_import_batches",
    entity_id: batchId,
    action: "rollback_import_batch",
    metadata: {
      format_version: batch.format_version,
      restored_fields_count: restoredFieldsCount,
      deactivated_workers_count: deactivatedWorkersCount,
      reverted_assignments_count: revertedAssignmentsCount,
      restored_assignments_count: restoredAssignmentsCount,
    },
  });

  return {
    batchId,
    status: "rolled_back",
    restoredFieldsCount,
    deactivatedWorkersCount,
    revertedAssignmentsCount,
    restoredAssignmentsCount,
    deletedWorkersCount: 0,
  };
}

// ============================================================================
// IMPORTADOR MAESTRO DE BASE SINDICAL (Trabajadores + Casilleros)
// ============================================================================

export async function parseAndPreviewMasterImport(params: {
  fileBuffer: Buffer;
  fileName: string;
  delegationId: string;
  userId: string;
}): Promise<ImportPreviewResult> {
  const { fileBuffer, fileName, delegationId } = params;

  // 1. Validar seguridad del archivo (.xlsx, tamaño, macros, zip bomb)
  const security = validateExcelSecurity(fileBuffer, fileName);
  if (!security.valid) {
    throw new Error(security.error ?? "Archivo no permitido.");
  }

  // 2. Cargar Excel con ExcelJS
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileBuffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);

  // Identificar hojas
  const hoja1 = workbook.getWorksheet("Hoja1") ?? workbook.worksheets[0];
  if (!hoja1 || hoja1.rowCount < 2) {
    throw new Error("El archivo no contiene filas de datos o está vacío en la hoja principal.");
  }

  // Comprobar si existe Hoja3 complementaria
  const hoja3 = workbook.getWorksheet("Hoja3");
  const hasSupplementarySheet = Boolean(hoja3 && hoja3.rowCount > 1);
  const supplementarySheetRows = hasSupplementarySheet ? Math.max(0, hoja3!.rowCount - 1) : 0;

  // Validar límites de dimensiones
  if (hoja1.rowCount > 25000) {
    throw new Error(`El archivo contiene ${hoja1.rowCount} filas, superando el límite permitido de 25,000.`);
  }

  // 3. Extraer y mapear encabezados de la fila 1
  const headerRow = hoja1.getRow(1);
  const rawHeaders: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    rawHeaders[colNumber - 1] = extractCellValue(cell.value);
  });

  const headerMapping = mapHeaders(rawHeaders);

  // Mapeo flexible para Hoja1 con casilleros
  let matriculaCol = -1;
  let nombreCol = -1;
  let plazaCol = -1;
  let turnoCol = -1;
  let categoriaCol = -1;
  let horarioCol = -1;
  let lockerCol = -1;
  let observacionesCol = -1;

  rawHeaders.forEach((h, idx) => {
    const norm = h.trim().toLowerCase();
    if (norm.includes("matricula") || norm.includes("empleado")) matriculaCol = idx + 1;
    else if (norm.includes("nombre") || norm.includes("trabajador")) nombreCol = idx + 1;
    else if (norm.includes("plaza")) plazaCol = idx + 1;
    else if (norm.includes("turno") || norm.includes("jor")) turnoCol = idx + 1;
    else if (norm.includes("categoria") || norm.includes("puesto")) categoriaCol = idx + 1;
    else if (norm.includes("horario")) horarioCol = idx + 1;
    else if (norm.includes("locker") || norm.includes("casillero")) lockerCol = idx + 1;
    else if (norm.includes("observacion") || norm.includes("estado") || norm.includes("actualiz")) observacionesCol = idx + 1;
  });

  // Fallback a posiciones estándar si las cabeceras no fueron reconocidas por nombre
  if (matriculaCol === -1) matriculaCol = 1;
  if (nombreCol === -1) nombreCol = 2;
  if (plazaCol === -1 && rawHeaders.length >= 3) plazaCol = 3;
  if (turnoCol === -1 && rawHeaders.length >= 4) turnoCol = 4;
  if (categoriaCol === -1 && rawHeaders.length >= 5) categoriaCol = 5;
  if (horarioCol === -1 && rawHeaders.length >= 6) horarioCol = 6;
  if (lockerCol === -1 && rawHeaders.length >= 9) lockerCol = 9;
  if (observacionesCol === -1 && rawHeaders.length >= 10) observacionesCol = 10;

  // 4. Extraer filas de datos
  const rawRows: Array<{ raw: SiapRawRow; rowNumber: number }> = [];
  for (let r = 2; r <= hoja1.rowCount; r++) {
    const row = hoja1.getRow(r);
    let hasContent = false;
    const rowData: SiapRawRow = {};

    if (headerMapping.valid && headerMapping.columnMap.size > 0) {
      headerMapping.columnMap.forEach((canonicalKey, colIndex) => {
        const cell = row.getCell(colIndex);
        const val = extractCellValue(cell.value);
        if (val) hasContent = true;
        rowData[canonicalKey] = val;
      });
    }

    // Asegurar columnas clave del archivo maestro
    const matVal = matriculaCol > 0 ? extractCellValue(row.getCell(matriculaCol).value) : "";
    const nomVal = nombreCol > 0 ? extractCellValue(row.getCell(nombreCol).value) : "";
    const plaVal = plazaCol > 0 ? extractCellValue(row.getCell(plazaCol).value) : "";
    const turVal = turnoCol > 0 ? extractCellValue(row.getCell(turnoCol).value) : "";
    const catVal = categoriaCol > 0 ? extractCellValue(row.getCell(categoriaCol).value) : "";
    const horVal = horarioCol > 0 ? extractCellValue(row.getCell(horarioCol).value) : "";
    const locVal = lockerCol > 0 ? extractCellValue(row.getCell(lockerCol).value) : "";
    const obsVal = observacionesCol > 0 ? extractCellValue(row.getCell(observacionesCol).value) : "";

    if (matVal || nomVal || locVal) hasContent = true;

    if (!rowData.matricula_raw && matVal) rowData.matricula_raw = matVal;
    if (!rowData.full_name_raw && nomVal) rowData.full_name_raw = nomVal;
    if (!rowData.plaza_raw && plaVal) rowData.plaza_raw = plaVal;
    if (!rowData.shift_raw && turVal) rowData.shift_raw = turVal;
    if (!rowData.position_desc_raw && catVal) rowData.position_desc_raw = catVal;
    if (!rowData.schedule_desc_raw && horVal) rowData.schedule_desc_raw = horVal;
    if (!rowData.locker_raw && locVal) rowData.locker_raw = locVal;
    if (!rowData.observations_raw && obsVal) rowData.observations_raw = obsVal;

    if (hasContent) {
      rawRows.push({ raw: rowData, rowNumber: r });
    }
  }

  if (rawRows.length === 0) {
    throw new Error("No se encontraron registros de datos en la hoja principal.");
  }

  // 5. Parsear cada fila
  const parsedRows = rawRows.map(({ raw, rowNumber }) => {
    const res = parseWorkerRow(raw, rowNumber);
    return {
      raw,
      rowNumber,
      parsed: res.parsed,
      issues: res.issues,
      isValid: res.isValid,
    };
  });

  // 6. Consultar estado existente en base de datos
  const supabase = await createClient();

  const [workersRes, lockersRes, assignmentsRes] = await Promise.all([
    supabase
      .from("union_workers")
      .select(`
        id, employee_number, first_name, paternal_surname, maternal_surname,
        category, assignment, turn, schedule, plaza_code,
        source_name_raw, import_notes, active
      `)
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

  // Mapear asignaciones activas
  const workerLockerMap = new Map<string, { lockerNumber: string; assignmentId: string; lockerId: string }>();
  const lockerWorkerMap = new Map<string, { workerId: string; assignmentId: string }>();

  const lockerById = new Map(dbLockers.map((l) => [l.id, l]));
  const workerById = new Map(dbWorkers.map((w) => [w.id, w]));

  for (const asgn of dbAssignments) {
    const locker = lockerById.get(asgn.locker_id);
    if (locker) {
      workerLockerMap.set(asgn.worker_id, {
        lockerNumber: locker.locker_number,
        assignmentId: asgn.id,
        lockerId: locker.id,
      });
      lockerWorkerMap.set(locker.id, {
        workerId: asgn.worker_id,
        assignmentId: asgn.id,
      });
    }
  }

  const existingWorkersMap = new Map<string, ExistingWorkerRecord>();
  for (const w of dbWorkers) {
    const asgn = workerLockerMap.get(w.id);
    existingWorkersMap.set(w.employee_number, {
      ...w,
      active_locker_number: asgn?.lockerNumber ?? null,
      active_assignment_id: asgn?.assignmentId ?? null,
    });
  }

  const existingLockersMap = new Map<string, ExistingLockerRecord>();
  for (const l of dbLockers) {
    const asgn = lockerWorkerMap.get(l.id);
    const worker = asgn ? workerById.get(asgn.workerId) : null;
    existingLockersMap.set(l.locker_number, {
      id: l.id,
      locker_number: l.locker_number,
      status: l.status,
      active_worker_id: asgn?.workerId ?? null,
      active_worker_matricula: worker?.employee_number ?? null,
      active_worker_name: worker ? `${worker.paternal_surname} ${worker.first_name}`.trim() : null,
      active_assignment_id: asgn?.assignmentId ?? null,
    });
  }

  // 7. Conciliación y detección de conflictos
  const analyzedRows = detectConflictsAndDiff(
    parsedRows.map((p) => ({
      parsed: p.parsed,
      issues: p.issues,
      isValid: p.isValid,
      rowNumber: p.rowNumber,
    })),
    existingWorkersMap,
    existingLockersMap
  );

  // 8. Identificar ausentes en el archivo
  const fileMatriculas = new Set(
    parsedRows.map((p) => p.parsed.matricula).filter(Boolean)
  );

  const missingWorkers = dbWorkers
    .filter((w) => w.active && !fileMatriculas.has(w.employee_number))
    .map((w) => {
      const asgn = workerLockerMap.get(w.id);
      return {
        id: w.id,
        employee_number: w.employee_number,
        full_name: `${w.paternal_surname || ""} ${w.maternal_surname || ""} ${w.first_name || ""}`.trim(),
        category: w.category,
        department: w.assignment,
        locker: asgn?.lockerNumber,
      };
    });

  // 9. Calcular métricas exactas
  let validWorkers = 0;
  let newWorkers = 0;
  let updatedWorkers = 0;
  let unchangedWorkers = 0;
  let duplicateMatriculas = 0;
  let missingMatricula = 0;
  let lockersDetected = 0;
  let newLockers = 0;
  let lockerChanges = 0;
  let duplicateLockers = 0;
  let conflicts = 0;
  let ignoredRows = 0;

  const seenDbLockers = new Set(dbLockers.map((l) => l.locker_number));
  const detectedLockersSet = new Set<string>();

  for (const a of analyzedRows) {
    if (a.status === "ignored") {
      ignoredRows++;
      continue;
    }

    if (!a.parsed.matricula) {
      missingMatricula++;
    } else {
      validWorkers++;
    }

    if (a.status === "new") newWorkers++;
    else if (a.status === "updated") updatedWorkers++;
    else if (a.status === "unchanged") unchangedWorkers++;
    else if (a.status === "conflict") conflicts++;

    for (const iss of a.issues) {
      if (iss.code === "DUPLICATE_MATRICULA_IN_FILE") duplicateMatriculas++;
      if (iss.code === "DUPLICATE_LOCKER_IN_FILE") duplicateLockers++;
    }

    if (a.parsed.locker && !a.parsed.is_semantic_locker) {
      lockersDetected++;
      detectedLockersSet.add(a.parsed.locker);
      if (!seenDbLockers.has(a.parsed.locker)) {
        newLockers++;
        seenDbLockers.add(a.parsed.locker); // Contar una vez por casillero nuevo
      }
    }

    if (a.diff?.lockerChange?.action === "change_assignment") {
      lockerChanges++;
    }
  }

  const summary: ImportSummary = {
    totalRows: analyzedRows.length,
    validWorkers,
    newWorkers,
    updatedWorkers,
    unchangedWorkers,
    duplicateMatriculas,
    missingMatricula,
    lockersDetected,
    newLockers,
    lockerChanges,
    duplicateLockers,
    conflicts,
    ignoredRows,
    missingInFileCount: missingWorkers.length,
    hasSupplementarySheet,
    supplementarySheetRows,
    // Métricas compatibles
    newCount: newWorkers,
    updatedCount: updatedWorkers,
    unchangedCount: unchangedWorkers,
    warningsCount: analyzedRows.filter((r) => r.status === "warning").length,
    invalidCount: missingMatricula,
    conflictsCount: conflicts,
  };

  // 10. Crear lote en union_worker_import_batches
  const { data: batch, error: batchError } = await supabase
    .from("union_worker_import_batches")
    .insert({
      delegation_id: delegationId,
      imported_by: params.userId,
      file_name: fileName,
      file_size_bytes: fileBuffer.length,
      file_sha256: security.sha256,
      format_version: "UNION_MASTER_LOCKERS_V1",
      status: "preview",
      total_rows: summary.totalRows,
      new_workers_count: summary.newWorkers ?? 0,
      updated_workers_count: summary.updatedWorkers ?? 0,
      unchanged_workers_count: summary.unchangedWorkers ?? 0,
      conflicts_count: summary.conflicts ?? 0,
      invalid_rows_count: summary.missingMatricula ?? 0,
      new_lockers_count: summary.newLockers ?? 0,
      locker_changes_count: summary.lockerChanges ?? 0,
      summary_metadata: {
        hasSupplementarySheet,
        supplementarySheetRows,
        duplicateMatriculas,
        duplicateLockers,
        missingInFileCount: missingWorkers.length,
        unrepresentedWorkers: 0,
        duplicatePlazas: 0,
        detectedReentries: 0,
      } as unknown as Json,
    })
    .select("id")
    .single();

  if (batchError || !batch) {
    throw new Error(`Error al registrar lote maestro: ${batchError?.message}`);
  }

  const batchId = batch.id;

  // 11. Insertar filas en union_worker_import_rows
  const stagingRows = analyzedRows.map((a, idx) => {
    const rawData = parsedRows[idx]?.raw ?? {};
    const rowStatus = a.status;
    const actionTaken: "pending" | "applied" | "skipped" | "conflict_hold" =
      rowStatus === "conflict"
        ? "conflict_hold"
        : rowStatus === "ignored" || rowStatus === "invalid"
        ? "skipped"
        : "pending";

    return {
      batch_id: batchId,
      row_number: a.rowNumber,
      matricula: a.parsed.matricula || `ROW_${a.rowNumber}`,
      full_name: a.parsed.source_name_raw || a.parsed.siap_full_name || "",
      raw_data: (rawData as unknown) as Json,
      parsed_data: (a.parsed as unknown) as Json,
      row_status: rowStatus,
      action_taken: actionTaken,
      diff: ((a.diff ?? {}) as unknown) as Json,
      issues: (a.issues as unknown) as Json,
      target_worker_id: existingWorkersMap.get(a.parsed.matricula)?.id ?? null,
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
      throw new Error(`Error al guardar filas de importación: ${chunkError.message}`);
    }
  }

  // 12. Generar preview rows
  const previewRows: PreviewRow[] = analyzedRows.map((a) => {
    const existing = existingWorkersMap.get(a.parsed.matricula);
    return {
      rowNumber: a.rowNumber,
      matricula: a.parsed.matricula,
      fullName: a.parsed.source_name_raw || a.parsed.siap_full_name || "",
      category: a.parsed.position_description,
      department: a.parsed.department_description,
      plaza: a.parsed.plaza_code,
      turn: a.parsed.turn,
      schedule: a.parsed.schedule_description,
      lockerCurrent: existing?.active_locker_number ?? undefined,
      lockerExcel: a.parsed.locker,
      observations: a.parsed.raw_observations,
      status: a.status,
      issues: a.issues,
      diff: a.diff,
    };
  });

  // 13. Auditoría sanitizada
  await writeAuditLog({
    delegation_id: delegationId,
    entity_type: "union_worker_import_batches",
    entity_id: batchId,
    action: "union_import_previewed",
    metadata: {
      format_version: "UNION_MASTER_LOCKERS_V1",
      total_rows: summary.totalRows,
      new_workers: summary.newWorkers,
      updated_workers: summary.updatedWorkers,
      conflicts: summary.conflicts,
      new_lockers: summary.newLockers,
      locker_changes: summary.lockerChanges,
    },
  });

  return {
    batchId,
    fileName,
    fileSizeBytes: fileBuffer.length,
    fileSha256: security.sha256,
    summary,
    rows: previewRows,
    missingWorkers,
  };
}

export async function applyMasterImportBatch(params: {
  batchId: string;
  delegationId: string;
  userId: string;
  resolutions?: Record<string, unknown>;
}): Promise<ImportConfirmResult> {
  const { batchId, delegationId, resolutions = {} } = params;
  const supabase = await createClient();

  // Ejecución transaccional atómica en PostgreSQL
  const { data, error } = await supabase.rpc("union_apply_master_import", {
    p_batch_id: batchId,
    p_resolutions: resolutions as Json,
  });

  if (error) {
    throw new Error(`Error al aplicar importación: ${error.message}`);
  }

  const res = (data as unknown) as {
    applied_workers: number;
    updated_workers: number;
    unchanged_workers: number;
    new_locker_assignments: number;
    locker_changes: number;
    skipped_conflicts: number;
  };

  await writeAuditLog({
    delegation_id: delegationId,
    entity_type: "union_worker_import_batches",
    entity_id: batchId,
    action: "union_import_applied",
    metadata: {
      format_version: "UNION_MASTER_LOCKERS_V1",
      applied_workers: res.applied_workers,
      updated_workers: res.updated_workers,
      unchanged_workers: res.unchanged_workers,
      new_locker_assignments: res.new_locker_assignments,
      locker_changes: res.locker_changes,
      skipped_conflicts: res.skipped_conflicts,
    },
  });

  return {
    batchId,
    status: "applied",
    appliedCount: res.applied_workers,
    updatedCount: res.updated_workers,
    unchangedCount: res.unchanged_workers,
    newLockersCount: res.new_locker_assignments,
    lockerChangesCount: res.locker_changes,
    missingMarkedCount: 0,
    skippedConflicts: res.skipped_conflicts,
  };
}

export {
  parseAndPreviewLockerImport,
  applyLockerImportBatch,
  rollbackLockerImportBatch,
} from "./locker-importer";
