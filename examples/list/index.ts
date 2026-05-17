/* eslint-disable no-console */
import { DeepSeekModel } from 'deepseek-kit'

const list = await DeepSeekModel.list()

console.log(list)
