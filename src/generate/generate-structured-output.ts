import type { StepEvent } from './types'
import type { ChatMessage, DeepSeekModel } from '@/model/types'
import { z } from 'zod'
import { formatZodErrors } from './error-formatter'

export interface StructuredOutputParams<T extends z.ZodTypeAny> {
  model: DeepSeekModel
  conversationMessages: ChatMessage[]
  schema: T
  step?: number
  maxRetries?: number
  onStep?: (step: StepEvent) => void
}

function buildFormatOutputPrompt(schema: z.ZodTypeAny) {
  const stringSchema = JSON.stringify(z.toJSONSchema(schema), null, 2)
  return `
你必须基于以上对话历史，输出一个符合以下JSON Schema的JSON对象。只输出JSON，不要有任何解释。
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
  } = params

  const initialFormatPrompt = buildFormatOutputPrompt(schema)

  const currentMessages: ChatMessage[] = [
    ...conversationMessages,
    { role: 'user', content: initialFormatPrompt },
  ]

  let lastResponseText = ''

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // 2. 调用模型，强制 JSON 模式
    const response = await model.invoke({
      messages: currentMessages,
      response_format: { type: 'json_object' },
      tools: undefined,
    })

    const choice = response.choices[0]
    const message = choice.message
    lastResponseText = message.content || ''

    try {
      onStep?.({
        step: step + attempt,
        type: 'format',
        text: lastResponseText,
        reasoningContent: message.reasoning_content,
      })
      const parsed = JSON.parse(lastResponseText)
      const result = schema.safeParse(parsed)

      if (result.success) {
        // 校验成功，直接返回类型安全的数据
        return result.data as z.infer<T>
      }

      // 5. 校验失败，准备修正指令
      const errorFeedback = formatZodErrors(result.error)

      // 将失败的 assistant 回复和新的 user 修正指令加入历史
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
        content: '你输出的内容不是合法的JSON，请严格只输出一个JSON对象。',
      })
    }
  }

  throw new Error(
    `结构化输出在 ${maxRetries} 次修正后仍然不符合 Schema。最后一次输出: ${lastResponseText.substring(0, 200)}`,
  )
}
