import type { ChatCompletionChunk } from '@/model/types'

export async function* apiStreamRequest(
  url: string,
  apiKey: string,
  options: Record<string, any>,
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
  })
  if (!response.ok) {
    const { error } = (await response.json()) as { error: { message: string } }
    const errorMessage = error?.message || response.statusText
    throw new Error(`DeepSeek API error ${response.status}: ${errorMessage}`)
  }

  const reader = response.body!.getReader()
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

      try {
        yield JSON.parse(data) as ChatCompletionChunk
      }
      catch {
        continue
      }
    }
  }
}
