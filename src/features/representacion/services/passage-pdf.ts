// Generación de PDFs de pasajes 026/027 mediante superposición de datos
// sobre plantillas PDF oficiales recuperadas de Supabase Storage privado.
// No se reconstruye el formato desde cero ni se crean páginas manuales.

import { fillPdfTemplate } from "./pdf-template-filler";
import {
  type PassagePdfWorker,
  type Passage026PdfInput,
  getPassage026FieldValues,
} from "../templates/passage-026-fields";
import {
  type PassageAddressPdf,
  type Passage027PdfInput,
  getPassage027FieldValues,
} from "../templates/passage-027-fields";

export type { PassagePdfWorker, Passage026PdfInput, PassageAddressPdf, Passage027PdfInput };

/**
 * Genera el formato oficial 026 rellenando los datos variables sobre la plantilla maestra (1 página).
 * Falla de forma controlada si no se proporciona plantilla o si la plantilla no tiene exactamente 1 página.
 */
export async function buildPassage026Pdf(
  input: Passage026PdfInput,
  templateBuffer: Buffer | Uint8Array,
): Promise<Uint8Array> {
  const fields = getPassage026FieldValues(input);
  return await fillPdfTemplate({
    templateBuffer,
    fields,
    expectedPageCount: 1,
  });
}

/**
 * Genera el formato oficial 027 rellenando los datos variables sobre la plantilla maestra (2 páginas).
 * Conserva la página 1 (solicitud) y la página 2 (aviso de privacidad institucional íntegro).
 * Falla de forma controlada si no se proporciona plantilla o si la plantilla no tiene exactamente 2 páginas.
 */
export async function buildPassage027Pdf(
  input: Passage027PdfInput,
  templateBuffer: Buffer | Uint8Array,
): Promise<Uint8Array> {
  const fields = getPassage027FieldValues(input);
  return await fillPdfTemplate({
    templateBuffer,
    fields,
    expectedPageCount: 2,
  });
}
