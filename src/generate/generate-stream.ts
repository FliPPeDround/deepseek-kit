import type z from 'zod'
import type { GenerateTextParams, StepInvoker, StepResult, StreamEvent } from './types'
import type { ChatCompletionChunkDelta, ChatMessage, Usage } from '@/model/types'
import type { ChatCompletionTool } from '@/tool/types'
import { agentLoop } from './generate-loop'
import { emptyUsage, mergeUsage } from './generate-utils'

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

const streamStepInvoker: StepInvoker = async function* (model, params) {
  const streamModel = model.withConfig({ streamOptions: { include_usage: true } })
  const stream = streamModel.invokeStream({
    messages: params.messages,
    tools: params.tools,
    signal: params.signal,
  })

  let text = ''
  let toolCallsAccumulated: ChatCompletionTool[] = []
  let finishReason: string | null = null
  const stepUsage: Usage = emptyUsage()

  for await (const chunk of stream) {
    if (chunk.usage) {
      mergeUsage(stepUsage, chunk.usage)
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

  const assistantMessage = {
    role: 'assistant',
    content: text || null,
    tool_calls: toolCallsAccumulated,
  } as unknown as ChatMessage

  return {
    text,
    toolCalls: toolCallsAccumulated,
    finishReason,
    usage: stepUsage,
    assistantMessage,
    reasoningContent: undefined,
  } as StepResult
}

export async function* generateStream<T extends z.ZodTypeAny>(params: GenerateTextParams<T>): AsyncGenerator<StreamEvent> {
  const gen = agentLoop(params, streamStepInvoker)
  let iterResult = await gen.next()
  while (!iterResult.done) {
    yield iterResult.value
    iterResult = await gen.next()
  }
  yield { type: 'finish', text: iterResult.value.text, usage: iterResult.value.usage }
}
