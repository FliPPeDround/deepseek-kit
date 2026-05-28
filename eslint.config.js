// @ts-check
import antfu from '@antfu/eslint-config'

export default antfu(
  {
    type: 'lib',
    pnpm: true,
    rules: {
      'ts/explicit-function-return-type': 'off',
      'antfu/no-top-level-await': 'off',
    },
    ignores: ['website/content/**', '.trae/**', 'stackblitz/**', '.agents/**', 'skills'],
  },
)
