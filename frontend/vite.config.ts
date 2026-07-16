/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['echarts-for-react/lib/core', 'echarts/core', 'echarts/charts', 'echarts/components', 'echarts/renderers'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/tests/setup.ts'],
    css: true,
  },
})
