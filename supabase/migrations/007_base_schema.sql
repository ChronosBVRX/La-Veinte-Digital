-- 007_base_schema.sql
-- Tablas base de chat, foro, catálogo e historial de IA que faltaban en las
-- migraciones (solo existían creadas a mano en producción). Idempotente y
-- reproducible desde una base vacía: `supabase start && supabase db reset`.

-- ============================================================
-- 1. Chat rooms
-- ============================================================
create table if not exists public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  is_private boolean default false,
  created_by uuid references public.profiles (id) on delete cascade,
  created_at timestamptz default now()
);

-- Corrección de la vista limited_profiles creada en 006: se creó con
-- security_invoker=on, lo que la inutilizaba (RLS de profiles solo deja
-- leer el perfil propio). Aquí se ejecuta como dueño (postgres).
alter view public.limited_profiles reset (security_invoker);

alter table public.chat_rooms enable row level security;

drop policy if exists "Chat rooms are publicly readable" on public.chat_rooms;
create policy "Chat rooms are publicly readable"
  on public.chat_rooms for select
  using (true);

drop policy if exists "Authenticated users can create rooms" on public.chat_rooms;
create policy "Authenticated users can create rooms"
  on public.chat_rooms for insert
  with check (auth.uid() = created_by);

-- ============================================================
-- 2. Chat participants
-- ============================================================
create table if not exists public.chat_participants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz default now()
);

alter table public.chat_participants enable row level security;

-- ============================================================
-- 3. Chat messages
-- ============================================================
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz default now()
);

alter table public.chat_messages enable row level security;

-- ============================================================
-- 4. Forum categories
-- ============================================================
create table if not exists public.forum_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  description text,
  sort_order integer default 0,
  created_at timestamptz default now()
);

alter table public.forum_categories enable row level security;

drop policy if exists "Forum categories are publicly readable" on public.forum_categories;
create policy "Forum categories are publicly readable"
  on public.forum_categories for select
  using (true);

-- ============================================================
-- 5. Forum posts
-- ============================================================
create table if not exists public.forum_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 200),
  content text not null check (char_length(content) between 1 and 10000),
  category_id uuid references public.forum_categories (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  is_pinned boolean default false,
  is_locked boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.forum_posts enable row level security;

drop policy if exists "Forum posts are publicly readable" on public.forum_posts;
create policy "Forum posts are publicly readable"
  on public.forum_posts for select
  using (true);

drop policy if exists "Authenticated users can create posts" on public.forum_posts;
create policy "Authenticated users can create posts"
  on public.forum_posts for insert
  with check (auth.uid() = author_id);

drop policy if exists "Authors can update own posts" on public.forum_posts;
create policy "Authors can update own posts"
  on public.forum_posts for update
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

drop policy if exists "Authors can delete own posts" on public.forum_posts;
create policy "Authors can delete own posts"
  on public.forum_posts for delete
  using (auth.uid() = author_id);

-- ============================================================
-- 6. Forum comments
-- ============================================================
create table if not exists public.forum_comments (
  id uuid primary key default gen_random_uuid(),
  content text not null check (char_length(content) between 1 and 10000),
  post_id uuid not null references public.forum_posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  parent_id uuid references public.forum_comments (id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.forum_comments enable row level security;

drop policy if exists "Forum comments are publicly readable" on public.forum_comments;
create policy "Forum comments are publicly readable"
  on public.forum_comments for select
  using (true);

drop policy if exists "Authenticated users can create comments" on public.forum_comments;
create policy "Authenticated users can create comments"
  on public.forum_comments for insert
  with check (auth.uid() = author_id);

drop policy if exists "Authors can update own comments" on public.forum_comments;
create policy "Authors can update own comments"
  on public.forum_comments for update
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

drop policy if exists "Authors can delete own comments" on public.forum_comments;
create policy "Authors can delete own comments"
  on public.forum_comments for delete
  using (auth.uid() = author_id);

-- ============================================================
-- 7. AI chat history (asistente)
-- ============================================================
create table if not exists public.ai_chat_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz default now()
);

alter table public.ai_chat_history enable row level security;

drop policy if exists "Users can read own AI chat history" on public.ai_chat_history;
create policy "Users can read own AI chat history"
  on public.ai_chat_history for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own AI chat messages" on public.ai_chat_history;
create policy "Users can insert own AI chat messages"
  on public.ai_chat_history for insert
  with check (auth.uid() = user_id);

-- ============================================================
-- 8. Catálogo de adscripciones (público de solo lectura)
-- ============================================================
create table if not exists public.catalogo_adscripciones (
  id integer primary key generated always as identity,
  nombre text not null,
  created_at timestamptz default now()
);

alter table public.catalogo_adscripciones enable row level security;

drop policy if exists "Allow public read" on public.catalogo_adscripciones;
create policy "Allow public read"
  on public.catalogo_adscripciones for select
  using (true);

-- ============================================================
-- 9. Realtime para chat_messages (idempotente)
-- ============================================================
do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end $$;
