/**
 * Coverage — qué sabemos, qué falta, qué respaldo es fuerte/parcial.
 * Influye en el guion: un hueco real se reconoce, nunca se inventa.
 */
import { z } from "zod";

export const COVERAGE_ITEM_STATUS = ["confirmed", "partial", "missing", "review"] as const;
export type CoverageItemStatus = (typeof COVERAGE_ITEM_STATUS)[number];
export const CoverageItemStatusSchema = z.enum(COVERAGE_ITEM_STATUS);

export const CoverageItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  status: CoverageItemStatusSchema,
  confidence: z.number().min(0).max(1).optional(),
  note: z.string().nullable().optional(),
  evidenceIds: z.array(z.string()).default([]),
});
export type CoverageItem = z.infer<typeof CoverageItemSchema>;

export const CoverageSchema = z.object({
  percentage: z.number().min(0).max(100),
  recommended: z.boolean(),
  items: z.array(CoverageItemSchema).default([]),
  /** Qué sabemos con respaldo. */
  known: z.array(z.string()).default([]),
  /** Qué falta o no se puede afirmar. */
  missing: z.array(z.string()).default([]),
  /** Evidencia fuerte. */
  strong: z.array(z.string()).default([]),
  /** Evidencia parcial. */
  partial: z.array(z.string()).default([]),
  /** Preguntas que quedan sin responder. */
  unanswered: z.array(z.string()).default([]),
  /** Advertencias editoriales derivadas de la cobertura. */
  warnings: z.array(z.string()).default([]),
  confirmed: z.number().default(0),
  withoutSupport: z.number().default(0),
});
export type Coverage = z.infer<typeof CoverageSchema>;

export const ResearchBundleSchema = z.object({
  topic: z.string(),
  queryExpansion: z.array(z.string()).default([]),
  cutoff: z.string(),
  evidence: z.array(z.object({
    sourceId: z.string(),
    document: z.string(),
    section: z.string().nullable().optional(),
    article: z.string().nullable().optional(),
    clause: z.string().nullable().optional(),
    procedure: z.string().nullable().optional(),
    page: z.number().nullable().optional(),
    excerpt: z.string(),
    hash: z.string(),
    confidence: z.number().min(0).max(1).optional(),
    reason: z.string().nullable().optional(),
  })).default([]),
  claims: z.array(z.object({
    id: z.string(),
    statement: z.string(),
    type: z.string().default("STATEMENT"),
    state: z.string().default("SUPPORTED"),
    evidence: z.array(z.object({
      sourceId: z.string(),
      document: z.string(),
      section: z.string().nullable().optional(),
      article: z.string().nullable().optional(),
      clause: z.string().nullable().optional(),
      procedure: z.string().nullable().optional(),
      page: z.number().nullable().optional(),
      excerpt: z.string(),
      hash: z.string(),
    })).min(1),
    locator: z.string().nullable().optional(),
    support: z.number().min(0).max(1),
    note: z.string().nullable().optional(),
  })).default([]),
  coverage: CoverageSchema,
  documents: z.array(z.object({
    sourceId: z.string(),
    document: z.string(),
    title: z.string(),
    category: z.string().nullable().optional(),
    validity: z.string().nullable().optional(),
    versionLabel: z.string().nullable().optional(),
    sha256: z.string().nullable().optional(),
    pages: z.number().nullable().optional(),
  })).default([]),
  /** Fuentes que se consideraron y se descartaron, con motivo. */
  discarded: z.array(z.object({
    sourceId: z.string(),
    title: z.string(),
    reason: z.string(),
  })).default([]),
  createdAt: z.string(),
});
export type ResearchBundle = z.infer<typeof ResearchBundleSchema>;
