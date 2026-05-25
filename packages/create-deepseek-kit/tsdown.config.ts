import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  format: 'esm',
  banner: {
    js: '#!/usr/bin/env node',
  },
  deps: {
    onlyBundle: false,
  },
  minify: true,
  publint: true,
})
