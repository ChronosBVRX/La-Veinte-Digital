import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { normalizeText } from "../core/normalize";

const require = createRequire(import.meta.url);

export interface PageText {
  pageIndex: number;
  printedPage: string | null;
  text: string;
}

export interface ExtractionResult {
  numPages: number;
  pages: PageText[];
  rawText: string;
  normalizedText: string;
  needsOcr: boolean;
}

interface PdfItem {
  x: number;
  y: number;
  s: string;
  h: number;
}

function pdfjsStandardFontsDir(): string {
  const base = path.dirname(require.resolve("pdfjs-dist/package.json"));
  return path.join(base, "standard_fonts");
}

export async function extractPdfPages(data: Uint8Array): Promise<ExtractionResult> {
  const task = getDocument({
    data,
    useSystemFonts: false,
    standardFontDataUrl: pathToFileURL(pdfjsStandardFontsDir() + path.sep).href,
  });
  const doc = await task.promise;

  const pages: PageText[] = [];
  const rawParts: string[] = [];
  let totalTextLen = 0;

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const items: PdfItem[] = tc.items
      .filter((it) => typeof (it as { str?: string }).str === "string")
      .map((it) => {
        const t = (it as { transform: number[] }).transform;
        return { x: t[4], y: t[5], s: (it as { str: string }).str, h: Math.abs(t[3]) };
      });

    items.sort((a, b) => b.y - a.y || a.x - b.x);

    const heights = items.map((i) => i.h).sort((a, b) => a - b);
    const medianH = heights.length ? heights[Math.floor(heights.length / 2)] : 10;
    const tol = Math.max(1.5, medianH * 0.35);

    const lines: string[] = [];
    let cur = "";
    let curY: number | null = null;
    for (const it of items) {
      if (it.s === "") continue;
      if (curY === null || Math.abs(it.y - curY) > tol) {
        if (cur.trim()) lines.push(cur.trim());
        cur = it.s;
        curY = it.y;
      } else if (cur.endsWith("-")) {
        cur = cur.slice(0, -1) + it.s;
      } else if (cur.endsWith(" ") || it.s.startsWith(" ") || /^[.,;:)\]»]/.test(it.s)) {
        cur += it.s;
      } else {
        cur += " " + it.s;
      }
    }
    if (cur.trim()) lines.push(cur.trim());

    const text = lines.join("\n");
    totalTextLen += text.length;
    rawParts.push(`===PAGE ${p}===` + "\n" + text);

    const printed = detectPrintedPage(text);
    pages.push({ pageIndex: p, printedPage: printed, text });
  }

  const rawText = rawParts.join("\n\n");
  const normalizedText = normalizeText(rawText);
  const needsOcr = totalTextLen < doc.numPages * 20 && doc.numPages > 3;

  await task.destroy();
  return { numPages: doc.numPages, pages, rawText, normalizedText, needsOcr };
}

export function detectPrintedPage(pageText: string): string | null {
  const lines = pageText.split("\n").filter((l) => l.trim().length > 0);
  for (let i = lines.length - 1; i >= 0 && i >= lines.length - 4; i--) {
    const t = lines[i].trim();
    if (/^\d{1,4}$/.test(t)) return t;
  }
  return null;
}

export interface OcrResult {
  pages: PageText[];
  fullText: string;
  meanConfidence: number;
  confidences: number[];
}

/**
 * OCR de PDFs escaneados. El original.pdf NUNCA se modifica: se genera ocr.txt
 * y ocr-confidence.json junto al original. Rasteriza con mupdf (WASM, sin
 * dependencias nativas) y reconoce con tesseract.js (modelo spa local).
 */
export async function ocrPdfPages(
  pdfPath: string,
  opts: { lang?: string; log?: (msg: string) => void } = {}
): Promise<OcrResult> {
  const mupdf = await import("mupdf");
  const { createWorker } = await import("tesseract.js");

  const repoRoot = process.cwd();
  const langPath = path.join(repoRoot, "public", "vendor", "tesseract", "lang");
  const hasLocalLang = fs.existsSync(path.join(langPath, "spa.traineddata.gz"));

  const worker = await createWorker(opts.lang ?? "spa", 1, {
    langPath: hasLocalLang ? langPath : undefined,
  });

  const pdfBuf = fs.readFileSync(pdfPath);
  const doc = mupdf.Document.openDocument(pdfBuf, "application/pdf");
  const numPages = doc.countPages();

  const pages: PageText[] = [];
  const confidences: number[] = [];
  const matrix = mupdf.Matrix.scale(2.2, 2.2);

  for (let i = 0; i < numPages; i++) {
    const page = doc.loadPage(i);
    const pixmap = page.toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, false, true);
    const png = pixmap.asPNG();
    const res = await worker.recognize(Buffer.from(png));
    const text = res.data.text ?? "";
    confidences.push(res.data.confidence ?? 0);
    pages.push({
      pageIndex: i + 1,
      printedPage: detectPrintedPage(text),
      text: text.trim(),
    });
    if (opts.log && (i === 0 || i % 5 === 4 || i === numPages - 1)) {
      opts.log(`OCR página ${i + 1}/${numPages} (confianza ${(res.data.confidence ?? 0).toFixed(0)})`);
    }
  }

  await worker.terminate();

  const meanConfidence =
    confidences.length > 0 ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 0;
  const fullText = pages.map((p) => `===PAGE ${p.pageIndex}===\n${p.text}`).join("\n\n");

  return { pages, fullText, meanConfidence, confidences };
}

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú",
  Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú",
  ntilde: "ñ", Ntilde: "Ñ", uuml: "ü", Uuml: "Ü", iexcl: "¡", iquest: "¿",
  ordm: "º", ordf: "ª", laquo: "«", raquo: "»", bull: "•", middot: "·",
  mdash: "—", ndash: "–", deg: "°", times: "×", divide: "÷", sect: "§",
};

export function htmlToText(html: string): string {
  const out = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<(br|hr)\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr|table|section|article|blockquote)>/gi, "\n")
    .replace(/<(p|div|h[1-6]|li)[^>]*>/gi, "\n")
    .replace(/<\/(td|th)>/gi, " | ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (_m, code: string) => {
      if (code.startsWith("#x")) return String.fromCodePoint(parseInt(code.slice(2), 16));
      if (code.startsWith("#")) return String.fromCodePoint(parseInt(code.slice(1), 10));
      return ENTITIES[code] ?? `&${code};`;
    })
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
  return normalizeText(out);
}
