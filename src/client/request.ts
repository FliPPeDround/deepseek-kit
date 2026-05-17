export async function apiRequest<T>(
  url: string,
  apiKey: string,
  options: Record<string, any>,
  timeout?: number,
  method: 'GET' | 'POST' = 'POST',
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    Authorization: `Bearer ${apiKey}`,
  }

  if (method === 'POST') {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(url, {
    method,
    headers,
    body: method === 'POST' ? JSON.stringify(options) : undefined,
    signal: timeout ? AbortSignal.timeout(timeout) : undefined,
  })
  if (!response.ok) {
    let errorMessage = response.statusText
    try {
      const body = await response.json() as { error?: { message?: string } }
      errorMessage = body?.error?.message || errorMessage
    }
    catch {
      // Response body is not JSON, use statusText
    }
    throw new Error(`DeepSeek API error ${response.status}: ${errorMessage}`)
  }
  return await response.json() as T
}
