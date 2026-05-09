import type { DeepSeekModel, InvokeParams, ModelOptions } from './types'
import process from 'node:process'
import { toMerged } from 'es-toolkit'
import { DEEPSEEK_API_BASE_URL, DEEPSEEK_MODELS } from '@/constants'
import { invoke } from './invoke'
import 'dotenv/config'

export function createModel(options: ModelOptions): DeepSeekModel {
  const config = toMerged(
    {
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: process.env.DEEPSEEK_API_BASE_URL || DEEPSEEK_API_BASE_URL,
      thinking: {
        type: 'enabled',
      },
      reasoningEffort: options.thinking?.type === 'disabled' ? undefined : 'high',
    },
    options,
  )

  if (!config.apiKey) {
    throw new Error('DEEPSEEK_API_KEY is required')
  }

  if (!config.model) {
    throw new Error(`model is required, available models: ${DEEPSEEK_MODELS.join(', ')}`)
  }

  return {
    config,
    invoke(params: InvokeParams) {
      return invoke(config, params)
    },
  }
}
