import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

import { registerTools } from './tools.js'

function getPackageVersion(): string {
  const packageJsonUrl = new URL('../package.json', import.meta.url)
  const packageJson = JSON.parse(readFileSync(packageJsonUrl, 'utf8')) as { version?: string }

  if (!packageJson.version) {
    throw new Error('Unable to determine @groowooth/mcp package version.')
  }

  return packageJson.version
}

export async function main(): Promise<void> {
  const server = new McpServer({
    name: 'groowooth',
    version: getPackageVersion()
  })

  registerTools(server)

  const transport = new StdioServerTransport()
  await server.connect(transport)
}

const isDirectExecution = process.argv[1] === fileURLToPath(import.meta.url)

if (isDirectExecution) {
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
