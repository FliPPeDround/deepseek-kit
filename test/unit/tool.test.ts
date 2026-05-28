import { z } from 'zod'
import { buildToolParameters, serializeResult, tool, validateToolConsistency } from '@/tool'

describe('serializeResult', () => {
  it.each([
    ['string value', 'hello', 'hello'],
    ['number value', '42', 42],
    ['object value', '{"key":"value"}', { key: 'value' }],
    ['null value', 'null', null],
    ['undefined value', 'undefined', undefined],
    ['boolean value', 'true', true],
  ])('serializes %s correctly', (_desc, expected, input) => {
    expect(serializeResult(input)).toBe(expected)
  })
})

describe('tool', () => {
  const weatherSchema = z.object({
    city: z.string().describe('City name'),
  })

  it('creates a tool with correct properties', () => {
    const t = tool({
      name: 'get_weather',
      description: 'Get weather for a city',
      schema: weatherSchema,
      execute: async ({ city }) => `Weather in ${city}: sunny`,
    })

    expect(t.name).toBe('get_weather')
    expect(t.description).toBe('Get weather for a city')
    expect(t.parameters).toBeDefined()
  })

  it('executes tool with valid arguments', async () => {
    const t = tool({
      name: 'get_weather',
      description: 'Get weather',
      schema: weatherSchema,
      execute: async ({ city }) => `Weather in ${city}: sunny`,
    })

    const result = await t.execute(JSON.stringify({ city: 'Beijing' }))
    const parsed = JSON.parse(result)
    expect(parsed.success).toBe(true)
    expect(parsed.data).toBe('Weather in Beijing: sunny')
  })

  it('returns error for invalid arguments', async () => {
    const t = tool({
      name: 'get_weather',
      description: 'Get weather',
      schema: weatherSchema,
      execute: async ({ city }) => city,
    })

    const result = await t.execute(JSON.stringify({ city: 123 }))
    const parsed = JSON.parse(result)
    expect(parsed.success).toBe(false)
    expect(parsed.error).toContain('Invalid arguments')
  })

  it('returns schema error for repairable-but-invalid JSON arguments', async () => {
    const t = tool({
      name: 'get_weather',
      description: 'Get weather',
      schema: weatherSchema,
      execute: async ({ city }) => city,
    })

    const result = await t.execute('not json')
    const parsed = JSON.parse(result)
    expect(parsed.success).toBe(false)
    expect(parsed.error).toContain('Invalid arguments')
  })

  it('returns parse error for completely unrepairable JSON', async () => {
    const t = tool({
      name: 'get_weather',
      description: 'Get weather',
      schema: weatherSchema,
      execute: async ({ city }) => city,
    })

    const result = await t.execute('}}}}not json at all{{{')
    const parsed = JSON.parse(result)
    expect(parsed.success).toBe(false)
    expect(parsed.error).toContain('Failed to parse arguments')
  })

  it('returns error when execute throws', async () => {
    const t = tool({
      name: 'fail_tool',
      description: 'Always fails',
      schema: weatherSchema,
      execute: async () => { throw new Error('execution failed') },
    })

    const result = await t.execute(JSON.stringify({ city: 'Beijing' }))
    const parsed = JSON.parse(result)
    expect(parsed.success).toBe(false)
    expect(parsed.error).toBe('execution failed')
  })

  it('respects timeout setting', async () => {
    const t = tool({
      name: 'slow_tool',
      description: 'Slow tool',
      schema: weatherSchema,
      timeout: 50,
      execute: async () => {
        await new Promise(resolve => setTimeout(resolve, 200))
        return 'done'
      },
    })

    const result = await t.execute(JSON.stringify({ city: 'Beijing' }))
    const parsed = JSON.parse(result)
    expect(parsed.success).toBe(false)
    expect(parsed.error).toContain('timed out')
  })

  it('retries on failure', async () => {
    let attempts = 0
    const t = tool({
      name: 'retry_tool',
      description: 'Retries',
      schema: weatherSchema,
      retries: 2,
      execute: async () => {
        attempts++
        if (attempts < 3)
          throw new Error('not yet')
        return 'success'
      },
    })

    const result = await t.execute(JSON.stringify({ city: 'Beijing' }))
    const parsed = JSON.parse(result)
    expect(parsed.success).toBe(true)
    expect(parsed.data).toBe('success')
    expect(attempts).toBe(3)
  })

  describe('strict mode', () => {
    it('passes strict flag to tool parameters when strict=true', () => {
      const t = tool({
        name: 'strict_tool',
        description: 'Strict tool',
        strict: true,
        schema: weatherSchema,
        execute: async ({ city }) => city,
      })

      expect(t.strict).toBe(true)
      const { toolParameters } = buildToolParameters([t])
      expect(toolParameters![0].function.strict).toBe(true)
    })

    it('does not include strict field when strict is not set', () => {
      const t = tool({
        name: 'non_strict_tool',
        description: 'Non-strict tool',
        schema: weatherSchema,
        execute: async ({ city }) => city,
      })

      expect(t.strict).toBeUndefined()
      const { toolParameters } = buildToolParameters([t])
      expect(toolParameters![0].function.strict).toBeUndefined()
    })

    it('does not modify schema locally when strict=true', () => {
      const schemaWithoutStrict = z.object({
        city: z.string().describe('City name'),
        optional: z.string().optional(),
      })
      const t = tool({
        name: 'strict_tool',
        description: 'Strict tool',
        strict: true,
        schema: schemaWithoutStrict,
        execute: async ({ city }) => city,
      })

      expect(t.parameters.required).not.toContain('optional')
    })

    it('sets strict: true for all tools when modelStrict=true', () => {
      const t1 = tool({
        name: 'tool_a',
        description: 'Tool A',
        schema: weatherSchema,
        execute: async ({ city }) => city,
      })
      const t2 = tool({
        name: 'tool_b',
        description: 'Tool B',
        schema: weatherSchema,
        execute: async ({ city }) => city,
      })

      const { toolParameters } = buildToolParameters([t1, t2], true)
      expect(toolParameters![0].function.strict).toBe(true)
      expect(toolParameters![1].function.strict).toBe(true)
    })
  })

  describe('validateToolConsistency', () => {
    it('passes when all tools are strict', () => {
      const t1 = tool({
        name: 'strict_a',
        description: 'Strict A',
        strict: true,
        schema: weatherSchema,
        execute: async ({ city }) => city,
      })
      const t2 = tool({
        name: 'strict_b',
        description: 'Strict B',
        strict: true,
        schema: weatherSchema,
        execute: async ({ city }) => city,
      })

      expect(() => validateToolConsistency([t1, t2])).not.toThrow()
    })

    it('passes when no tools are strict', () => {
      const t1 = tool({
        name: 'tool_a',
        description: 'Tool A',
        schema: weatherSchema,
        execute: async ({ city }) => city,
      })
      const t2 = tool({
        name: 'tool_b',
        description: 'Tool B',
        schema: weatherSchema,
        execute: async ({ city }) => city,
      })

      expect(() => validateToolConsistency([t1, t2])).not.toThrow()
    })

    it('throws when mixing strict and non-strict tools', () => {
      const t1 = tool({
        name: 'strict_tool',
        description: 'Strict',
        strict: true,
        schema: weatherSchema,
        execute: async ({ city }) => city,
      })
      const t2 = tool({
        name: 'non_strict_tool',
        description: 'Non-strict',
        schema: weatherSchema,
        execute: async ({ city }) => city,
      })

      expect(() => validateToolConsistency([t1, t2])).toThrow(
        'When using strict mode, all tools must have strict: true',
      )
    })

    it('passes for empty tools array', () => {
      expect(() => validateToolConsistency([])).not.toThrow()
    })
  })

  describe('abortSignal', () => {
    it('aborts tool execution via signal with timeout', async () => {
      const controller = new AbortController()
      const t = tool({
        name: 'slow_tool',
        description: 'Slow tool',
        schema: weatherSchema,
        timeout: 5000,
        execute: async () => {
          await new Promise(resolve => setTimeout(resolve, 10000))
          return 'done'
        },
      })

      setTimeout(() => controller.abort(), 50)
      const result = await t.execute(JSON.stringify({ city: 'Beijing' }), controller.signal)
      const parsed = JSON.parse(result)
      expect(parsed.success).toBe(false)
      expect(parsed.error).toContain('Aborted')
    })

    it('aborts tool execution via already-aborted signal', async () => {
      const controller = new AbortController()
      controller.abort()

      const t = tool({
        name: 'abort_tool',
        description: 'Abort tool',
        schema: weatherSchema,
        timeout: 5000,
        execute: async () => 'should not reach',
      })

      const result = await t.execute(JSON.stringify({ city: 'Beijing' }), controller.signal)
      const parsed = JSON.parse(result)
      expect(parsed.success).toBe(false)
      expect(parsed.error).toContain('Aborted')
    })

    it('does not abort when signal is not triggered', async () => {
      const controller = new AbortController()
      const t = tool({
        name: 'fast_tool',
        description: 'Fast tool',
        schema: weatherSchema,
        timeout: 5000,
        execute: async ({ city }) => `Weather in ${city}: sunny`,
      })

      const result = await t.execute(JSON.stringify({ city: 'Beijing' }), controller.signal)
      const parsed = JSON.parse(result)
      expect(parsed.success).toBe(true)
      expect(parsed.data).toBe('Weather in Beijing: sunny')
    })

    it('abort signal stops retries', async () => {
      let attempts = 0
      const controller = new AbortController()

      const t = tool({
        name: 'retry_abort_tool',
        description: 'Retry abort tool',
        schema: weatherSchema,
        timeout: 200,
        retries: 5,
        execute: async () => {
          attempts++
          await new Promise(resolve => setTimeout(resolve, 1000))
          return 'done'
        },
      })

      setTimeout(() => controller.abort(), 100)
      const result = await t.execute(JSON.stringify({ city: 'Beijing' }), controller.signal)
      const parsed = JSON.parse(result)
      expect(parsed.success).toBe(false)
      expect(parsed.error).toContain('Aborted')
      expect(attempts).toBeLessThan(6)
    })
  })
})

describe('buildToolParameters', () => {
  it('returns undefined for empty tools array', () => {
    const result = buildToolParameters([])
    expect(result.toolParameters).toBeUndefined()
    expect(result.toolChoice).toBeUndefined()
  })

  it('builds parameters for a single tool', () => {
    const t = tool({
      name: 'get_weather',
      description: 'Get weather',
      schema: z.object({ city: z.string() }),
      execute: async ({ city }) => city,
    })

    const result = buildToolParameters([t])
    expect(result.toolParameters).toHaveLength(1)
    expect(result.toolParameters![0].type).toBe('function')
    expect(result.toolParameters![0].function.name).toBe('get_weather')
    expect(result.toolChoice).toBeUndefined()
  })

  it('sets tool_choice to specific function when one required tool', () => {
    const t = tool({
      name: 'required_tool',
      description: 'Required',
      schema: z.object({ input: z.string() }),
      required: true,
      execute: async ({ input }) => input,
    })

    const result = buildToolParameters([t])
    expect(result.toolChoice).toEqual({
      type: 'function',
      function: { name: 'required_tool' },
    })
  })

  it('sets tool_choice to "required" when multiple required tools', () => {
    const t1 = tool({
      name: 'tool_a',
      description: 'Tool A',
      schema: z.object({ a: z.string() }),
      required: true,
      execute: async ({ a }) => a,
    })
    const t2 = tool({
      name: 'tool_b',
      description: 'Tool B',
      schema: z.object({ b: z.string() }),
      required: true,
      execute: async ({ b }) => b,
    })

    const result = buildToolParameters([t1, t2])
    expect(result.toolChoice).toBe('required')
  })
})
