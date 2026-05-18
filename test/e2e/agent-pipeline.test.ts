import { z } from 'zod'
import { createAgent } from '@/agent'
import { generateStream } from '@/generate/generate-stream'
import { generateText } from '@/generate/generate-text'
import { DeepSeekModel } from '@/model'
import { tool } from '@/tool'
import { createMockChatCompletion, createMockToolCallCompletion, createSequentialFetchMock, createTextChunks, MOCK_API_KEY, mockChatCompletion, mockFetchStream } from '../helpers'

describe('createAgent E2E', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('creates agent and generates text', async () => {
    mockChatCompletion()

    const model = new DeepSeekModel({ apiKey: MOCK_API_KEY, model: 'deepseek-v4-pro' })
    const agent = createAgent({ model })

    const result = await agent.generate({
      messages: [{ role: 'user', content: 'Hello' }],
    })

    expect(result.text).toBe('Hello! How can I help you today?')
    expect(result.usage).toBeDefined()
  })

  it('creates agent and streams text', async () => {
    const chunks = createTextChunks('Hi')
    mockFetchStream(chunks)

    const model = new DeepSeekModel({ apiKey: MOCK_API_KEY, model: 'deepseek-v4-pro' })
    const agent = createAgent({ model })

    const textDeltas: string[] = []
    for await (const event of agent.stream({ messages: [{ role: 'user', content: 'Hello' }] })) {
      if (event.type === 'text-delta') {
        textDeltas.push(event.textDelta)
      }
    }

    expect(textDeltas).toEqual(['H', 'i'])
  })

  it('creates agent with tools and handles tool calls', async () => {
    const weatherTool = tool({
      name: 'get_weather',
      description: 'Get weather for a city',
      schema: z.object({ city: z.string() }),
      execute: async ({ city }) => `Sunny in ${city}`,
    })

    const toolCallResponse = createMockToolCallCompletion([
      { id: 'call_1', name: 'get_weather', arguments: '{"city":"Beijing"}' },
    ])

    const finalResponse = createMockChatCompletion({
      choices: [{
        finish_reason: 'stop',
        index: 0,
        message: {
          content: 'The weather in Beijing is sunny.',
          reasoning_content: null,
          tool_calls: [],
          role: 'assistant',
        },
        logprobs: null,
      }],
    })

    createSequentialFetchMock([
      { data: toolCallResponse },
      { data: finalResponse },
    ])

    const model = new DeepSeekModel({ apiKey: MOCK_API_KEY, model: 'deepseek-v4-pro' })
    const agent = createAgent({ model, tools: [weatherTool] })

    const result = await agent.generate({
      messages: [{ role: 'user', content: 'What is the weather in Beijing?' }],
    })

    expect(result.text).toBe('The weather in Beijing is sunny.')
  })

  it('creates agent with structured output', async () => {
    const schema = z.object({ answer: z.string(), confidence: z.number() })

    const formatResponse = createMockChatCompletion({
      choices: [{
        finish_reason: 'stop',
        index: 0,
        message: {
          content: '{"answer":"42","confidence":0.95}',
          reasoning_content: null,
          tool_calls: [],
          role: 'assistant',
        },
        logprobs: null,
      }],
    })

    mockChatCompletion(formatResponse)

    const model = new DeepSeekModel({ apiKey: MOCK_API_KEY, model: 'deepseek-v4-pro' })
    const agent = createAgent({ model, output: { schema } })

    const result = await agent.generate({
      messages: [{ role: 'user', content: 'What is the answer?' }],
    })

    expect(result.output).toEqual({ answer: '42', confidence: 0.95 })
  })

  it('creates agent with system prompt', async () => {
    mockChatCompletion()

    const model = new DeepSeekModel({ apiKey: MOCK_API_KEY, model: 'deepseek-v4-pro' })
    const agent = createAgent({ model, system: 'You are a helpful assistant' })

    const result = await agent.generate({
      messages: [{ role: 'user', content: 'Hello' }],
    })

    expect(result.text).toBeDefined()

    const call = (fetch as any).mock.calls[0]
    const body = JSON.parse(call[1].body)
    const systemMsg = body.messages.find((m: any) => m.role === 'system')
    expect(systemMsg.content).toBe('You are a helpful assistant')
  })
})

describe('full pipeline: model -> generateText -> result', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('complete pipeline with thinking mode response', async () => {
    const thinkingResponse = createMockChatCompletion({
      choices: [{
        finish_reason: 'stop',
        index: 0,
        message: {
          content: 'The answer is 42.',
          reasoning_content: 'Let me think about this step by step...',
          tool_calls: [],
          role: 'assistant',
        },
        logprobs: null,
      }],
    })

    mockChatCompletion(thinkingResponse)

    const model = new DeepSeekModel({
      apiKey: MOCK_API_KEY,
      model: 'deepseek-v4-pro',
      thinking: { type: 'enabled' },
    })

    const result = await generateText({
      model,
      messages: [{ role: 'user', content: 'What is the meaning of life?' }],
    })

    expect(result.text).toBe('The answer is 42.')
  })

  it('complete pipeline with multi-turn conversation', async () => {
    mockChatCompletion()

    const model = new DeepSeekModel({ apiKey: MOCK_API_KEY, model: 'deepseek-v4-pro' })

    const result = await generateText({
      model,
      messages: [
        { role: 'system', content: 'You are a math tutor' },
        { role: 'user', content: 'What is 2+2?' },
        { role: 'assistant', content: '2+2 equals 4.' },
        { role: 'user', content: 'And 3+3?' },
      ],
    })

    expect(result.text).toBeDefined()
  })

  it('complete streaming pipeline', async () => {
    const chunks = createTextChunks('Hello World')
    mockFetchStream(chunks)

    const model = new DeepSeekModel({ apiKey: MOCK_API_KEY, model: 'deepseek-v4-pro' })

    const events: string[] = []
    for await (const event of generateStream({
      model,
      messages: [{ role: 'user', content: 'Say hello' }],
    })) {
      if (event.type === 'text-delta') {
        events.push(event.textDelta)
      }
    }

    expect(events.join('')).toBe('Hello World')
  })
})

describe('error handling E2E', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('handles API authentication error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: () => Promise.resolve({ error: { message: 'Invalid API key' } }),
      headers: new Headers(),
      clone() { return { json: () => Promise.resolve({ error: { message: 'Invalid API key' } }) } as any },
    }))

    const model = new DeepSeekModel({ apiKey: 'invalid-key', model: 'deepseek-v4-pro' })

    await expect(
      generateText({ model, messages: [{ role: 'user', content: 'Hello' }] }),
    ).rejects.toThrow('Invalid API key')
  })

  it('handles rate limiting with retry', async () => {
    let callCount = 0
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return Promise.resolve({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          json: () => Promise.resolve({ error: { message: 'Rate limited' } }),
          headers: new Headers({ 'Retry-After': '0' }),
          clone() { return { json: () => Promise.resolve({ error: { message: 'Rate limited' } }) } as any },
        })
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(createMockChatCompletion()),
        headers: new Headers(),
      })
    }))

    const model = new DeepSeekModel({ apiKey: MOCK_API_KEY, model: 'deepseek-v4-pro', maxRetries: 1 })

    const result = await generateText({ model, messages: [{ role: 'user', content: 'Hello' }] })
    expect(result.text).toBe('Hello! How can I help you today?')
  })

  it('handles network errors gracefully', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')))

    const model = new DeepSeekModel({ apiKey: MOCK_API_KEY, model: 'deepseek-v4-pro', maxRetries: 0 })

    await expect(
      generateText({ model, messages: [{ role: 'user', content: 'Hello' }] }),
    ).rejects.toThrow()
  })

  it('handles server errors (5xx)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: () => Promise.resolve({ error: { message: 'Internal server error' } }),
      headers: new Headers(),
      clone() { return { json: () => Promise.resolve({ error: { message: 'Internal server error' } }) } as any },
    }))

    const model = new DeepSeekModel({ apiKey: MOCK_API_KEY, model: 'deepseek-v4-pro', maxRetries: 0 })

    await expect(
      generateText({ model, messages: [{ role: 'user', content: 'Hello' }] }),
    ).rejects.toThrow('Internal server error')
  })
})
