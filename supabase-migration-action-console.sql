alter table public.antidote_entries
  add column if not exists baseline_change text,
  add column if not exists protocol_response text,
  add column if not exists guidance_mode text,
  add column if not exists review_due boolean not null default false,
  add column if not exists baseline_symptoms_changed boolean not null default false;

create table if not exists public.antidote_episode_events (
  id uuid primary key default gen_random_uuid(),
  sync_hash text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  trigger_tags text[] not null default '{}',
  peak_intensity integer check (peak_intensity is null or peak_intensity between 0 and 10),
  right_foot_affected boolean not null default false,
  right_hand_affected boolean not null default false,
  protocol_response text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists antidote_episode_events_sync_started_idx on public.antidote_episode_events (sync_hash, started_at desc);
create index if not exists antidote_episode_events_open_idx on public.antidote_episode_events (sync_hash, started_at desc) where finished_at is null;
alter table public.antidote_episode_events enable row level security;
drop policy if exists antidote_episode_events_deny_all on public.antidote_episode_events;
create policy antidote_episode_events_deny_all on public.antidote_episode_events for all using (false) with check (false);
grant select, insert, update, delete on public.antidote_episode_events to service_role;

update public.antidote_entries set guidance_mode=case when day_class='C' then 'stabilize' else 'maintain' end,plan_stage=case when day_class='C' then '先稳住' else '保持节奏' end where guidance_mode is null or plan_stage like 'Day %';
update public.antidote_recommendations set plan_stage=case when day_class='C' then '先稳住' else '保持节奏' end where plan_stage like 'Day %';
