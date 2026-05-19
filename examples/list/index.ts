/* eslint-disable no-console */
import { createModel } from 'deepseek-kit'

const model = createModel({ model: 'deepseek-v4-flash' })

const list = await model.list()

console.log(list)
