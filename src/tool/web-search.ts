import type { ToolExecuteContext } from '@/tool/types'
import { z } from 'zod'
import { anthropicRequest } from '@/client/anthropic'
import { tool } from '@/tool'

const SEARCH_SYSTEM_PROMPT = [
  'You are a web search assistant. Follow these rules strictly:',
  '',
  '1. Use web_search to find relevant, up-to-date information for the user\'s query.',
  '2. After receiving search results, write a comprehensive, well-structured answer',
  '   in plain text based on what you found. Include specific details, dates, and facts.',
  '3. Do NOT output tool-call XML (no <invoke> tags).',
  '4. Do NOT call web_search again after you have results.',
  '5. Answer in the same language the user used in their query.',
  '6. If search results are poor or irrelevant, explain why and suggest better keywords.',
  '',
  'Your response must be the final answer, not another search request.',
].join('\n')

export interface WebSearchOptions {
  /** Thinking mode: "enabled" or "disabled" (default: "enabled") */
  thinking?: 'enabled' | 'disabled'
  /** Max tokens for the response (default: 32768) */
  maxTokens?: number
}

export function webSearch(options: WebSearchOptions = {}) {
  const { thinking = 'enabled', maxTokens = 32768 } = options

  return tool({
    name: 'web_search',
    description:
      'Search the web for current, real-time, or factual information. '
      + 'Use this tool when you need information beyond your training cutoff — '
      + 'recent events, current data, documentation lookups, or fact-checking.',
    schema: z.object({
      query: z.string().describe('The search query'),
    }),
    execute: async ({ query }, context?: ToolExecuteContext) => {
      const modelConfig = context?.modelConfig
      if (!modelConfig?.apiKey) {
        throw new Error('API key is not available. This tool must be used within an agent with a configured model.')
      }
      const apiKey = modelConfig.apiKey
      const model = modelConfig.model
      const signal = context?.signal

      const response = await anthropicRequest(
        {
          model,
          max_tokens: maxTokens,
          system: SEARCH_SYSTEM_PROMPT,
          messages: [
            { role: 'user', content: query },
          ],
          tools: [{
            type: 'web_search_20250305',
            name: 'web_search',
          }],
          tool_choice: { type: 'auto' },
          thinking: { type: thinking },
        },
        apiKey,
        signal,
      )

      // Report token usage from web search API call
      if (response.usage && context?.addUsage) {
        context.addUsage(response.usage)
      }

      const results: Array<{ title: string, url: string, pageAge: string | null }> = []
      const textParts: string[] = []

      for (const block of response.content ?? []) {
        if (block.type === 'web_search_tool_result') {
          for (const item of block.content ?? []) {
            if (item.type === 'web_search_result') {
              results.push({
                title: (item.title as string) || 'Untitled',
                url: (item.url as string) || '',
                pageAge: (item.page_age as string | null | undefined) ?? null,
              })
            }
          }
        }
        else if (block.type === 'text' && block.text?.trim()) {
          textParts.push(block.text.trim())
        }
      }

      if (results.length === 0 && textParts.length === 0) {
        return `Web search for **"${query}"** returned no results. Try rephrasing with more specific keywords.`
      }

      const lines: string[] = []

      if (textParts.length > 0) {
        const textAnswer = textParts.join('\n\n')
        if (textAnswer.startsWith('##') || textAnswer.startsWith('# ')) {
          lines.push(textAnswer)
        }
        else {
          lines.push('## Search Results Summary')
          lines.push('')
          lines.push(textAnswer)
        }
      }

      if (results.length > 0) {
        if (textParts.length > 0) {
          lines.push('')
          lines.push('---')
        }
        lines.push('')
        lines.push(`### Sources (${results.length}):`)
        lines.push('')
        for (let i = 0; i < results.length; i++) {
          const r = results[i]!
          lines.push(`${i + 1}. [${r.title}](${r.url})`)
          if (r.pageAge) {
            lines.push(`   - *${r.pageAge}*`)
          }
        }
      }

      return lines.join('\n')
    },
  })
}
