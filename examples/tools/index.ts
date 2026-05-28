/* eslint-disable no-console */
import { createAgent, createModel, tool } from 'deepseek-kit'
import { z } from 'zod'

const model = createModel({
  model: 'deepseek-v4-flash',
  strict: true,
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

const agent = createAgent({
  model,
  tools: [weatherTool],
  output: {
    schema: z.object({
      city: z.string(),
      weather: z.string(),
    }),
  },
  hooks: {
    beforeStep: (context) => {
      console.log('beforeStep', context.config)
    },
  },
})

const res = await agent.generate({
  prompt: '北京的天气怎么样',
})

console.log(res.output, res.text, res.usage)
