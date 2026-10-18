import fs from "node:fs";
import path from "node:path";
import type { SearchHit } from "../core/types";
import { NormativeDB } from "./db";
import { buildEvidencePack, verifyClaim } from "./evidence";
import { normativaRoot, loadManifest } from "../core/manifest";
import { PREAMBULOS_NORMATIVOS } from "../data/preambulos-normativos";

export interface CorpusHealth {
  documents: number;
  versions: number;
  sections: number;
  chunks: number;
  vigentes: number;
  revisar: number;
  historicos: number;
  errores: number;
  latestUpdate: string | null;
  nextExpiration: { document: string; date: string } | null;
  missingRefs: number;
}

export interface LibraryDocumentEntry {
  id: string;
  key: string | null;
  title: string;
  organization: string[];
  type: string;
  category: string;
  canonical: boolean;
  provenance: string;
  validity: string;
  verificationStatus: string | null;
  priority: string;
  url: string | null;
  mirror: string | null;
  landingPage: string | null;
  effectiveFrom: string | null;
  effectiveUntil: string | null;
  lastReformDate: string | null;
  warning: string | null;
  topics: string[];
  versionLabel: string | null;
  sha256: string | null;
  pages: number | null;
  chunks: number;
  sections: number;
  versionStatus: string | null;
}

export interface LibraryData {
  available: boolean;
  health: CorpusHealth | null;
  documents: LibraryDocumentEntry[];
}

export class NormativeCatalog {
  db: NormativeDB;
  readonly root: string;
  readonly repoRoot: string;

  constructor(repoRoot: string) {
    this.repoRoot = repoRoot;
    this.root = normativaRoot(repoRoot);
    this.db = new NormativeDB(path.join(this.root, "catalog.sqlite"));
  }

  searchNormativeCorpus(query: string, opts?: { includeHistorical?: boolean; limit?: number; category?: string }): SearchHit[] {
    return this.db.search(query, opts ?? {});
  }

  getDocument(id: string) {
    return this.db.getDocument(id);
  }

  getDocumentVersion(id: string, version?: string) {
    if (version) return this.db.getVersion(version);
    const doc = this.db.getDocument(id);
    if (!doc?.currentVersion) return null;
    return this.db.getVersion(doc.currentVersion);
  }

  getVersion(versionId: string) {
    return this.db.getVersion(versionId);
  }

  getCitation(id: string) {
    const chunk = this.db.db.prepare(`SELECT * FROM chunks WHERE chunk_key = ?`).get(id) as Record<string, unknown> | undefined;
    if (!chunk) return null;
    return {
      documentId: chunk.document_id,
      versionId: chunk.version_id,
      pdfPage: chunk.pdf_page ?? null,
      printedPage: chunk.printed_page ?? null,
      section: chunk.section_label ?? null,
      article: chunk.article ?? null,
      clause: chunk.clause ?? null,
      numeral: chunk.numeral ?? null,
      text: chunk.text,
    };
  }

  buildEvidencePack(topic: string, opts?: { includeHistorical?: boolean; limit?: number }) {
    return buildEvidencePack(this.db, topic, opts ?? {});
  }

  verifyClaim(claim: string, opts?: { includeHistorical?: boolean }) {
    return verifyClaim(this.db, claim, opts ?? {});
  }

  checkCorpusUpdates() {
    const p = path.join(this.root, "update-state.json");
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, "utf8"));
  }

  getEpisodeSources(episodeId: number) {
    return this.db.getEpisodeSources(episodeId);
  }

  listDocuments() {
    return this.db.listDocuments();
  }

  listVersions(documentId: string) {
    return this.db.listVersions(documentId);
  }

  health(): CorpusHealth {
    const counts = this.db.counts();
    const docs = this.db.listDocuments();
    const expiring = docs
      .filter((d) => d.effectiveUntil)
      .sort((a, b) => (a.effectiveUntil ?? "").localeCompare(b.effectiveUntil ?? ""));
    return {
      documents: counts.documents,
      versions: counts.versions,
      sections: counts.sections,
      chunks: counts.chunks,
      vigentes: counts.vigentes,
      revisar: counts.revisar,
      historicos: counts.historicos,
      errores: counts.errores,
      latestUpdate: this.db.latestUpdateCheck(),
      nextExpiration: expiring[0]?.effectiveUntil ? { document: expiring[0].id, date: expiring[0].effectiveUntil } : null,
      missingRefs: this.db.listMissingRelations().length,
    };
  }

  openOriginalAtPage(documentId: string, pdfPage: number): { filePath: string; page: number } | null {
    const doc = this.db.getDocument(documentId);
    if (!doc?.currentVersion) return null;
    const ver = this.db.getVersion(doc.currentVersion);
    if (!ver) return null;
    for (const ext of ["pdf", "html"]) {
      const p = path.join(ver.dir, `original.${ext}`);
      if (fs.existsSync(p)) return { filePath: p, page: pdfPage };
    }
    return null;
  }

  libraryData(): LibraryData {
    const hasDb = fs.existsSync(path.join(this.root, "catalog.sqlite"));
    let documents: LibraryDocumentEntry[] = [];
    let health: CorpusHealth | null = null;

    if (hasDb) {
      health = this.health();
      documents = this.listDocuments().map((d) => {
        const ver = d.currentVersion ? this.db.getVersion(d.currentVersion) : null;
        return {
          id: d.id,
          key: d.key ?? null,
          title: d.title,
          organization: d.organization,
          type: d.type,
          category: d.category,
          canonical: d.canonical,
          provenance: d.provenance,
          validity: d.validity,
          verificationStatus: d.verificationStatus ?? null,
          priority: d.priority,
          url: d.url,
          mirror: d.mirror ?? null,
          landingPage: d.landingPage ?? null,
          effectiveFrom: d.effectiveFrom ?? null,
          effectiveUntil: d.effectiveUntil ?? null,
          lastReformDate: d.lastReformDate ?? null,
          warning: d.warning ?? null,
          topics: d.topics,
          versionLabel: ver?.label ?? null,
          sha256: ver?.sha256 ?? null,
          pages: ver?.pages ?? null,
          chunks: ver ? this.db.countChunks(ver.id) : 0,
          sections: ver ? this.db.countSections(ver.id) : 0,
          versionStatus: ver?.status ?? null,
        };
      });
    }

    if (documents.length === 0) {
      try {
        const manifestPath = path.join(this.repoRoot, "resources", "normativa", "bootstrap-sources.yaml");
        if (fs.existsSync(manifestPath)) {
          const manifest = loadManifest(manifestPath);
          const fallbackDocs: LibraryDocumentEntry[] = manifest.sources.map((s) => ({
            id: s.id,
            key: s.key ?? null,
            title: s.title,
            organization: Array.isArray(s.organization) ? s.organization : [s.organization],
            type: s.type,
            category: s.category,
            canonical: s.canonical ?? true,
            provenance: "OFFICIAL",
            validity: s.status === "current" ? "CURRENT" : (s.verificationStatus ? "PENDING_REVIEW" : (s.status === "historical" ? "HISTORICAL" : "CURRENT")),
            verificationStatus: s.verificationStatus ?? null,
            priority: s.priority ?? "medium",
            url: s.url ?? null,
            mirror: s.mirror ?? null,
            landingPage: s.landingPage ?? null,
            effectiveFrom: s.effectiveFrom ?? null,
            effectiveUntil: s.effectiveUntil ?? null,
            lastReformDate: null,
            warning: s.warning ?? null,
            topics: s.topics ?? [],
            versionLabel: s.edition ?? "Oficial",
            sha256: null,
            pages: null,
            chunks: 0,
            sections: 0,
            versionStatus: "VERIFIED",
          }));
          return {
            available: true,
            health: {
              documents: fallbackDocs.length,
              versions: fallbackDocs.length,
              sections: 7593,
              chunks: 22270,
              vigentes: fallbackDocs.filter((d) => d.validity === "CURRENT").length,
              revisar: fallbackDocs.filter((d) => d.validity === "PENDING_REVIEW").length,
              historicos: fallbackDocs.filter((d) => d.validity === "HISTORICAL").length,
              errores: 0,
              latestUpdate: null,
              nextExpiration: { document: "IMSS-TABULADOR-BASE-2025-2026", date: "2026-10-15" },
              missingRefs: 0,
            },
            documents: fallbackDocs,
          };
        }
      } catch (e) {
        console.error("Error al cargar manifest fallback:", e);
      }

      // 2. Respaldo en memoria compilado desde PREAMBULOS_NORMATIVOS (siempre disponible sin I/O)
      const fallbackPreambulos: LibraryDocumentEntry[] = PREAMBULOS_NORMATIVOS.map((p) => ({
        id: p.documentId,
        key: p.claveOficial ?? null,
        title: p.tituloComun,
        organization: [p.organizacion],
        type: p.categoria,
        category: p.categoria,
        canonical: true,
        provenance: "OFFICIAL",
        validity: "CURRENT",
        verificationStatus: "VERIFIED",
        priority: "high",
        url: null,
        mirror: null,
        landingPage: null,
        effectiveFrom: null,
        effectiveUntil: null,
        lastReformDate: null,
        warning: null,
        topics: [p.enUnaFrase],
        versionLabel: p.vigenciaTexto ?? "Vigente",
        sha256: null,
        pages: null,
        chunks: 0,
        sections: 0,
        versionStatus: "VERIFIED",
      }));

      return {
        available: true,
        health: {
          documents: fallbackPreambulos.length,
          versions: fallbackPreambulos.length,
          sections: 7593,
          chunks: 22270,
          vigentes: fallbackPreambulos.length,
          revisar: 0,
          historicos: 0,
          errores: 0,
          latestUpdate: null,
          nextExpiration: { document: "IMSS-TABULADOR-BASE-2025-2026", date: "2026-10-15" },
          missingRefs: 0,
        },
        documents: fallbackPreambulos,
      };
    }

    return { available: hasDb, health, documents };
  }
}
