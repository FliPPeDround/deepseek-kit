import { ApiRequestError, handleErrorResponse } from './errors'

export async function apiRequest<T>(
  url: string,
  apiKey: string,
  options: Record<string, any>,
  timeout?: number,
  method: 'GET' | 'POST' = 'POST',
  signal?: AbortSignal,
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    Authorization: `Bearer ${apiKey}`,
  }

  if (method === 'POST') {
    headers['Content-Type'] = 'application/json'
  }

  const timeoutSignal = timeout ? AbortSignal.timeout(timeout) : undefined
  const combinedSignal = signal && timeoutSignal
    ? AbortSignal.any([signal, timeoutSignal])
    : (signal || timeoutSignal)

  const response = await fetch(url, {
    method,
    headers,
    body: method === 'POST' ? JSON.stringify(options) : undefined,
    signal: combinedSignal,
  })

  if (!response.ok) {
    throw new ApiRequestError(await handleErrorResponse(response))
  }

  return await response.json() as T
}
