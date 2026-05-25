import type { AssistantMessage, ChatMessage, Model, ToolMessage } from '@/model/types'
import type { ToolCompactConfig } from '@/tool/types'
import crypto from 'node:crypto'
import { createModel } from '@/model'

const DEFAULT_TOOL_MESSAGE_THRESHOLD = 1500
const DEFAULT_CONTEXT_WINDOW_SIZE = 1_000_000
const DEFAULT_COMPACT_THRESHOLD = 0.85
const DEFAULT_KEEP_RECENT_ROUNDS = 3

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
  private _threshold: number = DEFAULT_TOOL_MESSAGE_THRESHOLD
  private model: Model = 'deepseek-v4-flash'

  private constructor() {}

  static getInstance(): CompactTool {
    if (!CompactTool.instance) {
      CompactTool.instance = new CompactTool()
    }
    return CompactTool.instance
  }

  get threshold(): number {
    return this._threshold
  }

  update(config: ToolCompactConfig): this {
    if (config.threshold !== undefined) {
      this._threshold = config.threshold
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
    if (content.length < this._threshold) {
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

export interface AgentCompactConfig {
  threshold?: number
  keepRecentRounds?: number
  model?: Model
  contextWindowSize?: number
}

interface MessageRound {
  messages: ChatMessage[]
}

const MESSAGE_COMPACT_SYSTEM_PROMPT = `You are a conversation compaction assistant. Your task is to compress a sequence of conversation rounds into a concise summary that preserves all information an AI agent needs to continue reasoning.

Rules:
1. Preserve all identifiers: variable names, function names, file paths, URLs, and numeric values.
2. Preserve the intent and outcome of each user request.
3. Preserve what tools were called, with what arguments, and what results were returned.
4. Preserve logical structure and causal relationships (e.g. "A caused B", "X depends on Y").
5. Preserve error types, error messages, and key stack-trace information.
6. Preserve key reasoning steps from the assistant's thinking process (reasoning_content).
7. For code: keep function signatures, type annotations, and core control flow; omit implementation bodies and inline comments.
8. For structured data (JSON, tables): keep keys and representative values; collapse repeated patterns into summaries.
9. For prose or documentation: extract key facts and conclusions; discard filler words, boilerplate, and repetition.
10. Never fabricate or infer information that is not present in the original content.
11. Output only the compacted summary — no explanations, no meta-commentary.`

export class CompactMessage {
  private readonly _threshold: number
  private readonly keepRecentRounds: number
  private readonly model: Model
  private readonly contextWindowSize: number

  constructor(config: AgentCompactConfig = {}) {
    this._threshold = config.threshold ?? DEFAULT_COMPACT_THRESHOLD
    this.keepRecentRounds = config.keepRecentRounds ?? DEFAULT_KEEP_RECENT_ROUNDS
    this.model = config.model ?? 'deepseek-v4-flash'
    this.contextWindowSize = config.contextWindowSize ?? DEFAULT_CONTEXT_WINDOW_SIZE
  }

  get threshold(): number {
    return this._threshold
  }

  shouldCompact(promptTokens: number): boolean {
    return promptTokens >= this.contextWindowSize * this._threshold
  }

  async compact(
    messages: ChatMessage[],
    signal?: AbortSignal,
  ): Promise<ChatMessage[]> {
    const { prefix, historyRounds, recentRounds } = this.splitRounds(messages)

    if (historyRounds.length === 0) {
      return messages
    }

    try {
      const summaryMessage = await this.summarizeRounds(historyRounds, signal)
      return [
        ...prefix,
        summaryMessage,
        ...recentRounds.flatMap(r => r.messages),
      ]
    }
    catch {
      return messages
    }
  }

  private splitRounds(messages: ChatMessage[]): {
    prefix: ChatMessage[]
    historyRounds: MessageRound[]
    recentRounds: MessageRound[]
  } {
    const prefix: ChatMessage[] = []
    let i = 0

    while (i < messages.length) {
      const msg = messages[i]
      if (msg.role === 'system') {
        prefix.push(msg)
        i++
      }
      else if ('name' in msg && msg.name === 'few-shot') {
        prefix.push(msg)
        i++
      }
      else {
        break
      }
    }

    const remaining = messages.slice(i)
    const rounds = this.groupIntoRounds(remaining)

    const keepCount = Math.min(this.keepRecentRounds, rounds.length)
    const historyRounds = rounds.slice(0, rounds.length - keepCount)
    const recentRounds = rounds.slice(rounds.length - keepCount)

    return { prefix, historyRounds, recentRounds }
  }

  private groupIntoRounds(messages: ChatMessage[]): MessageRound[] {
    const rounds: MessageRound[] = []
    let currentRound: ChatMessage[] = []

    for (const msg of messages) {
      if (msg.role === 'user' && currentRound.length > 0) {
        rounds.push({ messages: currentRound })
        currentRound = []
      }
      currentRound.push(msg)
    }

    if (currentRound.length > 0) {
      rounds.push({ messages: currentRound })
    }

    return rounds
  }

  private async summarizeRounds(
    rounds: MessageRound[],
    signal?: AbortSignal,
  ): Promise<ChatMessage> {
    const conversationText = rounds
      .flatMap(r => r.messages)
      .map((msg) => {
        const parts: string[] = [`[${msg.role}]`]
        if (msg.role === 'assistant') {
          const assistant = msg as AssistantMessage
          if (assistant.reasoning_content) {
            parts.push(`Reasoning: ${assistant.reasoning_content}`)
          }
          if (assistant.tool_calls && assistant.tool_calls.length > 0) {
            parts.push(`Tool calls: ${JSON.stringify(assistant.tool_calls)}`)
          }
          if (assistant.content) {
            parts.push(assistant.content)
          }
        }
        else if (msg.role === 'tool') {
          const tool = msg as ToolMessage
          parts.push(`Tool call ID: ${tool.tool_call_id}`)
          parts.push(tool.content)
        }
        else {
          parts.push(msg.content)
        }
        return parts.join('\n')
      })
      .join('\n\n')

    const deepseek = createModel({
      model: this.model,
      thinking: {
        type: 'disabled',
      },
    })

    const response = await deepseek.invoke({
      messages: [
        { role: 'system', content: MESSAGE_COMPACT_SYSTEM_PROMPT },
        { role: 'user', content: conversationText },
      ],
      signal,
    })

    const summary = response.choices[0]?.message?.content ?? ''

    return {
      role: 'user',
      name: 'compact-summary',
      content: `[Conversation history summary]: ${summary}`,
    }
  }
}

export function createCompactMessage(config?: AgentCompactConfig) {
  return new CompactMessage(config ?? {})
}
