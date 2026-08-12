-- Migration: android_releases table for release history and admin console
-- Timestamp: 20260810120000

-- Table for tracking all Android builds and their promotion status across channels
create table if not exists public.android_releases (
    id              bigint generated always as identity primary key,
    version_code    integer not null,
    version_name    text not null,
    channel         text not null default 'dev' check (channel in ('dev','beta','stable')),
    commit_sha      text,
    apk_url         text,
    apk_sha256      text,
    apk_size        bigint,
    release_notes   text[],
    minimum_version_code integer,
    force_update    boolean not null default false,
    created_at      timestamptz not null default now(),
    published_at    timestamptz,
    published_by    uuid references public.profiles(id)
);

-- Index for fast lookup by channel + version
create index if not exists android_releases_channel_code_idx
    on public.android_releases (channel, version_code desc);

-- RLS: only admins can insert/update
alter table public.android_releases enable row level security;

-- Anyone can read (public data needed for admin panel and API)
create policy "Anyone can read android releases"
    on public.android_releases for select
    using (true);

-- Only admins can insert
create policy "Admins can insert releases"
    on public.android_releases for insert
    with check (
        exists (
            select 1 from public.profiles
            where id = auth.uid() and role = 'admin'
        )
    );

-- Only admins can update (promote to stable/beta)
create policy "Admins can update releases"
    on public.android_releases for update
    using (
        exists (
            select 1 from public.profiles
            where id = auth.uid() and role = 'admin'
        )
    );
