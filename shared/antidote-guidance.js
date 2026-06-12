const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

function asNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function asBoolean(value) {
  return value === true;
}

function timestamp(value, fallbackDate) {
  const parsed = Date.parse(String(value || ""));
  if (Number.isFinite(parsed)) return parsed;
  if (!fallbackDate) return null;
  const fallback = Date.parse(`${String(fallbackDate).slice(0, 10)}T12:00:00+08:00`);
  return Number.isFinite(fallback) ? fallback : null;
}

function withinHours(value, hours, now, fallbackDate) {
  const time = timestamp(value, fallbackDate);
  if (time === null) return false;
  const age = now.getTime() - time;
  return age >= 0 && age <= hours * HOUR_MS;
}

function episodeImpact(entry) {
  const explicit = String(entry.episode_impact || "");
  if (["none", "control_ok", "control_affected"].includes(explicit)) return explicit;
  if (asBoolean(entry.handlebar_unstable)) return "control_affected";
  return Number(entry.episode_minutes || 0) > 0 || Number(entry.episode_peak_intensity || 0) > 0
    ? "control_ok"
    : "none";
}

function entryBurden(entry) {
  const baseline = { lighter: 0, same: 1, worse: 2 }[String(entry.baseline_change || "")];
  if (baseline !== undefined) {
    const impact = { none: 0, control_ok: 1, control_affected: 3 }[episodeImpact(entry)] ?? 0;
    return baseline + impact;
  }
  const walking = asNumber(entry.walking_discomfort);
  const foot = asNumber(entry.right_foot_control);
  if (walking === null || foot === null) return null;
  return (walking + foot + (asNumber(entry.episode_peak_intensity) ?? 0)) / 3;
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function consecutiveSeven(entries) {
  if (entries.length < 7) return false;
  const dates = entries.slice(0, 7).map((entry) => String(entry.entry_date || "").slice(0, 10));
  return dates.every((date, index) => {
    if (index === dates.length - 1) return true;
    const newer = Date.parse(`${date}T00:00:00Z`);
    const older = Date.parse(`${dates[index + 1]}T00:00:00Z`);
    return Math.round((newer - older) / DAY_MS) === 1;
  });
}

export function computeTrend(entries, episodeEvents = [], now = new Date()) {
  const valid = entries.filter((entry) => entryBurden(entry) !== null);
  if (valid.length < 7) {
    return {
      status: "baseline",
      sample_count: valid.length,
      required_count: 7,
      improvement_percent: null,
      review_due: false,
      message: "近期记录仍在建立个人基线，不影响今天的即时安全判断。",
    };
  }

  const latestSeven = valid.slice(0, 7);
  const recent = average(latestSeven.slice(0, 3).map(entryBurden));
  const previous = average(latestSeven.slice(3, 7).map(entryBurden));
  const improvement = previous > 0 ? ((previous - recent) / previous) * 100 : 0;
  const rounded = Math.round(improvement);
  const safetyEvent =
    latestSeven.some((entry) => episodeImpact(entry) === "control_affected") ||
    episodeEvents.some(
      (event) =>
        withinHours(event.started_at, 7 * 24, now) &&
        (asBoolean(event.control_affected) ||
          asBoolean(event.right_hand_affected) ||
          asBoolean(event.right_foot_affected)),
    );
  const reviewDue = rounded >= 25 && consecutiveSeven(latestSeven) && !safetyEvent;
  const status = rounded >= 25 ? "improving" : rounded <= -25 ? "worsening" : "steady";

  return {
    status,
    sample_count: valid.length,
    required_count: 7,
    improvement_percent: rounded,
    review_due: reviewDue,
    message: reviewDue
      ? "近期改善达到复盘条件，需要重新核对全部长期症状。"
      : status === "improving"
        ? "近期负担下降，但仍按最近 72 小时的发作决定今天的行动。"
        : status === "worsening"
          ? "近期负担上升，停止增加活动并重新核对诱发因素。"
          : "近期趋势平稳，今天仍按最近 72 小时的发作决定行动。",
  };
}

function recentSignals(entries, episodeEvents, now) {
  const recentEntries = entries.filter((entry) =>
    withinHours(entry.observed_at || entry.updated_at, 72, now, entry.entry_date),
  );
  const recentEvents = episodeEvents.filter((event) => withinHours(event.started_at, 72, now));
  const safetyImpact =
    recentEntries.some((entry) => episodeImpact(entry) === "control_affected") ||
    recentEvents.some(
      (event) =>
        asBoolean(event.control_affected) ||
        event.episode_impact === "control_affected" ||
        asBoolean(event.right_hand_affected) ||
        asBoolean(event.right_foot_affected) ||
        asBoolean(event.handlebar_unstable),
    );
  const largeEpisode =
    recentEntries.some((entry) => (asNumber(entry.episode_peak_intensity) ?? 0) >= 5) ||
    recentEvents.some((event) => (asNumber(event.peak_intensity) ?? 0) >= 5);
  const repeatedEpisodes =
    recentEvents.length >= 2 ||
    recentEntries.filter((entry) => episodeImpact(entry) !== "none").length >= 2;
  const recentWorse = recentEntries.some((entry) => entry.baseline_change === "worse");
  const severeDaily = recentEntries.some(
    (entry) =>
      (asNumber(entry.walking_discomfort) ?? 0) >= 8 ||
      (asNumber(entry.right_foot_control) ?? 0) >= 8,
  );
  const threeWorse =
    entries.length >= 3 && entries.slice(0, 3).every((entry) => entry.baseline_change === "worse");

  return { safetyImpact, largeEpisode, repeatedEpisodes, recentWorse, severeDaily, threeWorse };
}

const avoid = [
  "骑电动车、跑步及其他需要快速反应的活动",
  "引体向上、悬垂、蛙泳腿、P2 侧弓步和强迫右髋外旋",
  "用筋膜球或泡沫轴压右膝内侧、青筋或小腿电流敏感点",
];

const episodeSteps = [
  {
    title: "前兆一出现就停",
    detail: "前兆一出现立即停止移动；骑行时安全停车、断电并离开车流。",
    time: "马上",
  },
  {
    title: "坐稳并观察",
    detail: "坐到有靠背的位置或躺下，不压住肢体，先观察 30 秒。",
    time: "30 秒",
  },
  {
    title: "只测试一种方法",
    detail: "一次只测试一种低风险方法，共 30 秒；不舒服立即停止。",
    time: "30 秒",
  },
];

const transitionActions = [
  {
    title: "坐稳后再起身",
    detail: "醒来或久坐后先坐稳，双脚自然踩地，不刻意把右腿外旋。",
    dose: "60 秒，1 次",
    expected: "呼吸自然，右手右脚没有突然失控感。",
    stop: "抽动幅度上升、头晕、麻木扩散或意识异常时停止。",
  },
  {
    title: "扶稳站立检查",
    detail: "扶住固定支撑缓慢站起，保持双脚自然宽度，不反复测试髋部弹响。",
    dose: "30 秒，1 次",
    expected: "右脚能够稳定承重，没有明显向左偏移或踩空感。",
    stop: "右脚不听使唤、右手抽动或需要抓紧支撑才能站稳时坐回去。",
  },
  {
    title: "室内短距离慢走",
    detail: "仅在前两步稳定时，在无车流、无楼梯的环境慢走，保持自然步幅。",
    dose: "10 步，1 组",
    expected: "落脚位置可控，症状没有逐步升高。",
    stop: "出现前兆、大腿内侧快速变酸、悬停卡顿或落点失控时立即停止。",
  },
];

function latestRecordedAt(entries, episodeEvents) {
  const candidates = [
    ...entries.map((entry) => timestamp(entry.observed_at || entry.updated_at, entry.entry_date)),
    ...episodeEvents.map((event) => timestamp(event.finished_at || event.started_at)),
  ].filter((value) => value !== null);
  return candidates.length ? Math.max(...candidates) : null;
}

function checklistState(entries, episodeEvents, now) {
  const latest = latestRecordedAt(entries, episodeEvents);
  const dataStale = latest === null || now.getTime() - latest > 36 * HOUR_MS;
  if (dataStale) return { state: "conservative", dataStale, latest };

  const signals = recentSignals(entries, episodeEvents, now);
  if (
    signals.safetyImpact ||
    signals.largeEpisode ||
    signals.repeatedEpisodes ||
    signals.recentWorse ||
    signals.severeDaily ||
    signals.threeWorse
  ) {
    return { state: "stabilize", dataStale, latest };
  }
  return { state: "maintain", dataStale, latest };
}

export function buildDailyChecklist(entries, episodeEvents, now = new Date()) {
  const status = checklistState(entries, episodeEvents, now);
  const latestDate = status.latest
    ? new Intl.DateTimeFormat("zh-CN", {
        timeZone: "Asia/Shanghai",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(status.latest))
    : "无";
  const unstable = status.state !== "maintain";

  return {
    state: status.state,
    data_stale: status.dataStale,
    basis: status.dataStale
      ? `最近记录日期为 ${latestDate}，今天使用保守清单；录入新变化后立即重算。`
      : `依据最近 72 小时的每日记录与发作事件生成，最近记录日期为 ${latestDate}。`,
    focus: unstable
      ? "先降低状态切换和移动中的失控风险，不主动诱发、不增加训练量。"
      : "维持可控的自动步行节律，只增加一个低风险观察变量。",
    actions: transitionActions,
    release: unstable
      ? null
      : {
          area: "右臀外侧周围",
          method: "仅用手掌轻触或轻扫，不找痛点、不深压。",
          dose: "30 秒，1 次",
          stop: "疼痛、抽筋感、麻电感或抽动增加时停止。",
        },
    stretch: unstable
      ? null
      : {
          area: "当天不做右髋外旋、P2侧弓步或内收肌强拉伸",
          method: "如需活动，仅做不进入牵拉感的自然关节活动。",
          dose: "不超过舒适范围的 3 次",
          stop: "出现筋被拉住、髋弹响伴痛或大腿内侧快速酸时停止。",
        },
    observation: "只观察“坐稳后起身”是否降低前兆或右脚失控；当天不再叠加第二个新变量。",
    movement: unstable
      ? "暂停骑电动车、跑步、引体向上、悬垂、蛙泳腿和需要快速转向的训练。"
      : "仅保留安全环境中的日常步行；恢复专项运动前需连续稳定并重新评估。",
    diet:
      "规律进餐和补水，保持稳定睡眠；避免醉酒、空腹高强度运动，以及未经药师核对的草药或补充剂。不要自行开始生酮饮食。",
    medication:
      "按医院处方服用现用药物，不自行停药、加量、减量或换药；记录漏服、嗜睡、情绪变化及意识事件供开药医生复核。",
    doctor_discussion: [
      "若多通道表面肌电/EEG-EMG支持皮层性阵挛，再由神经科讨论针对阵挛的药物路径。",
      "若诱发状态下确认固定肌肉异常募集，再讨论定位肉毒毒素与目标性康复。",
      "若出现分心改善、自动运动恢复等阳性体征，再讨论功能性运动障碍专门物理治疗。",
    ],
    avoid,
    emergency:
      "再次出现意识不清、长时间叫不醒，或全身强直阵挛超过 5 分钟时按急症处理。",
  };
}

export function buildGuidance(entries, episodeEvents, trend, now = new Date()) {
  const signals = recentSignals(entries, episodeEvents, now);
  let mode = "maintain";

  if (signals.severeDaily || signals.threeWorse || trend.status === "worsening") {
    mode = "reassess";
  } else if (
    signals.safetyImpact ||
    signals.largeEpisode ||
    signals.repeatedEpisodes ||
    signals.recentWorse
  ) {
    mode = "stabilize";
  } else if (trend.review_due) {
    mode = "progress";
  }

  const guidance = {
    stabilize: {
      mode,
      title: "近期不稳定",
      focus: "暂停骑电动车和诱发训练；自然发作时只做一次安全、可对照的中断测试。",
      rationale: signals.safetyImpact
        ? "最近 72 小时存在右手、右脚或行动控制受影响的发作。"
        : signals.repeatedEpisodes
          ? "72 小时内反复发作，当前触发阈值偏低。"
          : signals.largeEpisode
            ? "最近 72 小时出现幅度较大的发作。"
            : "最近 72 小时整体比平常更重。",
      steps: episodeSteps,
      avoid,
      next_check: "记录测试方法、30 秒效果、总持续时间和右手右脚影响。",
      safety_note: "右手和右脚恢复到平常状态前，不继续骑行或进入车流。",
    },
    maintain: {
      mode,
      title: "未见近期升级",
      focus: "不要主动诱发；只有自然发作时按 30 秒观察和单变量测试流程记录。",
      rationale: "最近 72 小时没有记录到反复、大幅或影响控制的发作。",
      steps: episodeSteps,
      avoid,
      next_check: "下一次自然发作时只测试一种方法，不同时叠加动作。",
      safety_note: "若抽动重新影响右手、右脚或行走，立即停止移动。",
    },
    progress: {
      mode,
      title: "需要完整复盘",
      focus: "近期改善达到复盘条件，重新核对全部症状后再决定是否增加活动。",
      rationale: "连续记录显示负担下降且没有近期安全影响事件。",
      steps: [
        { title: "重新复述", detail: "核对抽动、走路、右髋、内收肌链和小腿感觉。", time: "一次" },
        { title: "保持原量", detail: "复盘完成前不增加运动强度。", time: "当天" },
        { title: "只改一项", detail: "后续每次只测试一个低风险变量。", time: "后续" },
      ],
      avoid,
      next_check: "完成一次完整症状复述。",
      safety_note: "趋势改善不等于已经适合恢复骑行或高强度训练。",
    },
    reassess: {
      mode,
      title: "需要重新评估",
      focus: "近期负担明显上升，停止诱发性训练，只保留自然发作记录和安全中断测试。",
      rationale: "近期连续加重或走路、右脚控制达到高负担范围。",
      steps: episodeSteps,
      avoid,
      next_check: "整理近期视频、持续时间和单变量测试效果，供运动障碍方向评估。",
      safety_note: "意识异常、长时间叫不醒或全身强直阵挛超过 5 分钟时按急症处理。",
    },
  }[mode];

  return { ...guidance, review_due: Boolean(trend.review_due) };
}
