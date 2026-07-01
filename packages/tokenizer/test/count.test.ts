import { describe, expect, it } from 'vitest'
import { countTokens } from './../'

describe('countTokens', () => {
  it('should count tokens in text', async () => {
    const count = await countTokens('Hello!')
    expect(count).toBe(2)
  })
})
