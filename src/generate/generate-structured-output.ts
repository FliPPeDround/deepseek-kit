import type { GenerateTextHooks, HookContext, StepEvent, StepRef } from './types'
import type { DeepSeekModel } from '@/model'
import type { ChatMessage } from '@/model/types'
import type { Tool } from '@/tool'
import { z } from 'zod'
import { AgentError, classifyError } from '@/errors'
import { HookRunner, StopLoop } from './generate-utils'
import { formatZodErrors } from './zod-error-formatter'

export interface StructuredOutputParams<T extends z.ZodTypeAny> {
  model: DeepSeekModel
  conversationMessages: ChatMessage[]
  schema: T
  stepRef: StepRef
  maxRetries?: number
  hooks?: GenerateTextHooks
  tools?: Tool[]
  hookCtx?: HookContext
  signal?: AbortSignal
}

function buildOutputFormatPrompt(schema: z.ZodTypeAny) {
  const stringSchema = JSON.stringify(z.toJSONSchema(schema), null, 2)
  return `
You must output a JSON object that conforms to the following JSON Schema, based on the conversation above. Output only JSON, no explanations.
JSON Schema:
\`\`\`
${stringSchema}
\`\`\``
}

export async function generateStructuredOutput<T extends z.ZodTypeAny>(
  params: StructuredOutputParams<T>,
): Promise<z.infer<T>> {
  const {
    model,
    conversationMessages,
    schema,
    stepRef,
    maxRetries = 3,
    hooks,
    tools,
    hookCtx,
    signal,
  } = params

  const runner = new HookRunner(hookCtx)

  const initialFormatPrompt = buildOutputFormatPrompt(schema)

  const currentMessages: ChatMessage[] = [
    ...conversationMessages,
    { role: 'user', content: initialFormatPrompt },
  ]
  const currentTools: Tool[] = tools ? [...tools] : []

  let lastResponseText = ''

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    stepRef.value++
    const currentStep = stepRef.value
    try {
      runner.runBeforeStep(hooks, currentStep, currentMessages, currentTools, model)
      if (runner.stopped) {
        throw new StopLoop()
      }

      const response = await model.invoke({
        messages: currentMessages,
        response_format: { type: 'json_object' },
        tools: currentTools,
        signal,
      })

      const choice = response.choices[0]
      const message = choice.message
      lastResponseText = message.content || ''

      const stepEvent: StepEvent = {
        step: currentStep,
        type: 'format',
        usage: response.usage,
        text: lastResponseText,
        reasoningContent: message.reasoning_content ?? undefined,
      }
      runner.runAfterStep(hooks, stepEvent)
      if (runner.stopped) {
        throw new StopLoop()
      }
      let parsed: unknown
      try {
        parsed = JSON.parse(lastResponseText)
      }
      catch {
        currentMessages.push({
          role: 'assistant',
          content: lastResponseText,
        })
        currentMessages.push({
          role: 'user',
          content: 'Your previous output is not valid JSON. Please output only a valid JSON object without any extra text or formatting.',
        })
        continue
      }

      const result = schema.safeParse(parsed)

      if (result.success) {
        return result.data as z.infer<T>
      }

      const errorFeedback = formatZodErrors(result.error)

      currentMessages.push({
        role: 'assistant',
        content: lastResponseText,
      })
      currentMessages.push({
        role: 'user',
        content: errorFeedback,
      })
    }
    catch (error) {
      if (error instanceof StopLoop) {
        throw error
      }
      const agentError = classifyError(error, currentStep)
      const result = await runner.runOnError(hooks, agentError)
      if (runner.stopped) {
        throw new StopLoop()
      }
      if (result) {
        throw result
      }
    }
  }

  const schemaError = new AgentError({
    message: `Structured output still does not match schema after ${maxRetries} retries. Last output: ${lastResponseText.substring(0, 200)}`,
    type: 'schema_error',
    step: stepRef.value,
    retryable: false,
  })

  const result = await runner.runOnError(hooks, schemaError)
  if (runner.stopped) {
    throw new StopLoop()
  }
  if (result) {
    throw result
  }
  throw schemaError
}
