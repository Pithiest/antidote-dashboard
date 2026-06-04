# Antidote Dashboard

Antidote 是一个单用户症状追踪、每日建议和研究记录静态网站。前端不保存完整个人档案；登录成功后通过 Supabase Edge Function 读取云端资料。

## 当前能力

- 今日建议：根据最新记录输出 Day 0、Day 0 安全过渡或轻量 Day 1。
- 个性化录入：右脚控制、40 步卡顿、右髋外旋痛、右髋弹响、右小腿电流感、大腿内侧酸、骑行/惊吓/紧急叫起等字段。
- 趋势可视化：发作持续时间、A/B/C 分布、触发因素、骑行/紧急叫起安全记录。
- 资料库：登录后从 Supabase 读取长期档案、历史线索、候选模型和研究记录。
- 隐私边界：GitHub 只放前端和部署说明；原始症状数据只存 Supabase。

## 本地预览

```powershell
cd D:\antidote\antidote-dashboard
python -m http.server 4173
```

打开 `http://127.0.0.1:4173`。

## Supabase

- Project ref: `gnlvchwbygvexfaoaciv`
- Edge Function: `https://gnlvchwbygvexfaoaciv.supabase.co/functions/v1/antidote-api`
- Main tables: `antidote_entries`, `antidote_profiles`, `antidote_historical_events`, `antidote_hypotheses`, `antidote_recommendations`, `antidote_research_runs`

## 每日研究脚本

```powershell
$env:ANTIDOTE_SITE_PASSWORD='网站专属密码'
python D:\antidote\tools\daily_research_sync.py
```

脚本会读取网站数据、调用 AnySearch、保存研究记录，并生成 `D:\antidote\daily-research-last.md`。

## GitHub / Vercel

Vercel 从 GitHub 仓库导入即可。Framework 选 `Other`，Build Command 留空，Output Directory 设为 `.`。
