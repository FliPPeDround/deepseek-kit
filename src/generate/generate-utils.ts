import type { GenerateTextHooks, HookContext, StepEvent } from './types'
import type { DeepSeekModel } from '@/model'
import type { ChatCompletionChoice, ChatMessage, Usage } from '@/model/types'
import type { Tool } from '@/tool'
import { AgentError } from '@/errors'

export class StopLoop extends Error {
  constructor() {
    super('StopLoop')
    this.name = 'StopLoop'
  }
}

export function lastAssistantMsg(messages: ChatMessage[]) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant') {
      return messages[i].content || ''
    }
  }
  return ''
}

export function mergeUsage(target: Usage, source: Usage): void {
  target.completion_tokens += source.completion_tokens
  target.prompt_tokens += source.prompt_tokens
  target.prompt_cache_hit_tokens += source.prompt_cache_hit_tokens
  target.prompt_cache_miss_tokens += source.prompt_cache_miss_tokens
  target.total_tokens += source.total_tokens
  target.completion_tokens_details.reasoning_tokens += source.completion_tokens_details?.reasoning_tokens ?? 0
}

export function buildMessage(prompt?: string, system?: string, messages?: ChatMessage[]): ChatMessage[] {
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

export function needsToolCall(choice: ChatCompletionChoice) {
  if (choice.finish_reason === 'tool_calls') {
    return true
  }
  if (choice.message?.tool_calls?.length > 0) {
    return true
  }
  return false
}

export function emptyUsage(): Usage {
  return {
    completion_tokens: 0,
    prompt_tokens: 0,
    prompt_cache_hit_tokens: 0,
    prompt_cache_miss_tokens: 0,
    total_tokens: 0,
    completion_tokens_details: { reasoning_tokens: 0 },
  }
}

export class HookRunner {
  private shouldStop = false
  private parentHookCtx?: HookContext
  public readonly hookCtx: HookContext

  constructor(parentHookCtx?: HookContext) {
    this.parentHookCtx = parentHookCtx
    this.hookCtx = {
      stop: () => {
        this.shouldStop = true
        this.parentHookCtx?.stop()
      },
    }
  }

  get stopped() {
    return this.shouldStop
  }

  runBeforeStep(
    hooks: GenerateTextHooks | undefined,
    step: number,
    currentMessages: ChatMessage[],
    currentTools: Tool[],
    model: DeepSeekModel,
  ): DeepSeekModel {
    if (!hooks?.beforeStep) {
      return model
    }
    const hookResult = hooks.beforeStep({
      step,
      config: model.config,
      messages: [...currentMessages],
      tools: currentTools,
    }, this.hookCtx)
    if (hookResult?.messages) {
      currentMessages.length = 0
      currentMessages.push(...hookResult.messages)
    }
    if (hookResult?.tools !== undefined) {
      currentTools.length = 0
      currentTools.push(...hookResult.tools)
    }
    if (hookResult?.config) {
      return model.withConfig(hookResult.config)
    }
    return model
  }

  runAfterStep(hooks: GenerateTextHooks | undefined, stepEvent: StepEvent): void {
    hooks?.afterStep?.(stepEvent, this.hookCtx)
  }

  async runOnError(hooks: GenerateTextHooks | undefined, error: AgentError): Promise<AgentError | undefined> {
    if (!hooks?.onError) {
      return error
    }
    const result = await hooks.onError(error, this.hookCtx)
    if (result instanceof AgentError) {
      return result
    }
    return undefined
  }
}
