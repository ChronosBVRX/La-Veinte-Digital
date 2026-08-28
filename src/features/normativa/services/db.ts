import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import type {
  DocumentChunk,
  DocumentCitation,
  DocumentMetadata,
  DocumentRelation,
  DocumentSection,
  DocumentVersion,
  SearchHit,
  SourceState,
  UpdateCheck,
  ValidityStatus,
} from "../core/types";

export class NormativeDB {
  readonly db: DatabaseSync;

  constructor(pathOrDb: string | DatabaseSync) {
    if (typeof pathOrDb === "string") {
      // El corpus puede no existir (instalación sin biblioteca). Creamos el
      // directorio para abrir una BD vacía y fallar de forma controlada
      // (0 documentos → LOCAL_LIBRARY_UNAVAILABLE) en vez de crashear el sidecar.
      fs.mkdirSync(path.dirname(path.resolve(pathOrDb)), { recursive: true });
    }
    this.db = typeof pathOrDb === "string" ? new DatabaseSync(pathOrDb) : pathOrDb;
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.migrate();
  }

  migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        key TEXT,
        title TEXT NOT NULL,
        edition TEXT,
        organization TEXT NOT NULL DEFAULT '',
        type TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'otros',
        canonical INTEGER NOT NULL DEFAULT 0,
        provenance TEXT NOT NULL DEFAULT 'UNVERIFIED',
        url TEXT,
        mirror TEXT,
        landing_page TEXT,
        effective_from TEXT,
        effective_until TEXT,
        validity TEXT NOT NULL DEFAULT 'UNKNOWN',
        verification_status TEXT,
        priority TEXT NOT NULL DEFAULT 'medium',
        last_reform_date TEXT,
        topics TEXT NOT NULL DEFAULT '',
        warning TEXT,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS versions (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL REFERENCES documents(id),
        label TEXT NOT NULL,
        dir TEXT NOT NULL,
        sha256 TEXT NOT NULL,
        downloaded_at TEXT NOT NULL,
        last_checked_at TEXT,
        content_type TEXT,
        size INTEGER,
        resolved_url TEXT,
        original_url TEXT,
        etag TEXT,
        last_modified TEXT,
        status TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
        note TEXT,
        pages INTEGER,
        extracted_at TEXT,
        UNIQUE(document_id, sha256)
      );

      CREATE TABLE IF NOT EXISTS sections (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        version_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        label TEXT NOT NULL,
        ord INTEGER NOT NULL,
        start_page INTEGER,
        end_page INTEGER,
        parent_id TEXT
      );

      CREATE TABLE IF NOT EXISTS chunks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chunk_key TEXT UNIQUE NOT NULL,
        document_id TEXT NOT NULL,
        version_id TEXT NOT NULL,
        section_id TEXT,
        pdf_page INTEGER,
        printed_page TEXT,
        section_label TEXT,
        article TEXT,
        clause TEXT,
        numeral TEXT,
        text TEXT NOT NULL,
        ord INTEGER NOT NULL
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
        text, content='chunks', content_rowid='id', tokenize='unicode61 remove_diacritics 2'
      );

      CREATE TABLE IF NOT EXISTS citations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id TEXT NOT NULL,
        version_id TEXT NOT NULL,
        pdf_page INTEGER,
        printed_page TEXT,
        section_label TEXT,
        article TEXT,
        clause TEXT,
        numeral TEXT,
        text TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS relations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_document_id TEXT NOT NULL,
        from_anchor TEXT,
        to_document_id TEXT,
        to_external_name TEXT,
        to_anchor TEXT,
        kind TEXT NOT NULL DEFAULT 'cross_reference',
        state TEXT NOT NULL DEFAULT 'MISSING',
        context TEXT,
        found_in_section_id TEXT
      );

      CREATE TABLE IF NOT EXISTS update_checks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id TEXT NOT NULL,
        checked_at TEXT NOT NULL,
        kind TEXT NOT NULL,
        sha256 TEXT,
        etag TEXT,
        last_modified TEXT,
        changed INTEGER NOT NULL DEFAULT 0,
        last_reform_date TEXT,
        expires_soon INTEGER NOT NULL DEFAULT 0,
        message TEXT
      );

      CREATE TABLE IF NOT EXISTS source_states (
        id TEXT PRIMARY KEY,
        state TEXT NOT NULL DEFAULT 'AVAILABLE',
        retry_after TEXT,
        last_error TEXT,
        attempts INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS episodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        topic TEXT NOT NULL,
        cutoff TEXT NOT NULL,
        created_at TEXT NOT NULL,
        state TEXT NOT NULL DEFAULT 'DRAFT',
        verified INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS episode_sources (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        episode_id INTEGER NOT NULL REFERENCES episodes(id),
        document_id TEXT NOT NULL,
        version_id TEXT NOT NULL,
        sha256 TEXT NOT NULL,
        chunk_ids TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS claims (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        episode_id INTEGER,
        claim_key TEXT,
        text TEXT NOT NULL,
        type TEXT NOT NULL,
        state TEXT NOT NULL,
        note TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_chunks_doc ON chunks(document_id, version_id);
      CREATE INDEX IF NOT EXISTS idx_chunks_page ON chunks(version_id, pdf_page);
      CREATE INDEX IF NOT EXISTS idx_sections_doc ON sections(version_id);
      CREATE INDEX IF NOT EXISTS idx_versions_doc ON versions(document_id);
    `);

    const docCols = this.db.prepare(`PRAGMA table_info(documents)`).all() as Array<{ name: string }>;
    if (!docCols.some((c) => c.name === "edition")) {
      this.db.exec(`ALTER TABLE documents ADD COLUMN edition TEXT`);
    }
  }

  upsertDocument(doc: DocumentMetadata) {
    this.db
      .prepare(
        `INSERT INTO documents (id, key, title, edition, organization, type, category, canonical, provenance, url, mirror, landing_page,
           effective_from, effective_until, validity, verification_status, priority, last_reform_date, topics, warning, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           key=excluded.key, title=excluded.title, edition=excluded.edition, organization=excluded.organization, type=excluded.type,
           category=excluded.category, canonical=excluded.canonical, provenance=excluded.provenance, url=excluded.url,
           mirror=excluded.mirror, landing_page=excluded.landing_page, effective_from=excluded.effective_from,
           effective_until=excluded.effective_until, validity=excluded.validity,
           verification_status=excluded.verification_status, priority=excluded.priority,
           last_reform_date=excluded.last_reform_date, topics=excluded.topics, warning=excluded.warning,
           updated_at=excluded.updated_at`
      )
      .run(
        doc.id, doc.key ?? null, doc.title, doc.edition ?? null, doc.organization.join(", "), doc.type, doc.category,
        doc.canonical ? 1 : 0, doc.provenance, doc.url, doc.mirror ?? null, doc.landingPage ?? null,
        doc.effectiveFrom ?? null, doc.effectiveUntil ?? null, doc.validity, doc.verificationStatus ?? null,
        doc.priority, doc.lastReformDate ?? null, doc.topics.join(","), doc.warning ?? null, new Date().toISOString()
      );
  }

  upsertVersion(v: DocumentVersion) {
    this.db
      .prepare(
        `INSERT INTO versions (id, document_id, label, dir, sha256, downloaded_at, last_checked_at, content_type, size,
           resolved_url, original_url, etag, last_modified, status, note, pages, extracted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           last_checked_at=excluded.last_checked_at, status=excluded.status, note=excluded.note, pages=excluded.pages,
           extracted_at=excluded.extracted_at`
      )
      .run(
        v.id, v.documentId, v.label, v.dir, v.sha256, v.downloadedAt, v.lastCheckedAt, v.contentType, v.size,
        v.resolvedUrl, v.originalUrl, v.etag ?? null, v.lastModified ?? null, v.status, v.note ?? null,
        v.pages ?? null, null
      );
  }

  setVersionExtracted(versionId: string, pages: number, extractedAt: string) {
    this.db
      .prepare(`UPDATE versions SET pages = ?, extracted_at = ?, status = 'VERIFIED' WHERE id = ?`)
      .run(pages, extractedAt, versionId);
  }

  replaceSections(sections: DocumentSection[]) {
    if (sections.length === 0) return;
    const versionId = sections[0].versionId;
    const label = versionId.includes("@") ? versionId.split("@").slice(1).join("@") : versionId;
    this.db.prepare(`DELETE FROM sections WHERE document_id = ? AND version_id IN (?, ?)`).run(sections[0].documentId, versionId, label);
    const ins = this.db.prepare(
      `INSERT INTO sections (id, document_id, version_id, kind, label, ord, start_page, end_page, parent_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const s of sections) {
      ins.run(s.id, s.documentId, s.versionId, s.kind, s.label, s.order, s.startPage, s.endPage, s.parentId);
    }
  }

  replaceChunks(chunks: DocumentChunk[]) {
    if (chunks.length === 0) return;
    const versionId = chunks[0].versionId;
    const label = versionId.includes("@") ? versionId.split("@").slice(1).join("@") : versionId;
    this.db.prepare(`DELETE FROM chunks WHERE document_id = ? AND version_id IN (?, ?)`).run(chunks[0].documentId, versionId, label);
    this.db.prepare(`DELETE FROM citations WHERE document_id = ? AND version_id IN (?, ?)`).run(chunks[0].documentId, versionId, label);
    const ins = this.db.prepare(
      `INSERT INTO chunks (chunk_key, document_id, version_id, section_id, pdf_page, printed_page, section_label,
         article, clause, numeral, text, ord)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const c of chunks) {
      ins.run(
        `${c.versionId}:${c.order}`, c.documentId, c.versionId, c.sectionId, c.pdfPageIndex, c.printedPage,
        c.section, c.article, c.clause, c.numeral, c.text, c.order
      );
    }
    this.db.prepare(`INSERT INTO chunks_fts(chunks_fts) VALUES ('rebuild')`).run();
  }

  insertCitations(citations: Array<DocumentCitation>) {
    const ins = this.db.prepare(
      `INSERT INTO citations (document_id, version_id, pdf_page, printed_page, section_label, article, clause, numeral, text)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const c of citations) {
      ins.run(c.documentId, c.versionId, c.pdfPage, c.printedPage, c.section ?? null, c.article ?? null, c.clause ?? null, c.numeral ?? null, c.text);
    }
  }

  upsertRelation(r: DocumentRelation) {
    this.db
      .prepare(
        `INSERT INTO relations (from_document_id, from_anchor, to_document_id, to_external_name, to_anchor, kind, state, context, found_in_section_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        r.fromDocumentId, r.fromAnchor, r.toDocumentId ?? null, r.toExternalName ?? null, r.toAnchor ?? null,
        r.kind, r.state, r.context, r.foundInSectionId ?? null
      );
  }

  clearRelationsFor(documentId: string) {
    this.db.prepare(`DELETE FROM relations WHERE from_document_id = ?`).run(documentId);
  }

  getSourceState(id: string): SourceState | null {
    const row = this.db.prepare(`SELECT * FROM source_states WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      id: row.id as string,
      state: row.state as SourceState["state"],
      retryAfter: (row.retry_after as string) ?? null,
      lastError: (row.last_error as string) ?? null,
      attempts: (row.attempts as number) ?? 0,
      updatedAt: row.updated_at as string,
    };
  }

  setSourceState(
    id: string,
    state: SourceState["state"],
    opts: { retryAfter?: string | null; lastError?: string | null; resetAttempts?: boolean } = {}
  ) {
    const prev = this.getSourceState(id);
    const attempts = opts.resetAttempts ? 0 : (prev?.attempts ?? 0) + 1;
    this.db
      .prepare(
        `INSERT INTO source_states (id, state, retry_after, last_error, attempts, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           state=excluded.state, retry_after=excluded.retry_after, last_error=excluded.last_error,
           attempts=excluded.attempts, updated_at=excluded.updated_at`
      )
      .run(id, state, opts.retryAfter ?? null, opts.lastError ?? null, attempts, new Date().toISOString());
  }

  listSourceStates(): SourceState[] {
    return (this.db.prepare(`SELECT * FROM source_states ORDER BY id`).all() as Array<Record<string, unknown>>).map((row) => ({
      id: row.id as string,
      state: row.state as SourceState["state"],
      retryAfter: (row.retry_after as string) ?? null,
      lastError: (row.last_error as string) ?? null,
      attempts: (row.attempts as number) ?? 0,
      updatedAt: row.updated_at as string,
    }));
  }

  insertUpdateCheck(u: UpdateCheck) {    this.db
      .prepare(
        `INSERT INTO update_checks (document_id, checked_at, kind, sha256, etag, last_modified, changed, last_reform_date, expires_soon, message)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        u.documentId, u.checkedAt, u.kind, u.sha256, u.etag, u.lastModified, u.changed ? 1 : 0,
        u.lastReformDate, u.expiresSoon ? 1 : 0, u.message
      );
  }

  getDocument(id: string): (DocumentMetadata & { currentVersion: string | null }) | null {
    const row = this.db.prepare(`SELECT * FROM documents WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    const ver = this.db
      .prepare(`SELECT id FROM versions WHERE document_id = ? ORDER BY downloaded_at DESC LIMIT 1`)
      .get(id) as { id: string } | undefined;
    return {
      id: row.id as string,
      key: (row.key as string) ?? undefined,
      title: row.title as string,
      edition: (row.edition as string) ?? undefined,
      organization: (row.organization as string).split(", ").filter(Boolean),
      type: row.type as DocumentMetadata["type"],
      category: row.category as string,
      canonical: !!row.canonical,
      provenance: row.provenance as DocumentMetadata["provenance"],
      url: (row.url as string) ?? null,
      mirror: (row.mirror as string) ?? null,
      landingPage: (row.landing_page as string) ?? null,
      effectiveFrom: (row.effective_from as string) ?? null,
      effectiveUntil: (row.effective_until as string) ?? null,
      validity: row.validity as ValidityStatus,
      verificationStatus: (row.verification_status as string) ?? null,
      priority: row.priority as DocumentMetadata["priority"],
      lastReformDate: (row.last_reform_date as string) ?? null,
      topics: ((row.topics as string) ?? "").split(",").filter(Boolean),
      warning: (row.warning as string) ?? null,
      sourceSpecHash: "",
      currentVersion: ver?.id ?? null,
    };
  }

  getVersion(versionId: string): DocumentVersion | null {
    const row = this.db.prepare(`SELECT * FROM versions WHERE id = ?`).get(versionId) as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      id: row.id as string,
      documentId: row.document_id as string,
      label: row.label as string,
      dir: row.dir as string,
      sha256: row.sha256 as string,
      downloadedAt: row.downloaded_at as string,
      lastCheckedAt: row.last_checked_at as string,
      contentType: (row.content_type as string) ?? "",
      size: (row.size as number) ?? 0,
      resolvedUrl: row.resolved_url as string,
      originalUrl: row.original_url as string,
      etag: (row.etag as string) ?? null,
      lastModified: (row.last_modified as string) ?? null,
      status: row.status as DocumentVersion["status"],
      note: (row.note as string) ?? null,
      pages: (row.pages as number) ?? null,
    };
  }

  listDocuments(): Array<DocumentMetadata & { currentVersion: string | null }> {
    const rows = this.db.prepare(`SELECT id FROM documents ORDER BY priority, title`).all() as Array<{ id: string }>;
    return rows.map((r) => this.getDocument(r.id)!).filter(Boolean);
  }

  listVersions(documentId: string): DocumentVersion[] {
    return (this.db.prepare(`SELECT * FROM versions WHERE document_id = ? ORDER BY downloaded_at ASC`).all(documentId) as Array<Record<string, unknown>>)
      .map((row) => ({
        id: row.id as string,
        documentId: row.document_id as string,
        label: row.label as string,
        dir: row.dir as string,
        sha256: row.sha256 as string,
        downloadedAt: row.downloaded_at as string,
        lastCheckedAt: row.last_checked_at as string,
        contentType: (row.content_type as string) ?? "",
        size: (row.size as number) ?? 0,
        resolvedUrl: row.resolved_url as string,
        originalUrl: row.original_url as string,
        etag: (row.etag as string) ?? null,
        lastModified: (row.last_modified as string) ?? null,
        status: row.status as DocumentVersion["status"],
        note: (row.note as string) ?? null,
        pages: (row.pages as number) ?? null,
      }));
  }

  search(query: string, opts: { includeHistorical?: boolean; limit?: number; category?: string; mode?: "and" | "or" } = {}): SearchHit[] {
    const tokens = query
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((t) => t.replace(/["'()]/g, ""))
      .slice(0, 8);
    if (tokens.length === 0) return [];
    const baseSql = `
      SELECT c.chunk_key AS chunk_id, c.document_id, d.title AS document_title, c.version_id, c.pdf_page, c.printed_page,
             c.section_label, c.article, c.clause, c.numeral, c.text,
             snippet(chunks_fts, 0, '[', ']', '…', 24) AS sn,
             d.validity, d.provenance, d.category, d.priority,
             bm25(chunks_fts, 10.0, 2.0) AS rank
      FROM chunks_fts f
      JOIN chunks c ON c.id = f.rowid
      JOIN documents d ON d.id = c.document_id
      WHERE chunks_fts MATCH ?
      ${opts.category ? "AND d.category = ?" : ""}
      ORDER BY rank
      LIMIT ${Math.min(opts.limit ?? 20, 100)}
    `;
    const limit = Math.min(opts.limit ?? 20, 100);
    const runQuery = (ftsQuery: string, mode: "and" | "or"): Array<Record<string, unknown>> => {
      const joiner = mode === "or" ? " OR " : " AND ";
      const q = ftsQuery.split("§").join(joiner);
      const sql = baseSql;
      const params: Array<string | number> = [q];
      if (opts.category) params.push(opts.category);
      return this.db.prepare(sql).all(...params) as Array<Record<string, unknown>>;
    };

    const quoted = tokens.map((t) => `"${t}"`);
    const requestedMode = opts.mode ?? "and";
    let rows = runQuery(quoted.join("§"), requestedMode);
    const hasStrictTokens = tokens.some((t) => /\d/.test(t));
    if (rows.length === 0 && requestedMode === "and" && tokens.length > 1 && !hasStrictTokens) {
      rows = runQuery(quoted.join("§"), "or");
    }

    if (!opts.includeHistorical) {
      rows = rows.filter((r) => !["HISTORICAL", "EXPIRED", "SUPERSEDED", "REPEALED"].includes(r.validity as string));
    }
    const filtered = rows.slice(0, limit);
    return filtered.map((r) => ({
      documentId: r.document_id as string,
      documentTitle: r.document_title as string,
      versionId: r.version_id as string,
      chunkId: r.chunk_id as string,
      pdfPageIndex: (r.pdf_page as number) ?? null,
      printedPage: (r.printed_page as string) ?? null,
      section: (r.section_label as string) ?? null,
      article: (r.article as string) ?? null,
      clause: (r.clause as string) ?? null,
      numeral: (r.numeral as string) ?? null,
      snippet: (r.sn as string) ?? "",
      text: r.text as string,
      validity: r.validity as ValidityStatus,
      provenance: r.provenance as string as SearchHit["provenance"],
      category: r.category as string,
      priority: r.priority as SearchHit["priority"],
    }));
  }

  getChunksForSection(sectionId: string): DocumentChunk[] {
    return (this.db.prepare(`SELECT * FROM chunks WHERE section_id = ? ORDER BY ord`).all(sectionId) as Array<Record<string, unknown>>)
      .map((r) => this.rowToChunk(r));
  }

  getChunksForClause(documentId: string, clause: string, currentVersionId: string): DocumentChunk[] {
    return (
      this.db
        .prepare(`SELECT * FROM chunks WHERE document_id = ? AND version_id = ? AND clause = ? ORDER BY ord`)
        .all(documentId, currentVersionId, clause) as Array<Record<string, unknown>>
    ).map((r) => this.rowToChunk(r));
  }

  getArticleChunks(documentId: string, article: string, currentVersionId: string): DocumentChunk[] {
    return (
      this.db
        .prepare(`SELECT * FROM chunks WHERE document_id = ? AND version_id = ? AND article = ? ORDER BY ord`)
        .all(documentId, currentVersionId, article) as Array<Record<string, unknown>>
    ).map((r) => this.rowToChunk(r));
  }

  listMissingRelations(): Array<Record<string, unknown>> {
    return this.db
      .prepare(
        `SELECT r.*, d.title AS from_title FROM relations r LEFT JOIN documents d ON d.id = r.from_document_id
         WHERE r.state IN ('MISSING','NOT_LOCATED') ORDER BY r.from_document_id`
      )
      .all() as Array<Record<string, unknown>>;
  }

  countRelations(): number {
    return (this.db.prepare(`SELECT COUNT(*) AS c FROM relations`).get() as { c: number }).c;
  }

  createEpisode(topic: string, cutoff: string): number {
    const r = this.db
      .prepare(`INSERT INTO episodes (topic, cutoff, created_at, state) VALUES (?, ?, ?, 'DRAFT')`)
      .run(topic, cutoff, new Date().toISOString());
    return Number(r.lastInsertRowid);
  }

  linkEpisodeSource(episodeId: number, documentId: string, versionId: string, sha256: string, chunkIds: string[]) {
    this.db
      .prepare(
        `INSERT INTO episode_sources (episode_id, document_id, version_id, sha256, chunk_ids, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(episodeId, documentId, versionId, sha256, JSON.stringify(chunkIds), new Date().toISOString());
  }

  getEpisodeSources(episodeId: number): Array<Record<string, unknown>> {
    return this.db
      .prepare(`SELECT * FROM episode_sources WHERE episode_id = ? ORDER BY id`)
      .all(episodeId) as Array<Record<string, unknown>>;
  }

  setEpisodeVerified(episodeId: number, verified: boolean) {
    this.db.prepare(`UPDATE episodes SET verified = ?, state = ? WHERE id = ?`).run(
      verified ? 1 : 0,
      verified ? "VERIFIED" : "DRAFT",
      episodeId
    );
  }

  counts(): Record<string, number> {
    const one = (sql: string) => (this.db.prepare(sql).get() as { c: number }).c;
    return {
      documents: one(`SELECT COUNT(*) AS c FROM documents`),
      versions: one(`SELECT COUNT(*) AS c FROM versions`),
      sections: one(`SELECT COUNT(*) AS c FROM sections`),
      chunks: one(`SELECT COUNT(*) AS c FROM chunks`),
      citations: one(`SELECT COUNT(*) AS c FROM citations`),
      relations: one(`SELECT COUNT(*) AS c FROM relations`),
      vigentes: one(`SELECT COUNT(*) AS c FROM documents WHERE validity = 'CURRENT'`),
      revisar: one(
        `SELECT COUNT(*) AS c FROM documents WHERE validity IN ('PENDING_REVIEW','UNKNOWN') OR verification_status IS NOT NULL`
      ),
      historicos: one(`SELECT COUNT(*) AS c FROM documents WHERE validity = 'HISTORICAL'`),
      errores: one(`SELECT COUNT(*) AS c FROM versions WHERE status = 'ERROR'`),
    };
  }

  latestUpdateCheck(): string | null {
    const r = this.db.prepare(`SELECT MAX(checked_at) AS t FROM update_checks`).get() as { t: string | null };
    return r.t ?? null;
  }

  countChunks(versionId: string): number {
    return (this.db.prepare(`SELECT COUNT(*) AS c FROM chunks WHERE version_id = ?`).get(versionId) as { c: number }).c;
  }

  countSections(versionId: string): number {
    return (this.db.prepare(`SELECT COUNT(*) AS c FROM sections WHERE version_id = ?`).get(versionId) as { c: number }).c;
  }

  getCitations(versionId: string, limit = 200): Array<Record<string, unknown>> {
    return this.db
      .prepare(
        `SELECT id, pdf_page, printed_page, section_label, article, clause, numeral, text FROM citations
         WHERE version_id = ? ORDER BY id LIMIT ?`
      )
      .all(versionId, limit) as Array<Record<string, unknown>>;
  }

  private rowToChunk(r: Record<string, unknown>): DocumentChunk {
    return {
      id: r.chunk_key as string,
      documentId: r.document_id as string,
      versionId: r.version_id as string,
      sectionId: (r.section_id as string) ?? null,
      pdfPageIndex: (r.pdf_page as number) ?? 1,
      printedPage: (r.printed_page as string) ?? null,
      section: (r.section_label as string) ?? null,
      article: (r.article as string) ?? null,
      clause: (r.clause as string) ?? null,
      numeral: (r.numeral as string) ?? null,
      text: r.text as string,
      order: r.ord as number,
    };
  }
}
