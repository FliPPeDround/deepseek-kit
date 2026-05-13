import type z from 'zod'
import type { GenerateOutputResult, GenerateTextParams, GenerateTextResult } from './types'
import type { ChatCompletionChoice, ChatMessage, Usage } from '@/model/types'
import { AGENT_LOOP_MAX_STEPS } from '@/constants'
import { generateStructuredOutput } from './generate-structured-output'

function needsToolCall(choice: ChatCompletionChoice) {
  if (choice.finish_reason === 'tool_calls') {
    return true
  }
  if (choice.message?.tool_calls?.length > 0) {
    return true
  }
  return false
}

function mergeUsage(target: Usage, source: Usage): void {
  target.completion_tokens += source.completion_tokens
  target.prompt_tokens += source.prompt_tokens
  target.prompt_cache_hit_tokens += source.prompt_cache_hit_tokens
  target.prompt_cache_miss_tokens += source.prompt_cache_miss_tokens
  target.total_tokens += source.total_tokens
  target.completion_tokens_details.reasoning_tokens += source.completion_tokens_details?.reasoning_tokens ?? 0
}

export async function generateText<T extends z.ZodTypeAny>(params: GenerateTextParams<T> & { output: { schema: T } }): Promise<GenerateOutputResult<T>>
export async function generateText(params: Omit<GenerateTextParams<z.ZodTypeAny>, 'output'>): Promise<GenerateTextResult>
export async function generateText<T extends z.ZodTypeAny>(params: GenerateTextParams<T>) {
  const { model, tools, system, messages, maxSteps = AGENT_LOOP_MAX_STEPS, onStep, output } = params

  const currentMessages: ChatMessage[] = system ? [{ role: 'system', content: system }, ...messages] : messages
  const totalUsage: Usage = {
    completion_tokens: 0,
    prompt_tokens: 0,
    prompt_cache_hit_tokens: 0,
    prompt_cache_miss_tokens: 0,
    total_tokens: 0,
    completion_tokens_details: { reasoning_tokens: 0 },
  }

  let step = 0
  while (step < maxSteps) {
    step++

    const response = await model.invoke({
      messages: currentMessages,
      tools,
    })

    if (response.usage) {
      mergeUsage(totalUsage, response.usage)
    }

    const choice = response.choices[0]
    if (!choice) {
      throw new Error('DeepSeek API returned empty choices')
    }

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
        text: message.content ?? undefined,
        reasoningContent: message.reasoning_content ?? undefined,
        usage: response.usage,
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
      return { output: structuredData, usage: totalUsage }
    }

    onStep?.({
      step,
      type: 'text',
      text: message.content || '',
      reasoningContent: message.reasoning_content || '',
      usage: response.usage,
    })

    return { text: message.content || '', usage: totalUsage }
  }

  throw new Error(`Max steps (${maxSteps}) reached without getting a final response`)
}
