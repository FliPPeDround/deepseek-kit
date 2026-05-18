import { compact, omit } from '@/utils'

describe('compact', () => {
  it('removes undefined values from object', () => {
    const result = compact({ a: 1, b: undefined, c: 'hello', d: undefined })
    expect(result).toEqual({ a: 1, c: 'hello' })
  })

  it('preserves null and falsy non-undefined values', () => {
    const result = compact({ a: null, b: 0, c: '', d: false, e: undefined })
    expect(result).toEqual({ a: null, b: 0, c: '', d: false })
  })

  it('returns empty object when all values are undefined', () => {
    const result = compact({ a: undefined, b: undefined })
    expect(result).toEqual({})
  })

  it('returns identical object when no undefined values', () => {
    const input = { a: 1, b: 'test', c: true }
    const result = compact(input)
    expect(result).toEqual(input)
  })
})

describe('omit', () => {
  it('removes specified keys from object', () => {
    const result = omit({ a: 1, b: 2, c: 3 }, ['b'])
    expect(result).toEqual({ a: 1, c: 3 })
  })

  it('removes multiple keys', () => {
    const result = omit({ a: 1, b: 2, c: 3, d: 4 }, ['a', 'c'])
    expect(result).toEqual({ b: 2, d: 4 })
  })

  it('returns identical object when keys list is empty', () => {
    const input = { a: 1, b: 2 }
    const result = omit(input, [])
    expect(result).toEqual(input)
  })

  it('handles non-existent keys gracefully', () => {
    const result = omit({ a: 1, b: 2 }, ['c' as any])
    expect(result).toEqual({ a: 1, b: 2 })
  })
})
