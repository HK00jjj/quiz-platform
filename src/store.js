// 全局状态（zustand，逻辑与线上一致；含错题重练断点续练）
import { create } from 'zustand'
import { client } from './lib/supabase'
import { repo } from './lib/db'
import { newCard, reviewCard } from './lib/fsrs'
import { fmtDate } from './lib/dates'
import { buildSession, filtersKey, isObjective } from './lib/stats'
import { classifyImport, parseBackup, parseBank, gradeObjective, assignGlobalSeq } from './lib/validate'

const RESUME_KEY = 'quiz-platform.resume.v1'
const IMPORTED_AT_KEY = 'qp.importedAt.v1'
const BOOKS_KEY = 'quiz-platform.books.v1'

/* ── 多题库（书本）──
   映射存在云端 settings 表的 key='books' 行（无需改表结构），并镜像一份到 localStorage：
   云端写失败时降级本机，不至于丢掉整个书架（方案 10.5 崩溃兜底）。
   cards/records 以 questionId 为键，所以只要各书题目 ID 不重叠，SRS 与做题记录天然隔离。 */
function saveBooksLocal(payload) {
  try { localStorage.setItem(BOOKS_KEY, JSON.stringify(payload)) } catch { /* ignore */ }
}
function loadBooksLocal() {
  try { const raw = localStorage.getItem(BOOKS_KEY); return raw ? JSON.parse(raw) : null } catch { return null }
}
/* 首次启用时的零损失迁移：建一本默认书，把现有全部题目归进去 */
function migrateBooks(questionIds) {
  const id = 'b_default'
  const now = Date.now()
  return {
    activeBookId: id, order: [id],
    books: { [id]: { id, name: '默认题库', color: 'pink', icon: '📖', subject: '', createdAt: now, lastOpenedAt: now } },
    assign: Object.fromEntries((questionIds ?? []).map((q) => [q, id]))
  }
}
/* questions 是派生值：只留当前书本的题目。这样 Learn 计数 / 题库页 / 组卷 / 答题
   全部自动变成书本作用域，页面代码一行都不用改。activeBookId 异常时退回全量，宁可多显示不可白屏。 */
function scopeQuestions(all, bk) {
  if (!bk || !bk.activeBookId || !bk.books?.[bk.activeBookId]) return all
  const a = bk.assign ?? {}
  return all.filter((q) => a[q.id] === bk.activeBookId)
}
function booksPayload(s) {
  return { activeBookId: s.activeBookId, order: s.bookOrder, books: s.books, assign: s.assign }
}
/* 防回环：realtime 订阅了 settings 表，存一次就会触发一次 reload；
   若 reload 又无条件再存，就会无限循环。所以内容没变就不写。 */
let lastBooksJson = ''
async function persistBooks(s) {
  const payload = booksPayload(s)
  const json = JSON.stringify(payload)
  if (json === lastBooksJson) return
  lastBooksJson = json
  saveBooksLocal(payload)
  if (DEMO) return
  try { await repo.saveBooks(payload) } catch (e) {
    console.error('[books] 云端保存失败，已降级本机', e)
    useStore.setState({ syncError: '题库列表云端保存失败，已暂存本机' })
  }
}
let unsubscribe = null
let relearnKey = null
let reloadTimer = null
let reloadSeq = 0

function saveResume(state) {
  try {
    localStorage.setItem(RESUME_KEY, JSON.stringify(state))
  } catch { /* ignore */ }
}
function loadResume() {
  try {
    const raw = localStorage.getItem(RESUME_KEY)
    if (!raw) return null
    const s = JSON.parse(raw)
    if (!s || s.mode !== 'relearn' || typeof s.filtersKey !== 'string' ||
      !Array.isArray(s.questionIds) || s.questionIds.length === 0 ||
      typeof s.index !== 'number' || !Array.isArray(s.results) ||
      s.index < 0 || s.index >= s.questionIds.length) return null
    return s
  } catch { return null }
}
function clearResume() {
  try { localStorage.removeItem(RESUME_KEY) } catch { /* ignore */ }
}
function persistAfterImport(questions) {
  try {
    const map = JSON.parse(localStorage.getItem(IMPORTED_AT_KEY) || '{}')
    const now = Date.now()
    questions.forEach((q) => { if (!map[q.id]) map[q.id] = now })
    localStorage.setItem(IMPORTED_AT_KEY, JSON.stringify(map))
  } catch { /* ignore */ }
}
function maybeSaveResume(state) {
  if (state.sessionMode !== 'relearn' || state.sessionQuestions.length === 0) return
  saveResume({
    mode: 'relearn', filtersKey: relearnKey ?? filtersKey(),
    questionIds: state.sessionQuestions.map((q) => q.id),
    index: state.sessionIndex, results: state.sessionResults, savedAt: Date.now()
  })
}

async function reloadAll() {
  const seq = ++reloadSeq
  try {
    let data
    try {
      data = await repo.loadAll()
    } catch (e) {
      if (e?.code === 'PGRST303') {
        await new Promise((r) => setTimeout(r, 2500))
        data = await repo.loadAll()
      } else throw e
    }
    if (seq !== reloadSeq) return
    /* 书本映射：云端优先，其次本机，都没有就零损失迁移（现有题目全归默认书） */
    const cloud = data.books
    let bk = (cloud && cloud.books && cloud.order) ? cloud : loadBooksLocal()
    let mutated = !(cloud && cloud.books && cloud.order)
    if (!bk || !bk.books || !bk.order) { bk = migrateBooks(data.questions.map((q) => q.id)); mutated = true }
    bk.assign = bk.assign ?? {}
    const known = new Set(Object.keys(bk.assign))
    for (const q of data.questions) if (!known.has(q.id)) { bk.assign[q.id] = bk.activeBookId; mutated = true }
    const alive = new Set(data.questions.map((q) => q.id))
    for (const k of Object.keys(bk.assign)) if (!alive.has(k)) { delete bk.assign[k]; mutated = true }
    if (!bk.books[bk.activeBookId]) { bk.activeBookId = bk.order[0] ?? null; mutated = true }
    // mutated 时先把哨兵置空，强制 persistBooks 写一次；写完它会记下新值，
    // 下一次由 realtime 触发的 reload 就会因为内容相同而不再写 → 断开循环
    lastBooksJson = mutated ? '' : JSON.stringify(bk)
    useStore.setState({
      allQuestions: data.questions,
      questions: scopeQuestions(data.questions, bk),
      cards: data.cards, records: data.records, settings: data.settings, syncError: null,
      books: bk.books, bookOrder: bk.order, activeBookId: bk.activeBookId, assign: bk.assign
    })
    if (mutated) persistBooks(useStore.getState())
  } catch (e) {
    console.error('[reload] 云端拉取失败', e)
    useStore.setState({ syncError: '云端同步失败，请检查网络' })
  }
}
function scheduleReload() {
  if (reloadTimer) clearTimeout(reloadTimer)
  reloadTimer = setTimeout(() => { reloadTimer = null; reloadAll() }, 400)
}
async function attach(email) {
  unsubscribe?.()
  unsubscribe = repo.subscribe(() => scheduleReload())
  await reloadAll()
  useStore.setState({ authStatus: 'signed-in', userEmail: email, ready: true })
}

const emptySession = {
  phase: 'idle', sessionMode: null, sessionQuestions: [], sessionIndex: 0,
  sessionResults: [], lastGrade: null, lastRating: null, summary: { total: 0, correct: 0 }
}

/* 演示模式（--mode demo）：本地造数据，不连云端，仅供视觉/流程验证 */
export const DEMO = import.meta.env.MODE === 'demo'
function demoData() {
  const now = Date.now()
  const types = ['单选题', '多选题', '判断题', '填空题', '简答题', '计算分析题', '综合设计/故障诊断题']
  const questions = []
  for (let i = 1; i <= 28; i++) {
    const type = types[(i - 1) % types.length]
    const q = {
      id: 'demo_' + i, seq: i, type,
      difficulty: i <= 9 ? '基础' : i <= 16 ? '应用' : '综合',
      knowledgeDomain: 'K' + ((i % 11) + 1),
      knowledgePoint: '演示知识点' + i,
      stem: type === '填空题'
        ? 'PLC 的中文全称是{可编程逻辑控制器}，它采用{循环扫描}工作方式。'
        : `【演示】关于电气自动化第 ${i} 颗糖果的配方解读，下列说法正确的是？`,
      answer: type === '单选题' ? 'A' : type === '多选题' ? 'AC' : type === '判断题' ? (i % 2 ? '正确' : '错误')
        : type === '填空题' ? '可编程逻辑控制器|循环扫描' : '要点一：方案；要点二：选型计算；要点三：控制逻辑。',
      options: type === '单选题' ? ['A. 说法一', 'B. 说法二', 'C. 说法三', 'D. 说法四']
        : type === '多选题' ? ['A. 说法一', 'B. 说法二', 'C. 说法三', 'D. 说法四', 'E. 说法五'] : undefined,
      explanation: '【推导】演示解析：这里是这道题的推演过程。【记忆点】记住关键结论与适用条件。'
    }
    questions.push(q)
  }
  const cards = questions.slice(0, 18).map((q, i) => ({
    questionId: q.id, easeFactor: 2.5, intervalDays: i < 12 ? 3 + i : 1, reps: 2, lapses: 0,
    dueAt: now - (i < 12 ? 1 : -3) * 86400000, learnedAt: now - 20 * 86400000, lastReviewedAt: now - 5 * 86400000,
    stability: 6, difficulty: 5
  }))
  const records = []
  for (let d = 0; d < 12; d++) {
    const n = d === 4 ? 0 : 2 + (d % 4)
    for (let k = 0; k < n; k++) {
      const ts = now - d * 86400000 - k * 3600000 - 7200000
      records.push({
        id: d * 10 + k, questionId: 'demo_' + ((d + k) % 28 + 1),
        date: fmtDate(new Date(ts)), timestamp: ts, correct: (d + k) % 3 !== 0, detail: 'A'
      })
    }
  }
  return { questions, cards, records, settings: { dailyGoal: 20 } }
}

export const useStore = create((set, get) => ({
  authStatus: 'booting',
  userEmail: null,
  ready: false,
  syncError: null,
  questions: [],
  allQuestions: [],
  cards: [],
  records: [],
  settings: { dailyGoal: 20 },
  /* 多题库：books 是 id→书本的映射，assign 是 题目id→书本id */
  books: {},
  bookOrder: [],
  activeBookId: null,
  assign: {},
  ...emptySession,

  init: async () => {
    if (DEMO) {
      const d = demoData()
      /* 演示模式下也给两本书：一本有题、一本空的，方便直接看到空态与切换效果 */
      const now = Date.now()
      const bk = {
        activeBookId: 'b_demo1', order: ['b_demo1', 'b_demo2'],
        books: {
          b_demo1: { id: 'b_demo1', name: '电气自动化（演示）', color: 'pink', icon: '📖', subject: '演示数据', createdAt: now, lastOpenedAt: now },
          b_demo2: { id: 'b_demo2', name: '空白题库（演示）', color: 'mint', icon: '🧪', subject: '', createdAt: now, lastOpenedAt: now }
        },
        assign: Object.fromEntries(d.questions.map((q) => [q.id, 'b_demo1']))
      }
      lastBooksJson = JSON.stringify(bk)
      set({
        authStatus: 'signed-in', userEmail: 'demo@arcane.local', ready: true,
        allQuestions: d.questions, questions: d.questions, cards: d.cards, records: d.records, settings: d.settings,
        books: bk.books, bookOrder: bk.order, activeBookId: bk.activeBookId, assign: bk.assign
      })
      return
    }
    client.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        unsubscribe?.(); unsubscribe = null
        set({ authStatus: 'anonymous', userEmail: null, questions: [], cards: [], records: [], settings: { dailyGoal: 20 }, syncError: null, ...emptySession })
      }
    })
    const { data } = await client.auth.getSession()
    if (!data.session) { set({ authStatus: 'anonymous', ready: true }); return }
    await attach(data.session.user.email ?? null)
  },
  signIn: async (email, password) => {
    const { data, error } = await client.auth.signInWithPassword({ email, password })
    if (error) return error.message
    await attach(data.user.email ?? email)
    return null
  },
  signOut: async () => { await client.auth.signOut() },

  importBank: async (text) => {
    const backup = parseBackup(text)
    if (backup) {
      persistAfterImport(backup.questions)
      const existing = new Set(get().questions.map((q) => q.id))
      const added = backup.questions.filter((q) => !existing.has(q.id)).length
      await repo.upsertQuestions(backup.questions)
      if (backup.cards.length > 0 || backup.records.length > 0) {
        await repo.replaceProgress(backup.cards, backup.records)
      }
      await reloadAll()
      return { questions: backup.questions, skipped: 0, errors: [], added }
    }
    const parsed = parseBank(text)
    if (parsed.questions.length > 0) {
      const existing = new Map(get().questions.map((q) => [q.id, q]))
      /* 入库前把批内序号(1~21)改写成全局单调入库序，理由见 assignGlobalSeq 的注释。
         必须在 parseBank（也就是校验）之后做：校验器用的是原始 JSON 的序号。
         上面备份恢复那条分支故意不做这件事——备份里带的本来就是存好的全局序，重排会毁掉它。 */
      const questions = assignGlobalSeq(parsed.questions, existing)
      persistAfterImport(questions)
      const added = questions.filter((q) => !existing.has(q.id)).length
      await repo.upsertQuestions(questions)
      await reloadAll()
      return { ...parsed, questions, added }
    }
    return { ...parsed, added: 0 }
  },
  deleteQuestion: async (id) => {
    if (!DEMO) await repo.deleteQuestion(id)
    set((s) => {
      const assign = { ...s.assign }
      delete assign[id]
      const allQuestions = s.allQuestions.filter((q) => q.id !== id)
      return {
        allQuestions,
        questions: scopeQuestions(allQuestions, { ...s, assign }),
        assign,
        cards: s.cards.filter((c) => c.questionId !== id),
        records: s.records.filter((r) => r.questionId !== id)
      }
    })
    await persistBooks(get())
  },
  resetAll: async () => {
    if (!DEMO) await repo.clearAll()
    const bk = migrateBooks([])
    lastBooksJson = ''
    set({
      allQuestions: [], questions: [], cards: [], records: [], ...emptySession,
      books: bk.books, bookOrder: bk.order, activeBookId: bk.activeBookId, assign: bk.assign
    })
    await persistBooks(get())
  },
  updateSettings: async (patch) => {
    const merged = { ...get().settings, ...patch }
    /* 先乐观更新本机，再写云端，并补上其它写云端动作都有的 DEMO 卫兵。
       旧写法是 `await repo.saveSettings(merged)` 无卫兵无 try：演示模式没有 auth session，
       它吃一个 401 就抛出，下面那行 set 永远跑不到——表现就是「挑题练习」里点
       题型/知识域/难度 chip 完全没反应、题数不变，还往 console 丢两个 error。
       生产环境下网络抖动也会让整个设置静默失效，所以改成与 persistBooks 同一套路子。 */
    set({ settings: merged })
    if (DEMO) return
    try { await repo.saveSettings(merged) } catch (e) {
      console.error('[settings] 云端保存失败', e)
      set({ syncError: '设置云端保存失败，本次只在本机生效' })
    }
  },

  /* ── 题库书架动作（方案 5.3 / 8.1）──
     切书 = 改 activeBookId + 重算派生 questions + 中止当前练习（整个数据上下文换掉） */
  createBook: async ({ name, color, icon, subject }) => {
    const s = get()
    const id = 'b_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    const now = Date.now()
    const book = {
      id, name: String(name || '未命名题库').slice(0, 20), color: color || 'pink',
      icon: icon || '📖', subject: subject || '', createdAt: now, lastOpenedAt: now
    }
    const next = { ...s, books: { ...s.books, [id]: book }, bookOrder: [...s.bookOrder, id], activeBookId: id }
    set({
      books: next.books, bookOrder: next.bookOrder, activeBookId: id,
      questions: scopeQuestions(s.allQuestions, next), ...emptySession
    })
    await persistBooks(get())
    return id
  },
  switchBook: async (id) => {
    const s = get()
    if (!s.books[id] || id === s.activeBookId) return
    const books = { ...s.books, [id]: { ...s.books[id], lastOpenedAt: Date.now() } }
    const next = { ...s, books, activeBookId: id }
    set({ books, activeBookId: id, questions: scopeQuestions(s.allQuestions, next), ...emptySession })
    await persistBooks(get())
  },
  renameBook: async (id, name) => {
    const s = get()
    if (!s.books[id]) return
    const books = { ...s.books, [id]: { ...s.books[id], name: String(name || '').slice(0, 20) || s.books[id].name } }
    set({ books })
    await persistBooks(get())
  },
  setBookCover: async (id, patch) => {
    const s = get()
    if (!s.books[id]) return
    const books = { ...s.books, [id]: { ...s.books[id], ...patch } }
    set({ books })
    await persistBooks(get())
  },
  /* L1 危险操作：只清该书的学习记录（SRS 卡 + 做题记录），题目保留 */
  clearBookProgress: async (id) => {
    const s = get()
    const ids = new Set(s.allQuestions.filter((q) => s.assign[q.id] === id).map((q) => q.id))
    const cards = s.cards.filter((c) => !ids.has(c.questionId))
    const records = s.records.filter((r) => !ids.has(r.questionId))
    set({ cards, records, ...emptySession })
    if (!DEMO) {
      try { await repo.replaceProgress(cards, records) } catch (e) { console.error('[books] 清记录失败', e); set({ syncError: '清除学习记录失败' }) }
    }
  },
  /* L2 危险操作：删整本题库（含题目）。调用方必须已做输入书名的二次确认 */
  deleteBook: async (id) => {
    const s = get()
    if (!s.books[id]) return
    if (s.bookOrder.length <= 1) { set({ syncError: '至少要保留一个题库' }); return }
    const ids = s.allQuestions.filter((q) => s.assign[q.id] === id).map((q) => q.id)
    const idSet = new Set(ids)
    const books = { ...s.books }
    delete books[id]
    const bookOrder = s.bookOrder.filter((x) => x !== id)
    const assign = { ...s.assign }
    ids.forEach((q) => delete assign[q])
    const activeBookId = s.activeBookId === id ? bookOrder[0] : s.activeBookId
    const allQuestions = s.allQuestions.filter((q) => !idSet.has(q.id))
    const next = { allQuestions, books, bookOrder, activeBookId, assign }
    set({
      ...next,
      questions: scopeQuestions(allQuestions, next),
      cards: s.cards.filter((c) => !idSet.has(c.questionId)),
      records: s.records.filter((r) => !idSet.has(r.questionId)),
      ...emptySession
    })
    if (!DEMO && ids.length > 0) {
      try { await repo.deleteQuestions(ids) } catch (e) {
        console.error('[books] 云端删除题目失败', e)
        set({ syncError: '云端删除失败，本机已移除该题库' })
      }
    }
    await persistBooks(get())
  },

  startSession: async (mode, opts = {}) => {
    const { questions, cards, records } = get()
    if (mode === 'relearn') {
      const saved = loadResume()
      if (saved && saved.filtersKey === filtersKey(opts)) {
        const byId = new Map(questions.map((q) => [q.id, q]))
        const list = saved.questionIds.map((id) => byId.get(id)).filter(Boolean)
        if (list.length > 0) {
          const index = Math.min(Math.max(saved.index, Math.min(saved.results.length, list.length - 1)), list.length - 1)
          const results = saved.results.slice(0, index)
          relearnKey = saved.filtersKey
          set({
            sessionMode: mode, sessionQuestions: list, sessionIndex: index,
            phase: 'answering', sessionResults: results, lastGrade: null, lastRating: null,
            summary: { total: results.length, correct: results.filter(Boolean).length }
          })
          return list.length
        }
      }
      clearResume()
    }
    const list = buildSession(questions, cards, records, {
      mode, size: opts.size ?? 0, now: Date.now(),
      domains: opts.domains, types: opts.types, difficulties: opts.difficulties
    })
    set({
      sessionMode: mode, sessionQuestions: list, sessionIndex: 0,
      phase: list.length > 0 ? 'answering' : 'done',
      sessionResults: [], lastGrade: null, lastRating: null, summary: { total: 0, correct: 0 }
    })
    if (mode === 'relearn') {
      relearnKey = filtersKey(opts)
      if (list.length > 0) {
        saveResume({ mode, filtersKey: relearnKey, questionIds: list.map((q) => q.id), index: 0, results: [], savedAt: Date.now() })
      } else clearResume()
    }
    return list.length
  },
  submitObjective: (input) => {
    const q = get().sessionQuestions[get().sessionIndex]
    if (!q || !isObjective(q.type)) return
    const grade = gradeObjective(q, input)
    set({ phase: 'feedback', lastGrade: grade, lastRating: null })
  },
  rateObjective: (rating) => {
    const { sessionQuestions, sessionIndex, lastGrade, submitAnswer } = get()
    const q = sessionQuestions[sessionIndex]
    if (!q || !lastGrade || !isObjective(q.type)) return
    submitAnswer(q, rating, lastGrade.normalized ?? '', lastGrade)
  },
  // 主观题：自判“管对了”→'记得'，“答错了”→'忘记'（与线上一致）
  submitSubjective: (rating) => {
    const q = get().sessionQuestions[get().sessionIndex]
    if (q) get().submitAnswer(q, rating, rating, null)
  },
  submitAnswer: (q, ratingOrBool, detail, grade) => {
    const correct = grade ? grade.correct : ratingOrBool === '记得'
    const now = Date.now()
    const record = { questionId: q.id, date: fmtDate(new Date(now)), timestamp: now, correct, detail }
    const existing = get().cards.find((c) => c.questionId === q.id)
    const card = reviewCard(existing ?? newCard(q.id, now), typeof ratingOrBool === 'string' ? ratingOrBool : '记得', now)
    if (!DEMO) repo.persistAnswer(record, card).catch((e) => {
      console.error('[persistAnswer] 云端写入失败', e)
      useStore.setState((s) => ({
        syncError: '云端写入失败，本次结果可能未同步',
        summary: { total: s.summary.total - 1, correct: s.summary.correct - (correct ? 1 : 0) },
        sessionResults: s.sessionResults.slice(0, -1)
      }))
    })
    set((s) => ({
      phase: 'feedback', lastGrade: grade, lastRating: typeof ratingOrBool === 'string' ? ratingOrBool : null,
      cards: [...s.cards.filter((c) => c.questionId !== q.id), card],
      records: [...s.records, { ...record }],
      summary: { total: s.summary.total + 1, correct: s.summary.correct + (correct ? 1 : 0) },
      sessionResults: [...s.sessionResults, correct]
    }))
    maybeSaveResume(get())
  },
  next: () => {
    const { sessionIndex, sessionQuestions } = get()
    const n = sessionIndex + 1
    if (n >= sessionQuestions.length) {
      set({ phase: 'done' })
      if (get().sessionMode === 'relearn') clearResume()
    } else {
      set({ sessionIndex: n, phase: 'answering', lastGrade: null, lastRating: null })
      maybeSaveResume(get())
    }
  },
  abortSession: () => set({ ...emptySession })
}))

// 导入分类（供页面使用）
export { classifyImport }
