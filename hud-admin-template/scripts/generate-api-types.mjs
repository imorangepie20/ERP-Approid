import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const source = process.env.OPENAPI_CORE_URL ?? 'http://127.0.0.1:38080/v3/api-docs'
const cli = fileURLToPath(new URL('../node_modules/openapi-typescript/bin/cli.js', import.meta.url))
const output = fileURLToPath(new URL('../src/api/generated/core.ts', import.meta.url))

const result = spawnSync(process.execPath, [cli, source, '--output', output], {
    stdio: 'inherit',
})

if (result.error) throw result.error
process.exitCode = result.status ?? 1
