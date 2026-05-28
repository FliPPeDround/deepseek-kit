import { getBalanceEndpoint, getChatEndpoint, getFimEndpoint, getModelsEndpoint } from '@/client/endpoints'

describe('getChatEndpoint', () => {
  it.each([
    ['https://api.deepseek.com', 'https://api.deepseek.com/chat/completions'],
    ['https://api.deepseek.com/', 'https://api.deepseek.com/chat/completions'],
    ['https://custom.api.com', 'https://custom.api.com/chat/completions'],
  ])('builds chat endpoint from base URL %s', (baseUrl, expected) => {
    expect(getChatEndpoint(baseUrl)).toBe(expected)
  })
})

describe('getFimEndpoint', () => {
  it.each([
    ['https://api.deepseek.com', 'https://api.deepseek.com/completions'],
    ['https://api.deepseek.com/', 'https://api.deepseek.com/completions'],
    ['https://api.deepseek.com/beta/', 'https://api.deepseek.com/beta/completions'],
  ])('builds FIM endpoint from base URL %s', (baseUrl, expected) => {
    expect(getFimEndpoint(baseUrl)).toBe(expected)
  })
})

describe('getModelsEndpoint', () => {
  it.each([
    ['https://api.deepseek.com', 'https://api.deepseek.com/models'],
    ['https://api.deepseek.com/', 'https://api.deepseek.com/models'],
  ])('builds models endpoint from base URL %s', (baseUrl, expected) => {
    expect(getModelsEndpoint(baseUrl)).toBe(expected)
  })
})

describe('getBalanceEndpoint', () => {
  it.each([
    ['https://api.deepseek.com', 'https://api.deepseek.com/user/balance'],
    ['https://api.deepseek.com/', 'https://api.deepseek.com/user/balance'],
  ])('builds balance endpoint from base URL %s', (baseUrl, expected) => {
    expect(getBalanceEndpoint(baseUrl)).toBe(expected)
  })
})
