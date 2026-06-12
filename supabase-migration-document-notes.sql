create table if not exists public.antidote_document_notes (
  id uuid primary key default gen_random_uuid(),
  sync_hash text not null,
  document_key text not null
    check (document_key in ('dossier', 'diary', 'today')),
  section_key text not null default 'general',
  note_type text not null
    check (note_type in ('personal', 'expert')),
  content text not null,
  source_kind text not null default 'word',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sync_hash, document_key, section_key, note_type)
);

create index if not exists antidote_document_notes_owner_idx
  on public.antidote_document_notes (sync_hash, document_key, updated_at desc);

alter table public.antidote_document_notes enable row level security;

revoke all on table public.antidote_document_notes from anon, authenticated;
grant select, insert, update, delete on table public.antidote_document_notes to service_role;
