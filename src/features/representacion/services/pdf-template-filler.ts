import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export interface PdfOverlayField {
  page?: number; // 0-indexed, default 0
  x: number;
  y: number;
  width?: number;
  height?: number;
  fontSize: number;
  minFontSize?: number;
  align?: "left" | "center" | "right";
  bold?: boolean;
  multiline?: boolean;
  lineHeight?: number;
  color?: { r: number; g: number; b: number };
}

export interface PdfFieldValue {
  field: PdfOverlayField;
  value: string;
}

export class PdfTemplateFillerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PdfTemplateFillerError";
  }
}

const DEFAULT_INK = rgb(0.08, 0.08, 0.08);

/**
 * Superpone un campo de texto sobre una página de PDF aplicando
 * auto-escalado hacia abajo hasta minFontSize si excede el ancho o alto.
 */
export function drawOverlayField(
  page: PDFPage,
  font: PDFFont,
  boldFont: PDFFont,
  field: PdfOverlayField,
  text: string,
): void {
  const val = (text ?? "").trim();
  if (!val) return;

  const activeFont = field.bold ? boldFont : font;
  const minSize = field.minFontSize ?? 5.5;
  let currentSize = field.fontSize;
  const textColor = field.color ? rgb(field.color.r, field.color.g, field.color.b) : DEFAULT_INK;

  // 1. Campo de una sola línea con auto-escalado
  if (!field.multiline) {
    if (field.width && field.width > 0) {
      while (currentSize > minSize && activeFont.widthOfTextAtSize(val, currentSize) > field.width) {
        currentSize -= 0.25;
      }
    }
    const textWidth = activeFont.widthOfTextAtSize(val, currentSize);
    let drawX = field.x;
    if (field.align === "center") {
      drawX = field.x - textWidth / 2;
    } else if (field.align === "right") {
      drawX = field.x - textWidth;
    }

    page.drawText(val, {
      x: drawX,
      y: field.y,
      size: currentSize,
      font: activeFont,
      color: textColor,
    });
    return;
  }

  // 2. Campo multilínea con auto-envoltura y auto-escalado
  const maxWidth = field.width ?? 300;
  const maxHeight = field.height ?? 50;
  const words = val.split(/\s+/);

  function wrapText(size: number): string[] {
    const lines: string[] = [];
    let curLine = "";
    for (const w of words) {
      const testLine = curLine ? `${curLine} ${w}` : w;
      if (activeFont.widthOfTextAtSize(testLine, size) <= maxWidth) {
        curLine = testLine;
      } else {
        if (curLine) lines.push(curLine);
        curLine = w;
      }
    }
    if (curLine) lines.push(curLine);
    return lines;
  }

  let lines = wrapText(currentSize);
  let lHeight = field.lineHeight ?? currentSize * 1.25;
  while (currentSize > minSize && lines.length * lHeight > maxHeight) {
    currentSize -= 0.5;
    lHeight = field.lineHeight ?? currentSize * 1.25;
    lines = wrapText(currentSize);
  }

  let curY = field.y;
  for (const line of lines) {
    const lineW = activeFont.widthOfTextAtSize(line, currentSize);
    let drawX = field.x;
    if (field.align === "center") {
      drawX = field.x - lineW / 2;
    } else if (field.align === "right") {
      drawX = field.x - lineW;
    }
    page.drawText(line, {
      x: drawX,
      y: curY,
      size: currentSize,
      font: activeFont,
      color: textColor,
    });
    curY -= lHeight;
  }
}

export interface FillPdfTemplateOptions {
  templateBuffer: Buffer | Uint8Array;
  fields: PdfFieldValue[];
  expectedPageCount?: number;
}

/**
 * Carga un PDF maestro desde su buffer, valida la cantidad de páginas esperadas
 * e inserta de forma declarativa cada campo de datos variables.
 */
export async function fillPdfTemplate(options: FillPdfTemplateOptions): Promise<Uint8Array> {
  const { templateBuffer, fields, expectedPageCount } = options;

  if (!templateBuffer || templateBuffer.length === 0) {
    throw new PdfTemplateFillerError("El buffer de la plantilla PDF está vacío.");
  }

  const doc = await PDFDocument.load(templateBuffer);
  const pageCount = doc.getPageCount();

  if (expectedPageCount !== undefined && pageCount !== expectedPageCount) {
    throw new PdfTemplateFillerError(
      `Cantidad de páginas inesperada en la plantilla: se esperaban ${expectedPageCount} pero el documento tiene ${pageCount}.`,
    );
  }

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  for (const { field, value } of fields) {
    const pageIndex = field.page ?? 0;
    if (pageIndex < 0 || pageIndex >= pageCount) {
      throw new PdfTemplateFillerError(
        `Índice de página inválido (${pageIndex}) para documento con ${pageCount} página(s).`,
      );
    }
    const page = doc.getPage(pageIndex);
    drawOverlayField(page, font, boldFont, field, value);
  }

  return await doc.save();
}
