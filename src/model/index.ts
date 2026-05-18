import type { GetBalanceOptions } from './balance'
import type { ListModelsOptions } from './list'
import type { InvokeParams, Model, ModelOptions, ResolvedModelOptions } from './types'
import type { FIMParams } from '@/fim/types'
import process from 'node:process'
import { toMerged } from 'es-toolkit'
import { DEEPSEEK_API_BASE_URL, DEEPSEEK_API_BETA_MODE_BASE_URL, DEEPSEEK_MODELS } from '@/constants'
import { getBalance } from './balance'
import { fim } from './fim'
import { invoke, invokeStream } from './invoke'
import { listModels } from './list'
import 'dotenv/config'

export class DeepSeekModel {
  private readonly _config: ResolvedModelOptions

  constructor(options: ModelOptions) {
    this._config = resolveConfig(options)
  }

  public get config(): ResolvedModelOptions {
    return this._config
  }

  public invoke(params: InvokeParams) {
    return invoke(this._config, params)
  }

  public invokeStream(params: InvokeParams) {
    return invokeStream(this._config, params)
  }

  public fim(params: Omit<FIMParams, 'model'>) {
    const batchConfig = {
      ...this._config,
      baseURL: DEEPSEEK_API_BETA_MODE_BASE_URL,
    }
    return fim(batchConfig, params)
  }

  public withConfig(options: Partial<ModelOptions>): DeepSeekModel {
    return new DeepSeekModel(toMerged(this._config, options) as ModelOptions)
  }

  public static list(options?: ListModelsOptions) {
    return listModels(options)
  }

  public static balance(options?: GetBalanceOptions) {
    return getBalance(options)
  }
}

export function resolveConfig(options: ModelOptions): ResolvedModelOptions {
  const resolved = toMerged(
    {
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: process.env.DEEPSEEK_API_BASE_URL || DEEPSEEK_API_BASE_URL,
      thinking: {
        type: 'enabled',
      },
      reasoningEffort: options.thinking?.type === 'disabled' ? undefined : 'high',
    },
    options,
  ) as ResolvedModelOptions

  if (!resolved.apiKey) {
    throw new Error('DEEPSEEK_API_KEY is required')
  }

  if (!resolved.model) {
    throw new Error(`model is required, available models: ${DEEPSEEK_MODELS.join(', ')}`)
  }

  return resolved
}

export function createModel(options?: ModelOptions) {
  return (model?: Model) => new DeepSeekModel({
    ...options,
    model: model || options?.model,
  })
}
