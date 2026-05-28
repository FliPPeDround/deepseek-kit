import { z } from 'zod'
import { DEEPSEEK_API_BASE_URL } from '@/constants'
import { createModel, DeepSeekModel, resolveConfig } from '@/model'
import { tool } from '@/tool'
import { createMockChatCompletion, createMockToolCallCompletion, createTextChunks, createToolCallChunks, MOCK_API_KEY, mockBalance, mockChatCompletion, mockFetchStream, mockFIM, mockListModels } from '../helpers'

describe('deepSeekModel', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('constructor & resolveConfig', () => {
    it('resolves config with required fields', () => {
      const config = resolveConfig({
        apiKey: MOCK_API_KEY,
        model: 'deepseek-v4-pro',
      })

      expect(config.apiKey).toBe(MOCK_API_KEY)
      expect(config.model).toBe('deepseek-v4-pro')
      expect(config.baseURL).toBe(DEEPSEEK_API_BASE_URL)
      expect(config.thinking.type).toBe('enabled')
    })

    it('throws when apiKey is missing', () => {
      expect(() => resolveConfig({ model: 'deepseek-v4-pro' })).toThrow('DEEPSEEK_API_KEY is required')
    })

    it('throws when model is missing', () => {
      expect(() => resolveConfig({ apiKey: MOCK_API_KEY })).toThrow('model is required')
    })

    it('uses custom baseURL when provided', () => {
      const config = resolveConfig({
        apiKey: MOCK_API_KEY,
        model: 'deepseek-v4-pro',
        baseURL: 'https://custom.api.com',
      })
      expect(config.baseURL).toBe('https://custom.api.com')
    })

    it('defaults thinking to enabled', () => {
      const config = resolveConfig({ apiKey: MOCK_API_KEY, model: 'deepseek-v4-pro' })
      expect(config.thinking.type).toBe('enabled')
      expect(config.reasoningEffort).toBe('high')
    })

    it('omits reasoningEffort when thinking is disabled', () => {
      const config = resolveConfig({
        apiKey: MOCK_API_KEY,
        model: 'deepseek-v4-pro',
        thinking: { type: 'disabled' },
      })
      expect(config.reasoningEffort).toBeUndefined()
    })
  })

  describe('invoke', () => {
    it('sends chat completion request and returns response', async () => {
      mockChatCompletion()

      const model = new DeepSeekModel({ apiKey: MOCK_API_KEY, model: 'deepseek-v4-pro' })
      const result = await model.invoke({
        messages: [{ role: 'user', content: 'Hello' }],
      })

      expect(result.object).toBe('chat.completion')
      expect(result.choices[0].message.content).toBe('Hello! How can I help you today?')
      expect(result.choices[0].message.role).toBe('assistant')
    })

    it('sends request with tools and receives tool calls', async () => {
      const toolCallResponse = createMockToolCallCompletion([
        { id: 'call_1', name: 'get_weather', arguments: '{"city":"Beijing"}' },
      ])
      mockChatCompletion(toolCallResponse)

      const model = new DeepSeekModel({ apiKey: MOCK_API_KEY, model: 'deepseek-v4-pro' })
      const result = await model.invoke({
        messages: [{ role: 'user', content: 'What is the weather?' }],
        tools: [],
      })

      expect(result.choices[0].finish_reason).toBe('tool_calls')
      expect(result.choices[0].message.tool_calls).toHaveLength(1)
    })

    it('sends request with JSON response format', async () => {
      mockChatCompletion(createMockChatCompletion({
        choices: [{
          finish_reason: 'stop',
          index: 0,
          message: {
            content: '{"answer": "42"}',
            reasoning_content: null,
            tool_calls: [],
            role: 'assistant',
          },
          logprobs: null,
        }],
      }))

      const model = new DeepSeekModel({ apiKey: MOCK_API_KEY, model: 'deepseek-v4-pro' })
      const result = await model.invoke({
        messages: [{ role: 'user', content: 'Answer in JSON' }],
        response_format: { type: 'json_object' },
      })

      expect(result.choices[0].message.content).toBe('{"answer": "42"}')
    })

    it('uses beta endpoint when strict tool is present', async () => {
      mockChatCompletion()

      const strictTool = tool({
        name: 'get_weather',
        description: 'Get weather',
        strict: true,
        schema: z.object({ city: z.string() }),
        execute: async ({ city }) => city,
      })

      const model = new DeepSeekModel({ apiKey: MOCK_API_KEY, model: 'deepseek-v4-pro' })
      await model.invoke({
        messages: [{ role: 'user', content: 'Hello' }],
        tools: [strictTool],
      })

      const calledUrl = (fetch as any).mock.calls[0][0] as string
      expect(calledUrl).toContain('/beta/')
    })

    it('uses standard endpoint when no strict tool is present', async () => {
      mockChatCompletion()

      const normalTool = tool({
        name: 'get_weather',
        description: 'Get weather',
        schema: z.object({ city: z.string() }),
        execute: async ({ city }) => city,
      })

      const model = new DeepSeekModel({ apiKey: MOCK_API_KEY, model: 'deepseek-v4-pro' })
      await model.invoke({
        messages: [{ role: 'user', content: 'Hello' }],
        tools: [normalTool],
      })

      const calledUrl = (fetch as any).mock.calls[0][0] as string
      expect(calledUrl).not.toContain('/beta/')
    })

    it('uses beta endpoint when model strict=true', async () => {
      mockChatCompletion()

      const normalTool = tool({
        name: 'get_weather',
        description: 'Get weather',
        schema: z.object({ city: z.string() }),
        execute: async ({ city }) => city,
      })

      const model = new DeepSeekModel({ apiKey: MOCK_API_KEY, model: 'deepseek-v4-pro', strict: true })
      await model.invoke({
        messages: [{ role: 'user', content: 'Hello' }],
        tools: [normalTool],
      })

      const calledUrl = (fetch as any).mock.calls[0][0] as string
      expect(calledUrl).toContain('/beta/')

      const body = JSON.parse((fetch as any).mock.calls[0][1].body)
      expect(body.tools[0].function.strict).toBe(true)
    })

    it('throws when mixing strict and non-strict tools without model strict', async () => {
      mockChatCompletion()

      const strictTool = tool({
        name: 'strict_tool',
        description: 'Strict',
        strict: true,
        schema: z.object({ city: z.string() }),
        execute: async ({ city }) => city,
      })
      const normalTool = tool({
        name: 'normal_tool',
        description: 'Normal',
        schema: z.object({ city: z.string() }),
        execute: async ({ city }) => city,
      })

      const model = new DeepSeekModel({ apiKey: MOCK_API_KEY, model: 'deepseek-v4-pro' })
      await expect(
        model.invoke({
          messages: [{ role: 'user', content: 'Hello' }],
          tools: [strictTool, normalTool],
        }),
      ).rejects.toThrow('When using strict mode, all tools must have strict: true')
    })

    it('does not throw when mixing with model strict=true', async () => {
      mockChatCompletion()

      const strictTool = tool({
        name: 'strict_tool',
        description: 'Strict',
        strict: true,
        schema: z.object({ city: z.string() }),
        execute: async ({ city }) => city,
      })
      const normalTool = tool({
        name: 'normal_tool',
        description: 'Normal',
        schema: z.object({ city: z.string() }),
        execute: async ({ city }) => city,
      })

      const model = new DeepSeekModel({ apiKey: MOCK_API_KEY, model: 'deepseek-v4-pro', strict: true })
      await model.invoke({
        messages: [{ role: 'user', content: 'Hello' }],
        tools: [strictTool, normalTool],
      })

      expect(fetch).toHaveBeenCalled()
    })
  })

  describe('invokeStream', () => {
    it('yields chunks from streaming response', async () => {
      const chunks = createTextChunks('Hello')
      mockFetchStream(chunks)

      const model = new DeepSeekModel({ apiKey: MOCK_API_KEY, model: 'deepseek-v4-pro' })
      const stream = model.invokeStream({
        messages: [{ role: 'user', content: 'Hello' }],
      })

      const received: string[] = []
      for await (const chunk of stream) {
        if (chunk.choices[0]?.delta?.content) {
          received.push(chunk.choices[0].delta.content)
        }
      }

      expect(received).toEqual(['H', 'e', 'l', 'l', 'o'])
    })

    it('yields tool call chunks from streaming response', async () => {
      const chunks = createToolCallChunks([
        { id: 'call_1', name: 'get_weather', arguments: '{"city":"Beijing"}' },
      ])
      mockFetchStream(chunks)

      const model = new DeepSeekModel({ apiKey: MOCK_API_KEY, model: 'deepseek-v4-pro' })
      const stream = model.invokeStream({
        messages: [{ role: 'user', content: 'Weather?' }],
      })

      const allChunks = []
      for await (const chunk of stream) {
        allChunks.push(chunk)
      }

      const toolCallChunk = allChunks.find(c => c.choices[0]?.delta?.tool_calls)
      expect(toolCallChunk).toBeDefined()
      const tc = toolCallChunk!.choices[0]!.delta.tool_calls![0]
      expect(tc.function?.name).toBe('get_weather')
    })
  })

  describe('fim', () => {
    it('calls FIM endpoint and returns response', async () => {
      mockFIM()

      const model = new DeepSeekModel({ apiKey: MOCK_API_KEY, model: 'deepseek-v4-flash' })
      const result = await model.fim({ prompt: 'function hello(' })

      expect(result.object).toBe('text_completion')
      expect(result.choices[0].text).toBe('completed code here')
    })

    it('uses beta endpoint for FIM', async () => {
      mockFIM()

      const model = new DeepSeekModel({ apiKey: MOCK_API_KEY, model: 'deepseek-v4-flash' })
      await model.fim({ prompt: 'function hello(' })

      const calledUrl = (fetch as any).mock.calls[0][0] as string
      expect(calledUrl).toContain('/beta/')
    })
  })

  describe('enableBeta', () => {
    it('appends /beta/ to baseURL', () => {
      const model = new DeepSeekModel({ apiKey: MOCK_API_KEY, model: 'deepseek-v4-pro' })
      model.enableBeta()
      expect(model.config.baseURL).toBe('https://api.deepseek.com/beta/')
    })

    it('is idempotent', () => {
      const model = new DeepSeekModel({ apiKey: MOCK_API_KEY, model: 'deepseek-v4-pro' })
      model.enableBeta()
      model.enableBeta()
      expect(model.config.baseURL).toBe('https://api.deepseek.com/beta/')
    })

    it('returns this for chaining', () => {
      const model = new DeepSeekModel({ apiKey: MOCK_API_KEY, model: 'deepseek-v4-pro' })
      const result = model.enableBeta()
      expect(result).toBe(model)
    })

    it('handles baseURL with trailing slash', () => {
      const model = new DeepSeekModel({ apiKey: MOCK_API_KEY, model: 'deepseek-v4-pro', baseURL: 'https://custom.api.com/' })
      model.enableBeta()
      expect(model.config.baseURL).toBe('https://custom.api.com/beta/')
    })

    it('handles baseURL without trailing slash', () => {
      const model = new DeepSeekModel({ apiKey: MOCK_API_KEY, model: 'deepseek-v4-pro', baseURL: 'https://custom.api.com' })
      model.enableBeta()
      expect(model.config.baseURL).toBe('https://custom.api.com/beta/')
    })

    it('is automatically called when strict=true', () => {
      const model = new DeepSeekModel({ apiKey: MOCK_API_KEY, model: 'deepseek-v4-pro', strict: true })
      expect(model.config.baseURL).toContain('/beta/')
    })
  })

  describe('withConfig', () => {
    it('creates new model with merged config', () => {
      const model = new DeepSeekModel({ apiKey: MOCK_API_KEY, model: 'deepseek-v4-pro' })
      const newModel = model.withConfig({ temperature: 0.5 })

      expect(newModel.config.temperature).toBe(0.5)
      expect(newModel.config.model).toBe('deepseek-v4-pro')
      expect(newModel).not.toBe(model)
    })

    it('switches model via withConfig', () => {
      const model = createModel({ apiKey: MOCK_API_KEY, model: 'deepseek-v4-pro' })
      const flashModel = model.withConfig({ model: 'deepseek-v4-flash' })

      expect(flashModel.config.model).toBe('deepseek-v4-flash')
      expect(flashModel.config.apiKey).toBe(MOCK_API_KEY)
      expect(flashModel).not.toBe(model)
    })
  })

  describe('createModel', () => {
    it('creates a DeepSeekModel instance with required model', () => {
      const model = createModel({ apiKey: MOCK_API_KEY, model: 'deepseek-v4-pro' })

      expect(model).toBeInstanceOf(DeepSeekModel)
      expect(model.config.model).toBe('deepseek-v4-pro')
      expect(model.config.apiKey).toBe(MOCK_API_KEY)
    })

    it('creates model with additional options', () => {
      const model = createModel({
        apiKey: MOCK_API_KEY,
        model: 'deepseek-v4-flash',
        temperature: 0.7,
        thinking: { type: 'disabled' },
      })

      expect(model.config.model).toBe('deepseek-v4-flash')
      expect(model.config.temperature).toBe(0.7)
      expect(model.config.thinking.type).toBe('disabled')
    })
  })

  describe('instance methods: list & balance', () => {
    it('listModels returns model list', async () => {
      mockListModels()

      const model = new DeepSeekModel({ apiKey: MOCK_API_KEY, model: 'deepseek-v4-pro' })
      const result = await model.list()
      expect(result.object).toBe('list')
      expect(result.data.length).toBeGreaterThanOrEqual(2)
    })

    it('balance returns balance info', async () => {
      mockBalance()

      const model = new DeepSeekModel({ apiKey: MOCK_API_KEY, model: 'deepseek-v4-pro' })
      const result = await model.balance()
      expect(result.is_available).toBe(true)
      expect(result.balance_infos.length).toBeGreaterThan(0)
    })
  })
})
