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

  // Date (right-aligned against right margin 570)
  const dateStr = data.placeDateString;
  const dateWidth = fontRegular.widthOfTextAtSize(dateStr, 9.5);
  drawWordTop(dateStr, Math.max(195, 570 - dateWidth), 160, 9.5, false);

  // Recipient
  drawWordTop(data.recipient.name, 195, 200, 9.5, true);
  drawWordTop(data.recipient.role, 195, 214, 9.5, true);
  drawWordTop("Presente.", 195, 228, 9.5, false);

  // Main Continuous Paragraph with Dynamic Word-Wrap
  const restText = data.worker.restDays?.trim()
    ? ` Descansos ${data.worker.restDays.trim()}`
    : "";
  const mainParagraphText = `Por medio de la presente y de la manera más atenta nos permitimos enviar a Usted solicitud de Licencia ${data.license.payKindWord} GOCE de sueldo por parte del C. ${data.worker.fullName} Con matrícula ${data.worker.employeeNumber} categoría ${data.worker.category} Por motivo ${data.license.reason} El cual solicita la fecha ${data.license.periodLabelWord} Turno ${data.worker.turn}${restText} (${data.license.totalDays} ${data.license.daysUnit})`;

  const words = mainParagraphText.split(/\s+/).filter(Boolean);
  const paragraphLines: string[] = [];
  let currentLine = "";
  const maxWidth = 375;
  const bodyFontSize = 9.5;

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    const w = fontRegular.widthOfTextAtSize(candidate, bodyFontSize);
    if (w <= maxWidth) {
      currentLine = candidate;
    } else {
      if (currentLine) paragraphLines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) paragraphLines.push(currentLine);

  let currentY = 265;
  const lineHeight = 16;
  for (const pLine of paragraphLines) {
    drawWordTop(pLine, 195, currentY, bodyFontSize, false);
    currentY += lineHeight;
  }

  // Closing Paragraph
  currentY += 12;
  drawWordTop(
    "Esperando respuesta y agradeciendo la atención a la presente le envío un cordial saludo.",
    195,
    currentY,
    bodyFontSize,
    false,
  );

  // Institutional Motto & Signatures Centered in the Content Column
  const contentCenterX = (195 + 570) / 2; // 382.5

  const mottoClean = `“${data.signers.institutionalMotto.replace(/^["“]|["”]$/g, "")}”`;
  const mottoW = fontBold.widthOfTextAtSize(mottoClean, 8.5);
  drawWordTop(mottoClean, contentCenterX - mottoW / 2, 480, 8.5, true);

  const committeeClean = data.signers.committeeName;
  const commW = fontRegular.widthOfTextAtSize(committeeClean, 8.5);
  drawWordTop(committeeClean, contentCenterX - commW / 2, 496, 8.5, false);

  const sigLine = "_______________________________________________";
  const lineW = fontRegular.widthOfTextAtSize(sigLine, 9);
  drawWordTop(sigLine, contentCenterX - lineW / 2, 550, 9, false);

  const signerNameClean = data.signers.signerName;
  const signerW = fontBold.widthOfTextAtSize(signerNameClean, 9);
  drawWordTop(signerNameClean, contentCenterX - signerW / 2, 566, 9, true);

  const signerRoleClean = data.signers.signerRole;
  const roleW = fontRegular.widthOfTextAtSize(signerRoleClean, 8.5);
  drawWordTop(signerRoleClean, contentCenterX - roleW / 2, 580, 8.5, false);

  const delegationClean = data.delegationCode || "XXI";
  const delW = fontRegular.widthOfTextAtSize(delegationClean, 8.5);
  drawWordTop(delegationClean, contentCenterX - delW / 2, 593, 8.5, false);

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
  if (data.worker.restDays?.trim()) {
    drawExcelTop(data.worker.restDays.trim(), 505, 44, 5, false);
  }

  // 2. Folio & Fecha de elaboración (Row 7) - vertically centered
  drawExcelTop(data.folio, 330, 122, 8, true);
  drawExcelTop(data.elaborationDay, 448, 122, 8, true);
  drawExcelTop(data.elaborationMonth, 492, 122, 8, true);
  drawExcelTop(data.elaborationYear, 530, 122, 8, true);

  // 3. Tipo de Licencia Checkboxes (Row 9, 11)
  // Perfectly centered inside boxes: H9 (x: 232), O9 (x: 395), H11 (x: 232), O11 (x: 395)
  if (data.license.withPay) {
    drawExcelTop("X", 232, 147, 10, true); // Con sueldo (H9)
  } else {
    const range = data.license.licenseRangeType;
    if (range === "r1_3") {
      drawExcelTop("X", 395, 147, 10, true); // Sin sueldo 1 a 3 (O9)
    } else if (range === "r4_60") {
      drawExcelTop("X", 232, 174, 10, true); // Sin sueldo 4 a 60 (H11)
    } else {
      drawExcelTop("X", 395, 174, 10, true); // Sin sueldo 61 a 365 (O11)
    }
  }

  // 4. Datos del trabajador (Row 15) - vertically centered
  drawExcelTop(data.worker.paternalSurname, 70, 230, 7.5, true);
  drawExcelTop(data.worker.maternalSurname, 180, 230, 7.5, true);
  drawExcelTop(data.worker.firstName, 300, 230, 7.5, true);
  drawExcelTop(data.worker.employeeNumber, 445, 230, 7.5, true);
  drawExcelTop(data.worker.turn, 525, 230, 7, true);

  // 5. Categoría (Row 17) - vertically centered
  drawExcelTop(data.worker.category, 70, 252, 7.5, true);

  // 6. Periodo que solicita (Row 21) - vertically centered
  drawExcelTop(data.license.startDay, 77, 298, 8, true);
  drawExcelTop(data.license.startMonth, 113, 298, 8, true);
  drawExcelTop(data.license.startYear, 145, 298, 8, true);
  drawExcelTop(data.license.endDay, 191, 298, 8, true);
  drawExcelTop(data.license.endMonth, 231, 298, 8, true);
  drawExcelTop(data.license.endYear, 262, 298, 8, true);

  // Licencias anteriores si existen
  if (data.license.previousStartDate) {
    const pS = data.license.previousStartDate.split("-");
    drawExcelTop(pS[2] ?? "", 302, 298, 8, true);
    drawExcelTop(pS[1] ?? "", 350, 298, 8, true);
    drawExcelTop(pS[0] ?? "", 399, 298, 8, true);
  }
  if (data.license.previousEndDate) {
    const pE = data.license.previousEndDate.split("-");
    drawExcelTop(pE[2] ?? "", 446, 298, 8, true);
    drawExcelTop(pE[1] ?? "", 490, 298, 8, true);
    drawExcelTop(pE[0] ?? "", 541, 298, 8, true);
  }

  // 7. Prórroga Checkbox (Row 24) - Rectangles matching XLSM DrawingML shapes:
  // SÍ box: [x: 103.87, y: 463.98, w: 18.1, h: 14.63]
  // NO box: [x: 128.97, y: 463.31, w: 16.78, h: 13.965]
  if (data.license.isExtension) {
    // SÍ is selected (solid black)
    excelPage.drawRectangle({
      x: 103.87,
      y: 463.98,
      width: 18.1,
      height: 14.63,
      color: rgb(0, 0, 0),
      borderColor: rgb(0, 0, 0),
      borderWidth: 1,
    });
    // NO is unselected (solid white with black outline)
    excelPage.drawRectangle({
      x: 128.97,
      y: 463.31,
      width: 16.78,
      height: 13.965,
      color: rgb(1, 1, 1),
      borderColor: rgb(0, 0, 0),
      borderWidth: 1.33,
    });
  } else {
    // SÍ is unselected (solid white with black outline)
    excelPage.drawRectangle({
      x: 103.87,
      y: 463.98,
      width: 18.1,
      height: 14.63,
      color: rgb(1, 1, 1),
      borderColor: rgb(0, 0, 0),
      borderWidth: 1.78,
    });
    // NO is selected (solid black)
    excelPage.drawRectangle({
      x: 128.97,
      y: 463.31,
      width: 16.78,
      height: 13.965,
      color: rgb(0, 0, 0),
      borderColor: rgb(0, 0, 0),
      borderWidth: 1,
    });
  }

  // 8. Total de días (Row 24)
  drawExcelTop(
    `${data.license.totalDays}  ${data.license.daysUnit}`,
    210,
    328,
    8,
    true,
  );

  // 9. Teléfono (Row 26)
  if (data.worker.phone?.trim()) {
    drawExcelTop(`TEL. ${data.worker.phone.trim()}`, 38, 495, 6, false);
  }

  // 10. Motivo y Comprobante (Rows 27, 28)
  drawExcelTop(data.license.reason, 160, 351, 7, false);
  drawExcelTop(data.license.proof, 160, 362, 7, false);

  // 11. Nombre en área de firma (Row 47) - cover residual background C. cleanly
  excelPage.drawRectangle({
    x: 70,
    y: excelHeight - 626,
    width: 220,
    height: 16,
    color: rgb(1, 1, 1),
  });
  drawExcelTop(`C. ${data.worker.fullName}`, 75, 617, 7, true);

  const finalPdfBytes = await outDoc.save();
  return {
    buffer: Buffer.from(finalPdfBytes),
    pageCount: outDoc.getPageCount(),
    wordVersion: wordVer,
    excelVersion: excelVer,
  };
}
