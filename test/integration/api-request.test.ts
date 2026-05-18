import { ApiRequestError } from '@/client/errors'
import { apiRequest } from '@/client/request'
import { MOCK_API_KEY, mockFetchError, mockFetchSuccess } from '../helpers'

describe('apiRequest', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sends POST request with correct headers', async () => {
    mockFetchSuccess({ result: 'ok' })

    await apiRequest('https://api.deepseek.com/test', MOCK_API_KEY, { model: 'deepseek-v4-pro' })

    expect(fetch).toHaveBeenCalledWith(
      'https://api.deepseek.com/test',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${MOCK_API_KEY}`,
          'Accept': 'application/json',
        }),
        body: JSON.stringify({ model: 'deepseek-v4-pro' }),
      }),
    )
  })

  it('sends GET request without body', async () => {
    mockFetchSuccess({ result: 'ok' })

    await apiRequest('https://api.deepseek.com/test', MOCK_API_KEY, {}, undefined, 'GET')

    expect(fetch).toHaveBeenCalledWith(
      'https://api.deepseek.com/test',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: `Bearer ${MOCK_API_KEY}`,
          Accept: 'application/json',
        }),
        body: undefined,
      }),
    )
  })

  it('does not set Content-Type for GET requests', async () => {
    mockFetchSuccess({ result: 'ok' })

    await apiRequest('https://api.deepseek.com/test', MOCK_API_KEY, {}, undefined, 'GET')

    const call = (fetch as any).mock.calls[0]
    const headers = call[1].headers
    expect(headers).not.toHaveProperty('Content-Type')
  })

  it('returns parsed JSON response', async () => {
    const expectedData = { id: '123', choices: [] }
    mockFetchSuccess(expectedData)

    const result = await apiRequest('https://api.deepseek.com/test', MOCK_API_KEY, {})
    expect(result).toEqual(expectedData)
  })

  it('throws ApiRequestError on non-ok response', async () => {
    mockFetchError(401, 'Invalid API key')

    await expect(
      apiRequest('https://api.deepseek.com/test', MOCK_API_KEY, {}),
    ).rejects.toThrow(ApiRequestError)
  })

  it('includes timeout signal when timeout is provided', async () => {
    mockFetchSuccess({ result: 'ok' })

    await apiRequest('https://api.deepseek.com/test', MOCK_API_KEY, {}, 5000)

    const call = (fetch as any).mock.calls[0]
    expect(call[1].signal).toBeDefined()
  })

  it('combines abort signal with timeout signal', async () => {
    mockFetchSuccess({ result: 'ok' })
    const controller = new AbortController()

    await apiRequest('https://api.deepseek.com/test', MOCK_API_KEY, {}, 5000, 'POST', controller.signal)

    const call = (fetch as any).mock.calls[0]
    expect(call[1].signal).toBeDefined()
  })
})
