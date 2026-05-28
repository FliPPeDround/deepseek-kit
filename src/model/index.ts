import type { GetBalanceOptions } from './balance'
import type { ListModelsOptions } from './list'
import type { InvokeParams, ModelOptions, ResolvedModelOptions } from './types'
import type { FIMParams } from '@/fim/types'
import process from 'node:process'
import { toMerged } from 'es-toolkit'
import { DEEPSEEK_API_BASE_URL, DEEPSEEK_MODELS } from '@/constants'
import { getBalance } from './balance'
import { fim } from './fim'
import { invoke, invokeStream } from './invoke'
import { listModels } from './list'
import 'dotenv/config'

export class DeepSeekModel {
  private readonly _config: ResolvedModelOptions

  constructor(options: ModelOptions) {
    this._config = resolveConfig(options)
    if (this._config.strict) {
      this.enableBeta()
    }
  }

  public get config(): ResolvedModelOptions {
    return this._config
  }

  public enableBeta(): this {
    const base = this._config.baseURL
    if (base.endsWith('/beta') || base.endsWith('/beta/')) {
      return this
    }
    this._config.baseURL = base.endsWith('/') ? `${base}beta/` : `${base}/beta/`
    return this
  }

  private tryEnableBeta(params: InvokeParams) {
    if (params.tools?.some(t => t.strict === true)) {
      this.enableBeta()
    }
  }

  public invoke(params: InvokeParams) {
    this.tryEnableBeta(params)
    return invoke(this._config, params)
  }

  public invokeStream(params: InvokeParams) {
    this.tryEnableBeta(params)
    return invokeStream(this._config, params)
  }

  public fim(params: Omit<FIMParams, 'model'>) {
    this.enableBeta()
    return fim(this._config, params)
  }

  public withConfig(options: Partial<ModelOptions>): DeepSeekModel {
    return new DeepSeekModel(toMerged(this._config, options) as ModelOptions)
  }

  public list(options?: Partial<ListModelsOptions>) {
    return listModels({ ...this._config, ...options })
  }

  public balance(options?: Partial<GetBalanceOptions>) {
    return getBalance({ ...this._config, ...options })
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
      strict: false,
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

export function createModel(options: ModelOptions): DeepSeekModel {
  return new DeepSeekModel(options)
}
