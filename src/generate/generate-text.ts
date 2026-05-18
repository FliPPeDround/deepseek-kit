import type z from 'zod'
import type { GenerateTextParams, GenerateTextResult } from './types'
import type { ChatMessage, Usage } from '@/model/types'
import type { Tool } from '@/tool'
import { AGENT_LOOP_MAX_STEPS } from '@/constants'
import { AgentError, classifyError } from '@/errors'
import { generateStructuredOutput } from './generate-structured-output'
import { buildMessage, emptyUsage, HookRunner, lastAssistantMsg, mergeUsage, needsToolCall } from './generate-utils'

interface GenerateTextParamsWithOutput<T extends z.ZodTypeAny> extends GenerateTextParams<T> {
  output: {
    schema: T
  }
}

interface GenerateTextParamsWithoutOutput extends GenerateTextParams<z.ZodTypeAny> {
  output?: never
}

export async function generateText<T extends z.ZodTypeAny>(
  params: GenerateTextParamsWithOutput<T>,
): Promise<GenerateTextResult<z.infer<T>>>
export async function generateText(
  params: GenerateTextParamsWithoutOutput,
): Promise<GenerateTextResult<undefined>>
export async function generateText<T extends z.ZodTypeAny>(params: GenerateTextParams<T>): Promise<GenerateTextResult<unknown>> {
  const { model, tools, system, messages, maxSteps = AGENT_LOOP_MAX_STEPS, prompt, output, hooks } = params
  const chatMessage = buildMessage(prompt, system, messages)

  const currentMessages: ChatMessage[] = chatMessage
  const currentTools: Tool[] = tools ? [...tools] : []
  const totalUsage: Usage = emptyUsage()
  const runner = new HookRunner()

  let step = 0
  while (step < maxSteps) {
    step++

    try {
      runner.runBeforeStep(hooks, step, currentMessages, currentTools, model)
      if (runner.stopped) {
        return {
          text: lastAssistantMsg(currentMessages),
          output: undefined,
          usage: totalUsage,
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

      if (needsToolCall(choice) && currentTools.length > 0) {
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

        runner.runAfterStep(hooks, {
          step,
          type: 'tool',
          toolCalls: message.tool_calls,
          text: message.content ?? undefined,
          reasoningContent: message.reasoning_content ?? undefined,
          usage: response.usage,
        })
        if (runner.stopped) {
          return { text: lastAssistantMsg(currentMessages), output: undefined, usage: totalUsage }
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
          hookCtx: runner.hookCtx,
        })
        if (runner.stopped) {
          return { text: lastAssistantMsg(currentMessages), output: undefined, usage: totalUsage }
        }
        return {
          text: lastAssistantMsg(currentMessages),
          output: structuredData,
          usage: totalUsage,
        }
      }

      runner.runAfterStep(hooks, {
        step,
        type: 'text',
        text: message.content || '',
        reasoningContent: message.reasoning_content || '',
        usage: response.usage,
      })
      if (runner.stopped) {
        return { text: lastAssistantMsg(currentMessages), output: undefined, usage: totalUsage }
      }

      return { text: message.content || '', output: undefined, usage: totalUsage }
    }
    catch (error) {
      const agentError = classifyError(error, step)
      const result = await runner.runOnError(hooks, agentError)
      if (runner.stopped) {
        return { text: lastAssistantMsg(currentMessages), output: undefined, usage: totalUsage }
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
    return {
      text: lastAssistantMsg(currentMessages),
      output: undefined,
      usage: totalUsage,
    }
  }
  throw result
  // if (result) {
  // }
}
