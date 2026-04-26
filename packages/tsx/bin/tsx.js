#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const loaderPath = fileURLToPath(new URL('../loader.mjs', import.meta.url))
const registerLoader = `data:text/javascript,import { register } from "node:module"; import { pathToFileURL } from "node:url"; register(${JSON.stringify(
  loaderPath
)}, pathToFileURL("./"));`
const result = spawnSync(
  process.execPath,
  ['--experimental-strip-types', '--import', registerLoader, ...process.argv.slice(2)],
  { stdio: 'inherit' }
)

process.exit(result.status ?? 1)
