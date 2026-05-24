import { z } from 'zod'
import { CompactTool, createCompactTool } from '@/context/compact'
import { tool } from '@/tool'

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
