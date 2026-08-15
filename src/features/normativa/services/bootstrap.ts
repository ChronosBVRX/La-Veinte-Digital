import fs from "node:fs";
import path from "node:path";
import type {
  BootstrapManifest,
  DocumentMetadata,
  ProvenanceStatus,
  SourceSpec,
  SourceState,
  ValidityStatus,
} from "../core/types";
import { nowIso } from "../core/hashing";
import { ensureDirs, normativaRoot, versionDirFor } from "../core/manifest";
import { DownloadError, NormativeDownloader } from "./downloader";
import { extractPdfPages, htmlToText, ocrPdfPages } from "./extractor";
import { parseStructure } from "./structure";
import { NormativeDB } from "./db";

export interface BootstrapItemResult {
  id: string;
  status: "DOWNLOADED" | "NOT_LOCATED" | "ERROR" | "SKIPPED";
  message?: string;
  sha256?: string;
  versionId?: string;
  pages?: number;
  chunks?: number;
  sections?: number;
  validity?: ValidityStatus;
  lastReformDate?: string | null;
  docKey?: string | null;
  keyMatch?: boolean;
  title?: string;
  changed?: boolean;
  ocrApplied?: boolean;
  ocrConfidence?: number;
}

export interface BootstrapReport {
  cutoff: string;
  startedAt: string;
  finishedAt: string;
  items: BootstrapItemResult[];
  counts: Record<string, number>;
}

export function computeValidity(spec: SourceSpec): ValidityStatus {
  const status = spec.status ?? "UNKNOWN";
  if (spec.id === "SNTSS-ESTATUTOS-2022") return "PENDING_REVIEW";
  if (spec.verificationStatus && /VERIFY|REVIEW/.test(spec.verificationStatus)) return "PENDING_REVIEW";
  if (status === "current") return "CURRENT";
  const map: Record<string, ValidityStatus> = {
    current: "CURRENT",
    historical: "HISTORICAL",
    expired: "EXPIRED",
    repealed: "REPEALED",
    superseded: "SUPERSEDED",
    unknown: "UNKNOWN",
    pending_review: "PENDING_REVIEW",
  };
  return map[status.toLowerCase()] ?? "UNKNOWN";
}

export function computeProvenance(spec: SourceSpec): ProvenanceStatus {
  if (spec.canonical && spec.url) return "OFFICIAL";
  if (spec.mirror && spec.url) return "OFFICIAL";
  if (!spec.canonical && spec.url) return "SECONDARY";
  if (spec.canonicalLandingPage && spec.landingPage) return "OFFICIAL";
  return "UNVERIFIED";
}

const VIRTUAL_SUBDOC_RULES: Array<{ pattern: RegExp; id: string; title: string }> = [
  { pattern: /REGLAMENTO INTERIOR DE TRABAJO/i, id: "CCT::RIT", title: "Reglamento Interior de Trabajo (anexo del CCT)" },
  { pattern: /BOLSA DE TRABAJO/i, id: "CCT::BOLSA", title: "Reglamento de Bolsa de Trabajo (anexo del CCT)" },
  { pattern: /ESCALAF[ÓO]N/i, id: "CCT::ESCALAFON", title: "Reglamento de Escalafón (anexo del CCT)" },
  { pattern: /CAMBIO DE RAMA/i, id: "CCT::CAMBIO_RAMA", title: "Selección de Recursos Humanos para Cambio de Rama (anexo del CCT)" },
  { pattern: /JUBILACIONES/i, id: "CCT::JUBILACIONES", title: "Régimen de Jubilaciones y Pensiones (anexo del CCT)" },
  { pattern: /INFECTOCONTAGIOSIDAD/i, id: "CCT::INFECTOCONTAGIOSIDAD", title: "Reglamento de Infectocontagiosidad y Emanaciones Radiactivas (anexo del CCT)" },
  { pattern: /BECAS/i, id: "CCT::BECAS", title: "Reglamento de Becas (anexo del CCT)" },
  { pattern: /CAPACITACI[ÓO]N/i, id: "CCT::CAPACITACION", title: "Reglamento de Capacitación (anexo del CCT)" },
];

export function registerVirtualSubdocuments(
  db: NormativeDB,
  parentId: string,
  sections: Array<{ kind: string; label: string; startPage: number | null; endPage: number | null }>,
  opts: { log: (msg: string) => void }
) {
  for (const s of sections) {
    if (s.kind !== "bloque") continue;
    const rule = VIRTUAL_SUBDOC_RULES.find((r) => r.pattern.test(s.label));
    if (!rule) continue;
    db.upsertDocument({
      id: rule.id,
      title: rule.title,
      organization: ["IMSS", "SNTSS"],
      type: "regulation",
      category: "cct",
      canonical: true,
      provenance: "OFFICIAL",
      url: null,
      mirror: null,
      landingPage: null,
      effectiveFrom: "2025-10-16",
      effectiveUntil: "2027-10-15",
      validity: "CURRENT",
      verificationStatus: null,
      priority: "high",
      topics: [],
      warning: `Subdocumento virtual extraído del CCT 2025-2027 (sección "${s.label}", páginas ${s.startPage ?? "?"}–${s.endPage ?? "?"}). El texto completo vive dentro del documento padre.`,
      sourceSpecHash: "",
    });
    db.upsertRelation({
      id: "",
      fromDocumentId: parentId,
      fromAnchor: s.label,
      toDocumentId: rule.id,
      toExternalName: null,
      toAnchor: null,
      kind: "discovery",
      state: "HAVE",
      context: `Subdocumento virtual: ${s.label} (páginas ${s.startPage ?? "?"}–${s.endPage ?? "?"})`,
      foundInSectionId: null,
    });
    opts.log(`  + virtual ${rule.id} ← "${s.label}"`);
  }
}

export function specToMetadata(spec: SourceSpec): DocumentMetadata {  return {
    id: spec.id,
    key: spec.key,
    title: spec.title,
    edition: spec.edition,
    organization: Array.isArray(spec.organization) ? spec.organization : [spec.organization],
    type: spec.type,
    category: spec.category ?? "otros",
    canonical: spec.canonical ?? false,
    provenance: computeProvenance(spec),
    url: spec.url ?? null,
    mirror: spec.mirror ?? null,
    landingPage: spec.landingPage ?? null,
    effectiveFrom: spec.effectiveFrom ?? null,
    effectiveUntil: spec.effectiveUntil ?? null,
    validity: computeValidity(spec),
    verificationStatus: spec.verificationStatus ?? null,
    priority: spec.priority ?? "medium",
    topics: spec.topics ?? [],
    warning: spec.warning ?? null,
    sourceSpecHash: "",
  };
}

export function extractLinksFromHtml(html: string, baseUrl: string, allowlist: string[]): Array<{ href: string; text: string }> {
  const links: Array<{ href: string; text: string }> = [];
  const re = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      const abs = new URL(m[1], baseUrl).href;
      const text = m[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      const host = new URL(abs).hostname.toLowerCase();
      if (!allowlist.some((d) => host === d || host.endsWith(`.${d}`))) continue;
      if (/\.(pdf|docx?|xlsx?|zip|html?)(\?|#|$)/i.test(abs)) links.push({ href: abs, text });
    } catch {
      /* ignorar */
    }
  }
  return links.slice(0, 400);
}

const BLOCKED_STATES: Array<SourceState["state"]> = [
  "WAF_BLOCK",
  "HTTP_403",
  "TEMPORARY_BLOCK",
  "RETRY_AFTER",
  "NOT_FOUND",
  "MANUAL_REVIEW",
];

export function classifyDownloadError(err: unknown, spec: SourceSpec, attempts: number): { state: SourceState["state"]; retryAfter: string | null } {
  const base = (minutes: number) => new Date(Date.now() + minutes * 60000 * Math.pow(2, Math.min(attempts, 4))).toISOString();
  if (err instanceof DownloadError) {
    switch (err.code) {
      case "WAF_BLOCK":
        return { state: "WAF_BLOCK", retryAfter: base(30) };
      case "HTTP_403":
        return { state: "HTTP_403", retryAfter: base(30) };
      case "NOT_FOUND":
        return { state: "NOT_FOUND", retryAfter: base(720) };
      case "BAD_CONTENT":
        return { state: "MANUAL_REVIEW", retryAfter: null };
      case "NETWORK":
        return { state: "TEMPORARY_BLOCK", retryAfter: base(10) };
    }
  }
  const msg = err instanceof Error ? err.message : String(err);
  if (/incapsula|waf|challenge/i.test(msg)) {
    return { state: "WAF_BLOCK", retryAfter: base(30) };
  }
  return { state: "TEMPORARY_BLOCK", retryAfter: base(10) };
}

export function isSourceBlocked(st: SourceState | null, now: Date): boolean {
  if (!st) return false;
  if (!BLOCKED_STATES.includes(st.state)) return false;
  if (!st.retryAfter) return st.state === "MANUAL_REVIEW" || st.state === "NOT_FOUND";
  return st.retryAfter > now.toISOString();
}

export async function bootstrapSource(
  db: NormativeDB,
  downloader: NormativeDownloader,
  spec: SourceSpec,
  root: string,
  allowlist: string[],
  opts: { log: (msg: string) => void; force?: boolean }
): Promise<BootstrapItemResult> {
  const item: BootstrapItemResult = { id: spec.id, status: "SKIPPED" };
  const meta = specToMetadata(spec);

  const now = new Date();
  const st = db.getSourceState(spec.id);
  if (!opts.force && isSourceBlocked(st, now)) {
    item.status = "SKIPPED";
    item.message = `bloqueada (${st!.state}) — reintento después de ${st!.retryAfter ?? "revisión manual"}`;
    opts.log(`${spec.id}: SKIP — ${item.message}`);
    return item;
  }

  if (!spec.url && !spec.landingPage) {
    item.status = "NOT_LOCATED";
    item.message = spec.discoveryRequired ? "discoveryRequired — sin URL" : "sin URL";
    db.setSourceState(spec.id, "MANUAL_REVIEW", { lastError: item.message, resetAttempts: true });
    db.upsertDocument(meta);
    opts.log(`${spec.id}: ${item.status} (${item.message})`);
    return item;
  }

  try {
    let result;
    try {
      result = await downloader.download(spec, root);
    } catch (primaryErr) {
      if (!spec.mirror) throw primaryErr;
      opts.log(`  ⚠ ${spec.id}: fuente primaria falló (${primaryErr instanceof Error ? primaryErr.message : primaryErr}) — usando mirror oficial`);
      const mirrorSpec: SourceSpec = { ...spec, url: spec.mirror, mirror: undefined };
      result = await downloader.download(mirrorSpec, root);
    }
    item.status = "DOWNLOADED";
    item.sha256 = result.record.sha256;
    item.changed = result.changed;

    const category = spec.category ?? "otros";
    const baseDir = path.dirname(versionDirFor(root, spec.id, category, "x"));
    const dir = path.join(baseDir, result.versionLabel);
    const versionId = `${spec.id}@${result.versionLabel}`;

    let pages: Array<{ pageIndex: number; printedPage: string | null; text: string }> = [];
    let fullText = "";

    const originalPdf = path.join(dir, "original.pdf");
    const originalHtml = path.join(dir, "original.html");

    if (fs.existsSync(originalPdf)) {
      const pdfBuf = new Uint8Array(fs.readFileSync(originalPdf));
      const extraction = await extractPdfPages(pdfBuf);
      pages = extraction.pages;
      fullText = extraction.normalizedText;
      item.pages = extraction.numPages;
      fs.writeFileSync(path.join(dir, "extracted.txt"), fullText + "\n");

      if (extraction.needsOcr) {
        opts.log(`  🔍 ${spec.id}: PDF sin texto suficiente — aplicando OCR (original intacto)`);
        const ocr = await ocrPdfPages(originalPdf, { lang: "spa", log: (m) => opts.log(`    ${m}`) });
        pages = ocr.pages;
        fullText = ocr.fullText;
        fs.writeFileSync(path.join(dir, "ocr.txt"), ocr.fullText + "\n");
        fs.writeFileSync(
          path.join(dir, "ocr-confidence.json"),
          JSON.stringify({ meanConfidence: ocr.meanConfidence, perPage: ocr.confidences }, null, 2)
        );
        item.ocrApplied = true;
        item.ocrConfidence = ocr.meanConfidence;
      }
    } else if (fs.existsSync(originalHtml)) {
      const html = fs.readFileSync(originalHtml, "utf8");
      fullText = htmlToText(html);
      pages = [{ pageIndex: 1, printedPage: null, text: fullText }];
      item.pages = 1;
      fs.writeFileSync(path.join(dir, "extracted.txt"), fullText + "\n");
    } else {
      throw new Error("archivo original no encontrado tras descarga");
    }

    const parsed = parseStructure({
      docId: spec.id,
      versionId,
      type: spec.type,
      pages,
      expectedKey: spec.key ?? null,
    });

    item.lastReformDate = parsed.lastReformDate;
    item.docKey = parsed.docKey;
    item.keyMatch = parsed.keyMatch;
    if (spec.key && !parsed.keyMatch) {
      opts.log(`  ⚠ SOURCE_MISMATCH ${spec.id}: clave esperada ${spec.key}, encontrada ${parsed.docKey ?? "ninguna"}`);
    }

    let finalTitle = meta.title;
    const isPlaceholderTitle = /procedimiento relacionado/i.test(meta.title);
    if ((spec.titleFromDocument || isPlaceholderTitle) && parsed.docTitle) finalTitle = parsed.docTitle;
    meta.title = finalTitle;
    meta.lastReformDate = parsed.lastReformDate;

    fs.writeFileSync(
      path.join(dir, "structure.json"),
      JSON.stringify({ sections: parsed.sections, lastReformDate: parsed.lastReformDate, docTitle: parsed.docTitle, docKey: parsed.docKey }, null, 2)
    );
    fs.writeFileSync(path.join(dir, "chunks.jsonl"), parsed.chunks.map((c) => JSON.stringify(c)).join("\n") + "\n");
    fs.writeFileSync(path.join(dir, "citations.jsonl"), parsed.citations.map((c) => JSON.stringify(c)).join("\n") + "\n");

    const versionStatus = spec.key && !parsed.keyMatch ? "SOURCE_MISMATCH" : "PENDING_REVIEW";
    db.upsertDocument(meta);
    db.upsertVersion({
      id: versionId,
      documentId: spec.id,
      label: result.versionLabel,
      dir,
      sha256: result.record.sha256,
      downloadedAt: result.record.downloadedAt,
      lastCheckedAt: nowIso(),
      contentType: result.record.contentType,
      size: result.record.size,
      resolvedUrl: result.record.resolvedUrl,
      originalUrl: result.record.url,
      etag: result.record.etag,
      lastModified: result.record.lastModified,
      status: versionStatus,
      note:
        spec.key && !parsed.keyMatch
          ? `clave esperada ${spec.key}, encontrada ${parsed.docKey ?? "ninguna"}`
          : item.ocrApplied
            ? `OCR aplicado (confianza media ${(item.ocrConfidence ?? 0).toFixed(2)})`
            : null,
      pages: item.pages,
    });
    db.replaceSections(parsed.sections);
    db.replaceChunks(parsed.chunks);
    db.insertCitations(parsed.citations);
    db.setVersionExtracted(versionId, item.pages ?? 1, nowIso());

    item.sections = parsed.sections.length;
    item.chunks = parsed.chunks.length;
    item.validity = meta.validity;
    item.versionId = versionId;
    item.title = finalTitle;

    if (spec.id === "CCT-IMSS-SNTSS-2025-2027") {
      registerVirtualSubdocuments(db, spec.id, parsed.sections, opts);
    }

    opts.log(
      `${spec.id}: OK p=${item.pages ?? "?"} s=${item.sections ?? 0} c=${item.chunks ?? 0} sha=${result.record.sha256.slice(0, 12)}… reforma=${parsed.lastReformDate ?? "-"}${result.reused ? " (sin cambios)" : ""}${item.ocrApplied ? ` OCR=${(item.ocrConfidence ?? 0).toFixed(2)}` : ""}`
    );

    db.setSourceState(spec.id, "AVAILABLE", { resetAttempts: true, lastError: null });
  } catch (err) {
    item.status = "ERROR";
    item.message = err instanceof Error ? err.message : String(err);
    const prev = db.getSourceState(spec.id);
    const classified = classifyDownloadError(err, spec, prev?.attempts ?? 0);
    db.setSourceState(spec.id, classified.state, { retryAfter: classified.retryAfter, lastError: item.message });
    item.message = `${item.message} [estado: ${classified.state}${classified.retryAfter ? `, reintento: ${classified.retryAfter}` : ""}]`;
    db.upsertDocument(meta);
    await downloader.logError(spec, item.message);
    opts.log(`${spec.id}: ERROR — ${item.message}`);
  }
  return item;
}

export async function runBootstrap(
  repoRoot: string,
  manifest: BootstrapManifest,
  opts: { log: (msg: string) => void } = { log: () => {} }
): Promise<BootstrapReport> {
  const root = normativaRoot(repoRoot);
  ensureDirs(root);
  const startedAt = nowIso();

  const downloader = new NormativeDownloader({
    timeoutMs: manifest.settings.download.timeoutMs,
    minDelayMs: manifest.settings.download.minDelayMs,
    maxRetries: manifest.settings.download.maxRetries,
    backoffBaseMs: manifest.settings.download.backoffBaseMs,
    allowlistDomains: manifest.settings.download.allowlistDomains,
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36 AILaVeinte/Normativa",
    logFile: path.join(root, "download-log.jsonl"),
  });

  const db = new NormativeDB(path.join(root, "catalog.sqlite"));
  const report: BootstrapReport = { cutoff: manifest.cutoff, startedAt, finishedAt: startedAt, items: [], counts: {} };

  const sorted = [...manifest.sources].sort((a, b) => {
    const p = { critical: 0, high: 1, medium: 2, low: 3 };
    const pa = p[a.priority ?? "medium"] ?? 2;
    const pb = p[b.priority ?? "medium"] ?? 2;
    if (pa !== pb) return pa - pb;
    const wafA = (a.url ?? a.landingPage ?? "").includes("imss.gob.mx") ? 1 : 0;
    const wafB = (b.url ?? b.landingPage ?? "").includes("imss.gob.mx") ? 1 : 0;
    return wafA - wafB;
  });

  const registry: Record<string, unknown> = {};

  for (const spec of sorted) {
    const item = await bootstrapSource(db, downloader, spec, root, manifest.settings.download.allowlistDomains, opts);
    report.items.push(item);
    registry[spec.id] = {
      id: spec.id,
      title: item.title ?? spec.title,
      key: spec.key ?? null,
      validity: item.validity ?? computeValidity(spec),
      status: item.status,
      message: item.message ?? null,
      url: spec.url ?? spec.landingPage ?? null,
      sha256: item.sha256 ?? null,
      versionId: item.versionId ?? null,
      pages: item.pages ?? null,
      chunks: item.chunks ?? null,
      sections: item.sections ?? null,
      lastReformDate: item.lastReformDate ?? null,
      keyMatch: item.keyMatch ?? null,
    };
  }

  fs.writeFileSync(
    path.join(root, "manifest.json"),
    JSON.stringify({ cutoff: manifest.cutoff, generatedAt: nowIso(), documents: registry }, null, 2)
  );
  fs.writeFileSync(
    path.join(root, "update-state.json"),
    JSON.stringify(
      {
        lastBootstrapAt: nowIso(),
        counts: db.counts(),
        pendingReviews: report.items
          .filter((i) => i.status === "NOT_LOCATED" || i.status === "ERROR")
          .map((i) => ({ id: i.id, message: i.message ?? null })),
      },
      null,
      2
    )
  );

  report.counts = db.counts();
  report.finishedAt = nowIso();
  return report;
}
