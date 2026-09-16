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
    expect(result.parsed.position_number).toBe("80");
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
    position_number: "10",
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
