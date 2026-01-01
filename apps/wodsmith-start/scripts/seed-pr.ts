/**
 * PR Environment Database Seeding Script
 *
 * Seeds a remote D1 database with demo data for PR preview environments.
 * This script is designed to run in CI (GitHub Actions) to populate
 * PR-specific databases with minimal test data.
 *
 * SAFETY: Only runs when STAGE env var starts with 'pr-' (e.g., 'pr-42')
 *
 * Usage:
 *   STAGE=pr-42 pnpm db:seed:pr
 *
 * Database naming convention: wodsmith-db-{STAGE}
 *   e.g., wodsmith-db-pr-42
 *
 * Test User Credentials:
 *   Email: demo@wodsmith.com
 *   Password: DemoPassword123!
 */

import {execSync} from 'node:child_process'
import {existsSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCRIPTS_DIR = __dirname
const APP_DIR = join(__dirname, '..')

/**
 * Gets the STAGE environment variable and validates it's a PR stage.
 * @returns The validated stage value
 * @throws Error if STAGE is not set or doesn't start with 'pr-'
 */
function getAndValidateStage(): string {
  const stage = process.env.STAGE

  if (!stage) {
    console.error('❌ STAGE environment variable is required')
    console.error('   Usage: STAGE=pr-42 pnpm db:seed:pr')
    process.exit(1)
  }

  // Safety check: only allow PR stages to prevent accidental seeding of prod/staging
  if (!stage.startsWith('pr-')) {
    console.error(`❌ STAGE must start with 'pr-' for safety (got: ${stage})`)
    console.error('   This script is only intended for PR preview environments.')
    console.error('   For other environments, use the appropriate seed scripts.')
    process.exit(1)
  }

  return stage
}

/**
 * Constructs the database name from the stage.
 * @param stage - The stage value (e.g., 'pr-42')
 * @returns The database name (e.g., 'wodsmith-db-pr-42')
 */
function getDbName(stage: string): string {
  return `wodsmith-db-${stage}`
}

/**
 * Runs a shell command with error handling.
 * @param command - The command to run
 * @param description - A description for logging
 */
function runCommand(command: string, description: string): void {
  console.log(`\n📦 ${description}...`)
  try {
    execSync(command, {
      cwd: APP_DIR,
      stdio: 'inherit',
    })
    console.log(`✅ ${description} completed`)
  } catch (error) {
    console.error(`❌ ${description} failed`)
    throw error
  }
}

/**
 * Main entry point for PR database seeding.
 */
async function main(): Promise<void> {
  console.log('🚀 PR Environment Database Seeding')
  console.log('='.repeat(50))

  // Validate STAGE environment variable
  const stage = getAndValidateStage()
  const dbName = getDbName(stage)

  console.log(`📊 Stage: ${stage}`)
  console.log(`📊 Database: ${dbName}`)

  // Check that seed file exists
  const seedFile = join(SCRIPTS_DIR, 'seed-pr.sql')
  if (!existsSync(seedFile)) {
    console.error(`❌ Seed file not found: ${seedFile}`)
    process.exit(1)
  }

  console.log(`📄 Seed file: ${seedFile}`)

  // Run the seed against the remote database
  // Note: This assumes migrations have already been applied by the deploy process
  runCommand(
    `wrangler d1 execute ${dbName} --remote --file=./scripts/seed-pr.sql`,
    `Seeding ${dbName} with PR demo data`,
  )

  console.log('\n' + '='.repeat(50))
  console.log('✅ PR database seeding complete!')
  console.log('\nDemo credentials:')
  console.log('  Email:    demo@wodsmith.com')
  console.log('  Password: DemoPassword123!')
}

main().catch((error) => {
  console.error('\n❌ PR database seeding failed:', error.message)
  process.exit(1)
})
