export async function request<T>(
  url: string,
  apiKey: string,
  options: Record<string, any>,
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
  })
  if (!response.ok) {
    const { error } = (await response.json()) as { error: { message: string } }
    const errorMessage = error?.message || response.statusText
    throw new Error(`DeepSeek API error ${response.status}: ${errorMessage}`)
  }
  return await response.json() as T
}
