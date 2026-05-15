import type { FIMParams } from './types'

export async function fim(params: FIMParams) {
  const response = await params.model.fim(params)
  const choices = response.choices
  return {
    text: choices[0].text,
    usage: response.usage,
  }
}
