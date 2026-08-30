-- ═══════════════════════════════════════════════════════════════════
-- pgvector para la Biblioteca Normativa (RAG productivo del chatbot)
--
-- Reglas de diseño:
-- - data/normativa (biblioteca local) sigue siendo el SOURCE OF TRUTH.
--   Supabase es un índice de recuperación reconstruible desde ella.
-- - Sincronización idempotente por chunk_id + content_hash.
--   Nunca DELETE masivo ni truncate: el upsert encapsulado decide
--   insertar/actualizar/conservar según hash y modelo de embedding.
-- - Escritura SOLO vía SECURITY DEFINER (sin grants DML a anon/authenticated).
-- - Los chunks HISTORICAL nunca se recuperan como vigentes por defecto.
-- ═══════════════════════════════════════════════════════════════════

create extension if not exists vector with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create table if not exists public.normativa_chunks (
  id uuid primary key default gen_random_uuid(),
  chunk_id text unique not null,
  document_id text not null,
  document_title text not null,
  document_type text,
  category text,
  version_id text not null,
  corpus_version text not null,
  validity text not null default 'PENDING_REVIEW',
  effective_from date,
  effective_until date,
  last_reform_date date,
  section_type text,
  section_title text,
  article text,
  clause text,
  fraction text,
  numeral text,
  page_start integer,
  page_end integer,
  text text not null,
  content_hash text not null,
  source_url text,
  provenance text,
  priority text default 'medium',
  applies_to jsonb not null default '[]'::jsonb,
  topics jsonb not null default '[]'::jsonb,
  embedding_model text,
  embedding_dimensions integer,
  embedding extensions.vector(1536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.normativa_chunks is
  'Índice RAG de la Biblioteca Normativa. Fuente maestra: data/normativa (local). Reconstruible completo desde ahí.';

create index if not exists normativa_chunks_embedding_idx
  on public.normativa_chunks using hnsw (embedding extensions.vector_cosine_ops);

create index if not exists normativa_chunks_document_id_idx
  on public.normativa_chunks (document_id);

create index if not exists normativa_chunks_validity_idx
  on public.normativa_chunks (validity);

create index if not exists normativa_chunks_fts_idx
  on public.normativa_chunks using gin (to_tsvector('spanish', text));

create index if not exists normativa_chunks_text_trgm_idx
  on public.normativa_chunks using gin (text gin_trgm_ops);

create index if not exists normativa_chunks_chunk_id_trgm_idx
  on public.normativa_chunks using gin (chunk_id gin_trgm_ops);

-- Lookups exactos (NO únicos: una cláusula/artículo abarca muchos chunks)
create index if not exists normativa_chunks_clause_lookup_idx
  on public.normativa_chunks (lower(clause))
  where clause is not null;

create index if not exists normativa_chunks_article_lookup_idx
  on public.normativa_chunks (lower(article))
  where article is not null;

create index if not exists normativa_chunks_numeral_lookup_idx
  on public.normativa_chunks (lower(numeral))
  where numeral is not null;

-- ═══════════════════════ UPSERT IDEMPOTENTE ═══════════════════════
-- items: [{ chunkId, documentId, ..., contentHash, embedding?: number[] }]
-- Un chunk se actualiza SOLO si cambió content_hash o embedding_model.

create or replace function public.normativa_chunks_upsert(
  p_items jsonb,
  p_corpus_version text,
  p_embedding_model text,
  p_embedding_dimensions int
)
returns table (inserted int, updated int, unchanged int)
language plpgsql
security definer
set search_path = extensions, public
as $$
declare
  v_item jsonb;
  v_existing record;
  v_ins int := 0;
  v_upd int := 0;
  v_unch int := 0;
  v_vec extensions.vector;
begin
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_existing from public.normativa_chunks c where c.chunk_id = v_item->>'chunkId';

    if v_item ? 'embedding' and jsonb_typeof(v_item->'embedding') = 'array' then
      v_vec := ((v_item->'embedding')::text)::extensions.vector(1536);
    else
      v_vec := null;
    end if;

    if v_existing is null then
      insert into public.normativa_chunks (
        chunk_id, document_id, document_title, document_type, category,
        version_id, corpus_version, validity, effective_from, effective_until,
        last_reform_date, section_type, section_title, article, clause,
        fraction, numeral, page_start, page_end, text, content_hash,
        source_url, provenance, priority, applies_to, topics,
        embedding_model, embedding_dimensions, embedding
      ) values (
        v_item->>'chunkId',
        coalesce(v_item->>'documentId', ''),
        coalesce(v_item->>'documentTitle', ''),
        v_item->>'documentType',
        v_item->>'category',
        coalesce(v_item->>'versionId', ''),
        p_corpus_version,
        coalesce(v_item->>'validity', 'PENDING_REVIEW'),
        nullif(v_item->>'effectiveFrom', '')::date,
        nullif(v_item->>'effectiveUntil', '')::date,
        nullif(v_item->>'lastReformDate', '')::date,
        v_item->>'sectionType',
        v_item->>'sectionTitle',
        v_item->>'article',
        v_item->>'clause',
        v_item->>'fraction',
        v_item->>'numeral',
        nullif(v_item->>'pageStart', '')::int,
        nullif(v_item->>'pageEnd', '')::int,
        coalesce(v_item->>'text', ''),
        coalesce(v_item->>'contentHash', ''),
        v_item->>'sourceUrl',
        v_item->>'provenance',
        coalesce(v_item->>'priority', 'medium'),
        coalesce(v_item->'appliesTo', '[]'::jsonb),
        coalesce(v_item->'topics', '[]'::jsonb),
        case when v_vec is null then null else p_embedding_model end,
        case when v_vec is null then null else p_embedding_dimensions end,
        v_vec
      );
      v_ins := v_ins + 1;
    elsif v_existing.content_hash <> coalesce(v_item->>'contentHash', '')
       or (v_vec is not null and (v_existing.embedding_model is distinct from p_embedding_model)) then
      update public.normativa_chunks set
        document_title   = coalesce(v_item->>'documentTitle', v_existing.document_title),
        document_type    = coalesce(v_item->>'documentType', v_existing.document_type),
        category         = coalesce(v_item->>'category', v_existing.category),
        version_id       = coalesce(v_item->>'versionId', v_existing.version_id),
        corpus_version   = p_corpus_version,
        validity         = coalesce(v_item->>'validity', v_existing.validity),
        effective_from   = coalesce(nullif(v_item->>'effectiveFrom', '')::date, v_existing.effective_from),
        effective_until  = coalesce(nullif(v_item->>'effectiveUntil', '')::date, v_existing.effective_until),
        last_reform_date = coalesce(nullif(v_item->>'lastReformDate', '')::date, v_existing.last_reform_date),
        section_type     = coalesce(v_item->>'sectionType', v_existing.section_type),
        section_title    = coalesce(v_item->>'sectionTitle', v_existing.section_title),
        article          = coalesce(v_item->>'article', v_existing.article),
        clause           = coalesce(v_item->>'clause', v_existing.clause),
        fraction         = coalesce(v_item->>'fraction', v_existing.fraction),
        numeral          = coalesce(v_item->>'numeral', v_existing.numeral),
        page_start       = coalesce(nullif(v_item->>'pageStart', '')::int, v_existing.page_start),
        page_end         = coalesce(nullif(v_item->>'pageEnd', '')::int, v_existing.page_end),
        text             = coalesce(v_item->>'text', v_existing.text),
        content_hash     = coalesce(v_item->>'contentHash', v_existing.content_hash),
        source_url       = coalesce(v_item->>'sourceUrl', v_existing.source_url),
        provenance       = coalesce(v_item->>'provenance', v_existing.provenance),
        priority         = coalesce(v_item->>'priority', v_existing.priority),
        applies_to       = coalesce(v_item->'appliesTo', v_existing.applies_to),
        topics           = coalesce(v_item->'topics', v_existing.topics),
        embedding_model  = case when v_vec is null then v_existing.embedding_model else p_embedding_model end,
        embedding_dimensions = case when v_vec is null then v_existing.embedding_dimensions else p_embedding_dimensions end,
        embedding        = coalesce(v_vec, v_existing.embedding),
        updated_at       = now()
      where chunk_id = v_item->>'chunkId';
      v_upd := v_upd + 1;
    else
      update public.normativa_chunks set corpus_version = p_corpus_version, updated_at = now()
      where chunk_id = v_item->>'chunkId';
      v_unch := v_unch + 1;
    end if;
  end loop;

  return query select v_ins, v_upd, v_unch;
end;
$$;

-- ═══════════════ BÚSQUEDA VECTORIAL (pgvector, no JS) ═══════════════

create or replace function public.match_normativa_chunks(
  p_query_embedding extensions.vector(1536),
  p_match_count int default 8,
  p_min_similarity float default 0.25,
  p_include_historical boolean default false
)
returns table (
  chunk_id text, document_id text, document_title text, document_type text,
  category text, version_id text, corpus_version text, validity text,
  effective_from date, effective_until date, last_reform_date date,
  section_type text, section_title text, article text, clause text,
  fraction text, numeral text, page_start int, page_end int,
  text text, source_url text, provenance text, priority text,
  applies_to jsonb, topics jsonb, similarity float
)
language sql stable security definer
set search_path = extensions, public
as $$
  select c.chunk_id, c.document_id, c.document_title, c.document_type,
         c.category, c.version_id, c.corpus_version, c.validity,
         c.effective_from, c.effective_until, c.last_reform_date,
         c.section_type, c.section_title, c.article, c.clause,
         c.fraction, c.numeral, c.page_start, c.page_end,
         c.text, c.source_url, c.provenance, c.priority,
         c.applies_to, c.topics,
         (1 - (c.embedding <=> p_query_embedding))::float as similarity
  from public.normativa_chunks c
  where c.embedding is not null
    and (p_include_historical or c.validity <> 'HISTORICAL')
    and (1 - (c.embedding <=> p_query_embedding)) >= p_min_similarity
  order by c.embedding <=> p_query_embedding
  limit least(greatest(p_match_count, 1), 30);
$$;

-- ═══════════════ BÚSQUEDA LÉXICA FTS (español) ═══════════════

create or replace function public.search_normativa_fts(
  p_query text,
  p_match_count int default 8,
  p_include_historical boolean default false
)
returns table (
  chunk_id text, document_id text, document_title text, document_type text,
  category text, version_id text, corpus_version text, validity text,
  effective_from date, effective_until date, last_reform_date date,
  section_type text, section_title text, article text, clause text,
  fraction text, numeral text, page_start int, page_end int,
  text text, source_url text, provenance text, priority text,
  applies_to jsonb, topics jsonb, rank float
)
language sql stable security definer
set search_path = extensions, public
as $$
  select c.chunk_id, c.document_id, c.document_title, c.document_type,
         c.category, c.version_id, c.corpus_version, c.validity,
         c.effective_from, c.effective_until, c.last_reform_date,
         c.section_type, c.section_title, c.article, c.clause,
         c.fraction, c.numeral, c.page_start, c.page_end,
         c.text, c.source_url, c.provenance, c.priority,
         c.applies_to, c.topics,
         ts_rank_cd(to_tsvector('spanish', c.text), websearch_to_tsquery('spanish', p_query))::float as rank
  from public.normativa_chunks c
  where to_tsvector('spanish', c.text) @@ websearch_to_tsquery('spanish', p_query)
    and (p_include_historical or c.validity <> 'HISTORICAL')
  order by rank desc
  limit least(greatest(p_match_count, 1), 30);
$$;

-- ═══════════ COINCIDENCIA EXACTA (cláusula/artículo/homoclave) ═══════════
-- "cláusula 63 bis", "artículo 30", "1A74-003-031" → prioridad máxima.

create or replace function public.find_exact_normativa(
  p_clause text default null,
  p_article text default null,
  p_key text default null,
  p_document_id text default null,
  p_match_count int default 6,
  p_include_historical boolean default false
)
returns setof public.normativa_chunks
language sql stable security definer
set search_path = extensions, public
as $$
  -- Cada brazo es independiente y usa SU índice; el OR entre ILIKEs
  -- obligaba al planificador a un Seq Scan (~350ms sobre 22k filas).
  -- Los duplicados se eliminan en la fusión de la aplicación (por chunk_id).
  select * from (
    (select c.* from public.normativa_chunks c
      where (p_include_historical or c.validity <> 'HISTORICAL')
        and p_clause is not null and lower(trim(c.clause)) = lower(trim(p_clause))
        and (p_document_id is null or c.document_id = p_document_id)
      limit 12)
    union all
    (select c.* from public.normativa_chunks c
      where (p_include_historical or c.validity <> 'HISTORICAL')
        and p_article is not null and lower(trim(c.article)) = lower(trim(p_article))
        and (p_document_id is null or c.document_id = p_document_id)
      limit 12)
    union all
    (select c.* from public.normativa_chunks c
      where (p_include_historical or c.validity <> 'HISTORICAL')
        and p_key is not null and c.document_id ilike p_key || '%'
        and (p_document_id is null or c.document_id = p_document_id)
      limit 12)
    union all
    (select c.* from public.normativa_chunks c
      where (p_include_historical or c.validity <> 'HISTORICAL')
        and p_key is not null and c.chunk_id ilike '%' || p_key || '%'
        and (p_document_id is null or c.document_id = p_document_id)
      limit 12)
    union all
    (select c.* from public.normativa_chunks c
      where (p_include_historical or c.validity <> 'HISTORICAL')
        and p_key is not null and c.text ilike '%' || p_key || '%'
        and (p_document_id is null or c.document_id = p_document_id)
      limit 6)
  ) u
  order by
    case when u.validity = 'CURRENT' then 0 when u.validity = 'PENDING_REVIEW' then 1 else 2 end,
    case
      when p_key is not null and u.document_id ilike p_key || '%' then 0
      when p_key is not null and u.chunk_id ilike '%' || p_key || '%' then 1
      else 2
    end,
    case when u.priority = 'critical' then 0 when u.priority = 'high' then 1 else 2 end,
    u.page_start nulls last
  limit least(greatest(p_match_count, 1), 20);
$$;

-- ═══════════════════════ RLS Y PERMISOS ═══════════════════════

alter table public.normativa_chunks enable row level security;

drop policy if exists "authenticated read normativa" on public.normativa_chunks;
create policy "authenticated read normativa"
  on public.normativa_chunks for select
  to authenticated
  using (true);

revoke insert, update, delete, truncate on public.normativa_chunks from anon, authenticated;

grant execute on function public.match_normativa_chunks(extensions.vector(1536), int, float, boolean) to authenticated;
grant execute on function public.search_normativa_fts(text, int, boolean) to authenticated;
grant execute on function public.find_exact_normativa(text, text, text, text, int, boolean) to authenticated;

-- El upsert solo lo invoca el proceso de sincronización (service path);
-- sin grant público: se ejecuta vía conexión administrativa.

-- ═══════════ BÚSQUEDA HÍBRIDA UNIFICADA (punto 5) ═══════════
-- Combina exact + FTS + vector en UNA sola RPC para el camino semántico.
-- Cada brazo acota ANTES de unir (evita el timeout del union-all sin límite).
-- Los duplicados se eliminan en la fusión de la aplicación (por chunk_id).

create or replace function public.hybrid_normativa_search(
  p_query text,
  p_query_embedding extensions.vector(1536) default null,
  p_clause text default null,
  p_article text default null,
  p_key text default null,
  p_match_count int default 12,
  p_min_similarity float default 0.25,
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
  with bounds as (select least(greatest(p_match_count, 1), 40) as n),
  exact_hits as (
    select c.*, 1000::float as base, 'exact'::text as origin
    from public.normativa_chunks c
    where (p_include_historical or c.validity <> 'HISTORICAL')
      and (
        (p_clause is not null and lower(trim(c.clause)) = lower(trim(p_clause)))
        or (p_article is not null and lower(trim(c.article)) = lower(trim(p_article)))
        or (p_key is not null and (c.document_id ilike p_key || '%' or c.chunk_id ilike '%' || p_key || '%'))
      )
    limit (select n from bounds)
  ),
  fts_hits as (
    select c.*, (30 + 150 * ts_rank_cd(to_tsvector('spanish', c.text), websearch_to_tsquery('spanish', p_query)))::float as base, 'fts'::text as origin
    from public.normativa_chunks c
    where (p_include_historical or c.validity <> 'HISTORICAL')
      and to_tsvector('spanish', c.text) @@ websearch_to_tsquery('spanish', p_query)
    order by ts_rank_cd(to_tsvector('spanish', c.text), websearch_to_tsquery('spanish', p_query)) desc
    limit (select n from bounds)
  ),
  vector_hits as (
    select c.*, (300 * (1 - (c.embedding <=> p_query_embedding)))::float as base, 'vector'::text as origin
    from public.normativa_chunks c
    where (p_include_historical or c.validity <> 'HISTORICAL')
      and p_query_embedding is not null and c.embedding is not null
      and (1 - (c.embedding <=> p_query_embedding)) >= p_min_similarity
    order by c.embedding <=> p_query_embedding
    limit (select n from bounds)
  ),
  merged as (
    select * from exact_hits
    union all
    select * from fts_hits
    union all
    select * from vector_hits
  ),
  chosen as (
    select distinct on (chunk_id) chunk_id, document_id, document_title, document_type,
           category, version_id, corpus_version, validity, effective_from,
           effective_until, last_reform_date, section_type, section_title,
           article, clause, fraction, numeral, page_start, page_end, text,
           source_url, provenance, priority, applies_to, topics, base, origin
    from merged
    order by chunk_id, base desc
  )
  select chunk_id, document_id, document_title, document_type, category,
         version_id, corpus_version, validity, effective_from, effective_until,
         last_reform_date, section_type, section_title, article, clause,
         fraction, numeral, page_start, page_end, text, source_url, provenance,
         priority, applies_to, topics,
         base::float as score, origin
  from chosen
  order by base desc
  limit (select n from bounds);
$$;
