import type z from 'zod'
import type { GenerateTextParams } from '@/generate/types'

export type AgentOptions<T extends z.ZodTypeAny> = Omit<GenerateTextParams<T>, 'messages'>
