alter table public.antidote_entries
  add column if not exists source_kind text,
  add column if not exists source_ref text,
  add column if not exists observed_at timestamptz;

alter table public.antidote_episode_events
  add column if not exists source_kind text,
  add column if not exists source_ref text;

alter table public.antidote_knowledge_cards
  add column if not exists doi text,
  add column if not exists pmid text,
  add column if not exists publication_type text,
  add column if not exists evidence_level text,
  add column if not exists relevance_score integer,
  add column if not exists full_text_status text,
  add column if not exists verified_at timestamptz,
  add column if not exists quality_status text not null default 'candidate',
  add column if not exists exclusion_reason text,
  add column if not exists is_active boolean not null default true;

create index if not exists antidote_entries_source_idx
  on public.antidote_entries (sync_hash, source_kind, entry_date desc);

create index if not exists antidote_knowledge_cards_quality_idx
  on public.antidote_knowledge_cards (sync_hash, is_active, quality_status, updated_at desc);

update public.antidote_entries
set
  source_kind = coalesce(source_kind, 'conversation_backfill'),
  source_ref = coalesce(source_ref, 'thread:dated-report:2026-06-02'),
  observed_at = coalesce(observed_at, '2026-06-02 12:00:00+08'),
  baseline_change = 'worse',
  morning_twitch = 'worse',
  walking_discomfort = null,
  right_foot_control = null,
  forty_step_stumbles = null,
  inner_thigh_acid = null,
  episode_minutes = null,
  episode_peak_intensity = null,
  trigger_tags = array['惊吓', '骑行'],
  e_bike = true,
  urgent_wake = false,
  handlebar_unstable = false,
  activity_context = '骑电动车时被突然冲出的车辆吓到后诱发右侧抽动，持续数十分钟，精确时长未知。',
  notes = '当天比前一天更重；晨起抽动持续较久且幅度较大；惊吓后更容易频繁诱发。未报告精确 0-10 分值。',
  updated_at = now()
where entry_date = '2026-06-02';

update public.antidote_entries
set
  source_kind = coalesce(source_kind, 'conversation_backfill'),
  source_ref = coalesce(source_ref, 'thread:dated-report:2026-06-03'),
  observed_at = coalesce(observed_at, '2026-06-03 13:00:00+08'),
  morning_twitch = 'lighter',
  walking_discomfort = null,
  right_foot_control = null,
  forty_step_stumbles = null,
  inner_thigh_acid = null,
  episode_minutes = 5.5,
  episode_peak_intensity = null,
  trigger_tags = array['紧急叫起', '骑行', '静止到活动'],
  e_bike = true,
  urgent_wake = true,
  handlebar_unstable = true,
  medication_taken = true,
  activity_context = '午睡中被紧急叫起出警，约 5 分钟后骑电动车途中诱发。',
  notes = '晨起只微微抽一下；骑行中持续抽动约 5-6 分钟，车把有点抓不稳。未报告精确 0-10 分值。',
  updated_at = now()
where entry_date = '2026-06-03';

update public.antidote_entries
set
  source_kind = coalesce(source_kind, 'website'),
  source_ref = coalesce(source_ref, 'website:daily-checkin'),
  observed_at = coalesce(observed_at, created_at)
where entry_date >= '2026-06-04';

update public.antidote_knowledge_cards
set
  quality_status = 'excluded',
  is_active = false,
  exclusion_reason = '聚合补充材料、会议摘要集或标题不足以支持临床相关性判断',
  verified_at = now()
where
  lower(title) ~ '(supplement|proceedings|platform and poster|abstracts? of the)'
  or lower(evidence_type) like '%conference%';

with ranked as (
  select
    id,
    row_number() over (
      partition by sync_hash, source_url
      order by
        case when evidence_type = 'AnySearch biomedical result' then 1 else 0 end,
        updated_at desc,
        created_at desc
    ) as source_rank
  from public.antidote_knowledge_cards
  where source_url is not null and source_url <> ''
)
update public.antidote_knowledge_cards as card
set
  quality_status = 'duplicate',
  is_active = false,
  exclusion_reason = '同一来源已保留信息更完整的知识卡',
  verified_at = now()
from ranked
where card.id = ranked.id and ranked.source_rank > 1;

update public.antidote_knowledge_cards
set quality_status = 'reviewed', is_active = true, verified_at = coalesce(verified_at, now())
where
  quality_status = 'candidate'
  and evidence_type in (
    'Consensus recommendation',
    'Systematic review',
    'Clinical review',
    'Expert review',
    'Multidisciplinary recommendations',
    'Review',
    'Narrative review',
    'Comprehensive review',
    'Case series with EMG and kinematics',
    'Case series',
    'Clinical study',
    'Case report'
  );

insert into public.antidote_historical_events (
  sync_hash,
  event_date,
  event_label,
  event_type,
  details,
  importance,
  source
)
select
  profile.sync_hash,
  '2026-05-31',
  '跑步 3 公里时前段困难、热身后缓解',
  'exercise_observation',
  '前 1 公里出现既往的难受、别扭和难以正常跑下去；继续活动后逐渐缓解，后半程明显好转。',
  8,
  'local_record_backfill'
from public.antidote_profiles as profile
where not exists (
  select 1
  from public.antidote_historical_events as event
  where event.sync_hash = profile.sync_hash
    and event.event_label = '跑步 3 公里时前段困难、热身后缓解'
);

insert into public.antidote_historical_events (
  sync_hash,
  event_date,
  event_label,
  event_type,
  details,
  importance,
  source
)
select
  profile.sync_hash,
  '2026-06-01',
  '晨起抽动较前一天减轻',
  'daily_observation',
  '起床后抽动幅度较前一天小；同时记录右大腿靠近膝内侧区域酸感。',
  6,
  'local_record_backfill'
from public.antidote_profiles as profile
where not exists (
  select 1
  from public.antidote_historical_events as event
  where event.sync_hash = profile.sync_hash
    and event.event_label = '晨起抽动较前一天减轻'
);
