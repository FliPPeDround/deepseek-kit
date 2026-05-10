import type { z } from 'zod'
import type { ChatMessage, DeepSeekModel } from '@/model/types'
import type { Tool } from '@/tool'
import type { ChatCompletionTool } from '@/tool/types'

export interface StepEvent {
  step: number
  type: 'tool' | 'text' | 'format'
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
  onStep?: (step: StepEvent) => void
  output?: {
    schema: T
  }
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
