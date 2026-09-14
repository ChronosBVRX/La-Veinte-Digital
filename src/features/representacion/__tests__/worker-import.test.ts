import { describe, it, expect } from "vitest";
import {
  validateExcelSecurity,
  MAX_FILE_SIZE_BYTES,
} from "../services/worker-importer/excel-security";
import {
  normalizeHeaderText,
  mapHeaders,
} from "../services/worker-importer/header-mapper";
import {
  parseExcelDate,
  parseSeniority,
  decodeAssociatedConcepts,
  splitFullName,
  deriveTurn,
  maskRfc,
  maskCurp,
  maskNss,
  parseWorkerRow,
} from "../services/worker-importer/row-parser";
import {
  detectConflictsAndDiff,
  type ExistingWorkerRecord,
} from "../services/worker-importer/conflict-detector";

describe("Worker Importer - Excel Security", () => {
  it("rejects empty buffer", () => {
    const res = validateExcelSecurity(Buffer.alloc(0), "plantilla.xlsx");
    expect(res.valid).toBe(false);
    expect(res.error).toContain("vacío");
  });

  it("rejects buffer exceeding maximum size", () => {
    const bigBuf = Buffer.alloc(MAX_FILE_SIZE_BYTES + 10);
    // Fake zip signature
    bigBuf[0] = 0x50;
    bigBuf[1] = 0x4b;
    bigBuf[2] = 0x03;
    bigBuf[3] = 0x04;
    const res = validateExcelSecurity(bigBuf, "plantilla.xlsx");
    expect(res.valid).toBe(false);
    expect(res.error).toContain("supera el tamaño máximo");
  });

  it("rejects .xls legacy binary files", () => {
    const buf = Buffer.from([0xd0, 0xcf, 0x11, 0xe0]);
    const res = validateExcelSecurity(buf, "plantilla.xls");
    expect(res.valid).toBe(false);
    expect(res.error).toContain("formato binario antiguo");
  });

  it("rejects .xlsm files (macro-enabled)", () => {
    const buf = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00]);
    const res = validateExcelSecurity(buf, "plantilla.xlsm");
    expect(res.valid).toBe(false);
    expect(res.error).toContain("macros");
  });

  it("rejects files without valid ZIP magic bytes", () => {
    const fake = Buffer.from("NOT_A_VALID_EXCEL_OR_ZIP_FILE");
    const res = validateExcelSecurity(fake, "test.xlsx");
    expect(res.valid).toBe(false);
    expect(res.error).toContain("firma ZIP inválida");
  });

  it("rejects zip with vbaProject.bin", () => {
    const buf = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      Buffer.from("contains xl/vbaProject.bin in zip payload"),
    ]);
    const res = validateExcelSecurity(buf, "test.xlsx");
    expect(res.valid).toBe(false);
    expect(res.error).toContain("vbaProject.bin");
  });

  it("rejects zip with externalLinks", () => {
    const buf = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      Buffer.from("contains xl/externalLinks/externalLink1.xml"),
    ]);
    const res = validateExcelSecurity(buf, "test.xlsx");
    expect(res.valid).toBe(false);
    expect(res.error).toContain("externalLinks");
  });

  it("rejects zip with oleObject", () => {
    const buf = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      Buffer.from("contains xl/embeddings/oleObject1.bin"),
    ]);
    const res = validateExcelSecurity(buf, "test.xlsx");
    expect(res.valid).toBe(false);
    expect(res.error).toContain("oleObject");
  });

  it("accepts valid zip header with .xlsx extension", () => {
    const buf = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
    const res = validateExcelSecurity(buf, "plantilla.xlsx");
    expect(res.valid).toBe(true);
    expect(res.sha256).toBeDefined();
    expect(res.sha256.length).toBe(64);
  });
});

describe("Worker Importer - Header Mapping", () => {
  it("normalizes headers removing accents, dots, and collapse spaces", () => {
    expect(normalizeHeaderText(" C.U.R.P. ")).toBe("curp");
    expect(normalizeHeaderText("R.F.C.")).toBe("rfc");
    expect(normalizeHeaderText("N.S.S.")).toBe("nss");
    expect(normalizeHeaderText("Antigüedad")).toBe("antiguedad");
    expect(normalizeHeaderText("A R")).toBe("a r");
    expect(normalizeHeaderText("Descripción Puesto")).toBe("descripcion puesto");
  });

  it("maps the canonical 27 headers from SIAP HGR 1", () => {
    const canonicalHeaders = [
      "Tipo Contrato",
      "Plaza",
      "A R",
      "Inicio Ocupa",
      "Lim Ocu",
      "Mca Ocu",
      "Tipo Plaza",
      "Jor",
      "C A",
      "Puesto",
      "Descripcion Puesto",
      "Depto",
      "Descripcion Depto",
      "Horario",
      "Descripcion Horario",
      "Matricula",
      "Nombre del Trabajador",
      "Antiguedad",
      "R.F.C.",
      "C.U.R.P.",
      "N.S.S.",
      "Inicio Relacion Laboral",
      "Fecha Reingreso",
      "Status",
      "Cve Baja",
      "Fecha Baja",
      "Micro Grupo",
    ];

    const result = mapHeaders(canonicalHeaders);
    expect(result.valid).toBe(true);
    expect(result.missingMandatoryFields).toHaveLength(0);
    expect(result.columnMap.size).toBe(27);
  });

  it("maps the exact 27 headers from General_Hgr 1 (2).xlsx", () => {
    const rawHeaders = [
      "TC", "Matricula", "Nombre", "Plaza", "AR", "Fech Ocu", "Lim Ocu", "MO",
      "Tipo de Plaza", "Turno", "C A", "Puesto", "Descripcion 1", "Departamento",
      "Descripcion 2", "Horario", "Descripcion 3", "Antigüedad", "RFC", "CURP.",
      "Número de Seguridad Social", "Fecha Ingreso", "Fec. Reingreso", "Status",
      "Cve Baja", "Fecha de Baja", "Micro y grupo"
    ];

    const result = mapHeaders(rawHeaders);
    expect(result.valid).toBe(true);
    expect(result.missingMandatoryFields).toHaveLength(0);
    expect(result.columnMap.size).toBe(27);
    expect(result.columnMap.get(1)).toBe("contract_type_raw");
    expect(result.columnMap.get(2)).toBe("matricula_raw");
    expect(result.columnMap.get(3)).toBe("full_name_raw");
    expect(result.columnMap.get(4)).toBe("plaza_raw");
    expect(result.columnMap.get(5)).toBe("area_raw");
    expect(result.columnMap.get(21)).toBe("nss_raw");
    expect(result.columnMap.get(27)).toBe("micro_group_raw");
  });

  it("detects duplicate headers and rejects the file", () => {
    const duplicateHeaders = [
      "TC", "Matricula", "Nombre", "Plaza", "Plaza", "AR"
    ];
    const result = mapHeaders(duplicateHeaders);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("encabezados duplicados");
  });

  it("detects missing mandatory columns", () => {
    const incompleteHeaders = ["Puesto", "Descripcion Puesto", "Depto"];
    const result = mapHeaders(incompleteHeaders);
    expect(result.valid).toBe(false);
    expect(result.missingMandatoryFields).toContain("Matrícula");
    expect(result.missingMandatoryFields).toContain("Nombre del Trabajador");
    expect(result.missingMandatoryFields).toContain("Plaza");
  });
});

describe("Worker Importer - Row Parser", () => {
  it("splits simple Mexican full name into paternal, maternal, first name", () => {
    const res = splitFullName("ROSETE PEREZ AXEL");
    expect(res.paternal_surname).toBe("ROSETE");
    expect(res.maternal_surname).toBe("PEREZ");
    expect(res.first_name).toBe("AXEL");
  });

  it("splits compound surname with DE LA / DEL / SAN correctly", () => {
    const res1 = splitFullName("DE LA MORA PEREZ JUAN CARLOS");
    expect(res1.paternal_surname).toBe("DE LA MORA");
    expect(res1.maternal_surname).toBe("PEREZ");
    expect(res1.first_name).toBe("JUAN CARLOS");

    const res2 = splitFullName("DEL TORO MARTINEZ ANA PATRICIA");
    expect(res2.paternal_surname).toBe("DEL TORO");
    expect(res2.maternal_surname).toBe("MARTINEZ");
    expect(res2.first_name).toBe("ANA PATRICIA");

    const res3 = splitFullName("SAN JUAN HERNANDEZ PEDRO");
    expect(res3.paternal_surname).toBe("SAN JUAN");
    expect(res3.maternal_surname).toBe("HERNANDEZ");
    expect(res3.first_name).toBe("PEDRO");
  });

  it("preserves siap_full_name intact without modifications", () => {
    const raw = {
      matricula_raw: "99000001",
      full_name_raw: "DE LA ROSA SANTOS MARIA DEL CARMEN",
      plaza_raw: "96280",
    };
    const res = parseWorkerRow(raw, 2);
    expect(res.parsed.siap_full_name).toBe("DE LA ROSA SANTOS MARIA DEL CARMEN");
  });

  it("parses seniority string into years, fortnights, days", () => {
    const s1 = parseSeniority("10 Años 15 Quincenas 02 Dias");
    expect(s1.years).toBe(10);
    expect(s1.fortnights).toBe(15);
    expect(s1.days).toBe(2);

    const s2 = parseSeniority("05 Años 00 Quincenas 28 Dias");
    expect(s2.years).toBe(5);
    expect(s2.fortnights).toBe(0);
    expect(s2.days).toBe(28);
  });

  it("parses excel dates properly (ISO, DD/MM/YYYY, Date)", () => {
    expect(parseExcelDate("2020-01-01")).toBe("2020-01-01");
    expect(parseExcelDate("15/05/2026")).toBe("2026-05-15");
    expect(parseExcelDate(new Date("2026-09-14T00:00:00Z"))).toBe("2026-09-14");
    expect(parseExcelDate("")).toBeNull();
  });

  it("derives turn correctly from schedule description and shift code", () => {
    expect(deriveTurn("0", "08:00 A 16:00 HRS.")).toBe("Matutino");
    expect(deriveTurn("1", "14:00 A 21:30 HRS.")).toBe("Vespertino");
    expect(deriveTurn("2", "21:00 A 07:00 HRS.")).toBe("Nocturno");
    expect(deriveTurn("3", "JORNADA ACUMULADA")).toBe("Jornada Acumulada");
  });

  it("decodes associated concepts (C A) bitmask according to SIAP procedure", () => {
    // 0 -> 00000 (no concepts)
    const c0 = decodeAssociatedConcepts("0");
    expect(c0.mask).toBe("00000");
    expect(c0.concepts).toHaveLength(0);

    // 10000 -> 10000 (concept 012 - Horario discontinuo)
    const c10000 = decodeAssociatedConcepts("10000");
    expect(c10000.mask).toBe("10000");
    expect(c10000.concepts).toHaveLength(1);
    expect(c10000.concepts[0].code).toBe("012");

    // 1000 -> 01000 (concept 014 - Infectocontagiosidad no médica)
    const c1000 = decodeAssociatedConcepts("1000");
    expect(c1000.mask).toBe("01000");
    expect(c1000.concepts).toHaveLength(1);
    expect(c1000.concepts[0].code).toBe("014");

    // 100 -> 00100 (concept 023 - Infectocontagiosidad médica)
    const c100 = decodeAssociatedConcepts("100");
    expect(c100.mask).toBe("00100");
    expect(c100.concepts).toHaveLength(1);
    expect(c100.concepts[0].code).toBe("023");

    // 10 -> 00010 (concept 054 - Emanaciones radiactivas no médicas)
    const c10 = decodeAssociatedConcepts("10");
    expect(c10.mask).toBe("00010");
    expect(c10.concepts).toHaveLength(1);
    expect(c10.concepts[0].code).toBe("054");

    // 1 -> 00001 (concept 063 - Emanaciones radiactivas)
    const c1 = decodeAssociatedConcepts("1");
    expect(c1.mask).toBe("00001");
    expect(c1.concepts).toHaveLength(1);
    expect(c1.concepts[0].code).toBe("063");
  });

  it("normalizes TC (Tipo Contratación) and warns on unknown codes", () => {
    const rawValid = {
      matricula_raw: "99000001",
      full_name_raw: "GARCIA LOPEZ JUAN",
      plaza_raw: "96280",
      contract_type_raw: "2", // Base
    };
    const resValid = parseWorkerRow(rawValid, 2);
    expect(resValid.parsed.contract_type_code).toBe("2");
    expect(resValid.issues.some((i) => i.code === "TC_UNKNOWN_CODE")).toBe(false);

    const rawUnknown = {
      matricula_raw: "99000002",
      full_name_raw: "PEREZ PEREZ PEDRO",
      plaza_raw: "96281",
      contract_type_raw: "8", // Unknown code
    };
    const resUnknown = parseWorkerRow(rawUnknown, 3);
    expect(resUnknown.parsed.contract_type_code).toBe("8");
    expect(resUnknown.issues.some((i) => i.code === "TC_UNKNOWN_CODE")).toBe(true);
  });

  it("normalizes Tipo de Plaza to 2 digits (e.g. '1' -> '01') and warns on unknown codes", () => {
    const rawSingleDigit = {
      matricula_raw: "99000001",
      full_name_raw: "LOPEZ LOPEZ ANA",
      plaza_raw: "96280",
      plaza_type_raw: "1", // Should normalize to '01'
    };
    const res1 = parseWorkerRow(rawSingleDigit, 2);
    expect(res1.parsed.plaza_type_code).toBe("01");
    expect(res1.issues.some((i) => i.code === "TIPO_PLAZA_UNKNOWN")).toBe(false);

    const rawTwoDigits = {
      matricula_raw: "99000002",
      full_name_raw: "LOPEZ LOPEZ LUIS",
      plaza_raw: "96281",
      plaza_type_raw: "11", // Operativa Base
    };
    const res2 = parseWorkerRow(rawTwoDigits, 3);
    expect(res2.parsed.plaza_type_code).toBe("11");
    expect(res2.issues.some((i) => i.code === "TIPO_PLAZA_UNKNOWN")).toBe(false);

    const rawUnknown = {
      matricula_raw: "99000003",
      full_name_raw: "LOPEZ LOPEZ CARLOS",
      plaza_raw: "96282",
      plaza_type_raw: "99", // Unknown
    };
    const res3 = parseWorkerRow(rawUnknown, 4);
    expect(res3.parsed.plaza_type_code).toBe("99");
    expect(res3.issues.some((i) => i.code === "TIPO_PLAZA_UNKNOWN")).toBe(true);
  });

  it("validates AR as 3 alphanumeric positions and does NOT pad to 2 digits", () => {
    const raw = {
      matricula_raw: "99000001",
      full_name_raw: "GARCIA LOPEZ MARIA",
      plaza_raw: "96280",
      area_raw: "001",
    };
    const res = parseWorkerRow(raw, 2);
    expect(res.parsed.responsibility_area_code).toBe("001");
    expect(res.issues.some((i) => i.code === "INVALID_AR_FORMAT")).toBe(false);

    const rawShort = {
      matricula_raw: "99000002",
      full_name_raw: "GARCIA LOPEZ JUAN",
      plaza_raw: "96281",
      area_raw: "01", // 2 positions -> warning
    };
    const resShort = parseWorkerRow(rawShort, 3);
    expect(resShort.issues.some((i) => i.code === "INVALID_AR_FORMAT")).toBe(true);
  });

  it("validates Puesto as 8 positions and Departamento as 10 positions without truncation", () => {
    const raw = {
      matricula_raw: "99000001",
      full_name_raw: "GARCIA LOPEZ MARIA",
      plaza_raw: "96280",
      position_code_raw: "41500301", // 8 chars
      department_code_raw: "2114010001", // 10 chars
      department_desc_raw: "", // Empty department description allowed
    };
    const res = parseWorkerRow(raw, 2);
    expect(res.isValid).toBe(true);
    expect(res.parsed.position_code).toBe("41500301");
    expect(res.parsed.department_code).toBe("2114010001");
    expect(res.parsed.department_description).toBe("");
  });

  it("keeps Plaza variable length as raw text without zero-padding to 7 digits", () => {
    const raw = {
      matricula_raw: "99000001",
      full_name_raw: "GARCIA LOPEZ MARIA",
      plaza_raw: "502", // 3 digits
    };
    const res = parseWorkerRow(raw, 2);
    expect(res.parsed.plaza_code).toBe("502");
  });

  it("normalizes numeric Horario to 4 digits and preserves alphanumeric Horario codes", () => {
    const rawNumeric = {
      matricula_raw: "99000001",
      full_name_raw: "GARCIA LOPEZ MARIA",
      plaza_raw: "96280",
      schedule_code_raw: "112",
      schedule_desc_raw: "14.00 A 21.30 JORNADA MIXTA",
    };
    const res1 = parseWorkerRow(rawNumeric, 2);
    expect(res1.parsed.schedule_code).toBe("0112");
    expect(res1.parsed.schedule_description).toBe("14.00 A 21.30 JORNADA MIXTA");

    const rawAlpha = {
      matricula_raw: "99000002",
      full_name_raw: "GARCIA LOPEZ JUAN",
      plaza_raw: "96281",
      schedule_code_raw: "D731",
      schedule_desc_raw: "20.30 A 08.10 3 VECES POR SEMANA",
    };
    const res2 = parseWorkerRow(rawAlpha, 3);
    expect(res2.parsed.schedule_code).toBe("D731");
  });

  it("flags sentinel date 2050-01-01 via occupation_limit_is_sentinel", () => {
    const rawSentinel = {
      matricula_raw: "99000001",
      full_name_raw: "GARCIA LOPEZ MARIA",
      plaza_raw: "96280",
      occupation_limit_raw: "2050-01-01",
    };
    const res1 = parseWorkerRow(rawSentinel, 2);
    expect(res1.parsed.occupation_limit_is_sentinel).toBe(true);

    const rawNormal = {
      matricula_raw: "99000002",
      full_name_raw: "GARCIA LOPEZ JUAN",
      plaza_raw: "96281",
      occupation_limit_raw: "2026-10-31",
    };
    const res2 = parseWorkerRow(rawNormal, 3);
    expect(res2.parsed.occupation_limit_is_sentinel).toBe(false);
  });

  it("handles 10-digit NSS without padding and accepts 11-digit NSS", () => {
    const raw10 = {
      matricula_raw: "99386341",
      full_name_raw: "GARCIA LOPEZ MARIA",
      plaza_raw: "96280",
      nss_raw: "1234567890", // 10 digits
    };
    const res10 = parseWorkerRow(raw10, 2);
    expect(res10.isValid).toBe(true);
    expect(res10.parsed.nss).toBe("1234567890"); // Kept as 10 digits, not padded
    const nssWarning = res10.issues.find((i) => i.code === "NSS_10_DIGITS");
    expect(nssWarning).toBeDefined();

    const raw11 = {
      matricula_raw: "99386342",
      full_name_raw: "GARCIA LOPEZ PEDRO",
      plaza_raw: "96281",
      nss_raw: "12345678901", // 11 digits
    };
    const res11 = parseWorkerRow(raw11, 3);
    expect(res11.isValid).toBe(true);
    expect(res11.parsed.nss).toBe("12345678901");
  });

  it("accepts row with Fecha de Baja present and Status=1", () => {
    const raw = {
      matricula_raw: "99386341",
      full_name_raw: "GARCIA LOPEZ MARIA",
      plaza_raw: "96280",
      status_raw: "1",
      termination_code_raw: "0",
      termination_date_raw: "2026-05-15",
    };
    const res = parseWorkerRow(raw, 2);
    expect(res.isValid).toBe(true);
    expect(res.parsed.source_status_code).toBe("1");
    expect(res.parsed.termination_date).toBe("2026-05-15");
  });

  it("masks PII correctly without leaking full values", () => {
    expect(maskRfc("ROPA900101XYZ")).toBe("ROPA****XYZ");
    expect(maskCurp("ROPA900101HDFRXX01")).toBe("ROPA******XX01");
    expect(maskNss("01234567891")).toBe("****-**-7891");
  });
});

describe("Worker Importer - Conflict Detector and Diff", () => {
  const existingWorkers: ExistingWorkerRecord[] = [
    {
      id: "w-uuid-1",
      employee_number: "99386341",
      siap_full_name: "PEREZ LOPEZ JUAN",
      first_name: "JUAN",
      paternal_surname: "PEREZ",
      maternal_surname: "LOPEZ",
      category: "AUXILIAR DE ENFERMERIA GENERAL",
      assignment: "HOSPITAL GENERAL REGIONAL NO 1",
      turn: "Matutino",
      schedule: "08:00 A 16:00 HRS.",
      plaza_code: "96280",
      rfc: "PELJ8501011A2",
      curp: "PELJ850101HDFRXX01",
      nss: "01234567891",
      active: true,
    },
  ];

  const existingMap = new Map<string, ExistingWorkerRecord>(
    existingWorkers.map((w) => [w.employee_number, w])
  );

  it("identifies an unchanged worker when all comparable fields match", () => {
    const parsedRow = parseWorkerRow(
      {
        matricula_raw: "99386341",
        full_name_raw: "PEREZ LOPEZ JUAN",
        plaza_raw: "96280",
        position_desc_raw: "AUXILIAR DE ENFERMERIA GENERAL",
        department_desc_raw: "HOSPITAL GENERAL REGIONAL NO 1",
        schedule_desc_raw: "08:00 A 16:00 HRS.",
        rfc_raw: "PELJ8501011A2",
        curp_raw: "PELJ850101HDFRXX01",
        nss_raw: "01234567891",
      },
      2
    );

    const results = detectConflictsAndDiff(
      [{ parsed: parsedRow.parsed, issues: parsedRow.issues, isValid: true, rowNumber: 2 }],
      existingMap
    );

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("unchanged");
    expect(results[0].diff).toBeUndefined();
  });

  it("detects an updated worker with diff when category or plaza changes", () => {
    const parsedRow = parseWorkerRow(
      {
        matricula_raw: "99386341",
        full_name_raw: "PEREZ LOPEZ JUAN",
        plaza_raw: "96289", // Changed plaza
        position_desc_raw: "ENFERMERA JEFA DE PISO", // Changed category
        department_desc_raw: "HOSPITAL GENERAL REGIONAL NO 1",
        schedule_desc_raw: "08:00 A 16:00 HRS.",
        rfc_raw: "PELJ8501011A2",
        curp_raw: "PELJ850101HDFRXX01",
        nss_raw: "01234567891",
      },
      3
    );

    const results = detectConflictsAndDiff(
      [{ parsed: parsedRow.parsed, issues: parsedRow.issues, isValid: true, rowNumber: 3 }],
      existingMap
    );

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("updated");
    expect(results[0].diff).toBeDefined();
    expect(results[0].diff?.changes).toHaveLength(2);

    const plazaChange = results[0].diff?.changes.find((c) => c.field === "plaza_code");
    expect(plazaChange?.oldValue).toBe("96280");
    expect(plazaChange?.newValue).toBe("96289");

    const catChange = results[0].diff?.changes.find((c) => c.field === "position_description");
    expect(catChange?.oldValue).toBe("AUXILIAR DE ENFERMERIA GENERAL");
    expect(catChange?.newValue).toBe("ENFERMERA JEFA DE PISO");
  });

  it("detects CRITICAL IDENTITY MISMATCH when CURP/RFC/NSS differ for same matricula", () => {
    const parsedRow = parseWorkerRow(
      {
        matricula_raw: "99386341",
        full_name_raw: "GARCIA RUIZ CARLOS", // Completely different person
        plaza_raw: "96280",
        rfc_raw: "GARC900202XYZ", // Different RFC
        curp_raw: "GARC900202HDFRXX99", // Different CURP
        nss_raw: "98765432109", // Different NSS
      },
      4
    );

    const results = detectConflictsAndDiff(
      [{ parsed: parsedRow.parsed, issues: parsedRow.issues, isValid: true, rowNumber: 4 }],
      existingMap
    );

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("conflict");
    const conflictIssue = results[0].issues.find((i) => i.code === "CRITICAL_IDENTITY_MISMATCH");
    expect(conflictIssue).toBeDefined();
    expect(conflictIssue?.severity).toBe("error");
  });

  it("detects intra-file duplicate matricula", () => {
    const row1 = parseWorkerRow({ matricula_raw: "11111111", full_name_raw: "A B C", plaza_raw: "1" }, 2);
    const row2 = parseWorkerRow({ matricula_raw: "11111111", full_name_raw: "A B C", plaza_raw: "1" }, 3);

    const results = detectConflictsAndDiff(
      [
        { parsed: row1.parsed, issues: row1.issues, isValid: true, rowNumber: 2 },
        { parsed: row2.parsed, issues: row2.issues, isValid: true, rowNumber: 3 },
      ],
      existingMap
    );

    expect(results[0].status).toBe("new");
    expect(results[1].status).toBe("invalid");
    const dupIssue = results[1].issues.find((i) => i.code === "DUPLICATE_MATRICULA_IN_FILE");
    expect(dupIssue).toBeDefined();
  });
});
