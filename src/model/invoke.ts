import type { ChatCompletion, ChatCompletionChunk, InvokeParams, ModelOptions } from './types'
import { omitBy } from 'es-toolkit'
import { getChatEndpoint } from '@/client/endpoints'
import { apiRequest } from '@/client/request'
import { withRetry } from '@/client/retry'
import { apiStreamRequest } from '@/client/stream-request'
import { buildToolParameters, validateToolConsistency } from '@/tool'

function buildRequestBody(config: ModelOptions, params: InvokeParams) {
  const { messages, response_format, tools = [] } = params
  const { toolParameters, toolChoice } = buildToolParameters(tools, config.strict)

  const thinking = config.thinking
    ? omitBy({
        type: config.thinking.type,
        reasoning_effort: config.reasoningEffort,
      }, v => v === undefined)
    : undefined

  return omitBy({
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
  }, v => v === undefined)
}

export async function invoke(config: ModelOptions, params: InvokeParams): Promise<ChatCompletion> {
  const tools = params.tools ?? []
  if (!config.strict) {
    validateToolConsistency(tools)
  }
  const body = buildRequestBody(config, params)
  const url = getChatEndpoint(config.baseURL!)
  const maxRetries = config.maxRetries ?? 3
  const timeout = config.timeout ?? 60000
  return withRetry(
    () => apiRequest<ChatCompletion>(url, config.apiKey!, body, timeout, 'POST', params.signal),
    maxRetries,
  )
}

export async function* invokeStream(config: ModelOptions, params: InvokeParams): AsyncGenerator<ChatCompletionChunk> {
  const tools = params.tools ?? []
  if (!config.strict) {
    validateToolConsistency(tools)
  }
  const body = { ...buildRequestBody(config, params), stream_options: config.streamOptions }
  const url = getChatEndpoint(config.baseURL!)
  const timeout = config.timeout ?? 60000
  yield* apiStreamRequest(url, config.apiKey!, body, timeout, params.signal)
}
