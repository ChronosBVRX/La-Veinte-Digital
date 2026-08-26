import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "./shared";
import { NormativeDB } from "../services/db";

/**
 * Verificación post-sincronización del RAG remoto:
 * - compara conteos locales vs Supabase;
 * - ejecuta consultas reales vía las RPCs productivas (exacta/FTS/vector);
 * - mide latencias p50/p95 de retrieval.
 *
 * Uso: npm run normativa:verify-rag
 */

const QUERIES = [
  "cláusula 63 bis",
  "tiempo extraordinario",
  "procedimiento 1A74-003-031",
  "vacaciones",
  "guardias",
  "fondo de ahorro",
  "actividades fuera de categoría",
  "qué dice mi profesiograma",
  "acoso laboral",
  "NOM-035",
  "equipo de protección personal",
  "trabajo con rayos X",
  "NOM-229",
  "Ley Silla",
  "ya son 40 horas de jornada",
  "cuáles son los Estatutos SNTSS 2026",
  "INFONAVIT",
  "jubilación y pensión",
];

function loadEnvFile(p: string): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    for (const line of fs.readFileSync(path.resolve(p), "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // opcional
  }
  return out;
}

function resolveConfig() {
  const dotLocal = loadEnvFile(".env.local");
  const botEnv = loadEnvFile("bot-api/.env");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? dotLocal.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const ref = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? "";
  const token = process.env.SUPABASE_ACCESS_TOKEN ?? dotLocal.SUPABASE_ACCESS_TOKEN ?? "";
  const openaiKey = process.env.OPENAI_API_KEY ?? botEnv.OPENAI_API_KEY ?? "";
  return { ref, token, openaiKey };
}

async function sql(token: string, ref: string, query: string): Promise<Array<Record<string, unknown>>> {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(60_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`query ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text) as Array<Record<string, unknown>>;
}

async function embed(key: string, text: string): Promise<number[]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "text-embedding-3-small", input: text }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`embed ${res.status}`);
  const json = (await res.json()) as { data: Array<{ embedding: number[] }> };
  return json.data[0].embedding;
}

interface Hit {
  document_id: string;
  document_title: string;
  validity: string;
  clause: string | null;
  article: string | null;
  page_start: number | null;
  score: number;
}

function fuse(rowsByPath: Hit[][]): Hit[] {
  const byId = new Map<string, Hit>();
  for (const rows of rowsByPath) {
    for (const r of rows) {
      const key = `${r.document_id}:${r.clause ?? r.article ?? ""}:${r.page_start ?? ""}`;
      const existing = byId.get(key);
      if (existing) existing.score += r.score * 0.5;
      else byId.set(key, { ...r, score: r.score });
    }
  }
  return [...byId.values()].sort((a, b) => b.score - a.score).slice(0, 5);
}


function exactRows(refs: { clause?: string; article?: string; key?: string }): string {
  const conds: string[] = [];
  if (refs.clause) conds.push(`lower(trim(clause)) = lower('${refs.clause.replace(/'/g, "''")}')`);
  if (refs.article) conds.push(`lower(trim(article)) = lower('${refs.article.replace(/'/g, "''")}')`);
  if (refs.key) {
    const k = refs.key.replace(/'/g, "''");
    conds.push(`document_id ilike '${k}%' or chunk_id ilike '%${k}%' or text ilike '%${k}%'`);
  }
  if (conds.length === 0) return "";
  const where = conds.map((c) => `(${c})`).join(" or ");
  const k = refs.key?.replace(/'/g, "''");
  return `select document_id, document_title, validity, clause, article, page_start, 1000::float as score from public.normativa_chunks where (${where}) order by case when validity='CURRENT' then 0 when validity='PENDING_REVIEW' then 1 else 2 end${
    k ? `, case when document_id ilike '${k}%' then 0 when chunk_id ilike '%${k}%' then 1 else 2 end` : ""
  } limit 6`;
}

async function main() {
  const { ref, token, openaiKey } = resolveConfig();
  if (!ref || !token) throw new Error("Falta configuración de Supabase");

  const db = new NormativeDB(path.join(REPO_ROOT, "data", "normativa", "catalog.sqlite"));
  const localTotal = (
    db.db.prepare("select count(*) n from chunks").get() as { n: number }
  ).n;

  const remoteTotal = (
    await sql(
      token,
      ref,
      "select count(*)::int n, count(embedding)::int e from public.normativa_chunks",
    )
  )[0] as unknown as { n: number; e: number };

  console.log("════════ CONTEO LOCAL vs REMOTO ════════");
  console.log(`Chunks locales:            ${localTotal}`);
  console.log(`Chunks remotos:            ${remoteTotal.n}`);
  console.log(`Remotos con embedding:     ${remoteTotal.e}`);
  console.log(
    remoteTotal.n === localTotal ? "✓ Sin pérdida silenciosa" : `⚠ DIFERENCIA: ${localTotal - remoteTotal.n}`,
  );
  console.log("");

  console.log("════════ CONSULTAS DE VERIFICACIÓN ════════");
  const latencies: number[] = [];
  let ok = 0;
  let empty = 0;
  for (const q of QUERIES) {
    const t0 = Date.now();
    const paths: Hit[][] = [];

    const clauseM = q.match(/cl[áa]usula\s+(\d+\s*(?:bis|ter)?)/i);
    const artM = q.match(/art[íi]culo\s+("?(\d+(?:\s*bis)?)"?)/i);
    const homoM = q.match(/\b\d[AB]\d{2}-\d{3}-\d{3}\b/i);
    let key = homoM?.[0];
    if (!key) {
      const nom = q.match(/\bNOM[-\s]?\d{3}(?:[-\s]?[A-Z0-9]+)*\b/i);
      if (nom) key = nom[0].toUpperCase().replace(/\s+/g, "-");
    }
    const exSql = exactRows({
      clause: clauseM?.[1],
      article: artM?.[2]?.replace(/"/g, ""),
      key,
    });
    if (exSql) {
      try {
        paths.push((await sql(token, ref, exSql)) as unknown as Hit[]);
      } catch {
        // path opcional
      }
    }

    try {
      const fts = await sql(
        token,
        ref,
        `select document_id, document_title, validity, clause, article, page_start, ts_rank_cd(to_tsvector('spanish', text), websearch_to_tsquery('spanish', '${q.replace(/'/g, "''")}'))::float * 400 as score from public.normativa_chunks where to_tsvector('spanish', text) @@ websearch_to_tsquery('spanish', '${q.replace(/'/g, "''")}') order by score desc limit 10`,
      );
      paths.push(fts as unknown as Hit[]);
    } catch {
      // path opcional
    }

    if (openaiKey) {
      try {
        const vec = await embed(openaiKey, q);
        const rows = await sql(
          token,
          ref,
          `select document_id, document_title, validity, clause, article, page_start, similarity from public.match_normativa_chunks('[${vec.join(",")}]'::extensions.vector(1536), 10, 0.25)`,
        );
        paths.push(
          (rows as unknown as Array<{ similarity: number } & Record<string, unknown>>).map((r) => ({
            ...r,
            score: 300 * Number(r.similarity ?? 0),
          })) as unknown as Hit[],
        );
      } catch {
        // path opcional (sin key o sin embeddings aún)
      }
    }

    const ms = Date.now() - t0;
    latencies.push(ms);
    const top = fuse(paths)[0];
    if (!top) {
      empty++;
      console.log(`  · "${q}" → SIN RESULTADOS (${ms}ms)`);
      continue;
    }
    ok++;
    const badge =
      top.validity === "PENDING_REVIEW"
        ? " ⚠PENDING_REVIEW"
        : top.validity === "HISTORICAL"
          ? " 🔵HISTORICAL"
          : "";
    const num = top.clause ? `cl.${top.clause}` : top.article ? `art.${top.article}` : "";
    console.log(
      `  ✓ "${q}" → ${top.document_id}${num ? ` (${num})` : ""} pág=${top.page_start ?? "-"}${badge} [${ms}ms]`,
    );
  }

  const sorted = [...latencies].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? sorted.at(-1) ?? 0;
  console.log("");
  console.log("════════ RESUMEN ════════");
  console.log(`Consultas con resultado: ${ok}/${QUERIES.length} (vacías: ${empty})`);
  console.log(`Retrieval p50: ${p50}ms | p95: ${p95}ms`);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
