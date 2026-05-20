import type z from 'zod'
import type { AgentOptions } from './types'
import type { GenerateStreamParams, GenerateTextParams, GenerateTextResult } from '@/generate/types'
import { generateStream } from '@/generate/generate-stream'
import { generateText } from '@/generate/generate-text'

type OutputSchema<T> = T extends { output: { schema: infer S extends z.ZodTypeAny } } ? z.infer<S> : undefined

type AgentGenerateFn<T extends AgentOptions<z.ZodTypeAny>>
  = (params: Pick<GenerateTextParams<z.ZodTypeAny>, 'messages' | 'prompt'>) => Promise<GenerateTextResult<OutputSchema<T>>>

type AgentStreamFn<_T extends AgentOptions<z.ZodTypeAny>>
  = (params: Pick<GenerateStreamParams<z.ZodTypeAny>, 'messages' | 'prompt'>) => AsyncGenerator<import('@/generate/types').StreamEvent>

export function createAgent<T extends AgentOptions<z.ZodTypeAny>>(config: T): {
  generate: AgentGenerateFn<T>
  stream: AgentStreamFn<T>
}
export function createAgent<T extends AgentOptions<z.ZodTypeAny>>(config: T) {
  return {
    generate: (params: Pick<GenerateTextParams<z.ZodTypeAny>, 'messages' | 'prompt'>) => generateText({ ...config, ...params }),
    stream: (params: Pick<GenerateStreamParams<z.ZodTypeAny>, 'messages' | 'prompt'>) => generateStream({ ...config, ...params }),
  }
}
