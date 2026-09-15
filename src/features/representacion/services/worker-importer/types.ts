export interface AssociatedConcept {
  code: string;
  name: string;
  bitIndex: number;
}

export interface SiapRawRow {
  contract_type_raw?: string;
  plaza_raw?: string;
  area_raw?: string;
  occupation_start_raw?: string;
  occupation_limit_raw?: string;
  occupation_mark_raw?: string;
  plaza_type_raw?: string;
  shift_raw?: string;
  associated_concepts_raw?: string;
  position_code_raw?: string;
  position_desc_raw?: string;
  department_code_raw?: string;
  department_desc_raw?: string;
  schedule_code_raw?: string;
  schedule_desc_raw?: string;
  matricula_raw?: string;
  full_name_raw?: string;
  seniority_raw?: string;
  rfc_raw?: string;
  curp_raw?: string;
  nss_raw?: string;
  employment_start_raw?: string;
  reemployment_date_raw?: string;
  status_raw?: string;
  termination_code_raw?: string;
  termination_date_raw?: string;
  micro_group_raw?: string;
  [key: string]: string | undefined;
}

export interface ParsedWorkerRow {
  contract_type_code: string;
  plaza_code: string;
  responsibility_area_code: string;
  occupation_start_date: string | null;
  occupation_limit_date: string | null;
  occupation_limit_is_sentinel: boolean;
  occupation_mark_code: string;
  plaza_type_code: string;
  shift_code: string;
  associated_concepts_mask: string;
  associated_concepts: AssociatedConcept[];
  position_code: string;
  position_description: string;
  department_code: string;
  department_description: string;
  schedule_code: string;
  schedule_description: string;
  matricula: string;
  siap_full_name: string;
  first_name: string;
  paternal_surname: string;
  maternal_surname: string;
  seniority_raw: string;
  seniority_years: number | null;
  seniority_fortnights: number | null;
  seniority_days: number | null;
  rfc: string;
  curp: string;
  nss_raw: string;
  nss: string;
  employment_start_date: string | null;
  reemployment_date: string | null;
  source_status_code: string;
  termination_code: string;
  termination_date: string | null;
  micro_group_code: string;
  turn: string;
}

export const SIAP_MANAGED_FIELDS = [
  "siap_full_name",
  "contract_type_code",
  "plaza_code",
  "responsibility_area_code",
  "occupation_start_date",
  "occupation_limit_date",
  "occupation_limit_is_sentinel",
  "occupation_mark_code",
  "plaza_type_code",
  "shift_code",
  "associated_concepts_mask",
  "associated_concepts",
  "position_code",
  "position_description",
  "department_code",
  "department_description",
  "schedule_code",
  "schedule_description",
  "seniority_raw",
  "seniority_years",
  "seniority_fortnights",
  "seniority_days",
  "rfc",
  "curp",
  "nss",
  "employment_start_date",
  "reemployment_date",
  "source_status_code",
  "termination_code",
  "termination_date",
  "micro_group_code",
  "category",
  "assignment",
  "turn",
  "schedule",
] as const;

export interface RowIssue {
  code: string;
  message: string;
  severity: "error" | "warning";
  field?: string;
}

export type RowStatus =
  | "new"
  | "updated"
  | "unchanged"
  | "warning"
  | "invalid"
  | "conflict";

export interface FieldDiff {
  field: string;
  label: string;
  oldValue: string | null;
  newValue: string | null;
}

export interface RowDiff {
  changes: FieldDiff[];
  conflictReason?: string;
}

export interface ImportSummary {
  totalRows: number;
  newCount: number;
  updatedCount: number;
  unchangedCount: number;
  warningsCount: number;
  invalidCount: number;
  conflictsCount: number;
  missingInFileCount: number;
}

export interface PreviewRow {
  id?: string;
  rowNumber: number;
  matricula: string;
  fullName: string;
  category: string;
  department: string;
  plaza: string;
  maskedRfc: string;
  maskedCurp: string;
  maskedNss: string;
  status: RowStatus;
  issues: RowIssue[];
  diff?: RowDiff;
}

export interface ImportPreviewResult {
  batchId: string;
  fileName: string;
  fileSizeBytes: number;
  fileSha256: string;
  summary: ImportSummary;
  rows: PreviewRow[];
  missingWorkers: Array<{
    id: string;
    employee_number: string;
    full_name: string;
    category: string;
    department: string;
  }>;
}

export interface ImportConfirmResult {
  batchId: string;
  status: "confirmed";
  appliedCount: number;
  unchangedCount: number;
  missingMarkedCount: number;
  historyRecordsCreated: number;
}

export interface ImportRollbackResult {
  batchId: string;
  status: "rolled_back";
  restoredFieldsCount: number;
  deactivatedWorkersCount: number;
  deletedWorkersCount?: number;
}
