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
