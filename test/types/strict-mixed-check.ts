/* eslint-disable unused-imports/no-unused-vars */
import type { ConsistentTools, NonStrictTool, StrictTool } from '@/tool/types'
import { z } from 'zod'
import { tool } from '@/tool'

type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2) ? true : false
type Extends<X, Y> = X extends Y ? true : false
type Not<T extends boolean> = T extends true ? false : true
type Expect<T extends true> = T

const strictTool = tool({
  name: 'a',
  description: 'a',
  strict: true,
  schema: z.object({ city: z.string() }),
  execute: async ({ city }) => city,
})

const nonStrictTool = tool({
  name: 'b',
  description: 'b',
  schema: z.object({ city: z.string() }),
  execute: async ({ city }) => city,
})

const explicitFalseTool = tool({
  name: 'c',
  description: 'c',
  strict: false,
  schema: z.object({ city: z.string() }),
  execute: async ({ city }) => city,
})

type _T1 = Expect<Equal<typeof strictTool, StrictTool>>
type _T2 = Expect<Equal<typeof nonStrictTool, NonStrictTool>>
type _T3 = Expect<Equal<typeof explicitFalseTool, NonStrictTool>>

type _T4 = Expect<Not<Extends<[typeof strictTool, typeof nonStrictTool], ConsistentTools>>>
type _T5 = Expect<Not<Extends<[typeof nonStrictTool, typeof strictTool], ConsistentTools>>>
type _T6 = Expect<Not<Extends<(StrictTool | NonStrictTool)[], ConsistentTools>>>
