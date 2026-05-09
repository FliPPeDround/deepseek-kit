import type { ChatMessage, DeepSeekModel } from '@/model/types'
import { z } from 'zod'
import { formatZodErrors } from './error-formatter'

export interface StructuredOutputParams {
  model: DeepSeekModel
  conversationMessages: ChatMessage[]
  schema: z.ZodTypeAny
  maxRetries?: number
}

export async function generateStructuredOutput<T extends z.ZodTypeAny>(
  params: StructuredOutputParams,
): Promise<z.infer<T>> {
  const { model, conversationMessages, schema, maxRetries = 3 } = params

  const jsonSchema = z.toJSONSchema(schema)
  const initialFormatPrompt = `你必须基于以上对话历史，输出一个符合以下JSON Schema的JSON对象。只输出JSON，不要有任何解释。\n\nJSON Schema:\n\`\`\`\n${jsonSchema}\n\`\`\``

  const currentMessages = [
    ...conversationMessages,
    { role: 'user', content: initialFormatPrompt },
  ]

  let lastResponseText = ''

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // 2. 调用模型，强制 JSON 模式
    const response = await model.invoke({
      messages: currentMessages as ChatMessage[],
      response_format: { type: 'json_object' },
      tools: undefined,
    })

    lastResponseText = response.choices[0].message.content || ''

    try {
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
