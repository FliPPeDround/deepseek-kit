import type { StepEvent } from './types'
import type { ChatMessage, DeepSeekModel } from '@/model/types'
import type { Tool } from '@/tool'
import { z } from 'zod'
import { formatZodErrors } from './zod-error-formatter'

export interface StructuredOutputParams<T extends z.ZodTypeAny> {
  model: DeepSeekModel
  conversationMessages: ChatMessage[]
  schema: T
  step?: number
  maxRetries?: number
  onStep?: (step: StepEvent) => void
  tools?: Tool[]
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
    maxRetries = 3,
    step = 0,
    onStep,
    tools,
  } = params

  const initialFormatPrompt = buildOutputFormatPrompt(schema)

  const currentMessages: ChatMessage[] = [
    ...conversationMessages,
    { role: 'user', content: initialFormatPrompt },
  ]

  let lastResponseText = ''

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await model.invoke({
      messages: currentMessages,
      response_format: { type: 'json_object' },
      tools,
    })

    const choice = response.choices[0]
    const message = choice.message
    lastResponseText = message.content || ''

    try {
      onStep?.({
        step: step + attempt,
        type: 'format',
        usage: response.usage,
        text: lastResponseText,
        reasoningContent: message.reasoning_content ?? undefined,
      })
      const parsed = JSON.parse(lastResponseText)
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
    catch {
      currentMessages.push({
        role: 'assistant',
        content: lastResponseText,
      })
      currentMessages.push({
        role: 'user',
        content: 'Your output is not valid JSON. Please output only a valid JSON object.',
      })
    }
  }

  throw new Error(
    `Structured output still does not match schema after ${maxRetries} retries. Last output: ${lastResponseText.substring(0, 200)}`,
  )
}
