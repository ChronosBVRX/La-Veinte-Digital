/**
 * Conversores entre los tipos del corpus normativo y los contratos de studio.
 * Aísla el mapeo para que el flujo de proyecto no conozca los detalles del catálogo.
 */
import type { Claim as NormClaim, Evidence as NormEvidence, EpisodeEvidencePack } from "../../../../../src/features/normativa/core/types";
import type { CoverageReport } from "../../../../../src/features/normativa/services/coverage";
import {
  type Claim,
  type Evidence,
  type Coverage,
  type CoverageItem,
  type ResearchBundle,
} from "@la-veinte/studio-contract";
import { createHash } from "node:crypto";

export function normEvidenceToStudio(e: NormEvidence): Evidence {
  return {
    sourceId: e.documentId,
    document: e.documentId,
    section: e.section ?? null,
    article: e.article ?? null,
    clause: e.clause ?? null,
    numeral: e.numeral ?? null,
    page: e.pdfPage ?? null,
    excerpt: e.quote,
    hash: createHash("sha256").update(`${e.documentId}|${e.quote}`).digest("hex").slice(0, 16),
    confidence: 0.98,
    reason: e.reason,
  };
}

export function normClaimToStudio(c: NormClaim, idx: number): Claim {
  const evidence = c.evidence.map(normEvidenceToStudio);
  return {
    id: c.id,
    statement: c.text,
    type: c.type,
    state: c.state === "VERIFIED" ? "SUPPORTED" : c.state === "CONFLICT" ? "PARTIAL" : "UNKNOWN",
    evidence,
    locator: evidence[0]?.clause ?? evidence[0]?.article ?? null,
    support: c.state === "VERIFIED" ? 0.98 : 0.6,
    note: c.note ?? null,
    // asegurar ids únicos de claim por si dos hits generan el mismo Cx
  };
}

export function coverageToStudio(cr: CoverageReport): Coverage {
  const items: CoverageItem[] = cr.items.map((i) => ({ id: i.id, label: i.label, status: i.status === "available" ? "confirmed" : i.status === "review" ? "review" : "missing", note: i.note ?? null, evidenceIds: [] }));
  const unknown = cr.critical.length;
  const known = items.filter((i) => i.status === "confirmed");
  return {
    percentage: cr.coverage,
    recommended: cr.recommended,
    items,
    known: known.map((i) => i.label),
    missing: cr.critical.map((i) => i.label),
    strong: known.slice(0, 6).map((i) => i.label),
    partial: items.filter((i) => i.status === "review" || i.status === "partial").map((i) => i.label),
    unanswered: cr.critical.map((i) => i.label),
    warnings: cr.warnings,
    confirmed: known.length,
    withoutSupport: unknown,
  };
}

export function researchPackToBundle(topic: string, pack: EpisodeEvidencePack, expansion: string[], coverage: CoverageReport, discarded: Array<{ sourceId: string; title: string; reason: string }>): ResearchBundle {
  return {
    topic,
    queryExpansion: expansion,
    cutoff: pack.cutoff,
    evidence: pack.claims.flatMap((c) => c.evidence.map(normEvidenceToStudio)),
    claims: pack.claims.map((c, i) => normClaimToStudio(c, i)),
    coverage: coverageToStudio(coverage),
    documents: pack.documents.map((d, i) => ({
      sourceId: d.id,
      document: d.id,
      title: d.title,
      category: null,
      validity: null,
      versionLabel: d.versionLabel,
      sha256: d.sha256,
      pages: null,
    })),
    discarded,
    createdAt: pack.createdAt,
  };
}

export function claimsFlat(claims: Array<{ id: string; statement: string; evidence: Array<{ document?: string | null; clause?: string | null; article?: string | null; page?: number | null }> }>, maxChars = 260): string {
  return claims.map((c) => {
    const e = c.evidence[0];
    return `[${c.id}] ${c.statement.slice(0, maxChars)}${e ? ` — ${e.document ?? ""}${e.clause ? ` ${e.clause}` : ""}${e.article ? ` ${e.article}` : ""}${e.page != null ? ` pág.${e.page}` : ""}` : ""}`;
  }).join("\n");
}

export function coverageFlat(coverage: Coverage): string {
  const rows = coverage.items.map((i) => `${i.status.toUpperCase()} | ${i.label}${i.note ? ` | ${i.note}` : ""}`).join("\n");
  const known = coverage.known.length ? `CONFIRMADO:\n- ${coverage.known.join("\n- ")}` : "";
  const missing = coverage.missing.length ? `SIN RESPALDO:\n- ${coverage.missing.join("\n- ")}` : "";
  return [known, missing, rows].filter(Boolean).join("\n\n");
}
