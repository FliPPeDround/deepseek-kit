import { ApiRequestError } from './errors'

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number,
): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    }
    catch (error) {
      lastError = error
      if (attempt < maxRetries && error instanceof ApiRequestError && error.retryable) {
        const retryAfter = error.retryAfter
        const baseDelay = 1000 * 2 ** attempt
        const jitter = baseDelay * 0.3 * Math.random()
        const delay = retryAfter
          ? retryAfter * 1000
          : baseDelay + jitter
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }
      throw error
    }
  }
  throw lastError
}
