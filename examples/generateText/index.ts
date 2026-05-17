/* eslint-disable no-console */
import { createModel, generateText, tool } from 'deepseek-kit'
import { z } from 'zod'

const deepSeek = createModel({
  thinking: {
    type: 'disabled',
  },
})

const weatherTool = tool({
  name: 'weather',
  description: 'useful when you want to know the weather',
  schema: z.object({
    city: z.string().describe('the city you want to know the weather of'),
  }),
  execute: async (input) => {
    return `${input.city}今天天气晴朗`
  },
  timeout: 10000,
  retries: 2,
})

const weatherSchema = z.object({
  city: z.string(),
  weather: z.string(),
})

const output = await generateText({
  model: deepSeek('deepseek-v4-flash'),
  tools: [weatherTool],
  messages: [
    {
      role: 'user',
      content: '北京天气天气怎么样',
    },
  ],
  output: {
    schema: weatherSchema,
  },
  hooks: {
    beforeStep: (context) => {
      console.log('beforeStep', context)
      // 可以在这里修改 messages、tools、config
      // 例如:
      // return {
      //   messages: [...context.messages, { role: 'system', content: '请用中文回答' }],
      //   config: { temperature: 0.7 }
      // }
    },
    afterStep: (step) => {
      console.log('afterStep', step)
    },
    onError: (error) => {
      console.error('onError', error)
    },
  },
})

console.log(output.output)

const textResult = await generateText({
  model: deepSeek('deepseek-v4-flash'),
  messages: [
    {
      role: 'user',
      content: '北京天气天气怎么样',
    },
  ],
})

console.log(textResult.text)
