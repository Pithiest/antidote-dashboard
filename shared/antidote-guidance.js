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
  const dateOnly = String(fallbackDate).slice(0, 10);
  const dateParsed = Date.parse(`${dateOnly}T12:00:00+08:00`);
  return Number.isFinite(dateParsed) ? dateParsed : null;
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
  if (Number(entry.episode_minutes || 0) > 0 || Number(entry.episode_peak_intensity || 0) > 0) {
    return "control_ok";
  }
  return "none";
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
  const peak = asNumber(entry.episode_peak_intensity) ?? 0;
  const safety = asBoolean(entry.handlebar_unstable) ? 10 : 0;
  return (walking + foot + peak + safety) / 4;
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function dateValue(value) {
  return String(value || "").slice(0, 10);
}

function consecutiveSeven(entries) {
  if (entries.length < 7) return false;
  const dates = entries.slice(0, 7).map((entry) => dateValue(entry.entry_date));
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
      message: "近期记录用于建立个人基线，不影响今天的安全判定。",
    };
  }

  const latestSeven = valid.slice(0, 7);
  const recent = average(latestSeven.slice(0, 3).map(entryBurden));
  const previous = average(latestSeven.slice(3, 7).map(entryBurden));
  const improvement = previous > 0 ? ((previous - recent) / previous) * 100 : 0;
  const rounded = Math.round(improvement);
  const recentSafety = [
    ...latestSeven.filter((entry) => episodeImpact(entry) === "control_affected"),
    ...episodeEvents.filter(
      (event) =>
        withinHours(event.started_at, 7 * 24, now) &&
        (asBoolean(event.right_hand_affected) || asBoolean(event.right_foot_affected)),
    ),
  ].length > 0;
  const reviewDue = rounded >= 25 && consecutiveSeven(latestSeven) && !recentSafety;
  const status = rounded >= 25 ? "improving" : rounded <= -25 ? "worsening" : "steady";

  return {
    status,
    sample_count: valid.length,
    required_count: 7,
    improvement_percent: rounded,
    review_due: reviewDue,
    message: reviewDue
      ? "近期改善达到复盘条件，可以重新核对全部长期症状。"
      : status === "improving"
        ? "近期负担下降，但今天仍按最近 72 小时事件决定行动。"
        : status === "worsening"
          ? "近期负担上升，暂停加量并重新核对诱发因素。"
          : "近期趋势平稳，今天仍按最近 72 小时事件决定行动。",
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

  return {
    recentEntries,
    recentEvents,
    safetyImpact,
    largeEpisode,
    repeatedEpisodes,
    recentWorse,
    severeDaily,
    threeWorse,
  };
}

const commonAvoid = [
  "骑电动车、跑步和其他必须快速反应的活动",
  "引体向上、悬垂、蛙泳腿和 P2 侧弓步拉伸",
  "用筋膜球或泡沫轴压右膝内侧、青筋或小腿电流敏感点",
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
      title: "近期明显不稳定",
      focus: "暂停骑电动车和诱发训练，先确保起身、站立和短距离慢走时右手右脚可控。",
      rationale: signals.safetyImpact
        ? "最近 72 小时存在右手、右脚或骑行控制受影响的发作。"
        : signals.repeatedEpisodes
          ? "72 小时内反复发作，当前触发阈值偏低。"
          : signals.largeEpisode
            ? "最近 72 小时出现幅度较大的发作。"
            : "最近 72 小时记录显示整体较平常更重。",
      steps: [
        { title: "起身前", detail: "先坐稳 60 秒，不从睡眠或久坐直接冲出去。", time: "60 秒" },
        { title: "站立确认", detail: "扶稳站立 30 秒，分别确认右手握持和右脚落地可控。", time: "30 秒" },
        { title: "安全慢走", detail: "只在安全环境慢走；一旦抽动或控制下降，立即坐稳并计时。", time: "按需" },
      ],
      avoid: commonAvoid,
      next_check: "下一次只记录：诱发场景、持续时间，以及右手或右脚是否受影响。",
      safety_note: "右手或右脚没有恢复到平常状态前，不继续骑行。",
    },
    maintain: {
      mode,
      title: "当前未见近期升级信号",
      focus: "保持低刺激日常活动，不主动测试会诱发症状的动作。",
      rationale: "最近 72 小时没有记录到反复、大幅或影响控制的发作。",
      steps: [
        { title: "起身缓冲", detail: "睡醒或久坐后先坐稳，再扶稳站立。", time: "90 秒" },
        { title: "确认控制", detail: "确认右手握持和右脚落地与平常一致。", time: "30 秒" },
        { title: "日常活动", detail: "只做不会诱发症状的低风险日常活动。", time: "当天" },
      ],
      avoid: commonAvoid,
      next_check: "记录下一次自然出现的变化，不做主动诱发测试。",
      safety_note: "若再次出现控制受影响的抽动，立即停止移动并记录。",
    },
    progress: {
      mode,
      title: "需要完整症状复盘",
      focus: "近期趋势改善，先重新核对全部长期症状，再决定是否改变活动量。",
      rationale: "连续记录显示负担下降且没有近期安全影响事件。",
      steps: [
        { title: "完整复述", detail: "重新核对抽动、走路、右髋、内收肌链和小腿感觉。", time: "一次" },
        { title: "保持原量", detail: "复盘完成前不增加运动强度。", time: "当天" },
        { title: "只改一项", detail: "复盘后若推进，每次只测试一个低风险变量。", time: "后续" },
      ],
      avoid: commonAvoid,
      next_check: "完成一次完整症状复述。",
      safety_note: "改善趋势不等于已经适合恢复骑行或高强度训练。",
    },
    reassess: {
      mode,
      title: "需要重新评估",
      focus: "近期负担明显上升，停止所有诱发性训练并重新核对症状变化。",
      rationale: "近期连续加重或走路、右脚控制达到高负担范围。",
      steps: [
        { title: "停止诱发", detail: "停止骑行、跑步、引体、悬垂和拉伸测试。", time: "现在" },
        { title: "保留记录", detail: "记录自然发作的时间、场景和控制影响。", time: "按需" },
        { title: "重新核对", detail: "整理近期变化供专业评估，不自行停药或调药。", time: "尽快" },
      ],
      avoid: commonAvoid,
      next_check: "重新核对近期全部变化及安全影响。",
      safety_note: "若出现意识异常、摔倒、持续无力或长时间叫不醒，按急症处理。",
    },
  }[mode];

  return { ...guidance, review_due: Boolean(trend.review_due) };
}
