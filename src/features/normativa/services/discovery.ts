import fs from "node:fs";
import path from "node:path";
import type { BootstrapManifest, DocumentRelation, SourceSpec } from "../core/types";
import { NormativeDB } from "./db";
import { NormativeDownloader } from "./downloader";
import { extractPdfPages } from "./extractor";
import { parseStructure } from "./structure";
import { bootstrapSource, extractLinksFromHtml } from "./bootstrap";
import { nowIso } from "../core/hashing";

export interface DiscoveryReport {
  relationsFound: number;
  states: Record<string, number>;
  targets: Array<{ key: string; title: string; state: "HAVE" | "ADDED" | "NOT_LOCATED" | "REVIEW_REQUIRED"; message?: string }>;
  missing: Array<{ from: string; ref: string; anchor: string | null }>;
  historicalAdded: string[];
}

const TARGET_DOCS: Record<string, string> = {
  LFT: "Ley Federal del Trabajo",
  LSS: "Ley del Seguro Social",
  CPEUM: "Constitución Política de los Estados Unidos Mexicanos",
  CCT: "Contrato Colectivo de Trabajo",
  RIT: "Reglamento Interior de Trabajo",
  BOLSA: "Reglamento de Bolsa de Trabajo",
  ESCALAFON: "Reglamento de Escalafón",
  "CAMBIO RAMA": "Reglamento de Selección de Recursos Humanos para Cambio de Rama",
  INFECTO: "Reglamento de Infectocontagiosidad y Emanaciones Radiactivas",
  JUBILACIONES: "Régimen de Jubilaciones y Pensiones",
  BECAS: "Reglamento de Becas para la Capacitación",
  CAPACITACION: "Reglamento de Capacitación y Adiestramiento",
  RIIMSS: "Reglamento Interior del Instituto Mexicano del Seguro Social",
  ESTATUTOS: "Estatutos SNTSS",
};

interface RefMatch {
  kind: "law_article" | "cct_clause" | "procedure_key" | "st_format" | "named_doc";
  targetId: string | null;
  externalName: string;
  anchor: string | null;
}

function scanChunkText(text: string): RefMatch[] {
  const out: RefMatch[] = [];
  const seen = new Set<string>();

  const push = (m: RefMatch) => {
    const k = `${m.kind}|${m.targetId}|${m.anchor}|${m.externalName}`;
    if (!seen.has(k)) {
      seen.add(k);
      out.push(m);
    }
  };

  for (const m of text.matchAll(/Art[íi]culo\s+(\d+(?:\s*(?:Bis|Ter|Qu[áa]ter|Quinquies|Sexties|Septies|Octies|Nonies|Decies))?)\s*(?:de\s+la\s+|del\s+)?(Ley Federal del Trabajo|LFT|Ley del Seguro Social|LSS|Constituci[óo]n|CPEUM)/gi)) {
    const law = m[2].toUpperCase();
    const targetId = law.startsWith("LEY FEDERAL") || law === "LFT" ? "LFT" : law.startsWith("LEY DEL SEGURO") || law === "LSS" ? "LSS" : "CPEUM";
    push({ kind: "law_article", targetId, externalName: m[2], anchor: `Artículo ${m[1].trim()}` });
  }

  for (const m of text.matchAll(/Cl[áa]usula\s+(\d+(?:\s*(?:Bis|Ter|Qu[áa]ter))?)/gi)) {
    push({ kind: "cct_clause", targetId: "CCT-IMSS-SNTSS-2025-2027", externalName: "CCT", anchor: `Cláusula ${m[1].trim()}` });
  }

  for (const m of text.matchAll(/(?:Procedimiento|Clave)\s*(?:con\s+clave\s*|de\s+clave\s*)?([0-9A-Z]{2,6}-\d{3}-\d{3})/gi)) {
    const key = m[1].toUpperCase();
    push({ kind: "procedure_key", targetId: `IMSS-${key}`, externalName: `Procedimiento ${key}`, anchor: key });
  }

  for (const m of text.matchAll(/\b(ST-\d{1,2})\b/gi)) {
    const st = m[1].toUpperCase();
    push({ kind: "st_format", targetId: st.startsWith("ST-9") ? "IMSS-3A21-003-003" : "IMSS-3A21-003-010", externalName: st, anchor: st });
  }

  const namedDocs: Array<[RegExp, string, string | null]> = [
    [/\bReglamento Interior (?:del IMSS|del Instituto Mexicano del Seguro Social)\b/gi, "RIIMSS", null],
    [/\bReglamento Interior de Trabajo\b/gi, "CCT-IMSS-SNTSS-2025-2027", "RIT"],
    [/\bReglamento de Bolsa de Trabajo\b/gi, "CCT-IMSS-SNTSS-2025-2027", "BOLSA"],
    [/\bReglamento de Escalaf[óo]n\b/gi, "CCT-IMSS-SNTSS-2025-2027", "ESCALAFON"],
    [/\bReglamento de Infectocontagiosidad y Emanaciones Radiactivas\b/gi, "CCT-IMSS-SNTSS-2025-2027", "INFECTO"],
    [/\bR[ée]gimen de Jubilaciones y Pensiones\b/gi, "CCT-IMSS-SNTSS-2025-2027", "JUBILACIONES"],
    [/\bReglamento de Becas para la Capacitaci[óo]n\b/gi, "IMSS-REGLAMENTO-BECAS", null],
    [/\bEstatutos del Sindicato|Estatutos SNTSS\b/gi, "SNTSS-ESTATUTOS-2022", null],
    [/\bReglamento Interior del IMSS\b/gi, "RIIMSS", null],
  ];
  for (const [re, targetId, anchor] of namedDocs) {
    if (re.test(text)) push({ kind: "named_doc", targetId, externalName: targetId, anchor });
  }

  return out;
}

export async function runDiscovery(
  repoRoot: string,
  manifest: BootstrapManifest,
  opts: { log: (msg: string) => void; maxDepth?: number } = { log: () => {} }
): Promise<DiscoveryReport> {
  const root = path.join(repoRoot, "data", "normativa");
  const db = new NormativeDB(path.join(root, "catalog.sqlite"));
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

  const report: DiscoveryReport = { relationsFound: 0, states: { HAVE: 0, MISSING: 0, NOT_LOCATED: 0, REVIEW_REQUIRED: 0 }, targets: [], missing: [], historicalAdded: [] };
  const haveDocs = new Set(db.listDocuments().map((d) => d.id));

  const sntssIndexHtml = path.join(root, "documents", "sntss", "SNTSS-DOCUMENTOS", "V1", "original.html");
  if (fs.existsSync(sntssIndexHtml)) {
    const links = extractLinksFromHtml(
      fs.readFileSync(sntssIndexHtml, "utf8"),
      "https://sntss.org.mx/documentos/",
      manifest.settings.download.allowlistDomains
    );
    for (const link of links) {
      const m = link.text.match(/Contrato Colectivo de Trabajo\s*(\d{4})-(\d{4})/i);
      if (!m) continue;
      const id = `CCT-IMSS-SNTSS-${m[1]}-${m[2]}`;
      if (id === "CCT-IMSS-SNTSS-2025-2027" || haveDocs.has(id)) continue;
      const spec: SourceSpec = {
        id,
        title: `Contrato Colectivo de Trabajo IMSS-SNTSS ${m[1]}-${m[2]} (histórico)`,
        organization: ["IMSS", "SNTSS"],
        type: "collective_agreement",
        category: "cct",
        url: link.href,
        canonical: true,
        status: "historical",
        priority: "low",
        effectiveFrom: `${m[1]}-10-16`,
        effectiveUntil: `${m[2]}-10-15`,
      };
      try {
        const item = await bootstrapSource(db, downloader, spec, root, manifest.settings.download.allowlistDomains, {
          log: (msg) => opts.log(`  [hist] ${msg}`),
        });
        if (item.status === "DOWNLOADED") {
          report.historicalAdded.push(id);
          opts.log(`  + histórico ${id} integrado (${item.pages ?? "?"} páginas)`);
        }
      } catch (err) {
        opts.log(`  ✗ histórico ${id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  for (const doc of db.listDocuments()) {
    if (doc.type !== "procedure" && doc.type !== "index") continue;
    const ver = db.listVersions(doc.id).at(-1);
    if (!ver) continue;
    const versionId = `${doc.id}@${ver.label}`;

    const rows = db.db
      .prepare(`SELECT id, text FROM chunks WHERE version_id = ?`)
      .all(versionId) as Array<{ id: number; text: string }>;
    db.clearRelationsFor(doc.id);

    for (const row of rows) {
      const matches = scanChunkText(row.text);
      for (const m of matches) {
        let state: DocumentRelation["state"];
        if (m.targetId && haveDocs.has(m.targetId)) state = "HAVE";
        else if (m.targetId && m.kind === "procedure_key") state = "MISSING";
        else if (m.targetId && TARGET_DOCS[m.targetId] === undefined) state = "NOT_LOCATED";
        else state = "REVIEW_REQUIRED";

        db.upsertRelation({
          id: "",
          fromDocumentId: doc.id,
          fromAnchor: null,
          toDocumentId: m.targetId,
          toExternalName: m.externalName,
          toAnchor: m.anchor,
          kind: "cross_reference",
          state,
          context: row.text.slice(0, 260),
          foundInSectionId: null,
        });
        report.relationsFound++;
        report.states[state]++;
        if (state === "MISSING") {
          report.missing.push({ from: doc.id, ref: m.externalName, anchor: m.anchor });
        }
      }
    }
    opts.log(`${doc.id}: ${rows.length} chunks escaneados`);
  }

  const queue: Array<{ spec: SourceSpec; from: string }> = [];
  for (const source of manifest.sources) {
    if (!source.discoveryTargets) continue;
    for (const t of source.discoveryTargets) {
      const spec: SourceSpec = {
        id: `IMSS-${t.key}`,
        key: t.key,
        title: t.title,
        titleFromDocument: true,
        organization: "IMSS",
        type: "procedure",
        category: "procedimientos",
        url: t.urlPattern,
        canonical: true,
        priority: "high",
      };
      queue.push({ spec, from: source.id });
    }
  }

  for (const { spec, from } of queue) {
    try {
      const result = await downloader.download(spec, root);
      const dir = result.versionDir;
      const pdf = path.join(dir, "original.pdf");
      if (!fs.existsSync(pdf)) throw new Error("sin PDF");
      const extraction = await extractPdfPages(new Uint8Array(fs.readFileSync(pdf)));
      const parsed = parseStructure({
        docId: spec.id,
        versionId: `${spec.id}@${result.versionLabel}`,
        type: "procedure",
        pages: extraction.pages,
        expectedKey: spec.key ?? null,
      });
      if (spec.key && !parsed.keyMatch) {
        report.targets.push({ key: spec.key!, title: spec.title, state: "NOT_LOCATED", message: `SOURCE_MISMATCH: clave ${parsed.docKey ?? "ninguna"}` });
        db.upsertRelation({
          id: "", fromDocumentId: from, fromAnchor: null, toDocumentId: null,
          toExternalName: `Procedimiento ${spec.key}`, toAnchor: spec.key!,
          kind: "discovery", state: "NOT_LOCATED",
          context: `Validación: clave esperada ${spec.key}, encontrada ${parsed.docKey ?? "ninguna"}`, foundInSectionId: null,
        });
        continue;
      }
      const title = parsed.docTitle ?? spec.title;
      db.upsertDocument({
        id: spec.id, key: spec.key, title, organization: ["IMSS"], type: "procedure", category: "procedimientos",
        canonical: true, provenance: "OFFICIAL", url: spec.url ?? null, mirror: null, landingPage: null,
        effectiveFrom: null, effectiveUntil: null, validity: "CURRENT", verificationStatus: null,
        priority: "high", topics: [], warning: `Descubierto desde ${from}`, sourceSpecHash: "",
      });
      db.upsertVersion({
        id: `${spec.id}@${result.versionLabel}`, documentId: spec.id, label: result.versionLabel, dir,
        sha256: result.record.sha256, downloadedAt: result.record.downloadedAt, lastCheckedAt: nowIso(),
        contentType: result.record.contentType, size: result.record.size, resolvedUrl: result.record.resolvedUrl,
        originalUrl: result.record.url, etag: result.record.etag, lastModified: result.record.lastModified,
        status: "PENDING_REVIEW", note: `Descubierto desde ${from}`, pages: extraction.numPages,
      });
      db.replaceSections(parsed.sections);
      db.replaceChunks(parsed.chunks);
      db.insertCitations(parsed.citations);
      db.setVersionExtracted(`${spec.id}@${result.versionLabel}`, extraction.numPages, nowIso());
      db.upsertRelation({
        id: "", fromDocumentId: from, fromAnchor: null, toDocumentId: spec.id, toExternalName: null,
        toAnchor: spec.key!, kind: "discovery", state: "HAVE",
        context: "Validado: HTTP 200, PDF, clave coincidente", foundInSectionId: null,
      });
      report.targets.push({ key: spec.key!, title, state: "ADDED" });
      opts.log(`  + ${spec.id}: validado e integrado (${parsed.chunks.length} chunks)`);
    } catch (err) {
      report.targets.push({
        key: spec.key!, title: spec.title, state: "NOT_LOCATED",
        message: err instanceof Error ? err.message : String(err),
      });
      db.upsertRelation({
        id: "", fromDocumentId: from, fromAnchor: null, toDocumentId: null,
        toExternalName: `Procedimiento ${spec.key}`, toAnchor: spec.key!,
        kind: "discovery", state: "NOT_LOCATED",
        context: err instanceof Error ? err.message : String(err), foundInSectionId: null,
      });
      opts.log(`  ✗ ${spec.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const missingRows = db.listMissingRelations();
  const mdLines: string[] = [
    "# Reporte de Descubrimiento Normativo",
    "",
    `Generado: ${nowIso()}`,
    "",
    `Relaciones encontradas: **${report.relationsFound}**`,
    `- HAVE: ${report.states.HAVE}`,
    `- MISSING: ${report.states.MISSING}`,
    `- NOT_LOCATED: ${report.states.NOT_LOCATED}`,
    `- REVIEW_REQUIRED: ${report.states.REVIEW_REQUIRED}`,
    "",
    "## Discovery targets validados",
    "",
    "| Clave | Título | Estado | Mensaje |",
    "|---|---|---|---|",
    ...report.targets.map((t) => `| ${t.key} | ${t.title} | ${t.state} | ${t.message ?? ""} |`),
    "",
    "## Referencias no localizadas",
    "",
    "| Desde | Referencia | Ancla |",
    "|---|---|---|",
    ...missingRows.map((r) => `| ${r.from_document_id} | ${r.to_external_name} | ${r.to_anchor ?? ""} |`),
    "",
    "## CCT históricos incorporados",
    "",
    report.historicalAdded.length > 0
      ? report.historicalAdded.map((id) => `- ${id} (HISTORICAL)`).join("\n")
      : "- (ninguno nuevo en esta pasada)",
    "",
  ];
  fs.writeFileSync(path.join(root, "normative-discovery-report.md"), mdLines.join("\n"));
  return report;
}
