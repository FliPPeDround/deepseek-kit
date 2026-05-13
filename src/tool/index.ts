import type { ToolCall, ToolChoice, ToolDefinition } from './types'
import { z } from 'zod'

export function tool<T extends z.ZodObject>(config: ToolDefinition<T>) {
  const { schema, execute } = config
  const jsonSchema = z.toJSONSchema(schema)

  if (config.strict) {
    enforceStrictSchema(jsonSchema)
  }

  const wrappedExecute = async (args: string) => {
    const parsed = schema.safeParse(JSON.parse(args))
    if (!parsed.success) {
      const message = parsed.error.issues.map(issue => issue.message).join(', ')
      return `Tool execution error: ${message}`
    }
    try {
      const result = await execute(parsed.data)
      return String(result)
    }
    catch (err) {
      return `Tool execution error: ${err instanceof Error ? err.message : String(err)}`
    }
  }

  return {
    ...config,
    parameters: jsonSchema,
    execute: (args: string) => wrappedExecute(args),
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
