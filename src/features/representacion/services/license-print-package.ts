import fs from "node:fs";
import path from "node:path";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { UnionLicenseDocumentData } from "./license-document-dto";
import { getActiveUnionDocumentTemplate } from "./union-document-template-repository";

const LOCAL_WORD_PRINT_PATH = path.join(
  process.cwd(),
  "assets/templates/union/licencias/oficio-licencia-delegacion-xxi.pdf",
);

const LOCAL_EXCEL_PRINT_PATH = path.join(
  process.cwd(),
  "assets/templates/union/licencias/formato-licencia-1A74-009-036-v2.pdf",
);

export interface BuildLicensePrintPackageOptions {
  wordPdfBuffer?: Buffer;
  excelPdfBuffer?: Buffer;
  supabase?: SupabaseClient<Database>;
}

export interface LicensePrintPackageResult {
  buffer: Buffer;
  pageCount: number;
  wordVersion?: string;
  excelVersion?: string;
}

/**
 * Generates the unified two-page print package PDF:
 * - Page 1: Oficio de Licencia (Word layout)
 * - Page 2: Solicitud de Licencia Formato 1A74-009-036 (Excel layout)
 *
 * Runs 100% in-memory using pdf-lib and official institutional print masters.
 * Zero dependency on Microsoft Office COM on Linux/Vercel serverless.
 */
export async function buildLicensePrintPackage(
  data: UnionLicenseDocumentData,
  options: BuildLicensePrintPackageOptions = {},
): Promise<LicensePrintPackageResult> {
  let wordBuf = options.wordPdfBuffer;
  let wordVer: string | undefined;
  let excelBuf = options.excelPdfBuffer;
  let excelVer: string | undefined;

  // 1. Resolve Word print master PDF
  if (!wordBuf) {
    try {
      const t = await getActiveUnionDocumentTemplate({
        delegationId: data.delegationId,
        templateKind: "license_word_print",
        supabase: options.supabase,
      });
      wordBuf = t.buffer;
      wordVer = t.record.version;
    } catch {
      if (fs.existsSync(LOCAL_WORD_PRINT_PATH)) {
        wordBuf = fs.readFileSync(LOCAL_WORD_PRINT_PATH);
        wordVer = "local-fallback";
      } else {
        throw new Error(
          `Plantilla Word Print Master no encontrada en Storage ni en fallback: ${LOCAL_WORD_PRINT_PATH}`,
        );
      }
    }
  }

  // 2. Resolve Excel print master PDF
  if (!excelBuf) {
    try {
      const t = await getActiveUnionDocumentTemplate({
        delegationId: data.delegationId,
        templateKind: "license_excel_print",
        supabase: options.supabase,
      });
      excelBuf = t.buffer;
      excelVer = t.record.version;
    } catch {
      if (fs.existsSync(LOCAL_EXCEL_PRINT_PATH)) {
        excelBuf = fs.readFileSync(LOCAL_EXCEL_PRINT_PATH);
        excelVer = "local-fallback";
      } else {
        throw new Error(
          `Plantilla Excel Print Master no encontrada en Storage ni en fallback: ${LOCAL_EXCEL_PRINT_PATH}`,
        );
      }
    }
  }

  // 3. Create target combined PDF
  const outDoc = await PDFDocument.create();

  // Embedded standard fonts
  const fontBold = await outDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await outDoc.embedFont(StandardFonts.Helvetica);

  // -------------------------------------------------------------
  // PAGE 1: OFICIO DE LICENCIA (WORD MASTER)
  // -------------------------------------------------------------
  const wordSrcDoc = await PDFDocument.load(wordBuf);
  const [wordPageCopy] = await outDoc.copyPages(wordSrcDoc, [0]);
  const wordPage = outDoc.addPage(wordPageCopy);
  const wordHeight = wordPage.getHeight();

  const drawWordTop = (
    text: string,
    x: number,
    topY: number,
    size = 9.5,
    isBold = false,
  ) => {
    if (!text) return;
    wordPage.drawText(text, {
      x,
      y: wordHeight - topY,
      size,
      font: isBold ? fontBold : fontRegular,
      color: rgb(0, 0, 0),
    });
  };

  // Date
  drawWordTop(data.placeDateString, 280, 160, 10, false);

  // Recipient
  drawWordTop(data.recipient.name, 195, 200, 10, true);
  drawWordTop(data.recipient.role, 195, 214, 10, true);
  drawWordTop("Presente.", 195, 228, 10, false);

  // Body Paragraph
  const bodyY = 260;
  drawWordTop(
    "Por medio de la presente y de la manera más atenta nos permitimos enviar",
    195,
    bodyY,
    9.5,
    false,
  );
  drawWordTop(
    `a Usted solicitud de Licencia ${data.license.payKindWord} GOCE de sueldo por parte del trabajador:`,
    195,
    bodyY + 14,
    9.5,
    false,
  );

  drawWordTop(`C. ${data.worker.fullName}`, 195, bodyY + 36, 10, true);
  drawWordTop(`Matrícula: ${data.worker.employeeNumber}`, 195, bodyY + 52, 9.5, false);
  drawWordTop(`Categoría: ${data.worker.category}`, 195, bodyY + 66, 9.5, false);
  drawWordTop(`Adscripción: ${data.worker.assignment}`, 195, bodyY + 80, 9.5, false);
  drawWordTop(`Turno: ${data.worker.turn}`, 195, bodyY + 94, 9.5, false);
  drawWordTop(
    `Horario: ${data.worker.schedule}    Descansos: ${data.worker.restDays}`,
    195,
    bodyY + 108,
    9.5,
    false,
  );

  drawWordTop(
    `Por el periodo comprendido: ${data.license.periodLabelWord} (${data.license.totalDays} ${data.license.daysUnit})`,
    195,
    bodyY + 130,
    9.5,
    true,
  );
  drawWordTop(`Motivo: ${data.license.reason}`, 195, bodyY + 146, 9.5, false);

  drawWordTop(
    "Esperando respuesta y agradeciendo la atención a la presente le envío un cordial saludo.",
    195,
    bodyY + 175,
    9.5,
    false,
  );

  // Institutional Motto & Signatures
  drawWordTop(
    `“${data.signers.institutionalMotto.replace(/^["“]|["”]$/g, "")}”`,
    230,
    485,
    8.5,
    true,
  );
  drawWordTop(data.signers.committeeName, 320, 500, 8.5, false);

  drawWordTop("_______________________________________________", 270, 560, 9, false);
  drawWordTop(data.signers.signerName, 285, 575, 9, true);
  drawWordTop(data.signers.signerRole, 325, 588, 8.5, false);

  // -------------------------------------------------------------
  // PAGE 2: SOLICITUD DE LICENCIA 1A74-009-036 (EXCEL MASTER V2)
  // -------------------------------------------------------------
  const excelSrcDoc = await PDFDocument.load(excelBuf);
  const [excelPageCopy] = await outDoc.copyPages(excelSrcDoc, [0]);
  const excelPage = outDoc.addPage(excelPageCopy);
  const excelHeight = excelPage.getHeight();

  const drawExcelTop = (
    text: string,
    x: number,
    topY: number,
    size = 8,
    isBold = true,
  ) => {
    if (!text) return;
    excelPage.drawText(text, {
      x,
      y: excelHeight - topY,
      size,
      font: isBold ? fontBold : fontRegular,
      color: rgb(0, 0, 0),
    });
  };

  // 1. Horario & Descansos (Row 1-2)
  drawExcelTop(data.worker.schedule, 505, 33, 6, false);
  drawExcelTop(data.worker.restDays, 505, 44, 5, false);

  // 2. Folio & Fecha de elaboración (Row 7)
  drawExcelTop(data.folio, 330, 117, 8, true);
  drawExcelTop(data.elaborationDay, 448, 117, 8, true);
  drawExcelTop(data.elaborationMonth, 492, 117, 8, true);
  drawExcelTop(data.elaborationYear, 530, 117, 8, true);

  // 3. Tipo de Licencia Checkboxes (Row 9, 11)
  if (data.license.withPay) {
    drawExcelTop("X", 234, 147, 10, true); // Con sueldo
  } else {
    const range = data.license.licenseRangeType;
    if (range === "r1_3") {
      drawExcelTop("X", 400, 147, 10, true); // Sin sueldo 1 a 3
    } else if (range === "r4_60") {
      drawExcelTop("X", 234, 174, 10, true); // Sin sueldo 4 a 60
    } else {
      drawExcelTop("X", 400, 174, 10, true); // Sin sueldo 61 a 365
    }
  }

  // 4. Datos del trabajador (Row 15)
  drawExcelTop(data.worker.paternalSurname, 70, 226, 8, true);
  drawExcelTop(data.worker.maternalSurname, 180, 226, 8, true);
  drawExcelTop(data.worker.firstName, 300, 226, 8, true);
  drawExcelTop(data.worker.employeeNumber, 445, 226, 8, true);
  drawExcelTop(data.worker.turn, 525, 226, 7, true);

  // 5. Categoría (Row 17)
  drawExcelTop(data.worker.category, 70, 248, 8, true);

  // 6. Periodo que solicita (Row 21)
  drawExcelTop(data.license.startDay, 77, 294, 8, true);
  drawExcelTop(data.license.startMonth, 113, 294, 8, true);
  drawExcelTop(data.license.startYear, 145, 294, 8, true);
  drawExcelTop(data.license.endDay, 191, 294, 8, true);
  drawExcelTop(data.license.endMonth, 231, 294, 8, true);
  drawExcelTop(data.license.endYear, 262, 294, 8, true);

  // Licencias anteriores si existen
  if (data.license.previousStartDate) {
    const pS = data.license.previousStartDate.split("-");
    drawExcelTop(pS[2] ?? "", 302, 294, 8, true);
    drawExcelTop(pS[1] ?? "", 350, 294, 8, true);
    drawExcelTop(pS[0] ?? "", 399, 294, 8, true);
  }
  if (data.license.previousEndDate) {
    const pE = data.license.previousEndDate.split("-");
    drawExcelTop(pE[2] ?? "", 446, 294, 8, true);
    drawExcelTop(pE[1] ?? "", 490, 294, 8, true);
    drawExcelTop(pE[0] ?? "", 541, 294, 8, true);
  }

  // 7. Prórroga Checkbox (Row 24)
  if (data.license.isExtension) {
    drawExcelTop("X", 76, 326, 10, true); // SÍ
  } else {
    drawExcelTop("X", 128, 326, 10, true); // NO
  }

  // 8. Total de días (Row 24)
  drawExcelTop(
    `${data.license.totalDays}  ${data.license.daysUnit}`,
    210,
    326,
    8,
    true,
  );

  // 9. Teléfono (Row 26)
  if (data.worker.phone) {
    drawExcelTop(`TEL. ${data.worker.phone}`, 38, 495, 6, false);
  }

  // 10. Motivo y Comprobante (Rows 27, 28)
  drawExcelTop(data.license.reason, 160, 349, 7, false);
  drawExcelTop(data.license.proof, 160, 359, 7, false);

  // 11. Nombre en área de firma (Row 47)
  drawExcelTop(`C. ${data.worker.fullName}`, 75, 617, 7, true);

  const finalPdfBytes = await outDoc.save();
  return {
    buffer: Buffer.from(finalPdfBytes),
    pageCount: outDoc.getPageCount(),
    wordVersion: wordVer,
    excelVersion: excelVer,
  };
}
