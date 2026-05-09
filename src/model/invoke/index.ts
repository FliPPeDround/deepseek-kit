import type { ChatCompletion, InvokeParams, ModelOptions } from '../types'
import type { Tool } from '@/tool'
import { chatEndpoint } from '@/client/endpoints'
import { request } from '@/client/request'
import { buildToolsParams } from '@/tool'

function useBetaMode(tools: Tool[]) {
  return tools.some(tool => tool.strict)
}

export async function invoke(config: ModelOptions, params: InvokeParams): Promise<ChatCompletion> {
  const { messages, response_format, tools = [] } = params
  const { toolParams, toolChoice } = buildToolsParams(tools)

  const body = {
    messages,
    model: config.model,
    user_id: config.userId,
    thinking: config.thinking,
    reasoning_effort: config.reasoningEffort,
    max_tokens: config.maxTokens,
    temperature: config.temperature,
    top_p: config.topP,
    tools: toolParams,
    tool_choices: toolChoice,
    response_format,
  }

  const url = chatEndpoint(useBetaMode(tools) ? `${config.baseURL}/beta` : config.baseURL!)
  return await request<ChatCompletion>(url, config.apiKey!, body)
}
