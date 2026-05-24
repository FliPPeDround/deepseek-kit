import type { Model } from '@/model/types'
import type { ToolCompactConfig } from '@/tool/types'
import crypto from 'node:crypto'
import { createModel } from '@/model'

const DEFAULT_TOOL_MESSAGE_THRESHOLD = 1500

const COMPACT_SYSTEM_PROMPT = `You are a tool-result compaction assistant. Your task is to compress the output of a tool call into a shorter form while preserving all information an AI agent needs to continue reasoning.

Rules:
1. Preserve all identifiers: variable names, function names, file paths, URLs, and numeric values.
2. Preserve logical structure and causal relationships (e.g. "A caused B", "X depends on Y").
3. Preserve error types, error messages, and stack-trace file paths in full.
4. For code: keep function signatures, type annotations, and core control flow; omit implementation bodies and inline comments.
5. For structured data (JSON, tables): keep keys and representative values; collapse repeated patterns into summaries (e.g. "3 items with similar structure: …").
6. For prose or documentation: extract key facts and conclusions; discard filler words, boilerplate, and repetition.
7. Never fabricate or infer information that is not present in the original content.
8. Output only the compacted content — no explanations, no meta-commentary.`

/**
 * CompactTool — compresses verbose tool results via an LLM to reduce context window usage.
 *
 * ## Why Singleton?
 *
 * CompactTool is implemented as a singleton so that all tool executions share a single
 * in-memory cache. When the same tool is called repeatedly with identical arguments (e.g.
 * reading the same file twice), the compacted result is served from cache instead of
 * making another LLM call, saving both latency and cost.
 *
 * The `update()` method is intentionally called before each `compact()` invocation. It
 * merges the caller's config into the singleton's state so that per-tool overrides (e.g.
 * a custom `threshold` or `model`) take effect for that call while the cache remains
 * shared across all tools. If you need different tools to use consistently different
 * settings, set the config once at startup rather than per-call.
 *
 * ## Configuration
 *
 * - `threshold` (number, default 1500) — minimum character length of a tool result
 *   before compacting is triggered. Results shorter than this are returned as-is.
 * - `model` (Model, default 'deepseek-v4-flash') — the LLM used to compress content.
 *
 * Both options can be set via the `compact` field on a tool definition:
 *
 * ```ts
 * // Enable compacting with defaults
 * compact: true
 *
 * // Enable compacting with custom config
 * compact: { threshold: 3000, model: 'deepseek-v4' }
 * ```
 */
export class CompactTool {
  private static instance: CompactTool | null = null
  private readonly cache = new Map<string, string>()
  private threshold: number = DEFAULT_TOOL_MESSAGE_THRESHOLD
  private model: Model = 'deepseek-v4-flash'

  private constructor() {}

  static getInstance(): CompactTool {
    if (!CompactTool.instance) {
      CompactTool.instance = new CompactTool()
    }
    return CompactTool.instance
  }

  update(config: ToolCompactConfig): this {
    if (config.threshold !== undefined) {
      this.threshold = config.threshold
    }
    if (config.model !== undefined) {
      this.model = config.model
    }
    return this
  }

  async compact(
    content: string,
    name: string,
    description: string,
    signal?: AbortSignal,
  ): Promise<string> {
    if (content.length < this.threshold) {
      return content
    }
    const contentHash = crypto.createHash('sha256').update(content).digest('hex').slice(0, 16)

    const key = `${name}:${contentHash}`
    if (this.cache.has(key)) {
      return this.cache.get(key) ?? ''
    }

    try {
      const compactContent = await this.compactContent(content, name, description, signal)
      if (!compactContent) {
        return content
      }
      this.cache.set(key, compactContent)
      return compactContent
    }
    catch {
      return content
    }
  }

  private async compactContent(
    content: string,
    toolName: string,
    description: string,
    signal?: AbortSignal,
  ): Promise<string> {
    const toolContext = `Tool name: ${toolName}\nTool description: ${description}`
    const userPrompt = `${toolContext}\n\nOriginal content:\n\n${content}`
    const deepseek = createModel({
      model: this.model,
      thinking: {
        type: 'disabled',
      },
    })

    const response = await deepseek.invoke({
      messages: [
        { role: 'system', content: COMPACT_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      signal,
    })

    return response.choices[0]?.message?.content || content
  }
}

export function createCompactTool(config?: ToolCompactConfig) {
  return CompactTool.getInstance().update(config ?? {})
}
