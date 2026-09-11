/* lib/db.js 的可编程桩（2026-09-11，由 tests/store-hooks.mjs 在 resolve 阶段重定向）。
   每个方法转发到 globalThis.__dbStub 上的同名 hook——由测试用例在运行前装配，
   未配置的 hook 直接抛错（宁可显式失败也不静默放行）。 */
const call = (name) => (...args) => {
  const h = globalThis.__dbStub?.[name]
  if (typeof h !== 'function') throw new Error('[db-stub] 未配置 hook: ' + name)
  return h(...args)
}

export const client = {} /* 仅占位：store.js 只从 ./lib/supabase 取 client，本桩不参与 */

export const repo = {
  loadAll: call('loadAll'),
  persistAnswer: call('persistAnswer'),
  persistAnswerIdempotent: call('persistAnswerIdempotent'),
  persistCard: call('persistCard'),
  saveBooks: call('saveBooks'),
  saveSettings: call('saveSettings'),
  replaceProgress: call('replaceProgress'),
  upsertQuestions: call('upsertQuestions'),
  clearAll: call('clearAll'),
  deleteQuestion: call('deleteQuestion'),
  deleteQuestions: call('deleteQuestions'),
  subscribe: () => () => {}
}
