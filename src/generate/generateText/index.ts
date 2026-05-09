import type { GenerateTextParams } from '../types'
import type { ChatCompletionChoice, ChatMessage } from '@/model/types'
import { AGENT_LOOP_MAX_STEPS } from '@/constants'
import { generateStructuredOutput } from '../generate-structured-output'

function needCallTool(choices: ChatCompletionChoice) {
  if (choices.finish_reason === 'tool_calls') {
    return true
  }
  if (choices?.message?.tool_calls?.length > 0) {
    return true
  }
  return false
}

export async function generateText(params: GenerateTextParams) {
  const { model, tools, messages, maxSteps = AGENT_LOOP_MAX_STEPS, onStep, responseFormat } = params

  const currentMessages = messages
  let step = 0
  while (step < maxSteps) {
    step++

    const response = await model.invoke({
      messages: currentMessages,
      tools,
    })

    const choice = response.choices[0]
    const message = choice.message
    currentMessages.push(message as unknown as ChatMessage)
    if (needCallTool(choice) && tools) {
      for (const toolCall of message.tool_calls) {
        const name = toolCall.function?.name
        const tool = tools.find(tool => tool.name === name)
        if (tool) {
          const args = toolCall.function.arguments
          const result = await tool.execute(args)
          currentMessages.push({
            role: 'tool',
            content: result,
            tool_call_id: toolCall.id,
          })
        }
      }

      onStep?.({ step, toolCalls: message.tool_calls })
      continue
    }

    onStep?.({ step, text: message.content || '' })

    if (responseFormat) {
      const structuredData = await generateStructuredOutput({
        model,
        conversationMessages: currentMessages,
        schema: responseFormat.schema,
      })
      return JSON.stringify(structuredData)
    }

    return message.content
  }

  throw new Error(`Max steps (${maxSteps}) reached without getting a final response`)
}
