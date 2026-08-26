/**
 * Benchmark productivo del flujo real de /api/consulta con pgvector.
 *
 * Reproduce EXACTAMENTE el camino del route handler:
 *   OpenAI embedding → retrieveEvidenceWithMetrics (RPCs autenticadas vía
 *   PostgREST+RLS, idénticas a las que llama /api/consulta en Vercel)
 *   → fusión pura → prompt con [S#] → LLM streaming (TTFT real).
 *
 * Uso: node --import tsx scripts/bench-consulta.ts [vueltas=3]
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  buildContextWithSources,
  extractExactRefs,
  rowToSource,
  VALIDITY_WEIGHT,
  type RetrievedSource,
  type RpcChunkRow,
} from "../src/features/asistente/lib/retrieval-sources";

type Row = Record<string, unknown>;

function loadEnvFile(p: string): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    for (const line of fs.readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch { /* opcional */ }
  return out;
}

const root = process.cwd();
const envLocal = loadEnvFile(path.join(root, ".env.local"));
const botEnv = loadEnvFile(path.join(root, "bot-api/.env"));

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? envLocal.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? envLocal.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const E2E_EMAIL = process.env.E2E_USER_EMAIL ?? envLocal.E2E_USER_EMAIL ?? "";
const E2E_PASS = process.env.E2E_USER_PASSWORD ?? envLocal.E2E_USER_PASSWORD ?? "";
const OPENAI_KEY = process.env.OPENAI_API_KEY ?? botEnv.OPENAI_API_KEY ?? "";

const QUERIES = [
  // ── Las 10 obligatorias ──
  "¿Qué dice la cláusula 63 bis?",
  "¿Cuántos días de vacaciones me corresponden?",
  "¿Cómo funcionan las guardias?",
  "¿Cuándo procede el tiempo extraordinario?",
  "¿Cuáles son los Estatutos SNTSS 2026?",
  "¿Qué dice la NOM-229?",
  "Explícame la Ley Silla",
  "¿Ya son 40 horas de jornada?",
  "¿Cómo tramito mi jubilación?",
  "¿Qué pasa si me mandan actividades fuera de categoría?",
  // ── Temas representativos del corpus ──
  "¿Me pueden cambiar de turno sin avisar?",
  "¿Quién autoriza la modificación de horarios institucionales?",
  "¿Qué hago si no me pagaron el fondo de ahorro?",
  "¿Cómo pido reconocimiento de antigüedad?",
  "¿Puedo reconsiderar una sanción laboral?",
  "¿Qué es la Bolsa de Trabajo del IMSS y cómo ingreso?",
  "¿Cómo se revisa una plantilla de personal?",
  "¿Qué es un profesiograma?",
  "¿Qué derechos tengo por riesgo de trabajo?",
  "¿Qué hago si tuve un accidente en el trabajo?",
  "¿Qué dice el CCT sobre infectocontagiosidad?",
  "¿Qué dice la NOM-035 sobre riesgo psicosocial?",
  "¿Qué equipo de protección personal deben darme?",
  "¿Tengo derecho a sentarme durante mi jornada?",
  "¿Qué dice la NOM-037 sobre teletrabajo?",
  "¿Qué dice la NOM-004 sobre el expediente clínico?",
  "¿Qué requisitos marca la NOM-019 para la práctica de enfermería?",
  "¿Cómo se manejan los residuos RPBI?",
  "¿Qué dice la ley sobre discriminación laboral?",
  "¿Qué hago ante acoso laboral?",
  "¿Cómo funciona mi crédito INFONAVIT?",
  "¿Qué comisión cobra mi AFORE?",
  "¿Qué es FONACOT y cómo funciona el descuento?",
  "¿Qué procedimiento aplica para el pago por cambio de residencia?",
  "¿Cómo se actualiza el catálogo de plazas?",
  "¿Cuánto gana una enfermera especialista nivel B?",
];

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.max(0, Math.ceil((p / 100) * sortedAsc.length) - 1));
  return Math.round(sortedAsc[idx]);
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_ANON || !E2E_EMAIL || !OPENAI_KEY) {
    throw new Error("Faltan credenciales (NEXT_PUBLIC_SUPABASE_*, E2E_*, OPENAI key)");
  }

  // Sesión REAL autenticada: mismos grants/RPCs que usa /api/consulta en Vercel.
  const admin = createClient(SUPABASE_URL, SUPABASE_ANON);
  const { data: authData, error: authErr } = await admin.auth.signInWithPassword({
    email: E2E_EMAIL,
    password: E2E_PASS,
  });
  if (authErr || !authData.session) throw new Error(`Auth falló: ${authErr?.message}`);
  await admin.auth.setSession(authData.session);

  const rounds = Number(process.argv[2] ?? "3");

  interface Sample {
    q: string;
    exactMs: number | null;
    ftsMs: number;
    vectorMs: number | null;
    fusionMs: number;
    retrievalMs: number;
    embedMs: number;
    llmTtftMs: number | null;
    llmTotalMs: number | null;
    totalMs: number;
    topDoc: string;
    topValidity: string;
    nSources: number;
  }
  const samples: Sample[] = [];

  async function embed(text: string): Promise<number[]> {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "text-embedding-3-small", input: text }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`embed ${res.status}`);
    const j = (await res.json()) as { data: Array<{ embedding: number[] }> };
    return j.data[0].embedding;
  }

  async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T[]> {
    const { data, error } = await admin.rpc(fn, args as never);
    if (error) throw new Error(`RPC ${fn}: ${error.message}`);
    return (data ?? []) as T[];
  }

  console.log(`Benchmark /api/consulta — ${QUERIES.length} consultas × ${rounds} vueltas\n`);

  for (let round = 1; round <= rounds; round++) {
    console.log(`── Vuelta ${round}/${rounds} ──`);
    for (const q of QUERIES) {
      const s: Partial<Sample> = { q };
      const t0 = performance.now();

      const tEmbed = performance.now();
      const vec = await embed(q);
      s.embedMs = performance.now() - tEmbed;

      const refs = extractExactRefs(q);
      type Cand = { row: RpcChunkRow; score: number };
      const paths: Array<Promise<Cand[]>> = [];

      if (refs.clause || refs.article || refs.key) {
        const tx = performance.now();
        paths.push(
          rpc("find_exact_normativa", {
            p_clause: refs.clause ?? null,
            p_article: refs.article ?? null,
            p_key: refs.key ?? null,
            p_match_count: 6,
          }).then((rows) => {
            s.exactMs = performance.now() - tx;
            return rows.map((row) => ({ row: row as RpcChunkRow, score: 1000 }));
          }),
        );
      }

      const tf = performance.now();
      paths.push(
        rpc("search_normativa_fts", { p_query: q, p_match_count: 10 }).then((rows) => {
          s.ftsMs = performance.now() - tf;
          return (rows as Array<RpcChunkRow & { rank: number }>).map((row) => ({
            row,
            score: 200 + (row.rank ?? 0),
          }));
        }),
      );

      const tv = performance.now();
      paths.push(
        rpc("match_normativa_chunks", {
          p_query_embedding: vec,
          p_match_count: 10,
          p_min_similarity: 0.25,
        }).then((rows) => {
          s.vectorMs = performance.now() - tv;
          return (rows as Array<RpcChunkRow & { similarity: number }>).map((row) => ({
            row,
            score: 300 * (row.similarity ?? 0),
          }));
        }),
      );

      const settled = await Promise.allSettled(paths);
      const tFus = performance.now();
      const byChunk = new Map<string, RetrievedSource>();
      for (const job of settled) {
        if (job.status !== "fulfilled") continue;
        for (const cand of job.value) {
          const ex = byChunk.get(cand.row.chunk_id);
          if (ex) {
            ex.score += cand.score * 0.5;
            continue;
          }
          byChunk.set(
            cand.row.chunk_id,
            rowToSource(cand.row, "", cand.score + (VALIDITY_WEIGHT[cand.row.validity] ?? -6)),
          );
        }
      }
      const sources = [...byChunk.values()].sort((a, b) => b.score - a.score).slice(0, 8);
      sources.forEach((x, i) => (x.id = `S${i + 1}`));
      s.fusionMs = performance.now() - tFus;
      // Las vías corren en paralelo: retrieval ≈ max(vías) + fusión.
      const pathMax = Math.max(s.exactMs ?? 0, s.ftsMs ?? 0, s.vectorMs ?? 0);
      s.retrievalMs = pathMax + s.fusionMs;
      s.nSources = sources.length;

      // Etapa LLM real (streaming) con el contexto recuperado.
      if (sources.length > 0) {
        const context = buildContextWithSources(sources);
        const sys = `Eres el Asistente SNTSS. Responde SOLO con el CONTEXTO citando [S#]. Contexto:\n${context}`;
        const tl = performance.now();
        try {
          const res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              temperature: 0,
              stream: true,
              messages: [
                { role: "system", content: sys },
                { role: "user", content: q },
              ],
            }),
            signal: AbortSignal.timeout(60_000),
          });
          if (!res.ok || !res.body) throw new Error(`llm ${res.status}`);
          let ttft: number | null = null;
          let text = "";
          const reader = res.body.getReader();
          const dec = new TextDecoder();
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            if (ttft === null) ttft = performance.now() - tl;
            text += dec.decode(value, { stream: true });
          }
          s.llmTtftMs = ttft;
          s.llmTotalMs = performance.now() - tl;
        } catch {
          s.llmTtftMs = null;
          s.llmTotalMs = null;
        }
      }

      s.totalMs = performance.now() - t0;
      s.topDoc = sources[0]?.documentId ?? "-";
      s.topValidity = sources[0]?.validity ?? "-";

      samples.push(s as Sample);
      process.stdout.write(
        `  ${round}.${String(samples.length).padStart(3)} ${q.slice(0, 38).padEnd(40)} ret=${Math.round((s.retrievalMs ?? 0))}ms vec=${s.vectorMs == null ? "-" : Math.round(s.vectorMs)}ms ttft=${s.llmTtftMs == null ? "-" : Math.round(s.llmTtftMs)}ms total=${Math.round(s.totalMs)}ms → ${s.topDoc}\n`,
      );
    }
  }

  const stage = (
    label: string,
    get: (s: Sample) => number | null,
  ) => {
    const vals = samples
      .map(get)
      .filter((v): v is number => v != null && Number.isFinite(v))
      .sort((a, b) => a - b);
    if (vals.length === 0) return `${label}: (sin datos)`;
    return (
      `${label.padEnd(16)} p50=${String(percentile(vals, 50)).padStart(5)}ms ` +
      `p75=${String(percentile(vals, 75)).padStart(5)}ms ` +
      `p90=${String(percentile(vals, 90)).padStart(5)}ms ` +
      `p95=${String(percentile(vals, 95)).padStart(5)}ms ` +
      `p99=${String(percentile(vals, 99)).padStart(5)}ms  (n=${vals.length})`
    );
  };

  console.log("\n════════ PERCENTILES POR ETAPA ════════");
  console.log(stage("exact_ms", (s) => s.exactMs));
  console.log(stage("fts_ms", (s) => s.ftsMs));
  console.log(stage("vector_ms", (s) => s.vectorMs));
  console.log(stage("fusion_ms", (s) => s.fusionMs));
  console.log(stage("retrieval_ms", (s) => s.retrievalMs));
  console.log(stage("embed_ms", (s) => s.embedMs));
  console.log(stage("llm_ttft_ms", (s) => s.llmTtftMs));
  console.log(stage("llm_total_ms", (s) => s.llmTotalMs));
  console.log(stage("total_ms", (s) => s.totalMs));

  console.log("\n════════ CONSULTAS ESPECIALES (última vuelta) ════════");
  const especiales = [
    "cláusula 63 bis",
    "vacaciones",
    "guardias",
    "tiempo extraordinario",
    "Estatutos SNTSS 2026",
    "NOM-229",
    "Ley Silla",
    "40 horas",
    "jubilación",
    "fuera de categoría",
  ];
  for (const frag of especiales) {
    const last = [...samples].reverse().find((s) => s.q.toLowerCase().includes(frag.toLowerCase()));
    if (!last) continue;
    console.log(
      `  "${last.q}" → ${last.topDoc} [${last.topValidity}] fuentes=${last.nSources} ret=${Math.round(last.retrievalMs)}ms ttft=${last.llmTtftMs === null ? "-" : Math.round(last.llmTtftMs)}ms total=${Math.round(last.totalMs)}ms`,
    );
  }

  fs.mkdirSync(path.join(root, "data", "normativa"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "data", "normativa", "bench-consulta-results.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), rounds, samples }, null, 2),
  );
  console.log("\nResultados crudos: data/normativa/bench-consulta-results.json");
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
