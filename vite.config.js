import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/quiz-platform/',
  plugins: [react()],
  // emptyOutDir:false：构建不清空 dist（WorkBuddy 的 safe-delete 垫片会拦截 rmSync 导致构建崩溃）。
  // 孤儿产物统一由 scripts/purge-dist.mjs 的语义不变式闸清理。
  build: { outDir: 'dist', emptyOutDir: false, assetsInlineLimit: 0 }
})
