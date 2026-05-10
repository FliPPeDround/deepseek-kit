import type z from 'zod'
import type { AgentOptions } from './types'
import type { GenerateTextParams } from '@/generate/types'
import { generateText } from '@/generate/generate-text'

export function createAgent<T extends z.ZodTypeAny>(config: AgentOptions<T>) {
  return {
    generateText: (params: Pick<GenerateTextParams<T>, 'messages'>) => generateText({ ...config, ...params }),
  }
}
