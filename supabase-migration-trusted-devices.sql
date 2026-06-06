create table if not exists public.antidote_trusted_devices (
  id uuid primary key default gen_random_uuid(),
  sync_hash text not null,
  token_hash text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create unique index if not exists antidote_trusted_devices_token_hash_idx
  on public.antidote_trusted_devices (token_hash);

create index if not exists antidote_trusted_devices_sync_expires_idx
  on public.antidote_trusted_devices (sync_hash, expires_at desc);

create index if not exists antidote_trusted_devices_sync_revoked_idx
  on public.antidote_trusted_devices (sync_hash, revoked_at, expires_at desc);

alter table public.antidote_trusted_devices enable row level security;

drop policy if exists antidote_trusted_devices_deny_all on public.antidote_trusted_devices;
create policy antidote_trusted_devices_deny_all
  on public.antidote_trusted_devices
  for all
  using (false)
  with check (false);

grant select, insert, update, delete on public.antidote_trusted_devices to service_role;
