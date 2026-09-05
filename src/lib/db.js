// 云端数据层（表结构与线上一致：questions / review_cards / answer_records / settings）
import { client } from './supabase'
import { fmtDate } from './dates'

const toQuestion = (r) => {
  const q = { id: r.id, seq: r.seq, type: r.type, stem: r.stem, answer: r.answer }
  if (r.difficulty) q.difficulty = r.difficulty
  if (r.knowledge_point) q.knowledgePoint = r.knowledge_point
  if (r.knowledge_domain) q.knowledgeDomain = r.knowledge_domain
  if (r.cognitive_level) q.cognitiveLevel = r.cognitive_level
  if (r.options) q.options = r.options
  if (r.explanation) q.explanation = r.explanation
  return q
}
const toRow = (q) => ({
  id: q.id, seq: q.seq, type: q.type,
  difficulty: q.difficulty ?? null,
  knowledge_point: q.knowledgePoint ?? null,
  knowledge_domain: q.knowledgeDomain ?? null,
  cognitive_level: q.cognitiveLevel ?? null,
  stem: q.stem, options: q.options ?? null,
  answer: q.answer, explanation: q.explanation ?? null
})
const toCard = (r) => {
  const c = {
    questionId: r.question_id, easeFactor: Number(r.ease_factor),
    intervalDays: r.interval_days, reps: r.reps, lapses: r.lapses,
    dueAt: Date.parse(r.due_at), learnedAt: Date.parse(r.learned_at),
    lastReviewedAt: r.last_reviewed_at ? Date.parse(r.last_reviewed_at) : undefined
  }
  if (r.stability != null) c.stability = Number(r.stability)
  if (r.difficulty != null) c.difficulty = Number(r.difficulty)
  return c
}
const cardRow = (c) => ({
  question_id: c.questionId, ease_factor: c.easeFactor,
  interval_days: c.intervalDays, reps: c.reps, lapses: c.lapses,
  due_at: new Date(c.dueAt).toISOString(), learned_at: new Date(c.learnedAt).toISOString(),
  last_reviewed_at: c.lastReviewedAt ? new Date(c.lastReviewedAt).toISOString() : null,
  stability: c.stability ?? null, difficulty: c.difficulty ?? null
})
const toRecord = (r) => ({
  id: Number(r.id), questionId: r.question_id,
  date: fmtDate(new Date(r.answered_at)), timestamp: Date.parse(r.answered_at),
  correct: r.correct, detail: r.detail
})

export class CloudRepo {
  constructor(c) { this.client = c }
  async loadAll() {
    const [q, c, r, s, b] = await Promise.all([
      this.client.from('questions').select('*').order('seq'),
      this.client.from('review_cards').select('*'),
      this.client.from('answer_records').select('*').order('answered_at'),
      this.client.from('settings').select('value').eq('key', 'app').maybeSingle(),
      // 多题库（书本）映射存在 settings 的 key='books' 行里：
      // 这样不需要改任何表结构（没有 DDL 权限），而且因为 cards/records 以 questionId 为键，
      // 只要各书题目 ID 不重叠，间隔重复与做题记录就是天然隔离的。
      this.client.from('settings').select('value').eq('key', 'books').maybeSingle()
    ])
    if (q.error) throw q.error
    if (c.error) throw c.error
    if (r.error) throw r.error
    if (s.error) throw s.error
    if (b.error) throw b.error
    return {
      questions: q.data.map(toQuestion),
      cards: c.data.map(toCard),
      records: r.data.map(toRecord),
      settings: { dailyGoal: 20, ...(s.data?.value ?? {}) },
      books: b.data?.value ?? null
    }
  }
  /* 书本映射入库；失败不抛——调用方会降级到 localStorage（方案 10.5 崩溃兜底） */
  async saveBooks(value) {
    const { error } = await this.client.from('settings').upsert({ key: 'books', value })
    if (error) throw error
  }
  /* 删整本题库：分批删，避免 .in() 列表过长；题目、SRS 卡、做题记录一起清 */
  async deleteQuestions(ids) {
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100)
      const { error } = await this.client.from('questions').delete().in('id', chunk)
      if (error) throw error
      const e2 = await this.client.from('review_cards').delete().in('question_id', chunk)
      if (e2.error) throw e2.error
      const e3 = await this.client.from('answer_records').delete().in('question_id', chunk)
      if (e3.error) throw e3.error
    }
  }
  async upsertQuestions(list) {
    const { error } = await this.client.from('questions').upsert(list.map(toRow))
    if (error) throw error
  }
  async persistAnswer(record, card) {
    const { error } = await this.client.from('answer_records').insert({
      question_id: record.questionId,
      answered_at: new Date(record.timestamp).toISOString(),
      correct: record.correct, detail: record.detail
    })
    if (error) throw error
    /* 三遍判定制：客观题前两次只记 record、卡延后到第 3 次才推，card 为 null 时跳过 */
    if (!card) return
    const { error: e2 } = await this.client.from('review_cards').upsert(cardRow(card))
    if (e2) throw e2
  }
  /* 只推卡不记 record（会话中断时补交未满 3 次的客观题评分） */
  async persistCard(card) {
    const { error } = await this.client.from('review_cards').upsert(cardRow(card))
    if (error) throw error
  }
  async deleteQuestion(id) {
    const { error } = await this.client.from('questions').delete().eq('id', id)
    if (error) throw error
  }
  async replaceProgress(cards, records) {
    const { error } = await this.client.rpc('replace_progress', {
      cards_payload: cards.map(cardRow),
      records_payload: records.map((r) => ({
        question_id: r.questionId,
        answered_at: new Date(r.timestamp).toISOString(),
        correct: r.correct, detail: r.detail
      }))
    })
    if (error) throw error
  }
  async clearAll() {
    const a = await this.client.from('answer_records').delete().neq('id', -1)
    if (a.error) throw a.error
    const b = await this.client.from('review_cards').delete().neq('question_id', '__none__')
    if (b.error) throw b.error
    const c = await this.client.from('questions').delete().neq('id', '__none__')
    if (c.error) throw c.error
  }
  async saveSettings(value) {
    const { error } = await this.client.from('settings').upsert({ key: 'app', value })
    if (error) throw error
  }
  subscribe(cb) {
    const ch = this.client.channel('quiz-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'questions' }, () => cb('questions'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'review_cards' }, () => cb('cards'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'answer_records' }, () => cb('records'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, () => cb('settings'))
      .subscribe()
    return () => this.client.removeChannel(ch)
  }
}

export const repo = new CloudRepo(client)
