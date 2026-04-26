#!/usr/bin/env node

import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'

const __filename = fileURLToPath(import.meta.url)

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
      files.push(...(await walk(fullPath)))
    } else if (entry.isFile() && entry.name.endsWith('.test.ts')) {
      files.push(fullPath)
    }
  }
  return files
}

async function findTestFiles(rootDir) {
  const packagesDir = path.join(rootDir, 'packages')
  try {
    await readdir(packagesDir)
    return walk(packagesDir)
  } catch {
    return walk(rootDir)
  }
}

const cwd = process.cwd()
const files = (await findTestFiles(cwd)).sort()

for (const file of files) {
  await import(pathToFileURL(file).href)
}

const state = globalThis.__miniVitest
let failures = 0

for (const testCase of state.tests) {
  try {
    await testCase.fn()
    console.log(`✓ ${testCase.name}`)
  } catch (error) {
    failures += 1
    console.error(`✗ ${testCase.name}`)
    console.error(error instanceof Error ? error.stack ?? error.message : String(error))
  }
}

console.log(`\nTests: ${state.tests.length - failures} passed, ${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
