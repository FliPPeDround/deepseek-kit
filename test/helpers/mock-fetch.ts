import type { FIMResponse } from '@/fim/types'
import type { ChatCompletion, ChatCompletionChunk, ListModelsResponse, UserBalanceResponse } from '@/model/types'
import { createMockBalanceResponse, createMockChatCompletion, createMockFIMResponse, createMockListModelsResponse, MOCK_API_KEY } from './mock-data'

export function mockFetchSuccess(data: any, status = 200): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    status,
    json: () => Promise.resolve(data),
    headers: new Headers(),
  }))
}

export function mockFetchError(status: number, message: string, retryAfter?: string): void {
  const headers = new Headers()
  if (retryAfter) {
    headers.set('Retry-After', retryAfter)
  }
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: false,
    status,
    statusText: message,
    json: () => Promise.resolve({ error: { message } }),
    headers,
    clone() {
      return {
        json: () => Promise.resolve({ error: { message } }),
      } as any
    },
  }))
}

export function mockFetchStream(chunks: ChatCompletionChunk[]): void {
  const encoder = new TextEncoder()
  let chunkIndex = 0

  const stream = new ReadableStream({
    pull(controller) {
      if (chunkIndex < chunks.length) {
        const chunk = chunks[chunkIndex++]
        const data = `data: ${JSON.stringify(chunk)}\n\n`
        controller.enqueue(encoder.encode(data))
      }
      else {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      }
    },
  })

  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    body: stream,
    headers: new Headers(),
  }))
}

export function mockChatCompletion(overrides: Partial<ChatCompletion> = {}): void {
  mockFetchSuccess(createMockChatCompletion(overrides))
}

export function mockListModels(overrides: Partial<ListModelsResponse> = {}): void {
  mockFetchSuccess(createMockListModelsResponse(overrides))
}

export function mockBalance(overrides: Partial<UserBalanceResponse> = {}): void {
  mockFetchSuccess(createMockBalanceResponse(overrides))
}

export function mockFIM(overrides: Partial<FIMResponse> = {}): void {
  mockFetchSuccess(createMockFIMResponse(overrides))
}

export function createMockModelConfig() {
  return {
    apiKey: MOCK_API_KEY,
    baseURL: 'https://api.deepseek.com',
    model: 'deepseek-v4-pro' as const,
    thinking: { type: 'enabled' as const },
    reasoningEffort: 'high' as const,
    maxTokens: 4096,
    temperature: 1,
    topP: 1,
    streamOptions: { include_usage: true },
    timeout: 60000,
    maxRetries: 3,
    userId: 'test-user',
    strict: false,
  }
}

export function createSequentialFetchMock(responses: Array<{
  data: any
  ok?: boolean
  status?: number
  statusText?: string
  headers?: Record<string, string>
}>): void {
  let callIndex = 0
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
    const resp = responses[callIndex++]
    if (resp === undefined) {
      throw new Error(`Unexpected fetch call #${callIndex}`)
    }
    const ok = resp.ok ?? true
    const headers = new Headers(resp.headers)
    return Promise.resolve({
      ok,
      status: resp.status ?? (ok ? 200 : 500),
      statusText: resp.statusText ?? '',
      json: () => Promise.resolve(resp.data),
      headers,
      clone() {
        return {
          json: () => Promise.resolve(resp.data),
        } as any
      },
      body: null,
    })
  }))
}
