import type { ZodError } from 'zod'

export function formatZodErrors(error: ZodError): string {
  const issues = error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : '根对象'
    return `- 字段 '${path}': ${issue.message}`
  })
  return `你上一次输出的 JSON 对象不符合要求，具体错误如下。请根据这些错误修正你的输出，并再次只输出一个合法的 JSON 对象。\n\n错误详情：\n${issues.join('\n')}`
}
