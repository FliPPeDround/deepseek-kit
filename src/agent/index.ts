import type z from 'zod'
import type { AgentOptions } from './types'
import type { GenerateStreamParams, GenerateTextParams, GenerateTextResult } from '@/generate/types'
import { generateStream } from '@/generate/generate-stream'
import { generateText } from '@/generate/generate-text'

interface AgentOptionsWithOutput<T extends z.ZodTypeAny> extends AgentOptions<T> {
  output: { schema: T }
}

interface AgentOptionsWithoutOutput extends AgentOptions<z.ZodTypeAny> {
  output?: never
}

export function createAgent<T extends z.ZodTypeAny>(config: AgentOptionsWithOutput<T>): {
  generate: (params: Pick<GenerateTextParams<T>, 'messages'>) => Promise<GenerateTextResult<z.infer<T>>>
  stream: (params: Pick<GenerateStreamParams<T>, 'messages'>) => AsyncGenerator<import('@/generate/types').StreamEvent>
}
export function createAgent(config: AgentOptionsWithoutOutput): {
  generate: (params: Pick<GenerateTextParams<z.ZodTypeAny>, 'messages'>) => Promise<GenerateTextResult<undefined>>
  stream: (params: Pick<GenerateStreamParams<z.ZodTypeAny>, 'messages'>) => AsyncGenerator<import('@/generate/types').StreamEvent>
}
export function createAgent<T extends z.ZodTypeAny>(config: AgentOptions<T>) {
  return {
    generate: (params: Pick<GenerateTextParams<T>, 'messages'>) => generateText({ ...config, ...params } as any),
    stream: (params: Pick<GenerateStreamParams<T>, 'messages'>) => generateStream({ ...config, ...params } as any),
  }
}
