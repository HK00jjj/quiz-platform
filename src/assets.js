// 素材索引（压缩后的文件，位于 public/img/）
const B = import.meta.env.BASE_URL
const img = (name) => `${B}img/${name}`

export const A = {
  /* ── 只保留仍有代码在读的键 ──
     本轮删掉 25 个已无人引用的键：cardFrame / parchment / bgTexture / loginGate / hallVision /
     starryBg / vortex / magicOrb / magicBook / sealedDeck / cardPile / cardTower / warnRune /
     stepDone / stepActive / stepWait / balance / memoryFlask / sigilBadge / furnace / navBar /
     seals / gems / navIcons / abyss。
     §6 那条「保留全部键名」的规矩前提是**有代码在读**（A.gems[x] 取 undefined 会崩）；
     删之前已逐个 grep 确认零引用（注意排掉注释里的字面量假阳性），
     并确认全站没有 A[key] 动态取值或解构。
     p2/p4 这两个文件仍被 CSS 直接 url() 引用，删键不影响它们——文件级清理交给 purge-dist 判定。

     又删掉 10 个：idCardFrame / avatar / portraitFrame / astrolabe / trophy / badgeFrame /
     emptyCandle / milestone / achIcons（这九个随 Stats.jsx「星界观测台」整页下线而死），
     以及 divider（唯一使用者是 components.jsx 里的死组件 RuneDivider，已删）。
     ⚠ divider 这个坑值得记：Login.jsx L65 的注释里写着「A.divider(p44.png)」字样，
     那是注释不是引用，但 grep 会把它算成一次使用——审计脚本必须剔注释才不会被骗。 */
  cardBack: img('p6.webp'),         // 塔罗牌背面（答题页翻牌封面）
  roseWindow: img('p20.webp'),      // 玫瑰窗魔法阵（答题页牌背中心）
  emptyShelf: img('p38-1.webp'),
  emptyTable: img('p38-2.webp'),
  /* titleDecor(p45.png) 已删：它唯一的使用点是 Bank.jsx 的 .page-head 内联 backgroundImage，
     而 candy.css L331 的 .page-head { background-image: none !important } 一直把它压掉。
     这是一类引用式审计抓不到的死素材：“有代码引用”但“被 CSS 否决”，
     所以 purge-dist 会保留它、审计脚本也会报它活着。以后查孤儿图不能只看引用，
     还得看引用它的那条样式有没有被 !important 盖掉。 */
  /* ── 外部补充素材（用户提供，已经 ingest-assets.mjs 零感知损失压缩）── */
  markRadio: { off: img('mark-radio-off-n.webp'), on: img('mark-radio-on-n.webp') },   // 单选符文框两态
  markCheck: { off: img('mark-check-off-n.webp'), on: img('mark-check-on-n.webp') },   // 多选符文框两态
  judgeCard: { ok: img('judge-true.webp'), no: img('judge-false.webp') },              // 判断题尖拱铜牌
  waxSeal: [img('wax-1.webp'), img('wax-2.webp'), img('wax-3.webp')],                 // 蜡封：完整/半碎/碎裂
  cracks: [img('crack-1s.webp'), img('crack-2s.webp'), img('crack-3s.webp')]              // 牌面裂纹蔓延三帧
}
