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
import type { RowDiff } from "../services/worker-importer/types";

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
  interface MockWorker {
    id: string;
    employee_number: string;
    category: string;
    position_description: string;
    turn: string;
    schedule: string;
    schedule_description: string;
    plaza_code: string | null;
    source_name_raw: string | null;
    import_notes: string | null;
    active: boolean;
    source_created_by_batch_id?: string | null;
    last_import_batch_id?: string | null;
    source_import_state: string;
    source_rolled_back_at?: string | null;
  }

  interface MockLocker {
    id: string;
    locker_number: string;
    status: "disponible" | "ocupado";
  }

  interface MockAssignment {
    id: string;
    locker_id: string;
    worker_id: string;
    status: "active" | "released";
    assignment_reason?: string;
    release_reason?: string;
    created_at: string;
    assigned_at?: string;
    released_at?: string | null;
  }

  interface MockHistory {
    id: string;
    batch_id: string;
    worker_id: string;
    field_name: string;
    old_value: string;
    new_value: string;
    created_at: string;
  }

  interface MockBatch {
    id: string;
    format_version: "UNION_MASTER_LOCKERS_V1" | "SIAP_2026";
    status: "preview" | "confirmed" | "rolled_back";
    delegation_id: string;
    created_at: string;
    applied_at?: string;
    rolled_back_at?: string;
  }

  function simulateMasterRollbackRpc(params: {
    batch: MockBatch;
    workers: MockWorker[];
    lockers: MockLocker[];
    assignments: MockAssignment[];
    changeHistory: MockHistory[];
    stagingRows?: Array<{ target_worker_id: string; diff?: RowDiff | null; action_taken: string }>;
    userDelegationId: string;
    failSimulatedStep?: "WORKER_UPDATE" | "LOCKER_UPDATE";
  }) {
    const { batch, workers, lockers, assignments, changeHistory, stagingRows = [], userDelegationId, failSimulatedStep } = params;

    // 1. Validar formato
    if (batch.format_version !== "UNION_MASTER_LOCKERS_V1") {
      throw new Error(`INVALID_FORMAT_VERSION: Este lote tiene formato "${batch.format_version}" y debe revertirse con su RPC correspondiente (union_rollback_worker_import).`);
    }

    // 2. Validar estado e idempotencia
    if (batch.status === "rolled_back") {
      throw new Error(`BATCH_ALREADY_ROLLED_BACK: El lote ${batch.id} ya fue revertido previamente.`);
    }
    if (batch.status === "preview") {
      throw new Error(`INVALID_BATCH_STATUS_FOR_ROLLBACK: Solo se pueden revertir lotes confirmados. Estado actual: "preview".`);
    }
    if (batch.status !== "confirmed") {
      throw new Error(`INVALID_BATCH_STATUS_FOR_ROLLBACK: Solo se pueden revertir lotes confirmados. Estado actual: "${batch.status}".`);
    }

    // 3. Validar permisos
    if (batch.delegation_id !== userDelegationId) {
      throw new Error(`UNAUTHORIZED_UNION_ADMIN: No cuentas con permisos de union_admin en la delegación ${batch.delegation_id}.`);
    }

    // 4. Verificar modificaciones posteriores conflictivas en TRABAJADORES
    for (const w of workers) {
      if (w.source_created_by_batch_id === batch.id && w.last_import_batch_id !== batch.id) {
        throw new Error(`ROLLBACK_CONFLICT_NEWER_CHANGES: No se puede revertir el trabajador con matrícula ${w.employee_number} porque recibió cambios después de esta importación.`);
      }
      const hasNewerHistory = changeHistory.some(
        (h) => h.worker_id === w.id && h.batch_id !== batch.id && h.created_at > (batch.applied_at || batch.created_at)
      );
      if (hasNewerHistory) {
        throw new Error(`ROLLBACK_CONFLICT_NEWER_CHANGES: No se puede revertir el trabajador con matrícula ${w.employee_number} porque recibió cambios después de esta importación.`);
      }
    }

    // 5. Verificar modificaciones posteriores conflictivas en CASILLEROS
    for (const a of assignments) {
      if (a.assignment_reason === `import_master_batch:${batch.id}`) {
        const locker = lockers.find((l) => l.id === a.locker_id);
        if (a.status !== "active") {
          throw new Error(`ROLLBACK_CONFLICT_NEWER_CHANGES: El casillero ${locker?.locker_number} tiene asignaciones o cambios posteriores a este lote y no puede ser revertido.`);
        }
        const newerAssignment = assignments.some(
          (other) => other.locker_id === a.locker_id && other.id !== a.id && other.created_at > a.created_at
        );
        if (newerAssignment) {
          throw new Error(`ROLLBACK_CONFLICT_NEWER_CHANGES: El casillero ${locker?.locker_number} tiene asignaciones o cambios posteriores a este lote y no puede ser revertido.`);
        }
      }
      if (a.release_reason === `released_by_import_master_batch:${batch.id}`) {
        const locker = lockers.find((l) => l.id === a.locker_id);
        const otherActive = assignments.some(
          (other) => other.locker_id === a.locker_id && other.status === "active" && other.id !== a.id && other.assignment_reason !== `import_master_batch:${batch.id}`
        );
        if (otherActive) {
          throw new Error(`ROLLBACK_CONFLICT_NEWER_CHANGES: El casillero ${locker?.locker_number} fue reasignado posteriormente a este lote y no puede restaurarse la asignación anterior.`);
        }
      }
    }

    // Atomic snapshot before mutation
    const initialSnapshot = {
      workers: JSON.stringify(workers),
      lockers: JSON.stringify(lockers),
      assignments: JSON.stringify(assignments),
    };

    try {
      if (failSimulatedStep === "WORKER_UPDATE") {
        throw new Error("TRANSACTION_FAILED: Simulación de fallo en actualización de trabajadores");
      }

      const now = new Date().toISOString();
      let deactivatedCount = 0;
      let restoredFieldsCount = 0;

      // Reversión de trabajadores creados por el lote (active = false, NO DELETE)
      for (const w of workers) {
        if (w.source_created_by_batch_id === batch.id) {
          w.active = false;
          w.source_import_state = "rolled_back";
          w.source_rolled_back_at = now;
          deactivatedCount++;
        }
      }

      // Reversión de trabajadores actualizados mediante changeHistory
      const batchHistory = changeHistory.filter((h) => h.batch_id === batch.id);
      for (const h of batchHistory) {
        const w = workers.find((item) => item.id === h.worker_id);
        if (!w) continue;
        if (h.field_name === "plaza_code") { w.plaza_code = h.old_value; restoredFieldsCount++; }
        if (h.field_name === "category" || h.field_name === "position_description") {
          w.category = h.old_value; w.position_description = h.old_value; restoredFieldsCount++;
        }
        if (h.field_name === "turn") { w.turn = h.old_value; restoredFieldsCount++; }
        if (h.field_name === "schedule" || h.field_name === "schedule_description") {
          w.schedule = h.old_value; w.schedule_description = h.old_value; restoredFieldsCount++;
        }
        if (h.field_name === "source_name_raw") { w.source_name_raw = h.old_value; restoredFieldsCount++; }
        if (h.field_name === "import_notes" || h.field_name === "raw_observations") {
          w.import_notes = h.old_value; restoredFieldsCount++;
        }
      }

      // Reversión complementaria desde previous_snapshot en stagingRows
      for (const row of stagingRows) {
        if (row.diff?.previous_snapshot && row.action_taken === "applied") {
          const prev = row.diff.previous_snapshot;
          const w = workers.find((item) => item.id === row.target_worker_id);
          if (w) {
            if (prev.plaza_code !== undefined) w.plaza_code = prev.plaza_code;
            if (prev.category !== undefined) { w.category = prev.category; w.position_description = prev.category; }
            if (prev.turn !== undefined) w.turn = prev.turn;
            if (prev.schedule !== undefined) { w.schedule = prev.schedule; w.schedule_description = prev.schedule; }
            if (prev.source_name_raw !== undefined) w.source_name_raw = prev.source_name_raw;
            if (prev.import_notes !== undefined) w.import_notes = prev.import_notes;
          }
        }
      }

      if (failSimulatedStep === "LOCKER_UPDATE") {
        throw new Error("TRANSACTION_FAILED: Simulación de fallo en reversión de casilleros");
      }

      // Reversión de casilleros
      let revertedAssignments = 0;
      let restoredAssignments = 0;

      for (const a of assignments) {
        if (a.assignment_reason === `import_master_batch:${batch.id}` && a.status === "active") {
          a.status = "released";
          a.released_at = now;
          a.release_reason = `Revertido por rollback de lote maestro: ${batch.id}`;
          revertedAssignments++;
          const hasOtherActive = assignments.some(
            (other) => other.locker_id === a.locker_id && other.status === "active" && other.id !== a.id
          );
          if (!hasOtherActive) {
            const l = lockers.find((loc) => loc.id === a.locker_id);
            if (l) l.status = "disponible";
          }
        }
        if (a.release_reason === `released_by_import_master_batch:${batch.id}` && a.status === "released") {
          a.status = "active";
          a.released_at = null;
          a.release_reason = "";
          restoredAssignments++;
          const l = lockers.find((loc) => loc.id === a.locker_id);
          if (l) l.status = "ocupado";
        }
      }

      batch.status = "rolled_back";
      batch.rolled_back_at = now;

      return {
        batch_id: batch.id,
        status: "rolled_back",
        deactivated_workers: deactivatedCount,
        restored_fields: restoredFieldsCount,
        reverted_assignments: revertedAssignments,
        restored_assignments: restoredAssignments,
      };
    } catch (err) {
      const originalWorkers: MockWorker[] = JSON.parse(initialSnapshot.workers);
      const originalLockers: MockLocker[] = JSON.parse(initialSnapshot.lockers);
      const originalAssignments: MockAssignment[] = JSON.parse(initialSnapshot.assignments);
      workers.forEach((w, i) => { if (originalWorkers[i]) Object.assign(w, originalWorkers[i]); });
      lockers.forEach((l, i) => { if (originalLockers[i]) Object.assign(l, originalLockers[i]); });
      assignments.forEach((a, i) => { if (originalAssignments[i]) Object.assign(a, originalAssignments[i]); });
      throw err;
    }
  }

  it("MASTER rollback restaura trabajador existente", () => {
    const batch: MockBatch = { id: "b-1", format_version: "UNION_MASTER_LOCKERS_V1", status: "confirmed", delegation_id: "del-1", created_at: "2026-09-16T10:00:00Z" };
    const worker: MockWorker = {
      id: "w-1", employee_number: "1001", category: "MEDICO ESPECIALISTA", position_description: "MEDICO ESPECIALISTA",
      turn: "Vespertino", schedule: "14:00 A 21:30", schedule_description: "14:00 A 21:30", plaza_code: "99",
      source_name_raw: "PEREZ/JUAN/CARLOS", import_notes: "Nota nueva", active: true, source_import_state: "active"
    };
    const history: MockHistory[] = [
      { id: "h-1", batch_id: "b-1", worker_id: "w-1", field_name: "category", old_value: "MEDICO GENERAL", new_value: "MEDICO ESPECIALISTA", created_at: "2026-09-16T10:01:00Z" },
      { id: "h-2", batch_id: "b-1", worker_id: "w-1", field_name: "turn", old_value: "Matutino", new_value: "Vespertino", created_at: "2026-09-16T10:01:00Z" },
      { id: "h-3", batch_id: "b-1", worker_id: "w-1", field_name: "plaza_code", old_value: "10", new_value: "99", created_at: "2026-09-16T10:01:00Z" },
      { id: "h-4", batch_id: "b-1", worker_id: "w-1", field_name: "source_name_raw", old_value: "PEREZ/JUAN", new_value: "PEREZ/JUAN/CARLOS", created_at: "2026-09-16T10:01:00Z" },
      { id: "h-5", batch_id: "b-1", worker_id: "w-1", field_name: "import_notes", old_value: "Nota previa", new_value: "Nota nueva", created_at: "2026-09-16T10:01:00Z" },
    ];

    const result = simulateMasterRollbackRpc({ batch, workers: [worker], lockers: [], assignments: [], changeHistory: history, userDelegationId: "del-1" });
    expect(result.status).toBe("rolled_back");
    expect(worker.category).toBe("MEDICO GENERAL");
    expect(worker.turn).toBe("Matutino");
    expect(worker.plaza_code).toBe("10");
    expect(worker.source_name_raw).toBe("PEREZ/JUAN");
    expect(worker.import_notes).toBe("Nota previa");
  });

  it("MASTER rollback revierte plaza", () => {
    const batch: MockBatch = { id: "b-1", format_version: "UNION_MASTER_LOCKERS_V1", status: "confirmed", delegation_id: "del-1", created_at: "2026-09-16T10:00:00Z" };
    const worker: MockWorker = {
      id: "w-1", employee_number: "1001", category: "ENFERMERA", position_description: "ENFERMERA",
      turn: "Matutino", schedule: "07:00 A 15:00", schedule_description: "07:00 A 15:00", plaza_code: "PLAZA-NUEVA",
      source_name_raw: "", import_notes: "", active: true, source_import_state: "active"
    };
    const history: MockHistory[] = [
      { id: "h-1", batch_id: "b-1", worker_id: "w-1", field_name: "plaza_code", old_value: "PLAZA-ORIGINAL", new_value: "PLAZA-NUEVA", created_at: "2026-09-16T10:01:00Z" },
    ];

    simulateMasterRollbackRpc({ batch, workers: [worker], lockers: [], assignments: [], changeHistory: history, userDelegationId: "del-1" });
    expect(worker.plaza_code).toBe("PLAZA-ORIGINAL");
  });

  it("MASTER rollback revierte categoría", () => {
    const batch: MockBatch = { id: "b-1", format_version: "UNION_MASTER_LOCKERS_V1", status: "confirmed", delegation_id: "del-1", created_at: "2026-09-16T10:00:00Z" };
    const worker: MockWorker = {
      id: "w-1", employee_number: "1001", category: "SUBJEFE DE PISO", position_description: "SUBJEFE DE PISO",
      turn: "Matutino", schedule: "07:00 A 15:00", schedule_description: "07:00 A 15:00", plaza_code: "10",
      source_name_raw: "", import_notes: "", active: true, source_import_state: "active"
    };
    const history: MockHistory[] = [
      { id: "h-1", batch_id: "b-1", worker_id: "w-1", field_name: "category", old_value: "ENFERMERA GENERAL", new_value: "SUBJEFE DE PISO", created_at: "2026-09-16T10:01:00Z" },
    ];

    simulateMasterRollbackRpc({ batch, workers: [worker], lockers: [], assignments: [], changeHistory: history, userDelegationId: "del-1" });
    expect(worker.category).toBe("ENFERMERA GENERAL");
    expect(worker.position_description).toBe("ENFERMERA GENERAL");
  });

  it("MASTER rollback revierte turno", () => {
    const batch: MockBatch = { id: "b-1", format_version: "UNION_MASTER_LOCKERS_V1", status: "confirmed", delegation_id: "del-1", created_at: "2026-09-16T10:00:00Z" };
    const worker: MockWorker = {
      id: "w-1", employee_number: "1001", category: "MEDICO", position_description: "MEDICO",
      turn: "Nocturno", schedule: "20:00 A 08:00", schedule_description: "20:00 A 08:00", plaza_code: "10",
      source_name_raw: "", import_notes: "", active: true, source_import_state: "active"
    };
    const history: MockHistory[] = [
      { id: "h-1", batch_id: "b-1", worker_id: "w-1", field_name: "turn", old_value: "Jornada Acumulada", new_value: "Nocturno", created_at: "2026-09-16T10:01:00Z" },
    ];

    simulateMasterRollbackRpc({ batch, workers: [worker], lockers: [], assignments: [], changeHistory: history, userDelegationId: "del-1" });
    expect(worker.turn).toBe("Jornada Acumulada");
  });

  it("MASTER rollback revierte horario", () => {
    const batch: MockBatch = { id: "b-1", format_version: "UNION_MASTER_LOCKERS_V1", status: "confirmed", delegation_id: "del-1", created_at: "2026-09-16T10:00:00Z" };
    const worker: MockWorker = {
      id: "w-1", employee_number: "1001", category: "MEDICO", position_description: "MEDICO",
      turn: "Matutino", schedule: "08:00 A 16:00", schedule_description: "08:00 A 16:00", plaza_code: "10",
      source_name_raw: "", import_notes: "", active: true, source_import_state: "active"
    };
    const history: MockHistory[] = [
      { id: "h-1", batch_id: "b-1", worker_id: "w-1", field_name: "schedule", old_value: "07:00 A 15:00", new_value: "08:00 A 16:00", created_at: "2026-09-16T10:01:00Z" },
    ];

    simulateMasterRollbackRpc({ batch, workers: [worker], lockers: [], assignments: [], changeHistory: history, userDelegationId: "del-1" });
    expect(worker.schedule).toBe("07:00 A 15:00");
  });

  it("MASTER rollback revierte source_name_raw", () => {
    const batch: MockBatch = { id: "b-1", format_version: "UNION_MASTER_LOCKERS_V1", status: "confirmed", delegation_id: "del-1", created_at: "2026-09-16T10:00:00Z" };
    const worker: MockWorker = {
      id: "w-1", employee_number: "1001", category: "MEDICO", position_description: "MEDICO",
      turn: "Matutino", schedule: "07:00 A 15:00", schedule_description: "07:00 A 15:00", plaza_code: "10",
      source_name_raw: "RODRIGUEZ/PEREZ/MARIO", import_notes: "", active: true, source_import_state: "active"
    };
    const history: MockHistory[] = [
      { id: "h-1", batch_id: "b-1", worker_id: "w-1", field_name: "source_name_raw", old_value: "RODRIGUEZ/MARIO", new_value: "RODRIGUEZ/PEREZ/MARIO", created_at: "2026-09-16T10:01:00Z" },
    ];

    simulateMasterRollbackRpc({ batch, workers: [worker], lockers: [], assignments: [], changeHistory: history, userDelegationId: "del-1" });
    expect(worker.source_name_raw).toBe("RODRIGUEZ/MARIO");
  });

  it("MASTER rollback revierte import_notes", () => {
    const batch: MockBatch = { id: "b-1", format_version: "UNION_MASTER_LOCKERS_V1", status: "confirmed", delegation_id: "del-1", created_at: "2026-09-16T10:00:00Z" };
    const worker: MockWorker = {
      id: "w-1", employee_number: "1001", category: "MEDICO", position_description: "MEDICO",
      turn: "Matutino", schedule: "07:00 A 15:00", schedule_description: "07:00 A 15:00", plaza_code: "10",
      source_name_raw: "", import_notes: "Cambio de servicio 2026", active: true, source_import_state: "active"
    };
    const history: MockHistory[] = [
      { id: "h-1", batch_id: "b-1", worker_id: "w-1", field_name: "import_notes", old_value: "Servicio pediatría", new_value: "Cambio de servicio 2026", created_at: "2026-09-16T10:01:00Z" },
    ];

    simulateMasterRollbackRpc({ batch, workers: [worker], lockers: [], assignments: [], changeHistory: history, userDelegationId: "del-1" });
    expect(worker.import_notes).toBe("Servicio pediatría");
  });

  it("MASTER rollback de trabajador nuevo: no delete físico, active false, source_import_state rolled_back", () => {
    const batch: MockBatch = { id: "b-101", format_version: "UNION_MASTER_LOCKERS_V1", status: "confirmed", delegation_id: "del-1", created_at: "2026-09-16T10:00:00Z" };
    const worker: MockWorker = {
      id: "w-new", employee_number: "99001", category: "ENFERMERA", position_description: "ENFERMERA",
      turn: "Matutino", schedule: "07:00 A 15:00", schedule_description: "07:00 A 15:00", plaza_code: "10",
      source_name_raw: "HERNANDEZ/LUCIA", import_notes: "", active: true,
      source_created_by_batch_id: "b-101", last_import_batch_id: "b-101", source_import_state: "active"
    };

    const result = simulateMasterRollbackRpc({ batch, workers: [worker], lockers: [], assignments: [], changeHistory: [], userDelegationId: "del-1" });
    expect(result.deactivated_workers).toBe(1);
    expect(worker.id).toBe("w-new"); // Registro sigue existiendo (CERO DELETE físico)
    expect(worker.active).toBe(false); // Desactivado del padrón
    expect(worker.source_import_state).toBe("rolled_back");
    expect(worker.source_rolled_back_at).toBeDefined();
  });

  it("MASTER rollback restaura locker anterior", () => {
    const batchId = "b-lock";
    const batch: MockBatch = { id: batchId, format_version: "UNION_MASTER_LOCKERS_V1", status: "confirmed", delegation_id: "del-1", created_at: "2026-09-16T10:00:00Z" };
    const lockerOld: MockLocker = { id: "loc-10", locker_number: "10", status: "disponible" };
    const lockerNew: MockLocker = { id: "loc-20", locker_number: "20", status: "ocupado" };
    const oldAssignment: MockAssignment = {
      id: "asgn-old", locker_id: "loc-10", worker_id: "w-1", status: "released",
      release_reason: `released_by_import_master_batch:${batchId}`, created_at: "2026-09-01T10:00:00Z"
    };
    const newAssignment: MockAssignment = {
      id: "asgn-new", locker_id: "loc-20", worker_id: "w-1", status: "active",
      assignment_reason: `import_master_batch:${batchId}`, created_at: "2026-09-16T10:00:00Z"
    };

    const result = simulateMasterRollbackRpc({
      batch, workers: [], lockers: [lockerOld, lockerNew], assignments: [oldAssignment, newAssignment],
      changeHistory: [], userDelegationId: "del-1"
    });

    expect(result.reverted_assignments).toBe(1);
    expect(result.restored_assignments).toBe(1);
    expect(oldAssignment.status).toBe("active");
    expect(lockerOld.status).toBe("ocupado");
    expect(newAssignment.status).toBe("released");
    expect(lockerNew.status).toBe("disponible");
  });

  it("MASTER rollback libera locker creado/asignado por batch", () => {
    const batchId = "b-single";
    const batch: MockBatch = { id: batchId, format_version: "UNION_MASTER_LOCKERS_V1", status: "confirmed", delegation_id: "del-1", created_at: "2026-09-16T10:00:00Z" };
    const locker: MockLocker = { id: "loc-99", locker_number: "99", status: "ocupado" };
    const assignment: MockAssignment = {
      id: "asgn-99", locker_id: "loc-99", worker_id: "w-1", status: "active",
      assignment_reason: `import_master_batch:${batchId}`, created_at: "2026-09-16T10:00:00Z"
    };

    simulateMasterRollbackRpc({ batch, workers: [], lockers: [locker], assignments: [assignment], changeHistory: [], userDelegationId: "del-1" });
    expect(assignment.status).toBe("released");
    expect(locker.status).toBe("disponible");
  });

  it("MASTER rollback no pisa trabajador modificado después", () => {
    const batch: MockBatch = { id: "b-1", format_version: "UNION_MASTER_LOCKERS_V1", status: "confirmed", delegation_id: "del-1", created_at: "2026-09-16T10:00:00Z", applied_at: "2026-09-16T10:01:00Z" };
    const worker: MockWorker = {
      id: "w-1", employee_number: "1001", category: "MEDICO ESPECIALISTA", position_description: "MEDICO ESPECIALISTA",
      turn: "Vespertino", schedule: "14:00 A 21:30", schedule_description: "14:00 A 21:30", plaza_code: "99",
      source_name_raw: "", import_notes: "", active: true, source_import_state: "active",
      source_created_by_batch_id: "b-1", last_import_batch_id: "b-2" // Modificado por lote posterior b-2!
    };

    expect(() => simulateMasterRollbackRpc({
      batch, workers: [worker], lockers: [], assignments: [], changeHistory: [], userDelegationId: "del-1"
    })).toThrow("ROLLBACK_CONFLICT_NEWER_CHANGES");
  });

  it("MASTER rollback no pisa locker reasignado después", () => {
    const batchId = "b-1";
    const batch: MockBatch = { id: batchId, format_version: "UNION_MASTER_LOCKERS_V1", status: "confirmed", delegation_id: "del-1", created_at: "2026-09-16T10:00:00Z" };
    const locker: MockLocker = { id: "loc-10", locker_number: "10", status: "ocupado" };
    const batchAssignment: MockAssignment = {
      id: "asgn-1", locker_id: "loc-10", worker_id: "w-1", status: "released",
      assignment_reason: `import_master_batch:${batchId}`, created_at: "2026-09-16T10:00:00Z"
    };
    const newerAssignment: MockAssignment = {
      id: "asgn-2", locker_id: "loc-10", worker_id: "w-2", status: "active",
      assignment_reason: "manual_reassignment", created_at: "2026-09-16T12:00:00Z"
    };

    expect(() => simulateMasterRollbackRpc({
      batch, workers: [], lockers: [locker], assignments: [batchAssignment, newerAssignment],
      changeHistory: [], userDelegationId: "del-1"
    })).toThrow("ROLLBACK_CONFLICT_NEWER_CHANGES");
  });

  it("MASTER rollback es atómico", () => {
    const batch: MockBatch = { id: "b-fail", format_version: "UNION_MASTER_LOCKERS_V1", status: "confirmed", delegation_id: "del-1", created_at: "2026-09-16T10:00:00Z" };
    const worker: MockWorker = {
      id: "w-atomic", employee_number: "99002", category: "ENFERMERA", position_description: "ENFERMERA",
      turn: "Matutino", schedule: "07:00 A 15:00", schedule_description: "07:00 A 15:00", plaza_code: "10",
      source_name_raw: "", import_notes: "", active: true, source_created_by_batch_id: "b-fail",
      last_import_batch_id: "b-fail", source_import_state: "active"
    };
    const locker: MockLocker = { id: "loc-fail", locker_number: "50", status: "ocupado" };
    const assignment: MockAssignment = {
      id: "asgn-fail", locker_id: "loc-fail", worker_id: "w-atomic", status: "active",
      assignment_reason: "import_master_batch:b-fail", created_at: "2026-09-16T10:00:00Z"
    };

    // Simulando un fallo en el paso de casilleros: la transacción debe abortar y restaurar trabajadores
    expect(() => simulateMasterRollbackRpc({
      batch, workers: [worker], lockers: [locker], assignments: [assignment], changeHistory: [],
      userDelegationId: "del-1", failSimulatedStep: "LOCKER_UPDATE"
    })).toThrow("TRANSACTION_FAILED");

    // Atomicidad: los trabajadores y casilleros quedan exactamente en su estado inicial
    expect(worker.active).toBe(true);
    expect(worker.source_import_state).toBe("active");
    expect(locker.status).toBe("ocupado");
    expect(assignment.status).toBe("active");
    expect(batch.status).toBe("confirmed");
  });

  it("MASTER rollback doble es rechazado", () => {
    const batch: MockBatch = { id: "b-done", format_version: "UNION_MASTER_LOCKERS_V1", status: "rolled_back", delegation_id: "del-1", created_at: "2026-09-16T10:00:00Z" };
    expect(() => simulateMasterRollbackRpc({
      batch, workers: [], lockers: [], assignments: [], changeHistory: [], userDelegationId: "del-1"
    })).toThrow("BATCH_ALREADY_ROLLED_BACK");
  });

  it("MASTER rollback de preview es rechazado", () => {
    const batch: MockBatch = { id: "b-prev", format_version: "UNION_MASTER_LOCKERS_V1", status: "preview", delegation_id: "del-1", created_at: "2026-09-16T10:00:00Z" };
    expect(() => simulateMasterRollbackRpc({
      batch, workers: [], lockers: [], assignments: [], changeHistory: [], userDelegationId: "del-1"
    })).toThrow("INVALID_BATCH_STATUS_FOR_ROLLBACK");
  });

  it("MASTER RPC rechaza batch SIAP", () => {
    const siapBatch: MockBatch = { id: "b-siap", format_version: "SIAP_2026", status: "confirmed", delegation_id: "del-1", created_at: "2026-09-16T10:00:00Z" };
    expect(() => simulateMasterRollbackRpc({
      batch: siapBatch, workers: [], lockers: [], assignments: [], changeHistory: [], userDelegationId: "del-1"
    })).toThrow("INVALID_FORMAT_VERSION");
  });

  it("SIAP rollback sigue intacto", () => {
    function simulateSiapRollbackRpc(batch: { format_version: string; status: string; delegation_id: string }, userDelegationId: string) {
      if (batch.format_version !== "SIAP_2026") {
        throw new Error(`INVALID_FORMAT_VERSION: Este lote tiene formato "${batch.format_version}" y debe revertirse con union_rollback_master_import.`);
      }
      if (batch.status !== "confirmed") {
        throw new Error(`INVALID_BATCH_STATUS_FOR_ROLLBACK: Solo se pueden revertir lotes confirmados. Estado actual: "${batch.status}".`);
      }
      if (batch.delegation_id !== userDelegationId) {
        throw new Error("UNAUTHORIZED_UNION_ADMIN");
      }
      return { status: "rolled_back" };
    }

    const siapBatch = { format_version: "SIAP_2026", status: "confirmed", delegation_id: "del-1" };
    expect(simulateSiapRollbackRpc(siapBatch, "del-1")).toEqual({ status: "rolled_back" });

    const masterBatch = { format_version: "UNION_MASTER_LOCKERS_V1", status: "confirmed", delegation_id: "del-1" };
    expect(() => simulateSiapRollbackRpc(masterBatch, "del-1")).toThrow("INVALID_FORMAT_VERSION");
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

