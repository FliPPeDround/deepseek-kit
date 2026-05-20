---
title: Home
navigation: false
description: A lightweight Agent framework with native-level DeepSeek adaptation — Precise tool calling in thinking mode, reliable structured output, maximum cache hit rate.
---

::hero
---
announcement:
  title: 'deepseek-kit'
  icon: '🚀'
  to: /getting-started/overview
actions:
  - name: Get Started
    to: /getting-started/installation
  - name: GitHub
    variant: outline
    to: https://github.com/flippedround/deepseek-kit
    leftIcon: 'lucide:github'
---

#title
Deepseek Kit

#description
A lightweight Agent framework with native-level DeepSeek adaptation.:br Precise tool calling in thinking mode · Reliable structured output · Maximum cache hit rate.
::

::card-group{:cols="3"}
  ::card
  ---
  title: Agent System
  icon: lucide:bot
  to: /core/agents
  ---
  Build intelligent agents with tool calling and multi-step execution.
  ::

  ::card
  ---
  title: Subagents
  icon: lucide:git-branch
  to: /core/subagents
  ---
  Encapsulate agents as tools for delegation, with isolated context and parallel execution.
  ::

  ::card
  ---
  title: Tool Calling
  icon: lucide:wrench
  to: /core/tools
  ---
  Built-in tool definition, parameter validation, timeout, and retry support.
  ::

  ::card
  ---
  title: Structured Output
  icon: lucide:file-json
  to: /core/output
  ---
  Zod Schema-driven JSON structured output with type inference.
  ::

  ::card
  ---
  title: FIM Completion
  icon: lucide:code
  to: /api/fim
  ---
  Fill-in-the-Middle code completion, ideal for IDE experiences.
  ::

  ::card
  ---
  title: Hook System
  icon: lucide:anchor
  to: /core/hooks
  ---
  Insert custom logic before and after generation steps via lifecycle hooks.
  ::
::
