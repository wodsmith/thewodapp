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

## PR Preview Environments

Every pull request automatically gets its own isolated preview environment. This enables testing changes in a production-like setting before merging.

```
┌─────────────────────────────────────────────────────────────┐
│                   PR Preview Workflow                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   PR #42 opened                                             │
│        │                                                    │
│        ▼                                                    │
│   ┌─────────────────────────────────────────┐               │
│   │ STAGE=pr-42 npx alchemy deploy          │               │
│   │ • Creates wodsmith-db-pr-42             │               │
│   │ • Creates wodsmith-sessions-pr-42       │               │
│   │ • Creates wodsmith-uploads-pr-42        │               │
│   │ • Deploys Worker to pr-42.preview.*     │               │
│   │ • Seeds demo data automatically         │               │
│   └─────────────────────────────────────────┘               │
│        │                                                    │
│        ▼                                                    │
│   PR Comment: "Preview: https://pr-42.preview.wodsmith.com" │
│        │                                                    │
│        ▼                                                    │
│   PR merged/closed → Environment destroyed                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### How It Works

1. **PR Opens** → GitHub Actions triggers with `STAGE=pr-{number}`
2. **Deploy** → Alchemy creates all isolated resources (DB, KV, R2, Worker)
3. **Seed** → Demo data is automatically inserted for testing
4. **Comment** → PR receives a comment with the preview URL
5. **Update** → Subsequent pushes redeploy to the same environment
6. **Close** → PR close/merge triggers `--destroy` to clean up all resources

### Required GitHub Secrets

Add these secrets to your repository (Settings → Secrets and variables → Actions):

| Secret | Description | How to Generate |
|--------|-------------|-----------------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token with Workers/D1/KV/R2 permissions | [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens) |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID | Found in Cloudflare Dashboard URL |
| `ALCHEMY_PASSWORD` | Encryption password for state files | `openssl rand -base64 32` |
| `ALCHEMY_STATE_TOKEN` | Token for CloudflareStateStore in CI | `openssl rand -base64 32` |

**Generating tokens:**

```bash
# Generate ALCHEMY_PASSWORD
openssl rand -base64 32

# Generate ALCHEMY_STATE_TOKEN  
openssl rand -base64 32
```

### Preview Subdomain Routing

PR environments are accessible via preview subdomains:

| PR Number | Preview URL |
|-----------|-------------|
| PR #42 | `https://pr-42.preview.wodsmith.com` |
| PR #123 | `https://pr-123.preview.wodsmith.com` |
| PR #7 | `https://pr-7.preview.wodsmith.com` |

This is configured in `alchemy.run.ts`:

```typescript
function getDomains(stage: string): string[] {
  if (stage === "prod") {
    return ["start.wodsmith.com"]
  }
  if (stage.startsWith("pr-")) {
    return [`${stage}.preview.wodsmith.com`]
  }
  return [] // dev/staging use workers.dev
}
```

**DNS Setup:** Add a wildcard DNS record pointing `*.preview.wodsmith.com` to your Cloudflare zone.

### Database Seeding

PR environments are automatically seeded with demo data for testing:

**Demo Credentials:**
- Email: `demo@wodsmith.com`
- Password: `DemoPassword123!`

**What's Seeded:**
- Demo user account with admin role
- Demo team ("Demo Gym")
- Sample workouts and programming data
- Active entitlements for testing features

The seeding script (`scripts/seed-pr.ts`) validates that only PR environments are seeded:

```typescript
// Validates STAGE starts with 'pr-' before seeding
if (!stage.startsWith("pr-")) {
  throw new Error("Refusing to seed non-PR environment")
}
```

**Manual seeding (if needed):**

```bash
# Seed PR environment manually
STAGE=pr-42 pnpm db:seed:pr
```

### Cleanup Behavior

When a PR is closed or merged, the cleanup job automatically destroys all resources:

```yaml
cleanup:
  if: github.event.action == 'closed'
  runs-on: ubuntu-latest
  steps:
    - run: npx alchemy deploy --destroy
      env:
        STAGE: pr-${{ github.event.number }}
```

**Safety Check:** The destroy command includes a safety check that prevents accidentally destroying production:

```typescript
if (stage === "prod" && app.phase === "destroy") {
  throw new Error("FATAL: Refusing to destroy production")
}
```

**Resources Cleaned Up:**
- D1 Database (`wodsmith-db-pr-{N}`)
- KV Namespace (`wodsmith-sessions-pr-{N}`)
- R2 Bucket (`wodsmith-uploads-pr-{N}`)
- Worker deployment
- State files

### State Storage for CI

PR environments use `CloudflareStateStore` instead of local file storage:

```typescript
const stateStore = process.env.CI
  ? new CloudflareStateStore({
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
      apiToken: process.env.CLOUDFLARE_API_TOKEN!,
      namespaceId: "alchemy-state", // KV namespace for state
      encryptionKey: process.env.ALCHEMY_STATE_TOKEN!,
    })
  : undefined // Local .alchemy/ directory
```

This ensures multiple CI runners can share state without conflicts.

### GitHub Actions Workflow

The `deploy.yml` workflow handles all PR lifecycle events:

```yaml
name: Deploy
on:
  pull_request:
    types: [opened, reopened, synchronize, closed]
  push:
    branches: [main]

env:
  STAGE: ${{ github.event_name == 'pull_request' && format('pr-{0}', github.event.number) || 'prod' }}

jobs:
  deploy:
    if: github.event.action != 'closed'
    runs-on: ubuntu-latest
    concurrency:
      group: deploy-${{ github.event_name == 'pull_request' && format('pr-{0}', github.event.number) || 'prod' }}
      cancel-in-progress: false
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: npx alchemy deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          ALCHEMY_PASSWORD: ${{ secrets.ALCHEMY_PASSWORD }}
          ALCHEMY_STATE_TOKEN: ${{ secrets.ALCHEMY_STATE_TOKEN }}
      - name: Seed PR Database
        if: github.event_name == 'pull_request'
        run: pnpm db:seed:pr
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}

  cleanup:
    if: github.event.action == 'closed'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: npx alchemy deploy --destroy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          ALCHEMY_PASSWORD: ${{ secrets.ALCHEMY_PASSWORD }}
          ALCHEMY_STATE_TOKEN: ${{ secrets.ALCHEMY_STATE_TOKEN }}
```

### PR Preview Troubleshooting

#### "Preview URL not working"

DNS propagation can take up to 30 minutes for new subdomains.

**Solutions:**
1. Wait 5-30 minutes for DNS propagation
2. Check Cloudflare DNS dashboard for the wildcard record
3. Verify the Worker deployed successfully in GitHub Actions logs

#### "State conflict between runs"

Multiple runs fighting over the same state.

**Solutions:**
1. Check concurrency group is set correctly (prevents parallel deploys)
2. Verify `ALCHEMY_STATE_TOKEN` is set (enables shared state)
3. Cancel any stuck workflow runs before retrying

#### "Seeding failed"

Database seeding step failed during deployment.

**Solutions:**
1. Check that `STAGE` environment variable starts with `pr-`
2. Verify the D1 database was created successfully
3. Check `scripts/seed-pr.sql` for syntax errors
4. Run seeding manually: `STAGE=pr-N pnpm db:seed:pr`

#### "Cleanup didn't run"

PR was closed but resources weren't destroyed.

**Solutions:**
1. Check GitHub Actions for failed cleanup job
2. Manually destroy: `STAGE=pr-N npx alchemy deploy --destroy`
3. Verify secrets are available for the cleanup job

#### "Wrong environment seeded"

Demo data appeared in wrong environment.

**Solutions:**
1. The seed script validates `STAGE` starts with `pr-` - this shouldn't happen
2. Check that `STAGE` environment variable is set correctly in CI
3. Never run `pnpm db:seed:pr` without proper `STAGE` variable

#### "Preview comment not appearing"

GitHub comment with preview URL not posted to PR.

**Solutions:**
1. Check `GITHUB_TOKEN` permissions (needs `pull-requests: write`)
2. Verify `GitHubComment` resource is configured in `alchemy.run.ts`
3. Check GitHub Actions logs for comment creation errors

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
