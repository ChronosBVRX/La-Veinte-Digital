import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { rangeLabel, type LicenseRangeType } from "@/features/representacion/lib/licenses";

export interface UnionLicenseWorkerData {
  id: string;
  employeeNumber: string;
  firstName: string;
  paternalSurname: string;
  maternalSurname: string;
  fullName: string;
  category: string;
  assignment: string;
  turn: string;
  schedule: string;
  restDays: string;
  phone: string;
}

export interface UnionLicenseDetailData {
  withPay: boolean;
  payKindWord: "CON" | "SIN";
  payKindLabel: string;
  licenseRangeType: LicenseRangeType;
  licenseRangeLabel: string;
  startDate: string;
  startDay: string;
  startMonth: string;
  startYear: string;
  endDate: string;
  endDay: string;
  endMonth: string;
  endYear: string;
  periodLabelWord: string;
  totalDays: number;
  daysUnit: string;
  isExtension: boolean;
  reason: string;
  proof: string;
  debtStatus: string;
  previousStartDate?: string;
  previousEndDate?: string;
}

export interface UnionLicenseRecipientData {
  name: string;
  role: string;
}

export interface UnionLicenseSignersData {
  signerName: string;
  signerRole: string;
  institutionalMotto: string;
  committeeName: string;
  sidebarDelegation: string;
  generalSecretary: string;
  interiorSecretary: string;
  conflictsSecretary: string;
  admissionSecretary: string;
  socialWelfareSecretary: string;
}

export interface UnionLicenseDocumentData {
  caseId: string;
  folio: string;
  delegationId: string;
  delegationCode: string;
  delegationDisplayName: string;
  centerName: string;
  centerAddress: string;
  ooad: string;
  place: string;
  elaborationDate: string;
  elaborationDay: string;
  elaborationMonth: string;
  elaborationMonthName: string;
  elaborationYear: string;
  placeDateString: string;
  worker: UnionLicenseWorkerData;
  license: UnionLicenseDetailData;
  recipient: UnionLicenseRecipientData;
  signers: UnionLicenseSignersData;
}

const MONTHS_ES = [
  "ENERO",
  "FEBRERO",
  "MARZO",
  "ABRIL",
  "MAYO",
  "JUNIO",
  "JULIO",
  "AGOSTO",
  "SEPTIEMBRE",
  "OCTUBRE",
  "NOVIEMBRE",
  "DICIEMBRE",
];

export function formatLongDateEs(iso: string): string {
  const [y, m, d] = (iso || "").split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} DE ${MONTHS_ES[(m ?? 1) - 1]} DEL ${y}`;
}

export function splitIsoDate(iso: string): { d: string; m: string; y: string } {
  const [y, m, d] = (iso || "").split("-");
  return {
    d: (d ?? "").padStart(2, "0"),
    m: (m ?? "").padStart(2, "0"),
    y: y ?? "",
  };
}

export function normalizeWorkerName(worker: {
  first_name?: string | null;
  paternal_surname?: string | null;
  maternal_surname?: string | null;
  siap_full_name?: string | null;
}): {
  firstName: string;
  paternalSurname: string;
  maternalSurname: string;
  fullName: string;
} {
  const fn = (worker.first_name ?? "").trim();
  const ps = (worker.paternal_surname ?? "").trim();
  const ms = (worker.maternal_surname ?? "").trim();
  const siap = (worker.siap_full_name ?? "").trim();

  // If structured fields exist
  if (ps || fn) {
    const parts = [ps, ms, fn].filter(Boolean);
    const fullName = parts.join(" ").replace(/\s+/g, " ").toUpperCase();
    return {
      firstName: fn.toUpperCase(),
      paternalSurname: ps.toUpperCase(),
      maternalSurname: ms.toUpperCase(),
      fullName,
    };
  }

  // If only siap_full_name exists
  if (siap) {
    // SIAP encodes 'Ñ' as '&' (e.g. BOLA&OS -> BOLAÑOS)
    const cleanSiap = siap.replace(/&/g, "Ñ");

    // SIAP often uses slash-delimited format: PATERNO/MATERNO/NOMBRE(S)
    if (cleanSiap.includes("/")) {
      const parts = cleanSiap.split("/").map((p) => p.trim()).filter(Boolean);
      const paternalSurname = parts[0] ?? "";
      const maternalSurname = parts[1] ?? "";
      const firstName = parts.slice(2).join(" ");
      const fullName = [paternalSurname, maternalSurname, firstName].filter(Boolean).join(" ");
      return {
        firstName: firstName.toUpperCase(),
        paternalSurname: paternalSurname.toUpperCase(),
        maternalSurname: maternalSurname.toUpperCase(),
        fullName: fullName.toUpperCase(),
      };
    }

    const tokens = cleanSiap.split(/\s+/).filter(Boolean);
    let paternalSurname = "";
    let maternalSurname = "";
    let firstName = "";

    if (tokens.length === 1) {
      firstName = tokens[0] ?? "";
    } else if (tokens.length === 2) {
      paternalSurname = tokens[0] ?? "";
      firstName = tokens[1] ?? "";
    } else if (tokens.length === 3) {
      paternalSurname = tokens[0] ?? "";
      maternalSurname = tokens[1] ?? "";
      firstName = tokens[2] ?? "";
    } else {
      // 4 or more: Mexican standard often 2 surnames + rest first names
      paternalSurname = tokens[0] ?? "";
      maternalSurname = tokens[1] ?? "";
      firstName = tokens.slice(2).join(" ");
    }

    const fullName = [paternalSurname, maternalSurname, firstName].filter(Boolean).join(" ");

    return {
      firstName: firstName.toUpperCase(),
      paternalSurname: paternalSurname.toUpperCase(),
      maternalSurname: maternalSurname.toUpperCase(),
      fullName: fullName.toUpperCase() || cleanSiap.toUpperCase(),
    };
  }

  return {
    firstName: "",
    paternalSurname: "",
    maternalSurname: "",
    fullName: "",
  };
}

export async function buildUnionLicenseDocumentData(
  supabase: SupabaseClient<Database>,
  caseId: string,
): Promise<UnionLicenseDocumentData> {
  // 1. Fetch case header
  const { data: caseRow, error: caseErr } = await supabase
    .from("union_cases")
    .select("id, delegation_id, folio, opened_at, worker_id")
    .eq("id", caseId)
    .single();

  if (caseErr || !caseRow) {
    throw new Error(`Expediente no encontrado (ID: ${caseId})`);
  }

  const header = caseRow as {
    id: string;
    delegation_id: string;
    folio: string;
    opened_at: string;
    worker_id: string;
  };

  // 2. Fetch worker
  const { data: workerRow, error: workerErr } = await supabase
    .from("union_workers")
    .select(
      "id, employee_number, first_name, paternal_surname, maternal_surname, siap_full_name, category, position_description, assignment, department_description, turn, schedule, schedule_description, rest_days, phone",
    )
    .eq("id", header.worker_id)
    .single();

  if (workerErr || !workerRow) {
    throw new Error(`Trabajador no encontrado (ID: ${header.worker_id})`);
  }

  const w = workerRow as unknown as Record<string, string | null>;

  // 3. Fetch license detail
  const { data: licenseRow, error: licenseErr } = await supabase
    .from("union_license_cases")
    .select("*")
    .eq("case_id", caseId)
    .single();

  if (licenseErr || !licenseRow) {
    throw new Error(`Detalle de licencia no encontrado (ID: ${caseId})`);
  }

  const det = licenseRow as {
    with_pay: boolean;
    license_range_type: LicenseRangeType;
    start_date: string;
    end_date: string;
    total_days: number;
    is_extension: boolean;
    reason: string;
    proof_description: string;
    debt_certification_status: string;
  };

  // 4. Fetch settings & delegation
  const { data: settingsRow } = await supabase
    .from("union_settings")
    .select("*")
    .eq("delegation_id", header.delegation_id)
    .maybeSingle();

  const st = (settingsRow ?? {}) as unknown as Record<string, string | null>;

  const { data: delegationRow } = await supabase
    .from("union_delegations")
    .select("code, name")
    .eq("id", header.delegation_id)
    .maybeSingle();

  const delCode = delegationRow?.code || "XXI";
  const delName = delegationRow?.name || "Delegación XXI";

  // Validate critical fields
  const names = normalizeWorkerName({
    first_name: w.first_name,
    paternal_surname: w.paternal_surname,
    maternal_surname: w.maternal_surname,
    siap_full_name: w.siap_full_name,
  });

  if (!names.fullName) {
    throw new Error("WORKER_NAME_REQUIRED: El trabajador no cuenta con nombre registrado.");
  }

  const employeeNumber = (w.employee_number ?? "").trim();
  if (!employeeNumber) {
    throw new Error("WORKER_MATRICULA_REQUIRED: El trabajador no cuenta con matrícula registrada.");
  }

  if (!det.start_date || !det.end_date) {
    throw new Error("LICENSE_DATES_REQUIRED: Las fechas de inicio y término son obligatorias.");
  }

  if (det.total_days <= 0) {
    throw new Error("LICENSE_DAYS_INVALID: El total de días debe ser mayor a 0.");
  }

  // Formatting dates
  const opened = new Date(header.opened_at);
  const elabD = String(opened.getUTCDate()).padStart(2, "0");
  const elabM = String(opened.getUTCMonth() + 1).padStart(2, "0");
  const elabMName = MONTHS_ES[opened.getUTCMonth()] ?? "SEPTIEMBRE";
  const elabY = String(opened.getUTCFullYear());

  const sDate = splitIsoDate(det.start_date);
  const eDate = splitIsoDate(det.end_date);

  const category = (w.category || w.position_description || "").trim().toUpperCase();
  const assignment = (w.assignment || w.department_description || "HOSPITAL GENERAL REGIONAL No. 1").trim().toUpperCase();
  const schedule = (w.schedule || w.schedule_description || "").trim();
  const turn = (w.turn || "").trim().toUpperCase();
  const restDays = (w.rest_days || "").trim().toUpperCase();
  const phone = (w.phone || "").trim();

  const periodLabelWord = `DEL ${formatLongDateEs(det.start_date)} AL ${formatLongDateEs(det.end_date)}`;
  const placeDateString = `Charo, Michoacán a ${elabD} DE ${elabMName} del ${elabY}`;

  // Recipient resolution with clean fallback
  const recipientName = (st.default_recipient_name || "C. L.A.E. SARAI MORALES GARNICA").trim();
  const recipientRole = (st.default_recipient_role || "Jefe de Personal H.G.R. No. 1").trim();

  // Signers & Directory
  const committeeName = (st.delegation_display_name || `Comité Delegacional ${delCode}`).trim();
  const institutionalMotto = (st.institutional_motto || "Seguridad Social y Bienestar Económico de los Trabajadores").trim();
  const signerName = (st.default_signer_name || "LORENA GUADALUPE SOLORIO CHÁVEZ").trim();
  const signerRole = (st.default_signer_role || "Secretario del Interior").trim();

  const generalSecretary = (st.general_secretary || "CUITLÁHUAC CERDA GUTIÉRREZ").trim();
  const interiorSecretary = (st.interior_secretary || "LORENA GUADALUPE SOLORIO CHÁVEZ").trim();
  const conflictsSecretary = (st.conflicts_secretary || "MAYRA ZENDEJAS RODRÍGUEZ").trim();
  const admissionSecretary = (st.admission_secretary || "PATRICIA GONZÁLEZ MÉNDEZ").trim();
  const socialWelfareSecretary = (st.social_welfare_secretary || "GRACIELA CORTEZ CÁRDENAS").trim();

  return {
    caseId: header.id,
    folio: header.folio,
    delegationId: header.delegation_id,
    delegationCode: delCode,
    delegationDisplayName: delName,
    centerName: (st.center_name || "HGR No. 1").trim(),
    centerAddress: (st.center_address || "La Goleta, Charo, Michoacán").trim(),
    ooad: "MICHOACÁN",
    place: "LA GOLETA, CHARO, MICHOACÁN",
    elaborationDate: `${elabY}-${elabM}-${elabD}`,
    elaborationDay: elabD,
    elaborationMonth: elabM,
    elaborationMonthName: elabMName,
    elaborationYear: elabY,
    placeDateString,
    worker: {
      id: header.worker_id,
      employeeNumber,
      firstName: names.firstName,
      paternalSurname: names.paternalSurname,
      maternalSurname: names.maternalSurname,
      fullName: names.fullName,
      category,
      assignment,
      turn,
      schedule,
      restDays,
      phone,
    },
    license: {
      withPay: det.with_pay,
      payKindWord: det.with_pay ? "CON" : "SIN",
      payKindLabel: det.with_pay ? "CON GOCE" : "SIN GOCE",
      licenseRangeType: det.license_range_type,
      licenseRangeLabel: rangeLabel(det.license_range_type),
      startDate: det.start_date,
      startDay: sDate.d,
      startMonth: sDate.m,
      startYear: sDate.y,
      endDate: det.end_date,
      endDay: eDate.d,
      endMonth: eDate.m,
      endYear: eDate.y,
      periodLabelWord,
      totalDays: det.total_days,
      daysUnit: det.total_days === 1 ? "DÍA" : "DÍAS",
      isExtension: det.is_extension,
      reason: (det.reason || "—").trim().toUpperCase(),
      proof: (det.proof_description || "—").trim().toUpperCase(),
      debtStatus: det.debt_certification_status === "certified" ? "Certificado" : "Pendiente de certificación",
    },
    recipient: {
      name: recipientName,
      role: recipientRole,
    },
    signers: {
      signerName,
      signerRole,
      institutionalMotto,
      committeeName,
      sidebarDelegation: `COMITÉ DELEGACIONAL ${delCode}`,
      generalSecretary,
      interiorSecretary,
      conflictsSecretary,
      admissionSecretary,
      socialWelfareSecretary,
    },
  };
}
