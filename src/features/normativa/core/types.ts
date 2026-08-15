export type ValidityStatus =
  | "CURRENT"
  | "FUTURE"
  | "EXPIRED"
  | "REPEALED"
  | "SUPERSEDED"
  | "HISTORICAL"
  | "UNKNOWN"
  | "PENDING_REVIEW";

export type ProvenanceStatus = "OFFICIAL" | "OFFICIAL_MIRROR" | "SECONDARY" | "UNVERIFIED";

export type Priority = "critical" | "high" | "medium" | "low";

export type DocType =
  | "collective_agreement"
  | "union_statutes"
  | "union_regulation"
  | "institutional_regulation"
  | "employment_statute"
  | "code_of_conduct"
  | "federal_law"
  | "federal_regulation"
  | "regulation"
  | "procedure"
  | "salary_table"
  | "NOM"
  | "labor_protocol"
  | "institutional_guidance"
  | "index";

export interface SourceSpec {
  id: string;
  key?: string;
  title: string;
  edition?: string;
  organization: string | string[];
  type: DocType;
  category: string;
  url?: string | null;
  mirror?: string;
  landingPage?: string;
  canonicalLandingPage?: boolean;
  canonical?: boolean;
  autoDiscoverLinks?: boolean;
  priority?: Priority;
  effectiveFrom?: string;
  effectiveUntil?: string;
  status?: string;
  verificationStatus?: string;
  warning?: string;
  topics?: string[];
  appliesTo?: string[];
  parse?: Record<string, unknown>;
  discovery?: Record<string, unknown>;
  discoveryTargets?: Array<{ key: string; title: string; urlPattern: string }>;
  discoveryRequired?: boolean;
  titleFromDocument?: boolean;
  format?: "pdf" | "html" | "page";
  watchLastReform?: boolean;
  relates?: string[];
}

export interface BootstrapManifest {
  cutoff: string;
  settings: {
    download: {
      maxConcurrency: number;
      minDelayMs: number;
      timeoutMs: number;
      maxRetries: number;
      backoffBaseMs: number;
      cacheEnabled: boolean;
      allowlistDomains: string[];
    };
    alerts: Array<{ id: string; document: string; expiresOn: string; warnDaysBefore: number; message: string }>;
    monitors: Array<{ id: string; kind: string; urls: string[]; keywords: string[] }>;
  };
  sources: SourceSpec[];
  discovery: Record<string, unknown>;
}

export interface DownloadRecord {
  url: string;
  resolvedUrl: string;
  downloadedAt: string;
  etag?: string | null;
  lastModified?: string | null;
  sha256: string;
  size: number;
  contentType: string;
  redirects: number;
  status: "OK" | "CHALLENGE" | "NOT_MODIFIED" | "ERROR";
  error?: string;
  kind: "pdf" | "html" | "page";
}

export interface DocumentMetadata {
  id: string;
  key?: string;
  title: string;
  edition?: string;
  organization: string[];
  type: DocType;
  category: string;
  canonical: boolean;
  provenance: ProvenanceStatus;
  url: string | null;
  mirror?: string | null;
  landingPage?: string | null;
  effectiveFrom?: string | null;
  effectiveUntil?: string | null;
  validity: ValidityStatus;
  verificationStatus?: string | null;
  priority: Priority;
  topics: string[];
  warning?: string | null;
  sourceSpecHash: string;
  lastReformDate?: string | null;
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  label: string;
  dir: string;
  sha256: string;
  downloadedAt: string;
  lastCheckedAt: string;
  contentType: string;
  size: number;
  resolvedUrl: string;
  originalUrl: string;
  etag?: string | null;
  lastModified?: string | null;
  status: "PENDING_REVIEW" | "VERIFIED" | "SOURCE_MISMATCH" | "ERROR";
  note?: string | null;
  pages?: number | null;
}

export interface DocumentSection {
  id: string;
  documentId: string;
  versionId: string;
  kind: string;
  label: string;
  order: number;
  startPage: number | null;
  endPage: number | null;
  parentId: string | null;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  versionId: string;
  sectionId: string | null;
  pdfPageIndex: number;
  printedPage: string | null;
  section: string | null;
  article: string | null;
  clause: string | null;
  numeral: string | null;
  text: string;
  order: number;
}

export interface DocumentCitation {
  documentId: string;
  versionId: string;
  pdfPage: number | null;
  printedPage: string | null;
  section?: string | null;
  article?: string | null;
  clause?: string | null;
  numeral?: string | null;
  text: string;
}

export interface DocumentRelation {
  id: string;
  fromDocumentId: string;
  fromAnchor: string | null;
  toDocumentId: string | null;
  toExternalName: string | null;
  toAnchor: string | null;
  kind: "cross_reference" | "discovery";
  state: "HAVE" | "MISSING" | "NOT_LOCATED" | "REVIEW_REQUIRED";
  context: string;
  foundInSectionId: string | null;
}

export interface UpdateCheck {
  id: string;
  documentId: string;
  checkedAt: string;
  kind: "full" | "critical" | "expiring" | "single";
  sha256: string | null;
  etag: string | null;
  lastModified: string | null;
  changed: boolean;
  lastReformDate: string | null;
  expiresSoon: boolean;
  message: string | null;
}

export interface Evidence {
  documentId: string;
  versionId: string;
  pdfPage: number | null;
  printedPage: string | null;
  section: string | null;
  article: string | null;
  clause: string | null;
  numeral: string | null;
  quote: string;
  reason: string;
}

export type ClaimState = "VERIFIED" | "UNVERIFIED" | "NEEDS_MORE_EVIDENCE" | "CONFLICT";

export interface Claim {
  id: string;
  text: string;
  type: "NARRATIVE" | "OPINION" | "TRANSITION" | "VERIFIABLE_CLAIM" | "LEGAL_CLAIM" | "NUMERICAL_CLAIM";
  state: ClaimState;
  evidence: Evidence[];
  note?: string;
}

export interface EpisodeEvidencePack {
  episodeId?: string;
  topic: string;
  cutoff: string;
  createdAt: string;
  documents: Array<{
    id: string;
    title: string;
    sha256: string;
    versionLabel: string;
    lastReformDate?: string | null;
    effectiveFrom?: string | null;
    effectiveUntil?: string | null;
  }>;
  relevantChunks: DocumentChunk[];
  claims: Claim[];
  conflicts: Array<{ a: Evidence; b: Evidence; note: string }>;
}

export type SourceStateKind =
  | "AVAILABLE"
  | "TEMPORARY_BLOCK"
  | "HTTP_403"
  | "WAF_BLOCK"
  | "NOT_FOUND"
  | "MANUAL_REVIEW"
  | "RETRY_AFTER";

export interface SourceState {
  id: string;
  state: SourceStateKind;
  retryAfter: string | null;
  lastError: string | null;
  attempts: number;
  updatedAt: string;
}

export interface SearchHit {
  documentId: string;
  documentTitle: string;
  versionId: string;
  chunkId: string;
  pdfPageIndex: number | null;
  printedPage: string | null;
  section: string | null;
  article: string | null;
  clause: string | null;
  numeral: string | null;
  snippet: string;
  text: string;
  validity: ValidityStatus;
  provenance: ProvenanceStatus;
  category: string;
  priority: Priority;
}
