# deepseek-kit

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![bundle][bundle-src]][bundle-href]
[![JSDocs][jsdocs-src]][jsdocs-href]
[![License][license-src]][license-href]

基于 DeepSeek API 的 TypeScript Agent 框架，提供文本生成、流式输出、工具调用、结构化输出和 FIM 补全等功能。

**[English Documentation](./README.en.md)**

## 特性

- 🤖 **Agent 系统** — 创建具有工具调用能力的智能代理
- 💬 **文本生成** — 支持普通和流式两种生成模式
- 🔧 **工具调用** — 内置工具定义、参数校验、超时与重试
- 📋 **结构化输出** — 基于 Zod Schema 的 JSON 结构化输出
- ✍️ **FIM 补全** — 支持 Fill-in-the-Middle 代码补全
- 🪝 **Hook 机制** — 在生成步骤前后插入自定义逻辑
- 🔄 **自动重试** — 指数退避 + 抖动的智能重试策略
- 🌲 **Tree-shakable** — 纯 ESM，`sideEffects: false`
- 🔒 **类型安全** — 完整的 TypeScript 类型定义

## 安装

```bash
# pnpm
pnpm add deepseek-kit

# npm
npm install deepseek-kit

# yarn
yarn add deepseek-kit
```

> **要求**: Node.js >= 18.0.0

## 快速开始

### 配置 API Key

在项目根目录创建 `.env` 文件：

```
DEEPSEEK_API_KEY=your_api_key
```

### 文本生成

```ts
import { createModel, generateText } from 'deepseek-kit'

const model = createModel({ model: 'deepseek-v4-flash' })

const result = await generateText({
  model,
  messages: [{ role: 'user', content: 'Hello, how are you?' }],
})

console.log(result.text)
```

### 流式生成

```ts
import { createModel, generateStream } from 'deepseek-kit'

const model = createModel({ model: 'deepseek-v4-flash' })

for await (const event of generateStream({
  model,
  messages: [{ role: 'user', content: 'Tell me a story' }],
})) {
  if (event.type === 'text-delta') {
    process.stdout.write(event.textDelta)
  }
}
```

### 工具调用

```ts
import { createModel, generateText, tool } from 'deepseek-kit'
import { z } from 'zod'

const model = createModel({ model: 'deepseek-v4-flash' })

const weatherTool = tool({
  name: 'weather',
  description: 'Get weather information for a city',
  schema: z.object({
    city: z.string().describe('The city to get weather for'),
  }),
  execute: async (input) => {
    return `Weather in ${input.city}: Sunny, 25°C`
  },
  timeout: 10000,
  retries: 2,
})

const result = await generateText({
  model,
  tools: [weatherTool],
  messages: [{ role: 'user', content: 'What is the weather in Beijing?' }],
})

console.log(result.text)
```

### 结构化输出

```ts
import { createModel, generateText } from 'deepseek-kit'
import { z } from 'zod'

const model = createModel({ model: 'deepseek-v4-flash' })

const result = await generateText({
  model,
  messages: [{ role: 'user', content: 'What is the weather in Beijing?' }],
  output: {
    schema: z.object({
      city: z.string(),
      weather: z.string(),
      temperature: z.number(),
    }),
  },
})

console.log(result.output) // { city: 'Beijing', weather: 'Sunny', temperature: 25 }
```

### 创建 Agent

```ts
import { createAgent, createModel, tool } from 'deepseek-kit'
import { z } from 'zod'

const model = createModel({ model: 'deepseek-v4-flash' })

const agent = createAgent({
  model,
  tools: [weatherTool],
  output: {
    schema: z.object({
      city: z.string(),
      weather: z.string(),
    }),
  },
})

const result = await agent.generate({
  messages: [{ role: 'user', content: 'What is the weather in Beijing?' }],
})

console.log(result.output)
```

### FIM 补全

```ts
import { createModel, fim } from 'deepseek-kit'

const model = createModel({ model: 'deepseek-v4-flash' })

const result = await fim({
  model,
  prompt: 'function fib(a)',
  suffix: 'return fib(a-1) + fib(a-2)',
})

console.log(result.text)
```

### Hook 机制

```ts
import { createModel, generateText } from 'deepseek-kit'

const model = createModel({ model: 'deepseek-v4-flash' })

const result = await generateText({
  model,
  messages: [{ role: 'user', content: 'Hello' }],
  hooks: {
    beforeStep: (context, hookCtx) => {
      console.log(`Step ${context.step}`)
      return {
        messages: context.messages,
        config: { temperature: 0.7 },
      }
    },
    afterStep: (step, hookCtx) => {
      console.log(`Step ${step.step} finished: ${step.type}`)
    },
    onError: (error, hookCtx) => {
      console.error(`Error at step ${error.step}: ${error.message}`)
      return error
    },
  },
})
```

## API 参考

### `createModel(options: ModelOptions & { model: Model })`

创建模型实例。

```ts
const model = createModel({
  model: 'deepseek-v4-flash',
  apiKey: 'your-api-key',
  baseURL: 'https://api.deepseek.com',
  thinking: { type: 'enabled' },
  temperature: 0.7,
  maxTokens: 4096,
})

const proModel = model.withConfig({ model: 'deepseek-v4-pro' })
```

### `DeepSeekModel`

| 方法 | 说明 |
|------|------|
| `invoke(params)` | 发送聊天补全请求 |
| `invokeStream(params)` | 流式聊天补全 |
| `fim(params)` | FIM 代码补全 |
| `list()` | 获取可用模型列表 |
| `balance()` | 查询账户余额 |
| `withConfig(options)` | 创建新实例并合并配置，可用于切换模型 |

### `generateText(params)`

生成文本，支持工具调用和结构化输出。返回 `Promise<GenerateTextResult>`。

### `generateStream(params)`

流式生成文本，返回 `AsyncGenerator<StreamEvent>`。

StreamEvent 类型：
- `text-delta` — 文本增量
- `reasoning-delta` — 推理内容增量
- `tool-call` — 工具调用
- `step` — 步骤开始
- `finish` — 生成完成

### `createAgent(config)`

创建 Agent，返回 `{ generate, stream }` 方法。

### `tool(config)`

定义工具，支持参数校验、超时和重试。

```ts
const myTool = tool({
  name: 'my_tool',
  description: 'Tool description',
  schema: z.object({ key: z.string() }),
  execute: async args => args.key,
  strict: true,
  required: true,
  timeout: 60000,
  retries: 0,
})
```

### `fim(params)`

Fill-in-the-Middle 代码补全。

## 贡献

请参考 [CONTRIBUTING.md](./CONTRIBUTING.md)。

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
