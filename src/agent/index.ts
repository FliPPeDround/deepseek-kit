import type z from 'zod'
import type { AgentOptions } from './types'
import type { GenerateStreamParams, GenerateTextParams } from '@/generate/types'
import { generateStream } from '@/generate/generate-stream'
import { generateText } from '@/generate/generate-text'

export function createAgent<T extends z.ZodTypeAny>(config: AgentOptions<T>) {
  return {
    generate: (params: Pick<GenerateTextParams<T>, 'messages'>) => generateText({ ...config, ...params }),
    stream: (params: Pick<GenerateStreamParams<T>, 'messages'>) => generateStream({ ...config, ...params }),
  }
}
