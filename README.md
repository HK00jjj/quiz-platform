# 奥术典籍馆 · quiz-platform 源码工程

塔罗 / 哥特暗色主题的电气自动化题库刷题站。

- **线上站点**：https://hk00jjj.github.io/quiz-platform/
- **本分支（`src`）= 唯一完整源码**，可直接构建复现线上站点
- `gh-pages` 分支 = 本工程的构建产物（GitHub Pages 部署用），不要手改

## 技术栈

React 18 + Vite 5 + zustand + react-router（HashRouter）+ @supabase/supabase-js。
纯 CSS 主题（**无 Tailwind**），`vite.config.js` 中 `base: '/quiz-platform/'`。

## 目录结构

| 路径 | 说明 |
| --- | --- |
| `src/main.jsx` · `src/App.jsx` | 入口与路由（开机仪式 → 登录 → 主壳） |
| `src/components.jsx` | 通用组件（按钮 / 面板 / 空状态 / 深渊背景等） |
| `src/assets.js` | 素材路径集中映射（`p1~p54`） |
| `src/store.js` | zustand 全局状态：登录、题目、复习卡、作答记录、设置 |
| `src/lib/supabase.js` | Supabase 客户端（URL + anon key，均为公开值） |
| `src/lib/db.js` | 数据层：questions / review_cards / answer_records / settings |
| `src/lib/fsrs.js` | 间隔重复算法（FSRS 变体，与线上历史数据兼容） |
| `src/lib/validate.js` | 21 题批导入校验规则 |
| `src/lib/stats.js` · `src/lib/dates.js` | 连胜 / 日历 / 契合度统计 |
| `src/pages/` | Login · Learn · Bank · Import · Stats · Settings · Practice |
| `src/theme/` | `global.css`（全站基调）+ `pages.css`（分页样式） |
| `public/img/` | 85 张素材图（约 53 MB），已由 sharp 压缩 |
| `public/fonts/` | Cinzel 700 自托管 woff2（含中文子集扩展） |
| `scripts/` | 部署与素材压缩工具 |

## 本地开发

```bash
npm install
npm run dev        # 本地开发服务器
npm run build      # 产出 dist/（base 已是 /quiz-platform/）
npm run preview    # 预览构建产物
```

## 部署到 GitHub Pages

`dist/` 内容整体替换 `gh-pages` 分支后推送，约 1 分钟生效。两种方式：

```powershell
# 方式一：Git Data API 推送（推荐，github.com:443 直连经常超时也能成功）
node scripts/deploy-api.mjs <GitHub_TOKEN> <dist绝对路径>

# 方式二：git clone + push（需要 github.com 直连可用）
powershell -File scripts/deploy-ghpages.ps1 <GitHub_TOKEN>
```

`scripts/compress-sharp.mjs` 用于把原始素材批量压缩进 `public/img`
（PowerShell 的 `System.Drawing` 处理 >10MB PNG 会报「参数无效」，必须走 sharp）。

## 备份源码到本分支

改完源码后，用 `scripts/push-src.mjs` 把整个工程重新推到 `src` 分支（走 Git Data API，
不需要 git 直连；已存在且内容一致的文件自动跳过，中断后重跑即可续传）：

```powershell
node scripts/push-src.mjs <GitHub_TOKEN> <app目录绝对路径> <tools目录绝对路径> <README路径>
```

推送完会自动回读校验（本地/远端文件数与 git blob SHA 全量比对），输出 `RESULT: SRC BACKUP OK` 才算成功。

## 凭据与安全

- GitHub token、Supabase URL/anon key、登录邮箱密码、Vercel token 统一存放在
  **桌面 `凭据.txt`**，等价于账号权限。
- **规则**：不提交进仓库、不写进任何会被推送的文件、不外传。
- `src/lib/supabase.js` 里的 anon key 是设计上公开的前端 key（线上 bundle 中本就可见），
  数据权限由 Supabase 行级安全策略控制。

## 云端数据

Supabase 项目 `khtpnbzfjggezlmnnsgt`，表结构：
`questions` / `review_cards` / `answer_records` / `settings`（`key='app'`），RPC `replace_progress`。
数据在云端，换机器不丢；题目 id 为内容哈希（题干+题型+答案），天然去重。

## 设计铁律（改 UI 前必读）

1. 一切交互皆有仪式（点击 = 触碰符文，切换 = 法阵转移）
2. 一切数据皆有实体（进度 = 水晶槽填充，连胜 = 实体火焰）
3. 一切动效皆有重量（卡牌 3D 翻面，深渊轮廓闪现）

底色 `#0A0F1E`、光效青 `#4CC9FF`、古金 `#D4AF37`；字体 Cinzel（符文标题）+ Nunito。
世界观：悬浮于星界边缘的哥特式学院「奥术典籍馆」，学习者为「窥秘人」，
每道题是一张封印知识的塔罗牌，做对是灵知爆发，做错是被深渊侵蚀。

## 交互约定

- 客观题（单选/多选/判断/填空）点「忘记/模糊/记得」后：立即评级（Again/Hard/Good）→
  更新复习卡 → 保存记录 → **自动进入下一题**，不再显示「继续」按钮；末题直接进结算页。
- 主观题保留「继续」按钮二次确认。
- 「开始今日练习」优先链：到期复习 → 错题 → 新题 → 随机（用户明确要求保留，勿改）。
