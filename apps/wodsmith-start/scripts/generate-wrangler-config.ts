/**
 * @fileoverview Generate wrangler.jsonc for CI/E2E tests.
 *
 * This script runs Alchemy in dev mode to generate the local wrangler.jsonc
 * configuration file, then exits cleanly. This is needed because `alchemy --dev`
 * normally starts watch mode which doesn't exit.
 *
 * Usage:
 *   bun scripts/generate-wrangler-config.ts
 *
 * The script will:
 * 1. Run alchemy.run.ts with --dev flag
 * 2. Wait for wrangler.jsonc to be generated
 * 3. Exit cleanly
 */

import {spawn} from 'node:child_process'
import {existsSync, watch} from 'node:fs'
import {resolve} from 'node:path'

const WRANGLER_CONFIG_PATH = resolve(
  import.meta.dirname,
  '../.alchemy/local/wrangler.jsonc',
)
const ALCHEMY_SCRIPT = resolve(import.meta.dirname, '../alchemy.run.ts')
const TIMEOUT_MS = 60_000 // 60 seconds max

async function main() {
  console.log('Generating wrangler.jsonc for local development...')

  // Start alchemy in dev mode
  const alchemyProcess = spawn('bun', [ALCHEMY_SCRIPT, '--dev'], {
    cwd: resolve(import.meta.dirname, '..'),
    stdio: 'inherit',
    env: {
      ...process.env,
      ALCHEMY_PASSWORD: process.env.ALCHEMY_PASSWORD || 'dev-password',
    },
  })

  // Wait for the config file to be generated or updated
  const startTime = Date.now()

  const waitForConfig = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      const checkFile = () => {
        if (existsSync(WRANGLER_CONFIG_PATH)) {
          // Give it a moment to finish writing
          setTimeout(resolve, 1000)
          return true
        }
        return false
      }

      // Check immediately
      if (checkFile()) return

      // Set up a watcher for the directory
      const watcher = watch(
        resolve(import.meta.dirname, '../.alchemy/local'),
        {recursive: true},
        (event, filename) => {
          if (filename === 'wrangler.jsonc') {
            watcher.close()
            setTimeout(resolve, 1000)
          }
        },
      )

      // Also poll in case the watcher misses it
      const interval = setInterval(() => {
        if (Date.now() - startTime > TIMEOUT_MS) {
          clearInterval(interval)
          watcher.close()
          reject(new Error('Timeout waiting for wrangler.jsonc'))
        }
        if (checkFile()) {
          clearInterval(interval)
          watcher.close()
        }
      }, 500)
    })
  }

  try {
    await waitForConfig()
    console.log(`\nwrangler.jsonc generated at: ${WRANGLER_CONFIG_PATH}`)

    // Kill the alchemy process since we got what we needed
    alchemyProcess.kill('SIGTERM')
    process.exit(0)
  } catch (error) {
    console.error('Failed to generate wrangler.jsonc:', error)
    alchemyProcess.kill('SIGTERM')
    process.exit(1)
  }
}

main()
