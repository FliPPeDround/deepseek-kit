---
name: "ai-sdk-migration"
description: "Helps migrate from Vercel AI SDK to deepseek-kit or integrate them together. Invoke when user asks about AI SDK migration, integration, or switching from ai SDK to deepseek-kit."
---

# AI SDK Migration Guide

You are an expert in migrating between **Vercel AI SDK** and **deepseek-kit**, as well as integrating them together. Help users transition their code, understand API differences, and choose the right integration pattern.

Online documentation: **https://deepseek-kit.vercel.app**

## Why Migrate?

DeepSeek's API has unique mechanisms that AI SDK cannot properly handle:

1. **Thinking Mode** — DeepSeek outputs `reasoning_content` before the final answer. When tool calls occur during thinking, all subsequent requests must include the full `reasoning_content`, otherwise the API returns a 400 error. AI SDK cannot distinguish between different handling requirements.

2. **Cache Hit Rate** — DeepSeek enables context hard disk caching by default. Cache hits depend on strict prefix consistency. AI SDK often injects dynamic metadata (timestamps, request IDs) or arranges messages non-deterministically, breaking prefix consistency.

3. **Structured Output** — Under thinking mode, AI SDK's structured output solutions conflict with `reasoning_content` management, resulting in unreliable output formats.

## Installation

```bash
# Full migration
pnpm add deepseek-kit zod

# Integration (keep AI SDK)
pnpm add deepseek-kit ai @ai-sdk/openai zod
```

## API Mapping: AI SDK → deepseek-kit

### Model Creation

**AI SDK:**
```ts
import { openai } from '@ai-sdk/openai'

const model = openai('deepseek-chat')
```

**deepseek-kit:**
```ts
import { createModel } from 'deepseek-kit'

const model = createModel({ model: 'deepseek-v4-flash' })
```

Key differences:
- deepseek-kit uses `createModel()` with a config object
- API key is auto-read from `DEEPSEEK_API_KEY` env variable
- Thinking mode is enabled by default with `reasoningEffort: 'high'`
- Supports `withConfig()` for cloning with different settings
- Supports `strict` mode for tool calls (Beta endpoint)

### Text Generation

**AI SDK:**
```ts
import { generateText } from 'ai'

const result = await generateText({
  model: openai('gpt-4o'),
  prompt: 'Hello!',
})
console.log(result.text)
```

**deepseek-kit:**
```ts
import { createModel, generateText } from 'deepseek-kit'

const model = createModel({ model: 'deepseek-v4-flash' })

const result = await generateText({
  model,
  prompt: 'Hello!',
})
console.log(result.text)
```

Key differences:
- deepseek-kit requires an explicit `model` instance (not a provider function)
- `generateText` is imported from `deepseek-kit`, not `ai`
- Supports `system`, `fewShot`, `messages` parameters alongside `prompt`

### Streaming

**AI SDK:**
```ts
import { streamText } from 'ai'

const result = streamText({
  model: openai('gpt-4o'),
  prompt: 'Hello!',
})

for await (const chunk of result.textStream) {
  process.stdout.write(chunk)
}
```

**deepseek-kit:**
```ts
import { createAgent, createModel } from 'deepseek-kit'

const model = createModel({ model: 'deepseek-v4-flash' })
const agent = createAgent({ model })

const stream = agent.stream({ prompt: 'Hello!' })

for await (const event of stream) {
  if (event.type === 'text-delta') {
    process.stdout.write(event.textDelta)
  }
  if (event.type === 'reasoning-delta') {
    process.stdout.write(`[Thinking] ${event.reasoningDelta}`)
  }
}
```

Key differences:
- deepseek-kit uses `agent.stream()` which returns typed events
- Events include: `text-delta`, `reasoning-delta`, `tool-call`, `step`, `finish`
- `reasoning-delta` provides thinking process (unique to DeepSeek)
- More granular event types for better UI control

### Tool Definition

**AI SDK:**
```ts
import { tool as aiTool } from 'ai'
import { z } from 'zod'

const weatherTool = aiTool({
  description: 'Get weather',
  parameters: z.object({ city: z.string() }),
  execute: async ({ city }) => `${city}: Sunny, 25°C`,
})
```

**deepseek-kit:**
```ts
import { tool } from 'deepseek-kit'
import { z } from 'zod'

const weatherTool = tool({
  name: 'get_weather',
  description: 'Get weather',
  schema: z.object({ city: z.string().describe('City name') }),
  execute: async ({ city }) => `${city}: Sunny, 25°C`,
})
```

Key differences:
- deepseek-kit requires `name` field
- Uses `schema` instead of `parameters`
- Supports `strict`, `required`, `timeout`, `retries`, `compact` options
- Results are auto-wrapped as `{ success: true, data }` or `{ success: false, error }`

### Agent / Tool Loop

**AI SDK:**
```ts
import { tool as aiTool, generateText } from 'ai'

const result = await generateText({
  model: openai('gpt-4o'),
  tools: { weather: weatherTool },
  maxSteps: 5,
})
```

**deepseek-kit:**
```ts
import { createAgent, createModel, tool } from 'deepseek-kit'

const agent = createAgent({
  model: createModel({ model: 'deepseek-v4-flash' }),
  tools: [weatherTool],
  maxSteps: 50,
})

const result = await agent.generate({ prompt: 'How is the weather?' })
```

Key differences:
- deepseek-kit uses `createAgent()` for the ReAct loop
- Default `maxSteps` is 50 (vs AI SDK's 1)
- Agent has `generate()` and `stream()` methods
- Supports `system`, `fewShot`, `output`, `compact`, `hooks` configuration

### Structured Output

**AI SDK:**
```ts
import { generateObject } from 'ai'

const result = await generateObject({
  model: openai('gpt-4o'),
  schema: z.object({ name: z.string(), email: z.string() }),
  prompt: 'Extract contact info...',
})
console.log(result.object)
```

**deepseek-kit:**
```ts
import { createAgent, createModel } from 'deepseek-kit'

const agent = createAgent({
  model: createModel({ model: 'deepseek-v4-flash' }),
  output: {
    schema: z.object({ name: z.string(), email: z.string() }),
  },
})

const result = await agent.generate({ prompt: 'Extract contact info...' })
console.log(result.output)
```

Key differences:
- deepseek-kit uses `output.schema` on the agent, not a separate `generateObject` function
- Uses prompt + JSON mode + automatic retry strategy (up to 3 retries)
- Fully compatible with thinking mode — `reasoning_content` is never lost
- Validation errors are fed back to the model for self-correction

### Message Construction

**AI SDK:**
```ts
const messages = [
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'user', content: 'Hello!' },
  { role: 'assistant', content: 'Hi there!' },
  { role: 'user', content: 'How are you?' },
]
```

**deepseek-kit:**
```ts
const messages = [
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'user', content: 'Hello!' },
  { role: 'assistant', content: 'Hi there!' },
  { role: 'user', content: 'How are you?' },
]
```

Message format is compatible. deepseek-kit additionally supports:
- `reasoning_content` field on assistant messages (thinking mode)
- `fewShot` parameter for example messages
- Message assembly order: **system → fewShot → messages → prompt**

### Hooks / Callbacks

**AI SDK:**
```ts
// AI SDK doesn't have built-in step hooks
// You'd use middleware or wrapper patterns
```

**deepseek-kit:**
```ts
const agent = createAgent({
  model,
  hooks: {
    beforeStep: (context, hookCtx) => {
      // context: { step, config, messages, tools }
      // Can return: { messages?, tools?, config? }
      // hookCtx.stop() to terminate loop early
    },
    afterStep: (step, hookCtx) => {
      // step: { step, type ('tool'|'text'|'format'), usage, toolCalls?, text? }
    },
    onError: (error, hookCtx) => {
      // error: { type, message, step, retryable }
      // Return undefined to suppress, AgentError to replace
    },
    beforeMessageCompact: (context, hookCtx) => { /* hookCtx.skip() or hookCtx.stop() */ },
    afterMessageCompact: (event, hookCtx) => { /* event.messagesBefore, event.messagesAfter */ },
    beforeToolCompact: (context, hookCtx) => { /* context.toolName, context.content */ },
    afterToolCompact: (event, hookCtx) => { /* event.contentBefore, event.contentAfter */ },
  },
})
```

## Integration Patterns

If full migration isn't feasible, you can integrate the two frameworks:

### Pattern 1: deepseek-kit as an AI SDK Subagent

Wrap a deepseek-kit agent as an AI SDK tool. AI SDK handles multimodal input, DeepSeek handles text reasoning:

```ts
import { openai } from '@ai-sdk/openai'
import { tool as aiTool, ToolLoopAgent } from 'ai'
import { createAgent, createModel, tool } from 'deepseek-kit'
import { z } from 'zod'

const deepseekModel = createModel({ model: 'deepseek-v4-flash' })

const researchAgent = createAgent({
  model: deepseekModel,
  system: 'You are a research assistant. Conduct in-depth analysis and clearly summarize your findings.',
  tools: [searchTool],
})

const researchTool = aiTool({
  description: 'Use DeepSeek for in-depth research and analysis on a given topic',
  parameters: z.object({
    topic: z.string().describe('The topic to research'),
    context: z.string().describe('Related context information, such as image analysis results'),
  }),
  execute: async ({ topic, context }) => {
    const result = await researchAgent.generate({
      prompt: `Based on the following context, research this topic in depth: ${topic}\n\nContext: ${context}`,
    })
    return result.text
  },
})

const mainAgent = new ToolLoopAgent({
  model: openai('gpt-4o'),
  tools: { research: researchTool },
})
```

When a user sends an image:
1. GPT-4o understands the image content and extracts key information
2. GPT-4o determines that in-depth research is needed and calls the `research` tool
3. The DeepSeek agent executes the research task in an isolated context
4. The research result is returned to GPT-4o, which generates the final response

### Pattern 2: AI SDK as a deepseek-kit Subagent

Wrap AI SDK's multimodal model as a deepseek-kit tool. DeepSeek is the primary orchestrator, AI SDK handles multimodal tasks:

```ts
import { openai } from '@ai-sdk/openai'
import { generateText } from 'ai'
import { createAgent, createModel, tool } from 'deepseek-kit'
import { z } from 'zod'

const deepseekModel = createModel({ model: 'deepseek-v4-flash' })

const analyzeImageTool = tool({
  name: 'analyzeImage',
  description: 'Analyze image content and return a detailed text description',
  schema: z.object({
    imageUrl: z.string().describe('URL of the image'),
    question: z.string().describe('Question about the image'),
  }),
  execute: async (input) => {
    const result = await generateText({
      model: openai('gpt-4o'),
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: input.question },
          { type: 'image', image: input.imageUrl },
        ],
      }],
    })
    return result.text
  },
})

const agent = createAgent({
  model: deepseekModel,
  tools: [analyzeImageTool, searchTool],
  system: 'You are an assistant. When users send images, use the analyzeImage tool to understand the image content, then answer questions based on the analysis.',
})
```

### Pattern 2 Extended: Multi-Model Collaboration

DeepSeek serves as the primary orchestrator, dynamically selecting models based on task type:

```ts
import { anthropic } from '@ai-sdk/anthropic'
import { openai } from '@ai-sdk/openai'
import { generateText } from 'ai'
import { createAgent, createModel, tool } from 'deepseek-kit'
import { z } from 'zod'

const deepseekModel = createModel({ model: 'deepseek-v4-flash' })

const visionTool = tool({
  name: 'analyzeImage',
  description: 'Analyze images using a vision model',
  schema: z.object({
    imageUrl: z.string(),
    question: z.string(),
  }),
  execute: async (input) => {
    const result = await generateText({
      model: openai('gpt-4o'),
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: input.question },
          { type: 'image', image: input.imageUrl },
        ],
      }],
    })
    return result.text
  },
})

const longContextTool = tool({
  name: 'analyzeLongDocument',
  description: 'Analyze ultra-long documents with 200K token context support',
  schema: z.object({
    document: z.string(),
    question: z.string(),
  }),
  execute: async (input) => {
    const result = await generateText({
      model: anthropic('claude-sonnet-4-20250514'),
      prompt: `Analyze the following document and answer the question:\n\n${input.document}\n\nQuestion: ${input.question}`,
    })
    return result.text
  },
})

const agent = createAgent({
  model: deepseekModel,
  tools: [visionTool, longContextTool, searchTool],
  system: 'You are an intelligent orchestration assistant. Select the appropriate tool based on task type.',
})
```

### Streaming Integration

When a deepseek-kit agent serves as a subagent, its internal stream events don't propagate to AI SDK's stream. If you need to display subagent progress in the UI, implement custom progress callbacks in the tool:

```ts
const researchTool = aiTool({
  description: 'Use DeepSeek for in-depth research',
  parameters: z.object({ topic: z.string() }),
  execute: async ({ topic }) => {
    const agent = createAgent({ model: deepseekModel, tools: [searchTool] })

    let fullText = ''
    const stream = agent.stream({ prompt: topic })

    for await (const event of stream) {
      if (event.type === 'text-delta') {
        fullText += event.textDelta
      }
      if (event.type === 'tool-call') {
        console.log(`[DeepSeek] Calling tool: ${event.toolCalls.map(t => t.function.name).join(', ')}`)
      }
    }

    return fullText
  },
})
```

## Choosing a Pattern

| Consideration | deepseek-kit as Subagent | AI SDK as Subagent |
|--------------|------------------------|-------------------|
| Primary framework | AI SDK | deepseek-kit |
| Multimodal frequency | Frequent | Occasional |
| Cost control | Main framework bears multimodal costs | DeepSeek handles primary traffic at lower cost |
| Code organization | Multimodal logic in main framework | Multimodal logic encapsulated as tools |
| Migration cost | Suitable for existing projects | Suitable for new projects |

## Migration Checklist

When migrating from AI SDK to deepseek-kit:

1. **Replace imports** — `import { ... } from 'ai'` → `import { ... } from 'deepseek-kit'`
2. **Replace model creation** — `openai('deepseek-chat')` → `createModel({ model: 'deepseek-v4-flash' })`
3. **Replace tool definitions** — `aiTool({ parameters, ... })` → `tool({ name, schema, ... })`
4. **Replace generateText** — Add explicit `model` parameter, use agent pattern for tool loops
5. **Replace streamText** — Use `agent.stream()` with typed events
6. **Replace generateObject** — Use `createAgent({ output: { schema } })`
7. **Set environment variable** — `DEEPSEEK_API_KEY` instead of `OPENAI_API_KEY`
8. **Install dependency** — `pnpm add deepseek-kit` (remove `ai` and `@ai-sdk/openai` if fully migrating)

## Considerations

- **Context Isolation** — deepseek-kit subagents have isolated context, don't inherit AI SDK conversation history. If you need to pass context, manually construct it in the tool's `execute` function
- **Latency Stacking** — Subagent execution time stacks onto the main agent's total latency. For simple text tasks, consider using DeepSeek directly rather than routing through AI SDK
- **Error Propagation** — Errors in subagents are returned to the main agent as tool execution failures and don't directly interrupt the main flow
- **API Keys** — Make sure both `DEEPSEEK_API_KEY` and the corresponding AI SDK model's API key (e.g., `OPENAI_API_KEY`) are configured
- **Streaming** — deepseek-kit subagent internal stream events don't propagate to AI SDK's stream. If you need to display progress, handle it within the tool itself
