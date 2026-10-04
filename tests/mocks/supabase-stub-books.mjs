/* supabase 桩（books-merge.regression 专用）：只实现 db.js saveBooks/loadBooksRaw
   用到的 settings 链式调用，可编程控制云端行内容与 upsert 捕获。
   globalThis.__booksStub = { cloudRow: <value|null>, cloudThrows: bool, upserts: [] } */
let state = { cloudRow: null, cloudThrows: false, upserts: [] }

export const client = {
  __getState: () => state,
  __setState: (patch) => { state = { ...state, ...patch } },
  from(table) {
    if (table !== 'settings') throw new Error('stub 仅支持 settings 表: ' + table)
    return {
      select() {
        return {
          eq(_k, _v) {
            return {
              async maybeSingle() {
                if (state.cloudThrows) throw new Error('stub: 云端读取失败（模拟网络异常）')
                return { data: state.cloudRow == null ? null : { key: 'books', value: state.cloudRow }, error: null }
              }
            }
          }
        }
      },
      async upsert(row) {
        if (row.key !== 'books') throw new Error('stub 仅支持 books 键')
        state.upserts.push(row.value)
        state.cloudRow = row.value   // 模拟 PostgREST 写后读一致
        return { error: null }
      }
    }
  }
}
