# @deepseek-kit/tokenizer

[![npm version](https://img.shields.io/npm/v/@deepseek-kit/tokenizer.svg)](https://npmjs.com/package/@deepseek-kit/tokenizer)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Calculate token usage of DeepSeek model text offline — powered by Transformers.js. No API key, no network requests, no API costs.

**[中文文档](./README.zh-CN.md)** · **[Documentation](https://deepseek-kit.vercel.app/packages/tokenizer)**

## Features

- **Offline** — Bundles the DeepSeek tokenizer vocabulary; runs entirely locally
- **Zero-cost** — No API calls needed for token counting
- **Lightweight** — Built on Transformers.js (`@huggingface/transformers`)
- **TypeScript** — Full type definitions included

## Installation

```bash
pnpm add @deepseek-kit/tokenizer
```

## Usage

### Count Tokens

```ts
import { countTokens } from '@deepseek-kit/tokenizer'

const count = await countTokens('Hello, world!')
console.log(count)
// 4
```

## API

### `countTokens(text: string): Promise<number>`

Counts the number of tokens in the given text.

## License

[MIT](../../LICENSE.md)
