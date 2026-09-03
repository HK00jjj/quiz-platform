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
     p2/p4 这两个文件仍被 CSS 直接 url() 引用，删键不影响它们——文件级清理交给 purge-dist 判定。 */
  cardBack: img('p6.webp'),         // 塔罗牌背面（答题页翻牌封面）
  idCardFrame: img('p8.webp'),      // 横版身份塔罗牌外框（Stats 页）
  avatar: img('p10.webp'),          // 头像（Stats 页）
  portraitFrame: img('p14.webp'),   // 圆形画框（Stats 页）
  roseWindow: img('p20.webp'),      // 玫瑰窗魔法阵（答题页牌背中心）
  astrolabe: img('p24.webp'),       // 星象命运之盘（Stats 页）
  trophy: img('p28.webp'),          // 奖杯（Stats 页）
  badgeFrame: img('p36.webp'),      // 圆形徽章边框（Stats 页）
  emptyShelf: img('p38-1.webp'),
  emptyTable: img('p38-2.webp'),
  emptyCandle: img('p38-3.webp'),
  milestone: { done: img('p42-1.webp'), active: img('p42-2.webp'), locked: img('p42-3.webp') },
  achIcons: {
    streak7: img('p43-1.webp'), days7: img('p43-2.webp'), streak30: img('p43-3.webp'),
    streak100: img('p43-4.webp'), q100: img('p43-5.webp'), q1000: img('p43-6.webp'),
    acc90: img('p43-7.webp'), 'perfect-session': img('p43-8.webp')
  },
  divider: img('p44.png'),         // 铜质花纹分隔条
  titleDecor: img('p45.png'),      // 页面顶部标题装饰条
  /* ── 外部补充素材（用户提供，已经 ingest-assets.mjs 零感知损失压缩）── */
  markRadio: { off: img('mark-radio-off-n.webp'), on: img('mark-radio-on-n.webp') },   // 单选符文框两态
  markCheck: { off: img('mark-check-off-n.webp'), on: img('mark-check-on-n.webp') },   // 多选符文框两态
  judgeCard: { ok: img('judge-true.webp'), no: img('judge-false.webp') },              // 判断题尖拱铜牌
  waxSeal: [img('wax-1.webp'), img('wax-2.webp'), img('wax-3.webp')],                 // 蜡封：完整/半碎/碎裂
  cracks: [img('crack-1s.webp'), img('crack-2s.webp'), img('crack-3s.webp')]              // 牌面裂纹蔓延三帧
}

export const TYPE_SEAL_INDEX = {
  单选题: 0, 多选题: 1, 判断题: 2, 填空题: 3, 简答题: 4, 计算分析题: 5, '综合设计/故障诊断题': 6
}
