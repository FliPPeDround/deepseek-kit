---
name: "langchainjs-migration"
description: "Helps migrate from LangChain.js to deepseek-kit or integrate them together. Invoke when user asks about LangChain migration, integration, or switching from LangChain.js to deepseek-kit."
---

# LangChain.js Migration Guide

You are an expert in migrating between **LangChain.js** and **deepseek-kit**, as well as integrating them together. Help users transition their code, understand API differences, and choose the right integration pattern.

Online documentation: **https://deepseek-kit.vercel.app**

## Why Migrate?

DeepSeek's API has unique mechanisms that LangChain.js cannot properly handle:

1. **Thinking Mode** — DeepSeek outputs `reasoning_content` before the final answer. When tool calls occur during thinking, all subsequent requests must include the full `reasoning_content`, otherwise the API returns a 400 error. LangChain.js cannot distinguish between different handling requirements for `reasoning_content` in "with tool call" vs "without tool call" scenarios.

2. **Cache Hit Rate** — DeepSeek enables context hard disk caching by default. Cache hits depend on strict prefix consistency. LangChain.js often injects dynamic metadata or arranges messages non-deterministically, breaking prefix consistency and causing cache hit rates to plummet.

3. **Structured Output** — Under thinking mode, LangChain.js's structured output solutions conflict with `reasoning_content` management, resulting in unreliable output formats.

## Installation

```bash
# Full migration
pnpm add deepseek-kit zod

# Integration (keep LangChain)
pnpm add deepseek-kit langchain @langchain/openai zod
```

## API Mapping: LangChain.js → deepseek-kit

### Model Creation

**LangChain.js:**
```ts
import { ChatOpenAI } from '@langchain/openai'

const model = new ChatOpenAI({
  modelName: 'deepseek-chat',
  openAIApiKey: process.env.DEEPSEEK_API_KEY,
  configuration: {
    baseURL: 'https://api.deepseek.com',
  },
})
```

**deepseek-kit:**
```ts
import { createModel } from 'deepseek-kit'

const model = createModel({ model: 'deepseek-v4-flash' })
```

Key differences:
- deepseek-kit uses `createModel()` — a simple function, not a class constructor
- API key is auto-read from `DEEPSEEK_API_KEY` env variable
- Thinking mode is enabled by default with `reasoningEffort: 'high'`
- No need to manually configure `baseURL` for DeepSeek
- Supports `withConfig()` for cloning with different settings

### Text Generation

**LangChain.js:**
```ts
const response = await model.invoke('Hello!')
console.log(response.content)
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
- deepseek-kit uses `generateText()` with explicit model parameter
- Result is accessed via `result.text` (not `response.content`)
- Supports `system`, `fewShot`, `messages` parameters alongside `prompt`

### Streaming

**LangChain.js:**
```ts
const stream = await model.stream('Hello!')
for await (const chunk of stream) {
  process.stdout.write(chunk.content)
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

**LangChain.js:**
```ts
import { tool } from 'langchain'
import { z } from 'zod'

const weatherTool = tool(
  async ({ city }) => `${city}: Sunny, 25°C`,
  {
    name: 'get_weather',
    description: 'Get weather information',
    schema: z.object({ city: z.string().describe('City name') }),
  },
)
```

**deepseek-kit:**
```ts
import { tool } from 'deepseek-kit'
import { z } from 'zod'

const weatherTool = tool({
  name: 'get_weather',
  description: 'Get weather information',
  schema: z.object({ city: z.string().describe('City name') }),
  execute: async ({ city }) => `${city}: Sunny, 25°C`,
})
```

Key differences:
- LangChain.js: execute function is the first argument, config is the second
- deepseek-kit: everything is in a single config object with `execute` field
- deepseek-kit supports additional options: `strict`, `required`, `timeout`, `retries`, `compact`
- deepseek-kit auto-wraps results as `{ success: true, data }` or `{ success: false, error }`

### Agent Creation

**LangChain.js:**
```ts
import { createAgent } from 'langchain'

const agent = createAgent({
  model: new ChatOpenAI({ model: 'gpt-4o' }),
  tools: [weatherTool],
})

const result = await agent.invoke({ input: 'How is the weather?' })
console.log(result.output)
```

**deepseek-kit:**
```ts
import { createAgent, createModel, tool } from 'deepseek-kit'

const agent = createAgent({
  model: createModel({ model: 'deepseek-v4-flash' }),
  tools: [weatherTool],
})

const result = await agent.generate({ prompt: 'How is the weather?' })
console.log(result.text)
```

Key differences:
- deepseek-kit uses `agent.generate()` (not `agent.invoke()`)
- Input uses `prompt` (not `input`)
- Result accessed via `result.text` (not `result.output`)
- Supports `system`, `fewShot`, `output`, `compact`, `hooks`, `maxSteps`
- Default `maxSteps` is 50

### Structured Output

**LangChain.js:**
```ts
const model = new ChatOpenAI({ model: 'gpt-4o' }).withStructuredOutput(
  z.object({ name: z.string(), email: z.string() }),
)

const result = await model.invoke('Extract contact info...')
console.log(result)
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
- deepseek-kit uses `output.schema` on the agent, not `.withStructuredOutput()` on the model
- Uses prompt + JSON mode + automatic retry strategy (up to 3 retries)
- Fully compatible with thinking mode — `reasoning_content` is never lost
- Validation errors are fed back to the model for self-correction

### Message Construction

**LangChain.js:**
```ts
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages'

const messages = [
  new SystemMessage('You are a helpful assistant.'),
  new HumanMessage('Hello!'),
  new AIMessage('Hi there!'),
  new HumanMessage('How are you?'),
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

Key differences:
- deepseek-kit uses plain objects with `role` and `content` fields
- No need to import message classes
- Supports `system`, `user`, `assistant`, and `tool` roles
- Assistant messages can include `tool_calls` and `reasoning_content`
- Message assembly order: **system → fewShot → messages → prompt**

### Hooks / Callbacks

**LangChain.js:**
```ts
const model = new ChatOpenAI({
  callbacks: [
    {
      handleLLMStart: async (llm, prompts) => { /* ... */ },
      handleLLMEnd: async (output) => { /* ... */ },
      handleLLMError: async (err) => { /* ... */ },
    },
  ],
})
```

**deepseek-kit:**
```ts
const agent = createAgent({
  model,
  hooks: {
    beforeStep: (context, hookCtx) => {
      // context: { step, config, messages, tools }
      // Can return: { messages?, tools?, config? }
      // hookCtx.stop() to terminate loop
    },
    afterStep: (step, hookCtx) => {
      // step: { step, type ('tool'|'text'|'format'), usage, toolCalls?, text? }
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
  },
})
```

Key differences:
- deepseek-kit hooks are step-based (before/after each agent step)
- `hookCtx.stop()` allows early loop termination
- `beforeStep` can return config modifications (dynamic model switching, message injection)
- Compact hooks for controlling context compaction process

## Integration Patterns

If full migration isn't feasible, you can integrate the two frameworks:

### Pattern 1: deepseek-kit as a LangChain Subagent

Wrap a deepseek-kit agent as a LangChain tool. LangChain handles multimodal/workflow orchestration, DeepSeek handles text reasoning:

```ts
import { ChatOpenAI } from '@langchain/openai'
import { createAgent, createModel } from 'deepseek-kit'
import { createAgent as createLangChainAgent, tool } from 'langchain'
import { z } from 'zod'

const deepseekModel = createModel({ model: 'deepseek-v4-flash' })

const researchAgent = createAgent({
  model: deepseekModel,
  system: 'You are a research assistant. Conduct in-depth analysis and clearly summarize your findings.',
})

const researchTool = tool(
  async ({ topic, context }) => {
    const result = await researchAgent.generate({
      prompt: `Based on the following context, research in depth: ${topic}\n\nContext: ${context}`,
    })
    return result.text
  },
  {
    name: 'deepseek_research',
    description: 'Use DeepSeek for in-depth research and analysis on a given topic, suitable for text tasks requiring deep reasoning',
    schema: z.object({
      topic: z.string().describe('The topic to research'),
      context: z.string().describe('Related context information'),
    }),
  },
)

const mainAgent = createLangChainAgent({
  model: new ChatOpenAI({ model: 'gpt-4o' }),
  tools: [researchTool],
})
```

### Pattern 1 Extended: Code Review Pipeline

LangChain orchestrates a multi-step workflow, while DeepSeek handles specific code analysis:

```ts
import { ChatOpenAI } from '@langchain/openai'
import { createAgent, createModel, tool as dsTool } from 'deepseek-kit'
import { createAgent as createLangChainAgent, tool } from 'langchain'
import { z } from 'zod'

const deepseekModel = createModel({ model: 'deepseek-v4-flash' })

const codeAnalysisAgent = createAgent({
  model: deepseekModel,
  system: 'You are a code analysis expert. Analyze code structure, logic, and potential issues.',
})

const codeReviewAgent = createAgent({
  model: deepseekModel,
  system: 'You are a code review expert. Provide specific improvement suggestions.',
  output: {
    schema: z.object({
      issues: z.array(z.object({
        severity: z.enum(['critical', 'warning', 'info']),
        description: z.string(),
        suggestion: z.string(),
      })),
      overallScore: z.number().min(0).max(100),
      summary: z.string(),
    }),
  },
})

const analyzeTool = tool(
  async ({ code }) => {
    const result = await codeAnalysisAgent.generate({
      prompt: `Analyze the following code:\n\`\`\`\n${code}\n\`\`\``,
    })
    return result.text
  },
  {
    name: 'analyze_code',
    description: 'Use DeepSeek to analyze code structure and logic',
    schema: z.object({ code: z.string().describe('Code to analyze') }),
  },
)

const reviewTool = tool(
  async ({ analysisReport }) => {
    const result = await codeReviewAgent.generate({
      prompt: `Conduct a code review based on the following analysis report:\n${analysisReport}`,
    })
    return JSON.stringify(result.output)
  },
  {
    name: 'review_code',
    description: 'Conduct a code review based on an analysis report, returning structured review results',
    schema: z.object({ analysisReport: z.string().describe('Code analysis report') }),
  },
)

const mainAgent = createLangChainAgent({
  model: new ChatOpenAI({ model: 'gpt-4o' }),
  tools: [analyzeTool, reviewTool],
})
```

### Pattern 2: LangChain as a deepseek-kit Subagent

Wrap LangChain's capabilities as deepseek-kit tools. DeepSeek is the primary orchestrator, LangChain handles multimodal tasks:

```ts
import { HumanMessage } from '@langchain/core/messages'
import { ChatOpenAI } from '@langchain/openai'
import { createAgent, createModel, tool } from 'deepseek-kit'
import { z } from 'zod'

const deepseekModel = createModel({ model: 'deepseek-v4-flash' })
const visionModel = new ChatOpenAI({ model: 'gpt-4o' })

const analyzeImageTool = tool({
  name: 'analyzeImage',
  description: 'Analyze image content and return a detailed text description. Use this tool when users mention images, screenshots, or photos.',
  schema: z.object({
    imageUrl: z.string().describe('URL of the image'),
    question: z.string().describe('Specific question about the image'),
  }),
  execute: async (input) => {
    const response = await visionModel.invoke([
      new HumanMessage({
        content: [
          { type: 'text', text: input.question },
          { type: 'image_url', image_url: { url: input.imageUrl } },
        ],
      }),
    ])
    return response.content as string
  },
})

const agent = createAgent({
  model: deepseekModel,
  tools: [analyzeImageTool, searchTool],
  system: 'You are an assistant. When users send images, first use analyzeImage to understand the image, then answer based on the results.',
})
```

### Hybrid Architecture Example

A complete hybrid architecture — LangChain handles user interaction and multimodal input, while DeepSeek handles text-intensive tasks:

```ts
import { ChatOpenAI } from '@langchain/openai'
import { createAgent, createModel, tool as dsTool } from 'deepseek-kit'
import { createAgent as createLangChainAgent, tool } from 'langchain'
import { z } from 'zod'

const deepseekModel = createModel({ model: 'deepseek-v4-flash' })

const writingAgent = createAgent({
  model: deepseekModel,
  system: 'You are a professional technical writing assistant. Write high-quality technical documentation based on provided information.',
})

const analysisAgent = createAgent({
  model: deepseekModel,
  system: 'You are a data analysis assistant. Analyze data and extract key insights.',
  output: {
    schema: z.object({
      summary: z.string(),
      keyFindings: z.array(z.string()),
      recommendation: z.string(),
    }),
  },
})

const writeDocTool = tool(
  async ({ topic, context }) => {
    const result = await writingAgent.generate({
      prompt: `Write technical documentation about ${topic}.\n\nReference material: ${context}`,
    })
    return result.text
  },
  {
    name: 'write_document',
    description: 'Use DeepSeek to write technical documentation',
    schema: z.object({
      topic: z.string().describe('Document topic'),
      context: z.string().describe('Reference material'),
    }),
  },
)

const analyzeDataTool = tool(
  async ({ data, question }) => {
    const result = await analysisAgent.generate({
      prompt: `Analyze the following data: ${data}\n\nQuestion: ${question}`,
    })
    return JSON.stringify(result.output)
  },
  {
    name: 'analyze_data',
    description: 'Use DeepSeek to analyze data and extract insights',
    schema: z.object({
      data: z.string().describe('Data to analyze'),
      question: z.string().describe('Analysis question'),
    }),
  },
)

const mainAgent = createLangChainAgent({
  model: new ChatOpenAI({ model: 'gpt-4o' }),
  tools: [writeDocTool, analyzeDataTool],
})
```

## Choosing a Pattern

| Consideration | deepseek-kit as Subagent | LangChain as Subagent |
|--------------|------------------------|----------------------|
| Primary framework | LangChain | deepseek-kit |
| Multimodal frequency | Frequent | Occasional |
| Cost control | Main framework bears multimodal costs | DeepSeek handles primary traffic at lower cost |
| Code organization | Multimodal logic in main framework | Multimodal logic encapsulated as tools |
| Migration cost | Suitable for existing projects | Suitable for new projects |

## Migration Checklist

When migrating from LangChain.js to deepseek-kit:

1. **Replace imports** — `import { ... } from 'langchain'` → `import { ... } from 'deepseek-kit'`
2. **Replace model creation** — `new ChatOpenAI(...)` → `createModel({ model: 'deepseek-v4-flash' })`
3. **Replace tool definitions** — `tool(fn, config)` → `tool({ name, schema, execute, ... })`
4. **Replace agent creation** — `createAgent({ model, tools })` → `createAgent({ model, tools })` (similar API, different model type)
5. **Replace invocation** — `agent.invoke({ input })` → `agent.generate({ prompt })`
6. **Replace streaming** — `model.stream()` → `agent.stream()` with typed events
7. **Replace structured output** — `.withStructuredOutput(schema)` → `createAgent({ output: { schema } })`
8. **Replace message classes** — `new HumanMessage(...)` → `{ role: 'user', content: '...' }`
9. **Replace callbacks** — LangChain callbacks → `hooks: { beforeStep, afterStep, onError }`
10. **Set environment variable** — `DEEPSEEK_API_KEY` instead of `OPENAI_API_KEY`
11. **Install dependency** — `pnpm add deepseek-kit` (remove `langchain` and `@langchain/openai` if fully migrating)

## Considerations

- **Context Isolation** — deepseek-kit subagents have isolated context, don't inherit LangChain conversation history. If you need to pass context, manually provide it via the `messages` parameter
- **Tool Format Differences** — deepseek-kit's `tool()` and LangChain's `tool()` use different parameter formats and are not directly interchangeable. Adaptation is needed at the integration layer
- **Error Handling** — Errors from deepseek-kit subagents are returned to the LangChain main agent as tool execution failures. You can handle these errors uniformly in LangChain's middleware
- **API Keys** — Make sure both `DEEPSEEK_API_KEY` and the corresponding LangChain model's API key (e.g., `OPENAI_API_KEY`) are configured
- **Streaming** — deepseek-kit subagent internal stream events don't propagate to LangChain's stream. If you need to display progress, handle it within the tool itself
