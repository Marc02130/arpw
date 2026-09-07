import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'

export default defineConfig(() => {
  const env = loadEnv('test', process.cwd(), '')
  Object.assign(process.env, env)
  return {
    test: {
      environment: 'node',
      include: ['src/**/*.integration.test.ts'],
      testTimeout: 30_000,
      hookTimeout: 30_000,
      fileParallelism: false,
    },
  }
})
