import type { z } from 'zod'
import type { ChatMessage, DeepSeekModel } from '@/model/types'
import type { Tool } from '@/tool'
import type { ChatCompletionTool } from '@/tool/types'

export interface StepEvent {
  step: number
  toolCalls?: ChatCompletionTool[]
  text?: string
}

export interface GenerateTextParams {
  model: DeepSeekModel
  tools?: Tool[]
  system?: string
  messages: ChatMessage[]
  maxSteps?: number
  onStep?: (step: StepEvent) => void
  responseFormat?: {
    schema: z.ZodType
  }
}
