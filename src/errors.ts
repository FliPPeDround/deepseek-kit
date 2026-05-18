export type AgentErrorType
  = | 'rate_limit'
    | 'model_error'
    | 'timeout'
    | 'tool_error'
    | 'max_steps'
    | 'network_error'
    | 'schema_error'

export class AgentError extends Error {
  public readonly type: AgentErrorType
  public readonly step?: number
  public readonly retryable: boolean
  public readonly cause?: Error

  constructor(options: {
    message: string
    type: AgentErrorType
    step?: number
    retryable?: boolean
    cause?: Error
  }) {
    super(options.message)
    this.name = 'AgentError'
    this.type = options.type
    this.step = options.step
    this.retryable = options.retryable ?? isRetryableErrorType(options.type)
    this.cause = options.cause
  }
}

function isRetryableErrorType(type: AgentErrorType): boolean {
  return ['rate_limit', 'timeout', 'network_error', 'model_error'].includes(type)
}

export function classifyError(error: unknown, step?: number): AgentError {
  if (error instanceof AgentError) {
    return error
  }

  if (error instanceof Error) {
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      return new AgentError({
        message: error.message,
        type: 'timeout',
        step,
        cause: error,
      })
    }

    if (error.cause instanceof Error) {
      const causeError = error.cause
      if (causeError.name === 'TypeError' && causeError.message.includes('fetch')) {
        return new AgentError({
          message: error.message,
          type: 'network_error',
          step,
          cause: error,
        })
      }
    }

    return new AgentError({
      message: error.message,
      type: 'model_error',
      step,
      cause: error,
    })
  }

  return new AgentError({
    message: String(error),
    type: 'model_error',
    step,
    retryable: true,
  })
}
