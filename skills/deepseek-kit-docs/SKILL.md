---
name: "deepseek-kit-docs"
description: "Helps write and manage deepseek-kit documentation content. Invoke when user asks to write, update, or review docs for deepseek-kit project."
---

# deepseek-kit Documentation Content

You are a documentation expert for the **deepseek-kit** project. Your job is to help write, update, and review documentation that is accurate, consistent, and follows the project's established conventions.

Online documentation: **https://deepseek-kit.vercel.app**

## Project Overview

deepseek-kit is a lightweight TypeScript Agent framework with native-level DeepSeek adaptation — Precise tool calling in thinking mode · Reliable structured output · Maximum cache hit rate.

```bash
pnpm add deepseek-kit
```

Requirements: Node.js >= 18.0.0, DeepSeek API key

### Why deepseek-kit?

LangChain.js and AI SDK are excellent general-purpose frameworks, but DeepSeek's API has unique mechanisms that they cannot properly handle:

1. **Thinking Mode** — DeepSeek outputs `reasoning_content` before the final answer. When tool calls occur during thinking, all subsequent requests must include the full `reasoning_content`, otherwise the API returns a 400 error. General-purpose frameworks cannot distinguish the different handling requirements.

2. **Cache Hit Rate** — DeepSeek enables context hard disk caching by default. Cache hits depend on strict prefix consistency. General-purpose frameworks inject dynamic metadata or arrange messages non-deterministically, breaking prefix consistency.

3. **Structured Output** — Under thinking mode, general-purpose frameworks' structured output solutions conflict with `reasoning_content` management, resulting in unreliable output formats.

### Core Features

- 🧠 **Thinking Mode Adaptation** — Automatic `reasoning_content` management, zero-config tool calling chains
- 💾 **Cache Hit Rate Optimization** — Zero-redundancy request body + deterministic message construction
- 📋 **Structured Output** — Zod Schema-driven, smart retry, thinking mode compatible
- 🤖 **Agent System** — Build intelligent agents with tool calling and multi-step execution (ReAct loop)
- 🌿 **Subagents** — Encapsulate agents as tools for delegation, with isolated context and parallel execution
- 💬 **Streaming** — Streaming events for text, chain-of-thought, and tool calls
- 🔧 **Tool Calling** — Built-in tool definition, parameter validation, timeout, and retry
- ✍️ **FIM Completion** — Fill-in-the-Middle code completion support
- 🪝 **Hook System** — Insert custom logic before and after generation steps
- 🔄 **Auto Retry** — Smart retry strategy with exponential backoff and jitter
- 🌲 **Tree-shakable** — Pure ESM, `sideEffects: false`
- 🔒 **Type Safe** — Complete TypeScript type definitions

## Key Exports

```ts
// Types
import type {
  AgentCompactConfig,
  AgentErrorType,
  BeforeStepContext,
  BeforeStepResult,
  ConsistentTools,
  GenerateTextHooks,
  GenerateTextResult,
  HookContext,
  Model,
  ModelOptions,
  NonStrictTool,
  StrictTool,
  Usage,
} from 'deepseek-kit'

import {
  AgentError,
  classifyError,
  createAgent,
  createModel,
  DeepSeekModel,
  fim,
  generateStream,
  generateText,
  tool,
} from 'deepseek-kit'
```

## Core API Reference

### createModel — Model Creation

```ts
const model = createModel({ model: 'deepseek-v4-flash' })
```

Parameters:
- `model` (required) — Model identifier: `deepseek-v4-flash`, `deepseek-v4-pro`, or custom string
- `apiKey` (default: `DEEPSEEK_API_KEY` env variable) — DeepSeek API key
- `baseURL` (default: `https://api.deepseek.com`) — API base URL
- `thinking` — `{ type: 'enabled' | 'disabled' }`, enabled by default
- `reasoningEffort` — `'high' | 'max'`, default `'high'`
- `maxTokens` — Maximum tokens to generate
- `temperature` — Sampling temperature (0-2)
- `topP` — Nucleus sampling parameter
- `timeout` (default: 60000) — Request timeout in ms
- `maxRetries` (default: 3) — Max retries for 429/500/503 errors
- `strict` (default: false) — Enable strict mode for all tool calls

Methods:
- `model.invoke(params)` — Full chat completion request
- `model.invokeStream(params)` — Streaming chat completion
- `model.fim(params)` — Fill-in-the-Middle code completion
- `model.list()` — Get available models
- `model.balance()` — Query account balance
- `model.withConfig(options)` — Clone with merged configuration

### createAgent — Agent Creation

```ts
const agent = createAgent({
  model,
  tools: [weatherTool],
  system: 'You are a helpful assistant.',
  fewShot: [
    { role: 'user', content: 'Hello' },
    { role: 'assistant', content: '你好' },
  ],
  output: {
    schema: z.object({ city: z.string(), temperature: z.number() }),
  },
  compact: true,
  hooks: { beforeStep, afterStep, onError },
  maxSteps: 50,
})
```

Parameters:
- `model` (required) — DeepSeekModel instance
- `tools` — List of available tools
- `system` — System prompt for agent's role and behavior
- `fewShot` — Example messages inserted after system, before conversation
- `output` — `{ schema: ZodSchema }` for structured output
- `compact` — `boolean | { threshold?, keepRecentRounds?, model?, contextWindowSize? }` for context compaction
- `hooks` — Lifecycle hooks: `beforeStep`, `afterStep`, `onError`, `beforeMessageCompact`, `afterMessageCompact`, `beforeToolCompact`, `afterToolCompact`
- `maxSteps` (default: 50) — Maximum execution steps
- `signal` — AbortSignal for cancellation

Methods:
- `agent.generate({ prompt, messages })` — Execute and return complete result
- `agent.stream({ prompt, messages })` — Streaming execution with typed events

Message assembly order: **system → fewShot → messages → prompt**

### tool — Tool Definition

```ts
const weatherTool = tool({
  name: 'getWeather',
  description: 'Query weather information for a city',
  schema: z.object({
    city: z.string().describe('City name'),
  }),
  execute: async (input) => {
    return `${input.city}: Sunny today, 22°C.`
  },
  strict: false,
  required: false,
  timeout: 60000,
  retries: 0,
  compact: true,
})
```

Parameters:
- `name` (required) — Unique identifier
- `description` (required) — Functional description
- `schema` (required) — Zod Schema for parameters
- `execute` (required) — Async execution function
- `strict` (default: false) — Enable strict mode (Beta endpoint)
- `required` (default: false) — Force model to call this tool
- `timeout` (default: 60000) — Execution timeout in ms
- `retries` (default: 0) — Max retries on failure
- `compact` — `boolean | { threshold?, model? }` for result compaction

Results are auto-wrapped:
- Success: `{ success: true, data: <result> }`
- Failure: `{ success: false, error: "<message>" }`

### generateText — One-shot Generation

```ts
const result = await generateText({
  model,
  prompt: 'Hello!',
  system: 'You are a helpful assistant.',
  tools: [weatherTool],
  output: { schema: z.object({ ... }) },
})
```

### Streaming Events

```ts
const stream = agent.stream({ prompt: '...' })
for await (const event of stream) {
  switch (event.type) {
    case 'text-delta': // event.textDelta
    case 'reasoning-delta': // event.reasoningDelta
    case 'tool-call': // event.step, event.toolCalls
    case 'step': // event.step
    case 'finish': // event.text, event.usage
  }
}
```

### Hooks

```ts
hooks: {
  beforeStep: (context, hookCtx) => {
    // context: { step, config, messages, tools }
    // Can return: { messages?, tools?, config? }
    // hookCtx.stop() to terminate loop
  },
  afterStep: (step, hookCtx) => {
    // step: { step, type ('tool'|'text'|'format'), usage, toolCalls?, text?, reasoningContent? }
  },
  onError: (error, hookCtx) => {
    // error: { type, message, step, retryable, cause }
    // Return undefined to suppress, AgentError to replace
    // Error types: rate_limit, model_error, timeout, network_error, tool_error, max_steps, schema_error
  },
  beforeMessageCompact: (context, hookCtx) => { /* hookCtx.skip() or hookCtx.stop() */ },
  afterMessageCompact: (event, hookCtx) => { /* event.messagesBefore, event.messagesAfter */ },
  beforeToolCompact: (context, hookCtx) => { /* context.toolName, context.content */ },
  afterToolCompact: (event, hookCtx) => { /* event.contentBefore, event.contentAfter */ },
}
```

### Structured Output

```ts
const agent = createAgent({
  model,
  output: {
    schema: z.object({
      sentiment: z.enum(['positive', 'negative', 'neutral']),
      confidence: z.number().min(0).max(1),
    }),
  },
})

const result = await agent.generate({ prompt: 'Analyze sentiment...' })
console.log(result.output) // { sentiment: 'positive', confidence: 0.95 }
```

Strategy: Zod Schema → JSON Schema prompt → JSON mode call → Zod validation → Auto retry (up to 3x) with error feedback. Fully compatible with thinking mode.

### FIM Completion

```ts
import { createModel, fim } from 'deepseek-kit'

const result = await fim({
  model: createModel({ model: 'deepseek-v4-flash' }),
  prompt: 'function fibonacci(n) {',
  suffix: '\n  return result\n}',
  maxTokens: 256,
})

console.log(result.text)
```

### Subagents

```ts
const researchAgent = createAgent({
  model,
  system: 'You are a research assistant. Summarize your findings clearly.',
  tools: [searchTool],
})

const researchTool = tool({
  name: 'research',
  description: 'Research a topic in depth',
  schema: z.object({ task: z.string() }),
  execute: async (input) => {
    const result = await researchAgent.generate({ prompt: input.task })
    return result.text
  },
})

const mainAgent = createAgent({
  model,
  tools: [researchTool],
})
```

Key points: Subagents have isolated context, don't inherit main agent history. Support parallel execution via `Promise.all()`. Support structured output.

### Context Compaction

```ts
const agent = createAgent({
  model,
  tools: [searchTool, readFileTool],
  compact: true, // or { threshold: 0.9, keepRecentRounds: 5, model: 'deepseek-v4-flash', contextWindowSize: 1_000_000 }
})
```

When `prompt_tokens >= contextWindowSize * threshold`, older rounds are summarized via LLM. System prompts, few-shot examples, and recent rounds are always preserved.

## Writing Conventions

When writing or updating documentation for deepseek-kit:

### Code Examples
- Always use TypeScript with full imports from `'deepseek-kit'`
- Use `deepseek-v4-flash` as the default model
- Include `import { z } from 'zod'` when using Zod schemas
- Show complete, runnable code snippets — not fragments
- Use English for code comments unless targeting Chinese docs

### Style
- Write in clear, concise language
- Use present tense for descriptions
- Use second person ("you") for instructions
- Prefer active voice
- Include practical examples for every concept
- Explain "why" before "how"
- Use tables for comparisons and parameter references

### Structure
- Start with a brief introduction explaining the concept
- Follow with basic usage and code examples
- Cover advanced features with progressive complexity
- End with API reference section
- Use mermaid diagrams for complex flows (agent loops, message flows, integration patterns)
