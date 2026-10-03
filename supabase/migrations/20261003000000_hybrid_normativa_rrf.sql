-- ═══════════════════════════════════════════════════════════════════
-- Fusión de Rangos Recíprocos (RRF) para Búsqueda Híbrida Normativa
--
-- Sustituye la suma lineal aditiva heterogénea por ordenación ordinal
-- equilibrada entre:
-- 1. Búsqueda exacta indexada (cláusula / artículo / homoclave)
-- 2. Búsqueda léxica FTS en español (ts_rank_cd)
-- 3. Búsqueda vectorial densa HNSW (pgvector distancia coseno)
--
-- Ventajas:
-- - No distorsiona escalas entre FTS y cosenos.
-- - Evita que documentos caigan por debajo del corte por falta de coincidencia exacta.
-- - Mantiene compatibilidad total con el esquema de columnas de hybrid_normativa_search.
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.hybrid_normativa_rrf(
  p_query text,
  p_query_embedding extensions.vector(1536) default null,
  p_clause text default null,
  p_article text default null,
  p_key text default null,
  p_match_count int default 20,
  p_fts_weight float default 1.0,
  p_vector_weight float default 1.0,
  p_exact_weight float default 2.0,
  p_rrf_k int default 60,
  p_min_similarity float default 0.20,
  p_include_historical boolean default false
)
returns table (
  chunk_id text, document_id text, document_title text, document_type text,
  category text, version_id text, corpus_version text, validity text,
  effective_from date, effective_until date, last_reform_date date,
  section_type text, section_title text, article text, clause text,
  fraction text, numeral text, page_start int, page_end int,
  text text, source_url text, provenance text, priority text,
  applies_to jsonb, topics jsonb,
  score float, origin text
)
language sql stable security definer
set search_path = extensions, public
as $$
  with bounds as (
    select least(greatest(p_match_count, 1), 40) as n
  ),
  exact_hits as (
    select
      c.chunk_id,
      row_number() over (
        order by
          case when c.validity = 'CURRENT' then 0 when c.validity = 'PENDING_REVIEW' then 1 else 2 end,
          case when c.priority = 'critical' then 0 when c.priority = 'high' then 1 else 2 end,
          c.page_start nulls last
      ) as rank_pos
    from public.normativa_chunks c
    where (p_include_historical or c.validity <> 'HISTORICAL')
      and (
        (p_clause is not null and lower(trim(c.clause)) = lower(trim(p_clause)))
        or (p_article is not null and lower(trim(c.article)) = lower(trim(p_article)))
        or (p_key is not null and (c.document_id ilike p_key || '%' or c.chunk_id ilike '%' || p_key || '%'))
      )
    limit (select n from bounds) * 2
  ),
  fts_hits as (
    select
      c.chunk_id,
      row_number() over (
        order by ts_rank_cd(to_tsvector('spanish', c.text), websearch_to_tsquery('spanish', p_query)) desc
      ) as rank_pos
    from public.normativa_chunks c
    where (p_include_historical or c.validity <> 'HISTORICAL')
      and to_tsvector('spanish', c.text) @@ websearch_to_tsquery('spanish', p_query)
    limit (select n from bounds) * 2
  ),
  vector_hits as (
    select
      c.chunk_id,
      row_number() over (
        order by c.embedding <=> p_query_embedding asc
      ) as rank_pos
    from public.normativa_chunks c
    where (p_include_historical or c.validity <> 'HISTORICAL')
      and p_query_embedding is not null and c.embedding is not null
      and (1 - (c.embedding <=> p_query_embedding)) >= p_min_similarity
    limit (select n from bounds) * 2
  ),
  fused_candidates as (
    select chunk_id from exact_hits
    union
    select chunk_id from fts_hits
    union
    select chunk_id from vector_hits
  ),
  scored as (
    select
      c.chunk_id, c.document_id, c.document_title, c.document_type,
      c.category, c.version_id, c.corpus_version, c.validity,
      c.effective_from, c.effective_until, c.last_reform_date,
      c.section_type, c.section_title, c.article, c.clause,
      c.fraction, c.numeral, c.page_start, c.page_end,
      c.text, c.source_url, c.provenance, c.priority,
      c.applies_to, c.topics,
      (
        coalesce(p_exact_weight / (p_rrf_k + e.rank_pos), 0.0) +
        coalesce(p_fts_weight / (p_rrf_k + f.rank_pos), 0.0) +
        coalesce(p_vector_weight / (p_rrf_k + v.rank_pos), 0.0)
      )::float as rrf_score,
      concat_ws('+',
        case when e.chunk_id is not null then 'exact' end,
        case when f.chunk_id is not null then 'fts' end,
        case when v.chunk_id is not null then 'vector' end
      ) as origin
    from fused_candidates fc
    join public.normativa_chunks c on c.chunk_id = fc.chunk_id
    left join exact_hits e on e.chunk_id = fc.chunk_id
    left join fts_hits f on f.chunk_id = fc.chunk_id
    left join vector_hits v on v.chunk_id = fc.chunk_id
  )
  select
    chunk_id, document_id, document_title, document_type,
    category, version_id, corpus_version, validity,
    effective_from, effective_until, last_reform_date,
    section_type, section_title, article, clause,
    fraction, numeral, page_start, page_end,
    text, source_url, provenance, priority,
    applies_to, topics,
    -- Escalar score a un rango familiar de referencia (0..100) para compatibilidad
    (rrf_score * 1000.0)::float as score,
    origin
  from scored
  order by rrf_score desc
  limit (select n from bounds);
$$;

grant execute on function public.hybrid_normativa_rrf(
  text, extensions.vector(1536), text, text, text, int, float, float, float, int, float, boolean
) to authenticated;
