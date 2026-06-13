alter table public.antidote_episode_events
  add column if not exists intervention_method text,
  add column if not exists intervention_started_at timestamptz,
  add column if not exists thirty_second_effect text,
  add column if not exists baseline_intervals_seconds jsonb,
  add column if not exists intervention_jerk_count integer,
  add column if not exists intervention_duration_seconds integer;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'antidote_episode_events_intervention_method_check'
  ) then
    alter table public.antidote_episode_events
      add constraint antidote_episode_events_intervention_method_check
      check (
        intervention_method is null
        or intervention_method in ('rhythmic_tap', 'light_touch', 'motor_imagery', 'none')
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'antidote_episode_events_thirty_second_effect_check'
  ) then
    alter table public.antidote_episode_events
      add constraint antidote_episode_events_thirty_second_effect_check
      check (
        thirty_second_effect is null
        or thirty_second_effect in ('half_or_more', 'less_than_half', 'none_or_worse', 'not_tested')
      );
  end if;
end
$$;

create index if not exists antidote_episode_events_intervention_idx
  on public.antidote_episode_events (
    sync_hash,
    intervention_method,
    thirty_second_effect,
    started_at desc
  );
