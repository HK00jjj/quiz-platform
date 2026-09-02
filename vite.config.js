import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/quiz-platform/',
  plugins: [react()],
  build: { outDir: 'dist', assetsInlineLimit: 0 }
})
