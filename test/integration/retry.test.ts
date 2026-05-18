import { ApiRequestError } from '@/client/errors'
import { withRetry } from '@/client/retry'

describe('withRetry', () => {
  it('returns result on first successful attempt', async () => {
    const result = await withRetry(() => Promise.resolve('success'), 3)
    expect(result).toBe('success')
  })

  it('retries on retryable errors and eventually succeeds', async () => {
    let attempt = 0
    const result = await withRetry(async () => {
      attempt++
      if (attempt < 3) {
        throw new ApiRequestError({ status: 429, message: 'Rate limited', retryAfter: 0 })
      }
      return 'success'
    }, 3)

    expect(result).toBe('success')
    expect(attempt).toBe(3)
  })

  it('throws immediately on non-retryable errors', async () => {
    let attempt = 0
    await expect(
      withRetry(async () => {
        attempt++
        throw new ApiRequestError({ status: 400, message: 'Bad request' })
      }, 3),
    ).rejects.toThrow('Bad request')

    expect(attempt).toBe(1)
  })

  it('throws after exhausting all retries', async () => {
    let attempt = 0
    await expect(
      withRetry(async () => {
        attempt++
        throw new ApiRequestError({ status: 503, message: 'Service unavailable' })
      }, 2),
    ).rejects.toThrow('Service unavailable')

    expect(attempt).toBe(3)
  })

  it('does not retry non-ApiRequestError', async () => {
    let attempt = 0
    await expect(
      withRetry(async () => {
        attempt++
        throw new Error('generic error')
      }, 3),
    ).rejects.toThrow('generic error')

    expect(attempt).toBe(1)
  })

  it('respects Retry-After header', async () => {
    let attempt = 0

    await withRetry(async () => {
      attempt++
      if (attempt === 1) {
        throw new ApiRequestError({ status: 429, message: 'Rate limited', retryAfter: 0 })
      }
      return 'success'
    }, 1)

    expect(attempt).toBe(2)
  })

  it('zero retries means single attempt', async () => {
    let attempt = 0
    await expect(
      withRetry(async () => {
        attempt++
        throw new ApiRequestError({ status: 500, message: 'Server error' })
      }, 0),
    ).rejects.toThrow('Server error')

    expect(attempt).toBe(1)
  })
})
