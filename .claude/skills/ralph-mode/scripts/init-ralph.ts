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

// Copy prompt.md
const promptSrc = join(SCRIPT_DIR, 'prompt.md')
const promptDest = join(RALPH_DIR, 'prompt.md')
copyFileSync(promptSrc, promptDest)
console.log('✅ Copied prompt.md')

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
console.log('2. Optionally customize scripts/ralph/prompt.md')
console.log('3. Run HITL mode: ./scripts/ralph/ralph-once.sh')
console.log('4. Or AFK mode:   ./scripts/ralph/ralph.sh [iterations]')
console.log('')
