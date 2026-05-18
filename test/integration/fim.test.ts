import { fim } from '@/fim'
import { DeepSeekModel } from '@/model'
import { createMockFIMResponse, MOCK_API_KEY, mockFIM } from '../helpers'

describe('fim', () => {
  let model: DeepSeekModel

  beforeEach(() => {
    model = new DeepSeekModel({ apiKey: MOCK_API_KEY, model: 'deepseek-v4-flash' })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns completed text from FIM response', async () => {
    mockFIM()

    const result = await fim({ model, prompt: 'function hello(' })
    expect(result.text).toBe('completed code here')
    expect(result.usage).toBeDefined()
  })

  it('throws when FIM API returns empty choices', async () => {
    mockFIM(createMockFIMResponse({ choices: [] }))

    await expect(
      fim({ model, prompt: 'function hello(' }),
    ).rejects.toThrow('empty choices')
  })

  it('passes suffix parameter to FIM request', async () => {
    mockFIM()

    await fim({ model, prompt: 'function hello(', suffix: '}' })

    const call = (fetch as any).mock.calls[0]
    const body = JSON.parse(call[1].body)
    expect(body.suffix).toBe('}')
  })

  it('passes echo parameter to FIM request', async () => {
    mockFIM()

    await fim({ model, prompt: 'function hello(', echo: true })

    const call = (fetch as any).mock.calls[0]
    const body = JSON.parse(call[1].body)
    expect(body.echo).toBe(true)
  })

  it('passes maxTokens parameter to FIM request', async () => {
    mockFIM()

    await fim({ model, prompt: 'function hello(', maxTokens: 100 })

    const call = (fetch as any).mock.calls[0]
    const body = JSON.parse(call[1].body)
    expect(body.max_tokens).toBe(100)
  })
})
