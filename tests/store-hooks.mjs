/* Node ESM 自定义解析钩子（仅供 tests/offline-queue.regression.mjs，2026-09-11）：
   目的 = 在 Node 里加载真实的 store.js 跑离线队列回归，而**不改任何生产行为**。
   ① resolve：Vite 允许相对导入不带扩展名（store.js 的 './lib/db'、'./lib/supabase'），
      Node ESM 默认不允许——补 .js 重试；
   ② redirect：lib/db.js 重定向到 tests/mocks/db-stub.mjs（可编程桩，记录调用/按需失败），
      避免 supabase 网络调用；
   ③ load：store.js 的 `import.meta.env` 是 Vite 专有全局，Node 直跑会
      `undefined.MODE` 崩溃——load 时替换为等价对象（MODE:'production' 使 DEMO=false，
      与生产构建语义一致），**store.js 源码本身一字不改**。
   本文件由 register() 在主线程注册，钩子在内部线程运行；桩的可编程部分走
   globalThis.__dbStub（主线程与桩模块同线程，无跨线程共享问题）。 */
import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

const STUB_URL = pathToFileURL(fileURLToPath(new URL('./mocks/db-stub.mjs', import.meta.url))).href

export async function resolve(specifier, context, nextResolve) {
  let r
  try {
    r = await nextResolve(specifier, context)
  } catch (e) {
    const retriable = e?.code === 'ERR_MODULE_NOT_FOUND' || e?.code === 'ERR_UNSUPPORTED_RESOLVE_REQUEST'
    if (retriable && /^\.{1,2}\//.test(specifier)) {
      r = await nextResolve(specifier + '.js', context)
    } else {
      throw e
    }
  }
  if (r.url.endsWith('/src/lib/db.js')) {
    return { url: STUB_URL, shortCircuit: true, format: 'module' }
  }
  return r
}

export async function load(url, context, nextLoad) {
  if (url.endsWith('/src/store.js')) {
    const src = readFileSync(fileURLToPath(url), 'utf8')
      .replaceAll('import.meta.env', '({ MODE: "production" })')
    return { format: 'module', source: src, shortCircuit: true }
  }
  return nextLoad(url, context)
}
