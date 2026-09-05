# 糖果题库（quiz-platform）交接文档 · 给下一个账户

> 本文是**自包含**的入门文档：不读本文之外的任何会话记录也能接手。
> 逐轮详细历史见项目根 `HANDOFF.md`（2024 行，§1–§30）。本文只浓缩"必须知道"的部分。
> 最后更新：2026-09-05，对应 gh-pages `81047af`（§36）。

---

## 0. 三十秒速览

- **是什么**：电气自动化刷题站（教师自用），糖果/马卡龙/果冻视觉主题。React 18 + Vite 5 + zustand + react-router(HashRouter) + @supabase/supabase-js；**纯 CSS，无 Tailwind**。
- **在哪**：项目根 = `C:\Users\青丘白浅\Documents\QoderCN\2026-09-02\chat-1`（含 `app/`、`scripts/`、`HANDOFF.md`、`verify-*.mjs`）。
  ⚠ Qoder 的"工作区"是按日期新建的文件夹（如 `2026-09-03\chat-1`、`2026-09-04\chat-1`），**项目本体不跟着走**；
  工作区里的 `app/` 等是指向项目根的 junction。找不到项目根时按 `app/src/theme/candy.css` 或 `HANDOFF.md` 全盘搜。
- **仓库**：`github.com/HK00jjj/quiz-platform`，三个分支：`gh-pages`（站点产物）、`src`（源码备份）、`main`。
  站点地址 `https://hk00jjj.github.io/quiz-platform/`（`vite base = '/quiz-platform/'`）。
  **本地没有 git 工作区**，全部走 GitHub Git Data API 脚本推送。
- **当前状态**：gh-pages HEAD `fadc51c`；`verify-deploy` RESULT: IDENTICAL；console 0 errors。
  ⚠ 教训（§33）：编辑器里的 `:root` 原位编辑曾被陈旧缓冲区回吐——§31 声称的 token 提纯整块丢失，
  §33 已按原值补齐。凡"声称改过"的样式，接手时先 grep 磁盘实况再信文档。
- **token**：**不在仓库任何文件里**。部署/推送需要 GitHub PAT，由用户当面提供。
  严禁把 token 写进任何会被 push 的文件（`HANDOFF.md`、本文、src 分支都会公开）。`push-src` 的忽略清单含 `.env`。

---

## 1. 目录与关键文件

```
<项目根 2026-09-02\chat-1>/
  app/                  ← 唯一构建源（dist/ public/ src/ tests/ index.html vite.config.js package.json）
    src/
      theme/            global.css → pages.css → candy.css（candy.css 是权威层，见 §4）
      pages/            Learn.jsx Practice.jsx Bank.jsx Import.jsx Settings.jsx Login.jsx …（Stats.jsx 已删）
      components/       CandyBoot.jsx（导航/开机仪式/useScrollReveal） CandyIcons.jsx（8 个自绘 SVG） components.jsx
      lib/              fsrs.js（间隔重复） stats.js（buildSession 五模式） validate.js（入库校验+assignGlobalSeq）
                        store.js（zustand） db.js dates.js assets.js
  scripts/              purge-dist.mjs deploy-api.mjs push-src.mjs（部署三件套）
  verify-deploy.mjs     远端 gh-pages 与本地 dist 逐文件比对
  verify-live.mjs       线上 URL 拉产物比对哈希
  verify-books/candy/fill/ui/scroll.ps1   各页真机截图回归（PowerShell）
  HANDOFF.md            逐轮历史日志（§1–§30）
  NEXT-ACCOUNT-HANDOFF.md   本文件
  shots/ .playwright-cli/   截图与浏览器会话缓存
  pipeline/             出题流水线资料；validator 已退役到 pipeline/_已废弃_20260904_validator/
  skill-eqg/            出题 skill（SKILL.md + rules/question-protocol.md）
```

⚠ **根目录还残留一套重组前的 `package.json / vite.config.js / index.html / public/ / src/`**。
构建与部署一律用 `app/`，**不要在根目录跑 build**。这套残留是否清理需用户拍板（见 §9 待办）。
根目录的 `*-out.txt`、`verify-*.png`、`probe.js`、`smoke-*.png` 是历史日志/截图 clutter，可清但需用户同意。

---

## 2. 运行 / 构建 / 部署 / 验证（照抄即可）

```powershell
# 0) dev server（必须显式 --host 127.0.0.1，否则 Vite 只绑 IPv6 ::1，IPv4 连不上）
#    后台终端会被回收导致 server 死掉 → 用 Start-Process 脱离式启动
cd <根>\app
Start-Process -FilePath "npm.cmd" -ArgumentList 'run','dev','--','--mode','demo','--port','5173','--host','127.0.0.1' -WindowStyle Hidden

# 1) 构建 + 清理 dist 孤儿
cd <根>\app ; npm run build
cd <根>     ; node scripts\purge-dist.mjs          # 期望 RESULT: DIST CLEAN

# 2) 部署到 gh-pages（<TOKEN> 由用户提供；<msg> 是 commit message）
node scripts\deploy-api.mjs <TOKEN> "$PWD\app\dist" "<msg>"   # 末尾打印 new commit: xxxxxxx

# 3) 等 CDN/缓存 ~22s 后比对远端
Start-Sleep 22 ; node verify-deploy.mjs <TOKEN> "$PWD\app\dist"
#    期望：本地 26 文件 / 远端 26 文件 / 缺失 0 / 内容不一致 0 / 远端多余 0

# 4) 源码备份到 src 分支（路径列表可按需增删；HANDOFF.md 也在其中 → 会公开，勿含密钥）
node scripts\push-src.mjs <TOKEN> "$PWD\app" "$PWD\scripts" "$PWD\src-branch-README.md" "$PWD\verify-deploy.mjs" "$PWD\verify-live.mjs" "$PWD\verify-books.ps1" "$PWD\verify-candy.ps1" "$PWD\verify-fill.ps1" "$PWD\HANDOFF.md"
#    期望：回读校验 本地 N / 远端 N，缺失 0 … + RESULT: SRC BACKUP OK

# 5) 等 ~40s 后验证线上
Start-Sleep 40 ; node verify-live.mjs "$PWD\app\dist"      # 期望 LIVE RESULT: ALL OK
```

固定顺序：**build → purge → deploy → verify-deploy → push-src → verify-live**。
产物基线（2026-09-04）：dist 26 文件 / ~3.05 MB；CSS ≈ 112.6 kB；JS ≈ 467.3 kB。

---

## 3. 真机验证（playwright-cli）

- 用**原生命令**：`open / goto / reload / click / hover / fill / screenshot [--hires] / console error / localstorage-clear / resize`。
  不要 `run-code` 手搓（其 `console.log`/`return` 不回传）。
- 取回数据：`playwright-cli --raw eval "<js 表达式>"`（表达式结果会回传；需要多值就 `JSON.stringify(...)`）。
  `run-code` 里想回传就 `page.evaluate(v => { window.__p = v }, x)` 存到 window 再 `--raw eval` 读。
- **装 PerformanceObserver 等"文档级"钩子必须 `addInitScript`**，且它只在新 document 生效：
  同 URL 的 `goto` 是同文档导航不触发 → 先 `goto about:blank` 再进目标页；`eval` 装的观测器会被 `reload` 销毁。
- HashRouter SPA 强制真重载：`goto about:blank` → `goto <url>#/xxx` → `localstorage-clear` → `reload`。
- 元素截图：`screenshot '<selector>'`；整页：`screenshot --filename=shots/x.png` 后用 Read 看。

---

## 4. CSS 三层架构与五大陷阱（最重要的一节）

层序：`global.css → pages.css → candy.css`。**candy.css 是权威层**：全站从"哥特暗色"迁移到"糖果"时，
约定是**在 candy.css 末尾追加 + `!important` 覆盖哥特层**，而不是去改 pages.css/global.css。

1. **删覆盖规则会放出更老的规则。** 想改某个样式，先确认它在三层里各被谁设过；删 candy 的覆盖 = 放出 pages/global 的老值。
2. **覆盖要穷举所有变体。** `.front / .back / :hover / .flipped / .active` 漏一个就残留哥特底。
   已踩四次：§18.2、§20.3、§25（牌背 `.back .face-in`）、§27.2（牌面 `.front .face-in` 灰块）。
3. **"被引用但被 CSS 否决"的死素材。** 引用式审计（grep 文件名）会判活，但那条引用可能已被 `!important` 盖掉
   （例：`A.titleDecor`/p45.png 被 `background-image:none !important` 否决）。查孤儿素材要看引用它的样式是否被否决。
4. **审计假阳性要靠量计算样式。** 例：`.tarot-scroll` 的"深灰边"实测 `borderWidth:0`；`--glow-teal` 已被 candy.css 重定义为薄荷光。
   下结论前 `getComputedStyle` 实测。
5. **React 重渲染会用 JSX 的 `className` 整体覆盖 DOM class。** 任何由非 React 代码（IntersectionObserver 等）
   加的 class 都会在下一次重渲染被抹掉 → 这类状态用 **data 属性**承载（现例：滚动入场用 `.reveal[data-in]`，见 §29 事故）。

---

## 5. 视觉设计系统与红线（糖果主题）

- **配色**：奶白渐变底 + 粉桃/薄荷/柠檬/薰衣草四色 + 果冻玻璃 + 大圆角（`--r-xs 12px ~ --r-xl 28px`）+ 弹性缓动。
  token 在 `candy.css :root`。文字压白底用 `--pink-ink #C2385A`（原 `#D14767` 只有 4.0:1，不过 WCAG AA）。
- **图标**：`components/CandyIcons.jsx` 8 个自绘 SVG（24×24、1.7px 圆头细线、`currentColor`）。
  **不用 emoji 当图标系统**、不用 Lucide/FontAwesome/Material 粗描边库。
  入口卡中央的大 emoji（🍮🍭🍡）是 CSS `::before` 装饰插画，**刻意保留**。
- **动效纪律（性能红线，违反会复现历史事故）**：
  - 只动 `transform / opacity`；**不大面积 `backdrop-filter`/`filter: blur`**（曾造成 224ms 频闪）。
  - `infinite` 动画只跑小面积元素；能少则少。
  - 入场用 IntersectionObserver（`useScrollReveal`），**不用 scroll 监听**、不用 blur 做入场。
  - 不用 feTurbulence 噪点（craft-floor 判业余）。
  - `prefers-reduced-motion` 必须降级（`.reveal` 直接可见、光斑停摆）。
- **对比度**：所有正文/标签过 WCAG AA（4.5:1）。`#D14767` 压白底家族已在 §31+§33 清零，
  白/奶白底一律 `--pink-ink #C2385A`（5.2:1）；`.chip` 未选中态 `#A0526D`（5.25:1）；
  小字不用 `--gold-text`（它=#E8607F 只有 3.3:1，仅限 large-text/品牌字）。

---

## 6. 业务架构要点

- **间隔重复**：`lib/fsrs.js`（FSRS，17 权重 / DECAY -0.5 / FACTOR 19/81 / REQ .9）。
- **五种练习模式**：`buildSession` 的 learn(新题上手/入库序) / review(今日复习=间隔重复) / wrong(错题重练/进错题时间序) /
  random(随机) / relearn(挑题练习/入库序)。排序口径用户已确认。
- **入库**：`lib/validate.js` 的 `assignGlobalSeq(incoming, existing)` —— 全局入库序，存量题不迁移、沿用旧 seq。
- **删单题的唯一入口是书库页（#/bank）**；导航第四项（导入与设置之间，tone-lemon）。
- **Stats 页已下线**（`#/stats` 由 `path="*"` 重定向）；`apple.css` 整文件已删。
- **出题侧**：skill 在 `skill-eqg/`（触发词 `原题：`），规则 `rules/question-protocol.md`（区间弹性配比）。
  **PowerShell 校验器已退役**到 `pipeline/_已废弃_20260904_validator/`；网站入库校验 `app/src/lib/validate.js` 是唯一活校验器。
  `pipeline/规则体系.md` 已从 question-protocol.md 重建同步。
- **配图**：题库配图走 SVG 模板 + data URI 内嵌；`public/img` 已清 75 张孤儿图；
  `purge-dist.mjs` 用"语义不变式"安全闸（剥注释后孤儿名仍出现即 ABORT），**不要改回魔数闸**。

---

## 7. 已知坑清单（工具/环境，浓缩）

- **IDE/Read 陈旧缓冲区**：既会回写覆盖修改、也会污染 Read 结果 → 读写关键文件用 `[IO.File]::ReadAllLines/ReadAllText`。
- **PowerShell 5.1** 不支持 `??`；含中文脚本易失败 → 改用 Node.js。
- **长命令会触发守卫误报**（把长串当 rmdir）→ 拆成多条短命令。
- **dev server 会在调用间隔死掉** → `Start-Process` 脱离式启动；且必须 `--host 127.0.0.1`。
- **JSX**：return 根节点只能一个；注释不能放根位置、不能嵌套 `{/* */}`；**esbuild 不查未定义变量** → SVG 图标用了必须 import，否则运行时才崩（§27.4 事故）。
- **GitHub 连接间歇超时** → deploy/push 脚本已带指数退避重试；偶发崩溃重跑即可。
- **形近字损坏**（拒绍/拒绝、栏/栈）→ 写完回读校验。
- `New-Object System.Drawing.Bitmap` 需 `-ArgumentList $W,$H`（位置参数报错）。

---

## 8. 当前状态（2026-09-05）

- gh-pages HEAD **`aa2f71f`**（链：… §44 `b2cd7d5` 修筛选chip回灌+选中态 → §45 `560df4b` 判断题未选态统一 → §46 `b98b18d` 解析失败补返工话术+围栏锚定 → §47 `aa2f71f` 移动端布局）。src 分支与 gh-pages 同步（回读零差异，含 NEXT-ACCOUNT-HANDOFF.md）。verify-live ALL OK。
- `verify-deploy` RESULT: IDENTICAL；console 0 errors；RLS 探测安全（anon key 匿名读返回空集）。
- §31 清新活力批（15 处粉字替换 + 去 fog；⚠ token 部分被缓冲区吞掉，§33 补齐）/
  §32 糖果派对派（糖针+hero 第四色+渐变权重）/
  §33 对比度收尾 12 处 + chips 基色 + token 补齐 + gold 小字三处 + 答题页接图标（IconReveal/IconScroll）
  + 按压补齐（opt-row/judge/stepper/modal-close）+ syncToast 全局提示条 + 删题/回滚健壮性 + 书库卡键盘可达。
  §34 导航派对装点：四色裱花边 + 每槽 tone 软垫 + 激活彩糖针（全静态零动画，零 JSX）；
  ⚠ 别给 .bottom-nav 重设 position（会覆盖 global 的 fixed，导航掉出视口——§34 事故）。
  §35 判断题卡片改裁决色：我的选择对=薄荷绿/错=草莓红/漏选=虚线薄荷（对齐 opt-row 通道），
  答题前 selected 仍是身份色；全站「对=绿/错=红只出现在我的选择上」语义就此统一。
  §36 答错红色再收窄：撤 crack-veil 红晕（题面维持未答色）、答案框改纯白底；
  红色只存在于「我选错的卡」与「解析区」两处。
  §37 答错时正确答案卡不变绿：源码上一账户已改（撤 missed 类），本轮补构建+部署+文档；
  ⚠ WorkBuddy 环境三坑见 HANDOFF §37（emptyOutDir:false / node 直起 vite / 系统 Chrome+--cdp）；
  token 实际在桌面凭据.txt（与 §0 旧说法矛盾，以本条为准：只走 CLI 参数，绝不写进被 push 的文件）。
  §38 题图移出题干：题干纯文字，题图只在解析区、蜡封启封（seal==='broken'）后随答案显影；
  题图唯一渲染点=Practice.jsx 解析区 fbImgUri（顺手修了蜡封未开就渲染图的隐性漏题）。
  §39 节日派对感：hero 彩旗串（静态）+ 入口卡果冻 hover + 结算彩带雨（一次性 1.6s）；
  红线自查全过（transform/opacity only、无新 infinite、reduced-motion 降级），见 HANDOFF §39。
  §40 马戏团元素：hero 粉白条纹帐篷 + lg 按钮条纹底边 + 结算奖章柠檬放射纹（全静态）；
  ⚠ 马戏团条纹用粉不用红——红=答错裁决色（§35），装饰不可侵占语义，见 HANDOFF §40。
  §41 §40 已整轮撤回（用户反馈「太丑了」），现态=§39 派对状态；教训：装饰先出小样拍板再铺（HANDOFF §41）。
  §42 hero 彩旗串也已撤回（用户逐项反馈）。§39 现仅剩：入口卡果冻 hover + 结算彩带雨。
  ⚠ 装饰类改动铁律：先单件小样截图给用户拍板，再实施（§40/§41/§42 三连撤的教训）。
  §45 判断题未选态两卡统一中性粉（边/球/hover 全同色，只差 ✓✗ 符号）；
  红系只属于「选中错误」与裁决 wronged；j-false 旧绿死规则已清理，唯一权威定义在 candy.css §45 块。
  §48 三遍判定制（2026-09-05 新账户首轮）：客观题每批 ×3 随机穿插，三次结果自动折算
  记得/模糊/忘记 推 FSRS（全对/有对有错/全错），手动三档按钮已删除；主观题保留自判单次；
  中途退出按已答折算（flushPendingRatings）。FSRS 算法本身未动。见 HANDOFF §48。

---

## 9. 待办 backlog（按杠杆排序，§33 后更新）

1. **哥特位图 ~2.4MB 去留**（牌背 p6/玫瑰窗 p20/蜡封/裂纹/radio-check 符文框/尖拱铜牌）：删=dist 3.06MB 的最大体积杠杆 + 糖果主题彻底统一；但蜡封/裂纹翻牌仪式感是特色，**需用户看真机截图拍板**。
2. **约 72+ 幽灵选择器**（新增：.rate-btn 基色被变体否决、.fab-stats、.cap、.count-gem、.drop-cap、L74/L239 旧渐变）。清理前逐条确认无动态 class，列清单等拍板。
3. **两套 burstParticles 并存**（components.jsx 旧版供 Login/Import/Learn/TouchRitual，CandyBoot 新版供 Practice）——components.jsx 陈旧缓冲风险消失后归一。
4. **进站卡顿若复测仍卡**：longtask 实测为 0（GPU 光栅掉帧，§30 已缓解）。下一杠杆按序 ① 光斑去漂移改静态 ② 光斑减为两枚 ③ 移除 `.candy-orbs`（都牺牲景深，需用户拍板）。
5. **根目录重组前残留**（package.json/vite.config/index.html/public/src）与根目录 clutter（*-out.txt、verify-*.png）→ 确认后清理。
6. JS chunk 508KB（Vite 警告，supabase-js 大头）可代码分割；`importedAt` 只存本机、换设备丢失（可塞 settings 表）。
7. 入口卡中央 emoji、导航不活跃灰图标、结算奖章 emoji = **刻意保留**，不要"顺手"改。

---

## 10. 用户的工作准则（务必遵守）

1. **在确保质量的前提下尽量减少工具调用**：能并行的并行、能一条命令跑完的合并（build+purge+deploy+verify 串一条）。
2. **同一操作失败 2 次或效果不理想 → 立即调用/安装合适的 skill，不要蛮干。** 此条优先级高于第 1 条。
3. **视觉改动必须真机截图确认**，不能只信构建通过（esbuild 不查未定义变量；CSS 覆盖漏变体只有眼睛/计算样式能发现）。
4. 用户反馈极简（常只有一句话 + 截图）。**按截图精确解读，不要过度装饰** —— 历史教训：§17 曾过度装饰被两次收窄撤回。
5. 删任何东西前先确认；拿不准就问（死代码清理也要先列清单）。

---

## 11. 历史日志索引（HANDOFF.md）

- **§1–§16**：建站、哥特→糖果迁移、登录页糖果化、答题页反馈配色三轮收窄、FSRS 接入、导入校验、配图架构等（细节读原文）。
- **§17** 答对/答错配色初版 → **§18/§20** 撤回过度装饰、定稿"答错只红三处"、purge 魔数闸换语义不变式、verify 加重试。
- **§23** 全链路死代码审查（删 apple.css/Stats/12 死导出/75 孤儿图；ps1 退役；规则体系重同步）。
- **§24** 书库回导航 + Bank 重做。**§25** 牌背去哥特 + 对比度事故修复。
- **§26** 全站视觉升级六项。**§27** 三处残留。**§28** hero 重排。**§29** 翻牌消失（data-in）。**§30** 进站卡顿。
- **§31** 清新活力批 P0+P1（⚠ 其 token 声明未落盘）。**§32** 糖果派对派（糖针/第四色/渐变权重）。
- **§33** 全量复审（撤回 3 假阳性/抓 4 漏判）+ 对比度收尾 + 图标/按压 + syncToast/删题/回滚健壮性 + RLS 探测。

---

## 12. 给下一个账户的第一件事

1. 读本文件 + `HANDOFF.md` 末尾两三节。
2. 定位项目根（§0 的找法），`node verify-live.mjs <根>\app\dist` 确认基线还是 ALL OK。
3. 起 dev server（§2 的 Start-Process 写法），真机打开 `http://127.0.0.1:5173/quiz-platform/#/` 看一遍学习页/书库页。
4. 问用户要 GitHub PAT 再做任何部署；**不要把 token 写进任何文件**。
5. 动手前对照 §4 五大陷阱与 §5 红线；改完走 §2 全链路 + 真机截图。
