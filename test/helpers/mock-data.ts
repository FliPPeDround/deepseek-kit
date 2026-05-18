import type { FIMResponse } from '@/fim/types'
import type { ChatCompletion, ChatCompletionChunk, ListModelsResponse, Usage, UserBalanceResponse } from '@/model/types'

export const MOCK_API_KEY = 'test-api-key-1234567890'

export function createMockUsage(overrides: Partial<Usage> = {}): Usage {
  return {
    completion_tokens: 10,
    prompt_tokens: 16,
    prompt_cache_hit_tokens: 8,
    prompt_cache_miss_tokens: 8,
    total_tokens: 26,
    completion_tokens_details: { reasoning_tokens: 5 },
    ...overrides,
  }
}

export function createMockChatCompletion(overrides: Partial<ChatCompletion> = {}): ChatCompletion {
  return {
    id: '930c60df-bf64-41c9-a88e-3ec75f81e00e',
    choices: [
      {
        finish_reason: 'stop',
        index: 0,
        message: {
          content: 'Hello! How can I help you today?',
          reasoning_content: null,
          tool_calls: [],
          role: 'assistant',
        },
        logprobs: null,
      },
    ],
    created: 1705651092,
    model: 'deepseek-v4-pro',
    system_fingerprint: 'fp_a49d71b8a1',
    object: 'chat.completion',
    usage: createMockUsage(),
    ...overrides,
  }
}

export function createMockToolCallCompletion(
  toolCalls: Array<{ id: string, name: string, arguments: string }>,
  overrides: Partial<ChatCompletion> = {},
): ChatCompletion {
  return createMockChatCompletion({
    choices: [
      {
        finish_reason: 'tool_calls',
        index: 0,
        message: {
          content: null,
          reasoning_content: null,
          tool_calls: toolCalls.map(tc => ({
            id: tc.id,
            type: 'function' as const,
            function: { name: tc.name, arguments: tc.arguments },
          })),
          role: 'assistant',
        },
        logprobs: null,
      },
    ],
    ...overrides,
  })
}

export function createMockThinkingCompletion(
  reasoningContent: string,
  content: string,
  overrides: Partial<ChatCompletion> = {},
): ChatCompletion {
  return createMockChatCompletion({
    choices: [
      {
        finish_reason: 'stop',
        index: 0,
        message: {
          content,
          reasoning_content: reasoningContent,
          tool_calls: [],
          role: 'assistant',
        },
        logprobs: null,
      },
    ],
    ...overrides,
  })
}

export function createMockChunk(overrides: Partial<ChatCompletionChunk> = {}): ChatCompletionChunk {
  return {
    id: '1f633d8bfc032625086f14113c411638',
    object: 'chat.completion.chunk',
    created: 1718345013,
    model: 'deepseek-v4-pro',
    choices: [
      {
        index: 0,
        delta: { role: 'assistant', content: '' },
        finish_reason: null,
      },
    ],
    ...overrides,
  }
}

export function createTextChunks(text: string, model = 'deepseek-v4-pro'): ChatCompletionChunk[] {
  const id = '1f633d8bfc032625086f14113c411638'
  const base = {
    id,
    object: 'chat.completion.chunk' as const,
    created: 1718345013,
    model,
  }

  const chunks: ChatCompletionChunk[] = [
    {
      ...base,
      choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }],
    },
  ]

  for (const char of text) {
    chunks.push({
      ...base,
      choices: [{ index: 0, delta: { content: char }, finish_reason: null }],
    })
  }

  chunks.push({
    ...base,
    choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
    usage: createMockUsage(),
  })

  return chunks
}

export function createToolCallChunks(
  toolCalls: Array<{ id: string, name: string, arguments: string }>,
  model = 'deepseek-v4-pro',
): ChatCompletionChunk[] {
  const id = '1f633d8bfc032625086f14113c411638'
  const base = {
    id,
    object: 'chat.completion.chunk' as const,
    created: 1718345013,
    model,
  }

  const chunks: ChatCompletionChunk[] = [
    {
      ...base,
      choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }],
    },
  ]

  for (const tc of toolCalls) {
    chunks.push({
      ...base,
      choices: [{
        index: 0,
        delta: {
          tool_calls: [{
            index: 0,
            id: tc.id,
            type: 'function' as const,
            function: { name: tc.name, arguments: tc.arguments },
          }],
        },
        finish_reason: null,
      }],
    })
  }

  chunks.push({
    ...base,
    choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }],
    usage: createMockUsage(),
  })

  return chunks
}

export function createMockListModelsResponse(overrides: Partial<ListModelsResponse> = {}): ListModelsResponse {
  return {
    object: 'list',
    data: [
      { id: 'deepseek-v4-flash', object: 'model', owned_by: 'deepseek' },
      { id: 'deepseek-v4-pro', object: 'model', owned_by: 'deepseek' },
    ],
    ...overrides,
  }
}

export function createMockBalanceResponse(overrides: Partial<UserBalanceResponse> = {}): UserBalanceResponse {
  return {
    is_available: true,
    balance_infos: [
      {
        currency: 'CNY',
        total_balance: '10.00',
        granted_balance: '5.00',
        topped_up_balance: '5.00',
      },
      {
        currency: 'USD',
        total_balance: '1.50',
        granted_balance: '0.75',
        topped_up_balance: '0.75',
      },
    ],
    ...overrides,
  }
}

export function createMockFIMResponse(overrides: Partial<FIMResponse> = {}): FIMResponse {
  return {
    id: 'cmpl-test-fim-id',
    choices: [
      {
        finish_reason: 'stop',
        index: 0,
        logprobs: null,
        text: 'completed code here',
      },
    ],
    created: 1718345013,
    model: 'deepseek-v4-flash',
    system_fingerprint: 'fp_test',
    object: 'text_completion',
    usage: {
      completion_tokens: 5,
      prompt_tokens: 10,
      prompt_cache_hit_tokens: 5,
      prompt_cache_miss_tokens: 5,
      total_tokens: 15,
      completion_tokens_details: { reasoning_tokens: 0 },
    },
    ...overrides,
  }
}

export function createMockErrorResponse(status: number, message: string, retryAfter?: number) {
  return {
    status,
    message,
    retryAfter,
  }
}
