// 素材索引（压缩后的文件，位于 public/img/）
const B = import.meta.env.BASE_URL
const img = (name) => `${B}img/${name}`

export const A = {
  mainBorder: img('p1.png'),       // 古铜雕花主边框（九切片）
  cardFrame: img('p2.png'),        // 竖版塔罗卡牌边框（九切片）
  cardArch: img('p2-arch.png'),    // 卡牌尖拱冠饰（独立主视觉）
  rowFrame: img('p3.png'),         // 横向小卡牌边框
  parchment: img('p4.png'),        // 羊皮纸纹理
  bgTexture: img('p5.png'),        // 深墨蓝绿背景纹理
  cardBack: img('p6.png'),         // 塔罗牌背面
  loginGate: img('p7.png'),        // 登录青铜大门外框
  idCardFrame: img('p8.png'),      // 横版身份塔罗牌外框
  hallVision: img('p9.png'),       // 法师主视觉（阅览厅）
  avatar: img('p10.png'),          // 法师头像
  starryBg: img('p11.png'),        // 魔法星空背景（登录页）
  domeInside: img('p11b.png'),     // 水晶穹顶内部全景
  vortex: img('p12.png'),          // 墨绿青魔法漩涡
  fresco: img('p12b.png'),         // 巴洛克穹顶壁画
  magicOrb: img('p13.png'),        // 旋转魔法球
  buttress: img('p13b.png'),       // 飞扶壁剪影
  portraitFrame: img('p14.png'),   // 圆形法师画框
  magicBook: img('p15.png'),       // 魔法书（今日修习）
  sealedDeck: img('p16.png'),      // 封印牌叠（污染重阅）
  cardPile: img('p17.png'),        // 塔罗牌堆（随机翻阅）
  cardTower: img('p18.png'),       // 卡牌螺旋塔（全部秘典）
  scroll: img('p19.png'),          // 羊皮纸卷轴（导入）
  roseWindow: img('p20.png'),      // 玫瑰窗魔法阵
  chainedScroll: img('p21.png'),   // 铜链捆扎卷轴
  warnRune: img('p22.png'),        // 警告符文
  stepDone: img('p23-1.png'),      // 流程节点：完成
  stepActive: img('p23-2.png'),    // 流程节点：进行中
  stepWait: img('p23-3.png'),      // 流程节点：等待
  astrolabe: img('p24.png'),       // 星象命运之盘
  calendarBook: img('p25.png'),    // 古老日历书
  crystalBar: img('p26.png'),      // 铜质水晶柱
  achFrame: img('p27.png'),        // 成就卡外框
  trophy: img('p28.png'),          // 奖杯
  balance: img('p29.png'),         // 炼金天平
  memoryFlask: img('p30.png'),     // 记忆水晶瓶
  sigilBadge: img('p31.png'),      // 窥秘人徽章
  furnace: img('p32.png'),         // 炼金熔炉
  navBar: img('p33.png'),          // 底部导航横栏
  seals: [1, 2, 3, 4, 5, 6, 7].map((i) => img(`p34-${i}.png`)), // 题型印章
  answerScroll: img('p35.png'),    // 答案解析卷轴
  badgeFrame: img('p36.png'),      // 圆形徽章边框
  giltBtn: img('p37.png'),         // 鎏金按钮背景
  emptyShelf: img('p38-1.png'),
  emptyTable: img('p38-2.png'),
  emptyCandle: img('p38-3.png'),
  panelBorder: img('p39.png'),     // 弹出面板边框
  gems: { 基础: img('p40-1.png'), 应用: img('p40-2.png'), 综合: img('p40-3.png') },
  crystalSearch: img('p41.png'),   // 水晶球搜索框
  milestone: { done: img('p42-1.png'), active: img('p42-2.png'), locked: img('p42-3.png') },
  achIcons: {
    streak7: img('p43-1.png'), days7: img('p43-2.png'), streak30: img('p43-3.png'),
    streak100: img('p43-4.png'), q100: img('p43-5.png'), q1000: img('p43-6.png'),
    acc90: img('p43-7.png'), 'perfect-session': img('p43-8.png')
  },
  divider: img('p44.png'),         // 铜质花纹分隔条
  titleDecor: img('p45.png'),      // 页面顶部标题装饰条
  tabBar: img('p46.png'),          // 标签页底板
  copperTex: img('p47.png'),       // 铜质金属纹理
  marbleTex: img('p48.png'),       // 大理石地面
  pillarTex: img('p49.png'),       // 哥特石柱
  spineTex: img('p50.png'),        // 古书脊
  gargoyle: [img('p54-1.png'), img('p54-2.png'), img('p54-3.png'), img('p54-4.png')]
}

export const TYPE_SEAL_INDEX = {
  单选题: 0, 多选题: 1, 判断题: 2, 填空题: 3, 简答题: 4, 计算分析题: 5, '综合设计/故障诊断题': 6
}
