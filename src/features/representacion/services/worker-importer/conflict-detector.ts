import type {
  ParsedWorkerRow,
  RowIssue,
  RowStatus,
  FieldDiff,
  RowDiff,
} from "./types";
import { maskRfc, maskCurp, maskNss } from "./row-parser";

export interface ExistingWorkerRecord {
  id: string;
  employee_number: string;
  siap_full_name?: string | null;
  first_name: string;
  paternal_surname: string;
  maternal_surname: string | null;
  category: string;
  assignment: string;
  turn: string;
  schedule: string | null;
  plaza_code?: string | null;
  contract_type_code?: string | null;
  rfc?: string | null;
  curp?: string | null;
  nss?: string | null;
  responsibility_area_code?: string | null;
  plaza_type_code?: string | null;
  shift_code?: string | null;
  associated_concepts_mask?: string | null;
  position_code?: string | null;
  department_code?: string | null;
  schedule_code?: string | null;
  seniority_raw?: string | null;
  occupation_start_date?: string | null;
  occupation_limit_date?: string | null;
  employment_start_date?: string | null;
  reemployment_date?: string | null;
  source_status_code?: string | null;
  termination_code?: string | null;
  termination_date?: string | null;
  micro_group_code?: string | null;
  active: boolean;
}

export interface AnalyzedRow {
  rowNumber: number;
  parsed: ParsedWorkerRow;
  status: RowStatus;
  issues: RowIssue[];
  diff?: RowDiff;
  existingWorkerId?: string;
}

const COMPARABLE_FIELDS: Array<{
  key: keyof ParsedWorkerRow;
  label: string;
  getOld: (w: ExistingWorkerRecord) => string | null | undefined;
}> = [
  { key: "siap_full_name", label: "Nombre Completo (SIAP)", getOld: (w) => w.siap_full_name || `${w.paternal_surname || ""} ${w.maternal_surname || ""} ${w.first_name || ""}`.trim() },
  { key: "position_description", label: "Categoría / Puesto", getOld: (w) => w.category },
  { key: "department_description", label: "Adscripción / Depto", getOld: (w) => w.assignment },
  { key: "turn", label: "Turno", getOld: (w) => w.turn },
  { key: "schedule_description", label: "Horario", getOld: (w) => w.schedule },
  { key: "plaza_code", label: "Plaza", getOld: (w) => w.plaza_code },
  { key: "contract_type_code", label: "Tipo Contrato", getOld: (w) => w.contract_type_code },
  { key: "responsibility_area_code", label: "Área Responsabilidad", getOld: (w) => w.responsibility_area_code },
  { key: "plaza_type_code", label: "Tipo Plaza", getOld: (w) => w.plaza_type_code },
  { key: "shift_code", label: "Turno Código", getOld: (w) => w.shift_code },
  { key: "associated_concepts_mask", label: "Conceptos Asociados", getOld: (w) => w.associated_concepts_mask },
  { key: "position_code", label: "Clave Puesto", getOld: (w) => w.position_code },
  { key: "department_code", label: "Clave Depto", getOld: (w) => w.department_code },
  { key: "schedule_code", label: "Clave Horario", getOld: (w) => w.schedule_code },
  { key: "seniority_raw", label: "Antigüedad", getOld: (w) => w.seniority_raw },
  { key: "occupation_start_date", label: "Inicio Ocupación", getOld: (w) => w.occupation_start_date },
  { key: "occupation_limit_date", label: "Límite Ocupación", getOld: (w) => w.occupation_limit_date },
  { key: "rfc", label: "RFC", getOld: (w) => w.rfc },
  { key: "curp", label: "CURP", getOld: (w) => w.curp },
  { key: "nss", label: "NSS", getOld: (w) => w.nss },
  { key: "employment_start_date", label: "Fecha Ingreso", getOld: (w) => w.employment_start_date },
  { key: "reemployment_date", label: "Fecha Reingreso", getOld: (w) => w.reemployment_date },
  { key: "source_status_code", label: "Estatus Fuente", getOld: (w) => w.source_status_code },
  { key: "termination_code", label: "Clave Baja", getOld: (w) => w.termination_code },
  { key: "termination_date", label: "Fecha Baja", getOld: (w) => w.termination_date },
  { key: "micro_group_code", label: "Micro Grupo", getOld: (w) => w.micro_group_code },
];

export function detectConflictsAndDiff(
  rows: Array<{ parsed: ParsedWorkerRow; issues: RowIssue[]; isValid: boolean; rowNumber: number }>,
  existingWorkersMap: Map<string, ExistingWorkerRecord>
): AnalyzedRow[] {
  const analyzed: AnalyzedRow[] = [];
  const seenMatriculasInFile = new Map<string, number>();

  for (const { parsed, issues, isValid, rowNumber } of rows) {
    const rowIssues = [...issues];

    // Check duplicate within the same file
    if (parsed.matricula) {
      if (seenMatriculasInFile.has(parsed.matricula)) {
        const prevRow = seenMatriculasInFile.get(parsed.matricula)!;
        rowIssues.push({
          code: "DUPLICATE_MATRICULA_IN_FILE",
          message: `La matrícula ${parsed.matricula} está duplicada en el archivo (aparece en la fila ${prevRow} y en la fila ${rowNumber}).`,
          severity: "error",
          field: "matricula",
        });
      } else {
        seenMatriculasInFile.set(parsed.matricula, rowNumber);
      }
    }

    if (!isValid || rowIssues.some((i) => i.severity === "error")) {
      analyzed.push({
        rowNumber,
        parsed,
        status: "invalid",
        issues: rowIssues,
      });
      continue;
    }

    const existing = existingWorkersMap.get(parsed.matricula);

    if (!existing) {
      analyzed.push({
        rowNumber,
        parsed,
        status: rowIssues.some((i) => i.severity === "warning") ? "warning" : "new",
        issues: rowIssues,
      });
      continue;
    }

    // Existing worker found: Check for CRITICAL IDENTITY CONFLICT
    let hasIdentityConflict = false;
    let conflictReason = "";

    if (
      existing.curp &&
      parsed.curp &&
      existing.curp.toUpperCase() !== parsed.curp.toUpperCase()
    ) {
      hasIdentityConflict = true;
      conflictReason = `Conflicto de CURP: Registrado ${maskCurp(existing.curp)} vs Archivo ${maskCurp(parsed.curp)}.`;
    } else if (
      existing.rfc &&
      parsed.rfc &&
      existing.rfc.toUpperCase() !== parsed.rfc.toUpperCase()
    ) {
      hasIdentityConflict = true;
      conflictReason = `Conflicto de RFC: Registrado ${maskRfc(existing.rfc)} vs Archivo ${maskRfc(parsed.rfc)}.`;
    } else if (
      existing.nss &&
      parsed.nss &&
      existing.nss !== parsed.nss
    ) {
      hasIdentityConflict = true;
      conflictReason = `Conflicto de NSS: Registrado ${maskNss(existing.nss)} vs Archivo ${maskNss(parsed.nss)}.`;
    }

    if (hasIdentityConflict) {
      rowIssues.push({
        code: "CRITICAL_IDENTITY_MISMATCH",
        message: `La matrícula coincide pero difieren datos vitales de identidad. ${conflictReason}`,
        severity: "error",
      });

      analyzed.push({
        rowNumber,
        parsed,
        status: "conflict",
        issues: rowIssues,
        existingWorkerId: existing.id,
        diff: {
          changes: [],
          conflictReason,
        },
      });
      continue;
    }

    // Calculate changes against SIAP managed fields
    const changes: FieldDiff[] = [];
    for (const field of COMPARABLE_FIELDS) {
      let oldVal = (field.getOld(existing) ?? "").toString().trim();
      let newVal = (parsed[field.key] ?? "").toString().trim();

      // Normalize associated_concepts_mask: empty/null is equivalent to "00000" (no concepts)
      if (field.key === "associated_concepts_mask") {
        if (!oldVal || oldVal === "00000") oldVal = "00000";
        if (!newVal || newVal === "00000") newVal = "00000";
      }

      if (oldVal !== newVal && (oldVal || newVal)) {
        changes.push({
          field: field.key,
          label: field.label,
          oldValue: oldVal || null,
          newValue: newVal || null,
        });
      }
    }

    let status: RowStatus = "unchanged";
    if (changes.length > 0) {
      status = "updated";
    } else if (rowIssues.some((i) => i.severity === "warning")) {
      status = "warning";
    }

    analyzed.push({
      rowNumber,
      parsed,
      status,
      issues: rowIssues,
      existingWorkerId: existing.id,
      diff: changes.length > 0 ? { changes } : undefined,
    });
  }

  return analyzed;
}
