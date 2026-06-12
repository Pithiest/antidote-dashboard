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
