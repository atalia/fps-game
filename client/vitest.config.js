import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['js/**/*.js'],
      exclude: ['js/main.js'],
      target: 75
    },
    globals: true,
    // 暂时排除需要 Node.js fs 模块的测试
    exclude: ['js/__tests__/handlers.test.js']
  }
})
