import { z } from 'zod'
import { formatZodErrors } from '@/generate/zod-error-formatter'

describe('formatZodErrors', () => {
  it('formats single field error', () => {
    const schema = z.object({ name: z.string() })
    const result = schema.safeParse({ name: 123 })
    if (!result.success) {
      const formatted = formatZodErrors(result.error)
      expect(formatted).toContain('Field \'name\'')
      expect(formatted).toContain('expected string, received number')
    }
  })

  it('formats root-level error', () => {
    const schema = z.string()
    const result = schema.safeParse(123)
    if (!result.success) {
      const formatted = formatZodErrors(result.error)
      expect(formatted).toContain('root object')
    }
  })

  it('formats nested path errors', () => {
    const schema = z.object({
      address: z.object({
        city: z.string(),
      }),
    })
    const result = schema.safeParse({ address: { city: 123 } })
    if (!result.success) {
      const formatted = formatZodErrors(result.error)
      expect(formatted).toContain('address.city')
    }
  })

  it('includes correction instruction', () => {
    const schema = z.object({ name: z.string() })
    const result = schema.safeParse({ name: 123 })
    if (!result.success) {
      const formatted = formatZodErrors(result.error)
      expect(formatted).toContain('correct your output')
      expect(formatted).toContain('Error details')
    }
  })
})
