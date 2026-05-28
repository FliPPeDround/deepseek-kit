/* eslint-disable no-console */
import { createAgent, createModel, tool } from 'deepseek-kit'
import { z } from 'zod'

const model = createModel({
  model: 'deepseek-v4-flash',
})

const weatherTool = tool({
  name: 'weather',
  description: 'useful when you want to know the weather',
  schema: z.object({
    city: z.string().describe('the city you want to know the weather of'),
  }),
  strict: true,
  execute: async (input) => {
    if (input.city === '重庆') {
      return `重庆今天天气晴朗`
    }
    if (input.city === '北京') {
      return `北京今天在下大雨`
    }
    return `${input.city}今天天气晴朗`
  },
  timeout: 10000,
  retries: 2,
})

const weatherTool1 = tool({
  name: 'weather1',
  description: 'useful when you want to know the weather',
  schema: z.object({
    city: z.string().describe('the city you want to know the weather of'),
  }),
  strict: true,
  execute: async (input) => {
    if (input.city === '重庆') {
      return `重庆今天天气晴朗`
    }
    if (input.city === '北京') {
      return `北京今天在下大雨`
    }
    return `${input.city}今天天气晴朗`
  },
  timeout: 10000,
  retries: 2,
})

const agent = createAgent({
  model,
  tools: [weatherTool, weatherTool1],
  output: {
    schema: z.object({
      city: z.string(),
      weather: z.string(),
    }),
  },
  hooks: {
    beforeStep: (context) => {
      console.log('beforeStep', context)
      if (context.step === 1) {
        return {
          messages: [
            {
              role: 'user',
              content: '重庆的天气怎么样',
            },
          ],
          config: {
            model: 'deepseek-v4-flash',
          },
        }
      }
    },
    // afterStep: (step) => {
    //   console.log('afterStep', step)
    // },
    // onError: (error) => {
    //   console.error('onError', error)
    //   // 可以决定是否抛出错误或者返回新的错误
    //   return error
    // },
  },
})

const res = await agent.generate({
  messages: [
    {
      role: 'user',
      content: '北京的天气怎么样',
    },
  ],
})

console.log(res.output, res.text, res.usage)

// await agent.generate({
//   messages: [
//     {
//       role: 'user',
//       content: '重庆天气天气怎么样',
//     },
//   ],
// })

// console.log(output, output.text, output.usage)
