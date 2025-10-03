# Turborepo Migration

This document describes the migration to Turborepo monorepo structure completed on October 2, 2025.

## Changes Made

### 1. Repository Structure
```
wodsmith/
├── apps/
│   └── wodsmith/          # Main Next.js application (moved from root)
├── packages/              # Future shared packages
├── pnpm-workspace.yaml    # Workspace configuration
├── turbo.json            # Turborepo configuration
├── package.json          # Root package.json with turbo scripts
└── .gitignore           # Updated with .turbo
```

### 2. Files Moved to `apps/wodsmith/`
- `src/` - Application source code
- `public/` - Static assets
- `test/` - Test files
- `scripts/` - Build and utility scripts
- `migrations/` - Database migrations
- `package.json` - Application dependencies
- Configuration files:
  - `next.config.mjs`
  - `tailwind.config.ts`
  - `postcss.config.mjs`
  - `components.json`
  - `drizzle.config.ts`
  - `wrangler.jsonc`
  - `vitest.config.mjs`
  - `tsconfig.json` and variants
  - `cloudflare-env.d.ts`
  - `custom-env.d.ts`
  - `.env.example`, `.dev.vars.example`

### 3. New Configuration Files

#### `pnpm-workspace.yaml`
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

#### `turbo.json`
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**"]
    },
    "dev": {
      "persistent": true,
      "cache": false
    },
    "lint": { "dependsOn": ["^lint"] },
    "format": { "dependsOn": ["^format"] },
    "check": { "dependsOn": ["^check"] },
    "type-check": { "dependsOn": ["^type-check"] },
    "test": { "dependsOn": ["^test"] },
    "db:generate": { "cache": false },
    "db:studio": { "persistent": true, "cache": false },
    "db:migrate:dev": { "cache": false },
    "db:migrate:prod": { "cache": false },
    "email:dev": { "persistent": true, "cache": false }
  }
}
```

#### Root `package.json`
```json
{
  "name": "wodsmith-monorepo",
  "private": true,
  "scripts": {
    "build": "turbo build",
    "dev": "turbo dev",
    "lint": "turbo lint",
    "format": "turbo format",
    "check": "turbo check",
    "type-check": "turbo type-check",
    "test": "turbo test",
    "db:generate": "turbo db:generate",
    "db:studio": "turbo db:studio",
    "db:migrate:dev": "turbo db:migrate:dev",
    "db:migrate:prod": "turbo db:migrate:prod",
    "email:dev": "turbo email:dev"
  },
  "devDependencies": {
    "turbo": "^2.5.8"
  },
  "packageManager": "pnpm@9.12.1",
  "engines": {
    "node": ">=18"
  }
}
```

### 4. `.gitignore` Updates
Added `.turbo` to ignore Turborepo cache directory.

## Running Commands

All commands now run through Turborepo from the root:

```bash
# Development
pnpm dev              # Start dev server
pnpm build            # Build application
pnpm lint             # Run linter
pnpm type-check       # TypeScript checking
pnpm test             # Run tests

# Database
pnpm db:generate      # Generate migrations
pnpm db:studio        # Open Drizzle Studio
pnpm db:migrate:dev   # Run migrations (dev)

# Email
pnpm email:dev        # Start email dev server
```

## Benefits

1. **Faster Builds**: Turborepo caches task outputs for faster subsequent runs
2. **Task Orchestration**: Automatically runs tasks in the correct order with `dependsOn`
3. **Scalability**: Easy to add more apps and shared packages
4. **Parallel Execution**: Runs independent tasks in parallel
5. **Remote Caching**: Can enable Vercel Remote Cache for team collaboration

## Future Additions

The monorepo structure is now ready for:
- **Shared packages** in `packages/`:
  - UI component library
  - Shared utilities
  - TypeScript configurations
  - ESLint/Biome configs
- **Additional apps** in `apps/`:
  - Admin dashboard
  - Marketing site
  - Mobile apps (React Native)

## Workspace Protocol

Use `workspace:*` protocol for dependencies between workspace packages:

```json
{
  "dependencies": {
    "@wodsmith/ui": "workspace:*",
    "@wodsmith/utils": "workspace:*"
  }
}
```

## Turbo Task Configuration

### Task Properties
- `dependsOn`: Specifies task dependencies (`^` prefix means dependencies first)
- `outputs`: Files to cache
- `persistent`: For long-running tasks (dev servers)
- `cache`: Whether to cache task outputs

### Example
```json
{
  "build": {
    "dependsOn": ["^build"],  // Build dependencies first
    "outputs": [".next/**"]    // Cache Next.js output
  },
  "dev": {
    "persistent": true,        // Long-running process
    "cache": false             // Don't cache
  }
}
```

## Migration Notes

- All dependencies remain in `apps/wodsmith/package.json`
- Root `package.json` only contains turbo and workspace metadata
- Husky hooks may need adjustment (`.git` is now at root)
- Local `.env` and `.dev.vars` files remain in `apps/wodsmith/` (not committed)

## Verification

Test the setup:
```bash
# Check turbo can detect the workspace
pnpm turbo lint --dry=json

# Run a build
pnpm build

# Start development
pnpm dev
```
