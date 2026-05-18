export interface ApiError {
  status: number
  message: string
  retryAfter?: number
}

export async function handleErrorResponse(response: Response): Promise<ApiError> {
  const status = response.status
  let message = response.statusText
  const retryAfter = response.headers.get('Retry-After')

  try {
    const body = await response.clone().json() as { error?: { message?: string } }
    message = body?.error?.message || message
  }
  catch {
  }

  return {
    status,
    message,
    retryAfter: retryAfter ? Number.parseInt(retryAfter, 10) : undefined,
  }
}

export class ApiRequestError extends Error {
  public readonly status: number
  public readonly retryable: boolean
  public readonly retryAfter?: number

  constructor(error: ApiError) {
    super(`DeepSeek API error ${error.status}: ${error.message}`)
    this.name = 'ApiRequestError'
    this.status = error.status
    this.retryAfter = error.retryAfter
    this.retryable = isRetryableStatus(error.status)
  }
}

function isRetryableStatus(status: number): boolean {
  return [429, 500, 502, 503].includes(status)
}
