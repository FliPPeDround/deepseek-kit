import { z } from 'zod'
import { formatParseError, formatZodErrors, parseAndValidate, tryJsonParse } from '@/utils/json-parse'

describe('tryJsonParse', () => {
  it('parses valid JSON', async () => {
    const result = await tryJsonParse('{"key": "value"}')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({ key: 'value' })
    }
  })

  it('parses valid JSON array', async () => {
    const result = await tryJsonParse('[1, 2, 3]')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual([1, 2, 3])
    }
  })

  it('repairs slightly broken JSON via jsonrepair', async () => {
    const result = await tryJsonParse('{key: "value"}')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({ key: 'value' })
    }
  })

  it('repairs JSON with trailing comma', async () => {
    const result = await tryJsonParse('{"key": "value",}')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({ key: 'value' })
    }
  })

  it('repairs JSON with single quotes', async () => {
    const result = await tryJsonParse('{\'key\': \'value\'}')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({ key: 'value' })
    }
  })

  it('returns error for completely unrepairable input', async () => {
    const result = await tryJsonParse('}}}}not json at all{{{')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBeInstanceOf(Error)
    }
  })
})

describe('parseAndValidate', () => {
  const schema = z.object({
    name: z.string(),
    age: z.number(),
  })

  it('returns data for valid JSON matching schema', async () => {
    const result = await parseAndValidate('{"name": "Alice", "age": 30}', schema)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({ name: 'Alice', age: 30 })
    }
  })

  it('repairs and validates slightly broken JSON', async () => {
    const result = await parseAndValidate('{name: "Alice", age: 30}', schema)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({ name: 'Alice', age: 30 })
    }
  })

  it('returns json_parse_error for unrepairable JSON', async () => {
    const result = await parseAndValidate('}}}}broken{{{', schema)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.type).toBe('json_parse_error')
      expect(result.raw).toBe('}}}}broken{{{')
    }
  })

  it('returns schema_validation_error for JSON not matching schema', async () => {
    const result = await parseAndValidate('{"name": 123, "age": "not a number"}', schema)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.type).toBe('schema_validation_error')
      expect(result.error).toBeInstanceOf(z.ZodError)
      expect(result.raw).toBe('{"name": 123, "age": "not a number"}')
    }
  })

  it('returns schema_validation_error for missing required fields', async () => {
    const result = await parseAndValidate('{"name": "Alice"}', schema)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.type).toBe('schema_validation_error')
    }
  })
})

describe('formatZodErrors', () => {
  it('formats field-level errors', () => {
    const schema = z.object({ name: z.string() })
    const result = schema.safeParse({ name: 123 })
    if (!result.success) {
      const formatted = formatZodErrors(result.error)
      expect(formatted).toContain('Field \'name\'')
      expect(formatted).toContain('correct your output')
    }
  })

  it('formats root-level errors', () => {
    const schema = z.string()
    const result = schema.safeParse(123)
    if (!result.success) {
      const formatted = formatZodErrors(result.error)
      expect(formatted).toContain('root object')
    }
  })
})

describe('formatParseError', () => {
  it('formats json_parse_error', async () => {
    const result = await parseAndValidate('}}}}broken{{{', z.object({ name: z.string() }))
    if (!result.success && result.type === 'json_parse_error') {
      const formatted = formatParseError(result)
      expect(formatted).toContain('not valid JSON')
      expect(formatted).toContain('auto-repaired')
    }
  })

  it('formats schema_validation_error', async () => {
    const result = await parseAndValidate('{"name": 123}', z.object({ name: z.string() }))
    if (!result.success && result.type === 'schema_validation_error') {
      const formatted = formatParseError(result)
      expect(formatted).toContain('does not conform to the required schema')
      expect(formatted).toContain('Field \'name\'')
    }
  })
})
