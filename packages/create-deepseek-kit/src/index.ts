import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { cancel, intro, isCancel, note, outro, text } from '@clack/prompts'
import { dim, lightBlue, lightGreen } from 'kolorist'

async function main() {
  const argName = process.argv[2]

  // eslint-disable-next-line no-console
  console.log()
  intro(lightBlue('🐳 Creator DeepSeek Kit'))

  let projectName = argName

  if (!projectName) {
    const name = await text({
      message: '🌊 Project name',
      placeholder: 'my-deepseek-agent',
      initialValue: 'my-deepseek-agent',
      validate: (value) => {
        if (!value)
          return '🐙 Project name is required'
      },
    })
    if (isCancel(name)) {
      cancel('Operation cancelled.')
      process.exit(0)
    }
    projectName = name
  }

  const projectDir = path.resolve(projectName)

  if (fs.existsSync(projectDir)) {
    cancel(`🦀 Directory ${projectName} already exists`)
    process.exit(1)
  }

  fs.mkdirSync(projectDir, { recursive: true })

  const packageJson = {
    name: projectName,
    type: 'module',
    version: '1.0.0',
    private: true,
    scripts: {
      dev: 'node --import tsx index.ts',
    },
    dependencies: {
      'deepseek-kit': 'latest',
      'dotenv': 'latest',
      'zod': '^4',
    },
    devDependencies: {
      tsx: '^4.21.0',
    },
  }

  const indexTs = `import { createAgent, createModel, tool } from 'deepseek-kit'
import { z } from 'zod'

const model = createModel({ model: 'deepseek-v4-flash' })

const weatherTool = tool({
  name: 'get_weather',
  description: 'Get weather information for a city',
  schema: z.object({
    city: z.string().describe('City name'),
  }),
  execute: async ({ city }) => \`\${city}: Sunny, 25°C\`,
})

const agent = createAgent({
  model,
  tools: [weatherTool],
  output: {
    schema: z.object({
      city: z.string(),
      weather: z.string(),
      temperature: z.number(),
    }),
  },
})

const result = await agent.generate({
  prompt: 'How\\'s the weather in Chongqing today?',
})

console.log(result.output)
`

  const envExample = `DEEPSEEK_API_KEY=your_api_key_here
`

  fs.writeFileSync(path.join(projectDir, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`)
  fs.writeFileSync(path.join(projectDir, 'src', 'index.ts'), indexTs)
  fs.writeFileSync(path.join(projectDir, '.env'), envExample)

  const gettingStarted = `
${dim('$')} ${lightGreen(`cd ${projectName}`)}
${dim('$')} ${lightGreen('pnpm install')}
${dim('$')} ${lightGreen('pnpm dev')}`

  note(gettingStarted.trim().replace(/^\t\t\t/gm, ''), dim('🦭 Getting Started'))
  outro('🐳 DeepSeek Kit project created!!')
  // eslint-disable-next-line no-console
  console.log()
}

main()
