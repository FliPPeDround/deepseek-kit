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
    // 检查错误消息关键词
    const msg = error.message.toLowerCase()
    if (msg.includes('429') || msg.includes('rate limit') || msg.includes('too many requests')) {
      return new AgentError({
        message: error.message,
        type: 'rate_limit',
        step,
        cause: error,
      })
    }
    if (msg.includes('timeout') || msg.includes('abort') || msg.includes('timed out')) {
      return new AgentError({
        message: error.message,
        type: 'timeout',
        step,
        cause: error,
      })
    }
    if (msg.includes('fetch') || msg.includes('network') || msg.includes('connection')) {
      return new AgentError({
        message: error.message,
        type: 'network_error',
        step,
        cause: error,
      })
    }
    if (msg.includes('json') || msg.includes('schema')) {
      return new AgentError({
        message: error.message,
        type: 'schema_error',
        step,
        cause: error,
      })
    }
    // 其他情况默认归类为 model_error
    return new AgentError({
      message: error.message,
      type: 'model_error',
      step,
      cause: error,
    })
  }

  // 兜底：未知错误
  return new AgentError({
    message: String(error),
    type: 'model_error',
    step,
    retryable: true,
  })
}
