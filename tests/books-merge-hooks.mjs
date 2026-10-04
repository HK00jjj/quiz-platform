/* books-merge.regression 专用解析钩子：
   ① Vite 相对导入补 .js；② lib/supabase.js → 可编程桩（tests/mocks/supabase-stub-books.mjs），
   db.js 走真实文件（saveBooks 合并逻辑是本测试的验证对象，绝不 stub）。 */
import { pathToFileURL, fileURLToPath } from 'node:url'

const STUB_URL = pathToFileURL(fileURLToPath(new URL('./mocks/supabase-stub-books.mjs', import.meta.url))).href

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
  if (r.url.endsWith('/src/lib/supabase.js')) {
    return { url: STUB_URL, shortCircuit: true, format: 'module' }
  }
  return r
}
