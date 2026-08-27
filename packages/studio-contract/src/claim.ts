/**
 * Claim Ledger / Evidence — la capa trazable que sustenta cada afirmación.
 * Nunca se cita algo que no tenga un Claim en el ledger.
 */
import { z } from "zod";

/** Fuente primaria que respalda un claim. */
export const EvidenceSchema = z.object({
  sourceId: z.string(),
  document: z.string(),
  section: z.string().nullable().optional(),
  article: z.string().nullable().optional(),
  clause: z.string().nullable().optional(),
  numeral: z.string().nullable().optional(),
  procedure: z.string().nullable().optional(),
  page: z.number().nullable().optional(),
  excerpt: z.string(),
  hash: z.string(),
  confidence: z.number().min(0).max(1).optional(),
  reason: z.string().nullable().optional(),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

export const CLAIM_TYPES = ["LEGAL_CLAIM", "NUMERICAL_CLAIM", "VERIFIABLE_CLAIM", "PROCEDURE", "STATEMENT", "TRANSITION", "OPINION", "NARRATIVE"] as const;
export type ClaimType = (typeof CLAIM_TYPES)[number];
export const ClaimTypeSchema = z.enum(CLAIM_TYPES);

export const CLAIM_STATES = ["SUPPORTED", "PARTIAL", "UNKNOWN", "PENDING"] as const;
export type ClaimState = (typeof CLAIM_STATES)[number];
export const ClaimStateSchema = z.enum(CLAIM_STATES);

/**
 * Claim del Ledger. Diferente de una cita suelta: es una afirmación
 * descomponible (qué se afirma, de dónde sale, con qué respaldo).
 */
export const ClaimSchema = z.object({
  id: z.string(),
  statement: z.string(),
  type: ClaimTypeSchema.default("STATEMENT"),
  state: ClaimStateSchema.default("SUPPORTED"),
  evidence: z.array(EvidenceSchema).min(1),
  /** Locator legible para el editor (ej. "pasos 1-4", "artículo 47") */
  locator: z.string().nullable().optional(),
  /** nivel de respaldo 0..1 */
  support: z.number().min(0).max(1),
  note: z.string().nullable().optional(),
});
export type Claim = z.infer<typeof ClaimSchema>;

/** Fuente resumida para la biblioteca del episodio (usadas/descartadas). */
export const SourceSummarySchema = z.object({
  sourceId: z.string(),
  document: z.string(),
  title: z.string(),
  category: z.string().nullable().optional(),
  validity: z.string().nullable().optional(),
  versionLabel: z.string().nullable().optional(),
  sha256: z.string().nullable().optional(),
  pages: z.number().nullable().optional(),
  lastReformDate: z.string().nullable().optional(),
});
export type SourceSummary = z.infer<typeof SourceSummarySchema>;
