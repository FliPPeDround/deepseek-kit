import type { z } from 'zod'
import type { ChatMessage, DeepSeekModel, Usage } from '@/model/types'
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

export interface GenerateTextParams<T extends z.ZodTypeAny> {
  model: DeepSeekModel
  tools?: Tool[]
  system?: string
  messages: ChatMessage[]
  maxSteps?: number
  prompt?: string
  output?: {
    schema: T
  }
  onStep?: (step: StepEvent) => void
}

export interface GenerateTextResult {
  text: string
  usage: Usage
}

export interface GenerateOutputResult<T extends z.ZodTypeAny> {
  output: z.infer<T>
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

export interface GenerateStreamParams<T extends z.ZodTypeAny> {
  model: DeepSeekModel
  tools?: Tool[]
  system?: string
  messages: ChatMessage[]
  maxSteps?: number
  output?: {
    schema: T
  }
}
