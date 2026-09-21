// §性能 进站快照（2026-09-21）：loadAll 结果的本地缓存（IndexedDB KV）。
// 全库 3357 题含解析约 5~10MB，超出 localStorage 舒适区，故用 IndexedDB。
// 用法：reloadAll 成功后 idbSet 存一份「上屏状态」；下次启动 init 先读快照
// 立即渲染（ready=true），云端刷新转后台（SWR 语义）——首屏不再等全库拉取。
// 一致性保障：作答写入照常走幂等补传 + reload 内 pendingRecordsMerged 合并，
// 快照只是「上屏加速」，永远是云端数据说了算（attach 后台刷新会覆盖）。

const DB_NAME = 'qa_snapshot'
const STORE = 'kv'

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE) }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function idbGet(key = 'last') {
  try {
    const db = await openDb()
    return await new Promise((resolve, reject) => {
      const t = db.transaction(STORE, 'readonly').objectStore(STORE).get(key)
      t.onsuccess = () => resolve(t.result)
      t.onerror = () => reject(t.error)
    })
  } catch { return undefined }   // 隐私模式/配额异常：当无快照，走原路径
}

export async function idbSet(value, key = 'last') {
  try {
    const db = await openDb()
    await new Promise((resolve, reject) => {
      const t = db.transaction(STORE, 'readwrite')
      t.objectStore(STORE).put(value, key)
      t.oncomplete = resolve
      t.onerror = () => reject(t.error)
    })
    return true
  } catch { return false }
}
