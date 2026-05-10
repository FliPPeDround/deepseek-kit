import type { ChatCompletion, ChatCompletionChunk, InvokeParams, ModelOptions } from './types'
import type { Tool } from '@/tool'
import { getChatEndpoint } from '@/client/endpoints'
import { apiRequest } from '@/client/request'
import { apiStreamRequest } from '@/client/stream-request'
import { buildToolParameters } from '@/tool'

function requiresBetaEndpoint(tools: Tool[]) {
  return tools.some(tool => tool.strict)
}

function buildRequestBody(config: ModelOptions, params: InvokeParams) {
  const { messages, response_format, tools = [] } = params
  const { toolParameters, toolChoice } = buildToolParameters(tools)

  return {
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
}

export async function invoke(config: ModelOptions, params: InvokeParams): Promise<ChatCompletion> {
  const body = buildRequestBody(config, params)
  const url = getChatEndpoint(requiresBetaEndpoint(params.tools ?? []) ? `${config.baseURL}/beta` : config.baseURL!)
  return await apiRequest<ChatCompletion>(url, config.apiKey!, body)
}

export async function* invokeStream(config: ModelOptions, params: InvokeParams): AsyncGenerator<ChatCompletionChunk> {
  const body = buildRequestBody(config, params)
  const url = getChatEndpoint(requiresBetaEndpoint(params.tools ?? []) ? `${config.baseURL}/beta` : config.baseURL!)
  yield* apiStreamRequest(url, config.apiKey!, body)
}
