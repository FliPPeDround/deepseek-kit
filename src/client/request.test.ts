import { DEEPSEEK_API_BASE_URL } from '@/constants'
import { chatEndpoint } from './endpoints'
import { request } from './request'

describe('request', () => {
  it('should return a response', async () => {
    const url = chatEndpoint(DEEPSEEK_API_BASE_URL)
    const response = await request(
      url,
      'sk-1234567890abcdef1234567890abcdef',
      {
        model: 'deepseek-v4-flash',
        messages: [
          {
            role: 'user',
            content: '你好',
          },
        ],
      },
    )
    expect(response).toBeDefined()
  })
})
