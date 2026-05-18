import type z from 'zod'
import type { GenerateStreamParams, StreamEvent } from './types'
import type { ChatCompletionChunkDelta, ChatMessage, Usage } from '@/model/types'
import type { Tool } from '@/tool'
import type { ChatCompletionTool } from '@/tool/types'
import { AGENT_LOOP_MAX_STEPS } from '@/constants'
import { AgentError, classifyError } from '@/errors'
import { generateStructuredOutput } from './generate-structured-output'
import { buildMessage, emptyUsage, HookRunner, lastAssistantMsg, mergeUsage } from './generate-utils'

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
  const { model, tools, system, messages, maxSteps = AGENT_LOOP_MAX_STEPS, prompt, output, hooks, signal } = params

  const currentMessages: ChatMessage[] = buildMessage(prompt, system, messages)
  const currentTools: Tool[] = tools ? [...tools] : []
  let step = 0
  const totalUsage: Usage = emptyUsage()
  const runner = new HookRunner()

  let currentModel = model.withConfig({ streamOptions: { include_usage: true } })

  while (step < maxSteps) {
    step++
    yield { type: 'step', step }

    currentModel = runner.runBeforeStep(hooks, step, currentMessages, currentTools, currentModel)

    if (runner.stopped) {
      yield { type: 'finish', text: lastAssistantMsg(currentMessages), usage: totalUsage }
      return
    }

    try {
      const stream = currentModel.invokeStream({
        messages: currentMessages,
        tools: currentTools,
        signal,
      })

      let text = ''
      let toolCallsAccumulated: ChatCompletionTool[] = []
      let finishReason: string | null = null

      for await (const chunk of stream) {
        if (chunk.usage) {
          mergeUsage(totalUsage, chunk.usage)
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

      if ((finishReason === 'tool_calls' || toolCallsAccumulated.length > 0) && currentTools.length > 0 && toolCallsAccumulated.length > 0) {
        currentMessages.push({
          role: 'assistant',
          content: text || null,
          tool_calls: toolCallsAccumulated,
        } as unknown as ChatMessage)

        const toolResults = await Promise.all(
          toolCallsAccumulated.map(async (toolCall) => {
            const name = toolCall.function?.name
            const tool = currentTools.find(t => t.name === name)
            const result = tool
              ? await tool.execute(toolCall.function.arguments)
              : `Tool execution error: Tool "${name}" not found`
            return { tool_call_id: toolCall.id, content: result }
          }),
        )
        for (const { tool_call_id, content } of toolResults) {
          currentMessages.push({ role: 'tool', content, tool_call_id })
        }

        yield { type: 'tool-call', step, toolCalls: toolCallsAccumulated }
        runner.runAfterStep(hooks, {
          step,
          type: 'tool',
          toolCalls: toolCallsAccumulated,
          text: text || undefined,
          usage: totalUsage,
        })
        if (runner.stopped) {
          yield { type: 'finish', text: lastAssistantMsg(currentMessages), usage: totalUsage }
          return
        }
        continue
      }

      if (output) {
        const structuredData = await generateStructuredOutput({
          model: currentModel,
          conversationMessages: currentMessages,
          schema: output.schema,
          step,
          tools: currentTools,
          hooks,
          hookCtx: runner.hookCtx,
          signal,
        })
        if (runner.stopped) {
          yield { type: 'finish', text: lastAssistantMsg(currentMessages), usage: totalUsage }
          return
        }
        yield { type: 'finish', text: JSON.stringify(structuredData), usage: totalUsage }
        return
      }

      runner.runAfterStep(hooks, {
        step,
        type: 'text',
        text,
        usage: totalUsage,
      })
      if (runner.stopped) {
        yield { type: 'finish', text: lastAssistantMsg(currentMessages), usage: totalUsage }
        return
      }
      yield { type: 'finish', text, usage: totalUsage }
      return
    }
    catch (error) {
      const agentError = classifyError(error, step)
      const result = await runner.runOnError(hooks, agentError)
      if (runner.stopped) {
        yield { type: 'finish', text: lastAssistantMsg(currentMessages), usage: totalUsage }
        return
      }
      if (result) {
        throw result
      }
    }
  }

  const maxStepsError = new AgentError({
    message: `Max steps (${maxSteps}) reached without getting a final response`,
    type: 'max_steps',
    step: maxSteps,
    retryable: false,
  })

  const result = await runner.runOnError(hooks, maxStepsError)
  if (runner.stopped) {
    yield { type: 'finish', text: lastAssistantMsg(currentMessages), usage: totalUsage }
    return
  }
  if (result) {
    throw result
  }
}
