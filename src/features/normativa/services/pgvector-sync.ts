import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { NormativeDB } from "./db";

/**
 * Sincronización idempotente del corpus local (data/normativa) hacia
 * Supabase pgvector.
 *
 - La biblioteca local es SIEMPRE la fuente maestra; Supabase es un índice
 *   reconstruible desde ella.
 - Upsert por chunk_id + content_hash: nunca DELETE masivo ni truncate.
 - Embeddings: solo se generan para chunks nuevos o cuyo hash cambió;
 *   los reutilizables se conservan tal cual.
 */

export const CORPUS_VERSION = "2026-08-25";
const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;
const EMBED_BATCH = 64;
const UPSERT_BATCH = 50;
const READ_PAGE = 2000;

export interface SyncMetrics {
  localTotal: number;
  remoteTotalBefore: number;
  inserted: number;
  updated: number;
  unchanged: number;
  errors: number;
  embeddingsGenerated: number;
  embeddingsReused: number;
  startedAt: string;
  finishedAt?: string;
}

interface RemoteRow {
  chunk_id: string;
  content_hash: string;
  embedding_model: string | null;
  has_embedding: boolean;
}

function loadRepoEnv(): Record<string, string> {
  // OPENAI_API_KEY vive en bot-api/.env (motor Python); se usa solo como
  // fallback si no está en el entorno del proceso.
  const out: Record<string, string> = {};
  try {
    const raw = fs.readFileSync(path.resolve("bot-api/.env"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // sin bot-api/.env: solo variables de proceso
  }
  return out;
}

export function resolveOpenAIApiKey(): string | undefined {
  return process.env.OPENAI_API_KEY || loadRepoEnv().OPENAI_API_KEY || undefined;
}

export function resolveSupabaseConfig(): { projectRef: string; accessToken: string } | null {
  const ref =
    process.env.SUPABASE_PROJECT_REF ??
    loadDotLocal().SUPABASE_PROJECT_REF ??
    inferRefFromUrl();
  const token = process.env.SUPABASE_ACCESS_TOKEN ?? loadDotLocal().SUPABASE_ACCESS_TOKEN;
  if (!ref || !token) return null;
  return { projectRef: ref, accessToken: token };
}

let dotLocalCache: Record<string, string> | null = null;
function loadDotLocal(): Record<string, string> {
  if (dotLocalCache) return dotLocalCache;
  dotLocalCache = {};
  try {
    const raw = fs.readFileSync(path.resolve(".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*)\s*$/);
      if (m) dotLocalCache[m[1]] = m[2];
    }
  } catch {
    // sin .env.local
  }
  return dotLocalCache;
}

function inferRefFromUrl(): string | undefined {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? loadDotLocal().NEXT_PUBLIC_SUPABASE_URL;
  const m = url?.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i);
  return m?.[1];
}

async function runRemoteSql(accessToken: string, projectRef: string, query: string): Promise<unknown[]> {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(120_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase query ${res.status}: ${text.slice(0, 400)}`);
  return JSON.parse(text) as unknown[];
}

interface LocalChunk {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  documentType: string | null;
  category: string | null;
  versionId: string;
  validity: string;
  effectiveFrom: string | null;
  effectiveUntil: string | null;
  lastReformDate: string | null;
  sectionType: string | null;
  sectionTitle: string | null;
  article: string | null;
  clause: string | null;
  fraction: string | null;
  numeral: string | null;
  pageStart: number | null;
  pageEnd: number | null;
  text: string;
  sourceUrl: string | null;
  provenance: string | null;
  priority: string;
  appliesTo: string[];
  topics: string[];
  contentHash: string;
}

function readLocalChunks(repoRoot: string): LocalChunk[] {
  const db = new NormativeDB(path.join(repoRoot, "data", "normativa", "catalog.sqlite"));
  const rows = (
    db.db.prepare(
      `SELECT c.chunk_key, c.document_id, d.title AS doc_title, d.type AS doc_type,
              d.category, c.version_id, d.validity, d.effective_from, d.effective_until,
              d.last_reform_date, s.kind AS section_kind, c.section_label,
              c.article, c.clause, c.numeral, c.pdf_page, c.text, v.resolved_url,
              d.provenance, d.priority, d.topics
       FROM chunks c
       JOIN documents d ON d.id = c.document_id
       LEFT JOIN versions v ON v.id = c.version_id
       LEFT JOIN sections s ON s.id = c.section_id
       ORDER BY c.document_id, c.version_id, c.ord`,
    ).all() as Array<Record<string, unknown>>
  );
  const out: LocalChunk[] = [];
  for (const r of rows) {
    let topics: string[] = [];
    try {
      topics = JSON.parse((r.topics as string) ?? "[]") as string[];
    } catch {
      topics = [];
    }
    const text = String(r.text ?? "");
    out.push({
      chunkId: String(r.chunk_key),
      documentId: String(r.document_id),
      documentTitle: String(r.doc_title ?? ""),
      documentType: (r.doc_type as string) ?? null,
      category: (r.category as string) ?? null,
      versionId: String(r.version_id ?? ""),
      validity: String(r.validity ?? "PENDING_REVIEW"),
      effectiveFrom: (r.effective_from as string) ?? null,
      effectiveUntil: (r.effective_until as string) ?? null,
      lastReformDate: (r.last_reform_date as string) ?? null,
      sectionType: (r.section_kind as string) ?? null,
      sectionTitle: (r.section_label as string) ?? null,
      article: (r.article as string) ?? null,
      clause: (r.clause as string) ?? null,
      fraction: null,
      numeral: (r.numeral as string) ?? null,
      pageStart: (r.pdf_page as number) ?? null,
      pageEnd: (r.pdf_page as number) ?? null,
      text,
      sourceUrl: (r.resolved_url as string) ?? null,
      provenance: (r.provenance as string) ?? null,
      priority: String(r.priority ?? "medium"),
      appliesTo: [],
      topics,
      contentHash: crypto.createHash("sha256").update(text).digest("hex"),
    });
  }
  return out;
}

async function readRemoteState(
  accessToken: string,
  projectRef: string,
): Promise<{ total: number; rows: Map<string, RemoteRow> }> {
  const rows = new Map<string, RemoteRow>();
  let offset = 0;
  let total = 0;
  for (;;) {
    const page = (await runRemoteSql(
      accessToken,
      projectRef,
      `select chunk_id, content_hash, embedding_model, (embedding is not null) as has_embedding
       from public.normativa_chunks order by chunk_id limit ${READ_PAGE} offset ${offset}`,
    )) as unknown as RemoteRow[];
    total += page.length;
    for (const r of page) rows.set(r.chunk_id, r);
    if (page.length < READ_PAGE) break;
    offset += READ_PAGE;
  }
  return { total, rows };
}

async function embedBatch(apiKey: string, texts: string[]): Promise<number[][]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: texts }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI embeddings ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as { data: Array<{ index: number; embedding: number[] }> };
  const sorted = [...json.data].sort((a, b) => a.index - b.index);
  return sorted.map((d) => d.embedding);
}

function sqlQuote(s: string): string {
  return "'" + s.replace(/'/g, "''") + "'";
}

function buildUpsertSql(items: LocalChunk[], embeddings: Map<string, number[]>): string {
  const payload = items.map((it) => {
    const emb = embeddings.get(it.chunkId);
    return {
      chunkId: it.chunkId,
      documentId: it.documentId,
      documentTitle: it.documentTitle,
      documentType: it.documentType,
      category: it.category,
      versionId: it.versionId,
      validity: it.validity,
      effectiveFrom: it.effectiveFrom,
      effectiveUntil: it.effectiveUntil,
      lastReformDate: it.lastReformDate,
      sectionType: it.sectionType,
      sectionTitle: it.sectionTitle,
      article: it.article,
      clause: it.clause,
      fraction: it.fraction,
      numeral: it.numeral,
      pageStart: it.pageStart,
      pageEnd: it.pageEnd,
      text: it.text.slice(0, 8000),
      contentHash: it.contentHash,
      sourceUrl: it.sourceUrl,
      provenance: it.provenance,
      priority: it.priority,
      appliesTo: it.appliesTo,
      topics: it.topics,
      ...(emb ? { embedding: emb } : {}),
    };
  });
  const jsonb = sqlQuote(JSON.stringify(payload));
  return `select inserted, updated, unchanged from public.normativa_chunks_upsert(${jsonb}::jsonb, ${sqlQuote(CORPUS_VERSION)}, ${sqlQuote(EMBEDDING_MODEL)}, ${EMBEDDING_DIMENSIONS});`;
}

export async function runPgvectorSync(
  repoRoot: string,
  opts: { log: (m: string) => void; dryRun?: boolean; maxItems?: number } = { log: () => {} },
): Promise<SyncMetrics> {
  const startedAt = new Date().toISOString();
  const metrics: SyncMetrics = {
    localTotal: 0,
    remoteTotalBefore: 0,
    inserted: 0,
    updated: 0,
    unchanged: 0,
    errors: 0,
    embeddingsGenerated: 0,
    embeddingsReused: 0,
    startedAt,
  };

  const cfg = resolveSupabaseConfig();
  if (!cfg) throw new Error("Falta SUPABASE_ACCESS_TOKEN o referencia de proyecto");

  const apiKey = resolveOpenAIApiKey();
  if (!apiKey) throw new Error("Falta OPENAI_API_KEY (proceso o bot-api/.env)");

  opts.log("Leyendo corpus local…");
  const locals = readLocalChunks(repoRoot);
  metrics.localTotal = locals.length;

  opts.log("Leyendo estado remoto (idempotencia)…");
  const remote = await readRemoteState(cfg.accessToken, cfg.projectRef);
  metrics.remoteTotalBefore = remote.total;

  const pending: LocalChunk[] = [];
  for (const it of locals) {
    const r = remote.rows.get(it.chunkId);
    if (!r) pending.push(it);
    else if (r.content_hash !== it.contentHash || (!r.has_embedding && !opts.dryRun)) pending.push(it);
    else metrics.embeddingsReused++;
  }

  opts.log(
    `Locales: ${metrics.localTotal} | remotos: ${metrics.remoteTotalBefore} | a sincronizar: ${pending.length}` +
      (opts.dryRun ? " (DRY RUN)" : ""),
  );
  if (opts.maxItems && pending.length > opts.maxItems) pending.length = opts.maxItems;

  for (let i = 0; i < pending.length; i += UPSERT_BATCH) {
    const batch = pending.slice(i, i + UPSERT_BATCH);

    const needEmbedding = batch.filter(() => true);
    const embeddings = new Map<string, number[]>();
    try {
      for (let j = 0; j < needEmbedding.length; j += EMBED_BATCH) {
        const sub = needEmbedding.slice(j, j + EMBED_BATCH);
        const vectors = await embedBatch(
          apiKey,
          sub.map((c) => c.text.slice(0, 8000)),
        );
        sub.forEach((c, k) => embeddings.set(c.chunkId, vectors[k]));
      }
      metrics.embeddingsGenerated += embeddings.size;

      if (opts.dryRun) continue;
      const result = (await runRemoteSql(cfg.accessToken, cfg.projectRef, buildUpsertSql(batch, embeddings))) as Array<{
        inserted: number;
        updated: number;
        unchanged: number;
      }>;
      if (result[0]) {
        metrics.inserted += Number(result[0].inserted ?? 0);
        metrics.updated += Number(result[0].updated ?? 0);
        metrics.unchanged += Number(result[0].unchanged ?? 0);
      }
      opts.log(`  lote ${Math.floor(i / UPSERT_BATCH) + 1}/${Math.ceil(pending.length / UPSERT_BATCH)} OK (+${embeddings.size} embeddings)`);
    } catch (err) {
      metrics.errors++;
      opts.log(`  ERROR en lote ${i}: ${err instanceof Error ? err.message : String(err)}`);
      if (metrics.errors >= 5) {
        opts.log("Demasiados errores consecutivos — abortando para revisión manual.");
        break;
      }
    }
  }

  metrics.finishedAt = new Date().toISOString();
  return metrics;
}
