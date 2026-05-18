import type { FIMParams } from './types'

export async function fim(params: FIMParams) {
  const { model, ...rest } = params
  const response = await model.fim(rest)
  const choices = response.choices

  if (!choices || choices.length === 0) {
    throw new Error('DeepSeek FIM API returned empty choices')
  }

  return {
    text: choices[0].text,
    usage: response.usage,
  }
}
