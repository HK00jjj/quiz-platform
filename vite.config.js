import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync } from 'node:fs'
import { resolve } from 'node:path'

/* GitHub Pages 的 SPA fallback（2026-09-11 审查整改）：
   未知路径会被 Pages 回以 404.html，把 index.html 复制一份过去，死链即可落地进应用。
   原先是部署流程里的**手工步骤**（cp dist/index.html dist/404.html），而 vite 重构建时
   不会生成它——漏做则 fallback 静默失效（直接 404、无任何报错）。
   固化成构建插件后，这一步在物理上不可能再被忘掉。 */
const spa404Fallback = () => {
  let root = process.cwd()
  let outDir = 'dist'
  return {
    name: 'spa-404-fallback',
    apply: 'build',
    configResolved(c) { root = c.root; outDir = c.build.outDir },
    closeBundle() {
      const out = resolve(root, outDir)
      copyFileSync(resolve(out, 'index.html'), resolve(out, '404.html'))
    }
  }
}

export default defineConfig({
  base: '/quiz-platform/',
  plugins: [react(), spa404Fallback()],
  // emptyOutDir:false：构建不清空 dist（WorkBuddy 的 safe-delete 垫片会拦截 rmSync 导致构建崩溃）。
  // 孤儿产物统一由 scripts/purge-dist.mjs 的语义不变式闸清理。
  build: { outDir: 'dist', emptyOutDir: false, assetsInlineLimit: 0 }
})
