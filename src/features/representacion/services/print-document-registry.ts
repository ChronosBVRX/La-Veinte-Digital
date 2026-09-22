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
    default:
      throw new Error(
        `El tipo de trámite "${caseType}" no cuenta con un documento PDF imprimible configurado.`,
      );
  }
}


