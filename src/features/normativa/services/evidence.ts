import type { Claim, ClaimState, EpisodeEvidencePack, Evidence, SearchHit } from "../core/types";
import { NormativeDB } from "./db";
import { stripAccents } from "../core/normalize";
import { nowIso } from "../core/hashing";

const STOP_WORDS = new Set(
  "el la los las un una unos unas de del al a ante bajo con contra desde durante en entre hacia hasta mediante para por según sin sobre tras que y o u ni no sí es son fue eran está están ser estar su sus mi tu mis tus este esta estos estas ese esa esos esas aquel aquella lo le les se me te nos os le".split(" ")
);

export function tokenize(text: string): string[] {
  return stripAccents(text.toLowerCase())
    .split(/[^a-z0-9ñáéíóúü]+/)
    .filter((t) => (t.length >= 3 && !STOP_WORDS.has(t)) || /^\d+$/.test(t));
}

export function classifyClaimType(text: string): Claim["type"] {
  const t = text.toLowerCase();
  const hasNumbers = /\d/.test(t);
  if (/^(?:cabe|adem[áa]s|ahora|despu[ée]s|por otra parte|finalmente|en resumen|pasemos|vamos a|recuerda|hablemos|este contenido es informativo|bienvenidas|bienvenidos|bienvenidas y bienvenidos)/.test(t)) return "TRANSITION";
  if (/^(?:creo|pienso|opino|me parece|en mi opini[óo]n|seg[úu]n yo)/.test(t)) return "OPINION";
  if (/(?:sab[íi]as|imagina|supongamos|por ejemplo|hipot[ée]ticamente|qu[ée] pasar[íi]a si)/.test(t)) return "NARRATIVE";
  const legalStructure = /(?:cl[áa]usula|art[íi]culo|derecho|obligaci[óo]n|procedimiento|ley|contrato|reglamento|norma|estatuto|corresponde|est[áa] prohibido|tiene derecho|deber[áa])/.test(t);
  const amountWords = /(?:d[íi]as|a[ñn]os|horas|pesos|por ciento|%|veces|quincenas|semanas|meses|sueldo|salario|pago)/.test(t);
  if (hasNumbers && amountWords && !legalStructure && text.length < 160) return "NUMERICAL_CLAIM";
  if (legalStructure) return "LEGAL_CLAIM";
  return "VERIFIABLE_CLAIM";
}

function hitToEvidence(hit: SearchHit): Evidence {
  return {
    documentId: hit.documentId,
    versionId: hit.versionId,
    pdfPage: hit.pdfPageIndex,
    printedPage: hit.printedPage,
    section: hit.section,
    article: hit.article,
    clause: hit.clause,
    numeral: hit.numeral,
    quote: hit.text.slice(0, 700),
    reason: `Coincidencia con la consulta: ${hit.snippet.replace(/\[|\]/g, "")}`,
  };
}

export function buildEvidencePack(
  db: NormativeDB,
  topic: string,
  opts: { cutoff?: string; episodeId?: string; includeHistorical?: boolean; limit?: number } = {}
): EpisodeEvidencePack {
  const hits = db.search(topic, {
    includeHistorical: opts.includeHistorical ?? false,
    limit: opts.limit ?? 30,
  });

  const byDoc = new Map<string, SearchHit[]>();
  for (const h of hits) {
    const list = byDoc.get(h.documentId) ?? [];
    list.push(h);
    byDoc.set(h.documentId, list);
  }

  const documents: EpisodeEvidencePack["documents"] = [];
  for (const [docId, docHits] of byDoc) {
    const meta = db.getDocument(docId);
    if (!meta) continue;
    const versionId = docHits[0].versionId;
    const ver = db.getVersion(versionId);
    if (!ver) continue;
    documents.push({
      id: docId,
      title: meta.title,
      sha256: ver.sha256,
      versionLabel: ver.label,
      lastReformDate: meta.lastReformDate ?? null,
      effectiveFrom: meta.effectiveFrom ?? null,
      effectiveUntil: meta.effectiveUntil ?? null,
    });
  }

  const seen = new Set<string>();
  const claims: Claim[] = [];
  for (const hit of hits) {
    const key = `${hit.documentId}:${hit.pdfPageIndex ?? 0}:${hit.text.slice(0, 60)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    claims.push({
      id: `C${claims.length + 1}`,
      text: hit.text.slice(0, 400),
      type: classifyClaimType(hit.text),
      state: "VERIFIED",
      evidence: [hitToEvidence(hit)],
      note: "Fragmento literal del corpus (sin interpretación)",
    });
  }

  return {
    episodeId: opts.episodeId,
    topic,
    cutoff: opts.cutoff ?? "2026-08-14",
    createdAt: nowIso(),
    documents,
    relevantChunks: hits.map((h) => ({
      id: h.chunkId,
      documentId: h.documentId,
      versionId: h.versionId,
      sectionId: null,
      pdfPageIndex: h.pdfPageIndex ?? 1,
      printedPage: h.printedPage,
      section: h.section,
      article: h.article,
      clause: h.clause,
      numeral: h.numeral,
      text: h.text,
      order: 0,
    })),
    claims,
    conflicts: [],
  };
}

export function verifyClaim(
  db: NormativeDB,
  claimText: string,
  opts: { includeHistorical?: boolean; minHits?: number } = {}
): { state: ClaimState; evidence: Evidence[]; hits: SearchHit[] } {
  const tokens = tokenize(claimText);
  const significant = tokens.filter((t) => t.length >= 4 || /^\d+$/.test(t)).slice(0, 8);
  if (significant.length === 0) {
    return { state: "NEEDS_MORE_EVIDENCE", evidence: [], hits: [] };
  }
  const query = significant.join(" ");
  const hits = db.search(query, { includeHistorical: opts.includeHistorical ?? false, limit: 12, mode: "or" });
  if (hits.length === 0) {
    return { state: "NEEDS_MORE_EVIDENCE", evidence: [], hits: [] };
  }

  const numericTokens = significant.filter((t) => /^\d+$/.test(t));
  const supported = hits.filter((h) => {
    const norm = stripAccents(h.text.toLowerCase());
    if (numericTokens.some((n) => !norm.includes(n))) return false;
    const present = significant.filter((t) => norm.includes(t)).length;
    return present >= Math.min(3, significant.length) && present >= Math.ceil(significant.length * 0.5);
  });

  if (supported.length === 0) {
    return { state: "NEEDS_MORE_EVIDENCE", evidence: [], hits: [] };
  }
  return {
    state: "VERIFIED",
    evidence: supported.slice(0, 4).map(hitToEvidence),
    hits,
  };
}
