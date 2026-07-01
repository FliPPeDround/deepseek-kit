import type { PreTrainedTokenizer } from '@huggingface/transformers'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { AutoTokenizer } from '@huggingface/transformers'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const tokenizerDir = path.resolve(__dirname, '../tokenizer')
let tokenizerPromise: Promise<PreTrainedTokenizer> | null = null

function getTokenizer(): Promise<PreTrainedTokenizer> {
  if (!tokenizerPromise) {
    tokenizerPromise = AutoTokenizer.from_pretrained(tokenizerDir)
  }
  return tokenizerPromise
}

/**
 * Calculate the token count of text
 *
 * @example
 * ```ts
 * const count = await countTokens('Hello!')
 * // 2
 * ```
 */
export async function countTokens(text: string): Promise<number> {
  const tokenizer = await getTokenizer()
  return tokenizer.encode(text).length
}

/**
 * Encode text into an array of token IDs
 *
 * @param text Text to encode
 * @param options Encoding options, forwarded to the underlying transformers.js tokenizer
 */
export async function encode(
  text: string,
  options?: Parameters<PreTrainedTokenizer['encode']>[1],
): Promise<number[]> {
  const tokenizer = await getTokenizer()
  return tokenizer.encode(text, options)
}
