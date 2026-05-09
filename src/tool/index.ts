import type { ToolCall, ToolChoice, ToolDefinition } from './types'
import { z } from 'zod'

export function tool<T extends z.ZodObject>(config: ToolDefinition<T>) {
  const { schema, execute } = config
  const jsonSchema = z.toJSONSchema(schema)

  const wrappedExecute = async (args: string) => {
    const parsed = schema.safeParse(JSON.parse(args))
    if (!parsed.success) {
      const message = parsed.error.issues.map(issue => issue.message).join(', ')
      throw new Error(message)
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

export type Tool = ReturnType<typeof tool>

export function buildToolsParams(tools: Tool[]) {
  if (tools.length === 0) {
    return {
      toolParams: undefined,
      toolChoice: undefined,
    }
  }
  const toolParams: ToolCall[] = []
  const toolChoice: ToolChoice[] = []
  for (const tool of tools) {
    toolParams.push({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        strict: tool.strict || false,
        parameters: tool.parameters,
      },
    })
    if (tool.required) {
      toolChoice.push({
        type: 'function',
        function: {
          name: tool.name,
        },
      })
    }
  }
  return {
    toolParams: toolParams.length > 0 ? toolParams : undefined,
    toolChoice: toolChoice.length > 0 ? toolChoice : undefined,
  }
}
