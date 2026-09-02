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
| `public/img/` | 77 张素材 / 约 6.7 MB：74 张 WebP + 3 张 PNG（p12/p44/p45，这三张转 WebP 反而变大） |
| `public/fonts/` | Cinzel 700 自托管 woff2（含中文子集扩展） |
| `scripts/` | 部署 / 素材优化 / 引用校验工具 |

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

## 素材管线与性能红线

站点曾因素材体积卡到不可用（85 张 PNG / 53.5 MB，而且 1600px 大图当 44px 小图标用）。
现已优化到 **77 张 / 6.7 MB（dist 共 7.2 MB）**，且**零感知画质损失**：

- 采样上限 = 实际显示尺寸 × 2（2× DPR 视网膜余量），小图标给到 3~8 倍余量；全屏背景一张没缩。
- WebP q92；雕花金线/细边框类（p2/p6/p8/p34/p35/p44/p45 等）用 q95 + `alphaQuality: 100`，避免细金线出现压缩振铃。
- 平滑渐变类转 WebP 反而比 PNG 大（p12 漩涡 / p44 分隔条 / p45 标题装饰条），这三张保留 PNG。
- 未被任何代码引用的素材直接删除（p0/p0-b/p1/p3/p11b/p12b/p13b/p21/p25/p26/p27/p37/p39/p41/p46/p47~p50/p52-*/p54-*/p2-arch）。

```powershell
node scripts/optimize-assets.mjs   # 分级降采样 + WebP 转码 + 删未引用 + 自动改引用
node scripts/ingest-assets.mjs     # 摄入外部新素材（按文件夹名前缀映射到语义文件名）
node scripts/measure-assets.mjs    # 量 alpha 真实边界框 + 雕花边框的金饰剖面（定内缩/九切片值用）
node scripts/normalize-assets.mjs  # 裁透明留白 + 同组素材统一到同一画布/实体尺寸
node scripts/fix-assets.mjs        # 还原转大的素材 + 清死映射 + 引用可达校验
node scripts/check-refs.mjs        # 校验 A.<key> 与磁盘文件一一对应（防 undefined 崩溃 / 404）
node scripts/purge-dist.mjs        # 构建后从 dist 清除无人引用的孤儿素材
powershell -File verify-ui.ps1     # agent-browser 实视口量几何 + 截图（配合 probe.js）
```

### 实测几何常量（不要凭感觉改，这些是用 measure-assets / agent-browser 量出来的）

| 对象 | 实测值 | 用在哪 |
| --- | --- | --- |
| p2 牌体（已裁透明留白，从 2457×4701 原图重取） | 768×1470，比例 **0.5224** | `.bank-item` 的 `aspect-ratio` 与题库牌正面背景 |
| **答题卡牌比例** | `.q-flipper` `aspect-ratio: 720/1000`（**0.72**），宽 `clamp(300px, min(620px,94vw,(100vh-132px)*0.72), 620px)` | 从竖版塔罗比例 0.5224 改为 0.72：牌面可用宽度 297→**481px**，题目+选项+封印一屏读完不用滚 |
| p2 金饰内缘（藤蔓/尖拱/龙首） | 上 29% 右 18% 下 13% 左 19.5% | `.tarot-face .face-in` 的 `inset`（题库牌） |
| **p19 龙首卷轴**（从 5120×2868 原图重取）；`p19-soft` = 降饱和 38% + 提亮 10% 的弱化版 | 1600×896；杆区 x≈5~15% 与 84~92%，焦边 y≈5~14% 与 78~88% | **答题页正面**：`border-image: url(p19-soft) 125 256 179 256 fill / 18px 36px 24px 36px stretch`（边框宽 = 切片×0.14，装饰退为氛围不抢题目） |
| p4 无缝羊皮纸 | 640×640 | `.q-face` 背景（`cover` 等比裁切），整块盖住 p19 被拉伸的中心切片，所以中心怎么拉都看不出来 |
| p6 牌背 | 归一化到与 p2 同一画布 768×1470 | 题库牌背 / 答题入场翻牌封面 |
| p45 标题装饰条 | 1600×324，比例 **4.94** | `.page-head` 用 `width:min(100%,800px)` + `aspect-ratio:1600/324` 锁比例 |
| p35 答案卷轴 | **杆在左右两侧**（不是上下），杆宽约 19% | 已不再使用（答题页正面改成整张羊皮纸后，答案不再套第二张卷轴） |
| 判断题铜牌 | 两张统一到 378×640（原实体比例 .591/.558 不一致） | `.judge-card` 的 `aspect-ratio` |
| 符文选框 / 导航图标 | 实体统一 84 / 112（原先填充率 54.7%~93.1% 不齐） | 选中时不会缩水、五个图标视觉重量一致 |

归一化前的两个坑（已修，别再退回去）：
- **不裁透明留白**：p2 原本左右各有 13%/15% 透明边，`background-size:100% 100%` 下可见牌面只占元素宽度 72%，
  而且裂纹层/翻牌封面按满盒铺会与可见牌面错位。
- **内缩值凭感觉**：曾写成 `26% 12.2% 11%`，实测藤蔓占到 x=13%~27%，题干直接压在藤蔓上。

### 外部补充素材（用户第二批提供，已接入）

| 文件 | 用在哪 |
| --- | --- |
| `nav-learn/bank/import/stats/settings` | 底部导航五柱图标（替掉原来的 emoji），中央誊写图标大 1.4 倍 |
| `mark-radio-off/on`、`mark-check-off/on` | 单选/多选题的符文选框两态 |
| `judge-true`、`judge-false` | 判断题两张对立竖版尖拱铜牌（341×512，2:3） |
| `seal-1/2/3` | 答案蜡封三帧：完整 → 半碎 → 碎裂散开（启封动画） |
| `crack-1/2/3` | 做错时牌面裂纹三帧（682×1024，与卡牌同 2:3，可整牌覆盖零变形） |
| `abyss-1/2/3` | 深渊不可名状剪影（替掉原来手写的 SVG 简笔画），三个方位/周期错开闪现 |

仍缺的素材（影响效果上限）：**七种题型印章**（原 P34-1~7 七个文件完全相同，现在题型在视觉上无法区分）、
音效、术语解释词表。切牌式筛选（文档 5.2）的小卡牌背面与三角法阵底图已由用户提供，功能尚未实现。

**改 UI 时勿犯的性能/视觉红线**：

1. 不要在多个元素上无限动画 `background-position`（原 `.btn` 的 gold-flow 让十几个按钮永久重绘，是卡顿主因）；
   流光一律用 `transform` 位移的伪元素，走合成器不触发重绘。
2. 长列表（题库一页 50 张牌）用 `content-visibility: auto` + `contain-intrinsic-size`，屏外卡牌不参与绘制。
3. 牌面图用 `aspect-ratio: 1066/1600` 锁死 2:3 配 `background-size: 100% 100%` 才能零变形；
   用九切片 `border-image` 会把 130px 厚的花纹压成 26px，卡牌就会「扁得不像塔罗牌」。
4. 页面标题装饰条（p45，1600×324）必须 `no-repeat` + `100% 100%`，否则会被平铺裁切只剩左上角一块。
5. `assets.js` 里有模板字面量 `` img(`p34-${i}.webp`) ``，批量改扩展名时最容易漏它（已因此踩过坑）。

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

- 答题页正面是**一整张摊开的羊皮纸卷轴**（p19-soft 九切片做龙首杆 + p4 无缝纹理做纸面，纹理上叠一层近纸色洗白把权重压到约两成），
  牌面内容分**三个分区**：`.zone-q` 题目区（最亮底板，层级最高）/ `.zone-a` 作答区 / `.zone-s` 答案区（封印态=暗红虚线框，启封后=实线），
  分区之间用 `.zone-rule`（p44 铜质藤蔓条）分隔，每区有 `.zone-label` 小标题。
  牌背仍是 p6 塔罗牌背（`cover` 居中裁切，不拉伸玫瑰窗）——翻牌的叙事就是「塔罗牌翻过来变成一张摊开的卷轴」。
- **不要在翻牌容器或其祖先上用 `content-visibility: auto`**：它隐含 `contain: paint`，而 paint containment 是 3D 分组属性，
  会把 `preserve-3d` 压平、`backface-visibility` 失效 → 正反面同绘、牌背文字镜像叠在正面上（看起来就是“正反面内容反了”）。
  另已加一道硬切换保险：翻到一半时用 `transition: visibility 0s linear <半程时长>` 交换两面。
- 底部导航的显示条件**不能依赖会话 `phase`**（旧代码 `!inPractice && phase==='idle'`）：用浏览器后退/直接改 hash 离开答题页不会走
  `abortSession()`，phase 就永远停在 answering/feedback/done，导航从此消失。现在只看路由，并在离开 `/practice` 时主动 `abortSession()`。
- 答案默认被蜡封条遮住（`.seal-lock` 在 `.zone-s` 内）；答题后蜡封三帧碎裂，
  答案以**墨迹显影**（`ink-write`：clip-path 自左向右）写在同一张纸上，左侧朱栏颜色分对/错。
  （牌面改成 0.72 比例后可用高度变大，封印条与答案都能直接落在可视区内，无需再钉到牌底。）

## 交互约定

- 客观题（单选/多选/判断/填空）点「忘记/模糊/记得」后：立即评级（Again/Hard/Good）→
  更新复习卡 → 保存记录 → **翻回牌背并自动发下一张牌**（评分即翻牌，**没有「下一卷」按钮**）；末题直接进结算页。
- 答题页翻牌是**真 3D 双面**结构：`.q-flipper`（`preserve-3d`）里放正面 `.q-card`（p2）与牌背 `.card-flip-cover`（p6），
  两面各自 `backface-visibility: hidden`。**牌背不能有 `background-color`**，否则 p6 尖拱的透明角会露出黑块
  ——这就是曾经「翻转黑边」的根因（旧实现是个自带 `#10171d` 不透明底、且不在同一 3D 体的覆盖层）。
  退出 300ms / 入场 420ms，同轴同曲线 `--ease-flip: cubic-bezier(0.77,0,0.175,1)`。
- 主观题（简答/计算分析/综合设计）保留两步：先「展开参考答案卷轴」对照（此时也会启封蜡封），
  再「✓ 我答对了 / ✗ 我答错了」自判；自判后同样翻牌自动切题（全站已无「继续」/「下一卷」类按钮）。
- 「开始今日练习」优先链：到期复习 → 错题 → 新题 → 随机（用户明确要求保留，勿改）。
