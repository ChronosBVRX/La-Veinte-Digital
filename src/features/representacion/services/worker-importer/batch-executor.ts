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
      row_status: a.status,
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

  // Reversión no destructiva en PostgreSQL (cero DELETE FROM union_workers)
  const { data, error } = await supabase.rpc("union_rollback_worker_import", {
    p_batch_id: batchId,
  });

  if (error) {
    throw new Error(`Error al revertir la importación: ${error.message}`);
  }

  const result = data as {
    restored_fields_count: number;
    deactivated_workers_count: number;
  };

  await writeAuditLog({
    delegation_id: delegationId,
    entity_type: "union_worker_import_batches",
    entity_id: batchId,
    action: "rollback_import_batch",
    metadata: {
      restored_fields_count: result.restored_fields_count,
      deactivated_workers_count: result.deactivated_workers_count,
    },
  });

  return {
    batchId,
    status: "rolled_back",
    restoredFieldsCount: result.restored_fields_count,
    deactivatedWorkersCount: result.deactivated_workers_count,
    deletedWorkersCount: 0,
  };
}
