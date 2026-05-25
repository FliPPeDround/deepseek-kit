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

  it('initially not skipped', () => {
    const runner = new HookRunner()
    expect(runner.skipped).toBe(false)
  })

  it('marks skipped when hookCtx.skip() is called', () => {
    const runner = new HookRunner()
    runner.hookCtx.skip()
    expect(runner.skipped).toBe(true)
  })

  it('resetSkip clears skipped state', () => {
    const runner = new HookRunner()
    runner.hookCtx.skip()
    expect(runner.skipped).toBe(true)
    runner.resetSkip()
    expect(runner.skipped).toBe(false)
  })

  it('skip does not propagate to parent context', () => {
    const parent = new HookRunner()
    const child = new HookRunner(parent.hookCtx)
    child.hookCtx.skip()
    expect(child.skipped).toBe(true)
    expect(parent.skipped).toBe(false)
  })

  it('stop and skip can be used independently', () => {
    const runner = new HookRunner()
    runner.hookCtx.skip()
    expect(runner.skipped).toBe(true)
    expect(runner.stopped).toBe(false)
    runner.hookCtx.stop()
    expect(runner.stopped).toBe(true)
    expect(runner.skipped).toBe(true)
  })
})

describe('hookRunner compact hooks', () => {
  it('runBeforeMessageCompact calls beforeMessageCompact hook', () => {
    const runner = new HookRunner()
    const beforeFn = vi.fn()
    const hooks = { beforeMessageCompact: beforeFn }
    const context = {
      promptTokens: 100,
      messages: [{ role: 'user' as const, content: 'hello' }],
      threshold: 0.85,
    }
    runner.runBeforeMessageCompact(hooks, context)
    expect(beforeFn).toHaveBeenCalledWith(context, runner.hookCtx)
  })

  it('runAfterMessageCompact calls afterMessageCompact hook', () => {
    const runner = new HookRunner()
    const afterFn = vi.fn()
    const hooks = { afterMessageCompact: afterFn }
    const event = {
      messagesBefore: [{ role: 'user' as const, content: 'hello' }],
      messagesAfter: [{ role: 'user' as const, name: 'compact-summary', content: 'summary' }],
      promptTokens: 100,
      threshold: 0.85,
    }
    runner.runAfterMessageCompact(hooks, event)
    expect(afterFn).toHaveBeenCalledWith(event, runner.hookCtx)
  })

  it('runBeforeToolCompact calls beforeToolCompact hook', () => {
    const runner = new HookRunner()
    const beforeFn = vi.fn()
    const hooks = { beforeToolCompact: beforeFn }
    const context = {
      toolName: 'readFile',
      toolDescription: 'Reads a file',
      content: 'file contents here',
      threshold: 1500,
    }
    runner.runBeforeToolCompact(hooks, context)
    expect(beforeFn).toHaveBeenCalledWith(context, runner.hookCtx)
  })

  it('runAfterToolCompact calls afterToolCompact hook', () => {
    const runner = new HookRunner()
    const afterFn = vi.fn()
    const hooks = { afterToolCompact: afterFn }
    const event = {
      toolName: 'readFile',
      toolDescription: 'Reads a file',
      contentBefore: 'long file contents',
      contentAfter: 'compacted contents',
      threshold: 1500,
    }
    runner.runAfterToolCompact(hooks, event)
    expect(afterFn).toHaveBeenCalledWith(event, runner.hookCtx)
  })

  it('compact hooks do not fire when hooks are undefined', () => {
    const runner = new HookRunner()
    expect(() => runner.runBeforeMessageCompact(undefined, { promptTokens: 0, messages: [], threshold: 0.85 })).not.toThrow()
    expect(() => runner.runAfterMessageCompact(undefined, { messagesBefore: [], messagesAfter: [], promptTokens: 0, threshold: 0.85 })).not.toThrow()
    expect(() => runner.runBeforeToolCompact(undefined, { toolName: 'test', toolDescription: '', content: '', threshold: 100 })).not.toThrow()
    expect(() => runner.runAfterToolCompact(undefined, { toolName: 'test', toolDescription: '', contentBefore: '', contentAfter: '', threshold: 100 })).not.toThrow()
  })

  it('beforeMessageCompact can call skip()', () => {
    const runner = new HookRunner()
    const hooks = {
      beforeMessageCompact: (_ctx: any, hookCtx: any) => { hookCtx.skip() },
    }
    runner.runBeforeMessageCompact(hooks, { promptTokens: 100, messages: [], threshold: 0.85 })
    expect(runner.skipped).toBe(true)
  })

  it('beforeToolCompact can call skip()', () => {
    const runner = new HookRunner()
    const hooks = {
      beforeToolCompact: (_ctx: any, hookCtx: any) => { hookCtx.skip() },
    }
    runner.runBeforeToolCompact(hooks, { toolName: 'test', toolDescription: '', content: '', threshold: 100 })
    expect(runner.skipped).toBe(true)
  })

  it('beforeMessageCompact can call stop()', () => {
    const runner = new HookRunner()
    const hooks = {
      beforeMessageCompact: (_ctx: any, hookCtx: any) => { hookCtx.stop() },
    }
    runner.runBeforeMessageCompact(hooks, { promptTokens: 100, messages: [], threshold: 0.85 })
    expect(runner.stopped).toBe(true)
  })

  it('beforeToolCompact can call stop()', () => {
    const runner = new HookRunner()
    const hooks = {
      beforeToolCompact: (_ctx: any, hookCtx: any) => { hookCtx.stop() },
    }
    runner.runBeforeToolCompact(hooks, { toolName: 'test', toolDescription: '', content: '', threshold: 100 })
    expect(runner.stopped).toBe(true)
  })
})
