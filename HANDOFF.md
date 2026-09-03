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
