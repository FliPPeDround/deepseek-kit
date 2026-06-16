import type z from 'zod'
import type { GenerateTextParams, GenerateTextResult, StepInvoker, StepRef, StreamEvent } from './types'
import type { ChatMessage, ResolvedModelOptions, Usage } from '@/model/types'
import type { Tool } from '@/tool'
import type { ChatCompletionTool } from '@/tool/types'
import { AGENT_LOOP_MAX_STEPS } from '@/constants'
import { createCompactMessage } from '@/context/compact'
import { AgentError, classifyError } from '@/errors'
import { generateStructuredOutput } from './generate-structured-output'
import { buildMessage, emptyUsage, HookRunner, lastAssistantMsg, mergeUsage, StopLoop } from './generate-utils'

async function executeToolCalls(
  toolCalls: ChatCompletionTool[],
  tools: Tool[],
  signal?: AbortSignal,
  runner?: HookRunner,
  hooks?: GenerateTextParams<any>['hooks'],
  modelConfig?: ResolvedModelOptions,
): Promise<Array<{ tool_call_id: string, content: string, usage?: Usage }>> {
  return Promise.all(
    toolCalls.map(async (toolCall) => {
      const name = toolCall.function?.name
      const tool = tools.find(t => t.name === name)
      const result = tool
        ? await tool.execute(toolCall.function.arguments, signal, runner, hooks, modelConfig)
        : JSON.stringify({ success: false, error: `Tool execution error: Tool "${name}" not found` })

      // Extract usage from tool result JSON
      let usage: Usage | undefined
      try {
        const parsed = JSON.parse(result)
        if (parsed.usage) {
          usage = parsed.usage
        }
      }
      catch {
        // result is not JSON, no usage to extract
      }

      return { tool_call_id: toolCall.id, content: result, usage }
    }),
  )
}

export async function* agentLoop<T extends z.ZodTypeAny>(
  params: GenerateTextParams<T>,
  stepInvoker: StepInvoker,
): AsyncGenerator<StreamEvent, GenerateTextResult<unknown>> {
  const { model, tools, system, messages, fewShot, maxSteps = AGENT_LOOP_MAX_STEPS, prompt, output, hooks, signal, compact } = params
  const currentMessages: ChatMessage[] = buildMessage(prompt, system, messages, fewShot)
  const currentTools: Tool[] = tools ? [...tools] : []
  const totalUsage: Usage = emptyUsage()
  const runner = new HookRunner()
  const stepRef: StepRef = { value: 0 }
  const compactMessage = compact
    ? createCompactMessage(typeof compact === 'object' ? compact : undefined)
    : null

  let currentModel = model
  let lastPromptTokens = 0

  while (stepRef.value < maxSteps) {
    stepRef.value++
    yield { type: 'step', step: stepRef.value }

    if (compactMessage && compactMessage.shouldCompact(lastPromptTokens)) {
      runner.runBeforeMessageCompact(hooks, {
        promptTokens: lastPromptTokens,
        messages: [...currentMessages],
        threshold: compactMessage.threshold,
      })

      if (runner.stopped) {
        return { text: lastAssistantMsg(currentMessages), output: undefined, usage: totalUsage }
      }

      if (runner.skipped) {
        runner.resetSkip()
      }
      else {
        const messagesBefore = [...currentMessages]
        const compacted = await compactMessage.compact(currentMessages, signal)
        currentMessages.length = 0
        currentMessages.push(...compacted)
        runner.runAfterMessageCompact(hooks, {
          messagesBefore,
          messagesAfter: [...currentMessages],
          promptTokens: lastPromptTokens,
          threshold: compactMessage.threshold,
        })
        if (runner.stopped) {
          return { text: lastAssistantMsg(currentMessages), output: undefined, usage: totalUsage }
        }
      }
    }

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
      lastPromptTokens = stepResult.usage.prompt_tokens

      currentMessages.push(stepResult.assistantMessage)

      if (stepResult.toolCalls.length > 0 && currentTools.length > 0) {
        const toolResults = await executeToolCalls(stepResult.toolCalls, currentTools, signal, runner, hooks, currentModel.config)
        for (const { tool_call_id, content, usage } of toolResults) {
          currentMessages.push({ role: 'tool', content, tool_call_id })
          // Merge tool execution usage (e.g. web search API calls) into total
          if (usage) {
            mergeUsage(totalUsage, usage)
          }
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
