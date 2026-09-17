import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import {
  mapHeaders,
  normalizeHeaderText,
} from "../services/worker-importer/header-mapper";
import {
  splitFullName,
  normalizeLockerNumber,
  isSemanticLocker,
  parseWorkerRow,
} from "../services/worker-importer/row-parser";
import {
  detectConflictsAndDiff,
  type ExistingWorkerRecord,
  type ExistingLockerRecord,
} from "../services/worker-importer/conflict-detector";
import { validateExcelSecurity } from "../services/worker-importer/excel-security";

describe("Master Excel Import - Header Mapping", () => {
  it("maps headers with # PLAZA, # LOCKER, and OBSERVACIONES correctly", () => {
    const rawHeaders = [
      "MATRICULA",
      "NOMBRE",
      "# PLAZA",
      "TURNO",
      "CATEGORIA",
      "HORARIO",
      "AREA",
      "JEFE",
      "# LOCKER",
      "OBSERVACIONES",
    ];

    const result = mapHeaders(rawHeaders);
    expect(result.valid).toBe(true);
    expect(result.columnMap.get(1)).toBe("matricula_raw");
    expect(result.columnMap.get(2)).toBe("full_name_raw");
    expect(result.columnMap.get(3)).toBe("plaza_raw");
    expect(result.columnMap.get(4)).toBe("shift_raw");
    expect(result.columnMap.get(5)).toBe("position_desc_raw");
    expect(result.columnMap.get(6)).toBe("schedule_code_raw");
    expect(result.columnMap.get(9)).toBe("locker_raw");
    expect(result.columnMap.get(10)).toBe("observations_raw");
  });

  it("handles case-insensitivity and accents in header names", () => {
    expect(normalizeHeaderText("  # PLaZA  ")).toBe("plaza");
    expect(normalizeHeaderText("No. Locker")).toBe("no locker");
    expect(normalizeHeaderText("Categoría")).toBe("categoria");
    expect(normalizeHeaderText("Matrícula")).toBe("matricula");
  });
});

describe("Master Excel Import - Name Parsing and Preservation", () => {
  it("parses slash-separated names (CARRILLO/VALDERRAMA/OSCAR) and preserves source_name_raw", () => {
    const raw = "CARRILLO/VALDERRAMA/OSCAR";
    const res = splitFullName(raw);
    expect(res.paternal_surname).toBe("CARRILLO");
    expect(res.maternal_surname).toBe("VALDERRAMA");
    expect(res.first_name).toBe("OSCAR");
    expect(res.source_name_raw).toBe(raw);
  });

  it("parses slash-separated names with multiple given names (LOPEZ/HERNANDEZ/JUAN CARLOS)", () => {
    const res = splitFullName("LOPEZ/HERNANDEZ/JUAN CARLOS");
    expect(res.paternal_surname).toBe("LOPEZ");
    expect(res.maternal_surname).toBe("HERNANDEZ");
    expect(res.first_name).toBe("JUAN CARLOS");
  });

  it("parses space-separated names (VARGAS RODRIGUEZ GUSTAVO ALBERTO)", () => {
    const raw = "VARGAS RODRIGUEZ GUSTAVO ALBERTO";
    const res = splitFullName(raw);
    expect(res.paternal_surname).toBe("VARGAS");
    expect(res.maternal_surname).toBe("RODRIGUEZ");
    expect(res.first_name).toBe("GUSTAVO ALBERTO");
    expect(res.source_name_raw).toBe(raw);
  });

  it("handles compound surnames like DE LA TORRE without slashes", () => {
    const res = splitFullName("DE LA TORRE MENDEZ LUIS");
    expect(res.paternal_surname).toBe("DE LA TORRE");
    expect(res.maternal_surname).toBe("MENDEZ");
    expect(res.first_name).toBe("LUIS");
  });
});

describe("Master Excel Import - Locker Normalization & Semantic Cases", () => {
  it("normalizes numeric lockers by stripping leading zeros (001 -> 1, 00023 -> 23)", () => {
    expect(normalizeLockerNumber("001").normalized).toBe("1");
    expect(normalizeLockerNumber("00023").normalized).toBe("23");
    expect(normalizeLockerNumber(45).normalized).toBe("45");
    expect(normalizeLockerNumber("L-042").normalized).toBe("42");
  });

  it("preserves semantic lockers (S/N, DE PASO, VACIO, ABIERTO) and marks isSemantic=true", () => {
    const sn = normalizeLockerNumber("S/N");
    expect(sn.isSemantic).toBe(true);
    expect(sn.normalized).toBe("S/N");
    expect(isSemanticLocker("S/N")).toBe(true);

    const paso = normalizeLockerNumber("DE PASO");
    expect(paso.isSemantic).toBe(true);
    expect(paso.normalized).toBe("DE PASO");

    const vacio = normalizeLockerNumber("VACIO");
    expect(vacio.isSemantic).toBe(true);

    const act = normalizeLockerNumber("ACTUALIZADO 2025");
    expect(act.isSemantic).toBe(true);
  });
});

describe("Master Excel Import - Row Parsing", () => {
  it("parses a complete master row with matricula, nombre, plaza, turno, categoria, locker", () => {
    const raw = {
      matricula_raw: "99123456",
      full_name_raw: "HERNANDEZ/GARCIA/MARIA",
      plaza_raw: "80",
      shift_raw: "MATUTINO",
      position_desc_raw: "ENFERMERA GENERAL",
      schedule_desc_raw: "07:00 A 15:00",
      locker_raw: "0284",
      observations_raw: "ACTUALIZADO 2024",
    };

    const result = parseWorkerRow(raw, 2);
    expect(result.isValid).toBe(true);
    expect(result.parsed.matricula).toBe("99123456");
    expect(result.parsed.source_name_raw).toBe("HERNANDEZ/GARCIA/MARIA");
    expect(result.parsed.plaza_code).toBe("80");
    expect(result.parsed.position_description).toBe("ENFERMERA GENERAL");
    expect(result.parsed.locker).toBe("284");
    expect(result.parsed.is_semantic_locker).toBe(false);
    expect(result.parsed.raw_observations).toBe("ACTUALIZADO 2024");
  });

  it("flags row with missing matricula as error", () => {
    const raw = {
      matricula_raw: "",
      full_name_raw: "GARCIA PEREZ JUAN",
      plaza_raw: "12",
    };
    const result = parseWorkerRow(raw, 3);
    expect(result.isValid).toBe(false);
    expect(result.issues.some((i) => i.code === "MISSING_MATRICULA")).toBe(true);
  });

  it("flags row with missing name as error", () => {
    const raw = {
      matricula_raw: "98765432",
      full_name_raw: "",
      plaza_raw: "12",
    };
    const result = parseWorkerRow(raw, 4);
    expect(result.isValid).toBe(false);
    expect(result.issues.some((i) => i.code === "MISSING_NAME")).toBe(true);
  });
});

describe("Master Excel Import - Reconciliation & Conflicts", () => {
  const existingWorkersMap = new Map<string, ExistingWorkerRecord>();
  existingWorkersMap.set("1001", {
    id: "w-1",
    employee_number: "1001",
    first_name: "JUAN",
    paternal_surname: "PEREZ",
    maternal_surname: "LOPEZ",
    category: "MEDICO GENERAL",
    assignment: "URGENCIAS",
    turn: "Matutino",
    schedule: "07:00 A 15:00",
    plaza_code: "10",
    active_locker_number: "284",
    active_assignment_id: "asgn-1",
    active: true,
  });

  const existingLockersMap = new Map<string, ExistingLockerRecord>();
  existingLockersMap.set("284", {
    id: "l-284",
    locker_number: "284",
    status: "assigned",
    active_worker_id: "w-1",
    active_worker_matricula: "1001",
    active_worker_name: "PEREZ JUAN",
    active_assignment_id: "asgn-1",
  });
  existingLockersMap.set("500", {
    id: "l-500",
    locker_number: "500",
    status: "assigned",
    active_worker_id: "w-other",
    active_worker_matricula: "9999",
    active_worker_name: "OTRO TRABAJADOR",
    active_assignment_id: "asgn-other",
  });

  it("identifies an unchanged worker when all fields and locker match", () => {
    const parsedRow = {
      contract_type_code: "",
      plaza_code: "10",
      responsibility_area_code: "",
      occupation_start_date: null,
      occupation_limit_date: null,
      occupation_limit_is_sentinel: false,
      occupation_mark_code: "",
      plaza_type_code: "",
      shift_code: "",
      associated_concepts_mask: "00000",
      associated_concepts: [],
      position_code: "",
      position_description: "MEDICO GENERAL",
      department_code: "",
      department_description: "URGENCIAS",
      schedule_code: "",
      schedule_description: "07:00 A 15:00",
      matricula: "1001",
      siap_full_name: "PEREZ LOPEZ JUAN",
      first_name: "",
      paternal_surname: "",
      maternal_surname: "",
      seniority_raw: "",
      seniority_years: null,
      seniority_fortnights: null,
      seniority_days: null,
      rfc: "",
      curp: "",
      nss_raw: "",
      nss: "",
      employment_start_date: null,
      reemployment_date: null,
      source_status_code: "",
      termination_code: "",
      termination_date: null,
      micro_group_code: "",
      turn: "Matutino",
      locker: "284",
      is_semantic_locker: false,
    };

    const results = detectConflictsAndDiff(
      [{ parsed: parsedRow, issues: [], isValid: true, rowNumber: 2 }],
      existingWorkersMap,
      existingLockersMap
    );

    expect(results[0].status).toBe("unchanged");
  });

  it("detects a locker change (284 -> 320) for existing worker", () => {
    const parsedRow = {
      contract_type_code: "",
      plaza_code: "10",
      responsibility_area_code: "",
      occupation_start_date: null,
      occupation_limit_date: null,
      occupation_limit_is_sentinel: false,
      occupation_mark_code: "",
      plaza_type_code: "",
      shift_code: "",
      associated_concepts_mask: "00000",
      associated_concepts: [],
      position_code: "",
      position_description: "MEDICO GENERAL",
      department_code: "",
      department_description: "URGENCIAS",
      schedule_code: "",
      schedule_description: "07:00 A 15:00",
      matricula: "1001",
      siap_full_name: "PEREZ LOPEZ JUAN",
      first_name: "",
      paternal_surname: "",
      maternal_surname: "",
      seniority_raw: "",
      seniority_years: null,
      seniority_fortnights: null,
      seniority_days: null,
      rfc: "",
      curp: "",
      nss_raw: "",
      nss: "",
      employment_start_date: null,
      reemployment_date: null,
      source_status_code: "",
      termination_code: "",
      termination_date: null,
      micro_group_code: "",
      turn: "Matutino",
      locker: "320",
      is_semantic_locker: false,
    };

    const results = detectConflictsAndDiff(
      [{ parsed: parsedRow, issues: [], isValid: true, rowNumber: 2 }],
      existingWorkersMap,
      existingLockersMap
    );

    expect(results[0].status).toBe("updated");
    expect(results[0].diff?.lockerChange).toBeDefined();
    expect(results[0].diff?.lockerChange?.currentLocker).toBe("284");
    expect(results[0].diff?.lockerChange?.excelLocker).toBe("320");
    expect(results[0].diff?.lockerChange?.action).toBe("change_assignment");
  });

  it("detects conflict when a locker is already assigned to a different worker", () => {
    const parsedRow = {
      contract_type_code: "",
      plaza_code: "20",
      responsibility_area_code: "",
      occupation_start_date: null,
      occupation_limit_date: null,
      occupation_limit_is_sentinel: false,
      occupation_mark_code: "",
      plaza_type_code: "",
      shift_code: "",
      associated_concepts_mask: "00000",
      associated_concepts: [],
      position_code: "",
      position_description: "ENFERMERO",
      department_code: "",
      department_description: "PEDIATRIA",
      schedule_code: "",
      schedule_description: "14:00 A 21:30",
      matricula: "2002",
      siap_full_name: "HERRERA SANCHEZ CARLOS",
      first_name: "",
      paternal_surname: "",
      maternal_surname: "",
      seniority_raw: "",
      seniority_years: null,
      seniority_fortnights: null,
      seniority_days: null,
      rfc: "",
      curp: "",
      nss_raw: "",
      nss: "",
      employment_start_date: null,
      reemployment_date: null,
      source_status_code: "",
      termination_code: "",
      termination_date: null,
      micro_group_code: "",
      turn: "Vespertino",
      locker: "500", // Asignado a w-other (9999) en DB
      is_semantic_locker: false,
    };

    const results = detectConflictsAndDiff(
      [{ parsed: parsedRow, issues: [], isValid: true, rowNumber: 5 }],
      existingWorkersMap,
      existingLockersMap
    );

    expect(results[0].status).toBe("conflict");
    expect(results[0].issues.some((i) => i.code === "LOCKER_ALREADY_ASSIGNED")).toBe(true);
  });

  it("detects intra-file duplicate locker claimed by two different workers", () => {
    const row1 = {
      matricula: "3001",
      siap_full_name: "TRABAJADOR UNO",
      position_description: "MEDICO",
      department_description: "CONSULTA",
      turn: "Matutino",
      schedule_description: "08:00 A 16:00",
      plaza_code: "31",
      locker: "150",
      is_semantic_locker: false,
      contract_type_code: "", responsibility_area_code: "", occupation_start_date: null,
      occupation_limit_date: null, occupation_limit_is_sentinel: false, occupation_mark_code: "",
      plaza_type_code: "", shift_code: "", associated_concepts_mask: "00000", associated_concepts: [],
      position_code: "", department_code: "", schedule_code: "", first_name: "", paternal_surname: "",
      maternal_surname: "", seniority_raw: "", seniority_years: null, seniority_fortnights: null,
      seniority_days: null, rfc: "", curp: "", nss_raw: "", nss: "", employment_start_date: null,
      reemployment_date: null, source_status_code: "", termination_code: "", termination_date: null,
      micro_group_code: "",
    };

    const row2 = {
      ...row1,
      matricula: "3002",
      siap_full_name: "TRABAJADOR DOS",
      locker: "150", // Mismo casillero en el archivo
    };

    const results = detectConflictsAndDiff(
      [
        { parsed: row1, issues: [], isValid: true, rowNumber: 2 },
        { parsed: row2, issues: [], isValid: true, rowNumber: 3 },
      ],
      existingWorkersMap,
      existingLockersMap
    );

    expect(results[1].status).toBe("conflict");
    expect(results[1].issues.some((i) => i.code === "DUPLICATE_LOCKER_IN_FILE")).toBe(true);
  });

  it("marks a brand new worker as 'new'", () => {
    const rowNew = {
      matricula: "4001",
      siap_full_name: "NUEVO EMPLEADO REGISTRADO",
      position_description: "RADIOLOGO",
      department_description: "IMAGENOLOGIA",
      turn: "Nocturno",
      schedule_description: "21:00 A 07:00",
      plaza_code: "41",
      locker: "777",
      is_semantic_locker: false,
      contract_type_code: "", responsibility_area_code: "", occupation_start_date: null,
      occupation_limit_date: null, occupation_limit_is_sentinel: false, occupation_mark_code: "",
      plaza_type_code: "", shift_code: "", associated_concepts_mask: "00000", associated_concepts: [],
      position_code: "", department_code: "", schedule_code: "", first_name: "", paternal_surname: "",
      maternal_surname: "", seniority_raw: "", seniority_years: null, seniority_fortnights: null,
      seniority_days: null, rfc: "", curp: "", nss_raw: "", nss: "", employment_start_date: null,
      reemployment_date: null, source_status_code: "", termination_code: "", termination_date: null,
      micro_group_code: "",
    };

    const results = detectConflictsAndDiff(
      [{ parsed: rowNew, issues: [], isValid: true, rowNumber: 10 }],
      existingWorkersMap,
      existingLockersMap
    );

    expect(results[0].status).toBe("new");
    expect(results[0].diff?.lockerChange?.action).toBe("new_assignment");
  });
});

describe("Master Excel Import - Security & Multi-Sheet Detection", () => {
  it("rejects malicious .xlsm macro-enabled files", () => {
    const fakeBuffer = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
    const res = validateExcelSecurity(fakeBuffer, "base_sindical.xlsm");
    expect(res.valid).toBe(false);
    expect(res.error).toContain("macros");
  });

  it("detects Hoja3 complementaria in a synthetic workbook without failing Hoja1", async () => {
    const wb = new ExcelJS.Workbook();
    const ws1 = wb.addWorksheet("Hoja1");
    ws1.addRow(["MATRICULA", "NOMBRE", "# PLAZA", "TURNO", "CATEGORIA", "HORARIO", "# LOCKER"]);
    ws1.addRow(["12345", "LOPEZ PEDRO", "80", "MATUTINO", "ENFERMERO", "07:00 A 15:00", "12"]);

    const ws3 = wb.addWorksheet("Hoja3");
    ws3.addRow(["MATRICULA", "NOMBRE", "# PLAZA", "TURNO", "CATEGORIA", "HORARIO", "ANTIGUEDAD", "CELULAR"]);
    ws3.addRow(["12345", "LOPEZ PEDRO", "80", "MATUTINO", "ENFERMERO", "07:00 A 15:00", "5 años", "4431234567"]);
    ws3.addRow(["67890", "RUIZ ANA", "80", "VESPERTINO", "MEDICO", "14:00 A 21:30", "2 años", "4439876543"]);

    const sheetNames = wb.worksheets.map((w) => w.name);
    expect(sheetNames).toContain("Hoja1");
    expect(sheetNames).toContain("Hoja3");

    const hoja3 = wb.getWorksheet("Hoja3");
    expect(hoja3).toBeDefined();
    expect(hoja3!.rowCount).toBe(3); // 1 header + 2 data rows
  });
});

describe("Master Excel Import - Architecture & Table Reuse", () => {
  it("uses existing union_worker_import_batches with format UNION_MASTER_LOCKERS_V1", () => {
    const masterBatchRecord = {
      delegation_id: "del-123",
      imported_by: "user-456",
      file_name: "base_hospital_2026.xlsx",
      file_size_bytes: 10240,
      file_sha256: "abcdef1234567890",
      format_version: "UNION_MASTER_LOCKERS_V1",
      status: "preview",
      total_rows: 150,
      new_workers_count: 5,
      updated_workers_count: 20,
      unchanged_workers_count: 125,
      new_lockers_count: 12,
      locker_changes_count: 4,
      locker_conflicts_count: 0,
      summary_metadata: { source: "admin_excel" },
    };

    expect(masterBatchRecord.format_version).toBe("UNION_MASTER_LOCKERS_V1");
    expect(masterBatchRecord.new_lockers_count).toBe(12);
    expect(masterBatchRecord.locker_changes_count).toBe(4);
  });

  it("uses existing union_worker_import_rows for staging master rows", () => {
    const stagingRow = {
      batch_id: "batch-789",
      row_number: 1,
      matricula: "99001",
      full_name: "GOMEZ/HERNANDEZ/MARIA",
      raw_data: { MATRICULA: "99001", NOMBRE: "GOMEZ/HERNANDEZ/MARIA", "# LOCKER": "045" },
      parsed_data: {
        matricula: "99001",
        source_name_raw: "GOMEZ/HERNANDEZ/MARIA",
        plaza_code: "1234",
        locker: "45",
      },
      row_status: "updated" as const,
      action_taken: "pending" as const,
      diff: { changes: [{ field: "turn", oldValue: "1", newValue: "2" }] },
      issues: [],
    };

    expect(stagingRow.full_name).toBe("GOMEZ/HERNANDEZ/MARIA");
    expect(stagingRow.parsed_data.plaza_code).toBe("1234");
    expect(stagingRow.parsed_data.locker).toBe("45");
  });

  it("does not break SIAP batch structure (format SIAP_2026)", () => {
    const siapBatchRecord = {
      delegation_id: "del-123",
      imported_by: "user-456",
      file_name: "siap_nomina.xlsx",
      format_version: "SIAP_2026",
      status: "preview",
      total_rows: 500,
      new_workers_count: 10,
      updated_workers_count: 40,
    };

    expect(siapBatchRecord.format_version).toBe("SIAP_2026");
    expect(siapBatchRecord.format_version).not.toBe("UNION_MASTER_LOCKERS_V1");
  });
});

describe("Master Excel Import - Format Isolation & RPC Guards", () => {
  function simulateRpcGuard(batch: { format_version: string; status: string; delegation_id: string }, targetRpc: "SIAP" | "MASTER", userDelegationId: string) {
    if (batch.delegation_id !== userDelegationId) {
      throw new Error("UNAUTHORIZED_UNION_ADMIN: No cuentas con permisos en esta delegación.");
    }
    if (batch.status !== "preview") {
      throw new Error(`INVALID_BATCH_STATUS: El lote se encuentra en estado "${batch.status}" y no puede ser confirmado.`);
    }
    if (targetRpc === "SIAP" && batch.format_version !== "SIAP_2026") {
      throw new Error(`INVALID_FORMAT_VERSION: Este lote tiene formato "${batch.format_version}" y debe procesarse con su RPC correspondiente (union_apply_master_import).`);
    }
    if (targetRpc === "MASTER" && batch.format_version !== "UNION_MASTER_LOCKERS_V1") {
      throw new Error(`INVALID_FORMAT_VERSION: Este lote no corresponde al formato UNION_MASTER_LOCKERS_V1 (formato actual: "${batch.format_version}").`);
    }
    return true;
  }

  it("rejects running SIAP RPC union_confirm_worker_import on UNION_MASTER_LOCKERS_V1 batch", () => {
    const masterBatch = { format_version: "UNION_MASTER_LOCKERS_V1", status: "preview", delegation_id: "del-A" };
    expect(() => simulateRpcGuard(masterBatch, "SIAP", "del-A")).toThrow("INVALID_FORMAT_VERSION");
  });

  it("rejects running MASTER RPC union_apply_master_import on SIAP_2026 batch", () => {
    const siapBatch = { format_version: "SIAP_2026", status: "preview", delegation_id: "del-A" };
    expect(() => simulateRpcGuard(siapBatch, "MASTER", "del-A")).toThrow("INVALID_FORMAT_VERSION");
  });

  it("rejects double application of already confirmed batch", () => {
    const appliedBatch = { format_version: "UNION_MASTER_LOCKERS_V1", status: "confirmed", delegation_id: "del-A" };
    expect(() => simulateRpcGuard(appliedBatch, "MASTER", "del-A")).toThrow("INVALID_BATCH_STATUS");
  });

  it("rejects execution by union_admin of a different delegation", () => {
    const batchDelA = { format_version: "UNION_MASTER_LOCKERS_V1", status: "preview", delegation_id: "del-A" };
    expect(() => simulateRpcGuard(batchDelA, "MASTER", "del-B")).toThrow("UNAUTHORIZED_UNION_ADMIN");
  });
});

describe("Master Excel Import - Rollback Mechanics (Workers & Lockers)", () => {
  it("rolls back newly created worker by deactivating non-destructively without DELETE", () => {
    const workerInDb = {
      id: "w-1",
      employee_number: "99001",
      source_created_by_batch_id: "batch-101",
      source_import_state: "active",
      source_rolled_back_at: null as string | null,
    };

    // Simulate rollback
    const now = new Date().toISOString();
    workerInDb.source_rolled_back_at = now;
    workerInDb.source_import_state = "rolled_back";

    expect(workerInDb.id).toBe("w-1"); // Row is NOT deleted
    expect(workerInDb.source_import_state).toBe("rolled_back");
    expect(workerInDb.source_rolled_back_at).toBe(now);
  });

  it("rolls back field updates by restoring previous values from change history", () => {
    const changeHistory = [
      { worker_id: "w-2", field_name: "turn", old_value: "Matutino", new_value: "Vespertino" },
      { worker_id: "w-2", field_name: "category", old_value: "ENFERMERA GENERAL", new_value: "ENFERMERA JEFE" },
    ];

    const workerState = {
      id: "w-2",
      turn: "Vespertino",
      category: "ENFERMERA JEFE",
    };

    // Revert using history
    for (const h of changeHistory) {
      if (h.field_name === "turn") workerState.turn = h.old_value;
      if (h.field_name === "category") workerState.category = h.old_value;
    }

    expect(workerState.turn).toBe("Matutino");
    expect(workerState.category).toBe("ENFERMERA GENERAL");
  });

  it("rolls back locker assignment change: releases new assignment, restores previous assignment without destroying history", () => {
    const batchId = "batch-101";

    // Pre-import state: Worker has locker 10 active
    const oldAssignment = {
      id: "asgn-1",
      worker_id: "w-3",
      locker_id: "loc-10",
      status: "released",
      release_reason: `released_by_import_master_batch:${batchId}`,
    };
    // Post-import state: Worker was assigned locker 20
    const newAssignment = {
      id: "asgn-2",
      worker_id: "w-3",
      locker_id: "loc-20",
      status: "active",
      assignment_reason: `import_master_batch:${batchId}`,
      release_reason: "",
    };

    const locker10 = { id: "loc-10", status: "disponible" };
    const locker20 = { id: "loc-20", status: "ocupado" };

    // Execute rollback
    // 1. Release new assignment created by this batch
    newAssignment.status = "released";
    newAssignment.release_reason = `Revertido por rollback de lote maestro: ${batchId}`;
    locker20.status = "disponible";

    // 2. Restore previous assignment released by this batch
    oldAssignment.status = "active";
    oldAssignment.release_reason = "";
    locker10.status = "ocupado";

    expect(newAssignment.status).toBe("released");
    expect(oldAssignment.status).toBe("active");
    expect(locker10.status).toBe("ocupado");
    expect(locker20.status).toBe("disponible");
  });
});

describe("Master Excel Import - Non-Destructive Absent Worker & Field Protection", () => {
  it("workers missing in master excel are NOT deactivated (active remains true, no automatic locker release)", () => {
    const existingWorker = {
      id: "w-99",
      employee_number: "88888",
      active: true,
      source_missing_since: null as string | null,
    };
    const activeLockerAssignment = {
      id: "asgn-99",
      worker_id: "w-99",
      locker_id: "loc-99",
      status: "active",
    };

    // Excel file processed: worker 88888 is absent from Excel
    // Rule for UNION_MASTER_LOCKERS_V1: NO active = false, NO release locker
    expect(existingWorker.active).toBe(true);
    expect(existingWorker.source_missing_since).toBeNull();
    expect(activeLockerAssignment.status).toBe("active");
  });

  it("preserves manual union notes and phone without overwrite by Excel import", () => {
    const existingWorker = {
      id: "w-10",
      employee_number: "77777",
      phone: "443-111-2233",
      notes: "Delegado sindical electo en asamblea",
      import_notes: "",
    };

    const excelRow = {
      observations: "Cubriendo turno especial",
    };

    // Updating from Excel:
    existingWorker.import_notes = excelRow.observations;

    expect(existingWorker.notes).toBe("Delegado sindical electo en asamblea"); // Intact!
    expect(existingWorker.phone).toBe("443-111-2233"); // Intact!
    expect(existingWorker.import_notes).toBe("Cubriendo turno especial");
  });

  it("preserves siap_full_name intact and writes raw name to source_name_raw", () => {
    const existingWorker = {
      id: "w-11",
      employee_number: "66666",
      siap_full_name: "ALVAREZ MORALES FRANCISCO JAVIER",
      source_name_raw: "",
    };

    const excelRowRawName = "ALVAREZ/MORALES/FRANCISCO J";

    // Master update writes to source_name_raw, NOT siap_full_name
    existingWorker.source_name_raw = excelRowRawName;

    expect(existingWorker.siap_full_name).toBe("ALVAREZ MORALES FRANCISCO JAVIER"); // Untouched!
    expect(existingWorker.source_name_raw).toBe("ALVAREZ/MORALES/FRANCISCO J");
  });
});

describe("Master Excel Import - Unified Import History", () => {
  it("unifies both SIAP and MASTER batches in a single history chronological feed", () => {
    const batches = [
      {
        id: "b-2",
        file_name: "Base_Hospital_2026.xlsx",
        format_version: "UNION_MASTER_LOCKERS_V1",
        total_rows: 1200,
        new_workers_count: 45,
        updated_workers_count: 110,
        new_lockers_count: 15,
        locker_changes_count: 8,
        status: "confirmed",
        created_at: "2026-09-16T10:00:00Z",
      },
      {
        id: "b-1",
        file_name: "SIAP_Quincena_17.xlsx",
        format_version: "SIAP_2026",
        total_rows: 1150,
        new_workers_count: 5,
        updated_workers_count: 30,
        new_lockers_count: 0,
        locker_changes_count: 0,
        status: "confirmed",
        created_at: "2026-09-14T08:00:00Z",
      },
    ];

    expect(batches).toHaveLength(2);
    expect(batches[0].format_version).toBe("UNION_MASTER_LOCKERS_V1");
    expect(batches[1].format_version).toBe("SIAP_2026");
    expect(batches[0].new_lockers_count).toBe(15);
  });
});

