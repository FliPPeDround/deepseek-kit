import type { ToolCall, ToolChoice, ToolDefinition } from './types'
import { z } from 'zod'
import { createCompactTool } from '@/context/compact'
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

export function tool<T extends z.ZodObject>(config: ToolDefinition<T>) {
  const { schema, execute, compact, name, description, timeout = 60000, retries = 0 } = config
  const jsonSchema = z.toJSONSchema(schema)

  if (config.strict) {
    enforceStrictSchema(jsonSchema)
  }

  const wrappedExecute = async (args: string, signal?: AbortSignal): Promise<string> => {
    const result = await parseAndValidate(args, schema)

    if (!result.success) {
      if (result.type === 'schema_validation_error') {
        const messages = result.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ')
        return JSON.stringify({ success: false, error: `Invalid arguments: ${messages}` })
      }
      return JSON.stringify({ success: false, error: `Failed to parse arguments: ${result.error.message}` })
    }

    try {
      const execResult = await withRetries(
        async () => execute(result.data),
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
          data = await createCompactTool(toolCompactConfig).compact(
            data,
            name,
            description,
            signal,
          )
        }
        catch {
          // compact failure should not affect the tool result
        }
      }
      return JSON.stringify({ success: true, data })
    }
    catch (err) {
      return JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) })
    }
  }

  return {
    ...config,
    parameters: jsonSchema,
    execute: (args: string, signal?: AbortSignal) => wrappedExecute(args, signal),
  }
}

function enforceStrictSchema(schema: Record<string, any>): void {
  if (schema.type === 'object') {
    schema.additionalProperties = false
    if (!schema.required && schema.properties) {
      schema.required = Object.keys(schema.properties)
    }
  }
  if (schema.properties) {
    for (const prop of Object.values(schema.properties)) {
      if (typeof prop === 'object' && prop !== null) {
        enforceStrictSchema(prop)
      }
    }
  }
  if (schema.items && typeof schema.items === 'object') {
    enforceStrictSchema(schema.items)
  }
}

export type Tool = ReturnType<typeof tool>

export function buildToolParameters(tools: Tool[]) {
  if (tools.length === 0) {
    return {
      toolParameters: undefined,
      toolChoice: undefined,
    }
  }
  const toolParameters: ToolCall[] = []
  let toolChoice: ToolChoice | undefined
  const requiredTools: string[] = []
  for (const t of tools) {
    toolParameters.push({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        strict: t.strict || false,
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
