import type { z } from 'zod'
import type { AgentError } from '@/errors'
import type { DeepSeekModel } from '@/model'
import type { ChatMessage, ModelOptions, Usage } from '@/model/types'
import type { Tool } from '@/tool'
import type { ChatCompletionTool } from '@/tool/types'

export interface StepEvent {
  step: number
  type: 'tool' | 'text' | 'format'
  usage: Usage
  toolCalls?: ChatCompletionTool[]
  text?: string
  reasoningContent?: string
}

export interface BeforeStepContext {
  step: number
  config: ModelOptions
  messages: ChatMessage[]
  tools: Tool[]
}

export interface BeforeStepResult {
  messages?: ChatMessage[]
  tools?: Tool[]
  config?: Partial<ModelOptions>
}

export interface HookContext {
  stop: () => void
}

export interface GenerateTextHooks {
  beforeStep?: (context: BeforeStepContext, hookCtx: HookContext) => BeforeStepResult | void
  afterStep?: (step: StepEvent, hookCtx: HookContext) => void
  onError?: (error: AgentError, hookCtx: HookContext) => void | AgentError | Promise<AgentError | void>
}

export interface GenerateTextParams<T extends z.ZodTypeAny> {
  model: DeepSeekModel
  tools?: Tool[]
  system?: string
  messages?: ChatMessage[]
  maxSteps?: number
  prompt?: string
  output?: {
    schema: T
  }
  hooks?: GenerateTextHooks
  signal?: AbortSignal
}

export interface GenerateTextResult<TOutput = undefined> {
  text: string
  output: TOutput
  usage: Usage
}

export interface TextDeltaStreamEvent {
  type: 'text-delta'
  textDelta: string
}

export interface ReasoningDeltaStreamEvent {
  type: 'reasoning-delta'
  reasoningDelta: string
}

export interface ToolCallStreamEvent {
  type: 'tool-call'
  step: number
  toolCalls: ChatCompletionTool[]
}

export interface StepStreamEvent {
  type: 'step'
  step: number
}

export interface FinishStreamEvent {
  type: 'finish'
  text?: string
  usage?: Usage
}

export type StreamEvent
  = | TextDeltaStreamEvent
    | ReasoningDeltaStreamEvent
    | ToolCallStreamEvent
    | StepStreamEvent
    | FinishStreamEvent

export interface StepResult {
  text: string
  toolCalls: ChatCompletionTool[]
  finishReason: string | null
  usage: Usage
  assistantMessage: ChatMessage
  reasoningContent?: string
}

export type StepInvoker = (
  model: DeepSeekModel,
  params: {
    messages: ChatMessage[]
    tools: Tool[]
    signal?: AbortSignal
  },
) => AsyncGenerator<StreamEvent, StepResult>

export interface StepRef {
  value: number
}

export type GenerateStreamParams<T extends z.ZodTypeAny> = GenerateTextParams<T>
