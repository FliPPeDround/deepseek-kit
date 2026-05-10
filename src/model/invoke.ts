import type { ChatCompletion, InvokeParams, ModelOptions } from './types'
import type { Tool } from '@/tool'
import { getChatEndpoint } from '@/client/endpoints'
import { apiRequest } from '@/client/request'
import { buildToolParameters } from '@/tool'

function requiresBetaEndpoint(tools: Tool[]) {
  return tools.some(tool => tool.strict)
}

export async function invoke(config: ModelOptions, params: InvokeParams): Promise<ChatCompletion> {
  const { messages, response_format, tools = [] } = params
  const { toolParameters, toolChoice } = buildToolParameters(tools)

  const body = {
    messages,
    model: config.model,
    user_id: config.userId,
    thinking: config.thinking,
    reasoning_effort: config.reasoningEffort,
    max_tokens: config.maxTokens,
    temperature: config.temperature,
    top_p: config.topP,
    tools: toolParameters,
    tool_choice: toolChoice,
    response_format,
  }

  const url = getChatEndpoint(requiresBetaEndpoint(tools) ? `${config.baseURL}/beta` : config.baseURL!)
  return await apiRequest<ChatCompletion>(url, config.apiKey!, body)
}
