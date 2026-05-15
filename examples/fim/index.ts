/* eslint-disable no-console */
import { createModel, fim } from 'deepseek-kit'

const deepSeek = createModel({
  thinking: {
    type: 'disabled',
  },
})

const res = await fim({
  model: deepSeek('deepseek-v4-flash'),
  prompt: 'function fib(a)',
  suffix: 'return fib(a-1) + fib(a-2)',
})

console.log(res.text)
