// Servicio centralizado y reutilizable para la preparación y construcción
// del documento PDF oficial de pasajes 026 y 027.
// Consumido tanto por el endpoint de descarga directa (/api/union/passages/pdf)
// como por el registro de impresión sindical inmutable.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { buildPassage026Pdf, buildPassage027Pdf } from "./passage-pdf";
import {
  getActiveUnionDocumentTemplate,
  type UnionDocumentTemplateKind,
} from "./union-document-template-repository";
import { resolveUnionWorkerName } from "./worker-name-resolver";

export interface PassageDocumentBuildResult {
  buffer: Buffer;
  documentType: "passage_026" | "passage_027";
  delegationId: string;
  caseId: string;
  folio: string;
  concept: "026" | "027";
  filename: string;
  pageCount: number;
}

type PassageRow = {
  concept: string;
  request_date: string;
  control_number: string | null;
  ooad: string;
  discontinuous_schedule: string;
  extramural_functions: string;
  transfer_period: string;
  worker_address: Record<string, string>;
  assignment_address: Record<string, string>;
  phone: string;
};

type WorkerRow = {
  first_name: string | null;
  paternal_surname: string | null;
  maternal_surname: string | null;
  siap_full_name: string | null;
  employee_number: string;
  category: string;
  assignment: string;
};

function splitISO(iso: string): { day: string; month: string; year: string } {
  const [y, m, d] = (iso || "").split("-");
  return { day: d ?? "", month: m ?? "", year: y ?? "" };
}

/**
 * Construye el PDF oficial inmutable de un expediente de pasaje (026 o 027).
 * Consulta base de datos, resuelve nombres y direcciones, recupera la plantilla
 * oficial activa desde Storage y aplica los campos calibrados.
 */
export async function buildPassageDocument(
  supabase: SupabaseClient<Database>,
  caseId: string,
): Promise<PassageDocumentBuildResult> {
  const { data: c, error: caseErr } = await supabase
    .from("union_cases")
    .select("id, delegation_id, folio, case_type, worker_snapshot")
    .eq("id", caseId)
    .single();

  if (caseErr || !c) {
    throw new Error(`Expediente de pasaje no encontrado (ID: ${caseId})`);
  }

  const typed = c as {
    id: string;
    delegation_id: string;
    folio: string;
    case_type: string;
    worker_snapshot?: Record<string, unknown> | null;
  };

  const { data: detail, error: detailErr } = await supabase
    .from("union_passage_cases")
    .select("*")
    .eq("case_id", caseId)
    .single();

  if (detailErr || !detail) {
    throw new Error(`Detalle de pasaje no encontrado para el expediente ${typed.folio}`);
  }

  const d = detail as PassageRow;
  const concept = d.concept === "026" ? "026" : "027";
  const documentType: "passage_026" | "passage_027" =
    concept === "026" ? "passage_026" : "passage_027";

  const { data: w } = await supabase
    .from("union_cases")
    .select("union_workers(first_name, paternal_surname, maternal_surname, siap_full_name, employee_number, category, assignment)")
    .eq("id", caseId)
    .single();

  const worker = (((w as unknown as { union_workers: WorkerRow | WorkerRow[] } | null)?.union_workers ?? {}) as WorkerRow | WorkerRow[]);
  const wr: WorkerRow = Array.isArray(worker) ? worker[0] : (worker as WorkerRow);

  // Compatibilidad: preferencia snapshot con nombre resoluble -> fallback union_worker actual
  const snap = (typed.worker_snapshot ?? null) as Record<string, unknown> | null;
  const snapResolved = snap
    ? resolveUnionWorkerName({
        first_name: (snap.first_name as string | null) ?? null,
        paternal_surname: (snap.paternal_surname as string | null) ?? null,
        maternal_surname: (snap.maternal_surname as string | null) ?? null,
        siap_full_name: (snap.siap_full_name as string | null) ?? null,
      })
    : null;

  const wrResolved = resolveUnionWorkerName(wr);
  const resolvedName =
    snapResolved && snapResolved.paternalSurname && snapResolved.givenNames
      ? snapResolved
      : wrResolved;

  const employeeNumber =
    wr?.employee_number || (typeof snap?.employee_number === "string" ? snap.employee_number : "");
  const category =
    wr?.category || (typeof snap?.category === "string" ? snap.category : "");
  const assignment =
    wr?.assignment || (typeof snap?.assignment === "string" ? snap.assignment : "");

  const dt = splitISO(d.request_date);
  const control = d.control_number || "pendiente";

  // Recuperar la plantilla oficial activa desde Supabase Storage
  const templateKind: UnionDocumentTemplateKind =
    concept === "026" ? "passage_026" : "passage_027";

  const template = await getActiveUnionDocumentTemplate({
    delegationId: typed.delegation_id,
    templateKind,
    supabase,
  });

  let pdfBytes: Uint8Array;
  let pageCount = 1;

  if (concept === "026") {
    pdfBytes = await buildPassage026Pdf(
      {
        ooad: d.ooad,
        day: dt.day,
        month: dt.month,
        year: dt.year,
        controlNumber: control,
        worker: {
          paternalSurname: resolvedName.paternalSurname,
          maternalSurname: resolvedName.maternalSurname,
          firstName: resolvedName.givenNames,
          employeeNumber,
          category,
          assignment,
        },
        extramuralFunctions: d.extramural_functions,
        transferPeriod: d.transfer_period,
        folioLabel: typed.folio,
      },
      template.buffer,
    );
    pageCount = 1;
  } else {
    const addr = (a: Record<string, string>) => ({
      street: a.street ?? "",
      neighborhood: a.neighborhood ?? "",
      postalCode: a.postalCode ?? a.postal_code ?? "",
      municipality: a.municipality ?? "",
      state: a.state ?? "",
    });

    pdfBytes = await buildPassage027Pdf(
      {
        ooad: d.ooad,
        day: dt.day,
        month: dt.month,
        year: dt.year,
        controlNumber: control,
        worker: {
          paternalSurname: resolvedName.paternalSurname,
          maternalSurname: resolvedName.maternalSurname,
          firstName: resolvedName.givenNames,
          employeeNumber,
          category,
          assignment,
        },
        discontinuousSchedule: d.discontinuous_schedule || "—",
        workerAddress: addr(d.worker_address ?? {}),
        assignmentAddress: addr(d.assignment_address ?? {}),
        phone: d.phone ?? "",
        folioLabel: typed.folio,
      },
      template.buffer,
    );
    pageCount = 2;
  }

  const buffer = Buffer.from(pdfBytes);
  const filename = `pasaje-${concept}-${typed.folio}.pdf`;

  return {
    buffer,
    documentType,
    delegationId: typed.delegation_id,
    caseId,
    folio: typed.folio,
    concept,
    filename,
    pageCount,
  };
}
