/**
 * Cleanup Orphaned PR Preview Resources Script
 *
 * Scans Cloudflare for PR preview resources (Workers, D1, KV, R2) and
 * deletes those that are no longer associated with open pull requests.
 *
 * Usage:
 *   bun scripts/cleanup-pr-resources.ts --dry-run   # Preview what would be deleted
 *   bun scripts/cleanup-pr-resources.ts             # Actually delete orphaned resources
 *
 * Resource naming patterns:
 *   - Workers: wodsmith-app-pr-{NUMBER}
 *   - D1: wodsmith-db-pr-{NUMBER}
 *   - KV: wodsmith-wodsmith-sessions-pr-{NUMBER}
 *   - R2: wodsmith-wodsmith-uploads-pr-{NUMBER}
 */

import {execSync} from 'node:child_process'

// Resource naming patterns
const PATTERNS = {
  workers: /^wodsmith-app-pr-(\d+)$/,
  d1: /^wodsmith-db-pr-(\d+)$/,
  kv: /^wodsmith-wodsmith-sessions-pr-(\d+)$/,
  r2: /^wodsmith-wodsmith-uploads-pr-(\d+)$/,
}

interface D1Database {
  uuid: string
  name: string
}

interface KVNamespace {
  id: string
  title: string
}

interface R2Bucket {
  name: string
  creation_date: string
}

interface OrphanedResources {
  workers: Array<{name: string; prNumber: number}>
  d1: Array<{name: string; uuid: string; prNumber: number}>
  kv: Array<{name: string; id: string; prNumber: number}>
  r2: Array<{name: string; prNumber: number}>
}

/**
 * Runs a shell command and returns the output as a string.
 */
function runCommand(command: string): string {
  try {
    return execSync(command, {encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe']})
  } catch (error) {
    // Return empty string for failed commands (resource may not exist)
    return ''
  }
}

/**
 * Runs a shell command that may fail, logging the result.
 */
function runCommandWithOutput(command: string, description: string): boolean {
  try {
    execSync(command, {stdio: 'inherit'})
    console.log(`  ✓ ${description}`)
    return true
  } catch {
    console.log(`  ✗ ${description} (may already be deleted)`)
    return false
  }
}

/**
 * Fetches list of open PRs from GitHub.
 */
function getOpenPRs(): number[] {
  const output = runCommand('gh pr list --repo wodsmith/thewodapp --state open --json number')
  if (!output) {
    console.error('❌ Failed to fetch open PRs. Make sure gh CLI is installed and authenticated.')
    process.exit(1)
  }

  try {
    const prs: Array<{number: number}> = JSON.parse(output)
    return prs.map((pr) => pr.number)
  } catch {
    console.error('❌ Failed to parse PR list')
    process.exit(1)
  }
}

/**
 * Extracts PR number from a resource name using the given pattern.
 */
function extractPRNumber(name: string, pattern: RegExp): number | null {
  const match = name.match(pattern)
  return match ? parseInt(match[1], 10) : null
}

/**
 * Lists all PR-related D1 databases.
 */
function listD1Databases(): Array<{name: string; uuid: string; prNumber: number}> {
  const output = runCommand('wrangler d1 list --json 2>/dev/null')
  if (!output) {
    return []
  }

  try {
    const databases: D1Database[] = JSON.parse(output)
    return databases
      .map((db) => {
        const prNumber = extractPRNumber(db.name, PATTERNS.d1)
        if (prNumber !== null) {
          return {name: db.name, uuid: db.uuid, prNumber}
        }
        return null
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
  } catch {
    return []
  }
}

/**
 * Lists all PR-related KV namespaces.
 */
function listKVNamespaces(): Array<{name: string; id: string; prNumber: number}> {
  const output = runCommand('wrangler kv namespace list --json 2>/dev/null')
  if (!output) {
    return []
  }

  try {
    const namespaces: KVNamespace[] = JSON.parse(output)
    return namespaces
      .map((ns) => {
        const prNumber = extractPRNumber(ns.title, PATTERNS.kv)
        if (prNumber !== null) {
          return {name: ns.title, id: ns.id, prNumber}
        }
        return null
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
  } catch {
    return []
  }
}

/**
 * Lists all PR-related R2 buckets.
 */
function listR2Buckets(): Array<{name: string; prNumber: number}> {
  const output = runCommand('wrangler r2 bucket list --json 2>/dev/null')
  if (!output) {
    return []
  }

  try {
    const buckets: R2Bucket[] = JSON.parse(output)
    return buckets
      .map((bucket) => {
        const prNumber = extractPRNumber(bucket.name, PATTERNS.r2)
        if (prNumber !== null) {
          return {name: bucket.name, prNumber}
        }
        return null
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
  } catch {
    return []
  }
}

/**
 * Infers worker names from D1 databases (workers and D1 are created together).
 */
function inferWorkersFromD1(
  d1Databases: Array<{name: string; uuid: string; prNumber: number}>,
): Array<{name: string; prNumber: number}> {
  return d1Databases.map((db) => ({
    name: `wodsmith-app-pr-${db.prNumber}`,
    prNumber: db.prNumber,
  }))
}

/**
 * Identifies orphaned resources (not associated with open PRs).
 */
function findOrphanedResources(
  openPRs: Set<number>,
  workers: Array<{name: string; prNumber: number}>,
  d1: Array<{name: string; uuid: string; prNumber: number}>,
  kv: Array<{name: string; id: string; prNumber: number}>,
  r2: Array<{name: string; prNumber: number}>,
): OrphanedResources {
  return {
    workers: workers.filter((w) => !openPRs.has(w.prNumber)),
    d1: d1.filter((db) => !openPRs.has(db.prNumber)),
    kv: kv.filter((ns) => !openPRs.has(ns.prNumber)),
    r2: r2.filter((bucket) => !openPRs.has(bucket.prNumber)),
  }
}

/**
 * Deletes orphaned resources.
 */
function deleteOrphanedResources(orphans: OrphanedResources): number {
  let deletedCount = 0

  console.log('\nDeleting orphaned resources...')

  // Delete Workers first (they depend on bindings)
  for (const worker of orphans.workers) {
    if (runCommandWithOutput(`wrangler delete ${worker.name} --force 2>/dev/null`, `Deleted worker ${worker.name}`)) {
      deletedCount++
    }
  }

  // Delete D1 databases
  for (const db of orphans.d1) {
    if (runCommandWithOutput(`wrangler d1 delete ${db.name} -y 2>/dev/null`, `Deleted D1 ${db.name}`)) {
      deletedCount++
    }
  }

  // Delete KV namespaces (need to use ID)
  for (const ns of orphans.kv) {
    if (runCommandWithOutput(`wrangler kv namespace delete --namespace-id ${ns.id} 2>/dev/null`, `Deleted KV ${ns.name}`)) {
      deletedCount++
    }
  }

  // Delete R2 buckets
  for (const bucket of orphans.r2) {
    if (runCommandWithOutput(`wrangler r2 bucket delete ${bucket.name} 2>/dev/null`, `Deleted R2 ${bucket.name}`)) {
      deletedCount++
    }
  }

  return deletedCount
}

/**
 * Formats PR numbers for display.
 */
function formatPRNumbers(items: Array<{prNumber: number}>): string {
  if (items.length === 0) return '(none)'
  return items.map((i) => `pr-${i.prNumber}`).join(', ')
}

/**
 * Main entry point.
 */
async function main(): Promise<void> {
  const isDryRun = process.argv.includes('--dry-run')

  console.log('🔍 Scanning for orphaned PR preview resources...\n')

  // Get open PRs
  const openPRs = getOpenPRs()
  const openPRSet = new Set(openPRs)
  console.log(`Open PRs: ${openPRs.length > 0 ? openPRs.join(', ') : '(none)'}\n`)

  // List all resources
  console.log('Found Cloudflare resources:')

  const d1Databases = listD1Databases()
  const kvNamespaces = listKVNamespaces()
  const r2Buckets = listR2Buckets()

  // Infer workers from D1 (workers don't have a list command)
  const workers = inferWorkersFromD1(d1Databases)

  console.log(`  Workers: ${formatPRNumbers(workers)}`)
  console.log(`  D1: ${formatPRNumbers(d1Databases)}`)
  console.log(`  KV: ${formatPRNumbers(kvNamespaces)}`)
  console.log(`  R2: ${formatPRNumbers(r2Buckets)}`)

  // Find orphaned resources
  const orphans = findOrphanedResources(openPRSet, workers, d1Databases, kvNamespaces, r2Buckets)

  const totalOrphans =
    orphans.workers.length + orphans.d1.length + orphans.kv.length + orphans.r2.length

  if (totalOrphans === 0) {
    console.log('\n✅ No orphaned resources found. Everything is clean!')
    return
  }

  console.log('\nOrphaned (will be deleted):')
  console.log(`  Workers: ${formatPRNumbers(orphans.workers)}`)
  console.log(`  D1: ${formatPRNumbers(orphans.d1)}`)
  console.log(`  KV: ${formatPRNumbers(orphans.kv)}`)
  console.log(`  R2: ${formatPRNumbers(orphans.r2)}`)

  if (isDryRun) {
    console.log(`\n[DRY RUN] Would delete ${totalOrphans} resources. Run without --dry-run to delete.`)
    return
  }

  // Actually delete
  const deletedCount = deleteOrphanedResources(orphans)

  console.log(`\n✅ Cleanup complete. Deleted ${deletedCount} resources.`)
}

main().catch((error) => {
  console.error('\n❌ Cleanup failed:', error.message)
  process.exit(1)
})
