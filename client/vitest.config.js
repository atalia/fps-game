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
    // 只运行项目测试，排除 node_modules 和需要 Node.js fs 模块的测试
    include: ['tests/**/*.test.js', 'js/__tests__/**/*.test.js'],
    exclude: ['node_modules/**', 'js/__tests__/handlers.test.js']
  }
})
