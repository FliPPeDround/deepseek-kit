/* eslint-disable no-console */
import { createModel, generateText, tool } from 'deepseek-agents'
import { z } from 'zod'

const model = createModel({
  model: 'deepseek-v4-flash',
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
})

const { output } = await generateText({
  model,
  tools: [weatherTool],
  messages: [
    {
      role: 'user',
      content: '北京天气天气怎么样',
    },
  ],
  output: {
    schema: z.object({
      city: z.string(),
      weather: z.string(),
    }),
  },
  onStep: (step) => {
    console.log(step)
  },
})

console.log(output)
