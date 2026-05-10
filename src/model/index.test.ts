import { describe, expect, it } from 'vitest'
import { createModel } from './index'

describe('createModel', () => {
  it('should return a response', async () => {
    const model = createModel({
      model: 'deepseek-v4-flash',
    })
    const response = await model.invoke({ messages: [{ role: 'user', content: 'Hello' }] })
    expect(response.choices[0].message).toBeDefined()
  })
})
