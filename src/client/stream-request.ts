import type { ChatCompletionChunk } from '@/model/types'
import { ApiRequestError, handleErrorResponse } from './errors'

export async function* apiStreamRequest(
  url: string,
  apiKey: string,
  options: Record<string, any>,
  timeout?: number,
  signal?: AbortSignal,
): AsyncGenerator<ChatCompletionChunk> {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'text/event-stream',
    'Authorization': `Bearer ${apiKey}`,
  }

  const timeoutSignal = timeout ? AbortSignal.timeout(timeout) : undefined
  const combinedSignal = signal && timeoutSignal
    ? AbortSignal.any([signal, timeoutSignal])
    : (signal || timeoutSignal)

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...options, stream: true }),
    signal: combinedSignal,
  })

  if (!response.ok) {
    throw new ApiRequestError(await handleErrorResponse(response))
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
