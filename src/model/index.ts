import type { InvokeParams, Model, ModelOptions } from './types'
import type { FIMParams } from '@/fim/types'
import process from 'node:process'
import { toMerged } from 'es-toolkit'
import { DEEPSEEK_API_BASE_URL, DEEPSEEK_API_BETA_MODE_BASE_URL, DEEPSEEK_MODELS } from '@/constants'
import { fim } from './fim'
import { invoke, invokeStream } from './invoke'
import 'dotenv/config'

export class DeepSeekModel {
  public readonly config: ModelOptions

  constructor(options: ModelOptions) {
    this.config = toMerged(
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

    if (!this.config.apiKey) {
      throw new Error('DEEPSEEK_API_KEY is required')
    }

    if (!this.config.model) {
      throw new Error(`model is required, available models: ${DEEPSEEK_MODELS.join(', ')}`)
    }
  }

  public invoke(params: InvokeParams) {
    return invoke(this.config, params)
  }

  public invokeStream(params: InvokeParams) {
    return invokeStream(this.config, params)
  }

  public fim(params: Omit<FIMParams, 'model'>) {
    this._enableBatchMode()
    return fim(this.config, params)
  }

  public _enableBatchMode() {
    this.config.baseURL = DEEPSEEK_API_BETA_MODE_BASE_URL
  }
}

export function createModel(options: ModelOptions): (model?: Model) => DeepSeekModel {
  return (model?: Model): DeepSeekModel => {
    return new DeepSeekModel({ ...options, model: model || options.model })
  }
}
