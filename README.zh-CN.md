<img src="logo.png" align="right" width="77" alt="logo"/>

# deepseek-kit

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![bundle][bundle-src]][bundle-href]
[![JSDocs][jsdocs-src]][jsdocs-href]
[![License][license-src]][license-href]

DeepSeek 原生级适配的轻量 Agent 框架——思考模式精准工具调用 · 可靠结构化输出 · 极致缓存命中。

**[English](./README.md)** · **[文档](https://deepseek-kit.netlify.app/zh)**

---

## 为什么选择 deepseek-kit？

LangChain.js 和 AI SDK 都是优秀的通用框架，但 DeepSeek API 拥有独特的思考模式和缓存机制，通用框架无法正确处理这些特性。deepseek-kit 从底层开始解决这些问题。

### 🧠 思考模式下的精准工具调用

DeepSeek 思考模式会在最终回答前输出一段思维链（`reasoning_content`）。当模型在思考过程中发起工具调用时，**后续所有请求必须完整回传 `reasoning_content`**，否则 API 将返回 400 错误。

通用框架的消息管理机制无法区分"有工具调用"和"无工具调用"两种场景对 `reasoning_content` 的不同处理要求，导致多轮工具调用频繁失败。

**deepseek-kit** 在 Agent 循环中自动追踪并回传 `reasoning_content`，根据是否发生工具调用采用差异化策略，并默认启用思考模式——零配置即可正常工作。

### 💾 极致缓存命中率

DeepSeek API 默认开启上下文硬盘缓存，当后续请求与之前请求的**前缀完全匹配**时，重复部分从缓存拉取，大幅降低延迟和费用。

通用框架常在请求中注入时间戳、请求 ID 等动态元数据，或以非确定性顺序排列消息，破坏了前缀一致性，导致缓存命中率骤降。

**deepseek-kit** 发送零冗余请求体，消息按确定性顺序构建，确保相同输入始终产生相同的请求前缀。通过 `prompt_cache_hit_tokens` 和 `prompt_cache_miss_tokens` 可实时观测缓存效率。

### 📋 可靠的结构化输出

结构化输出是 Agent 应用的高频需求，但在 DeepSeek 思考模式下，通用框架的结构化输出方案往往与 `reasoning_content` 的管理产生冲突，导致输出格式不可靠。

**deepseek-kit** 提供基于 Zod Schema 的结构化输出，支持智能重试和格式化错误反馈，完全兼容思考模式——格式化步骤中思维链上下文不会丢失。

---

## 特性

- 🧠 **思考模式适配** — 自动管理 `reasoning_content`，工具调用链路零配置可用
- 💾 **缓存命中率优化** — 零冗余请求体 + 确定性消息构建，最大化 DeepSeek 缓存收益
- 📋 **结构化输出** — Zod Schema 驱动，智能重试，思考模式完全兼容
- 🤖 **Agent 系统** — 创建具有工具调用和多步执行能力的智能代理
- 🌿 **子智能体** — 将智能体封装为工具进行委派，支持上下文隔离与并行执行
- 💬 **流式输出** — 支持文本、思维链、工具调用的流式事件
- 🔧 **工具调用** — 内置工具定义、参数校验、超时与重试
- ✍️ **FIM 补全** — 支持 Fill-in-the-Middle 代码补全
- 🪝 **Hook 机制** — 在生成步骤前后插入自定义逻辑
- 🔄 **自动重试** — 指数退避 + 抖动的智能重试策略
- 🌲 **Tree-shakable** — 纯 ESM，`sideEffects: false`
- 🔒 **类型安全** — 完整的 TypeScript 类型定义

---

## 快速开始

```bash
pnpm add deepseek-kit
```

```ts
import { createAgent, createModel, tool } from 'deepseek-kit'
import { z } from 'zod'

const model = createModel({ model: 'deepseek-v4-flash' })

const weatherTool = tool({
  name: 'get_weather',
  description: '获取指定城市的天气信息',
  parameters: z.object({
    city: z.string().describe('城市名称'),
  }),
  execute: async ({ city }) => `${city}：晴，25°C`,
})

const agent = createAgent({ model, tools: [weatherTool] })

const result = await agent.generate({
  prompt: '杭州今天天气怎么样？',
})

console.log(result.text)
```

> **要求**：Node.js >= 18.0.0，DeepSeek API 密钥

📖 完整指南请访问[文档](https://deepseek-kit.netlify.app/zh)。

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
