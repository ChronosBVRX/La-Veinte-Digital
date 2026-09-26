// Registro Central de Documentos Sindicales Imprimibles.
// Capa de abstracción para que cualquier trámite con PDF oficial use la misma cola de impresión.
// Fuente de verdad sobre tipos de documentos, metadatos y constructores de binarios.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { UnionCaseType } from "@/features/representacion/lib/folio";
import { buildUnionLicenseDocumentData } from "./license-document-dto";
import { buildLicensePrintPackage } from "./license-print-package";
import { buildPassageDocument } from "./passage-document-service";

import type { UnionPrintableDocumentType } from "../lib/print-document-types";
import {
  getPrintableDocumentLabel,
  isPrintableCaseType,
} from "../lib/print-document-types";

export type { UnionPrintableDocumentType };
export { getPrintableDocumentLabel, isPrintableCaseType };

export interface PrintableDocumentResult {
  buffer: Buffer;
  documentRevision: number;
  delegationId: string;
  folio: string;
  pageCount: number;
}

export interface PrintableDocumentDefinition {
  documentType: UnionPrintableDocumentType;
  caseType: UnionCaseType;
  label: string;
  defaultCopies: number;
  defaultDuplex: boolean;
  filename: (params: { folio: string; revision?: number }) => string;
  buildDocument: (params: {
    supabase: SupabaseClient<Database>;
    caseId: string;
  }) => Promise<PrintableDocumentResult>;
}

const REGISTRY: Record<UnionPrintableDocumentType, PrintableDocumentDefinition> = {
  license_package: {
    documentType: "license_package",
    caseType: "license",
    label: "Licencia",
    defaultCopies: 1,
    defaultDuplex: false,
    filename: ({ folio, revision }) => `licencia-${folio}-rev${revision ?? 1}.pdf`,
    buildDocument: async ({ supabase, caseId }) => {
      const docData = await buildUnionLicenseDocumentData(supabase, caseId);
      const printPackage = await buildLicensePrintPackage(docData, { supabase });
      return {
        buffer: printPackage.buffer,
        documentRevision: docData.revisionNumber || docData.documentRevision || 1,
        delegationId: docData.delegationId,
        folio: docData.folio,
        pageCount: printPackage.pageCount,
      };
    },
  },
  passage_026: {
    documentType: "passage_026",
    caseType: "passage_026",
    label: "Pasaje 026",
    defaultCopies: 1,
    defaultDuplex: false,
    filename: ({ folio }) => `pasaje-026-${folio}.pdf`,
    buildDocument: async ({ supabase, caseId }) => {
      const result = await buildPassageDocument(supabase, caseId);
      return {
        buffer: result.buffer,
        documentRevision: 1,
        delegationId: result.delegationId,
        folio: result.folio,
        pageCount: result.pageCount,
      };
    },
  },
  passage_027: {
    documentType: "passage_027",
    caseType: "passage_027",
    label: "Pasaje 027",
    defaultCopies: 1,
    defaultDuplex: false,
    filename: ({ folio }) => `pasaje-027-${folio}.pdf`,
    buildDocument: async ({ supabase, caseId }) => {
      const result = await buildPassageDocument(supabase, caseId);
      return {
        buffer: result.buffer,
        documentRevision: 1,
        delegationId: result.delegationId,
        folio: result.folio,
        pageCount: result.pageCount,
      };
    },
  },
  locker_receipt: {
    documentType: "locker_receipt",
    caseType: "locker",
    label: "Recibo de Casillero 2026",
    defaultCopies: 1,
    defaultDuplex: false,
    filename: ({ folio }) => `recibo-casillero-${folio}.pdf`,
    buildDocument: async ({ supabase, caseId }) => {
      const { data: c, error: caseErr } = await supabase
        .from("union_cases")
        .select("id, delegation_id, folio, case_type, worker_snapshot")
        .eq("id", caseId)
        .single();

      if (caseErr || !c) {
        throw new Error(`Expediente de casillero no encontrado (ID: ${caseId})`);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: lockerCase } = await (supabase as any)
        .from("union_locker_cases")
        .select("*")
        .eq("case_id", caseId)
        .maybeSingle();

      const snap = (c.worker_snapshot as Record<string, unknown>) || {};
      const fullName =
        typeof snap.siap_full_name === "string" && snap.siap_full_name
          ? snap.siap_full_name
          : `${snap.first_name || ""} ${snap.paternal_surname || ""} ${snap.maternal_surname || ""}`.trim() || "Trabajador Agremiado";

      const { buildLockerReceiptBuffer } = await import("./locker-receipt-pdf");

      const dateFormatted = new Intl.DateTimeFormat("es-MX", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "America/Mexico_City",
      }).format(new Date());

      const buffer = buildLockerReceiptBuffer({
        folio: c.folio,
        dateFormatted,
        worker: {
          name: fullName,
          employeeNumber: String(snap.employee_number || lockerCase?.employee_number || "N/A"),
          category: String(snap.category || lockerCase?.worker_category || ""),
          assignment: String(snap.assignment || lockerCase?.worker_assignment || "HGR No. 1 Charo"),
          turn: String(snap.turn || lockerCase?.worker_turn || "Jornada Ordinaria"),
          phone: String(lockerCase?.worker_phone || snap.phone || ""),
        },
        locker: {
          lockerNumber: String(lockerCase?.locker_number || "S/N"),
          zoneName: lockerCase?.zone_name || "Área General",
          bankName: lockerCase?.bank_name || "Mueble Estándar",
          physicalCode: lockerCase?.physical_code || undefined,
          condition: lockerCase?.condition || "ok",
          movementType: lockerCase?.movement_type || "actualizacion_2026",
          observations: lockerCase?.observations || undefined,
        },
      });

      return {
        buffer,
        documentRevision: 1,
        delegationId: c.delegation_id,
        folio: c.folio,
        pageCount: 1,
      };
    },
  },
};

/**
 * Obtiene la definición de un tipo de documento imprimible registrado.
 */
export function getPrintableDocumentDefinition(
  documentType: string,
): PrintableDocumentDefinition | null {
  return REGISTRY[documentType as UnionPrintableDocumentType] || null;
}

/**
 * Deriva el document_type imprimible a partir del case_type del expediente en base de datos.
 * Evita que el cliente web decida arbitrariamente qué tipo documental corresponde.
 */
export function resolvePrintableDocumentTypeForCase(
  caseType: string,
): UnionPrintableDocumentType {
  switch (caseType) {
    case "license":
      return "license_package";
    case "passage_026":
      return "passage_026";
    case "passage_027":
      return "passage_027";
    case "locker":
      return "locker_receipt";
    default:
      throw new Error(
        `El tipo de trámite "${caseType}" no cuenta con un documento PDF imprimible configurado.`,
      );
  }
}



