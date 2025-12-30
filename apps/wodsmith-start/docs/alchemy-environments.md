# Alchemy Environments Guide

This guide covers how wodsmith-start uses Alchemy's stage-based environment model to manage isolated infrastructure across development, staging, and production.

## Overview

Alchemy uses a **stage-based** architecture where each stage represents a completely isolated deployment environment. Think of stages as parallel universes - each has its own database, KV namespace, R2 bucket, and Worker deployment that never interfere with each other.

```
┌─────────────────────────────────────────────────────────────┐
│                     Alchemy Stages                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   dev                 staging               prod            │
│   ┌─────────┐        ┌─────────┐        ┌─────────┐        │
│   │ DB-dev  │        │ DB-stag │        │ DB-prod │        │
│   │ KV-dev  │        │ KV-stag │        │ KV-prod │        │
│   │ R2-dev  │        │ R2-stag │        │ R2-prod │        │
│   │ Worker  │        │ Worker  │        │ Worker  │        │
│   └─────────┘        └─────────┘        └─────────┘        │
│                                                             │
│   Isolation: Each stage has completely separate resources   │
└─────────────────────────────────────────────────────────────┘
```

## Why Stage-Based Environments?

1. **Zero Risk of Cross-Environment Contamination** - Dev changes can't accidentally affect production
2. **Predictable Naming** - Resources follow `{name}-{stage}` convention
3. **Easy Cleanup** - Destroy an entire stage with one command
4. **Parallel Development** - Multiple developers can have their own stages

## Environment Configuration

### The STAGE Environment Variable

The `STAGE` environment variable is the single source of truth for which environment you're targeting:

| STAGE Value | Environment | Resource Suffix |
|-------------|-------------|-----------------|
| `dev` (default) | Development | `-dev` |
| `staging` | Staging | `-staging` |
| `prod` | Production | `-prod` |

### Resource Naming Convention

All Cloudflare resources are automatically prefixed with the stage:

| Resource | dev | staging | prod |
|----------|-----|---------|------|
| D1 Database | `wodsmith-db-dev` | `wodsmith-db-staging` | `wodsmith-db-prod` |
| KV Namespace | `wodsmith-sessions-dev` | `wodsmith-sessions-staging` | `wodsmith-sessions-prod` |
| R2 Bucket | `wodsmith-uploads-dev` | `wodsmith-uploads-staging` | `wodsmith-uploads-prod` |

## Deployment Commands

### Development (Default)

```bash
# Deploy to dev (creates/updates resources)
npx alchemy deploy

# Explicitly specify dev stage
STAGE=dev npx alchemy deploy

# Run locally with emulated bindings
npx alchemy deploy --dev
```

### Staging

```bash
# Deploy to staging
STAGE=staging npx alchemy deploy

# Verify staging deployment
npx wrangler d1 execute wodsmith-db-staging --command "SELECT 1" --remote
```

### Production

```bash
# Deploy to production
STAGE=prod npx alchemy deploy

# Production with verbose logging
STAGE=prod npx alchemy deploy --verbose
```

### Destroying Environments

```bash
# Destroy dev resources (safe to do frequently)
npx alchemy deploy --destroy

# Destroy staging
STAGE=staging npx alchemy deploy --destroy

# Destroy production (DANGER - requires confirmation)
STAGE=prod npx alchemy deploy --destroy
```

## Deployment Phases

Alchemy operates in two phases:

### `up` Phase (Default)

Creates or updates infrastructure to match your configuration:
- New resources are created
- Existing resources are updated
- Removed resources are deleted
- Migrations are applied

### `destroy` Phase

Tears down all resources for a stage:
- All stage resources are deleted
- State file is cleared
- **Irreversible** - data is lost

```bash
# Phase is controlled via --destroy flag
npx alchemy deploy           # up phase
npx alchemy deploy --destroy # destroy phase
```

## State Management

Alchemy tracks resource state to enable incremental deployments.

### State Storage

| Mode | Location | Use Case |
|------|----------|----------|
| Local (default) | `.alchemy/` directory | Development, CI/CD |
| Cloudflare | KV Namespace | Multi-machine deployments |

### State File Structure

```
.alchemy/
├── wodsmith-start/
│   ├── dev.state.enc       # Encrypted dev state
│   ├── staging.state.enc   # Encrypted staging state
│   └── prod.state.enc      # Encrypted prod state
```

### State Encryption

State files contain sensitive information and are encrypted using `ALCHEMY_PASSWORD`:

```bash
# Set encryption password (required for deployment)
export ALCHEMY_PASSWORD="your-secure-password"

# Different passwords per environment (optional but recommended)
export ALCHEMY_PASSWORD_PROD="production-secure-password"
```

## Environment-Specific Configuration

### Custom Domains

Production typically has a custom domain; dev/staging use workers.dev:

```typescript
// In alchemy.run.ts
const website = await TanStackStart("wodsmith-start", {
  bindings: { /* ... */ },
  // Only set custom domain for production
  domains: app.stage === "prod" ? ["start.wodsmith.com"] : [],
})
```

### Environment Variables

Access stage in your application via the deployment:

```typescript
// Server-side: access via Cloudflare env
export const getData = createServerFn()
  .handler(async ({ context }) => {
    // Environment bindings are available on context.cloudflare.env
    const env = context.cloudflare.env
    // Use env.DB, env.KV_SESSION, env.R2_BUCKET
  })
```

## Best Practices

### 1. Never Share State Files

State files contain resource IDs and encrypted secrets. Keep them in `.gitignore`:

```gitignore
# .gitignore
.alchemy/
```

### 2. Use Separate Passwords Per Environment

```bash
# dev can use a simple password
ALCHEMY_PASSWORD=dev-password

# prod should use a strong, unique password
ALCHEMY_PASSWORD=prod-$(openssl rand -hex 32)
```

### 3. Test Migrations in Staging First

```bash
# Always deploy to staging before production
STAGE=staging npx alchemy deploy

# Verify everything works
# Then deploy to production
STAGE=prod npx alchemy deploy
```

### 4. Automate with npm Scripts

```json
{
  "scripts": {
    "deploy": "npx alchemy deploy",
    "deploy:staging": "STAGE=staging npx alchemy deploy",
    "deploy:prod": "STAGE=prod npx alchemy deploy",
    "destroy:dev": "npx alchemy deploy --destroy"
  }
}
```

### 5. CI/CD Pipeline Pattern

```yaml
# GitHub Actions example
deploy-staging:
  runs-on: ubuntu-latest
  environment: staging
  steps:
    - run: STAGE=staging npx alchemy deploy
      env:
        ALCHEMY_PASSWORD: ${{ secrets.ALCHEMY_PASSWORD_STAGING }}
        CLOUDFLARE_API_TOKEN: ${{ secrets.CF_API_TOKEN }}

deploy-prod:
  needs: deploy-staging
  runs-on: ubuntu-latest
  environment: production
  steps:
    - run: STAGE=prod npx alchemy deploy
      env:
        ALCHEMY_PASSWORD: ${{ secrets.ALCHEMY_PASSWORD_PROD }}
        CLOUDFLARE_API_TOKEN: ${{ secrets.CF_API_TOKEN }}
```

## Troubleshooting

### "Resource already exists"

This happens when state is out of sync with actual Cloudflare resources.

**Solution:** Import existing resources or delete them manually:
```bash
# Option 1: Delete from Cloudflare dashboard, then redeploy
npx alchemy deploy

# Option 2: Use wrangler to delete
npx wrangler d1 delete wodsmith-db-dev
```

### "State file not found"

First deployment or state file was deleted.

**Solution:** Alchemy will create new state automatically:
```bash
# Just deploy - state will be created
npx alchemy deploy
```

### "Decryption failed"

Wrong `ALCHEMY_PASSWORD` for the state file.

**Solution:** Use the correct password or start fresh:
```bash
# If you lost the password, delete state and redeploy
rm -rf .alchemy/wodsmith-start/dev.state.enc
npx alchemy deploy
```

### "Migration failed"

Database migration SQL has errors.

**Solution:** Check migration files and fix syntax:
```bash
# Test migration locally first
npx wrangler d1 execute wodsmith-db --local --file=src/db/migrations/0001_new.sql
```

### "Worker deployment failed"

Usually a build error or binding mismatch.

**Solution:** Check build output and binding names:
```bash
# Verify build works
npm run build

# Check that all bindings exist
npx wrangler d1 list
npx wrangler kv:namespace list
npx wrangler r2 bucket list
```

## Quick Reference

| Task | Command |
|------|---------|
| Deploy to dev | `npx alchemy deploy` |
| Deploy to staging | `STAGE=staging npx alchemy deploy` |
| Deploy to prod | `STAGE=prod npx alchemy deploy` |
| Destroy dev | `npx alchemy deploy --destroy` |
| Local dev mode | `npx alchemy deploy --dev` |
| View state | `cat .alchemy/wodsmith-start/dev.state.enc` |

## Further Reading

- [Alchemy Documentation](https://alchemy.run/docs)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [D1 Database Docs](https://developers.cloudflare.com/d1/)
- [Source: alchemy.run.ts](../alchemy.run.ts) - Inline JSDoc with implementation details
