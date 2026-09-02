// 全局状态（zustand，逻辑与线上一致；含错题重练断点续练）
import { create } from 'zustand'
import { client } from './lib/supabase'
import { repo } from './lib/db'
import { newCard, reviewCard } from './lib/fsrs'
import { fmtDate } from './lib/dates'
import { buildSession, filtersKey, isObjective } from './lib/stats'
import { classifyImport, parseBackup, parseBank, gradeObjective } from './lib/validate'

const RESUME_KEY = 'quiz-platform.resume.v1'
const IMPORTED_AT_KEY = 'qp.importedAt.v1'
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
    useStore.setState({ questions: data.questions, cards: data.cards, records: data.records, settings: data.settings, syncError: null })
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
        : `【演示】关于电气自动化第 ${i} 卷秘典的符文解读，下列说法正确的是？`,
      answer: type === '单选题' ? 'A' : type === '多选题' ? 'AC' : type === '判断题' ? (i % 2 ? '正确' : '错误')
        : type === '填空题' ? '可编程逻辑控制器|循环扫描' : '要点一：方案；要点二：选型计算；要点三：控制逻辑。',
      options: type === '单选题' ? ['A. 说法一', 'B. 说法二', 'C. 说法三', 'D. 说法四']
        : type === '多选题' ? ['A. 说法一', 'B. 说法二', 'C. 说法三', 'D. 说法四', 'E. 说法五'] : undefined,
      explanation: '【推导】演示解析：此处为灵知解读的推演过程。【记忆点】记住核心符文含义。'
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
  cards: [],
  records: [],
  settings: { dailyGoal: 20 },
  ...emptySession,

  init: async () => {
    if (DEMO) {
      const d = demoData()
      set({ authStatus: 'signed-in', userEmail: 'demo@arcane.local', ready: true, ...d })
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
      persistAfterImport(parsed.questions)
      const existing = new Set(get().questions.map((q) => q.id))
      const added = parsed.questions.filter((q) => !existing.has(q.id)).length
      await repo.upsertQuestions(parsed.questions)
      await reloadAll()
      return { ...parsed, added }
    }
    return { ...parsed, added: 0 }
  },
  deleteQuestion: async (id) => {
    await repo.deleteQuestion(id)
    set((s) => ({
      questions: s.questions.filter((q) => q.id !== id),
      cards: s.cards.filter((c) => c.questionId !== id),
      records: s.records.filter((r) => r.questionId !== id)
    }))
  },
  resetAll: async () => {
    await repo.clearAll()
    set({ questions: [], cards: [], records: [], ...emptySession })
  },
  updateSettings: async (patch) => {
    const merged = { ...get().settings, ...patch }
    await repo.saveSettings(merged)
    set({ settings: merged })
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
