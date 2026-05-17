export function getChatEndpoint(baseUrl: string): string {
  return new URL('chat/completions', baseUrl).toString()
}

export function getFimEndpoint(baseUrl: string): string {
  return `${baseUrl}/completions`
}

export function getModelsEndpoint(baseUrl: string): string {
  return new URL('models', baseUrl).toString()
}

export function getBalanceEndpoint(baseUrl: string): string {
  return new URL('user/balance', baseUrl).toString()
}
