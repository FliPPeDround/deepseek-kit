import type { ChatMessage } from '@/model/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { CompactMessage, CompactTool, createCompactTool } from '@/context/compact'
import { tool } from '@/tool'

vi.mock('@/model', () => ({
  createModel: vi.fn().mockReturnValue({
    invoke: vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: 'Summary of conversation history',
            role: 'assistant',
          },
        },
      ],
    }),
  }),
}))

describe('compactTool', () => {
  beforeEach(() => {
    ;(CompactTool as any).instance = null
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('compact', () => {
    it('returns content as-is when below threshold', async () => {
      const ct = createCompactTool({ threshold: 100 })
      const shortContent = 'a'.repeat(50)
      const result = await ct.compact(shortContent, 'test', 'test tool')
      expect(result).toBe(shortContent)
    })

    it('compacts content when above threshold', async () => {
      const ct = createCompactTool({ threshold: 100 })
      vi.spyOn(ct as any, 'compactContent').mockResolvedValue('compacted')
      const longContent = 'a'.repeat(200)
      const result = await ct.compact(longContent, 'test', 'test tool')
      expect(result).toBe('compacted')
    })

    it('caches compacted results', async () => {
      const ct = createCompactTool({ threshold: 100 })
      const spy = vi.spyOn(ct as any, 'compactContent').mockResolvedValue('compacted')
      const longContent = 'a'.repeat(200)
      await ct.compact(longContent, 'test', 'test tool')
      await ct.compact(longContent, 'test', 'test tool')
      expect(spy).toHaveBeenCalledTimes(1)
    })

    it('returns original content when compactContent returns empty', async () => {
      const ct = createCompactTool({ threshold: 100 })
      vi.spyOn(ct as any, 'compactContent').mockResolvedValue('')
      const longContent = 'a'.repeat(200)
      const result = await ct.compact(longContent, 'test', 'test tool')
      expect(result).toBe(longContent)
    })

    it('returns original content when compactContent throws', async () => {
      const ct = createCompactTool({ threshold: 100 })
      vi.spyOn(ct as any, 'compactContent').mockRejectedValue(new Error('API error'))
      const longContent = 'a'.repeat(200)
      const result = await ct.compact(longContent, 'test', 'test tool')
      expect(result).toBe(longContent)
    })

    it('passes signal to compactContent', async () => {
      const ct = createCompactTool({ threshold: 100 })
      const spy = vi.spyOn(ct as any, 'compactContent').mockResolvedValue('compacted')
      const controller = new AbortController()
      const longContent = 'a'.repeat(200)
      await ct.compact(longContent, 'test', 'test tool', controller.signal)
      expect(spy).toHaveBeenCalledWith(longContent, 'test', 'test tool', controller.signal)
    })

    it('uses custom model from config', () => {
      const ct = createCompactTool({ threshold: 100, model: 'deepseek-v4' })
      expect((ct as any).model).toBe('deepseek-v4')
    })

    it('uses default model when not specified', () => {
      const ct = createCompactTool({ threshold: 100 })
      expect((ct as any).model).toBe('deepseek-v4-flash')
    })
  })
})

describe('tool with compact', () => {
  const schema = z.object({ query: z.string() })

  beforeEach(() => {
    ;(CompactTool as any).instance = null
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('compacts tool result when compact is true', async () => {
    const ct = createCompactTool()
    vi.spyOn(ct, 'compact').mockResolvedValue('compacted content')

    const t = tool({
      name: 'long_result_tool',
      description: 'Returns a long result',
      schema,
      compact: true,
      execute: async () => 'a'.repeat(2000),
    })

    const result = await t.execute(JSON.stringify({ query: 'test' }))
    const parsed = JSON.parse(result)
    expect(parsed.success).toBe(true)
    expect(parsed.data).toBe('compacted content')
  })

  it('compacts tool result with custom config', async () => {
    const ct = createCompactTool()
    vi.spyOn(ct, 'compact').mockResolvedValue('compacted content')

    const t = tool({
      name: 'custom_compact_tool',
      description: 'Returns a long result',
      schema,
      compact: { threshold: 100 },
      execute: async () => 'a'.repeat(200),
    })

    const result = await t.execute(JSON.stringify({ query: 'test' }))
    const parsed = JSON.parse(result)
    expect(parsed.success).toBe(true)
    expect(parsed.data).toBe('compacted content')
  })

  it('does not compact when result is below threshold', async () => {
    const t = tool({
      name: 'short_result_tool',
      description: 'Returns a short result',
      schema,
      compact: { threshold: 10000 },
      execute: async () => 'short result',
    })

    const result = await t.execute(JSON.stringify({ query: 'test' }))
    const parsed = JSON.parse(result)
    expect(parsed.success).toBe(true)
    expect(parsed.data).toBe('short result')
  })

  it('returns original data when compact fails', async () => {
    const ct = createCompactTool()
    vi.spyOn(ct, 'compact').mockRejectedValue(new Error('compact API error'))

    const t = tool({
      name: 'compact_fail_tool',
      description: 'Tool whose compact fails',
      schema,
      compact: { threshold: 10 },
      execute: async () => 'a'.repeat(100),
    })

    const result = await t.execute(JSON.stringify({ query: 'test' }))
    const parsed = JSON.parse(result)
    expect(parsed.success).toBe(true)
    expect(parsed.data).toBe('a'.repeat(100))
  })
})

describe('compactMessage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('shouldCompact', () => {
    it('returns false when below threshold', () => {
      const cm = new CompactMessage()
      expect(cm.shouldCompact(849_999)).toBe(false)
    })

    it('returns true when at threshold', () => {
      const cm = new CompactMessage()
      expect(cm.shouldCompact(850_000)).toBe(true)
    })

    it('returns true when above threshold', () => {
      const cm = new CompactMessage()
      expect(cm.shouldCompact(900_000)).toBe(true)
    })

    it('uses custom threshold and contextWindowSize', () => {
      const cm = new CompactMessage({ threshold: 0.5, contextWindowSize: 1000 })
      expect(cm.shouldCompact(499)).toBe(false)
      expect(cm.shouldCompact(500)).toBe(true)
      expect(cm.shouldCompact(600)).toBe(true)
    })
  })

  describe('constructor', () => {
    it('uses default values', () => {
      const cm = new CompactMessage()
      expect((cm as any).threshold).toBe(0.85)
      expect((cm as any).keepRecentRounds).toBe(3)
      expect((cm as any).model).toBe('deepseek-v4-flash')
      expect((cm as any).contextWindowSize).toBe(1_000_000)
    })

    it('applies custom config', () => {
      const cm = new CompactMessage({
        threshold: 0.7,
        keepRecentRounds: 5,
        model: 'deepseek-v4-pro',
        contextWindowSize: 500_000,
      })
      expect((cm as any).threshold).toBe(0.7)
      expect((cm as any).keepRecentRounds).toBe(5)
      expect((cm as any).model).toBe('deepseek-v4-pro')
      expect((cm as any).contextWindowSize).toBe(500_000)
    })
  })

  describe('compact', () => {
    it('returns messages as-is when no history rounds (all rounds are recent)', async () => {
      const cm = new CompactMessage({ keepRecentRounds: 3 })
      const messages: ChatMessage[] = [
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'hi' },
        { role: 'user', content: 'how are you' },
        { role: 'assistant', content: 'fine' },
      ]
      const result = await cm.compact(messages)
      expect(result).toEqual(messages)
    })

    it('preserves system messages in prefix', async () => {
      const cm = new CompactMessage({ keepRecentRounds: 1 })
      const messages: ChatMessage[] = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'system', content: 'Always be concise.' },
        { role: 'user', content: 'question 1' },
        { role: 'assistant', content: 'answer 1' },
        { role: 'user', content: 'question 2' },
        { role: 'assistant', content: 'answer 2' },
      ]
      const result = await cm.compact(messages)
      expect(result[0]).toEqual({ role: 'system', content: 'You are a helpful assistant.' })
      expect(result[1]).toEqual({ role: 'system', content: 'Always be concise.' })
    })

    it('preserves few-shot messages in prefix (including tool messages with name=few-shot)', async () => {
      const cm = new CompactMessage({ keepRecentRounds: 1 })
      const messages: ChatMessage[] = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'example question', name: 'few-shot' },
        { role: 'assistant', content: 'example answer', name: 'few-shot' },
        { role: 'tool', content: 'example tool result', tool_call_id: 'call_1', name: 'few-shot' },
        { role: 'user', content: 'question 1' },
        { role: 'assistant', content: 'answer 1' },
        { role: 'user', content: 'question 2' },
        { role: 'assistant', content: 'answer 2' },
      ]
      const result = await cm.compact(messages)
      expect(result[0]).toEqual({ role: 'system', content: 'You are a helpful assistant.' })
      expect(result[1]).toEqual({ role: 'user', content: 'example question', name: 'few-shot' })
      expect(result[2]).toEqual({ role: 'assistant', content: 'example answer', name: 'few-shot' })
      expect(result[3]).toEqual({ role: 'tool', content: 'example tool result', tool_call_id: 'call_1', name: 'few-shot' })
    })

    it('summarizes history rounds and keeps recent rounds', async () => {
      const cm = new CompactMessage({ keepRecentRounds: 1 })
      const messages: ChatMessage[] = [
        { role: 'user', content: 'question 1' },
        { role: 'assistant', content: 'answer 1' },
        { role: 'user', content: 'question 2' },
        { role: 'assistant', content: 'answer 2' },
        { role: 'user', content: 'question 3' },
        { role: 'assistant', content: 'answer 3' },
      ]
      const result = await cm.compact(messages)
      expect(result).toHaveLength(3)
      expect(result[0]).toEqual({
        role: 'user',
        name: 'compact-summary',
        content: '[Conversation history summary]: Summary of conversation history',
      })
      expect(result[1]).toEqual({ role: 'user', content: 'question 3' })
      expect(result[2]).toEqual({ role: 'assistant', content: 'answer 3' })
    })

    it('returns original messages when summarization fails', async () => {
      const { createModel } = await import('@/model')
      vi.mocked(createModel).mockReturnValueOnce({
        invoke: vi.fn().mockRejectedValue(new Error('LLM error')),
      } as any)
      const cm = new CompactMessage({ keepRecentRounds: 1 })
      const messages: ChatMessage[] = [
        { role: 'user', content: 'question 1' },
        { role: 'assistant', content: 'answer 1' },
        { role: 'user', content: 'question 2' },
        { role: 'assistant', content: 'answer 2' },
      ]
      const result = await cm.compact(messages)
      expect(result).toEqual(messages)
    })

    it('groups rounds by user message boundaries', async () => {
      const cm = new CompactMessage({ keepRecentRounds: 1 })
      const messages: ChatMessage[] = [
        { role: 'user', content: 'question 1' },
        {
          role: 'assistant',
          content: null,
          tool_calls: [{
            id: 'call_1',
            type: 'function',
            function: { name: 'search', arguments: '{"q":"test"}' },
          }],
        },
        { role: 'tool', content: 'tool result 1', tool_call_id: 'call_1' },
        { role: 'assistant', content: 'answer 1' },
        { role: 'user', content: 'question 2' },
        { role: 'assistant', content: 'answer 2' },
        { role: 'user', content: 'question 3' },
        { role: 'assistant', content: 'answer 3' },
      ]
      const result = await cm.compact(messages)
      expect(result[0]).toEqual({
        role: 'user',
        name: 'compact-summary',
        content: '[Conversation history summary]: Summary of conversation history',
      })
      expect(result[1]).toEqual({ role: 'user', content: 'question 3' })
      expect(result[2]).toEqual({ role: 'assistant', content: 'answer 3' })
    })
  })
})
