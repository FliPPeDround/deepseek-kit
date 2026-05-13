import type { ChatCompletionChunk } from '@/model/types'

export async function* apiStreamRequest(
  url: string,
  apiKey: string,
  options: Record<string, any>,
  timeout?: number,
): AsyncGenerator<ChatCompletionChunk> {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'text/event-stream',
    'Authorization': `Bearer ${apiKey}`,
  }
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...options, stream: true }),
    signal: timeout ? AbortSignal.timeout(timeout) : undefined,
  })
  if (!response.ok) {
    let errorMessage = response.statusText
    try {
      const body = await response.json() as { error?: { message?: string } }
      errorMessage = body?.error?.message || errorMessage
    }
    catch {
      // Response body is not JSON, use statusText
    }
    throw new Error(`DeepSeek API error ${response.status}: ${errorMessage}`)
  }

  if (!response.body) {
    throw new Error('DeepSeek API error: response body is null')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data:')) {
        continue
      }

      const data = trimmed.slice(5).trim()
      if (data === '[DONE]') {
        return
      }

      if (!data) {
        continue
      }

      try {
        yield JSON.parse(data) as ChatCompletionChunk
      }
      catch {
        continue
      }
    }
  }
}
