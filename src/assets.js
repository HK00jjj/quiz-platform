// 素材索引（压缩后的文件，位于 public/img/）
const B = import.meta.env.BASE_URL
const img = (name) => `${B}img/${name}`

export const A = {
  /* ── 只保留仍有代码在读的键 ──
     沉浸感批1 A4（2026-09-15 用户拍板）又删 7 个「被 CSS 否决的死引用」键：
     牌背 / 玫瑰窗 / 单选框两态 / 多选框两态 / 判断铜牌两态 / 蜡封三帧 / 裂纹三帧。
     它们的使用点全是「有代码引用但被 candy.css !important 压掉」（display:none /
     background-image:none / 渐变覆盖），每进一次答题页白发起最多 7 个位图请求。
     ⚠ components.jsx 里旧版 BootRitual（无人 import 的死组件）仍写着 A.roseWindow——
     该组件不渲染，键删后取 undefined 也无运行时风险；components.jsx 是陈旧缓冲区
     回写重灾区，按 HANDOFF 纪律不碰它。文件级清理交给 purge-dist 判定。 */
  emptyShelf: img('p38-1.webp'),
  emptyTable: img('p38-2.webp'),
  /* titleDecor(p45.png) 已删：它唯一的使用点是 Bank.jsx 的 .page-head 内联 backgroundImage，
     而 candy.css L331 的 .page-head { background-image: none !important } 一直把它压掉。
     这是一类引用式审计抓不到的死素材：“有代码引用”但“被 CSS 否决”，
     所以 purge-dist 会保留它、审计脚本也会报它活着。以后查孤儿图不能只看引用，
     还得看引用它的那条样式有没有被 !important 盖掉。 */
  /* ── 外部补充素材（用户提供，已经 ingest-assets.mjs 零感知损失压缩）── */
}
