// Tipos y utilidades de presentación para documentos imprimibles sindicales.
// Seguro para importar en Client Components (sin dependencias de servidor ni I/O).

export type UnionPrintableDocumentType =
  | "license_package"
  | "passage_026"
  | "passage_027"
  | "locker_receipt";

export const PRINTABLE_DOCUMENT_LABELS: Record<UnionPrintableDocumentType, string> = {
  license_package: "Licencia",
  passage_026: "Pasaje 026",
  passage_027: "Pasaje 027",
  locker_receipt: "Recibo de Casillero 2026",
};

/**
 * Retorna la etiqueta amigable para la interfaz de usuario de la cola de impresión.
 * Si el tipo es desconocido o nuevo, retorna "Documento sindical" para evitar romper la UI.
 */
export function getPrintableDocumentLabel(documentType: string | null | undefined): string {
  if (!documentType) return "Documento sindical";
  return PRINTABLE_DOCUMENT_LABELS[documentType as UnionPrintableDocumentType] || "Documento sindical";
}

/**
 * Indica si un tipo de expediente cuenta con salida oficial imprimible en la cola.
 */
export function isPrintableCaseType(caseType: string): boolean {
  return caseType === "license" || caseType === "passage_026" || caseType === "passage_027";
}

