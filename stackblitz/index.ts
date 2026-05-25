import 'dotenv/config'
import { createAgent, createModel, tool } from 'deepseek-kit'
import { z } from 'zod'

const model = createModel({ model: 'deepseek-v4-flash' })

const weatherTool = tool({
  name: 'get_weather',
  description: 'Get weather information for a city',
  schema: z.object({
    city: z.string().describe('City name'),
  }),
  execute: async ({ city }) => `${city}: Sunny, 25°C`,
})

const agent = createAgent({
  model,
  tools: [weatherTool],
  output: {
    schema: z.object({
      city: z.string(),
      weather: z.string(),
      temperature: z.number(),
    }),
  },
})

const result = await agent.generate({
  prompt: 'How\'s the weather in Chongqing today?',
})

console.log(result.output)
