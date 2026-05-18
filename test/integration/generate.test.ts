import { z } from 'zod'
import { AgentError } from '@/errors'
import { generateStream } from '@/generate/generate-stream'
import { generateText } from '@/generate/generate-text'
import { DeepSeekModel } from '@/model'
import { tool } from '@/tool'
import { createMockChatCompletion, createMockToolCallCompletion, createSequentialFetchMock, createTextChunks, createToolCallChunks, MOCK_API_KEY, mockChatCompletion, mockFetchStream } from '../helpers'

describe('generateText', () => {
  let model: DeepSeekModel

  beforeEach(() => {
    model = new DeepSeekModel({ apiKey: MOCK_API_KEY, model: 'deepseek-v4-pro' })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns text from simple completion', async () => {
    mockChatCompletion()

    const result = await generateText({
      model,
      messages: [{ role: 'user', content: 'Hello' }],
    })

    expect(result.text).toBe('Hello! How can I help you today?')
    expect(result.usage).toBeDefined()
  })

  it('returns text from prompt parameter', async () => {
    mockChatCompletion()

    const result = await generateText({
      model,
      messages: [],
      prompt: 'Hello',
    })

    expect(result.text).toBe('Hello! How can I help you today?')
  })

  it('executes tool calls and continues loop', async () => {
    const weatherTool = tool({
      name: 'get_weather',
      description: 'Get weather',
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

    const result = await generateText({
      model,
      messages: [{ role: 'user', content: 'Weather in Beijing?' }],
      tools: [weatherTool],
    })

    expect(result.text).toBe('The weather in Beijing is sunny.')
  })

  it('respects maxSteps limit', async () => {
    const alwaysToolCall = createMockToolCallCompletion([
      { id: 'call_1', name: 'loop_tool', arguments: '{}' },
    ])

    mockChatCompletion(alwaysToolCall)

    const loopTool = tool({
      name: 'loop_tool',
      description: 'Loops',
      schema: z.object({}),
      execute: async () => 'continue',
    })

    await expect(
      generateText({
        model,
        messages: [{ role: 'user', content: 'Loop' }],
        tools: [loopTool],
        maxSteps: 2,
      }),
    ).rejects.toThrow(AgentError)
  })

  it('handles hooks - beforeStep modifies config', async () => {
    mockChatCompletion()

    const result = await generateText({
      model,
      messages: [{ role: 'user', content: 'Hello' }],
      hooks: {
        beforeStep: ({ step }) => {
          if (step === 1) {
            return { config: { temperature: 0.5 } }
          }
        },
      },
    })

    expect(result.text).toBe('Hello! How can I help you today?')
  })

  it('handles hooks - afterStep receives step event', async () => {
    mockChatCompletion()

    const events: string[] = []
    await generateText({
      model,
      messages: [{ role: 'user', content: 'Hello' }],
      hooks: {
        afterStep: (event) => {
          events.push(event.type)
        },
      },
    })

    expect(events).toContain('text')
  })

  it('handles hooks - stop from hookCtx', async () => {
    mockChatCompletion()

    const result = await generateText({
      model,
      messages: [{ role: 'user', content: 'Hello' }],
      hooks: {
        afterStep: (_event, ctx) => {
          ctx.stop()
        },
      },
    })

    expect(result.text).toBeDefined()
  })

  it('handles onError hook', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))

    const result = await generateText({
      model,
      messages: [{ role: 'user', content: 'Hello' }],
      hooks: {
        onError: (_error, ctx) => {
          ctx.stop()
        },
      },
    })

    expect(result).toBeDefined()
  })

  it('throws when no prompt or messages provided', async () => {
    await expect(
      generateText({ model, messages: [] } as any),
    ).rejects.toThrow()
  })
})

describe('generateStream', () => {
  let model: DeepSeekModel

  beforeEach(() => {
    model = new DeepSeekModel({ apiKey: MOCK_API_KEY, model: 'deepseek-v4-pro' })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('yields text-delta events', async () => {
    const chunks = createTextChunks('Hi')
    mockFetchStream(chunks)

    const events: string[] = []
    for await (const event of generateStream({ model, messages: [{ role: 'user', content: 'Hello' }] })) {
      if (event.type === 'text-delta') {
        events.push(event.textDelta)
      }
    }

    expect(events).toEqual(['H', 'i'])
  })

  it('yields step events', async () => {
    const chunks = createTextChunks('Hi')
    mockFetchStream(chunks)

    const stepEvents: number[] = []
    for await (const event of generateStream({ model, messages: [{ role: 'user', content: 'Hello' }] })) {
      if (event.type === 'step') {
        stepEvents.push(event.step)
      }
    }

    expect(stepEvents.length).toBeGreaterThan(0)
  })

  it('yields tool-call events for streaming tool calls', async () => {
    const toolChunks = createToolCallChunks([
      { id: 'call_1', name: 'get_weather', arguments: '{"city":"Beijing"}' },
    ])
    mockFetchStream(toolChunks)

    const weatherTool = tool({
      name: 'get_weather',
      description: 'Get weather',
      schema: z.object({ city: z.string() }),
      execute: async ({ city }) => `Sunny in ${city}`,
    })

    const finalChunks = createTextChunks('Sunny in Beijing')
    let callCount = 0
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        const encoder = new TextEncoder()
        const stream = new ReadableStream({
          pull(controller) {
            for (const chunk of toolChunks) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`))
            }
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()
          },
        })
        return Promise.resolve({ ok: true, status: 200, body: stream, headers: new Headers() })
      }
      else {
        const encoder = new TextEncoder()
        const stream = new ReadableStream({
          pull(controller) {
            for (const chunk of finalChunks) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`))
            }
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()
          },
        })
        return Promise.resolve({ ok: true, status: 200, body: stream, headers: new Headers() })
      }
    }))

    const toolCallEvents: any[] = []
    for await (const event of generateStream({
      model,
      messages: [{ role: 'user', content: 'Weather?' }],
      tools: [weatherTool],
    })) {
      if (event.type === 'tool-call') {
        toolCallEvents.push(event)
      }
    }

    expect(toolCallEvents.length).toBeGreaterThan(0)
    expect(toolCallEvents[0].toolCalls[0].function.name).toBe('get_weather')
  })
})
