/* eslint-disable no-console */
import { createAgent, createModel, webSearch } from 'deepseek-kit'

const model = createModel({
  model: 'deepseek-v4-flash',
})

// 创建 web search 服务端工具
const searchTool = webSearch({
  // thinking: 'disabled',
  // maxTokens: 16384,
})

const agent = createAgent({
  model,
  tools: [searchTool],
})

const result = await agent.generate({
  prompt: '帮我搜索一个FliPPeDround在网上公开的项目和他分析是一个什么样的人',
})

console.log(result.text)
console.log(result.usage)
