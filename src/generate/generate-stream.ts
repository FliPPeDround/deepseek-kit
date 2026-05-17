import type z from 'zod'
import type { GenerateStreamParams, StreamEvent } from './types'
import type { ChatCompletionChunkDelta, ChatMessage, Usage } from '@/model/types'
import type { ChatCompletionTool } from '@/tool/types'
import { AGENT_LOOP_MAX_STEPS } from '@/constants'
import { AgentError, classifyError } from '@/errors'
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
  const { model, tools, system, messages, maxSteps = AGENT_LOOP_MAX_STEPS, output, hooks } = params

  const currentMessages: ChatMessage[] = system ? [{ role: 'system', content: system }, ...messages] : messages
  let currentTools = tools
  let step = 0
  let totalUsage: Usage | undefined

  let shouldStop = false
  const stop = () => {
    shouldStop = true
  }

  const prevStreamOptions = model.config.streamOptions
  model.config.streamOptions = { ...prevStreamOptions, include_usage: true }

  try {
    while (step < maxSteps) {
      step++
      yield { type: 'step', step }

      try {
        if (hooks?.beforeStep) {
          const hookResult = hooks.beforeStep({
            step,
            messages: [...currentMessages],
            tools: currentTools,
            stop,
          })
          if (shouldStop) {
            yield { type: 'finish', text: '', usage: totalUsage ?? undefined }
            return
          }
          if (hookResult?.messages) {
            currentMessages.length = 0
            currentMessages.push(...hookResult.messages)
          }
          if (hookResult?.tools !== undefined) {
            currentTools = hookResult.tools
          }
          if (hookResult?.config) {
            model.updateConfig(hookResult.config)
          }
        }

        const stream = model.invokeStream({
          messages: currentMessages,
          tools: currentTools,
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

        if ((finishReason === 'tool_calls' || toolCallsAccumulated.length > 0) && currentTools && toolCallsAccumulated.length > 0) {
          currentMessages.push({
            role: 'assistant',
            content: text || null,
            tool_calls: toolCallsAccumulated,
          } as unknown as ChatMessage)

          for (const toolCall of toolCallsAccumulated) {
            const name = toolCall.function?.name
            const tool = currentTools.find(t => t.name === name)
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
          hooks?.afterStep?.({
            step,
            type: 'tool',
            toolCalls: toolCallsAccumulated,
            text: text || undefined,
            usage: totalUsage ?? {
              completion_tokens: 0,
              prompt_tokens: 0,
              prompt_cache_hit_tokens: 0,
              prompt_cache_miss_tokens: 0,
              total_tokens: 0,
              completion_tokens_details: { reasoning_tokens: 0 },
            },
            stop,
          })
          if (shouldStop) {
            yield { type: 'finish', text: '', usage: totalUsage ?? undefined }
            return
          }
          continue
        }

        if (output) {
          const structuredData = await generateStructuredOutput({
            model,
            conversationMessages: currentMessages,
            schema: output.schema,
            step,
            tools: currentTools,
            hooks,
            stop,
          })
          if (shouldStop) {
            yield { type: 'finish', text: '', usage: totalUsage ?? undefined }
            return
          }
          yield { type: 'finish', text: JSON.stringify(structuredData), usage: totalUsage ?? undefined }
          return
        }

        hooks?.afterStep?.({
          step,
          type: 'text',
          text,
          usage: totalUsage ?? {
            completion_tokens: 0,
            prompt_tokens: 0,
            prompt_cache_hit_tokens: 0,
            prompt_cache_miss_tokens: 0,
            total_tokens: 0,
            completion_tokens_details: { reasoning_tokens: 0 },
          },
          stop,
        })
        if (shouldStop) {
          yield { type: 'finish', text: '', usage: totalUsage ?? undefined }
          return
        }
        yield { type: 'finish', text, usage: totalUsage ?? undefined }
        return
      }
      catch (error) {
        const agentError = classifyError(error, step)
        if (hooks?.onError) {
          const result = await hooks.onError(agentError, { stop })
          if (shouldStop) {
            yield { type: 'finish', text: '', usage: totalUsage ?? undefined }
            return
          }
          if (result instanceof AgentError) {
            throw result
          }
        }
        else {
          throw agentError
        }
      }
    }

    const maxStepsError = new AgentError({
      message: `Max steps (${maxSteps}) reached without getting a final response`,
      type: 'max_steps',
      step: maxSteps,
      retryable: false,
    })

    if (hooks?.onError) {
      const result = await hooks.onError(maxStepsError, { stop })
      if (shouldStop) {
        yield { type: 'finish', text: '', usage: totalUsage ?? undefined }
        return
      }
      if (result instanceof AgentError) {
        throw result
      }
    }
    else {
      throw maxStepsError
    }
  }
  finally {
    model.config.streamOptions = prevStreamOptions
  }
}
