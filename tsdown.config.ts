import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'tsdown'
import { StaleGuardRecorder } from 'tsdown-stale-guard'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  alias: {
    '@': path.resolve(__dirname, 'src'),
  },
  entry: [
    'src/index.ts',
  ],
  dts: true,
  exports: true,
  publint: true,
  plugins: [
    StaleGuardRecorder(),
  ],
})
