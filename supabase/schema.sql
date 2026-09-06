-- ArchiveVault — run this once in the Supabase SQL editor.
-- Model: listening is PUBLIC (anyone with the link). Only authenticated
-- admin users can add / change / delete tracks and audio files.

-- 1. Tracks table -----------------------------------------------------------
create table if not exists public.tracks (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  subtitle         text,
  notes            text,
  storage_path     text not null,          -- object key inside the 'tracks' bucket
  duration_seconds integer,
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now()
);

alter table public.tracks enable row level security;

drop policy if exists "tracks: public read"        on public.tracks;
drop policy if exists "tracks: admin insert"       on public.tracks;
drop policy if exists "tracks: admin update"       on public.tracks;
drop policy if exists "tracks: admin delete"       on public.tracks;

create policy "tracks: public read"
  on public.tracks for select
  using (true);

create policy "tracks: admin insert"
  on public.tracks for insert to authenticated
  with check (true);

create policy "tracks: admin update"
  on public.tracks for update to authenticated
  using (true) with check (true);

create policy "tracks: admin delete"
  on public.tracks for delete to authenticated
  using (true);

-- 2. Storage bucket for audio --------------------------------------------------
insert into storage.buckets (id, name, public)
values ('tracks', 'tracks', true)
on conflict (id) do update set public = true;

drop policy if exists "audio: public read"   on storage.objects;
drop policy if exists "audio: admin write"   on storage.objects;
drop policy if exists "audio: admin update"  on storage.objects;
drop policy if exists "audio: admin delete"  on storage.objects;

create policy "audio: public read"
  on storage.objects for select
  using (bucket_id = 'tracks');

create policy "audio: admin write"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'tracks');

create policy "audio: admin update"
  on storage.objects for update to authenticated
  using (bucket_id = 'tracks') with check (bucket_id = 'tracks');

create policy "audio: admin delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'tracks');
