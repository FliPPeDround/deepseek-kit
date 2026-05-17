import type z from 'zod'
import type { GenerateOutputResult, GenerateTextParams, GenerateTextResult } from './types'
import type { ChatCompletionChoice, ChatMessage, Usage } from '@/model/types'
import { AGENT_LOOP_MAX_STEPS } from '@/constants'
import { AgentError, classifyError } from '@/errors'
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

function buildMessage(prompt?: string, system?: string, messages?: ChatMessage[]): ChatMessage[] {
  if (!prompt && !system && !messages) {
    throw new Error('prompt is required')
  }
  const message: ChatMessage[] = []
  if (system) {
    message.push({ role: 'system', content: system })
  }
  if (messages) {
    message.push(...messages)
  }
  if (prompt) {
    message.push({ role: 'user', content: prompt })
  }
  return message
}

export async function generateText<T extends z.ZodTypeAny>(params: GenerateTextParams<T> & { output: { schema: T } }): Promise<GenerateOutputResult<T>>
export async function generateText(params: Omit<GenerateTextParams<z.ZodTypeAny>, 'output'>): Promise<GenerateTextResult>
export async function generateText<T extends z.ZodTypeAny>(params: GenerateTextParams<T>) {
  const { model, tools, system, messages, maxSteps = AGENT_LOOP_MAX_STEPS, prompt, output, hooks } = params
  const chatMessage = buildMessage(prompt, system, messages)

  const currentMessages: ChatMessage[] = chatMessage
  let currentTools = tools
  const totalUsage: Usage = {
    completion_tokens: 0,
    prompt_tokens: 0,
    prompt_cache_hit_tokens: 0,
    prompt_cache_miss_tokens: 0,
    total_tokens: 0,
    completion_tokens_details: { reasoning_tokens: 0 },
  }

  let shouldStop = false
  const stop = () => {
    shouldStop = true
  }

  let step = 0
  while (step < maxSteps) {
    step++

    try {
      if (hooks?.beforeStep) {
        const hookResult = hooks.beforeStep({
          step,
          messages: [...currentMessages],
          tools: currentTools,
          stop,
        })
        if (shouldStop) {
          return { text: '', usage: totalUsage }
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

      const response = await model.invoke({
        messages: currentMessages,
        tools: currentTools,
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

      if (needsToolCall(choice) && currentTools) {
        for (const toolCall of message.tool_calls) {
          const name = toolCall.function?.name
          const tool = currentTools.find(tool => tool.name === name)
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

        hooks?.afterStep?.({
          step,
          type: 'tool',
          toolCalls: message.tool_calls,
          text: message.content ?? undefined,
          reasoningContent: message.reasoning_content ?? undefined,
          usage: response.usage,
          stop,
        })
        if (shouldStop) {
          return { text: '', usage: totalUsage }
        }
        continue
      }

      if (output) {
        const structuredData = await generateStructuredOutput({
          model,
          conversationMessages: currentMessages,
          schema: output.schema,
          hooks,
          step,
          tools: currentTools,
          stop,
        })
        if (shouldStop) {
          return { text: '', usage: totalUsage }
        }
        return { output: structuredData, usage: totalUsage }
      }

      hooks?.afterStep?.({
        step,
        type: 'text',
        text: message.content || '',
        reasoningContent: message.reasoning_content || '',
        usage: response.usage,
        stop,
      })
      if (shouldStop) {
        return { text: '', usage: totalUsage }
      }

      return { text: message.content || '', usage: totalUsage }
    }
    catch (error) {
      const agentError = classifyError(error, step)
      if (hooks?.onError) {
        const result = await hooks.onError(agentError, { stop })
        if (shouldStop) {
          return { text: '', usage: totalUsage }
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
      return { text: '', usage: totalUsage }
    }
    if (result instanceof AgentError) {
      throw result
    }
  }
  else {
    throw maxStepsError
  }
}
