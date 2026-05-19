import type { ListModelsResponse } from './types'
import { getModelsEndpoint } from '@/client/endpoints'
import { apiRequest } from '@/client/request'

export interface ListModelsOptions {
  apiKey: string
  baseURL: string
  timeout: number
}

export async function listModels(options: ListModelsOptions): Promise<ListModelsResponse> {
  const { apiKey, baseURL, timeout } = options || {}

  const url = getModelsEndpoint(baseURL)
  return await apiRequest<ListModelsResponse>(url, apiKey, {}, timeout, 'GET')
}
