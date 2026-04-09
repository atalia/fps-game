import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    include: ['client/**/*.test.js'],
    exclude: [
      'node_modules/**',
      'client/node_modules/**',
    ],
    // 只对 client/tests 目录启用 jsdom（client/js/__tests__ 使用 node 模块）
    environmentMatchGlobs: [
      ['client/tests/**/*.test.js', 'jsdom'],
    ],
  },
})
