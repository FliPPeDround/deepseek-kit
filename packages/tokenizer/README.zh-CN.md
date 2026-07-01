# @deepseek-kit/tokenizer

[![npm version](https://img.shields.io/npm/v/@deepseek-kit/tokenizer.svg)](https://npmjs.com/package/@deepseek-kit/tokenizer)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

离线计算 DeepSeek 模型文本的 Token 用量——基于 Transformers.js。无需 API 密钥、无需网络请求、不产生 API 费用。

**[English](./README.md)** · **[文档站点](https://deepseek-kit.vercel.app/zh/packages/tokenizer)**

## 特性

- **离线运行** — 内置 DeepSeek 分词器词表，完全在本地运行
- **零成本** — 计算 Token 无需调用 API
- **轻量** — 基于 Transformers.js（`@huggingface/transformers`）
- **TypeScript** — 包含完整的类型定义

## 安装

```bash
pnpm add @deepseek-kit/tokenizer
```

## 用法

### 计算 Token 数

```ts
import { countTokens } from '@deepseek-kit/tokenizer'

const count = await countTokens('Hello, world!')
console.log(count)
// 4
```

## API

### `countTokens(text: string): Promise<number>`

计算给定文本的 Token 数量。

## 许可证

[MIT](../../LICENSE.md)
