# 部署说明

## 当前状态

- 本地预览：`http://127.0.0.1:4173`
- Supabase 项目：`gnlvchwbygvexfaoaciv`
- Edge Function：`https://gnlvchwbygvexfaoaciv.supabase.co/functions/v1/antidote-api`
- 静态项目目录：`D:\antidote\antidote-dashboard`

## GitHub -> Vercel

本机当前没有 `git`、`gh`、`npm`、`npx` 或 `vercel` CLI；GitHub/Supabase 连接器如果正常，可以由 Codex 直接写入和部署。若连接器不可用，走手动上传。

Vercel 设置：

- Framework Preset: `Other`
- Build Command: 留空
- Output Directory: `.` 或留空

## 只上传这些静态文件

- `index.html`
- `styles.css`
- `app.js`
- `README.md`
- `DEPLOYMENT.md`
- `vercel.json`

## 不要上传

- `D:\antidote` 下的 PDF、书籍、日志和个人资料原文
- `supabase-functions` 目录
- Supabase service role key
- 截图文件 `local-*.png`
- 本地导出的完整 JSON 数据

## 部署后验证

1. 打开 Vercel URL。
2. 输入网站专属密码，确认能进入系统。
3. 确认资料库能从 Supabase 拉回长期档案。
4. 保存一条当天记录。
5. 刷新页面后重新登录，确认记录仍存在。
6. 手机端确认底部导航、每日录入和今日建议可用。
