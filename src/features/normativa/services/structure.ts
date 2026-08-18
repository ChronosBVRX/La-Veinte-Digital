import type { DocumentChunk, DocumentCitation, DocumentSection, DocType } from "../core/types";
import type { PageText } from "./extractor";

export interface StructureParseResult {
  sections: DocumentSection[];
  chunks: DocumentChunk[];
  citations: DocumentCitation[];
  lastReformDate: string | null;
  docTitle: string | null;
  docKey: string | null;
  keyMatch: boolean;
  stFormats: string[];
}

const RE = {
  lawTitulo: /^(T[ÍI]TULO)\s+([IVXLC]+|[A-ZÑÁÉÍÓÚ]+|[0-9]+)\b.*$/i,
  lawCapitulo: /^(CAP[ÍI]TULO)\s+([IVXLC]+|[A-ZÑÁÉÍÓÚ]+|[0-9]+)\b.*$/i,
  lawSeccion: /^(SECCI[ÓO]N)\s+([IVXLC]+|[A-ZÑÁÉÍÓÚ]+|[0-9]+)\b.*$/i,
  articulo: /^Art[íi]culo\s+(\d+(?:\s*(?:Bis|Ter|Qu[áa]ter|Quinquies|Sexties|Septies|Octies|Nonies|Decies))?)[\s.:—-]/i,
  cctCapitulo: /^Cap[íi]tulo\s+([IVXLC]+|[0-9]+)\s*[\.:—-]?\s*(.*)$/i,
  cctClausula: /^Cl[áa]usula\s+(\d+)\s*(Bis|Ter|Qu[áa]ter|Quinquies)?\s*[\.:—-]/i,
  cctBlock: /^(REGLAMENTO|R[ÉE]GIMEN|CONVENIO|ANEXO|TABLA|CAT[ÁA]LOGO|PROFESIOGRAMA)\b/i,
  cctFront: /^(CONTRATO COLECTIVO|CONTENIDO|PRESENTACI[ÓO]N|DECLARACI[ÓO]N)/i,
  transitorios: /^TRANSITORIOS[\s.:—-]*/i,
  procedimientoHeading:
    /^\s*(?:\d+[\.\)\-]\s*)?(OBJETIVO|ALCANCE|ÁMBITO DE APLICACI[ÓO]N|AMBITO DE APLICACION|BASE NORMATIVA|BASES LEGALES|MARCO NORMATIVO|MARCO JUR[ÍI]DICO|DEFINICIONES|GLOSARIO|POL[ÍI]TICAS|NORMAS GENERALES|DESCRIPCI[ÓO]N (?:DE ACTIVIDADES|DEL PROCEDIMIENTO|DEL PROCESO)|DESARROLLO|DIAGRAMA|RESPONSABLES|DOCUMENTOS DE REFERENCIA|REGISTROS|CONTROL DE CAMBIOS|ANEXOS|CONTENIDO|[ÍI]NDICE)\b/i,
  nomHeading:
    /^\s*(?:\d+[\.\)\-]\s*)?(OBJETIVO|CAMPO DE APLICACI[ÓO]N|REFERENCIAS|DEFINICIONES|OBLIGACIONES (?:DEL PATR[ÓO]N|DE LOS TRABAJADORES)?|PROCEDIMIENTO(?: PARA LA EVALUACI[ÓO]N)?|VIGILANCIA|UNIDADES DE VERIFICACI[ÓO]N|CONCORDANCIA|BIBLIOGRAF[ÍI]A|TRANSITORIOS|AP[ÉE]NDICE|DISPOSICIONES GENERALES)\b/i,
  clave: /(?:Clave|CLAVE)\s*:?\s*([A-Z0-9]{2,8}-\d{3}-\d{3})/,
  reforma:
    /(?:(?:[ÚUu�]ltima|ULTIMA|ULTIMAS)s?\s*(?:reformas?|Reformas?|REFORMAS?)(?:\s*publicadas?)?\s*DOF|Última\s*[Rr]eforma\s*DOF|Ultima\s*[Rr]eforma\s*DOF|REFORMAS?\s+DOF)\s*[:.]?\s*(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/i,
  stFormat: /\b(ST-\d{1,2})\b/g,
  numeral: /^(FRACCI[ÓO]N|NUMERAL)\s+([IVXLC0-9]+)/i,
};

function isStandaloneNumber(line: string): boolean {
  return /^\d{1,4}$/.test(line.trim());
}

function looksLikeIndexLine(line: string): boolean {
  return /[\.\s]{3,}\d{1,4}\s*$/.test(line);
}

export function parseStructure(params: {
  docId: string;
  versionId: string;
  type: DocType;
  pages: PageText[];
  expectedKey?: string | null;
}): StructureParseResult {
  const { docId, versionId, type, pages, expectedKey } = params;

  const sections: DocumentSection[] = [];
  const chunks: DocumentChunk[] = [];
  const citations: DocumentCitation[] = [];
  const stFormats = new Set<string>();
  const docKeys = new Set<string>();

  const seen = new Map<string, string>();
  let sectionCounter = 0;
  let chunkCounter = 0;
  let currentSectionId: string | null = null;
  let currentArticle: string | null = null;
  let currentClause: string | null = null;
  let lastReformDate: string | null = null;
  let docKey: string | null = null;
  let docTitle: string | null = null;
  let topParent: string | null = null;

  const addSection = (kind: string, label: string, page: number, parentId: string | null) => {
    const key = `${kind}::${label}`;
    if (seen.has(key)) return null;
    sectionCounter++;
    const id = `${versionId}-s${sectionCounter}`;
    seen.set(key, id);
    sections.push({
      id,
      documentId: docId,
      versionId,
      kind,
      label,
      order: sectionCounter,
      startPage: page,
      endPage: null,
      parentId,
    });
    return id;
  };

  const matchHeading = (line: string): { kind: string; label: string; parent: string | null } | null => {
    if (type === "federal_law" || type === "federal_regulation" || type === "institutional_regulation" || type === "regulation") {
      if (RE.lawTitulo.test(line) && line.length < 90) {
        topParent = null;
        return { kind: "titulo", label: line, parent: null };
      } else if (RE.lawCapitulo.test(line) && line.length < 90) {
        return { kind: "capitulo", label: line, parent: topParent };
      } else if (RE.lawSeccion.test(line) && line.length < 90) {
        return { kind: "seccion", label: line, parent: topParent };
      } else if (RE.transitorios.test(line)) {
        return { kind: "transitorios", label: "TRANSITORIOS", parent: null };
      } else if (RE.articulo.test(line) && line.length < 140 && !looksLikeIndexLine(line)) {
        const num = line.match(RE.articulo)![1].trim();
        currentArticle = num;
        return { kind: "articulo", label: `Artículo ${num}`, parent: topParent };
      }
    } else if (type === "collective_agreement") {
      if (RE.cctFront.test(line) || /^C L A U S U L A S$/.test(line) || /^CLÁUSULAS$/i.test(line)) {
        return null;
      }
      if (RE.cctCapitulo.test(line) && line.length < 100) {
        return { kind: "capitulo", label: line, parent: null };
      } else if (RE.cctBlock.test(line) && line.length < 130) {
        currentClause = null;
        return { kind: "bloque", label: line, parent: null };
      } else if (RE.transitorios.test(line)) {
        return { kind: "transitorios", label: "TRANSITORIOS", parent: null };
      } else if (RE.cctClausula.test(line) && line.length < 140 && !looksLikeIndexLine(line)) {
        const m = line.match(RE.cctClausula)!;
        const num = `${m[1]}${m[2] ? ` ${m[2]}` : ""}`;
        currentClause = num;
        return { kind: "clausula", label: `Cláusula ${num}`, parent: null };
      }
    } else if (type === "procedure") {
      if (RE.procedimientoHeading.test(line) && line.length < 100) {
        return { kind: "seccion", label: line, parent: null };
      } else if (/^ANEXO\s+/i.test(line) && line.length < 130) {
        return { kind: "anexo", label: line, parent: null };
      }
    } else if (type === "NOM") {
      if (RE.nomHeading.test(line) && line.length < 100) {
        return { kind: "seccion", label: line, parent: null };
      }
    }
    return null;
  };

  let paragraph: string[] = [];
  let paragraphContext: { sectionId: string | null; article: string | null; clause: string | null } =
    { sectionId: currentSectionId, article: currentArticle, clause: currentClause };

  const flushParagraph = (p: number, printedPage: string | null) => {
    const text = paragraph.filter((l) => !isStandaloneNumber(l.trim())).join(" ").trim();
    if (!text) {
      paragraph = [];
      return;
    }
    const ctx = paragraphContext;
    const contextKey = `${ctx.sectionId ?? ""}|${ctx.article ?? ""}|${ctx.clause ?? ""}`;
    const last = chunks[chunks.length - 1];
    const lastKey = last ? `${last.sectionId ?? ""}|${last.article ?? ""}|${last.clause ?? ""}` : null;
    if (last && last.pdfPageIndex === p && lastKey === contextKey && last.text.length + text.length <= 1400) {
      last.text += "\n" + text;
      if (citations.length > 0) {
        citations[citations.length - 1].text = last.text.slice(0, 900);
      }
    } else {
      chunkCounter++;
      const id = `${versionId}-c${chunkCounter}`;
      const section = ctx.sectionId ? sections.find((s) => s.id === ctx.sectionId) : null;
      chunks.push({
        id,
        documentId: docId,
        versionId,
        sectionId: ctx.sectionId,
        pdfPageIndex: p,
        printedPage,
        section: section ? section.label : null,
        article: ctx.article,
        clause: ctx.clause,
        numeral: null,
        text,
        order: chunkCounter,
      });
      citations.push({
        documentId: docId,
        versionId,
        pdfPage: p,
        printedPage,
        section: section ? section.label : null,
        article: ctx.article,
        clause: ctx.clause,
        numeral: null,
        text: text.slice(0, 900),
      });
    }
    paragraph = [];
  };

  for (const page of pages) {
    const p = page.pageIndex;
    const lines = page.text.split("\n");

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        flushParagraph(p, page.printedPage);
        continue;
      }
      if (isStandaloneNumber(line)) continue;

      if (!lastReformDate) {
        const m = line.match(RE.reforma);
        if (m) {
          const y = m[3].length === 2 ? `20${m[3]}` : m[3];
          lastReformDate = `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
        }
      }
      {
        const m = line.match(RE.clave);
        if (m) {
          docKeys.add(m[1]);
          if (!docKey || (expectedKey && m[1] === expectedKey)) docKey = m[1];
        }
      }
      for (const m of line.matchAll(RE.stFormat)) {
        stFormats.add(m[1]);
      }
      if (
        !docTitle &&
        p <= 3 &&
        line.length >= 20 &&
        line.length <= 220 &&
        /^[A-ZÁÉÍÓÚÑ]/.test(line) &&
        /[a-záéíóúñ]/.test(line) &&
        line.split(/\s+/).length >= 4 &&
        !RE.clave.test(line)
      ) {
        docTitle = line;
      }

      const matched = matchHeading(line);
      if (matched) {
        flushParagraph(p, page.printedPage);
        const sid = addSection(matched.kind, matched.label, p, matched.parent);
        if (sid) {
          currentSectionId = sid;
          if (matched.kind === "titulo") topParent = sid;
        }
        paragraphContext = { sectionId: currentSectionId, article: currentArticle, clause: currentClause };
        paragraph = [line];
        continue;
      }

      paragraph.push(line);
    }
    flushParagraph(p, page.printedPage);
  }

  for (const s of sections) {
    const end = chunks.filter((c) => c.sectionId === s.id).map((c) => c.pdfPageIndex);
    s.endPage = end.length ? Math.max(...end) : s.startPage;
  }

  return {
    sections,
    chunks,
    citations,
    lastReformDate,
    docTitle,
    docKey,
    keyMatch: expectedKey ? docKeys.has(expectedKey) : docKey !== null,
    stFormats: [...stFormats].sort(),
  };
}
