import { AgentError, classifyError } from '@/errors'

describe('agentError', () => {
  it.each([
    { type: 'rate_limit' as const, expected: true },
    { type: 'timeout' as const, expected: true },
    { type: 'network_error' as const, expected: true },
    { type: 'model_error' as const, expected: true },
    { type: 'tool_error' as const, expected: false },
    { type: 'max_steps' as const, expected: false },
    { type: 'schema_error' as const, expected: false },
  ])('type=$type => retryable=$expected', ({ type, expected }) => {
    const error = new AgentError({ message: 'test', type })
    expect(error.retryable).toBe(expected)
  })

  it('allows overriding retryable', () => {
    const error = new AgentError({ message: 'test', type: 'model_error', retryable: false })
    expect(error.retryable).toBe(false)
  })

  it('stores step and cause', () => {
    const cause = new Error('original')
    const error = new AgentError({ message: 'test', type: 'tool_error', step: 3, cause })
    expect(error.step).toBe(3)
    expect(error.cause).toBe(cause)
    expect(error.name).toBe('AgentError')
  })
})

describe('classifyError', () => {
  it('returns existing AgentError as-is', () => {
    const original = new AgentError({ message: 'test', type: 'rate_limit' })
    const result = classifyError(original)
    expect(result).toBe(original)
  })

  it.each([
    ['AbortError', 'timeout'],
    ['TimeoutError', 'timeout'],
  ])('classifies %s as timeout', (errorName, expectedType) => {
    const error = new Error('aborted')
    error.name = errorName
    const result = classifyError(error)
    expect(result.type).toBe(expectedType)
  })

  it('classifies fetch TypeError as network_error', () => {
    const cause = new TypeError('fetch failed')
    const error = new Error('request failed', { cause })
    const result = classifyError(error)
    expect(result.type).toBe('network_error')
  })

  it('classifies generic Error as model_error', () => {
    const error = new Error('something went wrong')
    const result = classifyError(error, 5)
    expect(result.type).toBe('model_error')
    expect(result.step).toBe(5)
  })

  it('classifies non-Error as model_error with retryable=true', () => {
    const result = classifyError('string error')
    expect(result.type).toBe('model_error')
    expect(result.retryable).toBe(true)
  })
})
