export function getChatEndpoint(baseUrl: string): string {
  return new URL('chat/completions', baseUrl).toString()
}
