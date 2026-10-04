// 云端数据层（表结构与线上一致：questions / review_cards / answer_records / settings）
import { client } from './supabase'
import { fmtDate } from './dates'

/* ========== 题库快照层（2026-10-04 egress 降耗）==========
   背景：fetchAllPaged('questions') 每次打开站点全量拉 ~13MB（7252 题），
   月 egress 超免费层 5GB（组织收到 11-01 限制预警）。
   方案：IndexedDB 快照 + settings key='bank_rev' 版本号指纹——
   rev 命中 → questions 直接读本地快照（零大流量）；rev 不匹配/无快照 → 全量拉并落快照。
   失效纪律（写入侧主动 bump，不猜测内容）：流水线入库/PATCH 题面后必须 bump_bank_rev。
   所有快照异常（隐私模式/配额/IDB 不可用）均静默降级全量拉，行为与旧版完全一致。 */
const IDB_NAME = 'qbank-cache', IDB_STORE = 'snapshots'
function idbOpen() {
  return new Promise((res, rej) => {
    const rq = indexedDB.open(IDB_NAME, 1)
    rq.onupgradeneeded = () => rq.result.createObjectStore(IDB_STORE)
    rq.onsuccess = () => res(rq.result)
    rq.onerror = () => rej(rq.error)
  })
}
async function snapGet(key) {
  try {
    const db = await idbOpen()
    return await new Promise((res, rej) => {
      const rq = db.transaction(IDB_STORE).objectStore(IDB_STORE).get(key)
      rq.onsuccess = () => res(rq.result ?? null); rq.onerror = () => rej(rq.error)
    })
  } catch { return null }
}
async function snapPut(key, val) {
  try {
    const db = await idbOpen()
    await new Promise((res, rej) => {
      const tx = db.transaction(IDB_STORE, 'readwrite')
      tx.objectStore(IDB_STORE).put(val, key)
      tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error)
    })
    return true
  } catch { return false }
}

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
/* 属性体系（2026-09-18 诊断引擎配套）：attributes 属性字典 + question_attributes Q 矩阵。
   两表为纯新增表（20260918_attributes_qmatrix.sql），缺失时（未执行 DDL）返回空数组，
   诊断页降级显示"属性体系未就绪"，不影响刷题主流程。 */
const toAttr = (r) => ({
  id: r.id, domain: r.domain, topicId: r.topic_id, topicName: r.topic_name, name: r.name
})
const toQA = (r) => ({ questionId: r.question_id, attributeId: r.attribute_id, source: r.source })
/* 题目统计（2026-09-18 S4 回流：attempts/correct_rate/p_band/dead_options——流水线
   item_analysis 的同口径结果，Bank 题目卡展示"题目质量"用） */
const toStat = (r) => ({
  questionId: r.question_id, attempts: r.attempts ?? 0,
  correctRate: r.correct_rate == null ? null : Number(r.correct_rate),
  pBand: r.p_band ?? null, deadOptions: r.dead_options ?? null,
})

export class CloudRepo {
  constructor(c) { this.client = c }
  /* §66 分页拉全表：PostgREST 单请求默认最多返回 1000 行（超出静默截断），
     题库/做题记录超过后早期数据不可见。按 range 翻页直到不足一页。
     翻页必须按唯一键排序（seq/answered_at 会重复，边界漂移会漏行/重行）。
     §68 加固：分页后请求数变多，单页瞬时失败会让整个加载失败——每页自动重试 2 次。 */
  async fetchAllPaged(table, orderCol, pageSize = 1000, concurrency = 4) {
    /* 【2026-09-20 AH批 并发化】实测线上冷启动 ready 需 5.3s，其中 4.6s 花在
       「4 页 questions 串行等」上（单页 0.8~1.4s，逐页累加；瀑布实测
       19ms→1444ms→2665ms→3784ms 逐页起跳）。改为每批并发拉 concurrency 页。
       【2026-09-21 INC-20260921-07 加固】旧终止条件「任一不满页即末页」在服务端
       瞬时部分返回时会把中间页误判为末页 → 静默缺数据（实测：登录后题库只剩
       325/3357 且零报错、零 4xx）。改为：
       ① head + count=exact 先取总行数（带 3 次重试）；
       ② 按总页数精确拉取，页内「短返回」（拿不满且非末页）视为瞬时失败重试；
       ③ 最终 rows.length < total 直接抛错——宁可整体报错走 syncError，不可静默缺数据。 */
    let total = null
    for (let a = 0; a < 3 && total == null; a++) {
      const head = await this.client.from(table).select(orderCol, { count: 'exact', head: true })
      if (head.count != null) total = head.count
      else await new Promise((r) => setTimeout(r, 500 * (a + 1)))
    }
    if (total == null) throw new Error('fetchAllPaged: 无法取得总行数(' + table + ')')
    const pages = Math.max(1, Math.ceil(total / pageSize))
    const fetchPage = async (from, want) => {
      let data = null, error = null
      for (let attempt = 0; attempt < 3; attempt++) {
        const res = await this.client.from(table).select('*')
          .order(orderCol).range(from, from + Math.max(want, 1) - 1)
        data = res.data; error = res.error
        const got = data?.length ?? 0
        if (!error && got >= want) break                    // 本页拿满
        if (!error && from + got >= total) break            // 末页允许不足一页
        error = error || new Error(`短返回 ${got}/${want} @${from}(${table})`)
        if (attempt < 2) await new Promise((r) => setTimeout(r, 600 * (attempt + 1)))
      }
      if (error) throw error
      return data ?? []
    }
    const slots = new Array(pages)
    for (let base = 0; base < pages; base += concurrency) {
      const idxs = []
      for (let i = base; i < Math.min(base + concurrency, pages); i++) idxs.push(i)
      await Promise.all(idxs.map((i) => {
        const from = i * pageSize
        const want = Math.min(pageSize, total - from)
        return fetchPage(from, want).then((d) => { slots[i] = d })
      }))
    }
    const rows = slots.flat()
    if (rows.length < total) throw new Error('fetchAllPaged: 拉取不完整 ' + rows.length + '/' + total + '(' + table + ')')
    return rows
  }
  async loadAll() {
    /* 【2026-09-20 AH批】属性三表原为「第一批 await 完成后再串行拉」——瀑布实测第二批
       到 4602ms 才起步（第一批 4600ms 才结束），白多一整轮 RTT（约 +696ms）。
       三表各自独立、失败均降级为空数组（DDL 未执行或网络异常时仅诊断页显示"未就绪"，
       刷题/复习/晋级照常），与第一批无数据依赖，故合并进同一个 Promise.all 一次并发。
       （属性体系 2026-09-18 新增；question_stats 为 S4 回流表，Bank 质量展示用。） */
    /* 逐题配图映射（2026-09-21）：settings key='imgmap' 行（{qid: spec}，零 DDL，与 books 同款通路）。
       拉取失败降级 null（配图缺失不影响刷题主流程），attach 侧负责 merge 进 localStorage。 */
    /* 【2026-10-04 快照层】questions 大表（~13MB/次）改走「bank_rev 指纹 + IndexedDB 快照」：
       先花一次 <100B 轻查询取版本号，命中本地快照则跳过全量拉取。 */
    /* 【INC-20261004-08 复发】PostgrestBuilder 是 thenable 不是真 Promise，链上没有 .catch——
       同坑第二次（前科 INC-20260921-03 见下方 imgmap 行注释）。必须先 Promise.resolve() 包装再 .catch。 */
    const revRow = await Promise.resolve(
      this.client.from('settings').select('value').eq('key', 'bank_rev').maybeSingle()
    ).catch(() => ({ data: null }))
    const rev = revRow?.data?.value?.v ?? 0
    const snap = await snapGet('questions')
    let qRaw = null
    if (snap && snap.rev === rev && Array.isArray(snap.rows) && snap.rows.length) {
      qRaw = snap.rows
      console.info(`[loadAll] questions 命中本地快照 rev=${rev}（${qRaw.length} 行，省 ~13MB 出站流量）`)
    } else {
      qRaw = await this.fetchAllPaged('questions', 'id')
      const saved = await snapPut('questions', { rev, rows: qRaw, at: Date.now() })
      if (saved) console.info(`[loadAll] questions 全量拉取 ${qRaw.length} 行并已落快照 rev=${rev}`)
    }
    const [c, r, s, b, img, attrs, qas, stats] = await Promise.all([
      this.fetchAllPaged('review_cards', 'question_id'),
      this.fetchAllPaged('answer_records', 'id'),
      this.client.from('settings').select('value').eq('key', 'app').maybeSingle(),
      // 多题库（书本）映射存在 settings 的 key='books' 行里：
      // 这样不需要改任何表结构（没有 DDL 权限），而且因为 cards/records 以 questionId 为键，
      // 只要各书题目 ID 不重叠，间隔重复与做题记录就是天然隔离的。
      this.client.from('settings').select('value').eq('key', 'books').maybeSingle(),
      /* 【2026-09-21 修复 INC-20260921-03】PostgrestBuilder 是 thenable 不是真 Promise，
         链上没有 .catch——直接 .catch((…)=>…) 会 TypeError 且炸掉整个 Promise.all，
         登录后全量数据加载失败（线上事故：题库空 + 同步失败横幅）。
         Promise.resolve(thenable) 得到真 Promise 才能挂 .catch；降级语义不变。 */
      Promise.resolve(this.client.from('settings').select('value').eq('key', 'imgmap').maybeSingle())
        .catch((e) => { console.warn('[loadAll] imgmap 降级', e); return { data: null } }),
      this.fetchAllPaged('attributes', 'id').catch((e) => { console.warn('[loadAll] attributes 降级', e); return [] }),
      this.fetchAllPaged('question_attributes', 'question_id').catch((e) => { console.warn('[loadAll] question_attributes 降级', e); return [] }),
      this.fetchAllPaged('question_stats', 'question_id').catch((e) => { console.warn('[loadAll] question_stats 降级', e); return [] })
    ])
    /* §66 修复：fetchAllPaged 直接返回行数组（无 .data 包装）——
       此前 return 仍用旧写法 q.data.map → undefined.map 必炸，登录后加载 100% 失败 */
    return {
      questions: qRaw.map(toQuestion),
      cards: c.map(toCard),
      records: r.map(toRecord),
      settings: { dailyGoal: 20, ...(s.data?.value ?? {}) },
      books: b.data?.value ?? null,
      imgMap: (img.data?.value && typeof img.data.value === 'object' && !Array.isArray(img.data.value)) ? img.data.value : null,
      attributes: attrs.map(toAttr),
      questionAttributes: qas.map(toQA),
      questionStats: stats.map(toStat),
    }
  }
  /* 书本映射入库；失败不抛——调用方会降级到 localStorage（方案 10.5 崩溃兜底）。
     【2026-10-04 防覆盖闸 2.0 · INC-20261004-05 根治】books 整值写回已三度冲掉流水线
     新入库题的归属（2026-09-30 两起 + 10-04 KPF01 150 题）——根因是长开页面持有旧快照，
     任意一次切书/开题就把旧 assign 整值 upsert 覆盖云端新值。
     新语义=「写前读云端 → 三路合并 → 写合并结果」（与流水线 REPAIR 脚本同构）：
       ① assign：并集——云端新键（流水线入库收养）+ 本地键保留；同键值冲突本地赢
          （移题 A→B 是用户意图，必须生效）；
       ② books：并集，同 id 冲突本地赢（改名/换色意图）；
       ③ order：本地序为准，云端独有新书 append 尾部；
       ④ activeBookId：本地赢（当前意图）；
       ⑤ removed tombstone（删书场景）：显式剔除后才允许删除，其余场景绝不静默删键。
     云端读取失败时抛错（调用方 persistBooks 已 catch 降级本机）——绝不带旧快照盲写。 */
  async saveBooks(value, removed = null) {
    let base = null
    try { base = await this.loadBooksRaw() } catch (e) { throw e }
    let finalValue = value
    if (base && base.books && base.order) {
      const removedBooks = new Set(removed?.bookIds ?? [])
      const removedAssign = new Set(removed?.assignIds ?? [])
      const order = [...(value.order ?? [])].filter((x) => !removedBooks.has(x))
      const seen = new Set(order)
      for (const x of base.order ?? []) if (!seen.has(x) && !removedBooks.has(x) && base.books[x]) { order.push(x); seen.add(x) }
      const merged = {
        activeBookId: value.activeBookId ?? base.activeBookId,
        order,
        books: { ...base.books, ...value.books },
        assign: { ...base.assign, ...value.assign },
      }
      for (const id of removedBooks) delete merged.books[id]
      for (const id of removedAssign) delete merged.assign[id]
      finalValue = merged
    }
    /* base===null：books 行不存在（真·全新装机）→ 维持原语义整写 */
    const { error } = await this.client.from('settings').upsert({ key: 'books', value: finalValue })
    if (error) throw error
  }
  /* 防覆盖闸专用（2026-09-12 事故整改）：单独复核 books 行。
     返回 value（行存在）| null（行确实不存在）| 抛错（读取失败，语义与"存在"严格区分）。
     reloadAll 在回写云端前必须用它确认"云端真的没有书架"，防止本机旧映射覆盖云端。 */
  async loadBooksRaw() {
    const { data, error } = await this.client
      .from('settings').select('value').eq('key', 'books').maybeSingle()
    if (error) throw error
    return data?.value ?? null
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
  /* 幂等补写（离线队列专用，2026-09-11）：answer_records 上没有唯一约束、insert 也没有幂等键，
     直接重试会在"上次其实写成功了、只是客户端超时"的情况下插出重复作答记录
     （会污染 EWMA 与首答正确率统计）。故补传前先按 (question_id, answered_at) 探一次：
     命中即视为已写入，跳过 insert；卡片本身是 upsert，天然幂等。 */
  async persistAnswerIdempotent(record, card) {
    const iso = new Date(record.timestamp).toISOString()
    const { data, error } = await this.client.from('answer_records')
      .select('id').eq('question_id', record.questionId).eq('answered_at', iso).limit(1)
    if (error) throw error
    if (!data || data.length === 0) {
      const { error: e } = await this.client.from('answer_records').insert({
        question_id: record.questionId, answered_at: iso,
        correct: record.correct, detail: record.detail
      })
      if (e) throw e
    }
    if (!card) return
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
  /* 2026-09-13 ③续考进度云化：读取 settings key='app' 行的当前云端值。
     独立于 loadAll——ExamModal 进入时需要确定性的云端快照，而不是碰运气等
     启动期的全量加载完成。fail-open：读失败返回 null（本地 localStorage 兜底）。 */
  async loadAppSettings() {
    const { data, error } = await this.client.from('settings').select('value').eq('key', 'app').maybeSingle()
    if (error) return null
    return data?.value ?? null
  }
  /* ═══ 考试判定服务端 RPC（2026-09-11 §3.2 落地）═══
     exam_state 是段位/补考/错题单的服务端权威（客户端无任何直写策略）；
     开考抽题与交卷判分全部上收——客户端传的"对错自报"不再被采信。
     settings.rank/examFails/examWrongs 自此退化为服务端结论的**展示镜像**（由 verdict 回写）。 */
  async examStart(pSize, poolIds) {
    const { data, error } = await this.client.rpc('exam_start', { p_size: pSize, p_pool: poolIds ?? null })
    if (error) throw error
    return data // { attempt_id, question_ids }
  }
  async examSubmit(attemptId, answers) {
    const { data, error } = await this.client.rpc('exam_submit', { p_attempt_id: attemptId, p_answers: answers })
    if (error) throw error
    return data // { score, total, passed, new_rank, chances_left, wrong_ids }
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
