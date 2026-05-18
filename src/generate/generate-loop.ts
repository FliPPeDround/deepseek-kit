import type z from 'zod'
import type { GenerateTextParams, GenerateTextResult, StepInvoker, StepRef, StreamEvent } from './types'
import type { ChatMessage, Usage } from '@/model/types'
import type { Tool } from '@/tool'
import type { ChatCompletionTool } from '@/tool/types'
import { AGENT_LOOP_MAX_STEPS } from '@/constants'
import { AgentError, classifyError } from '@/errors'
import { generateStructuredOutput } from './generate-structured-output'
import { buildMessage, emptyUsage, HookRunner, lastAssistantMsg, mergeUsage, StopLoop } from './generate-utils'

async function executeToolCalls(
  toolCalls: ChatCompletionTool[],
  tools: Tool[],
): Promise<Array<{ tool_call_id: string, content: string }>> {
  return Promise.all(
    toolCalls.map(async (toolCall) => {
      const name = toolCall.function?.name
      const tool = tools.find(t => t.name === name)
      const result = tool
        ? await tool.execute(toolCall.function.arguments)
        : `Tool execution error: Tool "${name}" not found`
      return { tool_call_id: toolCall.id, content: result }
    }),
  )
}

export async function* agentLoop<T extends z.ZodTypeAny>(
  params: GenerateTextParams<T>,
  stepInvoker: StepInvoker,
): AsyncGenerator<StreamEvent, GenerateTextResult<unknown>> {
  const { model, tools, system, messages, maxSteps = AGENT_LOOP_MAX_STEPS, prompt, output, hooks, signal } = params
  const currentMessages: ChatMessage[] = buildMessage(prompt, system, messages)
  const currentTools: Tool[] = tools ? [...tools] : []
  const totalUsage: Usage = emptyUsage()
  const runner = new HookRunner()
  const stepRef: StepRef = { value: 0 }

  let currentModel = model

  while (stepRef.value < maxSteps) {
    stepRef.value++
    yield { type: 'step', step: stepRef.value }

    currentModel = runner.runBeforeStep(hooks, stepRef.value, currentMessages, currentTools, currentModel)

    if (runner.stopped) {
      return { text: lastAssistantMsg(currentMessages), output: undefined, usage: totalUsage }
    }

    try {
      const stepGen = stepInvoker(currentModel, {
        messages: currentMessages,
        tools: currentTools,
        signal,
      })

      let stepResult
      while (true) {
        const iterResult = await stepGen.next()
        if (iterResult.done) {
          stepResult = iterResult.value
          break
        }
        yield iterResult.value
      }

      mergeUsage(totalUsage, stepResult.usage)

      currentMessages.push(stepResult.assistantMessage)

      if (stepResult.toolCalls.length > 0 && currentTools.length > 0) {
        const toolResults = await executeToolCalls(stepResult.toolCalls, currentTools)
        for (const { tool_call_id, content } of toolResults) {
          currentMessages.push({ role: 'tool', content, tool_call_id })
        }

        yield { type: 'tool-call', step: stepRef.value, toolCalls: stepResult.toolCalls }

        runner.runAfterStep(hooks, {
          step: stepRef.value,
          type: 'tool',
          toolCalls: stepResult.toolCalls,
          text: stepResult.text || undefined,
          reasoningContent: stepResult.reasoningContent,
          usage: stepResult.usage,
        })
        if (runner.stopped) {
          return { text: lastAssistantMsg(currentMessages), output: undefined, usage: totalUsage }
        }
        continue
      }

      if (output) {
        const structuredData = await generateStructuredOutput({
          model: currentModel,
          conversationMessages: currentMessages,
          schema: output.schema,
          stepRef,
          hooks,
          tools: currentTools,
          hookCtx: runner.hookCtx,
          signal,
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
        step: stepRef.value,
        type: 'text',
        text: stepResult.text,
        reasoningContent: stepResult.reasoningContent,
        usage: stepResult.usage,
      })
      if (runner.stopped) {
        return { text: lastAssistantMsg(currentMessages), output: undefined, usage: totalUsage }
      }

      return { text: stepResult.text, output: undefined, usage: totalUsage }
    }
    catch (error) {
      if (error instanceof StopLoop) {
        return { text: lastAssistantMsg(currentMessages), output: undefined, usage: totalUsage }
      }
      const agentError = classifyError(error, stepRef.value)
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
    step: stepRef.value,
    retryable: false,
  })

  const result = await runner.runOnError(hooks, maxStepsError)
  if (runner.stopped) {
    return { text: lastAssistantMsg(currentMessages), output: undefined, usage: totalUsage }
  }
  throw result
}
