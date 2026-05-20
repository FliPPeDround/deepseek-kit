---
title: 首页
navigation: false
description: DeepSeek 原生级适配的轻量 Agent 框架，思考模式精准工具调用、可靠结构化输出、极致缓存命中。
---

::hero
---
announcement:
  title: 'deepseek-kit'
  icon: '🚀'
  to: /zh/getting-started/overview
actions:
  - name: 开始使用
    to: /zh/getting-started/installation
  - name: GitHub
    variant: outline
    to: https://github.com/flippedround/deepseek-kit
    leftIcon: 'lucide:github'
---

#title
DeepSeek Kit

#description
DeepSeek 原生级适配的轻量 Agent 框架。 :br 思考模式精准工具调用 · 可靠结构化输出 · 极致缓存命中。
::

::card-group{:cols="3"}
  ::card
  ---
  title: Agent 系统
  icon: lucide:bot
  to: /zh/core/agents
  ---
  创建具有工具调用能力和多步执行的智能代理。
  ::

  ::card
  ---
  title: 子智能体
  icon: lucide:git-branch
  to: /zh/core/subagents
  ---
  将智能体封装为工具进行委派，支持上下文隔离与并行执行。
  ::

  ::card
  ---
  title: 工具调用
  icon: lucide:wrench
  to: /zh/core/tools
  ---
  内置工具定义、参数校验、超时与重试支持。
  ::

  ::card
  ---
  title: 结构化输出
  icon: lucide:file-json
  to: /zh/core/output
  ---
  基于 Zod Schema 的 JSON 结构化输出，支持类型推断。
  ::

  ::card
  ---
  title: FIM 补全
  icon: lucide:code
  to: /zh/api/fim
  ---
  支持 Fill-in-the-Middle 代码补全，适用于 IDE 体验。
  ::

  ::card
  ---
  title: Hook 机制
  icon: lucide:anchor
  to: /zh/core/hooks
  ---
  通过生命周期 Hook 在生成步骤前后插入自定义逻辑。
  ::
::
