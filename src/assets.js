// 素材索引（压缩后的文件，位于 public/img/）
const B = import.meta.env.BASE_URL
const img = (name) => `${B}img/${name}`

export const A = {
  cardFrame: img('p2.webp'),        // 竖版塔罗卡牌边框（九切片）
  parchment: img('p4.webp'),        // 羊皮纸纹理
  bgTexture: img('p5.webp'),        // 深墨蓝绿背景纹理
  cardBack: img('p6.webp'),         // 塔罗牌背面
  loginGate: img('p7.webp'),        // 登录青铜大门外框
  idCardFrame: img('p8.webp'),      // 横版身份塔罗牌外框
  hallVision: img('p9.webp'),       // 法师主视觉（阅览厅）
  avatar: img('p10.webp'),          // 法师头像
  starryBg: img('p11.webp'),        // 魔法星空背景（登录页）
  vortex: img('p12.png'),          // 墨绿青魔法漩涡
  magicOrb: img('p13.webp'),        // 旋转魔法球
  portraitFrame: img('p14.webp'),   // 圆形法师画框
  magicBook: img('p15.webp'),       // 魔法书（今日修习）
  sealedDeck: img('p16.webp'),      // 封印牌叠（污染重阅）
  cardPile: img('p17.webp'),        // 塔罗牌堆（随机翻阅）
  cardTower: img('p18.webp'),       // 卡牌螺旋塔（全部秘典）
  scroll: img('p19.webp'),          // 羊皮纸卷轴（导入）
  roseWindow: img('p20.webp'),      // 玫瑰窗魔法阵
  warnRune: img('p22.webp'),        // 警告符文
  stepDone: img('p23-1.webp'),      // 流程节点：完成
  stepActive: img('p23-2.webp'),    // 流程节点：进行中
  stepWait: img('p23-3.webp'),      // 流程节点：等待
  astrolabe: img('p24.webp'),       // 星象命运之盘
  trophy: img('p28.webp'),          // 奖杯
  balance: img('p29.webp'),         // 炼金天平
  memoryFlask: img('p30.webp'),     // 记忆水晶瓶
  sigilBadge: img('p31.webp'),      // 窥秘人徽章
  furnace: img('p32.webp'),         // 炼金熔炉
  navBar: img('p33.webp'),          // 底部导航横栏
  seals: [1, 2, 3, 4, 5, 6, 7].map((i) => img(`p34-${i}.webp`)), // 七种题型印章（模板字面量，改扩展名时易漏）
  answerScroll: img('p35.webp'),    // 答案解析卷轴
  badgeFrame: img('p36.webp'),      // 圆形徽章边框
  emptyShelf: img('p38-1.webp'),
  emptyTable: img('p38-2.webp'),
  emptyCandle: img('p38-3.webp'),
  gems: { 基础: img('p40-1.webp'), 应用: img('p40-2.webp'), 综合: img('p40-3.webp') },
  milestone: { done: img('p42-1.webp'), active: img('p42-2.webp'), locked: img('p42-3.webp') },
  achIcons: {
    streak7: img('p43-1.webp'), days7: img('p43-2.webp'), streak30: img('p43-3.webp'),
    streak100: img('p43-4.webp'), q100: img('p43-5.webp'), q1000: img('p43-6.webp'),
    acc90: img('p43-7.webp'), 'perfect-session': img('p43-8.webp')
  },
  divider: img('p44.png'),         // 铜质花纹分隔条
  titleDecor: img('p45.png'),      // 页面顶部标题装饰条
  /* ── 外部补充素材（用户提供，已经 ingest-assets.mjs 零感知损失压缩）── */
  navIcons: { learn: img('nav-learn-n.webp'), bank: img('nav-bank-n.webp'), import: img('nav-import-n.webp'), stats: img('nav-stats-n.webp'), settings: img('nav-settings-n.webp') },
  markRadio: { off: img('mark-radio-off-n.webp'), on: img('mark-radio-on-n.webp') },   // 单选符文框两态
  markCheck: { off: img('mark-check-off-n.webp'), on: img('mark-check-on-n.webp') },   // 多选符文框两态
  judgeCard: { ok: img('judge-true.webp'), no: img('judge-false.webp') },              // 判断题尖拱铜牌
  waxSeal: [img('wax-1.webp'), img('wax-2.webp'), img('wax-3.webp')],                 // 蜡封：完整/半碎/碎裂
  cracks: [img('crack-1.webp'), img('crack-2.webp'), img('crack-3.webp')],             // 牌面裂纹蔓延三帧
  abyss: [img('abyss-1-n.webp'), img('abyss-2-n.webp'), img('abyss-3-n.webp')]         // 深渊不可名状剑影
}

export const TYPE_SEAL_INDEX = {
  单选题: 0, 多选题: 1, 判断题: 2, 填空题: 3, 简答题: 4, 计算分析题: 5, '综合设计/故障诊断题': 6
}
