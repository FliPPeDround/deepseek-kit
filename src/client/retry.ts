const RETRYABLE_STATUS_CODES = new Set([429, 500, 503])

export function isRetryableError(error: unknown): boolean {
  if (error instanceof Error && error.message.startsWith('DeepSeek API error ')) {
    const match = error.message.match(/DeepSeek API error (\d+)/)
    if (match) {
      return RETRYABLE_STATUS_CODES.has(Number(match[1]))
    }
  }
  return false
}

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
      if (attempt < maxRetries && isRetryableError(error)) {
        const delay = Math.min(1000 * 2 ** attempt, 30000)
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }
      throw error
    }
  }
  throw lastError
}
