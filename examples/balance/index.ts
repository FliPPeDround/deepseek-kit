/* eslint-disable no-console */
import { DeepSeekModel } from 'deepseek-kit'

const balance = await DeepSeekModel.balance()

console.log(balance)
