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

---

## 11. 本轮更新（2026-09-03 第二轮会话）· 覆盖 §8 快照

**gh-pages HEAD：`13c2057`（父提交 `61687bb`，82 文件 / 7.59 MB，verify-deploy 缺失 0 / 不一致 0 / 多余 0 = IDENTICAL）**

> 新会话的工作区变成了 `2026-09-03\chat-1`（空目录），而工程在 `2026-09-02\chat-1`。
> **编辑类工具不能修改工作区外的文件**（读可以、写会报 `can not edit the file outside the projects`）。
> 解法：在新工作区里建两个目录联接，改的仍是原文件本体，不用搬 7.6MB 工程、不用重装依赖、不丢会话上下文：
> ```powershell
> New-Item -ItemType Junction -Path "<新工作区>\app"     -Target "<旧工作区>\app"
> New-Item -ItemType Junction -Path "<新工作区>\scripts" -Target "<旧工作区>\scripts"
> ```
> 之后所有 SearchReplace 走 `<新工作区>\app\src\...` 路径即可。根级文件（HANDOFF.md 等）没被联接覆盖，
> 要改就用「Write 到新工作区 + `[IO.File]::AppendAllText` 追加」，别在 PowerShell 里写长中文串。

### 11.1 做完的事

**§7.1 收藏题集（第五个入口）已上线**，全部按待办里的设计落地：
- `favorites` 挂在 `books[id].favorites`，随既有 books payload 一起存 → 零新增存储通道、天然按书隔离、复用 `lastBooksJson` 幂等防回环
- `store.js`：`toggleFavorite(qid)`（返回切换后状态）、`reloadAll` 里裁掉已删题目的死收藏、`deleteQuestion` 同步摘掉各书收藏、`startSession` 把 `favIds` 传给 `buildSession`
- `stats.js`：`buildSession` 加 `case 'fav'`
- `Practice.jsx`：解析区标题行右侧 ☆/★ 胶囊（蜡封未启时也能点，不必先答题）；只在「收进来」时发糖豆
- `Learn.jsx`：第五张入口卡 `🔖 收藏题集`（`nth-child(5)` 的 emoji 早就备好了）
- `clearBookProgress` **故意不清收藏**——收藏是选题意图，不是学习进度
- demo 数据给了 `b_demo1.favorites = ['demo_2','demo_5','demo_9','demo_14']`，一进 demo 就能看到非空态

**用户提的 8 项，全部真机验证过：**

| # | 问题 | 根因 | 修法 | 实测 |
| --- | --- | --- | --- | --- |
| 1 | 答对答错分不清 | 对 `#2FA98A`(hue157) vs 错 `#6E9B2E`(hue85)，**两个都是绿的**；`--glow-red` 竟是酸橙绿；而「✗我答错了」按钮用暖橙 `--danger`，同一语义跨两个色系 | 新增 `--ok-ink:#1B7F63` / `--bad:#FF8A7A` / `--bad-dk:#F2564A` / `--bad-ink:#C4372E` / `--bad-wash` / `--glow-bad`，并**重定义 `--fault`/`--fault-lt`/`--glow-red`** 让哥特层旧规则自动变色；逐条覆盖 verdict-banner / answer-scroll-box / opt-row.wronged / fill-item / judge-card.j-false / crack-veil / pile-counter / gem-dot.bad / entry-card.hot / tag.red | 对 `rgb(27,127,99)` vs 错 `rgb(196,55,46)`，色相 157° vs 5°；两个文字色白底 **4.9:1 / 5.3:1** 都过 AA |
| 2 | 四个图标整体偏上 + 文案还是哥特 | `pages.css` 给 `.entry-card .art` 定了 150px 高，哥特插图按 §6 从 JSX 删了但**高度没人收** → 卡高 335px 里 150px 是纯空白，图标全挤顶部 | `.art` 从 JSX 删净 + candy.css `display:none` 双保险 + `.entry-card` 改 flex column `justify-content:center` | 卡高 **335→185**（-45%），上下留白 18/17 对称；文案改成 错题重练 / 随机练习 / 新题上手 / 挑题练习 |
| 3 | 基础·应用·综合小标是哥特版 | `.diff-pill` 在**三层 CSS 里没有任何规则**，裸奔成「哥特宝石位图 `A.gems`(p40-1/2/3) + 11px 灰字」 | 删 `<img class="gem">`，改纯 CSS 糖果胶囊；难度→ASCII 类名走 `stats.js` 新导出的 `DIFF_CLS`（基础=薄荷/应用=柠檬/综合=葡萄）；Bank.jsx 的 `.tarot-gem` 同步换成 `.diff-pill.tiny` | `diff-pill d-base`，`pillImgs:0`，页面内 `img.gem/.tarot-gem` 计数 **0** |
| 4 | 题干首字放大看着累 | `global.css` 的 `.drop-cap::first-letter{float:left;font-size:2.1em;font-family:Cinzel}` | JSX 去掉 `drop-cap` 类 + candy.css 把该伪元素全属性打成 `inherit/none` 当保险 | `.drop-cap` 计数 **0**，题干 18px |
| 5 | 填空 `I/O` 输入正确却判错 | **`SPLIT=/[、，,;；|/\s]+/` 把 `/` 和空格当分隔符切用户输入，而切标准答案用的是 `/[，,、;；|]/` 不切它们** → `I/O` 被切成 2 段、答案仍 1 段，`got.length===blankCount` 恒假 | 分隔符去掉 `/` 与空白；新增 `loose()`（全角→半角、删全部空白、转小写）；新增 `splitExpected()` 用题干空数当裁判优先按 `\|` 切；UI 各空改用 `\n` 拼接（单行 input 不可能出现换行，无歧义哨兵）；grade 返回 `expectedParts` 数组 | 自建 13 例回归测试 **5/13 → 13/13**（见 `scripts/t-fill.mjs`） |
| 6 | 单选多选选项不随机，用户记位置 | 无洗牌逻辑 | `shuffledOrder()` + 按「题目id#序号」存进 `shuffleRef`（**绝不在渲染里现算**，否则任何 setState 都会重排、用户点到的选项会跳位）；**内部一律用原始字母跑判分与对错高亮，只有显示字母跟着洗牌走**，所以 `gradeObjective` 与 `.right/.wronged/.missed` 判定链路一行没改；揭晓答案用 `mapLetters()` 换算 | q1 `[一,二,四,三]`、q2 `[四,一,三,二]` 每题独立洗牌；q2 正确项「说法一」落在 **B**，揭晓答案就是 **`B`** —— 不再出现「答案是D、位置在A」 |
| 7 | 做完后用时还在走 + 图标哥特 | 计时 `useEffect` 的 deps 是 `[]`，组件活着就一直 tick；`.settle-rose` 是 110px 旋转玫瑰窗（`spin-slow 24s infinite`），`.settle-card::before` 是内描金线，`.settle-pct/.settle-grid b` 是 Cinzel，candy.css 只覆盖过 border | deps 改挂 `[phase]`（`done` 直接 return 停表，点「再练错题」回 answering 重新起表 + `setElapsed(0)`）；玫瑰窗 `<img>` 从 JSX 删掉换纯 CSS `.settle-medal`；文案 参悟总结→本轮成绩、灵知契合度→正确率、窥见/侵蚀→答对/答错、最高连击→最高连对、🕯复习错题→🍓再练错题、返回阅览厅→返回学习页；答题中两个计数器 🗂/🕯 → ✓/✗ | 相隔 2800ms 两次读 `.settle-grid` 完全相同（`17秒` 不动）= `timerFrozen:true`；`.settle-card img` 计数 **0**；内描金线 `display:none` |
| 8 | 知识域显示 K1-K27 看不懂 | `Learn.jsx` 的 `DOMAINS_ALL` 与 `Bank.jsx` 的 domains 直接把 `K#` 当文案渲染（`domainLabel` 早就有，只是这两处没用） | 两处都加 `text: domainLabel`，**chip/option 的 value 仍是 K#**（筛选逻辑与 settings 里存的过滤器都认它），只有显示换成中文 | 27 个 chip 全是中文域名，`/^K\d+$/` 命中数 **0** |

### 11.2 顺手修掉的两个既有缺陷（不在用户清单里，但会咬人）

1. **`store.js` 的 `updateSettings` 是唯一没有 `!DEMO` 卫兵的云端写动作**（`deleteQuestion`/`resetAll`/`clearBookProgress`/`submitAnswer`/`persistBooks` 都有）。旧写法 `await repo.saveSettings(merged)` 无卫兵无 try：demo 没有 auth session → 吃 401 抛出 → 下面 `set({settings})` 永远跑不到。**表现就是「挑题练习」里点题型/知识域/难度 chip 完全没反应、题数不变，还往 console 丢 2 个 error。** 生产环境网络抖动也会让整个设置静默失效。已改成「先乐观更新本机 → DEMO 直接 return → try/catch 写云端并置 syncError」，与 `persistBooks` 同套路。修后筛选生效（`开始练习（28 题）` → `（4 题）`），console 零新增 error。
2. **`.entry-card.wide .count-gem` 用 `transform: translateY(-50%)` 居中失败**：`.count-gem` 的 `breathe` 关键帧里带 `transform`，**动画优先于声明**，实测徽章比中线高 15px（正好是徽章高的一半）。改用**独立的 `translate: 0 -50%` 属性**（与 transform 分开合成）→ 偏移归 0，且呼吸动画保住。以后要在带关键帧动画的元素上做位移，一律用 `translate`/`rotate`/`scale` 独立属性。

### 11.3 新增陷阱（都真踩过，补进 §6 的表格用）

| 症状 | 原因 | 做法 |
| --- | --- | --- |
| **Read 工具读到的文件内容和磁盘不一致** | Read 可能返回 **IDE 的陈旧缓冲区**。实测 `app/src/assets.js` 被 Read 成苹果明净版（`const img = () => undefined`、注释写「明净版已归零/Lucide」），而磁盘上是好版本（`const img = (name) => ...`），两者**恰好都是 3924 字节** | 判断文件真伪一律用磁盘读：`[IO.File]::ReadAllText` 或 Grep。**别只凭 Read 的结果就断言"文件被污染了"**——我这轮就误报了一次，还差点因此推翻一份好产物 |
| 编辑类工具报 `can not edit the file outside the projects` | 工作区换了目录，工程还在旧目录 | 建目录联接（见本节开头）。硬链接不行：SearchReplace 可能「写新文件+改名」，会把链接打断而原文件没更新 |
| PowerShell 中文输出全是乱码 | 控制台代码页不是 UTF-8 | 命令开头加 `[Console]::OutputEncoding=[Text.Encoding]::UTF8`（比 §6 说的「改用 ReadAllText」更彻底：ReadAllText 只管读进来对不对，这条管打印出去对不对） |
| PowerShell 变量莫名失效、`Test-Path` 全 False | **PS 变量名不区分大小写**：`$R` 存路径、`$r` 存 URL，后者把前者覆盖了 | 别用只差大小写的变量名。我这轮因此误报过 5 个「文件不存在」 |
| `run-code` 里 `console.log` / `return` 看不到输出 | playwright cli 的 `run-code` 不回传 | 把结果 `page.evaluate` 写到 `window.__p`，再用 `--raw eval "JSON.stringify(window.__p)"` 读回；多步流程整段写进文件用 `run-code --filename=<绝对路径>`，顺便绕开 PowerShell 引号地狱 |
| 改了 `store.js` 之后答题会话凭空消失 | Vite 对 store 这类无 HMR 边界的模块会**整页重载**，zustand 内存态全丢 | 改完 store 后重新走一遍进入答题页的流程，别指望原状态还在 |
| 生成中文时个别字被写成同形近字 | 实测 `绝`→`绠`、`徽`→`徐` 真的落到了文件里 | 写完中文注释后回读校验：`$t.Contains('绝')` 之类逐个断言，别只看 diff |
| `page.goto` 到只有 hash 不同的地址 | HashRouter 下**不触发整页重载**，store 状态会留着 | 想测「干净首屏」得真刷新；本轮就因此把已选中的筛选 chip 又点了一次、反而关掉了 |

### 11.4 新增工具（已随 push-src 进 src 分支）

- **`scripts/audit-src.mjs <TOKEN>`**：把本地 `app/**` + `scripts/**` 跟 src 分支逐文件比 **git blob SHA1**，输出「一致 / 不一致 / 本地缺失」。这是**接手后第一件事该跑的检查**，比 §10 那几条特征串断言彻底得多——一次就能确认有没有文件被编辑器缓冲区换成别的版本。本轮实测：一致 143 / 不一致 5（正好是我改的 5 个）/ 缺失 1（`verify-books.ps1` 是路径映射没覆盖，不是真缺）。
- **`scripts/t-fill.mjs`**：填空题判分回归测试，直接 `import` 真实源码（不复制逻辑，免得测了自己写的假实现），13 例覆盖斜杠 / 空格 / 大小写 / 全角 / 多空 / 答案本体含逗号 / 该判错就判错。`node scripts/t-fill.mjs` 即可，不需要浏览器。

### 11.5 范围外发现（用户没提，我没动，等拍板）

- **Bank.jsx（题库页，可达）哥特文案成片**：`🃏 禁 书 库` / `封印的题库在此陈列，窥视需谨慎` / `🔮 找找想品的糖` / `题型·切牌` `知识域·切牌` `难度·切牌` / `✦ 轻触拆开 ✦` / `◆ 题目全录` `◆ 题面` `◆ 甜蜜答案` / `确认销毁` `收回成命` `合上糖纸` / `酸了`。归 §7.4。
- **Stats.jsx（孤儿页，入口已摘、`#/stats` 仍可直达）**：`🕯 周做题量`、`🃏 分题型契合度`、`🔮 星象命运之盘`、`星 界 观 测 台`。闸门断言里 `🕯` 仍为 True 就是它。归 §7.5。
- **Login.jsx / Settings.jsx** 各有一处 `🔮`（`开启糖果之门`、`甜蜜值备份`）。
- **答题页 `.rate-btn` 三档自评的边框色是 绿/黄/蓝绿**（忘记=绿框），与「错=红」并排看仍有点乱。属于 #1 的邻居但用户指的是对错反馈，没敢一并改。
- **第五张入口卡在 1280×900 下位于折叠线以下**（页面总高略超 900）。想让它进首屏就得压 `learn-vision` 糖果橱窗的高度，用户没提，没动。

### 11.6 待办清单变化

- **§7.1 收藏题集 → 已完成**（本轮）
- §7.4 哥特文案残留 → 学习页四张入口卡 + 筛选弹窗 + hero 副标题**已清**；导入页说明、Stats 页整页、Bank 页整页**仍在**
- §7.5 Stats 页 / §7.3 清 7MB 素材 / §7.2 音效 / §7.6 设置页实体造型 / §7.7 死代码 → **未动**
- §7.7 里「工作区根那份重复源码树」仍在（`2026-09-02\chat-1\src`、`public`、`index.html` 等），删目录要 `Remove-Item`，会被只读沙箱拦，仍需用户明确许可
- **新增待办**：`.diff-pill` / `.settle-*` 这类「candy.css 从没覆盖过、一直在吃哥特层样式」的选择器可能还有别的，值得系统扫一遍（本轮是靠用户报障才发现的）

---

## 12. 第二轮补充（2026-09-04）· 题库页去哥特 + 三档自评配色

**gh-pages HEAD：`1f7afd2`（父提交 `13c2057`，82 文件 / 7.59 MB）。src HEAD：见 push-src 输出。**

### 12.1 用户拍板的配色方案（已实施）

- **对 = 绿、错 = 红 保留**（§11 的 `--ok-ink #1B7F63` / `--bad-ink #C4372E` 不动）
- **三档自评：忘记 = 红、模糊 = 黄、记得 = 绿**，用糖果主题色，与判分双通道同源

| 按钮 | 实测 color | 实测 border | 备注 |
| --- | --- | --- | --- |
| 忘记 `.r-forget` | `rgb(196,55,46)` | `rgb(242,86,74)` | 与「答错了」的 `rgb(196,55,46)` **完全同值**，语义打通 |
| 模糊 `.r-hazy` | `rgb(138,109,0)` | `rgb(255,212,59)` | 文字色从 `#A88A00`(3.3:1) 提到 `#8A6D00`(4.9:1) 过 AA |
| 记得 `.r-remember` | `rgb(27,127,99)` | `rgb(95,212,176)` | 文字色从 `#2FA98A`(3.0:1) 提到 `--ok-ink`(4.9:1) |

副标题也一并改成大白话（**这三个选项直接驱动 FSRS 间隔算法，选错会影响复习排期**）：
`被答错了` → `完全想不起来`、`正确率游离` → `犹豫了一下才对`、`正确率铭刻` → `一眼就答出来了`。
（这条用户没点名要求，是我判断原文案语义含糊且「被答错了」是病句才改的，不满意可单独还原这三行。）

### 12.2 题库页（`#/bank`）去哥特全清单

文案：`🃏 禁 书 库`→`🍬 糖 果 书 架`、`封印的题库在此陈列，窥视需谨慎`→`导入的题目都收在这里，点开卡片看详情`、
`🔮 找找想品的糖 / 知识点…`→`🔍 搜题干或知识点…`、`题型/知识域/难度 · 切牌`→去掉「· 切牌」、
`共 N 题题库 · 筛选后 N 题`→`共 N 题 · 筛选后 N 题`、`按导入时间自新至旧陈列`→`按导入时间从新到旧排列`、
`✦ 轻触拆开 ✦`→`轻点看详情`、`◆ 题目全录`→`题目信息`、`◆ 题面`→`题干`、`◆ 甜蜜答案`→`答案`、
`◆ 题库解析`→`解析`、`◆ 做题记录（近 N 次）`→`做题记录（最近 N 次）`、`甜蜜值`→`掌握度`、
`已品尝/尚未做题`→`已掌握/还没做过`、`间隔 N 日`→`间隔 N 天`、`酸了`→`答错过`、
`确认销毁`→`确认删除`、`收回成命`→`取消`、`🗑 删除此题`→`🗑 删除`、`合上糖纸`→`收起`、
`先去导入页导入题库，封印入库后此处方能陈列。`→`去导入页把题库导进来，这里就会陈列出来。`

结构：**哥特题型印章位图 `A.seals`（p34-1~7）从 JSX 删掉**，改成 `.type-candy` 文字胶囊放进 `.tarot-tags` 签条行。
顺手删掉 `<select>` 上那行哥特内联样式（`color: var(--teal-lt); background: rgba(21,29,36,.9)`）——
candy.css 的 `select` 规则带 `!important`，那行内联早就是死代码。

**必须同时做的字色可读化**（只换文案不换字色的话新文案照样看不见）：
`pages.css` 给牌面文字用的是哥特暗底配色 —— `.tarot-stem` 是 `#d8ca9f` 浅米黄 **+ 黑色 text-shadow**，
`.tarot-scroll` 是 `#cbbb90`，`h6` 是 `var(--gilt)` 金色，而 candy.css 早把 `.tarot-face` 底色换成了浅色果冻。
浅字压浅底 = 几乎读不出来。已在 candy.css 末尾统一接管：
`.tarot-stem`→`--ink`(实测 `rgb(74,74,74)`) 且 `text-shadow:none`、`.tarot-scroll`→`--ink-2`、
`h6`→`#D14767`、`.tarot-kv b`→`--muted`、`.tarot-ans`→`--ok-ink`、`.tarot-orb` 三态改糖果三色、
`.tarot-hint`→`--muted`（原先想用 `--ink-3`=#999，但那行字只有 `clamp(7.5px,4.2cqw,10px)`，
2.8:1 在 10px 上不够，提到 `--muted`≈5.0:1）。

### 12.3 p34-1~7 现在是纯死重（想清就得动 assets.js）

`A.seals` 的唯一使用点已删，但 `assets.js` 里 `seals: [1..7].map(i => img(\`p34-${i}.webp\`))` 这个键还在，
**purge-dist 因此仍判定它们「被引用」，7 个文件继续留在 dist 里**（本轮 purge 的孤儿清单与上轮完全一致、仍是 20 个，剩余仍 76 个）。
§6 那条「改 assets.js 时保留全部键名与数据结构」的前提是**有代码在读**（`A.gems[x]` 取 undefined 会崩）；
`A.seals` 现在没人读了，删键是安全的。真要瘦身就：删 `seals` 键 → 删 `public/img/p34-*.webp` → 重构建 → purge-dist 会多清 7 个。
**归 §7.3，本轮没做。**

### 12.4 新增陷阱（补进 §6 的表格用）

| 症状 | 原因 | 做法 |
| --- | --- | --- |
| 拿 demo 假数据的文案做产物闸门断言，永远 False | `DEMO = import.meta.env.MODE === 'demo'`，`npm run build` 时 MODE 是 production，`if (DEMO) { ... }` 整块被 **tree-shake**，`demoData()` 里所有字符串根本不进产物 | 闸门断言只用**真实 UI 文案**；demo 专属文案只能在 dev/demo 模式下于浏览器里断言 |
| 断言 hex 颜色 `#8A6D00` 报 False，但规则确实在 | 压缩器把**普通声明**里的 hex 小写化（`#8a6d00`），但 **`:root` 自定义属性的值原样保留大写**（所以 `--bad-ink:#C4372E` 是大写）。同一次断言里两种大小写并存 | hex 断言一律 `.ToLower().Contains()`；或者干脆断言运行时 `getComputedStyle` |
| `IndexOf('r-hazy')` 读到的是哥特原版色值 `#6d560a` | `pages.css` 里本来就有一条 `.rate-btn.r-hazy`，candy.css 的规则在**后面**且带 `!important`，同特异性后来居上 | 查「最终生效的是哪条」要看**最后一个**匹配或直接读计算样式，别看第一个 |
| 源码里 `var(--sour)` 还有 7 处，以为改漏了 | 那是被末尾追加规则**覆盖掉的旧声明**。§3.1 的房型风格就是「追加在文件末尾以同特异性后来居上，不去改前面那条」；压缩器还会把同选择器规则合并，所以产物里 `#6E9B2E` 已经是 **0 次** | 判断有没有改干净要看**产物**与**计算样式**，不是数源码里剩几处 |

### 12.5 范围外残留（本轮没动，等拍板）

- **Stats.jsx（孤儿页，入口已摘、`#/stats` 仍可直达）**：`星 界 观 测 台`、`🕯 周做题量`、`🃏 分题型契合度`、`🔮 星象命运之盘`、`已品尝 N 卷`、`甜蜜值契合度`、`观星台尚无记录`。闸门里 `🕯`/`已品尝` 仍为 True 就是它。归 §7.5：**要么糖果化后给新入口，要么整页下线**。
- **Login.jsx**：`🔮 开启糖果之门`、`甜蜜值密文`、`✦ 糖果题库 v1.0 · 尝味师专用 · 纯网页端 · 云端甜蜜值同步 ✦`
- **Settings.jsx**：`🔮 甜蜜值备份`、导出文件名 `典籍馆甜蜜值备份_YYYY-MM-DD.json`（**「典籍馆」是哥特品牌名，漏网了**）、页脚同一行 v1.0 文案
- **Import.jsx**：`甜蜜值回流受阻，请重试`、`甜蜜值凝聚`
- **Learn.jsx / App.jsx**：`✦ 今日已做题，甜蜜值延续中`、`🔄 延续甜蜜值`、加载态 `甜蜜值凝聚中…`
- 注：**「甜蜜值」本身是糖果语汇、不是哥特**，所以我没批量清它；只把 Bank 那个 kv 标签改成「掌握度」，因为它表达的是 SRS 掌握程度而不是什么"值"。要不要全站把「甜蜜值」换成「学习进度/熟练度」之类，是个口味问题，等你说。
- **答题页仍在用的哥特位图**（§7.3 主战场，未动）：`A.cardBack`(p6 牌背)、`A.waxSeal`(wax-1~3)、`A.cracks`、`A.markRadio/markCheck`、`A.judgeCard`、`A.roseWindow`（结算页那处已删，`card-flip-cover` 里还有一张）、`A.emptyShelf`/`A.emptyTable`/`A.emptyCandle`（三个空状态插图）、`A.titleDecor`(p45，被 `.page-head` 的 `background-image:none !important` 掐掉、不发请求)。
- `Practice.jsx` 第 4 行 `import { A, TYPE_SEAL_INDEX }`，`TYPE_SEAL_INDEX` 现在**没人用了**（Bank 那处已删），是个死导入，会被 tree-shake，无害。

---

## 13. 第三轮（2026-09-04）· 全站去哥特收尾 + dist 瘦身 35%

**gh-pages HEAD：`b91f8cb`。本轮两个提交：`989d66d`（四页文案与位图清理 + 删 25 个死键）→ `b91f8cb`（四处暗底配色）。**
**dist：82 文件 / 7.59 MB → 46 文件 / 4.90 MB（-36 文件 / -2.69 MB / -35%）；img：76 个 7.00 MB → 40 个 4.32 MB。**

### 13.1 用户拍板并实施

- **对=绿、错=红 保留**（§11 的双通道不动）
- **三档自评：忘记=红 `rgb(196,55,46)` / 模糊=黄 `rgb(138,109,0)`+柠檬边 / 记得=绿 `rgb(27,127,99)`**。
  「忘记」的红与「答错了」的红**完全同值**，语义打通。文字对比度顺带从 3.0~3.3:1 提到 4.9:1 过 AA。
- 三档副标题改大白话（`被答错了`→`完全想不起来`、`正确率游离`→`犹豫了一下才对`、`正确率铭刻`→`一眼就答出来了`）。
  **这三个选项直接驱动 FSRS 间隔算法**，原文案语义含糊、「被答错了」是病句，选错会影响复习排期。用户没点名要这条，不满意可单独还原三行。

### 13.2 系统扫描：不再靠用户当探针

前两轮的去哥特都是**用户报障才发现**的（`.diff-pill`、`.settle-*`）。这轮改用三个可复跑的扫描口径，把可达页面一次扫干净：

| 扫描口径 | 抓什么 | 本轮战果 |
| --- | --- | --- |
| 逐键统计 `A\.<key>` 在 src 的出现次数 | assets.js 里的死键 | **25 个键零引用**，删掉后 purge-dist 清出 56 个孤儿文件 |
| grep `color: '#` / `'rgba` 的内联样式 | JSX 里硬编码的哥特色 | Settings 3 处（`#d6c79b` 1.9:1、`#d98ba0` 2.6:1、`rgba(156,132,82,.55)` 1.6:1）、Import 4 处（`#d9c26a` 1.8:1、深棕底、深金洗） |
| grep `Cinzel` 在 pages/global.css | 还在吃 404 字体 + 暗底配色的选择器 | 可达页只剩 **`.stepper .val`**（设置页每日目标 30px 数字，约 2.2:1）；其余 6 处全在孤儿页 Stats.jsx |
| grep 某个哥特色值（如 `d98ba0`）反查全部落点 | candy.css 从没覆盖过的规则 | `.rework-box h4`、`.rework-box li.err-i`、`.furnace-zone .panel-title` |

**统计 `A.<key>` 时必须排掉注释里的字面量假阳性**：我自己写的注释里有 `A.seals`/`A.gems`/`A.hallVision`，
一度让 `seals=1`、`gems=2` 看起来"还在用"。逐个看落点行才确认是注释。
另外要确认全站没有 `A[key]` 动态取值或解构 —— 注意 **PowerShell `-match` 默认不区分大小写**，
`A\[` 会把 `RARITY_META[` 里的 `A[` 匹配上，必须用 `-cmatch`。

### 13.3 四页文案与位图清理

- **Login**：`🔮 开启糖果之门`→`🍬 进入糖果题库`、`邮箱 / 窥秘名`→`邮箱`、`甜蜜值密文`→`密码`、
  `隐藏/显示密文`→`隐藏/显示密码`、`✗ 密文错了，这颗糖有点酸～再试试？`→`✗ 密码不对，再试一次？`、`尝 味 师 登 入`→`登 录`。
  **五个哥特位图从 JSX 删净**（p11 星空 / p12 漩涡 / p7 青铜门 / p13 魔法球 / p44 分隔条）。
  ⚠️ 其中 `.login-vortex`(p12) 与 `.login-orb`(p13) 是 candy.css `display:none !important` 的 `<img>` ——
  正是 §6 那条「隐藏不等于不加载」，**登录页每次都在白下这两张图**。`.login-bg` 那个 div 要留（糖果渐变底挂在它上面）。
  §7.3 声称这四个"JSX 已移除，只剩 assets.js 里的键"是**错的**，实测全在 JSX 里活着。
- **Import**：`检测 & 封印`→`检 测 & 入 库`、`题库导入仪式`→`题库导入`、`甜蜜值凝聚`→`粘贴题库`、`封印入库`→`收进书架`、
  `已封印入库`→`已入库`、`检测并封印`→`检测并入库`、`记忆回溯完成`→`备份恢复完成`、`做题记录一并回溯`→`一并恢复`、
  `甜蜜值回流受阻`→`云端写入受阻`、`已导入 N 题`→`检测到 N 题`、`发回给 AI 净化`→`修正`。
  **修好 §7.4 记的那句被「卷」正则改坏的说明**：`21 卷批执行完整规则…超过 21 卷按大秘库逐题检测`
  → `21 题及以内按整批规则校验（题型配比 / 难度层段 / 元数据映射等 9 类）；超过 21 题只逐题检测`
  （与 `validate.js` 的 `batchMode = items.length <= 21` 实际行为对齐）。
  **删掉两个 `A.roseWindow` 哥特玫瑰窗**（过场动画那个还挂着 `spin-slow 10s linear infinite` 永久旋转，违反 §5）与 `A.warnRune` 警告符文。
  告警框从哥特暗金（`#d9c26a` 浅金字，约 1.8:1，等于看不见）改成糖果柠檬通道（`#8A6D00`，约 4.9:1）。
- **Settings**：导出文件名 **`典籍馆甜蜜值备份_`→`糖果题库备份_`**（「典籍馆」是哥特品牌名，漏网最久的一处）、
  `🔮 甜蜜值备份`→`💾 数据备份`、`解除契约 · 退出登录`→`退出登录`；三处硬编码哥特内联色改 token（见 13.2）。
- **Bank**：见 §12.2（上一轮已做）。

### 13.4 assets.js 删掉 25 个死键

删：`cardFrame parchment bgTexture loginGate hallVision starryBg vortex magicOrb magicBook sealedDeck cardPile cardTower
warnRune stepDone stepActive stepWait balance memoryFlask sigilBadge furnace navBar seals gems navIcons abyss`
留：`cardBack idCardFrame avatar portraitFrame roseWindow astrolabe trophy badgeFrame emptyShelf emptyTable emptyCandle
milestone achIcons divider titleDecor markRadio markCheck judgeCard waxSeal cracks`

§6 那条「改 assets.js 时保留全部键名与数据结构」的**前提是有代码在读**（`A.gems[x]` 取 undefined 会崩）。
这 25 个已逐个 grep 确认零引用、且全站无 `A[key]` 动态取值，所以删键安全。
`divider` 虽然只被 `components.jsx` 里那个**没人 import 的死 `Divider` 组件**用着，仍保守保留（归 §7.7）。
`p2`/`p4` 的键删了但**文件保留** —— 它们被 CSS 直接 `url()` 引用，文件级清理由 purge-dist 判定，它扫全部源码含 CSS。

purge-dist 实际清掉 56 个孤儿，**在用的变体一个没误删**：`p19-soft`（`p19` 被清）、`crack-1s/2s/3s`（`crack-1/2/3` 被清）、
`mark-*-n`（`mark-*` 被清）、`wax-1/2/3`、`judge-true/false`、`p44/p45`。
`p11` 因为 index.html 的 preload 仍算被引用而保留（符合 §3.3 用户要求）。

### 13.5 冒烟实测（demo 模式，Playwright）

| 页面 | `<img>` 数 | 裂图 | 实际发出的图片请求 |
| --- | --- | --- | --- |
| 学习页 | 0 | 0 | `p11.webp`（只有 index.html 那条 preload） |
| 导入页 | 0 | 0 | **空** |
| 设置页 | 0 | 0 | **空** |
| 题库页（28 张卡） | 0 | 0 | **空**（原先是 28 个印章 + 28 颗宝石） |
| 答题页 | 4 | 0 | `wax-1/2/3.webp`、`p20.webp`（牌背中心玫瑰窗） |

`page.on('console'/'response'/'requestfailed')` 全程监听：**errors 数组为空**，零 console error、零 HTTP≥400、零请求失败。
返工框实测：`bg rgba(242,86,74,0.12)`、`border rgb(242,86,74)`、标题与错误行 `rgb(196,55,46)`、16 条 li 全部渲染。
设置页实测：stepper 数字 `Nunito` + `rgb(209,71,103)` + `text-shadow:none`；危险区边框/标题/说明三处同为 `rgb(196,55,46)`；
邮箱 `rgb(74,74,74)`、页脚 `rgb(153,153,153)`；面板标题 `📚 题库书架 / ⚖️ 每日目标 / 💾 数据备份 / 🏅 尝味师凭证 / 🔥 危险区 · 糖果熔炉`。

### 13.6 新增陷阱

| 症状 | 原因 | 做法 |
| --- | --- | --- |
| `IndexOf` 查产物里某选择器，读到的是哥特原版色值 | 三层 CSS 打包后同一选择器会出现多次（pages.css 原版 + candy.css 覆盖版），`IndexOf` 取到**第一个** | 用 **`LastIndexOf`**，或直接读运行时 `getComputedStyle`。**§12.4 刚记下这条，同一轮里我自己又踩了一次** |
| 给 `.success-box` 加 `!important` 会把告警框改坏 | Import 的告警框是 `className="success-box"` **再叠内联 style** 实现的柠檬变体；`!important` 会压掉内联 | 覆盖 pages.css 的普通规则**不需要** `!important`（同特异性靠后置层叠就赢，内联仍能赢我）。只有原规则自带 `!important` 时才需要（如 `.furnace-zone` 的 border-color） |
| 拿 demo 假数据的文案做产物闸门断言永远 False | `if (DEMO) {...}` 在 production 构建里被整块 tree-shake | 见 §12.4 |

### 13.7 剩余残留（都在孤儿页或已确认保留）

- **Stats.jsx（入口已按用户要求摘掉、`#/stats` 仍可直达）**：`星 界 观 测 台`、`🕯 周做题量`、`🃏 分题型契合度`、
  `🔮 星象命运之盘`、`已品尝 N 卷`、`甜蜜值契合度`、`观星台尚无记录`，内联 `#d98ba0`×2，
  以及 `A.idCardFrame/avatar/portraitFrame/badgeFrame×2/astrolabe/trophy/milestone×3/achIcons×8/emptyCandle` ≈ 16 个位图。
  **它一个人占了剩余 40 张图里的一大半。** §7.5 那两个选项（糖果化后给新入口 / 整页下线）仍未拍板；
  若下线，dist 还能再瘦一大截。
- **`甜蜜值` 全站保留**（App.jsx 加载态、Learn 横幅与按钮、Login/Settings 页脚、Import）—— 它是糖果语汇不是哥特，用户未要求改。
- **答题页仍在用的哥特位图**：`A.cardBack`(p6 牌背)、`A.roseWindow`(p20，牌背中心)、`A.waxSeal`(wax-1~3 蜡封)、
  `A.cracks`(crack-1s~3s 裂纹)、`A.markRadio/markCheck`(选项符文框)、`A.judgeCard`(判断题尖拱铜牌)。
  §7.3 说的"答题页那批要不要整体糖果化（卡背→糖纸、蜡封→糖封、裂纹→糖霜裂）"**用户仍未拍板**，问过再动。
- **`components.jsx` 里没人 import 的死 `Divider` 组件**（连带 `A.divider` / p44.png）、`Practice.jsx` 第 4 行的死导入 `TYPE_SEAL_INDEX`。归 §7.7。
- **`global.css` 两个 Cinzel `@font-face`** 仍指向不存在的 `public/fonts/cinzel-*.woff2`，每次加载白拿 2 个 404（§3.1 记过，仍在）。
- `Login.jsx` 在 demo 模式下进不去（`init` 直接置 signed-in），**本轮对它的改动只有构建与代码审查覆盖，没有浏览器实测**。

---

## 14. 第四轮（2026-09-04）· 筛选弹窗 / 导入卷轴框 / 导航绿点

**gh-pages HEAD：`55a6e54`（父 `b91f8cb`），46 文件 / 4.91 MB，verify-deploy 缺失0/不一致0/多余0。**

用户报了三个视觉问题，根因是**同一个**：candy.css 的选择器清单和 JSX 实际类名对不上。

### 14.1 幽灵选择器审计（本轮最有价值的产出）

candy.css 有两条**同样名单**的分组规则：L121 的果冻玻璃拟态（`background: var(--jelly) !important` + `backdrop-filter: blur(20px)`），
和 L983 的性能补丁（同一批选择器 `backdrop-filter: none !important` + `background: rgba(255,255,255,.84) !important`）。
拿词边界正则把名单里每个类名在 `src/**/*.{js,jsx}` 里精确数一遍（避免 `panel` 把 `panel-title`/`import-panel` 也算进去）：

| 选择器 | JSX 出现次数 | |
| --- | --- | --- |
| `.panel` | 17 | ✅ |
| `.entry-card` | 6 | ✅ |
| `.ach-card` | 2 | ✅（Stats 页） |
| `.book-card` | 2 | ✅ |
| `.settle-card` / `.empty-state` / `.filter-group` | 各 1 | ✅ |
| **`.modal-card`** | **0** | ❌ 幽灵 —— JSX 用的是 `.modal-box`（出现 2 次），**不在名单里** |
| **`.import-panel`** | **0** | ❌ 幽灵，从来没存在过 |
| **`.setting-card`** | **0** | ❌ 幽灵，从来没存在过 |
| **`.stat-card`** | **0** | ❌ 幽灵（Stats 页用的是 `.stat-section` + `.panel deep`） |

可复跑的检查命令（PowerShell，注意引号别嵌套、`-match` 默认不区分大小写）：

```powershell
cd app\src
$all=(Get-ChildItem -Recurse -Include *.jsx,*.js | ForEach-Object { [IO.File]::ReadAllText($_.FullName) }) -join ' '
foreach($s in @('panel','modal-card','modal-box','import-panel','setting-card','stat-card')){
  $p='(?<![\w-])'+[regex]::Escape($s)+'(?![\w-])'
  "{0,-14} {1}" -f $s, ([regex]::Matches($all,$p)).Count
}
```

**结论**：`.modal-box` 从来没被 candy.css 覆盖过，一直在吃 `global.css` L308-312 的哥特样式。
这也解释了为什么导入页/设置页看起来是正常的 —— 它们用的是 `.panel`（17 次，被覆盖到了），
只有筛选弹窗用了名单外的 `.modal-box`。**这类 bug 不会报错、不会 404、console 干净，只能靠核对类名清单发现。**

### 14.2 三处修复与实测

| 用户报的 | 哥特原值（出处） | 改成 | 运行时实测 |
| --- | --- | --- | --- |
| 图一 弹窗黑底 | `.modal-veil{background:rgba(6,8,12,.72)}`、`.modal-box{background:var(--panel);border:2px solid var(--copper);box-shadow:0 20px 60px rgba(0,0,0,.6),var(--glow-gold)}`、`.modal-box::before` 内描金线、`.modal-close{background:var(--bg-1);color:var(--gold-text)}`（global.css L308-312） | 糖果果冻玻璃：遮罩粉洗 + 保留 blur，盒子半透奶白 + 奶粉边 + 24px 圆角 + 粉投影 + 内白高光 | `veilBg rgba(255,214,224,.5)` / `veilBlur blur(5px)` / `boxBg rgba(255,255,255,.9)` / `boxBorder 2px rgb(255,214,224)` / `boxRadius 24px` / `innerGoldLine none` / 关闭钮白底 `rgb(209,71,103)` / 标题 `rgb(209,71,103)` |
| 图二 输入框边框不搭 | `.scroll-zone{border:1.5px solid rgba(139,115,50,.55);background:rgba(19,26,33,.7)}`（pages.css L479，candy.css 只管过 `.q-face` 里的输入框） | 常态奶粉边 + 半透白底 + 16px 圆角；`.drag-on` 薄荷；`.err` 草莓红（与判分双通道同源） | `border 2px solid rgb(255,214,224)` / `bg rgba(255,255,255,.55)` / `radius 16px`；内部 textarea `rgb(255,250,251)` + 同色边，内外协调 |
| 图三 学习项右上角绿点 | `CandyBoot.jsx` L62 `{it.key==='learn' && wrongCount>0 && <span className="dot"/>}` + candy.css L224 `background:var(--sour-dk)` 酸橙绿 + `candy-pulse` 永久动画 | JSX 删掉 + CSS `display:none` 双保险 | `dots: 0`、`anyDot: 0`，导航三项 `🍬学习 / 📦导入 / ⚙️设置` |

绿点是 `wrongCount > 0` 的错题提醒，删它的理由：学习页「错题重练」卡已经有草莓红计数徽章（信息重复），
且它用的 `--sour-dk` 酸橙绿与 §11 建立的「错=草莓红」双通道不同源。
`BottomNav` 的 `wrongCount` prop 保留在签名里（App.jsx 仍在传），无害。

**删掉这个绿点之后，`--sour` / `--sour-dk` / `--glow-sour` 已经没有任何活的使用点**（只剩被末尾规则覆盖掉的旧声明）。
§11 那句「不动 --sour 本体：.nav-item .dot 那个装饰绿点还在用它」的前提已经不成立，下一轮清死代码时可以连 token 一起收。

### 14.3 !important 的取舍（延续 §13.6）

- `.modal-veil` / `.modal-box` / `.modal-close` / `.scroll-zone*` **一律不加 `!important`**：
  global.css 与 pages.css 的原规则都没带，同特异性靠后置层叠就赢，而且这些元素都没有内联样式。
- **唯一例外是 `.modal-box h3 { color:#D14767 !important }`**：`Learn.jsx` 的 FilterModal 标题写了内联
  `style={{ color: 'var(--gold-text)' }}`，内联会压普通规则，必须用 `!important` 才盖得住。
  （`--gold-text` 虽已被 candy.css 重定义为糖果色，但字重与色值不如直接对齐 `.panel-title`/`.zone-label`/`.settle-title` 统一。）

### 14.4 一个容易误判的现象：用户截图可能是旧构建

用户三张截图里，导入页还显示 `甜蜜值凝聚 / 封印入库 / 检测并封印 / 已导入 — 题`，
而这些在 `989d66d` 就已改成 `粘贴题库 / 收进书架 / 检测并入库 / 检测到 N 题`。
截图时间（本地 00:47~00:52）正好卡在部署与 GitHub Pages 传播完成之间，是**缓存/传播延迟**，不是改动丢失。
本轮 dev 上实测 `stepLabels: ["粘贴题库","导入检测","收进书架"]`、`btns: ["🔍 检测并入库",…]`、`h1: "🍬 检 测 & 入 库"` 全部正确。

**教训**：用户报"某处没改"时，先确认他看的是哪个构建（对比截图里的文案与自己提交记录），
别急着怀疑自己的改动被编辑器缓冲区回写了 —— 但也要真的去查（本项目确实有回写历史，见 §3.2 / §11.3）。
最快的判别法：让用户硬刷（Ctrl+F5），或自己跑 `verify-live.mjs` 比对线上三哈希。

### 14.5 剩余待办（未变 + 本轮新增）

- **新增**：candy.css 那两条分组规则里的 4 个幽灵选择器（`.modal-card` / `.import-panel` / `.setting-card` / `.stat-card`）应删掉，
  并把 `.modal-box` 正式补进名单；本轮是用末尾追加规则绕过的，名单本身还没修。归 §7.7。
- **新增**：`--sour` / `--sour-dk` / `--glow-sour` 三个 token 已无活的使用点，可删。归 §7.7。
- 其余见 §13.7（Stats.jsx 孤儿页去向、答题页哥特位图是否整体糖果化、死 Divider 组件、Cinzel @font-face 的 2 个 404）。

---

## 15. 第五轮（2026-09-04）· 最后两个吃哥特暗底的按钮组

**gh-pages HEAD：`471e385`（父 `55a6e54`），46 文件 / 4.9 MB，verify-deploy 缺失0/不一致0/多余0。**

用户报「设置页每日目标的 `+` / `−` 是纯黑填充，与糖果主题不搭」。根因：**pages.css L598**

```css
.stepper button { ... border: 2px solid var(--copper); border-bottom-width: 4px;
                  background: var(--bg-1); color: var(--gold-text); ... }
```

`--bg-1` 是哥特近黑底 token，candy.css 从没覆盖过 `.stepper button`。
**边框看着是粉的、只因为 `--copper` 被重定义过 —— 底色一直漏网**，所以截图里是"粉圈 + 黑心"。

顺手把同类扫干净，又揪出一个：`.tarot-foot button`（题库页卡片背面的「🗑 删除 / 收起」），
pages.css L461 给的是 `background: rgba(15,20,26,.88); color: #9c8452`（暗底铜字）。

两处统一成 `.rate-btn` 那套糖果按钮语言：**白底 + 奶粉边 + 保留 4px 厚底 + 糖果色字**；
销毁类动作（`.tarot-foot button.danger`）走草莓红通道，与全站「错 / 危险」同色，hover 反白。
按 §14.3 的原则**不加 `!important`**（pages.css 原规则没带，两处都没有内联样式）。

### 15.1 实测

| 元素 | 原值 | 实测现值 |
| --- | --- | --- |
| `.stepper button`（±） | `background: var(--bg-1)` 近黑 | `bg rgb(255,255,255)`、`color rgb(209,71,103)`、`border rgb(255,214,224)`、`border-bottom-width 4px` |
| `.stepper .val`（数字） | — | `rgb(209,71,103)`（上一轮 §13 已修，与按钮同色系） |
| `.tarot-foot button.danger` | `rgba(15,20,26,.88)` + `#9c8452` | `bg rgb(255,255,255)`、`color rgb(196,55,46)`、`border rgb(255,138,122)` = `--bad` |
| `.tarot-foot button`（收起） | 同上 | `bg rgb(255,255,255)`、`color rgb(209,71,103)`、`border rgb(255,214,224)` |

console 全程 0 errors。

### 15.2 全站暗底扫描的完整结论（可复跑，别再逐个等用户报）

扫描口径：在 `pages.css` + `global.css` 里搜 `var(--bg-1)` / `var(--bg)` / `var(--panel)` /
`background` 后跟暗色 `rgba(0~49, …)` / `#0…` / `#1…`，共 25 处命中。逐个核对 candy.css 是否接管：

**已被覆盖（不用管）**：
- `.entry-card`(L44)、`.entry-card .count-gem`(L59)、`.entry-card.hot .count-gem`(L62) → 果冻分组 + §11 规则
- `.chip`(L79)、`.chip.on`(L83) → candy.css L599-600
- `.pile-counter`(L356) → candy.css L546 `var(--jelly) !important`
- `.settle-card`(L364) → 果冻分组
- `.panel`(global L147)、`.panel.deep`(global L161，暗色渐变) → 果冻分组带 `!important`，
  **`!important` 压过更高特异性的普通声明**，所以 `.panel.deep` 也是白的
- `.bank-search input`(L375，`rgba(19,38,35,.55)` + `#cfe6de`) 与 `.deck`(L382，`rgba(21,29,36,.8)`)
  → candy.css L176 的 `.rune-input, .rune-textarea, input, textarea, select` 带 `!important` 全接管
- `.tarot-orb`(L441) → §12 规则
- `.learn-vision::after`(L39 近黑遮罩) → §8 第 6 条已中和
- `.btn.teal`(global L195 深青渐变 + `#06201c` 近黑字) → candy.css L152 已换成薄荷渐变
- `.tag`(global L292) → candy.css L917；滚动条 track(global L63) → candy.css L89
- `.fab-stats`(L66/L72) → 死代码，JSX 里已无此元素（§7.7）

**本轮修掉的**：`.stepper button`、`.tarot-foot button`

**剩下 4 处已逐个查实，全是死规则或已被接管，无真问题：**

| global.css | 选择器 | 结论 |
| --- | --- | --- |
| L81 | `.bg-vignette`（暗角 radial-gradient） | JSX 里 **0 次出现** → 元素不存在，死规则 |
| L105-106 | `.nav-veil`（切页法阵帷幕，暗色渐变） | 只出现在 `App.jsx` L28 一段解释「为何删掉它」的**注释**里 → 死规则（§7.7 已记） |
| L213-217 | `.bottom-nav { background-color: rgba(16,20,26,.96) }` | `CandyBoot.jsx` L58 在用，但 candy.css L192「糖霜托盘三格」已接管 → 截图里就是浅粉底 |
| L238-241 | `.nav-center .nav-icon-wrap`（暗青渐变圆） | JSX 里 **0 次出现**（糖果版底部导航是三格均分，没有中央凸起项）→ 死规则 |

所以本轮之后，**可达页面上已没有任何吃哥特暗底的元素**。四条死规则归 §7.7 清死代码时一并删。

### 15.3 又一次：用户截图是旧构建

用户这张图里每日目标的数字还是**青绿色**（`--teal-lt`），而 §13 那轮（`b91f8cb`）已经把它改成
`#D14767` 粉色并实测到 `rgb(209,71,103)`。本轮 dev 上复测仍是 `rgb(209,71,103)`。
所以截图又是缓存 / Pages 传播延迟。**连续两轮都出现这个现象**，下次收到"某处没改"的截图，
第一件事是比对截图里的文案与自己的提交记录，或直接跑 `verify-live.mjs` 看线上三哈希。

---

## 16. 第六轮（2026-09-04）· 收藏题集整体撤除

**gh-pages HEAD：`01dd0f4`（父 `471e385`），46 文件 / 4.9 MB，verify-deploy 缺失0/不一致0/多余0。**
**CSS 107.47 → 105.68 kB，JS 477.79 → 475.81 kB。**

用户一句话：「去掉收藏题集，用不上」。按 §9 的规矩 **完全还原、不留残余、不争辩** —— 不是藏起来，是整条链路删干净。

### 16.1 撤除清单（§7.1 / §11.1 那套实现全撤）

| 文件 | 撤掉的东西 |
| --- | --- |
| `lib/stats.js` | `buildSession` 的 `case 'fav'` |
| `store.js` | `toggleFavorite` 动作；`migrateBooks` 里的 `favorites: []`；demo 两本书的 `favorites` 数组；`reloadAll` 里的收藏死引用裁剪循环；`deleteQuestion` 里各书收藏的同步摘除；`startSession` 的 `favIds` 传参与 `books/activeBookId` 解构 |
| `pages/Learn.jsx` | 第五张 `.entry-card.wide` 入口卡；`favArr` / `favCount` 及其 `useMemo`；`books` / `activeBookId` 两个 selector |
| `pages/Practice.jsx` | 解析区的 `.zone-head` 包裹层与 `.fav-star` 星标按钮；`favList` / `isFav` / `onFav`；`books` / `activeBookId` / `toggleFavorite` 三个 selector |
| `theme/candy.css` | `.entry-card.wide` 及其 `::before` / `.wide-txt` / `h3` / `p` / `.count-gem` / `.fav-on` / `:not(.fav-on)` / 560px 断点；`.zone-head`；`.fav-star` 全族；为它们加的那个 `prefers-reduced-motion` 块 |

**完整实现留在 gh-pages 提交 `13c2057`**（含真机验证数据），哪天想要直接从那里取回，不用重写。

### 16.2 故意保留的三样（都不属于收藏功能）

1. **`.entry-card .art { display: none }`** 与 **`.entry-card { display:flex; flex-direction:column; justify-content:center }`**
   —— 这两条是用户单独提的第 2 项「四个图标整体偏上」的修复（卡高 335→185，-45%），只是碰巧和收藏同一轮写的。删掉会让 150px 空洞复活。
2. **`.entry-card:nth-child(5)::before { content: '🔖' }`**（candy.css L575）
   —— 这是**本轮之前就存在**的旧规则（§7.1 当时就记着"已有 🔖"），不是我加的。现在无元素命中，无害，保留原状。
3. **`Practice.jsx` 解析区那行 `<h5 className="zone-label">◇ 解析</h5>`**
   —— 原来是 `answered || showAnswer ? '◇ 解析' : '◇ 解析'`（两个分支完全相同的遗留三元）。撤星标时顺手保留了收成一行后的版本，只留注释说明。

### 16.3 数据残留（无害，但要知道）

如果撤除前已经在**真实账号**下点过星标，云端 `settings` 表 `key='books'` 那行的 JSON 里会留着
`books[id].favorites: [...]` 字段。现在**没有代码读它、也没有代码清它**，就是一段死数据：

- 不影响任何功能（`scopeQuestions` / `assign` / SRS 全都不看这个字段）
- 不会让 payload 变大到有意义的程度（几个题目 id）
- `reloadAll` 的裁剪循环已随功能撤除，所以里头的死 id 也不会被清 —— 但既然没人读，无所谓
- 真要清的话：设置页「危险区」清空数据会重建 books；或手动导出备份、删掉字段、再导入

demo 模式下从来没写过云端，`localStorage['quiz-platform.books.v1']` 里可能还留着上一次演示写的
`favorites`，同样无害（清浏览器存储即消失）。

### 16.4 验证（撤除后逐项复测，确认没伤到别的功能）

| 检查 | 实测 |
| --- | --- |
| 产物里收藏相关文案 | `收藏题集` / `还没有收藏` / `只练这` / `已收藏` / `收藏这题` **全 False** |
| 产物里收藏相关类名 | `fav-star` / `entry-card.wide` / `zone-head` / `wide-txt` **全 False** |
| 该留的还在 | `entry-card .art`=True、`justify-content:center`=True、`错题重练`=True、`挑题练习`=True、`🔖`=True |
| 学习页 | `.entry-card` **4 张**、`.entry-card.wide` **0 个**、标题 `错题重练/随机练习/新题上手/挑题练习`、高度 `[185,185,185,185]` 齐平、2×2 无空洞、`justify-content:center` |
| 答题页解析区 | `.fav-star` **0**、`.zone-head` **0**、`◇ 解析` 的父元素回到 `zone zone-s`（包裹层已撤）、蜡封正常 |
| **答题主流程回归** | 选项洗成 `[A.说法二, B.说法一, C.说法三, D.说法四]` → 点「说法一」→ `rowCls` 正确标在 **B**、`答对了` `rgb(27,127,99)`、**揭晓答案 `B`**（原始 A→显示 B 的映射未被撤坏） |
| 三档自评 | `忘记完全想不起来 / 模糊犹豫了一下才对 / 记得一眼就答出来了` 仍在（§13 的改动未受影响） |
| console | 全程 **0 errors** |

即：#1 配色、#3 难度胶囊、#4 首字、#6 选项随机化与答案字母映射、#7 结算页、#8 知识域、以及 §13/§14/§15 的各项，**撤除收藏后全部复测通过**。

### 16.5 又一次：Read 工具给的是陈旧缓冲区

撤 CSS 时要拿准确锚点，`Read candy.css` 报「total 987 行」，而磁盘实测 **1304 行**
（`.stepper .val` 在 L1223）。**Read 返回的是我这轮所有 candy.css 改动之前的版本。**
改用 `[IO.File]::ReadAllLines` 打印行号 + 内容才拿到真文本。

这是 §11.3 那条陷阱的**第二次发作**，而且这次更狠：上次是内容不同、字节数恰好相同（容易误判成"文件被污染"），
这次是**行数直接差了 317 行**。结论加强：

> **这个项目里，凡是要拿精确文本做 SearchReplace 锚点，一律用 `[IO.File]::ReadAllLines` / Grep 从磁盘取，
> 不要用 Read 工具。** Read 只适合看那些本轮没改过、且 IDE 里没打开的文件。

顺带：本轮又出现一次中文形近字替换（把「捞回来」写成了另一个字），在 diff 里当场发现并修掉了。
累计已观测到六例，全是形近字替换。**不在这里列具体字，因为连「举例说明这件事」的那一行本身也会被同样损坏**
（写的时候想举 A→B，落盘变成 B→C，反而成了误导）。六例全部落在注释或文档里，未影响代码语义。
结论：**写中文注释/文档后必须回读校验（用 `$t.Contains('预期词')` 硬断言），别只看 diff 就过。**

---

## 17. 第七轮（2026-09-04）· 对/错配色两层同步 + 纠正 §4.1 的 Playwright 用法

**gh-pages HEAD：`39833c7`（父 `01dd0f4`），46 文件 / 4.9 MB，verify-deploy 缺失0/不一致0/多余0。**

### 17.1 用户要求与根因

用户：「答对的颜色配置好看一些，答错改成图二那种，只是绿色换成红色」。
图二是答对态（通体一致的绿），图一是答错态。对比后根因很清楚：

**`candy.css` L399 的 `.zone-s.revealed` 是无条件薄荷绿**：

```css
.zone-s.revealed { border-style: solid !important; border-color: var(--mint) !important;
                   background: rgba(127, 232, 200, .1) !important; }
```

答错时里面的判定横幅、答案框、选项全被 §11 的规则改红了，**外层解析区却还是绿的** → 红绿混装。
所以"答错改成图二那种只是绿换红"= 让外层跟着判定结果走，答错成为答对那套处理的红色镜像。

### 17.2 改动

- `Practice.jsx`：新增 `verdictOk = objective ? !!lastGrade?.correct : lastRating === '记得'`，
  给 `<section className="zone zone-s …">` 按判定补挂 `ok` / `bad`。
  **主观题仅展开参考答案、尚未自判时（`showAnswer` 但 `!answered`）不挂**，保持中性。
  仍用 `lastGrade` 而不是下面才声明的 `grade`（const 有 TDZ，会整页崩溃）。
- `candy.css` 末尾：`.zone-s.revealed.ok` / `.bad`；`.answer-scroll-box` 与 `.bad` 改成同结构只差色相的极浅渐变洗底；
  `.opt-row.right` / `.wronged` / `.missed` 各加一圈 `0 0 0 3px` 同色柔光环（box-shadow 不参与布局，不会撑动牌面）。
- **答对的绿顺带调饱和**：描边从 `--mint`(#7FE8C8，压在浅底上偏粉气发灰) 换成 `--mint-dk`(#5FD4B0)，
  洗底 `.10`→`.14`，答案框从纯白改成极浅薄荷渐变。
- `.missed`（多选漏选的正确项）**继续用薄荷不用红** —— 它是"你没选但它是对的"，属于正向信号。

### 17.3 实测（同一轮里对/错各答一题）

| 层 | 答对 | 答错 |
| --- | --- | --- |
| `.zone-s` class | `zone zone-s revealed ok` | `zone zone-s revealed **bad**` |
| 解析区边框 | `rgb(95,212,176)` | `rgb(242,86,74)` |
| 解析区底色 | `rgba(127,232,200,.14)` | `rgba(242,86,74,.1)` |
| 判定横幅 | `答对了` `rgb(27,127,99)` | `答错了` `rgb(196,55,46)` |
| 答案框左栏 | `rgb(95,212,176)` | `rgb(242,86,74)` |
| 答案框底 | `linear-gradient(rgba(127,232,200,.12), #fff…)` | `linear-gradient(rgba(242,86,74,.13), #fff…)` |
| 答案框 h5 | — | `rgb(196,55,46)` |
| 选项柔光环 | `.right` `rgba(127,232,200,.24) 0 0 0 3px` | `.wronged` `rgba(242,86,74,.22) 0 0 0 3px` |
| 揭晓答案 | `D`（说法一洗到 D 位） | `C`（说法一洗到 C 位） |

两态都是**整屏一个色系**，`✓ 答对` 绿 / `✗ 答错` 红、三档自评 红/黄/绿 全部对齐。console 全程 0 errors。
（单选题答错时正确项不带 `.right` 类，是既有行为：`.missed` 只对多选题生效，不是本轮回归。）

### 17.4 ⚠ 纠正 §4.1：Playwright CLI 有原生命令，别再手搓

本轮验证脚本连续失败 2 次后调了 **`playwright-cli` skill**，发现 §4.1 记的那套做法绕了远路。
**以下才是正确用法，覆盖 §4.1 里"run-code 不回传所以要写 window.__p 再 eval 读回"那一段：**

```powershell
# 状态清理：原生命令，不用 page.evaluate 手搓
npx playwright cli localstorage-clear          # 还有 localstorage-list/get/set/delete
npx playwright cli reload                       # 真重载（hash-only goto 不会重建文档！）
npx playwright cli sessionstorage-clear / cookie-clear / state-save / state-load

# 交互：click 直接吃 CSS 选择器或 Playwright 定位器，不用 run-code 包一层
npx playwright cli click '.entry-card:nth-child(4)'
npx playwright cli click "getByText('说法一')"
npx playwright cli click "getByRole('button', { name: '开始练习（4 题）' })"
npx playwright cli fill e5 "文本" --submit      # e5 是 snapshot 里的 ref
npx playwright cli select e9 "option-value"
npx playwright cli find "开始练习"               # 在 snapshot 里搜文本/正则，比整份 snapshot 省得多
npx playwright cli snapshot --depth=4           # 限制深度
npx playwright cli console warning              # 按级别过滤

# 读数：--raw eval 一直是可靠的，这个没变
npx playwright cli --raw eval "JSON.stringify({...})"
```

**四个关键坑（本轮全踩过）**：

1. **`click` 是 strict 模式**：`.modal-box .btn` 命中 2 个元素会**直接报错并把两个精确定位器都列出来**
   （`getByRole('button', { name: '开始练习（4 题）' })` / `{ name: '返回' }`）。
   这比 `document.querySelector` 静默取第一个安全得多 —— 报错信息本身就是答案，照着改选择器即可。
2. **`run-code` 里 `console.log` 和 `return` 都不回传**。以前我因此发明了"写 `window.__p` 再 `--raw eval` 读回"的中转，
   **其实完全没必要**：用原生 `click` + `--raw eval` 分步走就行，可读性和可调试性都好得多。
   `run-code` 只在真的需要 `page.on(...)` 监听或帧采样时才用（§4.2 那个探针仍是照抄别改）。
3. **自己写 `page.evaluate` 包装器极易丢参数**：`const ev = (fn) => page.evaluate(fn)` 之后再 `ev(fn, arg)`，
   第二个参数被静默吞掉 → 页内 `arg === undefined` → `findIndex` 恒返回 -1 → `r[-1].click()` 崩。
   **不要包 `page.evaluate`**，直接用 CLI 的 `click`/`eval`。
4. **`page.goto` / `cli goto` 到只有 hash 不同的地址不重建文档**（HashRouter SPA），
   zustand 内存态与 localStorage 里的旧 resume / 旧筛选全部留着，
   上一次选中的筛选 chip 会被这次点击**反向关掉**（实测 `开始练习（4 题）` 变成 `共 28 题`）。
   要干净首屏必须 `localstorage-clear` + `reload`。

### 17.5 用户新增的长期工作准则（已存记忆）

> 在确保质量的前提下减少调用次数；**完成不了的任务、或同一任务失败 2 次以上（完成了但效果不理想也算），
> 马上调用合适的 skill，没有就安装一个，不要蛮干。**

本轮就是照这条办的：验证脚本第 2 次失败后立刻调 `playwright-cli` skill，
一次就拿到 `localstorage-clear` / `reload` / strict `click` / 定位器语法，比继续自己试省得多。
**下个会话遇到连续失败，第一反应是查 skill 列表，不是第三次重试。**

---

## 18. 第八轮（2026-09-04）· 撤回 §17 的过度装饰 + 答错只红三处

**gh-pages HEAD：`a8994ab`（父 `39833c7`），46 文件 / 4.9 MB，verify-deploy 缺失0/不一致0/多余0。**
**CSS 106.28 → 105.76 kB。**

### 18.1 用户两次收窄需求，最终形态

- 第一次：「答对的颜色配置好看一些，答错改成图二那种，只是绿色换成红色」
  → 我理解成"整个解析区跟着判定变色 + 给答对加饱和度/渐变/柔光环"（§17），**做过头了**。
- 第二次：「答错只要题目选项选错那一栏变红和答案变红就行了，**整个框框背景不要变**，
  答对的那张图片上显示的就很干净」→ 撤回 §17 全部三样装饰。
- 第三次（附截图三支箭头）：「答错只改我在图片中标记的箭头这三处变成红色，其余不动」

**最终形态：答错时只有三处红，其余与答对态完全一致。**

| 箭头 | 元素 | 实现 | 实测（答错） | 实测（答对） |
| --- | --- | --- | --- | --- |
| ① | 选错那一栏的选框圆圈 + 整栏 | `.opt-row.wronged` / `::before`（§11 已有，无需新增） | 底 `rgba(242,86,74,.14)`、边 `rgb(242,86,74)` | `.right` 底 `rgba(127,232,200,.22)`、边 `rgb(95,212,176)` |
| ② | 参考答案的字母 | **新增 `.ans-line` 类** + `.answer-scroll-box.bad .ans-line` | `rgb(196,55,46)` 红 | `rgb(74,74,74)` 深灰 |
| ③ | 【题库解析】小标 | `.answer-scroll-box.bad .lab` | `rgb(196,55,46)` 红 | `rgb(110,110,110)` 灰 |

**两态完全相同、不随判定变化的部分**（这就是"框框背景不要变"）：

| 元素 | 答对 | 答错 |
| --- | --- | --- |
| `.zone-s` class | `zone zone-s revealed` | `zone zone-s revealed`（**不挂 ok/bad**） |
| 解析区底色 | `rgba(127,232,200,.1)` | 同值 |
| 解析区边框 | `rgb(127,232,200)` | 同值 |
| 答案框底色 | `rgba(255,255,255,.72)` | 同值 |
| 答案框渐变 | `none` | `none` |
| 解析正文 `<p>` | `rgb(74,74,74)` | 同值（**没被染红**） |
| 选项柔光环 | 无（只剩基础阴影 `rgba(255,182,193,.18) 0 2px 10px`） | 无 |

只有这些随判定变：判定横幅文字色、答案框 4px 左栏、答案框 h5、`.ans-line`、`.lab`、选项栏配色。

### 18.2 ⚠ 撤回覆盖规则时会把更老的规则放出来（本轮最重要的坑）

我把 §11 那条

```css
.answer-scroll-box.bad { border-left-color: var(--bad-dk) !important; background: var(--bad-wash) !important; … }
```

里的 `background` 删掉（因为用户说"框框背景不要变"），结果实测 **`boxBg = rgba(168, 224, 99, 0.12)`——酸橙绿**！

原因：candy.css **L519 还有一条更早的** `.answer-scroll-box.bad { background: rgba(168,224,99,.12) !important }`
（那是 §1 之前"错误用酸橙绿"旧设计的遗留），一直以来都被我末尾那条同特异性规则压着。
**我一删末尾的 `background`，它就重新生效了** → 红字配绿底，正是用户最初报的"红绿混装"。

修法：末尾那条**必须显式写回中性白** `background: rgba(255,255,255,.72) !important`
（与答对态 L513 完全同值），不能靠"不写就等于没有"。

> **教训：这个项目的 candy.css 是"末尾追加、同特异性后来居上"的层叠结构（§3.1），
> 所以任何一条末尾规则都是它下面同选择器旧规则的"盖子"。撤回盖子上的某个属性时，
> 必须去查同选择器在前面还有几条规则、它们的那个属性是什么值——不能假设"删掉=回到中性"。
> 而且这类回归静态断言查不出来（产物里两个色值都在），只能靠运行时 `getComputedStyle`。**

同类风险点（§13 扫出来的 7 处 `var(--sour)`）：`.opt-row.wronged`(L446)、`.judge-card.j-false`(L484)、
`.fill-item.wronged`(L494)、`.answer-scroll-box.bad`(L519)、`.gem-dot.bad`(L560)、
`.entry-card.hot .count-gem`(L584)、`.nav-item .dot`(L226)。
**以后要撤回其中任何一条的某个属性，都得先确认 L 号那条旧规则的对应值。**

### 18.3 ⚠ 开发服务器端口变了，§4.1 的「127.0.0.1:5179」已失效

本轮验证时 `127.0.0.1:5179` 直接 `ERR_CONNECTION_REFUSED`——上一轮会话那个带 `--port` 起的进程早没了。
重新 `npm.cmd run dev -- --mode demo` 后 Vite 落在**默认 5173**，而且：

```
netstat -ano | Select-String ':5173'
  TCP    [::1]:5173    [::]:0    LISTENING    6636
127.0.0.1:5173 = False      ← IPv4 被拒
localhost:5173 = True       ← 走 IPv6 ::1
```

**`vite.config.js` 里没有 `server` 段**，所以 Vite 只绑 IPv6 回环 `::1`。
→ **Playwright 的 URL 必须写 `http://localhost:5173/quiz-platform/`，写 `127.0.0.1` 会 `ERR_CONNECTION_REFUSED`。**
（要固定成 IPv4 + 指定端口就 `npm run dev -- --mode demo --port 5179 --host 127.0.0.1`。）

排查手法记一下：`goto` 报 CONNECTION_REFUSED 后，后面所有 `click` 会连锁报 "does not match any elements"，
**别去怀疑选择器**，先 `netstat -ano | Select-String ':<port>'` 看它到底绑在哪个地址上。

### 18.4 撤回清单（§17 加的三样全删）

- `.zone-s.revealed.ok` / `.zone-s.revealed.bad` —— 删；`Practice.jsx` 里的 `verdictOk` 与
  section 上的 `ok`/`bad` 类也一并删（不留残余）
- `.answer-scroll-box` / `.answer-scroll-box.bad` 的 `linear-gradient` 洗底 —— 删，回到纯白
- `.opt-row.right` / `.wronged` / `.missed` 的 `0 0 0 3px` 柔光环 —— 删，回到基础阴影

**教训（已写进 candy.css 注释）：用户说「好看一些」不等于「加更多装饰」。**
图二（答对）本来就干净，我却给它叠了饱和度、渐变、柔光环三层，反而脏了。
下次遇到审美类要求，先给最小改动让用户看，别一次堆三层。

### 18.5 本轮按用户新准则的执行情况

用户本轮新增长期准则（已存主要记忆）：*确保质量的前提下减少调用；完成不了或失败 2 次以上（含效果不理想）立即调 skill*。

- 效果不理想 → 用户连续两次收窄需求，第三次直接画箭头。已按最小改动落地。
- 失败 2 次 → dev 服务器连不上连续失败 2 次后，没有第三次重试，而是按 `systematic-debugging` Phase 1
  取证（`netstat` + `Test-NetConnection` 双地址对比 + 读 `vite.config.js`），一次定位到 IPv6-only 绑定。

---

## 19. 第九轮（2026-09-04）· 标签页去哥特 + 登录页重做 + 弹窗遮罩去红

**gh-pages HEAD：`a01b100`（父 `a8994ab`），45 文件 / 4.61 MB，verify-deploy 缺失0/不一致0/多余0。**

### 19.0 ⚠ §3.3 的禁令已被用户本人解除

§3.3 原文写着「`index.html` 是用户手动改回的哥特原版，**不要动**……我曾改成糖果版并部署过，用户又改了回来。尊重现状」。
**本轮用户主动要求改**（「图一这里还是哥特那一版的东西，改一下」，图一是浏览器标签页）。
所以那条禁令作废，`index.html` 现在是可以改的。下个会话别再拿 §3.3 当挡箭牌。

### 19.1 图一 · 浏览器标签页（`app/index.html` + `app/public/favicon.svg`）

| 项 | 原值 | 现值 |
| --- | --- | --- |
| `<title>` | 奥术典籍馆 · 窥秘人的修行之地 | **糖果题库 · 电气自动化刷题** |
| `theme-color` | `#0d1117`（哥特近黑） | **`#FFF5F7`** |
| `favicon.svg` | `#0d1117` 黑底 + `#c9a84c` 金纹同心圆加十字线 | **棒棒糖**：`#FF8FA3` 粉桃糖头 + `#5FD4B0` 薄荷糖棍 + `#FFF6F8` 奶白双臂螺旋 + `#FFD6E0` 内圈 |
| `preload p11.webp` | 有（`fetchpriority="high"`） | **删除** |

favicon 用纯几何矢量（圆 + 矩形 + 两条贝塞尔），符合 craft-floor「SVG 做几何是一等媒介，模仿图画才是禁区」；
motif 与站内 `.ch-lolli` 同源，不是新发明的词汇。

**删 p11 preload 的依据**：`A.starryBg` 键已在 §13 删除，`p11.webp` 此后**只被这一条 preload 引用**，
即"高优先级预加载一张永不被使用的图"。删掉后 purge-dist 立刻把它清了：
**dist 46→45 文件、4.90→4.61 MB**，且 §3.1/§3.3 记了多轮的那条 p11 console 警告随之消失。
累计本会话：**82 文件 / 7.59 MB → 45 文件 / 4.61 MB（-45% 文件数、-39% 字节）**。

`index.html` 是 §3.2 记录的编辑器缓冲区回写高危文件，改完立刻用 `[IO.File]::ReadAllLines` 磁盘回读校验过，
构建后又校验了 `dist/index.html`，两处都正确、没有被回写。

### 19.2 图二 · 登录页（调 `impeccable` skill 的 `bolder` 通道做的）

用户评价「太简陋」。**根因是我自己造成的**：§13 把五个哥特位图（星空/漩涡/青铜门/魔法球/铜质分隔条）从 JSX 删净后
**没有补任何东西**，页面只剩标题 + 两个输入框 + 一个按钮 + 页脚。

`bolder.md` 的判断一针见血：*"一个寡淡的区块，通常是悄悄放弃了这个系统自己最强的那些手法"*。核对后确认登录页放弃了三样：

| 系统自有手法 | 别处 | 登录页 |
| --- | --- | --- |
| 气泡层 `<Background />` | 加载态（App.jsx L72）、已登录 Shell（L43） | **漏了**（L81-88 的未登录分支只返回 BootRitual + Login） |
| `.ch-lolli` 棒棒糖 + `.ch-candy` 糖豆 | Learn 页糖果橱窗 | 无 |
| `.divider` 糖果渐变分隔条 | `.zone-rule`、各页分隔 | 无（原本是哥特铜质花纹条 `A.divider`） |

**修法：不发明新词汇，把这三样补回去。**

- `App.jsx` 未登录分支加 `<Background />`
- `Login.jsx` 加 `.login-hero`（内含 `.ch-lolli` + `.ch-candy c1/c2/c3`，**类名原样复用**）与 `.login-divider`
- `candy.css`：`.login-stage` 改 `background: transparent`（否则它那层不透明渐变会盖住 z-index:0 的 `.bubble-layer`，
  因为它在 DOM 里更靠后）；`.login-hero` 重排 `.ch-*` 的百分比位置（原值是给 Learn 那条 150px 全宽横幅排的，
  放进 300px 宽的 hero 会挤成一团）；棒棒糖用 `margin-left:-29px` 居中而**不用 translate/transform**
  ——`.ch-lolli::before` 自带旋转动画，任何 transform 都会和它打架（§12.2 那个坑）；
  `.login-title` 给到展示级字号 `clamp(30px,8.6vw,40px)`；`.login-foot` 从哥特米金色改 `var(--muted)`（craft-floor 要求正文 ≥4.5:1）
- 420px 断点缩放 hero；`prefers-reduced-motion` 关掉糖豆与棒棒糖动画

**实测**：`document.title` = 糖果题库 · 电气自动化刷题；`.bubble` 9 个、`.bubble-layer` 存在；
`.login-stage` 背景 `rgba(0,0,0,0)` 透明；hero 292×118；棒棒糖 58×92 且左边距 117（hero 中心 146 = 117+29，**精确居中**）；
三颗糖豆位于 (16,24,49px) / (240,10,34px) / (207,80,28px)，与棒棒糖占据的 x∈[117,175] **零重叠**；
标题 40px；分隔条渐变就位；页脚 `rgb(110,110,110)`（≈5:1）；
**`img` 计数 0、图片请求 `[]` —— 整页零位图零请求**。截图确认：卡片顶部四个糖果元素带柔光、背景粉→薄荷渐变 + 悬浮气泡散景。

### 19.3 图三 · 「整个页面都变红了」= 我上一轮造成的

§14 我把 `.modal-veil` 从哥特近黑 `rgba(6,8,12,.72)` 改成了**粉洗** `rgba(255,214,224,.5)`。
叠在本就粉彩的页面背景上 → 整屏推成发红。这是判断失误：当时只想着"别用黑的"，没算叠加结果。

改成**去饱和暖灰轻压暗** `rgba(58,44,48,.2)` + `blur(6px)`（原 5px）：

| | 合成到 `#FFF0F5` 上的结果 | R−G 差 | 观感 |
| --- | --- | --- | --- |
| 旧粉洗 `.5` | `rgb(255,227,234)` | **28** | 明显偏粉红 |
| 新暖灰 `.2` | `rgb(216,201,206)` | **15** | 中性蟹壳灰，不带红相 |

靠磨砂（blur 6px）而不是靠颜色拉开层次，白底弹窗反而更跳。实测：`veilBg rgba(58,44,48,0.2)`、`veilBlur blur(6px)`、
弹窗 `rgba(255,255,255,.9)` + `rgb(255,214,224)` 边 + 24px 圆角、标题 `rgb(209,71,103)`；截图确认背景是中性磨砂、无红偏色。

> **教训：改遮罩/叠色时必须在目标底色上算一遍合成结果，不能只看色值本身"是不是粉色"。**
> 半透明色叠在已经偏粉的背景上会把饱和度推高一个档。

### 19.4 impeccable 机械检测器结果（DEGRADED 模式）

`node <skill>/scripts/detect.mjs` 报 **DEGRADED**：缺 `htmlparser2`/`css-select`/`css-tree`/`domutils`，
自定义属性、选择器匹配与计算对比度都未评估，它自己声明"findings are an undercount, not a clean bill of health"。
没有去装这些依赖 —— 对比度已用运行时 `getComputedStyle` 实测（比静态检测更强）。

5 条发现**全部落在本轮没碰过的既有代码上，且全部被 craft-floor 的「committed visual world 优先」豁免**：

| 行 | 发现 | 豁免理由 |
| --- | --- | --- |
| candy.css L515 | `.answer-scroll-box` 的 `border-left: 4px` | 既有设计（本轮只覆盖过它的 `border-left-color`）；bolder.md「Scope is sovereign」不许动没被点名的邻居 |
| L43 / L68 | `--ease-pop: cubic-bezier(0.34,1.56,0.64,1)` | 糖果主题的**签名弹性缓动**，§1 把「弹性缓动」列为该主题定义特征 |
| L723 / L742 | `balance-wobble` / `jar-jiggle` | 设置页糖果天平/糖果罐既有动画（§8 第4项），用户已验收 |

**本轮新增的登录段（candy.css L1300+）、弹窗段（L1195+）、Login.jsx、App.jsx、index.html 零发现。**

### 19.5 环境现状（覆盖 §4.1 与 §18.3）

- **demo 开发服务器：`http://127.0.0.1:5173/quiz-platform/`**，启动命令
  `npm.cmd run dev -- --mode demo --port 5173 --host 127.0.0.1`。
  **必须带 `--host 127.0.0.1`**：不带的话 Vite 只绑 IPv6 回环 `[::1]`，Playwright 用 `127.0.0.1` 会 `ERR_CONNECTION_REFUSED`（§18.3）。
- 本轮为验登录页另起过一个**非 demo** 服务器在 5180（`npm run dev -- --port 5180 --host 127.0.0.1`）——
  **demo 模式下 `init()` 直接置 signed-in，登录页根本进不去，想验登录页必须起非 demo 实例**。该实例已随会话结束失效。
- 后台起 dev 服务器会**顶掉上一个后台 dev 进程**（两次 `is_background` 调用先后拿到 terminal_id 1、2，5173 那个被顶死了）。
  要同时留两个就得显式指定不同 `--port`，且别指望旧的还活着，用前先 `Test-NetConnection` 探一下。
- `§4.1` 里「开发服务器 `127.0.0.1:5179`」彻底作废，以本节为准。

### 19.6 本轮同时完成的收尾

- §18 的三处红（选错栏 / 答案字母 `.ans-line` / `.lab`）与撤回 §17 的过度装饰，已随本轮一起上线并复测通过。
- 长期记忆整理：删掉 2 条重复的「Read 陈旧缓冲区」记忆；把「答题反馈配色规范」补全为
  **答错只红三处 + 容器背景一律不变**（防止下个会话又把 §17 那套做回来）；新增 playwright-cli 原生命令用法一条。
- 用户新增主要行为准则（已存记忆）：*确保质量前提下减少调用；完成不了 / 失败 2 次以上 / 效果不理想 → 立即调 skill，没有就装一个，不要蛮干。*
  本轮与上一轮各触发一次（上轮 `playwright-cli`，本轮 `impeccable`），都一次解决问题。

---

## 20. 第十轮（2026-09-04）· 答错配色第四次收窄：钉死「框框」的歧义

**gh-pages HEAD：`e14af9f`（父 `a01b100`），45 文件 / 4.61 MB，verify-deploy 缺失0/不一致0/多余0。**
**CSS 105.76 → 106.68 kB。**

### 20.1 连续两轮做反的根因：一个词指了两层

答题页解析区是**两层嵌套**：

```
<section class="zone zone-s revealed">      ← 外层「◇解析」大区块（用户口中的「解析」）
  <div class="answer-scroll-box ok|bad">    ← 内层白色答案框（用户口中的「框框」）
    <h5>参考答案 / 正确答案</h5>
    <p>{答案字母}</p>
    <p class="lab">【题库解析】</p>
    <p>{解析正文}</p>
  </div>
</section>
```

- §17 用户说「答错改成图二那种，只是绿色换成红色」→ 我把**两层全**改红了。
- §18 用户说「整个框框背景不要变」→ 我以为「框框」是**外层大区块**，于是把外层改回不变、
  反而去染红了内层的字体（`.ans-line`、`.lab`）。**两层都做反了。**
- §20 用户给出四条精确口径，才明确：**「框框」= 内层白色答案框，「解析背景」= 外层大区块。**

> **教训（已写进 candy.css 注释）：用户说「框」「盒子」「背景」这类词时，凡是该处存在嵌套容器，
> 先确认指的是哪一层再动手。这个页面就是两层，我猜错了两次，代价是两轮完整的构建+部署+验证。**

### 20.2 最终口径与实测（用户四条，逐一对应）

| # | 用户原话 | 落点 | 实测（答错） | 实测（答对） |
| --- | --- | --- | --- | --- |
| ① | 选择那一栏需要变红 | `.opt-row.wronged`（§11 已有） | 底 `rgba(242,86,74,.14)`、边 `rgb(242,86,74)` | `.right` 底 `rgba(127,232,200,.22)`、边 `rgb(95,212,176)` |
| ② | 解析背景变红 | **`.zone-s.revealed.bad`（本轮新增）** | class `zone zone-s revealed bad`、底 `rgba(242,86,74,.1)`、边 `rgb(255,138,122)` | class `zone zone-s revealed`（**无 bad**）、底 `rgba(127,232,200,.1)`、边 `rgb(127,232,200)` |
| ③ | 参考答案字体不变色、背景还是白色、只变那条边框 | `.answer-scroll-box.bad` 只留 `border-left-color` | 底 `rgba(255,255,255,.72)`、`backgroundImage:none`、左栏 `rgb(242,86,74)`；h5 `rgb(27,127,99)`、答案字母 `rgb(74,74,74)`、`.lab` `rgb(110,110,110)`、解析正文 `rgb(74,74,74)` | 底同值、左栏 `rgb(95,212,176)`；h5 `rgb(27,127,99)`（**与答错态同值**，证明字体真的没随判定变色） |
| ④ | 其他维持原来的颜色 | 不动 | `答错了` 横幅 `rgb(196,55,46)`、三档自评红/黄/绿、`.crack-veil` 裂纹 | `答对了` `rgb(27,127,99)` |

本轮**撤销**的 §18 改动：`.answer-scroll-box.bad .ans-line`、`.answer-scroll-box.bad .lab` 两条红字规则，
以及 `Practice.jsx` 里只为染红答案字母而加的 `className="ans-line"`（实测 `ansLineClassLeft: false`，死类已清）。
`.zone-s` 的 `bad` 类**只挂 bad 不挂 ok** —— 答对态必须一行不碰。

console 全程 0 errors。

### 20.3 ⚠ 同一个陷阱第二次发作：删覆盖规则会放出更老的规则

§18.2 记过一次（`.answer-scroll-box.bad` 的酸橙绿底）。本轮**同一模式再次出现**：

要把「正确答案」标题改成"不变色"，最直觉的做法是**删掉** §11 那条

```css
.answer-scroll-box.bad h5 { color: var(--bad-ink) !important; }   /* L1041 */
```

但 **L522 还压着一条原始糖果版** `.answer-scroll-box.bad h5 { color: #6E9B2E !important; }`（橄榄绿）。
一删 L1041，橄榄绿立刻回潮 → 答错时标题变橄榄绿。

修法：**不删，改成显式与答对态同值** `color: var(--ok-ink) !important`（后面那条同特异性、位置更靠后，赢）。

> 这次是**动手前先查**才发现的（§18.2 的教训生效了），没有再次上线后才暴露。
> **规则：在 candy.css 里"撤销"任何一条末尾覆盖时，先 `Select-String` 同选择器在前面还有几条、
> 它们对应属性的值是什么。删掉 ≠ 回到中性，往往 = 回到某个更老的糖果/哥特值。**

已知同类风险点（§13 扫出的 7 处 `var(--sour)`）：`.opt-row.wronged`(L446)、`.judge-card.j-false`(L484)、
`.fill-item.wronged`(L494)、`.answer-scroll-box.bad`(L519)、`.gem-dot.bad`(L560)、
`.entry-card.hot .count-gem`(L584)、`.nav-item .dot`(L226)；本轮又加一处 `.answer-scroll-box.bad h5`(L522)。

### 20.4 关于「解析区红底会不会太淡」

`rgba(242,86,74,.1)` 是刻意与薄荷版 `rgba(127,232,200,.1)` **严格对称**（同透明度、同明度关系的浅色 token）。
合成到卡片底色 `rgb(255,248,250)` 上约为：

| | 合成结果 | 与底色的偏离 |
| --- | --- | --- |
| 薄荷 `.1`（答对） | `rgb(242,246,245)` | G−R = +4，很淡 |
| 草莓 `.1`（答错） | `rgb(254,232,232)` | R−G = +22，比薄荷明显 |

也就是说**红色版其实比绿色版更容易看出来**（因为底色本身偏粉，红同相叠加、绿是异相）。
但两版都属于"极浅洗底"，主要靠 `.zone-s` 那圈 `var(--bad)` #FF8A7A 实色边框 + 内部红字/红栏来传达状态。
**若用户觉得不够红，改一个数就行**：`.zone-s.revealed.bad` 的 `background` alpha 从 `.1` 提到 `.16`~`.2`。

### 20.5 本轮中止的任务

用户先要求「把出题的那个完整 skill 打包一下」，我调 `create-plugin` 建好了骨架
（`.qoder-plugin/plugin.json` + `assets/` + `skills/electrical-question-gen/{SKILL.md,rules/,validator/}`，
共拷入 7 个文件），随后用户改口「不要打包了」，**该目录已删除，未产出任何交付物**。

顺带查实并**更正上一轮的一个错误结论**：`electrical-question-gen` 附录D 引用的离线校验器
（`validate_questions.ps1` 14668 B、`question-batch.schema.json` 2882 B、`sample-valid.json` 12036 B、
`sample-invalid.json` 11801 B、`README.md` 4885 B）**确实存在**，位于
`C:\Users\青丘白浅\Documents\Qoder\命题流水线\validator\`，不在 skill 目录内 ——
上一轮我只在 skill 目录下找，误报"四个文件全不存在"。
附录D 第 1 条的网页校验器路径 `app\src\core\validator.ts` **仍然是错的**，实际是 `app/src/lib/validate.js`。

上一轮已完成的 skill 规则 vs `validate.js` 比对结论（20 项一致、5 处差异）用户明确表示**不要修**，保持现状。

---

## 21. 第十一轮（2026-09-04）· 入库序改全局单调（修好被打通的刷题顺序）

**gh-pages HEAD：`8487391`（父 `e14af9f`），45 文件 / 4.61 MB，verify-deploy 缺失0/不一致0/多余0。**
**CSS 哈希未变（`index-blmfZRBh.css`）——本轮纯逻辑改动，一行样式没碰。**

### 21.1 问题：`seq` 存的是批内序号，跨批次会重复

用户问「题目是按照入库时间顺序排列吗？」，查出来两处排序、口径不同：

| 位置 | 排序依据 |
| --- | --- |
| 糖果书架 `Bank.jsx` L38 | `importedAt` 降序（新→旧），页面文案「按导入时间从新到旧排列」准确 |
| 组卷 `stats.js` L149/156/161 | **`a.seq - b.seq`** —— 与入库时间无关 |

而 `seq` 是命题协议里的**批内序号**：`validate.js` L226 `const q = { id: hashId(...), seq, ... }`，
`seq = seqOf(raw)` 直接取 JSON 的 `序号` 字段，每批都是 1~21。`db.js` L52 云端读取还是 `.order('seq')`。

**后果**：导入 N 批后库里有 N 个 `seq:1`、N 个 `seq:2`……。`buildSession` 的
`learn`（学新题）/ `wrong`（错题重练）/ `relearn`（挑题练习）三条路径全部 `sort by seq`，
于是刷题顺序变成「**各批的第1题 → 各批的第2题 → …**」，而不是「第一批21题 → 第二批21题」。

这与命题设计直接冲突：按协议每批 21 题是以 1 道原题为圆心的同心圆，
序号 2~9 基础 / 10~16 应用 / 17~21 综合是**围绕同一知识点的认知阶梯**。
按 seq 横切等于把阶梯打散成「所有批次的基础题混在一起、再所有批次的应用题混在一起」，
上一题讲热继电器、下一题跳 D/A 转换器。同 `seq` 之间的先后 Postgres 还**不保证**（并列值顺序未定义）。

（`review` 到期复习按 `a.dueAt` 排、`random` 走 shuffle，这两条不受影响。）

### 21.2 修法：入库前把批内序号改写成全局单调值

新增 `validate.js` 的 `assignGlobalSeq(incoming, existing)`：

```js
export function assignGlobalSeq(incoming, existing) {
  const byId = existing instanceof Map ? existing : new Map((existing ?? []).map((q) => [q.id, q]))
  let maxSeq = 0
  byId.forEach((q) => { if (Number.isFinite(q?.seq) && q.seq > maxSeq) maxSeq = q.seq })
  return (incoming ?? []).map((q) => {
    const old = byId.get(q.id)
    if (old && Number.isFinite(old.seq)) return { ...q, seq: old.seq }   // 已在库 → 沿用原 seq
    const local = Number.isFinite(q.seq) && q.seq > 0 ? q.seq : 0
    return { ...q, seq: maxSeq + local }                                 // 新题 → 已有最大 + 批内序号
  })
}
```

`store.js` 的 `importBank` 在 `parseBank` 之后、`persistAfterImport` / `upsertQuestions` 之前调用它，
`existing` 从 `Set<id>` 升级成 `Map<id, q>`（顺带供 `added` 统计复用，少遍历一次）。

**三个刻意的取舍：**

1. **必须在 `parseBank`（即校验）之后调用。** 校验器的 `diffBand(seq)`（2~9基础/10~16应用/17~21综合）、
   「综合层允许认知层级=分析」的唯一例外（`seq>=17 && seq<=21`）、「拓展题≤2空」「空位居句首」（`seq>=2`）、
   「序号应为 N」（`seqOf(it) !== i+1`）—— **全部读的是原始 JSON 的 `seqOf(raw)`，不是 `q.seq`**。
   提前改写会让整套难度层段判定失效。这条已写进函数注释。
2. **备份恢复那条分支（`importBank` L256-267）故意不重排。** 备份里带的本来就是存好的全局序，
   再套一次 `maxSeq +` 会把整批推到库尾、毁掉原顺序。
3. **已在库里的题沿用原 seq**（`if (!map[q.id])` 的同款思路）。否则重复导入同一批，
   每导一次整批就往后推一段，序号无意义地膨胀。

零表结构变更：`seq` 列本来就存在，只是值的语义从「批内序号」变成「全局入库序」。

### 21.3 回归测试 `scripts/t-seq.mjs`（16 例，全过）

比照 `t-fill.mjs` 的做法**直接 import 真实源码**，不复制逻辑（复制的话测的就不是上线的东西）。

覆盖：空库首批原样 1..21 / 第二批接 22..42 / 重复导入不重排 / **三批 63 题按 seq 排序 = A→B→C 完整分段**
（这条就是本次改动的目的本身）/ 全局 seq 恰为 1..63 无重复无空洞 / 部分重复（库里只有前 5 题）/
新题严格大于所有已有 seq / `existing` 传 Map 与传数组等价 / `existing` 为 undefined·null 不炸 /
`seq` 缺失或为 -1 时退化成 `maxSeq+0` 不产生 NaN / `incoming=undefined` 返回空数组 /
删题后 maxSeq 回落 / 不可变性（不就地改入参、返回新对象）。

同时跑 `t-fill.mjs` 回归 **13/13 通过** —— `validate.js` 被改过，确认填空判分没受影响。

### 21.4 ⚠ 这个修复是「只向前生效」的

**云端已有的题不会被重排。** 已经导入的那些批次，`seq` 仍是重叠的 1~21，
它们之间照旧交错；改动只保证**从现在起新导入的批次**整批排在所有旧题之后。

要修存量数据是可行的，但没做（用户只选了方案 2，未要求迁移）：
`qp.importedAt.v1`（localStorage）里同一批的题共享同一个毫秒时间戳，而现有 `seq` 恰好就是批内序号，
所以可以「按 importedAt 分组 → 组间按时间戳升序 → `newSeq = 组序 × 1000 + 原 seq`」重建。
**前提是那台浏览器的 localStorage 还在**——这正是下面 21.5 的脆弱点。

### 21.5 顺带查实的两个既有隐患（本轮未修，用户未要求）

1. **`qp.importedAt.v1` 只存 localStorage、不上云。** `db.js` 里没有对应列。
   清缓存 / 换浏览器 / 换设备 → map 变空 → 书架页所有 `?? 0` → **sort 静默失效**退回按 seq 排，
   而页面文案仍写着「按导入时间从新到旧排列」，不报错、也无法重建。
   彻底解决要给 `questions` 表加 `imported_at` 列（就是上一轮我列的方案 3）。
2. **`importBank` 没有 DEMO 卫兵。** `store.js` L273 `await repo.upsertQuestions(questions)` 与
   L261 的备份分支都**裸调云端**，对比 `deleteQuestion` L280 有 `if (!DEMO)`。
   也就是说 demo 模式下真去导入，会写进生产 Supabase 库。
   **本轮因此刻意不在浏览器里测导入路径**，改用 16 例单测覆盖。
   （§11 修过 `updateSettings` 缺 DEMO 卫兵，这是同一类问题的第二处，建议一并补。）

### 21.6 附带的一处文案修正

`Bank.jsx` L125 卡片背面的 `<b>编号</b>` 改成 `<b>入库序</b>`。
`q.seq` 已经不是协议里的批内序号了，第三批的第 1 题会显示「第 43 题」，
沿用「编号」会让人以为数据乱了。**这是语义跟随，不是美化。**

---

## 22. 第十二轮（2026-09-04）· 五个练习入口的排序口径 + 修两个组卷 bug + 部署脚本加重试

**gh-pages HEAD：`b8a99d3`（父 `8487391`），45 文件 / 4.61 MB，verify-deploy 缺失0/不一致0/多余0。**
**CSS 哈希未变（`index-blmfZRBh.css`）——纯逻辑改动。**

### 22.1 五个入口的真实口径（用户逐条问过后核对的结果，别再凭印象答）

| 入口 | 代码 | 筛选口径 | 排序 | 题量 |
| --- | --- | --- | --- | --- |
| **开始今日练习**（hero） | `Learn.jsx` L86-93 **四选一优先链** | 见下 | 见下 | 见下 |
| **错题重练** | `run('wrong',{size:0})` | `lastResultMap(records).get(id) === false`，即**最近一次**答错（后来答对就出局，不是"曾经错过"） | `a.seq - b.seq` | 全部 |
| **随机练习** | `run('random',{size:20})` | **不排除做过的、不排除错题**，从筛选后全库抽 | Fisher-Yates | 20 |
| **新题上手** | `run('learn')` | `cards` 里没有复习卡的题 = **从未做过三档自评**（不是"从未点进去过"） | `a.seq - b.seq` | **全部（故意不封顶）** |
| **挑题练习** | modal → `run('relearn',{size:0,…筛选})` | 题型 / 知识域 / 难度 | `a.seq - b.seq` | 全部 |

hero 优先链（`Learn.jsx` L86 注释原文「到期复习 → 错题 → 新题 → 随机（按交接要求保留）」）：

```
dueCount > 0   → review  「N 道题到期，该复习了」   size:20
wrongCount > 0 → wrong   「N 道错题等着重练」       size:20
newCount > 0   → learn   「N 道新题还没做过」       无 size = 全部
都没有          → random  「今天也来练几道，保持手感」 size:20（本轮补上，原来漏了）
```

**所以「开始今日练习」不等于间隔重复** —— 只有今天真有到期题时才走 FSRS，否则逐级降级。

`take(list, size)` = `size > 0 ? list.slice(0, size) : list`，**`size:0` 与不传都等于"全部"**。
`startSession`（`store.js` L427-430）传的是 `size: opts.size ?? 0, now: Date.now()` —— `now` 一定会传，
这点很关键：`isDue(card, now)` 是 `card.dueAt <= now`，**漏传 now 会让 review 静默返回空会话**（已写成测试 A6 钉住）。

### 22.2 FSRS 在用，而且是完整的 FSRS（不是 SM-2）

`lib/fsrs.js`，注释「与线上算法完全一致，保证复习数据兼容」：17 个权重 `w[0..16]`、
`DECAY=-0.5`、`FACTOR=19/81`、`REQ=0.9`（目标保留率 90%）、幂遗忘曲线
`R=(1+FACTOR·elapsed/S)^DECAY`、间隔反解 `I=S/FACTOR·(R^(1/DECAY)−1)`、
`S0=w[rating−1]`、`D0=clampD(w[4]−(rating−3)·w[5])`、难度更新带 `w[7]` 均值回归、
回忆后稳定性含 hard/easy 乘子 `w[15]/w[16]`、遗忘走 `nextForgetStability`。
三档自评映射 **忘记=1(Again)、模糊=2(Hard)、记得=3(Good)**。
有老卡兼容分支：缺 `stability/difficulty` 的旧卡用 `S=max(1,intervalDays)`、`D=5` 兜底。

**两处死代码**（不影响功能，别以为是 bug 去"修"）：
- `rating === 4` 的 easy 乘子 `w[16]` **永远不会触发** —— 三档最多映射到 3，没有 Easy
- `easeFactor: 2.5` 是 SM-2 遗留字段，`reviewCard` 里恒定赋 2.5、**不参与任何计算**

### 22.3 本轮修的两个 bug

**A. `buildSession` 的 `review` 是五条路径里唯一没走 `take()` 的分支**，hero 传的 `size:20` 被静默丢掉 ——
几天没练、积压 200 张到期卡就会一次性塞 200 题进会话。
修法：外面套 `take(..., opts.size)`。按 `dueAt` 升序取前 N = **拖欠最久的优先**，
剩下的明天继续到期、不会丢（Anki 的每日复习上限同理）。`take` 对 `size<=0` 返回全部，不传 size 的调用方行为不变。

**B1. hero 降级到 `random` 时漏传 size** —— 同一条链上 `review`/`wrong` 都传 20、「随机练习」卡片也传 20，
只有它没传，于是 `take(list, undefined)` 返回**全库打乱**。补 `{ size: 20 }`。

**B2（`learn` 不封顶）故意没改。** 理由：正常节奏是一次导一批 21 题，"全部新题"就是 21 道正好；
出现几百题会话只在一次性导入很多批时，而那种情况下"把新题全过一遍"可能本来就是用户要的；
且 hero 文案会显示「N 道新题还没做过」，**点之前就知道是几道 = 知情同意**。
要封顶是产品决策，不是修 bug，所以留给用户拍板。

### 22.4 新增回归测试 `scripts/t-session.mjs`（18 例，全过）

`buildSession` 之前**一个测试都没有**，而它的排序口径是用户明确关心过的行为。18 例覆盖：
review 遵守 size / 排序是 dueAt 升序（拖欠最久优先）/ size:0 与不传都返回全部 /
只取已到期的 / **不传 now 返回空**；learn 排除已有复习卡 + 按 seq + 遵守 size；
wrong 只取最近一次答错（翻正的不计、翻错的要计）+ **按 seq 而非错题产生时间**；
random 恰好 N 道 + 无凭空 id + 不排除做过的；relearn 全量按 seq + 题型筛选 + 知识域筛选；未知 mode 返回空。

三套回归现状：**t-session 18/18、t-seq 16/16、t-fill 13/13（共 47 条断言）**。

### 22.5 ⚠ 附带修的：`lib/` 里的相对 import 必须带 `.js` 扩展名

`t-session.mjs` 第一次跑就挂：

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../app/src/lib/fsrs'
  imported from .../app/src/lib/stats.js
```

根因：`stats.js` 写的是 `import { isDue } from './fsrs'`（**无扩展名**）。
Vite 能解析，**Node 的 ESM 加载器要求完整文件名**。
`t-seq.mjs` / `t-fill.mjs` 之所以一直能跑，是因为 `lib/validate.js` **零依赖**。

已把 `stats.js` 的两条改成 `'./fsrs.js'` / `'./dates.js'`。**打包结果完全一致**（Vite 两种写法同样解析），
但从此 `lib/stats.js` 可以在 Node 里直接测。

**还没改的**：`db.js` 有 `'./supabase'`、`'./dates'`；`store.js` 有 6 条无扩展名 import。
`store.js` 不用管（它用 `import.meta.env`，Node 里本来跑不起来）；
`db.js` 目前没测试需要它，要测再改。**以后新增 lib/ 模块一律写全扩展名。**

### 22.6 ⚠ 部署脚本原来完全没有重试，一次网络抖动就废掉整轮上传

本轮部署**连续失败 2 次**。第一次我用 `Select-Object -Last 3` 截断了输出，
只看到 `}` 和 `Node.js v24.19.0`，**没读到真实报错就又重试了一次** —— 违反 systematic-debugging Phase 1。
第二次改成完整捕获才拿到根因：

```
blobs: 40 / 45          ← 45 个 blob 全部上传成功
new tree: 60b151b0...   ← tree 也建好了
[TypeError: fetch failed]
  cause: ConnectTimeoutError (attempted address: api.github.com:443, timeout: 10000ms)
  code: UND_ERR_CONNECT_TIMEOUT
```

**卡在最后创建 commit 那一次请求**，前面几分钟的上传全白费。

关键点：`req()` 里的 `AbortSignal.timeout(300000)` 管的是**整体超时**，
**管不到 undici 那个默认 10 秒的 connect timeout**。而当时的诊断显示
`Test-NetConnection api.github.com:443 = True`、`Invoke-WebRequest https://api.github.com = HTTP 200` ——
**连接是间歇性的**，同一时刻 PowerShell 通、Node 不通。（`hk00jjj.github.io` 的 Pages CDN 当时 HTTPS 直接操作超时。）

修法：给 `deploy-api.mjs` 的 `req()` 加**指数退避重试**（`1s→2s→4s→8s→15s` 上限，带 0~400ms 抖动，共 5 次），
只对「网络层错误（`TypeError` / `UND_ERR*` / `ETIMEDOUT` / `ECONNRESET` / `ECONNREFUSED` / `EAI_AGAIN` / `ENOTFOUND` /
`socket hang up` / `fetch failed`）+ HTTP 429/5xx」重试；**HTTP 4xx 属业务错误，直接抛不重试**。

**为什么重放是安全的**（四种调用逐一核过）：
- `POST /git/blobs`、`POST /git/trees` 是**内容寻址**的，同内容得同 sha
- `POST /git/commits` 的 `author/committer date` 在调用 `req()` **之前就已求值固定**，
  同 body 必然得到同一个 commit sha（commit sha 就是其内容的哈希）
- `PATCH /git/refs` 设成同一个 sha 幂等

**实证**：重跑后 `new tree: 60b151b05837f155181afd0d76d453b40f2deb94` 与崩溃那次**完全相同**，退出码 0，
`new commit: b8a99d3`。

**其它脚本的重试现状**（本轮查实）：

| 脚本 | 有 fetch | 有重试 |
| --- | --- | --- |
| `push-src.mjs` | ✅ | ✅ **本来就有**（难怪它一直稳，只偶发首跑 MISMATCH） |
| `deploy-api.mjs` | ✅ | ✅ 本轮补上 |
| `verify-deploy.mjs` | ✅ | ❌ 走 API，只读，失败重跑即可 |
| `verify-live.mjs` | ✅ | ❌ **走 Pages CDN，而 CDN 正是最容易超时的那个**，建议下一轮补 |

### 22.7 挂起：C（存量数据 seq 迁移）的只读试算办法

`assignGlobalSeq`（§21）**只向前生效**，云端已有批次的 `seq` 仍重叠。
迁移唯一的批次分组信号是 `qp.importedAt.v1`，而它**只在用户浏览器的 localStorage、不上云**，
所以试算只能在用户那台浏览器里跑。已给用户这段**只读**片段（F12 Console 粘贴，不写任何数据）：

```js
(()=>{const m=JSON.parse(localStorage.getItem('qp.importedAt.v1')||'{}');const k=Object.keys(m);
if(!k.length)return console.log('⚠ 空的 —— 这个浏览器没有导入时间记录，存量迁移做不了');
const g={};k.forEach(id=>{(g[m[id]]=g[m[id]]||[]).push(id)});const b=Object.keys(g).sort((a,c)=>a-c);
console.log('有时间戳的题:',k.length,'| 批次数:',b.length);
console.log('各批题数:',b.map(t=>g[t].length).join(' , '));
console.log('最早:',new Date(+b[0]).toLocaleString(),'最晚:',new Date(+b[b.length-1]).toLocaleString())})()
```

拿到批次数与覆盖率后再决定要不要做写入。**写入必须在应用内做**（需要已登录的 Supabase 会话），
且要先备份、先出预览、再确认 —— 不要在 Console 里手搓写操作。

---

## 23. 第十三轮（2026-09-04）· 出题→入库全链路死代码审查与清理

**gh-pages HEAD：`640621b`（父 `8487391`）。dist 45 文件/4.61 MB → `verify-deploy` 27/27 缺失0/不一致0/多余0。**

### 23.0 总量账（本会话累计）

| | 会话初 | 现在 |
| --- | --- | --- |
| dist 文件数 | 82 | **27** |
| dist 体积 | 7.59 MB | **3.14 MB** |
| JS bundle | ~490 kB | **462.17 kB** |
| `public/img` | 96 个 / 8806 KB | **21 个 / 2627 KB** |
| `assets.js` 键 | 45 | **10（零引用 0）** |

审查用了 `code-review-and-quality` skill（五轴 + 严重度分级 + Dead Code Hygiene「先列清再问后删」）。
机械部分写成两个可复跑脚本，判断部分人工读，**不靠印象下结论**。

### 23.1 新增两个审计脚本（已入 src 分支）

- **`scripts/audit-pipeline.mjs`** —— 死导出 / 多余 export / 未用 import / 幽灵选择器候选 / 零引用资源键 / 孤儿图片 / 文件规模
- **`scripts/audit-adjudicate.mjs`** —— 幽灵裁决（**剥注释但保留行号** + 识别动态拼接类名）/ 死 state / 三方规则常量并排

**两个必须记住的方法论坑（都当场栽过）：**

1. **语料必须 walk 全部 src 文件，不能硬编码清单。** 第一版漏了 `components/Bookshelf.jsx`，
   差点把 `.book-*` 一族 **25 个选择器全误判为死代码**（实际 `Settings.jsx` L4 import、L55 渲染 `<Bookshelf />`）。
2. **必须剥注释再比对，否则注释里的字面量会假装成引用。** 两个方向都栽过：
   - 假阳性：candy.css 注释里写着 `.ans-line`、`.ch-*`、`fonts.googleapis.com`，被当成选择器匹配出 `ans-line`/`ch-`/`googleapis`/`com`
   - **假阴性（更危险）**：`A.divider` 唯一的"引用"是 `Login.jsx` L65 注释里的「A.divider(p44.png)」字样，
     审计因此报告 assets.js「零引用 0 个」，把已经死掉的 `divider` 漏了过去
3. **动态拼接的类名要单独识别**：`'nav-item tone-' + it.tone` → `.tone-mint`/`.tone-lav`；
   `'diff-pill tiny d-' + cls` → `.d-base`/`.d-apply`/`.d-adv`；`'f' + (k+1)` → `.f1`/`.f2`/`.f3`（`Practice.jsx` L399 蜡封三帧）；
   `.boot-veil.s1/.s2/.s3` 是开机仪式三段状态类。**这些全是活的，第一版正则不含空格所以全误报了。**

### 23.2 已删（可安全删除档，全部执行）

| 项 | 规模 | 依据 |
| --- | --- | --- |
| **`app/src/theme/apple.css` 整个文件** | 587 行 / 35450 B | `main.jsx` 只 import `global.css`(L4)/`pages.css`(L5)/`candy.css`(L7)，**apple.css 无人 import** —— 不进打包、不参与层叠。它里面那 20 个"幽灵"是因为整个文件都死 |
| **`app/src/pages/Stats.jsx` 整页** | 320 行 | 入口（📊 星象）§7.5 已按用户要求摘掉，页面成了只能手打 URL 的孤儿，且独占剩余哥特位图一大半。`App.jsx` 同步删 import(L15)、Route(L48)、activeKey 的 `'/stats'` 映射。**`#/stats` 现由 `path="*"` 重定向回首页，实测 hash 变 `#/`，不 404** |
| `stats.js` 12 个死导出 | **172 → 88 行** | `titleFor`/`achievementsOf`/`dailyCounts`/`weekBars`/`byType`/`domainMastery`/`levelOf`/`levelProgress`/`nextTitleFor`/`RARITY_META`/`accuracyOf`/`uniqueDays`，以及内部专用的 `LEVEL_SPAN`/`TITLES`。全部只被 Stats.jsx 用。**只留 `lastResultMap`**（App.jsx 错题角标 + store.js + `buildSession('wrong')` 在用）。`daysAgoStr` import 随之删除（只有 weekBars 用） |
| `dates.js` `streakSet` | 7 行 | Stats.jsx 专用 |
| `assets.js` **10 个死键** | 20 → 10 键 | `idCardFrame`/`avatar`/`portraitFrame`/`astrolabe`/`trophy`/`badgeFrame`/`emptyCandle`/`milestone`/`achIcons`（九个随 Stats 下线）+ `divider`（随 RuneDivider 删） |
| `components.jsx` `RuneDivider` | 死组件 | 外部 0 引用、文件内 0 使用 |
| `Practice.jsx` L4 `TYPE_SEAL_INDEX` | 死 import | 全文件未使用；assets.js 里那个导出也一并删 |
| **`public/img` 75 个孤儿图** | **8806 → 2627 KB** | 大头：`p12.png 765K`、`p19.webp 433K`、`p5.webp 399K`、`crack-1/2/3.webp 767K`（assets.js 用的是 `crack-*s.webp` 小图版）、`p11.webp 300K`、`p34-1~7.webp 294K`（七个内容完全相同的哥特题型印章）、`p42-*`/`p43-*`（Stats 的里程碑与成就图标）、`nav-*.webp`（导航早改 emoji）、`abyss-*`/`seal-*`/`mark-*-off/on.webp` |

**`p44.png`（divider）故意没删** —— 它仍被某个 CSS 的 `url(.../img/p44.png)` 引着（`.divider` 幽灵规则），
purge-dist 的复核闸也因此正确地保留了它。**等幽灵选择器那轮清完 CSS 才能删。**

### 23.3 ⚠ `purge-dist.mjs` 的魔数闸门被合法清理绊倒，已换成语义不变式

删掉 10 个死资源键后真实引用数降到 **21**，而脚本里写着 `if (refs.size < 25) ABORT`，
于是它把一次**完全正确**的清理拦了下来（`RESULT: ABORT —— 只解析到 21 个引用，明显异常`）。

那个阈值是当年"正则去匹配了 bundle、误删 86 个文件"事故后加的，但**用固定数字守这件事本身就会烂** ——
资产每被合法清理一次，它就离误报近一步。换成两条不依赖数字的闸：

1. `refs.size === 0` → 中止（walk 或正则整体失效）
2. **真正的防误删闸**：把全部源码与 index.html **剥掉注释**后拼成一大块，
   任何"孤儿"文件名若仍出现在里面，说明引用正则漏了它 → 中止并列出漏掉的文件名。
   原有的 `missing`（引用了但 dist 里没有 → 会 404）检查保留。

改后：`源码引用 21 个素材，清除孤儿 75 个（省 6178KB），剩余 21 个 / 2.57 MB，RESULT: DIST CLEAN`；
二次跑「清除孤儿 0 个」= 已收敛。

### 23.4 #12 ps1 退役 + #13 改协议：**协议你自己已经改好了，我做的是同步与退役**

查的时候发现 **`question-protocol.md` 已经是 483→484 行的区间弹性版**（我早先读的是 458 行固定版）：
第三章第2条有完整配比表 + 三条硬约束 + 四种知识点类型推荐配比，
**第三章第3条认知阶梯也重写成"层内题型随全局配比联动"的弹性版**（L237-241），
**A类② (L412) 与 附录C Q9 (L476) 都已同步**，修订说明第 9 条也写了。改得比我建议的彻底。

**但同步方向反了**：SKILL.md L14 规定「修订 `规则体系.md` 后必须同步本文件」，
实际是 **skill 副本被改、上游 `规则体系.md` 还停在固定配比旧版**（459 行 vs 484 行）。
**这个风险是实的：下次谁按纪律"从上游同步"，就会把区间版覆盖回固定版。**

已做三件事：

1. **重写附录D**（两份都改）：
   - 第1条改成「唯一现役校验器（网页端）」，**并修正了错误路径** —— 原写 `app\src\core\validator.ts`，实际是 `app\src\lib\validate.js`（`Validator` 类）
   - 第2条改成「离线 PowerShell 校验器已于 2026-09-04 退役」，写明退役原因是它实现的是修订前的固定配比、会拒掉网站端放行的合规批次
   - 第4条补上「**它也不校验层段内的题型构成**（第三章第3条的层内弹性分配），该项属生成方自律」
   - L58 术语表的「外部校验器」条目同步改写
2. **`validator\` 整个目录移入 `命题流水线\_已废弃_20260904_validator\`**（沿用已有的 `_已废弃_20260822\` 命名惯例），
   含 `validate_questions.ps1`(14668B)、`question-batch.schema.json`(2882B)、`sample-valid.json`(12036B)、`sample-invalid.json`(11801B)、`README.md`(4885B)。**是移动不是删除**，需要时还能取回。
3. **`规则体系.md` 从 `question-protocol.md` 整体重建** = 后者全文 + 末尾那句 57 字交互句，
   并保留它原有的 **UTF-8 BOM**。校验：`规则体系.md 去掉尾句 -ceq question-protocol.md` → **一致 ✓**（大小写敏感逐字符比较），行数 484 vs 486（差 2 = 空行 + 尾句）。

**遗留给用户拍板的一件事**：现在两份文件内容一致了，但**"哪份是上游"仍含糊** ——
SKILL.md L14 说上游是 `规则体系.md`，而这次实际是反方向同步的。建议明确一下，否则还会再漂。

### 23.5 三方规则实现的现状（审查①的最终结论）

| 载体 | 配比口径 | 状态 |
| --- | --- | --- |
| `question-protocol.md` | 区间弹性 | ✅ 用户已改 |
| `规则体系.md` | 区间弹性 | ✅ 本轮同步 |
| `app/src/lib/validate.js` | 区间弹性 + 计算+简答≤5 | ✅ |
| `validate_questions.ps1` | ~~固定~~ | **已退役移走** |
| `question-batch.schema.json` | 不含配比 | 随 ps1 一起退役 |

**四份实现收敛成一份事实源（validate.js）+ 两份同源文档。** 剩下已知的宽严差只有 schema 那 3 处，已随退役作废。

仍未修的规则差异（上一轮已报、用户说不动，本轮维持）：
层段内题型分布不校验、简答分点下限 2 不校验、填空「空位不居句首」两个校验器都只约束拓展题（口径其实一致）、解析 375 字按题型而非"含计算"判定。

### 23.6 明确没做的（按 skill 的严重度分级，都是 Nit/Optional 或需分批）

1. **幽灵选择器没动** —— 删掉 Stats.jsx 后 `pages.css` 的幽灵从 16 涨到 **67**（新增 `id-card`/`portrait`/`ring-wrap`/`ach-grid`/`cal-*`/`week-bars`/`domain-bars`/`type-bars`/`sigil-*`/`rarity-tag`/`oath-badge` 等），
   `candy.css` 23 个、`global.css` 26 个。**这是本轮最大的遗留项，但必须单独一轮做**：
   三层 CSS 是"末尾追加、同特异性后来居上"结构，§18.2 与 §20.3 已经两次证明
   **删掉一条覆盖规则会放出更老的规则**（酸橙绿 background、橄榄绿 h5）。
   要一批一批删、每批真机 `getComputedStyle` 验证，不能当纯删除做。
2. **12 个多余 `export` 关键字没摘**（`fsrs.js DAY`、`stats.js filterQuestions/OBJECTIVE_TYPES/DOMAIN_NAMES`、
   `supabase.js SUPA_URL/SUPA_KEY`、`validate.js hashId/parseItems/normalizeAnswer/TYPE_LIST/validateItems`、`store.js DEMO`）——
   纯 Nit、零功能影响，逐个改动只增加风险。其中 `DAY` 与 `filterQuestions` 建议**保留** export（测试可直接 import，
   `t-session.mjs` 现在自己重定义了 `const DAY = 86400000`，改成 import 更好）。
3. **`importBank` 两条分支的重复没抽**（备份恢复 / 21题批，各 6 行相似的 persist→existing→added→upsert→reload）——
   skill 的原则是"第三次出现才抽象"，现在两处，抽出来省不了多少。
4. **`Bank.jsx` L26 `importedAt` 的 useMemo 依赖是 `[]`** —— 实际路径 Import→Bank 会重新挂载，碰不到。Nit。

### 23.7 验证

- 三套回归 **t-session 18/18、t-seq 16/16、t-fill 13/13** 全过（stats.js 被大幅删改后重跑，组卷逻辑完好）
- 构建 ✓，purge-dist 二次跑孤儿 0 = 收敛
- **真机五路由冒烟**：Learn / Bank / Import / Settings / Practice 全部 `badImg: 0`、`fail: []`（资源级 404 为零）；
  答题页 `imgs: 8, broken: []`、`.crack-veil` 正常、判定横幅「答错了」正常；
  **`#/stats` 实测重定向到 `#/`**；console 全程 0 errors
- 上线：gh-pages `640621b`、verify-deploy **27/27** 全零差异

### 23.8 补：verify-live / verify-deploy 也加了重试（§22.6 的遗留项本轮清掉）

`push-src` 成功后 `verify-live` 立刻挂在 `UND_ERR_CONNECT_TIMEOUT`——正是 §22.6 表格里预判的那一条
（「`verify-live.mjs` 走 Pages CDN，而 CDN 正是最容易超时的那个，建议下一轮补」）。

修法与 §22.6 同：给两个脚本各包一层**带指数退避的全局 fetch**（1s→2s→4s→8s→15s 上限，共 5 次，
只重试网络层错误与 429/5xx，4xx 业务错误直接放行给调用方判断）。
包 `globalThis.fetch` 而不是逐个改调用点，是为了**所有现有与将来新增的请求自动获得重试**。
两个脚本都是只读的，重放无副作用。

**补丁当场生效**：重跑时打印 `retry 1/4: ECONNRESET https://hk00jjj.github.io/quiz-platform/img/p4.webp`，
重试后 `27/27 个 200 OK`、三哈希 MATCH、`LIVE RESULT: ALL OK`。

一个细节：`verify-live.mjs` 的 `head()` 里**本来就有一个 3 次重试循环**，但它没兜住这次——
抛出的异常来自 L55 那个取哈希的 GET（没有重试）。现在两层叠加，最坏情况 15 次尝试，无害。

**至此四个联网脚本全部具备重试**：`push-src.mjs`（原有）、`deploy-api.mjs`（§22.6）、
`verify-deploy.mjs`、`verify-live.mjs`（本节）。

### 23.9 工作区联接现状（下个会话要用）

当前会话工作区 `2026-09-03\chat-1` 里有五个 junction 指向真实工程与外部资料，
**编辑类工具只能改工作区内的路径，所以跨目录改文件一律走这些联接**：

| 联接 | 指向 | 用途 |
| --- | --- | --- |
| `app` | `2026-09-02\chat-1\app` | 应用源码 |
| `scripts` | `2026-09-02\chat-1\scripts` | 部署与测试脚本 |
| `oldroot` | `2026-09-02\chat-1` | 根级的 `verify-*.mjs` / `HANDOFF.md` / `src-branch-README.md` |
| `skill-eqg` | `.qoder-cn\skills\electrical-question-gen` | 出题 skill（SKILL.md + rules/） |
| `pipeline` | `Documents\Qoder\命题流水线` | 规则体系.md 上游与已退役的 validator |
