export function getChatEndpoint(baseUrl: string): string {
  return new URL('chat/completions', baseUrl).toString()
}

export function getFimEndpoint(baseUrl: string): string {
  return `${baseUrl}/completions`
}
