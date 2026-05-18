import type z from 'zod'
import type { GenerateTextParams, GenerateTextResult, StepInvoker, StepResult } from './types'
import type { ChatMessage } from '@/model/types'
import { agentLoop } from './generate-loop'

const textStepInvoker: StepInvoker = async function* (model, params) {
  const response = await model.invoke({
    messages: params.messages,
    tools: params.tools,
    signal: params.signal,
  })

  const choice = response.choices[0]
  if (!choice) {
    throw new Error('DeepSeek API returned empty choices')
  }

  const message = choice.message
  return {
    text: message.content || '',
    toolCalls: message.tool_calls ?? [],
    finishReason: choice.finish_reason,
    usage: response.usage,
    assistantMessage: message as unknown as ChatMessage,
    reasoningContent: message.reasoning_content ?? undefined,
  } as StepResult
}

interface GenerateTextParamsWithOutput<T extends z.ZodTypeAny> extends GenerateTextParams<T> {
  output: { schema: T }
}

interface GenerateTextParamsWithoutOutput extends GenerateTextParams<z.ZodTypeAny> {
  output?: never
}

export async function generateText<T extends z.ZodTypeAny>(
  params: GenerateTextParamsWithOutput<T>,
): Promise<GenerateTextResult<z.infer<T>>>
export async function generateText(
  params: GenerateTextParamsWithoutOutput,
): Promise<GenerateTextResult<undefined>>
export async function generateText<T extends z.ZodTypeAny>(params: GenerateTextParams<T>): Promise<GenerateTextResult<unknown>> {
  const gen = agentLoop(params, textStepInvoker)
  let iterResult = await gen.next()
  while (!iterResult.done) {
    iterResult = await gen.next()
  }
  return iterResult.value
}
