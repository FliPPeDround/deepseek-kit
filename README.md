<img src="logo.png" align="right" width="77" alt="logo"/>

# deepseek-kit

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![bundle][bundle-src]][bundle-href]
[![JSDocs][jsdocs-src]][jsdocs-href]
[![License][license-src]][license-href]

A lightweight Agent framework with native-level DeepSeek adaptation — Precise tool calling in thinking mode · Reliable structured output · Maximum cache hit rate.

**[中文文档](./README.zh-CN.md)** · **[Documentation](https://deepseek-kit.netlify.app)**

---

## 🚀 Quick Experience

**Try it online** — no local setup needed:

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/FliPPeDround/deepseek-kit/tree/main/stackblitz)

**Or scaffold a project locally:**

```bash
pnpx create deepseek-kit my-agent
```

---

## Why deepseek-kit?

LangChain.js and AI SDK are excellent general-purpose frameworks, but DeepSeek's API has unique mechanisms that they cannot properly handle. deepseek-kit is built from the ground up to solve these problems.

### 🧠 Precise Tool Calling in Thinking Mode

DeepSeek's thinking mode outputs a chain of thought (`reasoning_content`) before the final answer. When the model makes tool calls during thinking, **all subsequent requests must include the full `reasoning_content`** — otherwise the API returns a 400 error.

General-purpose frameworks cannot distinguish between the different handling requirements for `reasoning_content` in "with tool call" vs "without tool call" scenarios, causing multi-turn tool calling to fail frequently.

**deepseek-kit** automatically tracks and re-sends `reasoning_content` in the agent loop, applies differentiated strategies based on whether tool calls occurred, and enables thinking mode by default — zero configuration needed.

### 💾 Maximum Cache Hit Rate

DeepSeek API enables context hard disk caching by default. When subsequent requests have a **prefix that exactly matches** a previous request, the repeated portion is served from cache, significantly reducing latency and cost.

General-purpose frameworks often inject dynamic metadata (timestamps, request IDs) or arrange messages in non-deterministic order, breaking prefix consistency and causing cache hit rates to plummet.

**deepseek-kit** sends zero-redundancy request bodies with deterministic message construction, ensuring the same input always produces the same request prefix. Cache hit rates are fully observable via `prompt_cache_hit_tokens` and `prompt_cache_miss_tokens`.

### 📋 Reliable Structured Output

Structured output is essential for agent applications, but under DeepSeek's thinking mode, general-purpose frameworks' structured output solutions often conflict with `reasoning_content` management, resulting in unreliable output formats.

**deepseek-kit** provides Zod Schema-driven structured output with smart retry and formatted error feedback, fully compatible with thinking mode — the chain-of-thought context is never lost during formatting steps.

---

## Features

- 🧠 **Thinking Mode Adaptation** — Automatic `reasoning_content` management, zero-config tool calling chains
- 💾 **Cache Hit Rate Optimization** — Zero-redundancy request body + deterministic message construction
- 📋 **Structured Output** — Zod Schema-driven, smart retry, thinking mode compatible
- 🤖 **Agent System** — Build intelligent agents with tool calling and multi-step execution
- 🌿 **Subagents** — Encapsulate agents as tools for delegation, with isolated context and parallel execution
- 💬 **Streaming** — Streaming events for text, chain-of-thought, and tool calls
- 🔧 **Tool Calling** — Built-in tool definition, parameter validation, timeout, and retry
- ✍️ **FIM Completion** — Fill-in-the-Middle code completion support
- 🪝 **Hook System** — Insert custom logic before and after generation steps
- 🔄 **Auto Retry** — Smart retry strategy with exponential backoff and jitter
- 🌲 **Tree-shakable** — Pure ESM, `sideEffects: false`
- 🔒 **Type Safe** — Complete TypeScript type definitions

---

## Quick Start

```bash
pnpm add deepseek-kit
```

```ts
import { createAgent, createModel, tool } from 'deepseek-kit'
import { z } from 'zod'

const model = createModel({ model: 'deepseek-v4-flash' })

const weatherTool = tool({
  name: 'get_weather',
  description: 'Get weather information for a city',
  parameters: z.object({
    city: z.string().describe('City name'),
  }),
  execute: async ({ city }) => `${city}: Sunny, 25°C`,
})

const agent = createAgent({ model, tools: [weatherTool] })

const result = await agent.generate({
  prompt: 'How\'s the weather in Chongqing today?',
})

console.log(result.text)
```

> **Requirements**: Node.js >= 18.0.0, DeepSeek API key

📖 For the full guide, visit the [documentation](https://deepseek-kit.netlify.app).

---

## 🙇🏻‍♂️ Sponsors

<p align="center">
  <a href="https://afdian.com/a/flippedround">
    <img alt="sponsors" src="https://cdn.jsdelivr.net/gh/FliPPeDround/sponsors/sponsorkit/sponsors.svg"/>
  </a>
</p>

## License

[MIT](./LICENSE.md) License © [Flippedround](https://github.com/flippedround)

<!-- Badges -->

[npm-version-src]: https://img.shields.io/npm/v/deepseek-kit?style=flat&colorA=080f12&colorB=1fa669
[npm-version-href]: https://npmx.dev/package/deepseek-kit
[npm-downloads-src]: https://img.shields.io/npm/dm/deepseek-kit?style=flat&colorA=080f12&colorB=1fa669
[npm-downloads-href]: https://npmx.dev/package/deepseek-kit
[bundle-src]: https://img.shields.io/bundlephobia/minzip/deepseek-kit?style=flat&colorA=080f12&colorB=1fa669&label=minzip
[bundle-href]: https://bundlephobia.com/result?p=deepseek-kit
[license-src]: https://img.shields.io/github/license/flippedround/deepseek-kit.svg?style=flat&colorA=080f12&colorB=1fa669
[license-href]: https://github.com/flippedround/deepseek-kit/blob/main/LICENSE
[jsdocs-src]: https://img.shields.io/badge/jsdocs-reference-080f12?style=flat&colorA=080f12&colorB=1fa669
[jsdocs-href]: https://www.jsdocs.io/package/deepseek-kit
