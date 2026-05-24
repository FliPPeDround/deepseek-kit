import type { Usage } from '@/model/types'
import { buildMessage, emptyUsage, HookRunner, mergeUsage, StopLoop } from '@/generate/generate-utils'
import { createMockUsage } from '../helpers'

describe('buildMessage', () => {
  it('throws when no arguments provided', () => {
    expect(() => buildMessage()).toThrow('prompt is required')
  })

  it('builds message from prompt only', () => {
    const result = buildMessage('Hello')
    expect(result).toEqual([{ role: 'user', content: 'Hello' }])
  })

  it('builds message from system and prompt', () => {
    const result = buildMessage('Hello', 'You are helpful')
    expect(result).toEqual([
      { role: 'system', content: 'You are helpful' },
      { role: 'user', content: 'Hello' },
    ])
  })

  it('builds message from existing messages and prompt', () => {
    const messages = [{ role: 'user' as const, content: 'Hi' }]
    const result = buildMessage('Follow up', undefined, messages)
    expect(result).toEqual([
      { role: 'user', content: 'Hi' },
      { role: 'user', content: 'Follow up' },
    ])
  })

  it('builds message from system, messages, and prompt in correct order', () => {
    const messages = [{ role: 'user' as const, content: 'Previous' }]
    const result = buildMessage('New', 'System', messages)
    expect(result).toEqual([
      { role: 'system', content: 'System' },
      { role: 'user', content: 'Previous' },
      { role: 'user', content: 'New' },
    ])
  })

  it('inserts fewShot messages after system and before messages', () => {
    const fewShot = [
      { role: 'user' as const, content: 'Example question' },
      { role: 'assistant' as const, content: 'Example answer' },
    ]
    const messages = [{ role: 'user' as const, content: 'Previous' }]
    const result = buildMessage('New', 'System', messages, fewShot)
    expect(result).toEqual([
      { role: 'system', content: 'System' },
      { role: 'user', content: 'Example question', name: 'few-shot' },
      { role: 'assistant', content: 'Example answer', name: 'few-shot' },
      { role: 'user', content: 'Previous' },
      { role: 'user', content: 'New' },
    ])
  })

  it('inserts fewShot messages after system when no messages', () => {
    const fewShot = [
      { role: 'user' as const, content: 'Q' },
      { role: 'assistant' as const, content: 'A' },
    ]
    const result = buildMessage('Hello', 'System', undefined, fewShot)
    expect(result).toEqual([
      { role: 'system', content: 'System' },
      { role: 'user', content: 'Q', name: 'few-shot' },
      { role: 'assistant', content: 'A', name: 'few-shot' },
      { role: 'user', content: 'Hello' },
    ])
  })

  it('inserts fewShot before prompt when no system or messages', () => {
    const fewShot = [
      { role: 'user' as const, content: 'Q' },
      { role: 'assistant' as const, content: 'A' },
    ]
    const result = buildMessage('Hello', undefined, undefined, fewShot)
    expect(result).toEqual([
      { role: 'user', content: 'Q', name: 'few-shot' },
      { role: 'assistant', content: 'A', name: 'few-shot' },
      { role: 'user', content: 'Hello' },
    ])
  })
})

describe('emptyUsage', () => {
  it('returns usage with all zeros', () => {
    const usage = emptyUsage()
    expect(usage.completion_tokens).toBe(0)
    expect(usage.prompt_tokens).toBe(0)
    expect(usage.prompt_cache_hit_tokens).toBe(0)
    expect(usage.prompt_cache_miss_tokens).toBe(0)
    expect(usage.total_tokens).toBe(0)
    expect(usage.completion_tokens_details.reasoning_tokens).toBe(0)
  })
})

describe('mergeUsage', () => {
  it('adds all fields from source to target', () => {
    const target = emptyUsage()
    const source = createMockUsage({ completion_tokens: 10, prompt_tokens: 20 })
    mergeUsage(target, source)
    expect(target.completion_tokens).toBe(10)
    expect(target.prompt_tokens).toBe(20)
  })

  it('accumulates values across multiple merges', () => {
    const target = emptyUsage()
    mergeUsage(target, createMockUsage({ completion_tokens: 5 }))
    mergeUsage(target, createMockUsage({ completion_tokens: 3 }))
    expect(target.completion_tokens).toBe(8)
  })

  it('handles missing completion_tokens_details gracefully', () => {
    const target = emptyUsage()
    const source: Usage = {
      ...createMockUsage(),
      completion_tokens_details: undefined as any,
    }
    mergeUsage(target, source)
    expect(target.completion_tokens_details.reasoning_tokens).toBe(0)
  })
})

describe('stopLoop', () => {
  it('is an Error with name StopLoop', () => {
    const error = new StopLoop()
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('StopLoop')
    expect(error.message).toBe('StopLoop')
  })
})

describe('hookRunner', () => {
  it('initially not stopped', () => {
    const runner = new HookRunner()
    expect(runner.stopped).toBe(false)
  })

  it('stops when hookCtx.stop() is called', () => {
    const runner = new HookRunner()
    runner.hookCtx.stop()
    expect(runner.stopped).toBe(true)
  })

  it('propagates stop to parent context', () => {
    const parent = new HookRunner()
    const child = new HookRunner(parent.hookCtx)
    child.hookCtx.stop()
    expect(child.stopped).toBe(true)
    expect(parent.stopped).toBe(true)
  })

  it('runBeforeStep returns model unchanged when no hooks', () => {
    const runner = new HookRunner()
    const model = { config: {} } as any
    const result = runner.runBeforeStep(undefined, 1, [], [], model)
    expect(result).toBe(model)
  })
})
