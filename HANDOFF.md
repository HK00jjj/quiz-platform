# 交接文档 · 糖果题库（quiz-platform）

> 写给下一个接手的会话。读完这一份就能独立干活，不需要翻历史对话。
> 最后更新：2026-09-03，对应线上提交 `61687bb`。

---

## 0. 三十秒上手（最要紧的四条）

1. **权威源码在 `src` 分支，不在 `main`**。`main` 只有一个 README。线上产物在 `gh-pages` 分支。
2. **本地没有 git**。所有推拉都走 GitHub Git Data API（blob→tree→commit→ref），脚本在 `scripts/`。
3. **浏览器验证只用 Playwright CLI**：`npx playwright cli ...`。agent-browser 在这台机器上不可靠，已弃用。用完必须 `close`。
4. **`app/src/components.jsx` 会被用户编辑器的陈旧缓冲区反复回写成旧版本**（实测同一轮内被覆盖两次）。所以关键组件已搬到 `app/src/components/CandyBoot.jsx`。**不要把东西搬回 components.jsx。**

---

## 1. 项目是什么

电气自动化刷题站。视觉经历三次迭代：

| 版本 | 状态 | 说明 |
| --- | --- | --- |
| 奥术典籍馆（哥特：暗金+墨绿青+羊皮纸+塔罗牌+Cinzel） | 已废弃 | 但它的 CSS 仍是底座，见 §3.1 |
| 糖果题库（马卡龙果冻：奶白渐变+粉桃/薄荷/柠檬/薰衣草+果冻玻璃+大圆角+弹性缓动+气泡层+错误用酸橙绿） | **当前线上** | 用户明确要求回滚到这一版 |
| 苹果明净版（Apple HIG / Liquid Glass） | 已废弃 | 用户看过后要求回滚；`app/src/theme/apple.css` 作为孤儿文件保留，无人 import |

技术栈：**React 18 + Vite 5 + zustand + react-router(HashRouter) + @supabase/supabase-js，纯 CSS，无 Tailwind**。
`vite base: '/quiz-platform/'`。开发用 demo 模式：`npm run dev -- --mode demo`（28 道覆盖七题型的假数据，不连云端）。

- 本地工作区：`c:\Users\青丘白浅\Documents\QoderCN\2026-09-02\chat-1`
- 项目根：`app/`（`app/src`、`app/public/img`、`app/dist`）
- 部署工具：`scripts/`、根目录的 `verify-*.mjs`
- 线上：https://hk00jjj.github.io/quiz-platform/
- 仓库：`HK00jjj/quiz-platform`
- Token：**不写在本文档里**。GitHub 的 push protection 会拦住含明文 token 的文件入库（实测：把 token 写进本文档后 `push-src` 直接报 `422 Repository rule violations found / Secret detected in content / token_type: GITH…`，重试三次全败）。
  向用户索取，或从本地未入库的凭据文件里读。它是 fine-grained PAT，只需 `contents` 写权限；若仓库转公开请立即轮换。
  下文命令里的 `<TOKEN>` 均指它。

---

## 2. 部署链路（六步，全部在仓库根目录跑）

```powershell
cd "c:\Users\青丘白浅\Documents\QoderCN\2026-09-02\chat-1"
$t = '<TOKEN>'   # 见 §1：不要把它写进任何会入库的文件

cd app; npm.cmd run build; cd ..          # ① 构建（Vite 自己会清空 dist，不要手动 Remove-Item）
node scripts\purge-dist.mjs               # ② 清孤儿产物（保险：引用数 <25 会拒绝执行）
node scripts\deploy-api.mjs $t "$PWD\app\dist" "<提交信息>"   # ③ 推 gh-pages
Start-Sleep 22
node verify-deploy.mjs $t "$PWD\app\dist" # ④ git blob SHA1 全量比对（缺失/不一致/多余 应全为 0）
node scripts\push-src.mjs $t "$PWD\app" "$PWD\scripts" "$PWD\src-branch-README.md" "$PWD\verify-deploy.mjs" "$PWD\verify-live.mjs" "$PWD\HANDOFF.md"  # ⑤ 备份源码到 src 分支
Start-Sleep 50
node verify-live.mjs "$PWD\app\dist"      # ⑥ 线上 HTTP 逐文件 200 + 三哈希比对
```

### 已知怪癖（都会自愈，别慌）

- **`push-src` 曾经只备份一部分工具**：旧版第 6 行只解构 4 个位置参数（多传的静默忽略），而且 `scripts/` 是一份 **8 个文件的硬编码白名单**。后果：`pull-src.mjs`、`purge-dist.mjs`、`candy-copy.mjs`、素材脚本、根目录的 `verify-deploy.mjs`/`verify-live.mjs` **从未进过 src 分支**——本地工作区一丢就恢复不出部署工具链。已修为：`...extras` 可变参 + 整个 `scripts/` 目录 walk。**记得把根目录的 verify 脚本和本文档作为额外参数传进去**（见上面的命令）。

- **`push-src` 首跑报 `SRC BACKUP MISMATCH`** → GitHub 树回读缓存延迟。重跑一次会显示 `需上传 blob: 0` + `SRC BACKUP OK`。本项目已发生 6 次，每次都是这个原因。
- **`verify-live` 在推送后 20~60 秒内报 `HAS FAILURES`** → GitHub Pages 传播延迟。等 45~95 秒重跑即 `ALL OK`。
- **`purge-dist` 拒绝执行** → 它数产物里对 `img/` 的引用数，少于 25 就认为"你可能把素材删光了"而中止。这是保险，不是故障。
- **终端守卫误报**：命令里出现 `Remove-Item`、`Stop-Process`，或命令过长时，会被丢进只读沙箱（报 `Please use PowerShell's Remove-Item cmdlet instead of CMD's rmdir`，即使命令里根本没有 rmdir），此时 node/npm 全部"拒绝访问"且静默失败。**对策：把长命令拆成两三条短的；永远不要在命令里带删除/杀进程。**

### 发布前闸门（强烈建议保留这个习惯）

构建后先对产物做静态断言，通过了才部署：

```powershell
$c = [IO.File]::ReadAllText((Get-ChildItem app\dist\assets\*.css | Select-Object -First 1).FullName)
$j = [IO.File]::ReadAllText((Get-ChildItem app\dist\assets\*.js  | Select-Object -First 1).FullName)
# 断言要用「抗压缩」的 token：类名、keyframes 名、界面文案
# 反例（都曾因此误报）：'candy-hero::after'（压缩后是 :after）、'rgba(255,255,255,.38)'（压缩后转 hex-alpha）
```

本项目多次靠这个闸门拦下错误状态（包括一次编辑器污染导致的 Apple 版组件混入）。

---

## 3. 架构关键决策（改之前先读懂，别"顺手优化"）

### 3.1 叠加主题层，不重写

`app/src/theme/` 下三份 CSS，`main.jsx` 按此顺序 import：

```
global.css  (≈600 行，哥特原版：token、@font-face、.page-head、.panel、动画 keyframes)
pages.css   (≈591 行，哥特原版：答题页九切片卷轴、三分区、判断题铜牌、步骤条)
candy.css   (≈1000 行，当前主题：靠层叠覆盖上面两份)
```

**candy.css 是唯一的主题权威**。它的高杠杆手法是在 `:root` 重定义哥特 token（`--gold-text`、`--teal`、`--fault`、`--glow-*`、`--ink-parch`、`--muted`、`--ease-pop`），让几百条旧规则自动变色，而不是逐条改写。

⚠️ `global.css` 里两个 Cinzel `@font-face` 指向**不存在**的 `public/fonts/cinzel-*.woff2`，每次加载白拿 2 个 404。candy.css 早已把 `.font-gothic` 覆写成 Nunito / Noto Sans SC，所以字体本来就没生效过。可以删，但注意 SearchReplace 锚点（见 §6）。

### 3.2 `CandyBoot.jsx` 的存在理由（重要）

用户的 IDE 里 `app/src/components.jsx` 有一个**苹果版的陈旧缓冲区**，会不定时自动回写，覆盖掉我的修改。实测：从 src 分支拉回糖果版 → 审计确认 `nav-emoji=True / launch-screen=False` → **一个调用之后又变回 Apple 版**。`app/index.html` 同样被回写成哥特原版。

对策（已实施，别撤销）：

- `app/src/components/CandyBoot.jsx` 承载 `Background`（气泡层）、`BottomNav`（三格 emoji 导航）、`BootRitual`（2 秒开机分镜）、`burstParticles`（糖豆爆裂）
- `App.jsx` 从 CandyBoot 引这三个，只从 `components.jsx` 引 `TouchRitual`
- `Practice.jsx` 从 CandyBoot 引 `burstParticles`
- 因此 `components.jsx` 里的 `Background / BottomNav / BootRitual / burstParticles` 是**死代码**（Apple 版），无害但别用

如果哪天确认编辑器缓冲区问题解决了，可以把 CandyBoot 并回 components.jsx，但要先用 §2 的闸门断言 `launchScreen=False`。

### 3.3 `index.html` 是用户手动改回的哥特原版，**不要动**

当前内容：`theme-color #0d1117`、标题「奥术典籍馆 · 窥秘人的修行之地」、`<link rel="preload" as="image" href="./img/p11.webp">`。
我曾改成糖果版（`#FFF5F7` / 「糖果题库 · 刷题」/ 去掉 preload）并部署过，用户又改了回来。**尊重现状**；那条 p11 preload 警告会一直在 console 里，是无害的。

### 3.4 多题库（书本）数据模型 —— 零表结构改动

Supabase 四张表：`questions` / `review_cards` / `answer_records` / `settings`（key-value）。**没有 DDL 权限**，所以：

- 书本映射存在 `settings` 表的 **`key='books'`** 行：
  `{ activeBookId, order:[id], books:{id:{name,color,icon,subject,createdAt,lastOpenedAt}}, assign:{题目id→书本id} }`
- 同时镜像到 `localStorage['quiz-platform.books.v1']`，**云端写失败自动降级本机**并提示
- 隔离原理：`review_cards`/`answer_records` 以 `questionId` 为键 → **各书题目 ID 不重叠即天然隔离**，不需要 book_id 列
- **关键设计**：store 里 `questions` 是**派生值** = `allQuestions.filter(q => assign[q.id] === activeBookId)`。所以 Learn 计数、题库页、组卷、答题全部自动变成书本作用域，**页面代码一行都不用改**
- 迁移：首次加载若无 books，`migrateBooks()` 建一本「默认题库」把现有题目全归进去（只增不删）
- **防回环**：`repo.subscribe` 监听了 `settings` 表，存书本会触发 reload；若 reload 又无条件再存就无限循环。用模块级 `lastBooksJson` 做幂等（`persistBooks` 第一行就 return）
- 危险操作分级：`clearBookProgress`（只清 SRS 卡+做题记录，题目保留）/ `deleteBook`（删整本，UI 要求输入完整书名才解锁，且至少保留一本）
- UI：`app/src/components/Bookshelf.jsx`，渲染在 `Settings.jsx` 最顶部
- 已真机验证 9 步全通（切换/空态联动/题数恢复/新建/重命名/删除二次确认/主题库不受误伤）

### 3.5 答题页（Practice）

- 正面是 **p19 九切片羊皮纸卷轴**（`border-image: url('/quiz-platform/img/p19-soft.webp') 125 250 179 250 fill / 18px 36px 26px 36px stretch`），`.q-face` 自己铺 p4 无缝羊皮纸整块盖住被拉伸的中心切片
- 三分区：`.zone-q`（题目）/ `.zone-a`（作答）/ `.zone-s`（答案，默认蜡封遮挡）
- 答案用**墨迹显影**（`ink-write`：clip-path 自左向右）
- 卡牌尺寸**高度优先**：`height: min(calc(100svh - 96px), 宽/0.5)`；移动端用 `svh` 不用 `dvh`
- `.q-face-scroll` 必须 `scrollbar-gutter: stable both-edges`（只写 `stable` 会让内容中心偏左 3.5px）
- 答案揭晓后的自动滚动：等 `seal === 'broken'`（蜡封 520ms 才卸载）+ 双 rAF，再一次性 `scrollTo`；**不自写 rAF 补间**（会与 CSS `scroll-behavior: smooth` 双重缓动）
- ⚠️ **千万不要在 `.bank-item` 上加 `content-visibility: auto`**：它隐含 `contain: paint`，而 paint containment 是 3D 分组属性，会压平 `preserve-3d`、让 `backface-visibility` 失效（曾导致秘典页正反面同绘）
- 这一页仍大量使用哥特位图：`A.cardBack`（翻牌封面=哥特卡背）、`A.roseWindow`、`A.cracks`、`A.waxSeal`（蜡封）、`A.gems`、`A.markRadio/markCheck`、`A.judgeCard`。**是待办 §7.3 的主战场**

---

## 4. 验证工具链

### 4.1 Playwright CLI（唯一可靠）

安装来源：`npx skills add microsoft/playwright-cli@playwright-cli -g -y`（skill 在 `~\.qoder-cn\skills\playwright-cli\SKILL.md`）。
包名是 **`@playwright/cli`**，不是 `playwright-cli`。本地已有 playwright 1.62.1，所以用 **`npx playwright cli <cmd>`**。浏览器已下载到 `%LOCALAPPDATA%\ms-playwright\chromium-1234`。

```powershell
npx --yes playwright cli open                                    # 必须先 open，否则报 "browser 'default' is not open"
npx --yes playwright cli resize 1280 900                         # 真实视口（390 844 测手机）
npx --yes playwright cli goto 'http://127.0.0.1:5179/quiz-platform/#/settings'
npx --yes playwright cli --raw eval "JSON.stringify({...})"       # 返回 JSON 字符串，断言首选
npx --yes playwright cli run-code "async page => { ... }"         # 多步流程/帧采样/网络监听
npx --yes playwright cli console                                  # 摘要含 Total messages / Errors / Warnings
npx --yes playwright cli screenshot --filename=shots/x.png
npx --yes playwright cli close                                    # 必须收尾
```

- 开发服务器：`127.0.0.1:5179`（先 `Test-NetConnection 127.0.0.1 -Port 5179` 确认活着）
- console 输出**跨运行累积**，判断报错要看 Errors 数字是否为 0，不是看有没有输出
- `run-code` 跑在 **Node 上下文**，没有 `setInterval` 等浏览器全局（踩过）；页面内的事要放进 `page.evaluate`
- React 受控输入必须用原生 setter：
  ```js
  const d = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  d.call(el, '文本'); el.dispatchEvent(new Event('input', { bubbles: true }))
  ```
- React 18 自动批处理：同一次 eval 里"先点选项再点提交"无效，必须拆成多次并中间等待

### 4.2 帧采样探针（**照抄这个，别改**）

```js
// ✅ 正确：循环内只记录时间戳，不读任何样式
const r = await page.evaluate(() => new Promise(res => {
  const fr = []; let last = performance.now(), n = 0
  function tick(t) { fr.push(+(t - last).toFixed(1)); last = t
    if (++n < 120) requestAnimationFrame(tick)
    else res({ max: Math.max(...fr), slow25: fr.filter(f => f > 25).length,
               avg: +(fr.reduce((a,b)=>a+b,0)/fr.length).toFixed(1) }) }
  requestAnimationFrame(tick)
}))
```

⚠️ **在 rAF 循环里调 `getComputedStyle` 会自己造出假卡顿**：我第一次这么干，在 React 挂载新页面时强制同步样式重算 14 次，量出 `max: 175.8ms`；换成干净探针后同一场景是 `slowFrames: []`。要读样式就在采样结束后单独读一次。

配合 `PerformanceObserver({entryTypes:['longtask']})` 和 `page.on('request')` 可以一次拿到慢帧、长任务、切页期间的网络请求。

### 4.3 其它

- **agent-browser**：已弃用。`open` 会因"守护进程留着指向已死浏览器的 restore 状态"而每条命令各耗 25 秒超时（20+ 条命令的脚本看起来就像永久死等）。正确收尾是 `agent-browser close --all`，**不是 `Stop-Process` 硬杀**。如果非要用，先跑 `agent-browser skills get core` 读官方故障排查。
- **内置 Browser 子代理**（Agent 工具，`subagent_type: Browser`）：可用，但视口是 0×0，**只适合 DOM 文本/class 断言，不适合任何几何测量**。题库书架那 9 步功能验证就是它做的，效果很好。
- 截图交给 `Read` 工具能拿到结构化描述，适合确认布局观感；精确数值一律用 `eval` 断言。

---

## 5. 性能基线（回归对照，2026-09-03 实测 @1280×900）

| 场景 | max 帧间隔 | 慢帧(>25ms) | 备注 |
| --- | --- | --- | --- |
| 学习页空闲 120 帧 | 6.2ms | 0 | avg 6.0ms |
| 学习 → 导入 | 18.0ms | 0 | |
| 导入 → 设置（首次） | 60.6ms | 1 | 修前 **224.3ms / 3** |
| 设置 → 学习 | 18.3ms | 0 | 修前 48.5ms / 1 |
| 学习 → 设置（第二次起） | 6.2ms | 0 | |
| 导航点击到路由变化 | 101~116ms | — | 修前有硬编码 **300ms** 延迟 |
| console | **Errors: 0** | — | Warnings 里有 React Router v7 future flag ×2 和 p11 preload ×1，都无害 |

### 已经修掉的两个频闪根因（别改回去）

1. **`.page-wrap` 的 `page-in` 动画**：`from { opacity:0; filter: blur(6px); transform: translateY(10px) }`，450ms，**在整个页面上动模糊半径** → 每帧迫使整页重新光栅化。叠加 `.rise`（`rise-in .5s`）在四张入口卡上 .08/.16/.24/.32s 的错峰级联。
   → candy.css 末尾：`.page-wrap, .rise { animation: none !important }`
2. **卡片类元素的大面积 `backdrop-filter: blur(20px)`**：`.panel, .entry-card, .book-card, ...` 共用一条规则。设置页一次挂载 5 个 `.panel` + 3~4 个 `.book-card` = **9 层实时背景模糊在同一帧创建** → 224ms。
   → candy.css 末尾追加同选择器列表：`backdrop-filter: none !important; background: rgba(255,255,255,.84) !important`
   → 保留了底部导航（1 层常驻、iOS 标准材质）和答题页 `.pile-counter`（两个小元素）的模糊

**动效纪律**（`fixing-motion-performance` + `animate` skill 的硬规则，本项目一律遵守）：
只动 `transform`/`opacity`；**绝不动 `background-position`**（哥特版的鎏金扫光就是这么每帧重绘的）；不在大面积上动画 `filter`/`blur`；blur 只做静态、不连续动画；`infinite` 动画只跑在小面积元素上（64px 实体、66px 糖环），且关键帧大部分时间静止（天平 4.6s 周期里前 72% 完全不动）；一次性效果优先于循环；高频操作（切页、导航）只能"几乎察觉不到或干脆没有"；所有新增动效都要有 `prefers-reduced-motion` 降级。

---

## 6. 已知陷阱（每一条都真踩过）

| 症状 | 原因 | 做法 |
| --- | --- | --- |
| SearchReplace 反复"匹配失败" | 凭记忆拼锚点；或文件已被编辑器回写 | **先 Read 再改**。同一文件连续失败 3 次就换 `edit_file` |
| 产物断言明明规则在却报 False | 压缩器把 `::after` 规范成 `:after`、把 `rgba()` 转 hex-alpha、把同声明的规则合并成 `.a,.b{...}` | 断言只用**类名 / keyframes 名 / 界面文案**，或运行时读 `getComputedStyle` |
| 中文断言全是 False | `Get-Content -Raw` 在 PS 5.1 按 ANSI 解码 | 用 `[IO.File]::ReadAllText($path)` |
| codemod 把已确认的版本改回旧文案 | `scripts/candy-copy.mjs` 的 MAP 里留着上一轮的映射"以备再用"，重跑就全执行了 | **MAP 只能包含当前这一轮的方向**，历史映射整段删掉；跑前先 `--dry` 逐条核对；跑后做正反两向断言 |
| 短词映射误伤长词 | `['典籍馆','X']` 会把品牌名「奥术典籍馆」改成「奥术X」 | 长句排在短词之前；能精确就不要用短词 |
| `display:none` 的 `<img>` 仍在发请求 | 隐藏不等于不加载 | **必须从 JSX 里删掉**（已对 `.step-node img` 和 `.entry-card .art img` 做过） |
| node/npm 全部"拒绝访问"、输出 0 字节 | 命令被丢进只读沙箱（含 `Remove-Item`/`Stop-Process` 或过长） | 拆短命令；不带删除/杀进程 |
| `pull-src` 把文件写到工作区根 | 仓库路径**没有 `app/` 前缀**（push-src 把 `app/<x>` 映射到根） | 拉回时要还原：`README.md`→`src-branch-README.md`、`scripts/` 原位、其余加 `app/` 前缀 |
| `pull-src` 传到一半 `UND_ERR_SOCKET` | 拉 100+ blob 时对端偶发断连 | 已内置 4 次重试（`get()`） |
| 页面永久卡死、`open` 死等 | 外链 Google Fonts `@import` 是渲染阻塞资源，不可达网络下 load 永不触发 | 已移除，改系统字体栈。**不要再引入任何外链字体** |
| 秘典页正反面同绘、牌背文字镜像 | `content-visibility: auto` 隐含 `contain: paint`，压平 `preserve-3d` | 见 §3.5，别加回去 |
| `border: var(--card-border)` 构建报错 | esbuild 对 border 简写里的 `var(` 报 `Unexpected "var("` | 写全 `border: 0.5px solid var(...)` |
| `A.gems[x]` 取值崩 | 素材键被批量改名/删除 | 改 `assets.js` 时**保留全部键名与数据结构** |

| 推送报 `422 Secret detected in content` | 待入库文件里有明文 token（GitHub push protection） | 凭据绝不写进 `app/`、`scripts/`、`HANDOFF.md` 等任何会入分支的文件；用 `<TOKEN>` 占位，运行时用 argv 传 |
| `push-src` 多传的参数被静默忽略 | 旧版只解构 4 个位置参数 | 已改 `...extras`；改完记得看回读校验的文件数是否真的涨了 |

---

## 7. 待办清单（用户明确要求过，按建议顺序）

### 7.1 收藏题集（第五个入口）★ 最顺，建议先做
- favorites 直接放进书本 payload（`books[id].favorites: [questionId]`），天然随书本隔离
- 解析区加一个星标按钮；`lib/stats.js` 的 `buildSession` 加 `mode: 'fav'`
- 学习页加入口卡（注意 `.entry-card:nth-child(n)::before` 的 emoji 序号，加第五张要补 `:nth-child(5)`，已有 🔖）

### 7.2 音效（八音盒 / 铃铛 / 气泡）
- **建议用 WebAudio 合成，不要装 Howler.js、不要找音频素材**：振荡器 + 衰减包络即可做出八音盒/铃铛质感，零素材零依赖
- 触发点：答对（success）、答错（error，配酸橙绿）、翻牌、开机分镜
- 必须尊重 `prefers-reduced-motion` 与首次交互后才能起 AudioContext 的浏览器策略

### 7.3 清 7MB 哥特素材（`app/dist` 现在 82 文件 / 7.6MB，其中 `img/` 76 个约 7.0MB）
- **注意：糖果版仍在用一批位图**，不能全删：`p19-soft`（卷轴九切片）、`p4`（无缝羊皮纸）、`p44`（分隔条）、`p2`/`p6`（秘典页卡面）、`judge-true/false`（判断题铜牌）、`mark-radio/check`（选项标记）、`waxSeal`、`cracks`、`nav-*`
- 真正能删的：Login 的 `starryBg/loginGate/vortex/magicOrb`、Learn 的 `hallVision/sealedDeck/cardPile/magicBook/cardTower/emptyShelf`（**JSX 已移除，只剩 assets.js 里的键**）、Settings 的 `balance/memoryFlask/sigilBadge/furnace`（同上）、`bgTexture`、`p33 navBar`、`p11`（index.html 的 preload 仍指向它，用户要保留）
- 步骤：先盘点 `A.*` 的全部引用点 → 删掉无引用的键 → 删 `app/public/img/` 对应文件 → `purge-dist` 会因引用数 <25 拒绝执行，需要给它加一个 `--all-img` 开关
- **答题页那批要不要整体糖果化**（卡背→糖纸、蜡封→糖封、裂纹→糖霜裂）用户尚未拍板，问过再说

### 7.4 哥特文案残留（`scripts/candy-copy.mjs` 加映射即可，注意 §6 的规矩）
- 学习页入口卡：「污染重阅 / 被酸糖低语侵蚀的符文，等待重新解读净化」「随机翻阅 / 全库无放回抽取 20 卷 · 模拟考试手感」「学习新篇 / 首次解读建立甜蜜值印记」「全部题库 / 可按题型…切牌筛选」
- 导入页说明里被早期「卷」正则改坏的句子：「21 卷批执行完整规则…超过 21 卷拨大秘库逐题检测」
- 筛选弹窗：「🃏 全部题库 · 切牌筛选」「返回阅览厅」「开始解读」
- Stats 页整页：「星 界 观 测 台」「尝味师的成长档案 · 酸糖见证每一次做题」

### 7.5 Stats 页（星界观测台）
- 入口（📊 星象悬浮按钮）已按用户要求删除，`/stats` 路由保留，可直接访问 `#/stats`
- 它是**哥特残留最重的一页**：`A.idCardFrame`、`A.avatar`、`A.portraitFrame`、`A.badgeFrame`×2
- 要么糖果化后给个新入口，要么整页下线

### 7.6 设置页四个实体造型偏抽象
- 64×64 的纯 CSS 糖果天平/糖果罐/徽章/熔炉，截图被读成"带 T 的天平"和"一圈彩色圆点"
- 想更"像"就放大到 ~88px 并加细节（吊绳、罐口高光、炉膛格栅）

### 7.7 死代码与残留
- `.fab-stats`、`.nav-veil` 的 CSS 规则（`pages.css`/`candy.css`/`global.css` 里都有，已无元素使用）
- `app/src/theme/apple.css`（孤儿，无人 import，故意保留以便一行 import 复活苹果版）
- `components.jsx` 里的 Apple 版 `Background/BottomNav/BootRitual/burstParticles`（死代码）
- **工作区根有一份重复源码树**（`src/`、`public/`、`index.html`、`package.json` 等约 134 个文件），是早期一次路径映射写反的 `pull-src` 留下的。没有任何工具读它。删目录需要 `Remove-Item`，会被只读沙箱拦，**需要用户明确许可**
- `src-branch-README.md` 大部分仍在描述哥特版（只有「多题库数据模型」一节是新的），需要整体重写

---

## 8. 当前状态快照（2026-09-03）

| 项 | 值 |
| --- | --- |
| gh-pages HEAD | `61687bb`（82 文件 / 7.6MB，`verify-deploy` 缺失 0 / 不一致 0 / 多余 0） |
| src HEAD | 与 gh-pages 同源（`push-src` 回读 137/137 零差异） |
| 线上 | `verify-live` 82/82 全 200 + index.html/JS/CSS 三哈希 MATCH → `LIVE RESULT: ALL OK` |
| console | Errors **0** |
| 开发服务器 | `127.0.0.1:5179`，demo 模式 |

### 本轮（最后一次会话）做完的事
1. 题库书架（多书本数据隔离）：`lib/db.js` 加 `saveBooks`/`deleteQuestions`、`store.js` 加书本状态机与 6 个动作、`components/Bookshelf.jsx`、Settings 置顶、candy.css 书架样式 —— 9 步真机验证全通
2. 清掉糖果版里残留的哥特文案 35 处（`炼 金 工 坊`→`糖 果 抽 屉`、`参悟目标`→`每日目标`、`典籍馆尚无题库`→`题库还是空的`、`封印记忆`→`封装记忆`、`炼金熔炉`→`糖果熔炉`…）
3. 开机仪式 2 秒四段分镜（糖豆弹入 → 螺旋展开成糖纸 → 两侧剥开 → 气泡升起），实测阶段推进 `s0×4 > s1×3 > s2×3 > s3×2 > GONE`
4. 设置页四个纯 CSS 糖果实体（天平/糖果罐/徽章/熔炉），`toolImgs: 0`
5. 导入页三步糖果流程条（`st1/st2/st3` → 🍬/📥/🍯，当前步外圈旋转糖环，已完成连线能量流动），`stepImgs: 0`
6. 学习页横幅换成纯 CSS 糖果橱窗（去掉哥特巫师图 `A.hallVision`），并中和哥特层 `.learn-vision::after` 的 `rgba(13,17,23,.85)` 近黑遮罩
7. 删掉切页时的哥特玫瑰彩窗烟雾 `.nav-veil`（用 `A.roseWindow`）+ 硬编码 300ms 导航延迟
8. 删掉学习页 📊「星象」悬浮入口
9. 修掉两个频闪根因（整页 blur 动画、9 层 backdrop-filter），见 §5
10. 补回糖豆爆裂 `burstParticles`（一度因 components.jsx 被回写成 Apple 版而只剩振动）

### 提交时间线（都在 gh-pages，可随时回滚）
`dd426b3` 糖果版 → `2b340ad` 题库书架 → `f3c86ba` 文案清理 → `c916584` 开机分镜+四实体+流程条 → `bf4ae7a` .tool 特异性+去 img 请求 → `ba67428` 补回糖豆爆裂 → `8c63366` 导入页过场哥特残留 → `f51e35f` 删 nav-veil+星象入口 → `70096cd` 杀整页 blur 动画 → **`61687bb` 去 backdrop-filter（当前）**

苹果版在 git 里完整可恢复：gh-pages `a7f5203`/`7d60e29`，src `31e30d0`/`cf385cc`/`b9338e1`。
回滚方法：`node scripts/pull-src.mjs <token> <src分支的完整SHA>`（会覆写 `app/**` 与 `scripts/**`，只覆写不删除），然后重新构建部署。
⚠️ 取 SHA 时不要用 `Select-String` 抓短 SHA（曾抓到 8 个候选导致 ref 更新 422），要取完整 40 位。

---

## 9. 用户偏好与沟通方式（很重要）

- **中文回复**。技术术语和代码标识符保持原文。
- 用户会**明确否定**不满意的方案（例："判断题做错了，还原，我只要你把正确和错误分别放在最中间"）。被否定时**完全还原**，不要保留自己那版的残余，也不要争辩。
- 用户多次要求：**调用合适的 skill**，"效果不好就下载安装新 skill"。已经装了 `playwright-cli`。已加载并实际用过的：`impeccable`、`apple-design`、`baseline-ui`、`frontend-ui-engineering`、`animate`、`fixing-motion-performance`、`systematic-debugging`、`find-skills`、`agent-browser`、`ui-radar`。
- 用户在意**减少调用次数**："确保质量效果的前提下，减少调用次数"。能并行就并行，能一次跑完构建+部署+验证就一次跑完。
- 用户会自己动文件（`index.html`、`verify-books.ps1`、以及那个要命的 `components.jsx` 缓冲区）。**每次动手前先审计基线**，别假设上一轮的状态还在。审计模板：
  ```powershell
  $x=[IO.File]::ReadAllText("$PWD\app\src\components.jsx")
  "emojiNav=$($x.Contains('nav-emoji')) svgNav=$($x.Contains('nav-ico')) launchScreen=$($x.Contains('launch-screen')) bubbles=$($x.Contains('bubble-layer'))"
  ```
  期望：`emojiNav=True svgNav=False launchScreen=False bubbles=True`（若 svgNav=True 说明又被回写成 Apple 版了）
- 报告风格：给**实测数字**而不是"已优化"；主动交代自己犯的错和怎么发现的；诚实标注未验证/降级验证的部分；不要把猜测写成结论（本项目有过一次误判：把切页频闪归因于导入页封印过场，真因是 `.nav-veil` 和整页 blur）。

---

## 10. 快速自检（接手后第一件事）

```powershell
cd "c:\Users\青丘白浅\Documents\QoderCN\2026-09-02\chat-1"
# 1) 基线是否被编辑器污染
$x=[IO.File]::ReadAllText("$PWD\app\src\components.jsx"); "emojiNav=$($x.Contains('nav-emoji')) svgNav(应False)=$($x.Contains('nav-ico'))"
"main.jsx: $((Get-Content app\src\main.jsx | Select-String 'theme/').Line -join ' | ')"   # 期望末尾是 candy.css
# 2) 开发服务器是否活着
"dev: $((Test-NetConnection 127.0.0.1 -Port 5179 -WarningAction SilentlyContinue).TcpTestSucceeded)"
# 3) 远端两个分支的 HEAD
$t='<TOKEN>'; $h=@{Authorization="token $t";'User-Agent'='ps'}
$r='https://api.github.com/repos/HK00jjj/quiz-platform'
"gh-pages: $((Invoke-RestMethod "$r/git/refs/heads/gh-pages" -Headers $h).object.sha)"
"src     : $((Invoke-RestMethod "$r/git/refs/heads/src" -Headers $h).object.sha)"
# 4) Playwright 是否可用
npx --yes playwright cli open; npx --yes playwright cli goto 'http://127.0.0.1:5179/quiz-platform/#/settings'
npx --yes playwright cli --raw eval "document.querySelectorAll('.book-card').length"; npx --yes playwright cli close
```

四项都正常，就可以直接接 §7 的待办往下做。
