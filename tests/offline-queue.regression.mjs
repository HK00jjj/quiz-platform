/* 离线待补传队列 + applyBookMap 落库动作 · 回归锁（2026-09-11 GitHub 调研落实）
   上一轮审查的诚实声明是"离线队列与 store.applyBookMap 的落库动作未被单测覆盖
   （store.js 依赖 supabase client，Node 直跑需 mock）"。本文件用 node:module 的
   register() 自定义钩子补上这个缺口，且**不改任何生产行为**：
   - store.js / lib/db.js 通过 tests/store-hooks.mjs 加载（无扩展名补 .js、
     import.meta.env 注入、lib/db.js 重定向到可编程桩 tests/mocks/db-stub.mjs）；
   - 断言覆盖当年自查修复的"并发入队被快照覆盖"bug（防丢数据的机制里丢数据）。
   跑法：node tests/offline-queue.regression.mjs */
import { register } from 'node:module'
import { pathToFileURL, fileURLToPath } from 'node:url'
import path from 'node:path'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const here = path.dirname(fileURLToPath(import.meta.url))
register('./store-hooks.mjs', pathToFileURL(path.join(here, 'offline-queue.regression.mjs')).href)

/* localStorage / sessionStorage 内存垫片：必须在动态 import store 之前就位
   （supabase-js 与 store.js 都在调用期动态读写，垫片要在但不用提前有内容） */
const makeStorage = () => {
  const m = new Map()
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)) },
    removeItem: (k) => { m.delete(k) },
    clear: () => m.clear(),
    key: (i) => [...m.keys()][i] ?? null,
    get length() { return m.size }
  }
}
globalThis.localStorage = makeStorage()
globalThis.sessionStorage = makeStorage()

const PENDING_KEY = 'qp.pending.v1'
const readQ = () => JSON.parse(globalThis.localStorage.getItem(PENDING_KEY) || '[]')
const writeQ = (list) => globalThis.localStorage.setItem(PENDING_KEY, JSON.stringify(list))

/* 装配 db 桩：默认全部成功；overrides 可覆盖单个 hook 或注入失败 */
let calls
function setStub(overrides = {}) {
  calls = { answer: [], card: [], saveBooks: [], loadAll: 0 }
  globalThis.__dbStub = {
    loadAll: async () => { calls.loadAll++; return { questions: [], cards: [], records: [], settings: { dailyGoal: 20 }, books: null } },
    persistAnswerIdempotent: async (r) => { calls.answer.push(r) },
    persistCard: async (c) => { calls.card.push(c) },
    saveBooks: async (p) => { calls.saveBooks.push(p) },
    replaceProgress: async () => {},
    ...overrides
  }
}
setStub()

/* 静音 reloadAll 失败路径的 console.error，保持回归输出可读 */
const origErr = console.error
console.error = () => {}

const store = await import(pathToFileURL(path.join(here, '..', 'src', 'store.js')).href)
const { useStore, enqueuePending, flushPending, pendingCountNow } = store

test('T1 真实入队路径：写入唯一 id + pendingCount 状态同步', () => {
  enqueuePending({ t: 'a', r: { questionId: 'q1', timestamp: 1 } })
  const q = readQ()
  assert.equal(q.length, 1)
  assert.ok(q[0].id, '入队时应带上唯一 id（补传按 id 精确出队的根基）')
  assert.equal(pendingCountNow(), 1)
  assert.equal(useStore.getState().pendingCount, 1)
})

test('T2 全部成功补传：队列清空、调用按序、触发一次 reload', async () => {
  setStub()
  writeQ([])
  enqueuePending({ t: 'a', r: { questionId: 'qA', timestamp: 1 } })
  enqueuePending({ t: 'a', r: { questionId: 'qB', timestamp: 2 } })
  enqueuePending({ t: 'c', c: { questionId: 'qC' } })
  await flushPending()
  assert.deepEqual(readQ(), [])
  assert.deepEqual(calls.answer.map((r) => r.questionId), ['qA', 'qB'])
  assert.deepEqual(calls.card.map((c) => c.questionId), ['qC'])
  assert.ok(calls.loadAll >= 1, '补传成功后应 reload 快照')
  assert.equal(useStore.getState().pendingCount, 0)
})

test('T3 并发入队保护：补传期间新入队的条目不得被收尾覆盖（历史 bug 锁）', async () => {
  setStub()
  writeQ([])
  enqueuePending({ t: 'a', r: { questionId: 'qA', timestamp: 1 } })
  enqueuePending({ t: 'a', r: { questionId: 'qB', timestamp: 2 } })
  enqueuePending({ t: 'a', r: { questionId: 'qC', timestamp: 3 } })
  const realPersist = globalThis.__dbStub.persistAnswerIdempotent
  globalThis.__dbStub.persistAnswerIdempotent = async (r) => {
    await realPersist(r)
    if (r.questionId === 'qA') {
      /* 模拟补传期间用户又答了一题：新条目在 flush 启动快照之外入队 */
      enqueuePending({ t: 'a', r: { questionId: 'qD-midflight', timestamp: 9 } })
    }
  }
  await flushPending()
  const remain = readQ()
  assert.deepEqual(remain.map((e) => e.r.questionId), ['qD-midflight'],
    '收尾只准摘掉本次确认完成的 id；补传期间入队的新条目必须留在队列')
})

test('T4 失败保序留队：一笔失败即停，未完成条目按原顺序保留', async () => {
  setStub()
  writeQ([])
  enqueuePending({ t: 'a', r: { questionId: 'qA', timestamp: 1 } })
  enqueuePending({ t: 'a', r: { questionId: 'qB-fail', timestamp: 2 } })
  enqueuePending({ t: 'a', r: { questionId: 'qC', timestamp: 3 } })
  globalThis.__dbStub.persistAnswerIdempotent = async (r) => {
    if (r.questionId === 'qB-fail') throw new Error('mock net down')
    calls.answer.push(r)
  }
  await flushPending()
  assert.deepEqual(readQ().map((e) => e.r.questionId), ['qB-fail', 'qC'],
    '失败的条目与其后未尝试的条目都要留在队列且保持时序')
  assert.ok(useStore.getState().pendingCount >= 2)
})

test('T5 旧条目无 id：flush 前就地补 id，不丢数据', async () => {
  setStub()
  writeQ([
    { t: 'a', r: { questionId: 'qOld1', timestamp: 1 } },
    { t: 'c', c: { questionId: 'qOld2' } }
  ])
  await flushPending()
  assert.deepEqual(readQ(), [])
  assert.deepEqual(calls.answer.map((r) => r.questionId), ['qOld1'])
  assert.deepEqual(calls.card.map((c) => c.questionId), ['qOld2'])
})

test('T6 队列上限 800：超出丢最旧，宁丢最旧不撑爆配额', () => {
  writeQ([])
  for (let i = 0; i < 805; i++) enqueuePending({ t: 'a', r: { questionId: 'q' + i, timestamp: i } })
  assert.equal(pendingCountNow(), 800)
  const q = readQ()
  assert.equal(q[0].r.questionId, 'q5', '最旧的 5 条（q0~q4）应被挤出')
  assert.equal(new Set(q.map((e) => e.id)).size, 800, '全部条目 id 唯一')
  writeQ([])
})

test('T7 applyBookMap 合法 map：清洗后落库（云端 saveBooks 恰一次 + 状态更新）', async () => {
  setStub()
  const before = calls.saveBooks.length
  const map = {
    books: { b1: { id: 'b1', name: '主库' }, b2: { id: 'b2', name: '副库' } },
    order: ['b1', 'b2'], activeBookId: 'b2',
    assign: { q1: 'b1', q2: 'b2', qGhost: 'b1' } /* qGhost 不在 knownQuestionIds → 必须被清洗掉 */
  }
  const okFlag = await useStore.getState().applyBookMap(map, new Set(['q1', 'q2']))
  assert.equal(okFlag, true)
  assert.equal(calls.saveBooks.length, before + 1, '落库动作必须真实发生')
  assert.deepEqual(calls.saveBooks[calls.saveBooks.length - 1].assign, { q1: 'b1', q2: 'b2' },
    'assign 指向不存在题目的条目只允许少恢复，不允许写坏')
  assert.equal(useStore.getState().activeBookId, 'b2')
  assert.equal(useStore.getState().bookOrder.join(','), 'b1,b2')
})

test('T8 applyBookMap 坏 map：直接拒绝，不落库不改状态', async () => {
  setStub()
  const before = { order: useStore.getState().bookOrder.join(','), saveBooks: calls.saveBooks.length }
  const okFlag = await useStore.getState().applyBookMap({ books: { b1: { id: 'b1' } } }, new Set())
  assert.equal(okFlag, false, '缺 order 的 map 过不了 validBookMap')
  assert.equal(useStore.getState().bookOrder.join(','), before.order)
  assert.equal(calls.saveBooks.length, before.saveBooks, '拒绝路径不得写云端')
})

test('T9 applyBookMap 全 order 失效：normalize 后空 order → 拒绝', async () => {
  const okFlag = await useStore.getState().applyBookMap(
    { books: {}, order: ['bGhost'], activeBookId: 'bGhost', assign: {} }, new Set(['q1']))
  assert.equal(okFlag, false, 'order 里没有任何真实存在的书时必须拒绝')
})
