import type z from 'zod'
import type { GenerateTextParams } from './types'
import type { ChatCompletionChoice, ChatMessage } from '@/model/types'
import { AGENT_LOOP_MAX_STEPS } from '@/constants'
import { generateStructuredOutput } from './generate-structured-output'

function needsToolCall(choices: ChatCompletionChoice) {
  if (choices.finish_reason === 'tool_calls') {
    return true
  }
  if (choices?.message?.tool_calls?.length > 0) {
    return true
  }
  return false
}

export async function generateText<T extends z.ZodTypeAny>(params: GenerateTextParams<T> & { output: { schema: T } }): Promise<z.infer<T>>
export async function generateText(params: Omit<GenerateTextParams<z.ZodTypeAny>, 'output'>): Promise<string>
export async function generateText<T extends z.ZodTypeAny>(params: GenerateTextParams<T>) {
  const { model, tools, system, messages, maxSteps = AGENT_LOOP_MAX_STEPS, onStep, output } = params

  const currentMessages: ChatMessage[] = system ? [{ role: 'system', content: system }, ...messages] : messages
  let step = 0
  while (step < maxSteps) {
    step++

    const response = await model.invoke({
      messages: currentMessages,
      tools,
    })

    const choice = response.choices[0]
    const message = choice.message
    currentMessages.push(message as unknown as ChatMessage)
    if (needsToolCall(choice) && tools) {
      for (const toolCall of message.tool_calls) {
        const name = toolCall.function?.name
        const tool = tools.find(tool => tool.name === name)
        if (tool) {
          const args = toolCall.function.arguments
          const result = await tool.execute(args)
          currentMessages.push({
            role: 'tool',
            content: result,
            tool_call_id: toolCall.id,
          })
        }
      }

      onStep?.({
        step,
        type: 'tool',
        toolCalls: message.tool_calls,
        text: message.content,
        reasoningContent: message.reasoning_content,
      })
      continue
    }

    if (output) {
      const structuredData = await generateStructuredOutput({
        model,
        conversationMessages: currentMessages,
        schema: output.schema,
        onStep,
        step,
      })
      return structuredData
    }

    onStep?.({
      step,
      type: 'text',
      text: message.content || '',
      reasoningContent: message.reasoning_content || '',
    })

    return message.content || ''
  }

  throw new Error(`Max steps (${maxSteps}) reached without getting a final response`)
}
