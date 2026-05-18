import type { ChatCompletion, ChatCompletionChunk, InvokeParams, ModelOptions } from './types'
import type { Tool } from '@/tool'
import { getChatEndpoint } from '@/client/endpoints'
import { apiRequest } from '@/client/request'
import { withRetry } from '@/client/retry'
import { apiStreamRequest } from '@/client/stream-request'
import { buildToolParameters } from '@/tool'
import { compact } from '@/utils'

function requiresBetaEndpoint(tools: Tool[]) {
  return tools.some(tool => tool.strict)
}

function buildBaseUrl(config: ModelOptions, needsBeta: boolean): string {
  const base = config.baseURL!
  if (!needsBeta)
    return base
  return base.endsWith('/') ? `${base}beta` : `${base}/beta`
}

function buildRequestBody(config: ModelOptions, params: InvokeParams) {
  const { messages, response_format, tools = [] } = params
  const { toolParameters, toolChoice } = buildToolParameters(tools)

  const thinking = config.thinking
    ? compact({
        type: config.thinking.type,
        reasoning_effort: config.reasoningEffort,
      })
    : undefined

  return compact({
    messages,
    model: config.model,
    user_id: config.userId,
    thinking,
    max_tokens: config.maxTokens,
    temperature: config.temperature,
    top_p: config.topP,
    stop: params.stop,
    logprobs: params.logprobs,
    top_logprobs: params.topLogprobs,
    tools: toolParameters,
    tool_choice: toolChoice,
    response_format,
  })
}

export async function invoke(config: ModelOptions, params: InvokeParams): Promise<ChatCompletion> {
  const body = buildRequestBody(config, params)
  const needsBeta = requiresBetaEndpoint(params.tools ?? [])
  const url = getChatEndpoint(buildBaseUrl(config, needsBeta))
  const maxRetries = config.maxRetries ?? 3
  const timeout = config.timeout ?? 60000
  return withRetry(
    () => apiRequest<ChatCompletion>(url, config.apiKey!, body, timeout, 'POST', params.signal),
    maxRetries,
  )
}

export async function* invokeStream(config: ModelOptions, params: InvokeParams): AsyncGenerator<ChatCompletionChunk> {
  const body = { ...buildRequestBody(config, params), stream_options: config.streamOptions }
  const needsBeta = requiresBetaEndpoint(params.tools ?? [])
  const url = getChatEndpoint(buildBaseUrl(config, needsBeta))
  const timeout = config.timeout ?? 60000
  yield* apiStreamRequest(url, config.apiKey!, body, timeout, params.signal)
}
