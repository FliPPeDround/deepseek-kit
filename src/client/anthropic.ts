import type { Usage } from '@/model/types'

const ANTHROPIC_BASE_URL = 'https://api.deepseek.com/anthropic'

export interface AnthropicContentBlock {
  type: string
  text?: string
  content?: Array<Record<string, unknown>>
}

/** Raw usage returned by the Anthropic API (field names differ from DeepSeek format) */
interface AnthropicRawUsage {
  input_tokens?: number
  output_tokens?: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
}

interface AnthropicRawResponse {
  content?: AnthropicContentBlock[]
  usage?: AnthropicRawUsage
}

export interface AnthropicResponse {
  content?: AnthropicContentBlock[]
  usage?: Usage
}

/** Convert Anthropic-style usage to DeepSeek-style Usage */
function convertUsage(raw: AnthropicRawUsage): Usage {
  const prompt_tokens = raw.input_tokens ?? 0
  const completion_tokens = raw.output_tokens ?? 0
  return {
    completion_tokens,
    prompt_tokens,
    prompt_cache_hit_tokens: raw.cache_read_input_tokens ?? 0,
    prompt_cache_miss_tokens: raw.cache_creation_input_tokens ?? 0,
    total_tokens: prompt_tokens + completion_tokens,
    completion_tokens_details: { reasoning_tokens: 0 },
  }
}

export async function anthropicRequest(
  body: Record<string, unknown>,
  apiKey: string,
  signal?: AbortSignal,
): Promise<AnthropicResponse> {
  if (!apiKey) {
    throw new Error('API key is required for Anthropic API requests')
  }

  let response: Response
  try {
    response = await fetch(`${ANTHROPIC_BASE_URL}/v1/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
      signal,
    })
  }
  catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new DOMException('Search was cancelled.', 'AbortError')
    }
    throw new Error(`Network error: ${error instanceof Error ? error.message : String(error)}`)
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => 'Unknown error')
    throw new Error(`DeepSeek Anthropic API error (${response.status}): ${errText}`)
  }

  try {
    const raw = await response.json() as AnthropicRawResponse
    return {
      content: raw.content,
      usage: raw.usage ? convertUsage(raw.usage) : undefined,
    }
  }
  catch {
    throw new Error(`Failed to parse API response as JSON (status ${response.status})`)
  }
}
