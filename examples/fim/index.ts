/* eslint-disable no-console */
import { createModel, fim } from 'deepseek-kit'

const model = createModel({
  model: 'deepseek-v4-flash',
  thinking: {
    type: 'disabled',
  },
})

const res = await fim({
  model,
  prompt: 'function fib(a)',
  suffix: 'return fib(a-1) + fib(a-2)',
})

console.log(res.text)
