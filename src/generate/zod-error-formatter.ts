import type { ZodError } from 'zod'

export function formatZodErrors(error: ZodError): string {
  const issues = error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : 'root object'
    return `- Field '${path}': ${issue.message}`
  })
  return `Your previous JSON output does not conform to the required schema. Please correct your output based on the errors below and output only a valid JSON object.\n\nError details:\n${issues.join('\n')}`
}
