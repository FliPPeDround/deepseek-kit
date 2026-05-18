import { ApiRequestError } from '@/client/errors'
import { apiStreamRequest } from '@/client/stream-request'
import { createTextChunks, MOCK_API_KEY, mockFetchError, mockFetchStream } from '../helpers'

describe('apiStreamRequest', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sends POST request with stream: true', async () => {
    const chunks = createTextChunks('Hello')
    mockFetchStream(chunks)

    const gen = apiStreamRequest('https://api.deepseek.com/chat/completions', MOCK_API_KEY, {
      model: 'deepseek-v4-pro',
      messages: [{ role: 'user', content: 'Hi' }],
    })

    for await (const _ of gen) {
      // consume
    }

    expect(fetch).toHaveBeenCalledWith(
      'https://api.deepseek.com/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'Authorization': `Bearer ${MOCK_API_KEY}`,
        }),
        body: expect.stringContaining('"stream":true'),
      }),
    )
  })

  it('yields parsed chunks from SSE stream', async () => {
    const chunks = createTextChunks('Hi')
    mockFetchStream(chunks)

    const gen = apiStreamRequest('https://api.deepseek.com/chat/completions', MOCK_API_KEY, {
      model: 'deepseek-v4-pro',
      messages: [{ role: 'user', content: 'Hi' }],
    })

    const received: string[] = []
    for await (const chunk of gen) {
      if (chunk.choices[0]?.delta?.content) {
        received.push(chunk.choices[0].delta.content)
      }
    }

    expect(received).toEqual(['H', 'i'])
  })

  it('throws ApiRequestError on non-ok response', async () => {
    mockFetchError(429, 'Rate limit exceeded')

    const gen = apiStreamRequest('https://api.deepseek.com/chat/completions', MOCK_API_KEY, {
      model: 'deepseek-v4-pro',
      messages: [{ role: 'user', content: 'Hi' }],
    })

    await expect(async () => {
      for await (const _ of gen) {
        // consume
      }
    }).rejects.toThrow(ApiRequestError)
  })

  it('handles empty body gracefully', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: null,
    }))

    const gen = apiStreamRequest('https://api.deepseek.com/chat/completions', MOCK_API_KEY, {
      model: 'deepseek-v4-pro',
      messages: [{ role: 'user', content: 'Hi' }],
    })

    await expect(async () => {
      for await (const _ of gen) {
        // consume
      }
    }).rejects.toThrow('response body is null')
  })
})
