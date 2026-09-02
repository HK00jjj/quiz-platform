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
    const [q, c, r, s] = await Promise.all([
      this.client.from('questions').select('*').order('seq'),
      this.client.from('review_cards').select('*'),
      this.client.from('answer_records').select('*').order('answered_at'),
      this.client.from('settings').select('value').eq('key', 'app').maybeSingle()
    ])
    if (q.error) throw q.error
    if (c.error) throw c.error
    if (r.error) throw r.error
    if (s.error) throw s.error
    return {
      questions: q.data.map(toQuestion),
      cards: c.data.map(toCard),
      records: r.data.map(toRecord),
      settings: { dailyGoal: 20, ...(s.data?.value ?? {}) }
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
    const { error: e2 } = await this.client.from('review_cards').upsert(cardRow(card))
    if (e2) throw e2
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
