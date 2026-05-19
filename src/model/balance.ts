import type { UserBalanceResponse } from './types'
import { getBalanceEndpoint } from '@/client/endpoints'
import { apiRequest } from '@/client/request'

export interface GetBalanceOptions {
  apiKey: string
  baseURL: string
  timeout: number
}

export async function getBalance(options: GetBalanceOptions): Promise<UserBalanceResponse> {
  const { apiKey, baseURL, timeout } = options || {}

  const url = getBalanceEndpoint(baseURL)
  return apiRequest<UserBalanceResponse>(url, apiKey, {}, timeout, 'GET')
}
