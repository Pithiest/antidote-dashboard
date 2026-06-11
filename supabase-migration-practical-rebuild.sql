alter table public.antidote_entries
  add column if not exists episode_impact text;

alter table public.antidote_episode_events
  add column if not exists episode_impact text,
  add column if not exists control_affected boolean not null default false;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'antidote_entries_episode_impact_check'
  ) then
    alter table public.antidote_entries
      add constraint antidote_entries_episode_impact_check
      check (episode_impact is null or episode_impact in ('none', 'control_ok', 'control_affected'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'antidote_episode_events_episode_impact_check'
  ) then
    alter table public.antidote_episode_events
      add constraint antidote_episode_events_episode_impact_check
      check (episode_impact is null or episode_impact in ('control_ok', 'control_affected'));
  end if;
end
$$;

update public.antidote_entries
set episode_impact = case
  when handlebar_unstable is true then 'control_affected'
  when coalesce(episode_minutes, 0) > 0 or coalesce(episode_peak_intensity, 0) > 0 then 'control_ok'
  else 'none'
end
where episode_impact is null;

update public.antidote_episode_events
set
  episode_impact = case
    when right_hand_affected is true or right_foot_affected is true then 'control_affected'
    else 'control_ok'
  end,
  control_affected = right_hand_affected is true or right_foot_affected is true
where episode_impact is null;

create index if not exists antidote_episode_events_recent_risk_idx
  on public.antidote_episode_events (sync_hash, started_at desc, control_affected);
