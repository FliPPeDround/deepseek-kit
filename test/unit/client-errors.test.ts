import { ApiRequestError, handleErrorResponse } from '@/client/errors'

describe('apiRequestError', () => {
  it.each([
    { status: 429, expected: true, desc: '429 Too Many Requests' },
    { status: 500, expected: true, desc: '500 Internal Server Error' },
    { status: 502, expected: true, desc: '502 Bad Gateway' },
    { status: 503, expected: true, desc: '503 Service Unavailable' },
    { status: 400, expected: false, desc: '400 Bad Request' },
    { status: 401, expected: false, desc: '401 Unauthorized' },
    { status: 403, expected: false, desc: '403 Forbidden' },
    { status: 404, expected: false, desc: '404 Not Found' },
  ])('retryable=$expected for $desc', ({ status, expected }) => {
    const error = new ApiRequestError({ status, message: 'test' })
    expect(error.retryable).toBe(expected)
  })

  it('stores status and message correctly', () => {
    const error = new ApiRequestError({ status: 429, message: 'Rate limit exceeded', retryAfter: 30 })
    expect(error.status).toBe(429)
    expect(error.message).toBe('DeepSeek API error 429: Rate limit exceeded')
    expect(error.retryAfter).toBe(30)
    expect(error.name).toBe('ApiRequestError')
  })
})

describe('handleErrorResponse', () => {
  it('extracts error message from JSON body', async () => {
    const response = new Response(
      JSON.stringify({ error: { message: 'Invalid API key' } }),
      { status: 401, statusText: 'Unauthorized' },
    )
    const result = await handleErrorResponse(response)
    expect(result.status).toBe(401)
    expect(result.message).toBe('Invalid API key')
  })

  it('falls back to statusText when JSON body has no error message', async () => {
    const response = new Response(
      JSON.stringify({}),
      { status: 500, statusText: 'Internal Server Error' },
    )
    const result = await handleErrorResponse(response)
    expect(result.status).toBe(500)
    expect(result.message).toBe('Internal Server Error')
  })

  it('falls back to statusText when body is not valid JSON', async () => {
    const response = new Response('not json', { status: 502, statusText: 'Bad Gateway' })
    const result = await handleErrorResponse(response)
    expect(result.status).toBe(502)
    expect(result.message).toBe('Bad Gateway')
  })

  it('extracts Retry-After header', async () => {
    const response = new Response(
      JSON.stringify({ error: { message: 'Rate limited' } }),
      { status: 429, headers: { 'Retry-After': '60' } },
    )
    const result = await handleErrorResponse(response)
    expect(result.retryAfter).toBe(60)
  })

  it('returns undefined retryAfter when header is absent', async () => {
    const response = new Response(
      JSON.stringify({ error: { message: 'Error' } }),
      { status: 500 },
    )
    const result = await handleErrorResponse(response)
    expect(result.retryAfter).toBeUndefined()
  })
})
