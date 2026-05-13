import type z from 'zod'
import type { GenerateStreamParams, StreamEvent } from './types'
import type { ChatCompletionChunkDelta, ChatMessage, Usage } from '@/model/types'
import type { ChatCompletionTool } from '@/tool/types'
import { AGENT_LOOP_MAX_STEPS } from '@/constants'
import { generateStructuredOutput } from './generate-structured-output'

function accumulateToolCalls(
  accumulated: ChatCompletionTool[],
  deltaToolCalls: NonNullable<ChatCompletionChunkDelta['tool_calls']>,
): ChatCompletionTool[] {
  for (const delta of deltaToolCalls) {
    const existing = accumulated[delta.index]
    if (!existing) {
      accumulated[delta.index] = {
        id: delta.id || '',
        type: 'function',
        function: {
          name: delta.function?.name || '',
          arguments: delta.function?.arguments || '',
        },
      }
    }
    else {
      if (delta.id) {
        existing.id = delta.id
      }
      if (delta.function?.name) {
        existing.function.name += delta.function.name
      }
      if (delta.function?.arguments) {
        existing.function.arguments += delta.function.arguments
      }
    }
  }
  return accumulated
}

export async function* generateStream<T extends z.ZodTypeAny>(params: GenerateStreamParams<T>): AsyncGenerator<StreamEvent> {
  const { model, tools, system, messages, maxSteps = AGENT_LOOP_MAX_STEPS, output } = params

  const currentMessages: ChatMessage[] = system ? [{ role: 'system', content: system }, ...messages] : messages
  let step = 0
  let totalUsage: Usage | undefined

  const prevStreamOptions = model.config.streamOptions
  model.config.streamOptions = { ...prevStreamOptions, include_usage: true }

  try {
    while (step < maxSteps) {
      step++
      yield { type: 'step', step }

      const stream = model.invokeStream({
        messages: currentMessages,
        tools,
      })

      let text = ''
      let toolCallsAccumulated: ChatCompletionTool[] = []
      let finishReason: string | null = null

      for await (const chunk of stream) {
        if (chunk.usage) {
          totalUsage = chunk.usage
        }

        const choice = chunk.choices[0]
        if (!choice) {
          continue
        }

        const delta = choice.delta

        if (delta.content) {
          text += delta.content
          yield { type: 'text-delta', textDelta: delta.content }
        }

        if (delta.reasoning_content) {
          yield { type: 'reasoning-delta', reasoningDelta: delta.reasoning_content }
        }

        if (delta.tool_calls) {
          toolCallsAccumulated = accumulateToolCalls(toolCallsAccumulated, delta.tool_calls)
        }

        if (choice.finish_reason) {
          finishReason = choice.finish_reason
        }
      }

      if ((finishReason === 'tool_calls' || toolCallsAccumulated.length > 0) && tools && toolCallsAccumulated.length > 0) {
        currentMessages.push({
          role: 'assistant',
          content: text || null,
          tool_calls: toolCallsAccumulated,
        } as unknown as ChatMessage)

        for (const toolCall of toolCallsAccumulated) {
          const name = toolCall.function?.name
          const tool = tools.find(t => t.name === name)
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

        yield { type: 'tool-call', step, toolCalls: toolCallsAccumulated }
        continue
      }

      if (output) {
        const structuredData = await generateStructuredOutput({
          model,
          conversationMessages: currentMessages,
          schema: output.schema,
          step,
          tools,
        })
        yield { type: 'finish', text: JSON.stringify(structuredData), usage: totalUsage ?? undefined }
        return
      }

      yield { type: 'finish', text, usage: totalUsage ?? undefined }
      return
    }

    throw new Error(`Max steps (${maxSteps}) reached without getting a final response`)
  }
  finally {
    model.config.streamOptions = prevStreamOptions
  }
}
