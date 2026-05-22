import type { z } from 'zod'

let jsonrepairPromise: Promise<(text: string) => string> | null = null

function loadJsonRepair() {
  if (!jsonrepairPromise) {
    jsonrepairPromise = import('jsonrepair').then(m => m.jsonrepair)
  }
  return jsonrepairPromise
}

export interface JsonParseError {
  success: false
  type: 'json_parse_error'
  error: Error
  raw: string
}

export interface SchemaValidationError {
  success: false
  type: 'schema_validation_error'
  error: z.ZodError
  raw: string
}

export type ParseAndValidateResult<T extends z.ZodTypeAny>
  = | { success: true, data: z.infer<T> }
    | JsonParseError
    | SchemaValidationError

export async function tryJsonParse(raw: string): Promise<
  | { success: true, data: unknown }
  | { success: false, error: Error }
> {
  try {
    return { success: true, data: JSON.parse(raw) }
  }
  catch (parseError) {
    try {
      const repair = await loadJsonRepair()
      const repaired = repair(raw)
      return { success: true, data: JSON.parse(repaired) }
    }
    catch {
      return {
        success: false,
        error: parseError instanceof Error ? parseError : new Error(String(parseError)),
      }
    }
  }
}

export async function parseAndValidate<T extends z.ZodTypeAny>(
  raw: string,
  schema: T,
): Promise<ParseAndValidateResult<T>> {
  const parseResult = await tryJsonParse(raw)

  if (!parseResult.success) {
    return {
      success: false,
      type: 'json_parse_error',
      error: parseResult.error,
      raw,
    }
  }

  const validationResult = schema.safeParse(parseResult.data)

  if (validationResult.success) {
    return { success: true, data: validationResult.data }
  }

  return {
    success: false,
    type: 'schema_validation_error',
    error: validationResult.error,
    raw,
  }
}

export function formatZodErrors(error: z.ZodError): string {
  const issues = error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : 'root object'
    return `- Field '${path}': ${issue.message}`
  })
  return `Your previous JSON output does not conform to the required schema. Please correct your output based on the errors below and output only a valid JSON object.\n\nError details:\n${issues.join('\n')}`
}

export function formatParseError(result: JsonParseError | SchemaValidationError): string {
  if (result.type === 'json_parse_error') {
    return `Your previous output is not valid JSON and could not be auto-repaired. Error: ${result.error.message}. Please output only a valid JSON object without any extra text or formatting.`
  }
  return formatZodErrors(result.error)
}
