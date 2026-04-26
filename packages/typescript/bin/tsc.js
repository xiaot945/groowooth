#!/usr/bin/env node

import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'

const __filename = fileURLToPath(import.meta.url)

if (process.argv.includes('--version')) {
  console.log('Version 0.0.0-groowooth')
  process.exit(0)
}

if (!process.execArgv.includes('--experimental-strip-types')) {
  const loaderPath = fileURLToPath(new URL('../../tsx/loader.mjs', import.meta.url))
  const registerLoader = `data:text/javascript,import { register } from "node:module"; import { pathToFileURL } from "node:url"; register(${JSON.stringify(
    loaderPath
  )}, pathToFileURL("./"));`
  const result = spawnSync(
    process.execPath,
    ['--experimental-strip-types', '--import', registerLoader, __filename, ...process.argv.slice(2)],
    { stdio: 'inherit' }
  )
  process.exit(result.status ?? 1)
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'dist' || entry.name === 'test' || entry.name === 'node_modules') {
        continue
      }
      files.push(...(await walk(fullPath)))
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      files.push(fullPath)
    }
  }

  return files
}

const srcDir = path.join(process.cwd(), 'src')
const files = await walk(srcDir)

for (const file of files) {
  await import(pathToFileURL(file).href)
}

console.log(`Checked ${files.length} TypeScript files with syntax/import validation.`)
