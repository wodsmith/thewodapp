---
lat:
  require-code-mention: true
---
# Worktree environment tests

Isolated filesystem and subprocess tests verify [[architecture#Tech Stack#Shared Worktree Database Environment]] without reading real credentials or connecting to a database.

## Literal secrets and existing settings

Setup preserves literal dollar signs, hashes, spaces, unrelated multiline values, and comments while replacing duplicate managed assignments, restricting file permissions, and remaining idempotent.

## Missing and rotated credentials

Checks reject missing settings and rotated database or TypeSafe credentials without writing files or printing secret values, then pass after setup refreshes the files.

## App selection

Crew setup requires only database configuration. Invalid app names, including inherited object properties, fail with an actionable selection error.

## Startup enforcement

Each app's pnpm development command rejects missing shared configuration before launching Vite or portless, even when pnpm lifecycle hooks are disabled.
