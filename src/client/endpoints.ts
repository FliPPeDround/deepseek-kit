export function chatEndpoint(baseUrl: string): string {
  return new URL('chat/completions', baseUrl).toString()
}
