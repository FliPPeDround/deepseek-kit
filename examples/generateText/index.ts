/* eslint-disable no-console */
import { createModel, generateText, tool } from 'deepseek-agents'
import { z } from 'zod'

const model = createModel({
  model: 'deepseek-v4-flash',
  thinking: {
    type: 'disabled',
  },
})
const weatherSchema = z.object({ city: z.string() })
const weatherTool = tool({
  name: 'weather',
  description: 'useful when you want to know the weather',
  schema: weatherSchema,
  execute: async (input) => {
    return `${input.city}今天天气晴朗`
  },
})

const text = await generateText({
  model,
  tools: [weatherTool],
  messages: [
    {
      role: 'user',
      content: '北京天气天气怎么样',
    },
  ],
  responseFormat: {
    schema: z.object({
      city: z.string(),
      weather: z.string(),
    }),
  },
  onStep: (step) => {
    console.log(step)
  },
})

console.log(text)
