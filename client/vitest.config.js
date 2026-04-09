import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['js/**/*.js'],
      exclude: ['js/main.js'],
      target: 75
    },
    globals: true,
    include: ['tests/**/*.test.js', 'js/__tests__/**/*.test.js'],
    exclude: ['node_modules/**'],
    // 为不同的测试文件指定不同的环境
    environmentMatchGlobs: [
      // 需要读取文件的测试使用 node 环境
      ['js/__tests__/*.test.js', 'node'],
      // 其他测试使用 jsdom 环境
      ['tests/**/*.test.js', 'jsdom']
    ]
  }
})
