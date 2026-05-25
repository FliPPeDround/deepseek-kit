import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  format: 'esm',
  banner: {
    js: '#!/usr/bin/env node',
  },
  minify: true,
})
