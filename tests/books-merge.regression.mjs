/* saveBooks 防覆盖闸 2.0 · 合并语义回归锁（2026-10-04，INC-20261004-05 根治配套）
   背景：books 整值写回已三度冲掉流水线新入库题的归属（09-30 两起 + 10-04 KPF01 150 题）。
   saveBooks 改为「写前读云端 → 三路合并 → 写合并结果」+ 删书 tombstone。
   本文件锁定合并语义九断言，防未来改动回退成整值覆盖。
   跑法：node tests/books-merge.regression.mjs */
import { register } from 'node:module'
import { pathToFileURL, fileURLToPath } from 'node:url'
import path from 'node:path'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const here = path.dirname(fileURLToPath(import.meta.url))
register('./books-merge-hooks.mjs', pathToFileURL(path.join(here, 'books-merge.regression.mjs')).href)

const { CloudRepo } = await import('../src/lib/db.js')
const stubMod = await import('../tests/mocks/supabase-stub-books.mjs')

const mk = (patch = {}) => {
  stubMod.client.__setState({ cloudRow: null, cloudThrows: false, upserts: [], ...patch })
  return new CloudRepo(stubMod.client)
}
const getState = () => stubMod.client.__getState()
const lastWrite = () => getState().upserts[getState().upserts.length - 1]

/* 云端基线：书 F（b_lk6b7ems3g，KPF01/KPF02 所在）+ 默认书，assign 含流水线新入库的 150 键示意 */
const baseCloud = {
  activeBookId: 'b_lk6b7ems3g',
  order: ['b_default', 'b_lk6b7ems3g'],
  books: {
    b_default: { id: 'b_default', name: '默认题库' },
    b_lk6b7ems3g: { id: 'b_lk6b7ems3g', name: '锂电池制造工艺及装备' },
  },
  assign: {
    q_old1: 'b_default',
    q_pipe_new_1: 'b_lk6b7ems3g',   // 流水线入库新键（本地旧快照没有）
    q_pipe_new_2: 'b_lk6b7ems3g',
  },
}

test('T1 本地旧快照写回不丢云端新键（KPF01 归属丢失事故语义锁）', async () => {
  const repo = mk({ cloudRow: baseCloud })
  const staleLocal = {  // 用户长开页面的陈旧快照：assign 无 q_pipe_new_*
    activeBookId: 'b_default', order: ['b_default'],
    books: { b_default: { id: 'b_default', name: '默认题库' } },
    assign: { q_old1: 'b_default' },
  }
  await repo.saveBooks(staleLocal)
  const w = lastWrite()
  assert.equal(w.assign.q_pipe_new_1, 'b_lk6b7ems3g', '云端新键必须被收养')
  assert.equal(w.assign.q_pipe_new_2, 'b_lk6b7ems3g')
  assert.equal(w.assign.q_old1, 'b_default')
  assert.ok(w.books.b_lk6b7ems3g, '云端独有书定义必须收养')
})

test('T2 同键冲突本地赢（移题 A→B 用户意图）', async () => {
  const repo = mk({ cloudRow: { ...baseCloud, assign: { ...baseCloud.assign, q_old1: 'b_lk6b7ems3g' } } })
  const local = { activeBookId: 'b_default', order: ['b_default', 'b_lk6b7ems3g'], books: baseCloud.books, assign: { q_old1: 'b_default', q_pipe_new_1: 'b_lk6b7ems3g' } }
  await repo.saveBooks(local)
  assert.equal(lastWrite().assign.q_old1, 'b_default', '用户移题意图必须生效')
})

test('T3 书定义并集：本地改名覆盖、云端独有收养', async () => {
  const repo = mk({ cloudRow: baseCloud })
  const local = {
    activeBookId: 'b_default', order: ['b_default'],
    books: { b_default: { id: 'b_default', name: '默认题库（改名）' } },
    assign: {},
  }
  await repo.saveBooks(local)
  const w = lastWrite()
  assert.equal(w.books.b_default.name, '默认题库（改名）')
  assert.equal(w.books.b_lk6b7ems3g.name, '锂电池制造工艺及装备')
})

test('T4 order 并集保序：本地序为准、云端新书 append 尾部', async () => {
  const repo = mk({ cloudRow: baseCloud })
  const local = { activeBookId: 'b_default', order: ['b_default'], books: baseCloud.books, assign: {} }
  await repo.saveBooks(local)
  assert.deepEqual(lastWrite().order, ['b_default', 'b_lk6b7ems3g'])
})

test('T5 删书 tombstone：bookIds/assignIds 显式剔除', async () => {
  const repo = mk({ cloudRow: baseCloud })
  const local = {  // deleteBook 后的本地状态：书已删、assign 键已删
    activeBookId: 'b_default', order: ['b_default'],
    books: { b_default: { id: 'b_default', name: '默认题库' } },
    assign: { q_old1: 'b_default' },
  }
  await repo.saveBooks(local, { bookIds: ['b_lk6b7ems3g'], assignIds: ['q_pipe_new_1', 'q_pipe_new_2'] })
  const w = lastWrite()
  assert.ok(!w.books.b_lk6b7ems3g, 'tombstone 书必须被剔除')
  assert.ok(!w.order.includes('b_lk6b7ems3g'))
  assert.ok(!('q_pipe_new_1' in w.assign) && !('q_pipe_new_2' in w.assign))
})

test('T6 云端行不存在（null）→ 整写 payload（全新装机语义）', async () => {
  const repo = mk({ cloudRow: null })
  const local = { activeBookId: 'b_default', order: ['b_default'], books: baseCloud.books, assign: { q_x: 'b_default' } }
  await repo.saveBooks(local)
  const w = lastWrite()
  assert.deepEqual(w, local, '行不存在时保持原整写语义')
})

test('T7 云端读取抛错 → saveBooks 抛错（绝不带旧快照盲写）', async () => {
  const repo = mk({ cloudRow: baseCloud, cloudThrows: true })
  await assert.rejects(
    () => repo.saveBooks({ activeBookId: 'b_default', order: ['b_default'], books: {}, assign: {} }),
    /读取失败|网络异常|stub/
  )
  assert.equal(getState().upserts.length, 0, '读取失败时不得产生任何写入')
})

test('T8 activeBookId 本地赢', async () => {
  const repo = mk({ cloudRow: baseCloud })
  const local = { activeBookId: 'b_default', order: baseCloud.order, books: baseCloud.books, assign: {} }
  await repo.saveBooks(local)
  assert.equal(lastWrite().activeBookId, 'b_default')
})

test('T9 内容一致时合并幂等（回写值=输入∪云端，无意外键）', async () => {
  const repo = mk({ cloudRow: baseCloud })
  const local = {
    activeBookId: 'b_default', order: ['b_default', 'b_lk6b7ems3g'],
    books: baseCloud.books, assign: { q_old1: 'b_default' },
  }
  await repo.saveBooks(local)
  const w = lastWrite()
  assert.equal(Object.keys(w.assign).length, 3)  // q_old1 + 两个云端新键
  assert.ok(!('q_ghost' in w.assign))
})

/* 汇总 */
process.on('exit', () => { /* node:test 自带汇总 */ })
