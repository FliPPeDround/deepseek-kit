import type { UserBalanceResponse } from './types'
import process from 'node:process'
import { getBalanceEndpoint } from '@/client/endpoints'
import { apiRequest } from '@/client/request'
import { DEEPSEEK_API_BASE_URL } from '@/constants'
import 'dotenv/config'

export interface GetBalanceOptions {
  apiKey?: string
  baseURL?: string
  timeout?: number
}

export async function getBalance(options?: GetBalanceOptions): Promise<UserBalanceResponse> {
  const apiKey = options?.apiKey || process.env.DEEPSEEK_API_KEY
  const baseURL = options?.baseURL || process.env.DEEPSEEK_API_BASE_URL || DEEPSEEK_API_BASE_URL
  const timeout = options?.timeout ?? 60000

  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY is required')
  }

  const url = getBalanceEndpoint(baseURL)
  return apiRequest<UserBalanceResponse>(url, apiKey, {}, timeout, 'GET')
}
