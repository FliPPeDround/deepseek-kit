/* eslint-disable no-console */
import process from 'node:process'
import { createModel, generateStream, tool } from 'deepseek-kit'
import { z } from 'zod'

const model = createModel({
  model: 'deepseek-v4-flash',
  thinking: {
    type: 'disabled',
  },
})

console.log('=== Basic Stream Example ===')

const stream = generateStream({
  model,
  messages: [
    {
      role: 'user',
      content: '请用三句话介绍你自己',
    },
  ],
})

let fullText = ''
for await (const event of stream) {
  switch (event.type) {
    case 'text-delta':
      process.stdout.write(event.textDelta)
      fullText += event.textDelta
      break
    case 'reasoning-delta':
      console.log('\n[Reasoning]:', event.reasoningDelta)
      break
    case 'tool-call':
      console.log('\n[Tool Call]:', JSON.stringify(event.toolCalls, null, 2))
      break
    case 'step':
      console.log('\n[Step]:', event.step)
      break
    case 'finish':
      console.log('\n\n[Finish]')
      console.log('Full text:', fullText)
      console.log('Usage:', JSON.stringify(event.usage, null, 2))
      break
  }
}

console.log('\n\n=== Stream with Tools Example ===')

const timeTool = tool({
  name: 'get_time',
  description: '获取当前时间',
  schema: z.object({
    timezone: z.string().describe('时区，例如: Asia/Shanghai'),
  }),
  execute: async (input: { timezone: string }) => {
    return `当前时间是 ${new Date().toLocaleString('zh-CN', { timeZone: input.timezone || 'Asia/Shanghai' })}`
  },
})

const streamWithTools = generateStream({
  model,
  tools: [timeTool],
  messages: [
    {
      role: 'user',
      content: '现在几点了？',
    },
  ],
  maxSteps: 3,
})

for await (const event of streamWithTools) {
  switch (event.type) {
    case 'text-delta':
      process.stdout.write(event.textDelta)
      break
    case 'tool-call':
      console.log('\n[Tool Call]:', JSON.stringify(event.toolCalls, null, 2))
      break
    case 'finish':
      console.log('\n[Finish] Usage:', JSON.stringify(event.usage, null, 2))
      break
  }
}
