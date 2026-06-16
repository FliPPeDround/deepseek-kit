import type { ConsistentTools, NonStrictTool, StrictTool, StrictToolDefinition, ToolCall, ToolChoice, ToolDefinition, Tool as ToolType } from './types'
import type { HookRunner } from '@/generate/generate-utils'
import type { GenerateTextHooks } from '@/generate/types'
import type { ResolvedModelOptions, Usage } from '@/model/types'
import { z } from 'zod'
import { createCompactTool } from '@/context/compact'
import { mergeUsage } from '@/generate/generate-utils'
import { parseAndValidate } from '@/utils/json-parse'

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<T> {
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError')
  }

  let timeoutId: NodeJS.Timeout | undefined
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Tool execution timed out after ${timeoutMs}ms`))
    }, timeoutMs)
  })

  let rejectAbort!: (reason: unknown) => void
  const abortPromise = new Promise<T>((_, reject) => {
    rejectAbort = reject
  })

  const onAbort = () => {
    clearTimeout(timeoutId)
    rejectAbort(new DOMException('Aborted', 'AbortError'))
  }

  signal?.addEventListener('abort', onAbort, { once: true })

  try {
    return await Promise.race([promise, timeoutPromise, abortPromise])
  }
  finally {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    signal?.removeEventListener('abort', onAbort)
  }
}

async function withRetries<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  timeoutMs?: number,
  signal?: AbortSignal,
): Promise<T> {
  let lastError: Error | undefined
  for (let i = 0; i <= maxRetries; i++) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }
    try {
      if (timeoutMs) {
        return await withTimeout(fn(), timeoutMs, signal)
      }
      return await fn()
    }
    catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw err
      }
      lastError = err instanceof Error ? err : new Error(String(err))
      if (i === maxRetries) {
        throw lastError
      }
    }
  }
  throw lastError
}

export function serializeResult(result: unknown): string {
  if (typeof result === 'string') {
    return result
  }
  if (result === null || result === undefined) {
    return String(result)
  }
  try {
    return JSON.stringify(result)
  }
  catch {
    return String(result)
  }
}

export function tool<T extends z.ZodObject>(config: StrictToolDefinition<T>): StrictTool
export function tool<T extends z.ZodObject>(config: ToolDefinition<T, false | undefined>): NonStrictTool
export function tool(config: any) {
  const { schema, execute, compact, name, description, timeout = 60000, retries = 0 } = config
  const jsonSchema = z.toJSONSchema(schema)

  const wrappedExecute = async (args: string, signal?: AbortSignal, runner?: HookRunner, hooks?: GenerateTextHooks, modelConfig?: ResolvedModelOptions): Promise<string> => {
    const result = await parseAndValidate(args, schema)

    if (!result.success) {
      if (result.type === 'schema_validation_error') {
        const messages = result.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ')
        return JSON.stringify({ success: false, error: `Invalid arguments: ${messages}` })
      }
      return JSON.stringify({ success: false, error: `Failed to parse arguments: ${result.error.message}` })
    }

    try {
      let extraUsage: Usage | undefined
      const addUsage = (usage: Usage) => {
        if (extraUsage) {
          mergeUsage(extraUsage, usage)
        }
        else {
          extraUsage = { ...usage, completion_tokens_details: { reasoning_tokens: usage.completion_tokens_details?.reasoning_tokens ?? 0 } }
        }
      }

      const execResult = await withRetries(
        async () => execute(result.data, { modelConfig, signal, addUsage }),
        retries,
        timeout,
        signal,
      )
      let data = serializeResult(execResult)
      if (compact) {
        try {
          const toolCompactConfig = typeof compact === 'object'
            ? compact
            : undefined
          const ct = createCompactTool(toolCompactConfig)

          if (runner && hooks) {
            runner.runBeforeToolCompact(hooks, {
              toolName: name,
              toolDescription: description,
              content: data,
              threshold: ct.threshold,
            })

            if (runner.stopped) {
              return JSON.stringify({ success: true, data, usage: extraUsage })
            }

            if (runner.skipped) {
              runner.resetSkip()
            }
            else {
              const contentBefore = data
              data = await ct.compact(data, name, description, signal)
              runner.runAfterToolCompact(hooks, {
                toolName: name,
                toolDescription: description,
                contentBefore,
                contentAfter: data,
                threshold: ct.threshold,
              })
            }
          }
          else {
            data = await ct.compact(data, name, description, signal)
          }
        }
        catch {
          // compact failure should not affect the tool result
        }
      }
      return JSON.stringify({ success: true, data, usage: extraUsage })
    }
    catch (err) {
      return JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) })
    }
  }

  return {
    ...config,
    parameters: jsonSchema,
    execute: (args: string, signal?: AbortSignal, runner?: HookRunner, hooks?: GenerateTextHooks, modelConfig?: ResolvedModelOptions) => wrappedExecute(args, signal, runner, hooks, modelConfig),
  }
}

export type Tool = ToolType
export type { ConsistentTools, NonStrictTool, StrictTool }
export { webSearch } from './web-search'

export function validateToolConsistency(tools: Tool[]): void {
  const strictCount = tools.filter(t => t.strict === true).length
  if (strictCount > 0 && strictCount < tools.length) {
    throw new Error(
      'When using strict mode, all tools must have strict: true. '
      + 'Either set strict: true on all tools, or use createModel({ strict: true }) to enable strict mode globally.',
    )
  }
}

export function buildToolParameters(tools: Tool[], modelStrict?: boolean) {
  if (tools.length === 0) {
    return {
      toolParameters: undefined,
      toolChoice: undefined,
    }
  }
  const useStrict = modelStrict || tools.some(t => t.strict === true)
  const toolParameters: ToolCall[] = []
  let toolChoice: ToolChoice | undefined
  const requiredTools: string[] = []
  for (const t of tools) {
    toolParameters.push({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        ...(useStrict ? { strict: true } : {}),
        parameters: t.parameters,
      },
    })
    if (t.required) {
      requiredTools.push(t.name)
    }
  }
  if (requiredTools.length === 1) {
    toolChoice = {
      type: 'function',
      function: { name: requiredTools[0] },
    }
  }
  else if (requiredTools.length > 1) {
    toolChoice = 'required'
  }
  return {
    toolParameters: toolParameters.length > 0 ? toolParameters : undefined,
    toolChoice,
  }
}
