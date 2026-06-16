import { z } from 'zod'
import { buildToolParameters, tool, webSearch } from '@/tool'
import { createMockModelConfig, mockFetchSuccess } from '../helpers'

describe('webSearch', () => {
  it('creates a tool with correct name and description', () => {
    const ws = webSearch()
    expect(ws.name).toBe('web_search')
    expect(ws.description).toContain('Search the web')
    expect(ws.parameters).toBeDefined()
  })

  it('executes and returns formatted results', async () => {
    const mockResponse = {
      content: [
        {
          type: 'web_search_tool_result',
          content: [
            { type: 'web_search_result', title: 'Result 1', url: 'https://example.com/1' },
            { type: 'web_search_result', title: 'Result 2', url: 'https://example.com/2' },
          ],
        },
        { type: 'text', text: 'Here is the answer.' },
      ],
      usage: {
        input_tokens: 20,
        output_tokens: 10,
        cache_creation_input_tokens: 15,
        cache_read_input_tokens: 5,
      },
    }
    mockFetchSuccess(mockResponse)

    const ws = webSearch()
    const modelConfig = createMockModelConfig()
    const result = await ws.execute(
      JSON.stringify({ query: 'test query' }),
      undefined,
      undefined,
      undefined,
      modelConfig,
    )
    const parsed = JSON.parse(result)

    expect(parsed.success).toBe(true)
    expect(parsed.data).toContain('Here is the answer.')
    expect(parsed.data).toContain('### Sources (2):')
    expect(parsed.data).toContain('[Result 1](https://example.com/1)')
    expect(parsed.data).toContain('[Result 2](https://example.com/2)')
    expect(parsed.usage).toBeDefined()
    expect(parsed.usage.total_tokens).toBe(30)
  })

  it('returns no-results message when response is empty', async () => {
    mockFetchSuccess({ content: [] })

    const ws = webSearch()
    const modelConfig = createMockModelConfig()
    const result = await ws.execute(
      JSON.stringify({ query: 'test query' }),
      undefined,
      undefined,
      undefined,
      modelConfig,
    )
    const parsed = JSON.parse(result)

    expect(parsed.success).toBe(true)
    expect(parsed.data).toContain('returned no results')
  })

  it('returns error when modelConfig is missing', async () => {
    const ws = webSearch()
    const result = await ws.execute(JSON.stringify({ query: 'test' }))
    const parsed = JSON.parse(result)

    expect(parsed.success).toBe(false)
    expect(parsed.error).toContain('API key is not available')
  })

  it('returns error when apiKey is empty', async () => {
    const ws = webSearch()
    const modelConfig = { ...createMockModelConfig(), apiKey: '' }
    const result = await ws.execute(
      JSON.stringify({ query: 'test' }),
      undefined,
      undefined,
      undefined,
      modelConfig,
    )
    const parsed = JSON.parse(result)

    expect(parsed.success).toBe(false)
    expect(parsed.error).toContain('API key is not available')
  })

  it('includes usage in result when API returns usage data', async () => {
    const mockUsage = {
      input_tokens: 20,
      output_tokens: 10,
      cache_creation_input_tokens: 15,
      cache_read_input_tokens: 5,
    }
    mockFetchSuccess({
      content: [{ type: 'text', text: 'Search result' }],
      usage: mockUsage,
    })

    const ws = webSearch()
    const modelConfig = createMockModelConfig()

    const result = await ws.execute(
      JSON.stringify({ query: 'test' }),
      undefined,
      undefined,
      undefined,
      modelConfig,
    )
    const parsed = JSON.parse(result)

    expect(parsed.success).toBe(true)
    expect(parsed.usage).toBeDefined()
    expect(parsed.usage.total_tokens).toBe(30)
  })

  it('handles API error response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized'),
    }))

    const ws = webSearch()
    const modelConfig = createMockModelConfig()
    const result = await ws.execute(
      JSON.stringify({ query: 'test' }),
      undefined,
      undefined,
      undefined,
      modelConfig,
    )
    const parsed = JSON.parse(result)

    expect(parsed.success).toBe(false)
    expect(parsed.error).toContain('401')
  })

  it('can be used in buildToolParameters alongside normal tools', () => {
    const ws = webSearch()
    const normalTool = tool({
      name: 'calculator',
      description: 'Calculate',
      schema: z.object({ expr: z.string() }),
      execute: async ({ expr }) => expr,
    })

    const { toolParameters } = buildToolParameters([ws, normalTool])
    expect(toolParameters).toHaveLength(2)
    expect(toolParameters![0].function.name).toBe('web_search')
    expect(toolParameters![1].function.name).toBe('calculator')
  })
})
