#!/usr/bin/env bun
/**
 * Initialize Ralph in a project
 *
 * Usage: bun .claude/skills/ralph-mode/scripts/init-ralph.ts [target-dir]
 *
 * Creates the scripts/ralph/ directory with all necessary files.
 */

import {existsSync, mkdirSync, copyFileSync, writeFileSync, chmodSync} from 'fs'
import {join, dirname} from 'path'

const SCRIPT_DIR = dirname(new URL(import.meta.url).pathname)
const TARGET_DIR = process.argv[2] || process.cwd()
const RALPH_DIR = join(TARGET_DIR, 'scripts', 'ralph')

console.log('🚀 Initializing Ralph...')
console.log(`   Target: ${RALPH_DIR}`)

// Check if ralph directory already exists
if (existsSync(RALPH_DIR)) {
  console.log('\n⚠️  scripts/ralph/ already exists.')
  console.log('   Delete it first if you want to reinitialize.')
  process.exit(1)
}

// Create directory structure
mkdirSync(RALPH_DIR, {recursive: true})
console.log('\n✅ Created scripts/ralph/')

// Copy ralph.sh
const ralphShSrc = join(SCRIPT_DIR, 'ralph.sh')
const ralphShDest = join(RALPH_DIR, 'ralph.sh')
copyFileSync(ralphShSrc, ralphShDest)
chmodSync(ralphShDest, 0o755)
console.log('✅ Copied ralph.sh')

// Copy ralph-once.sh
const ralphOnceSrc = join(SCRIPT_DIR, 'ralph-once.sh')
const ralphOnceDest = join(RALPH_DIR, 'ralph-once.sh')
copyFileSync(ralphOnceSrc, ralphOnceDest)
chmodSync(ralphOnceDest, 0o755)
console.log('✅ Copied ralph-once.sh')

// Copy prompt.md (local mode)
const promptSrc = join(SCRIPT_DIR, 'prompt.md')
const promptDest = join(RALPH_DIR, 'prompt.md')
copyFileSync(promptSrc, promptDest)
console.log('✅ Copied prompt.md (local mode)')

// Copy ralph-controller.md (remote mode)
const controllerSrc = join(SCRIPT_DIR, 'ralph-controller.md')
const controllerDest = join(RALPH_DIR, 'ralph-controller.md')
copyFileSync(controllerSrc, controllerDest)
console.log('✅ Copied ralph-controller.md (remote mode)')

// Copy ralph-worker.md (remote mode)
const workerSrc = join(SCRIPT_DIR, 'ralph-worker.md')
const workerDest = join(RALPH_DIR, 'ralph-worker.md')
copyFileSync(workerSrc, workerDest)
console.log('✅ Copied ralph-worker.md (remote mode)')

// Create prd.json from template
const prdTemplate = join(SCRIPT_DIR, 'prd.template.json')
const prdDest = join(RALPH_DIR, 'prd.json')
copyFileSync(prdTemplate, prdDest)
console.log('✅ Created prd.json (edit this with your user stories)')

// Create progress.txt
const progressContent = `# Ralph Progress Log
Started: ${new Date().toISOString().split('T')[0]}

## Codebase Patterns
(Patterns discovered during this session will be added here)

## Key Files
(Important files for this feature will be documented here)

---
`
writeFileSync(join(RALPH_DIR, 'progress.txt'), progressContent)
console.log('✅ Created progress.txt')

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('🎉 Ralph initialized successfully!')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('\nNext steps:')
console.log('1. Edit scripts/ralph/prd.json with your user stories')
console.log('2. Optionally customize prompts for your project')
console.log('')
console.log('Local mode (CLI):')
console.log('  ./scripts/ralph/ralph-once.sh       # HITL: single iteration')
console.log('  ./scripts/ralph/ralph.sh [N]        # AFK: N iterations')
console.log('')
console.log('Remote mode (Web/API):')
console.log('  Load ralph-controller.md and follow its instructions')
console.log('  Controller spawns Task subagents for each story')
console.log('')
