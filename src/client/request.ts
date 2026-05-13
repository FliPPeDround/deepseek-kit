export async function apiRequest<T>(
  url: string,
  apiKey: string,
  options: Record<string, any>,
  timeout?: number,
): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  }
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(options),
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
