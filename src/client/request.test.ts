import { DEEPSEEK_API_BASE_URL } from '@/constants'
import { getChatEndpoint } from './endpoints'
import { apiRequest } from './request'

describe('apiRequest', () => {
  it('should return a response', async () => {
    const url = getChatEndpoint(DEEPSEEK_API_BASE_URL)
    const response = await apiRequest(
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
