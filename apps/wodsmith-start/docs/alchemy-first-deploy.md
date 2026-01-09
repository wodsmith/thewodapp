# First-Time Cloudflare + Alchemy Deployment Guide

This guide walks you through deploying a TanStack Start application to Cloudflare Workers using Alchemy IaC, **from scratch**. No prior Cloudflare setup required.

## What You'll Set Up

Alchemy will create and manage these Cloudflare resources:

| Resource | Purpose | Naming Convention |
|----------|---------|-------------------|
| **D1 Database** | SQLite database for app data | `wodsmith-db-{stage}` |
| **KV Namespace** | Session storage | `wodsmith-sessions-{stage}` |
| **R2 Bucket** | File uploads/media storage | `wodsmith-uploads-{stage}` |
| **Worker** | TanStack Start SSR application | `wodsmith-start` |

---

## Prerequisites

### 1. Cloudflare Account

**Create a free Cloudflare account** at [dash.cloudflare.com](https://dash.cloudflare.com/).

> **Good news**: The **Workers Free tier** is sufficient for development. You get:
> - 100,000 requests/day
> - 10ms CPU time per request
> - D1, KV, and R2 included
> - No credit card required

For production, you may want the **Workers Paid plan** ($5/month) for:
- Unlimited requests
- 30ms+ CPU time
- Higher D1/KV/R2 limits

### 2. Node.js & pnpm

```bash
# Check Node.js version (18+ required)
node --version

# Install pnpm if needed
npm install -g pnpm
```

### 3. Project Dependencies

From the `wodsmith-start` directory:

```bash
pnpm install
```

---

## Step 1: Get Your Cloudflare Account ID

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Click on **Workers & Pages** in the left sidebar
3. Your **Account ID** is displayed on the right side of the overview page
4. Copy it - you'll need this later

![Account ID Location](https://developers.cloudflare.com/images/workers/get-started/account-id.png)

---

## Step 2: Create an API Token

Alchemy needs an API token with permissions to create D1 databases, KV namespaces, R2 buckets, and Workers.

### Create the Token

1. Go to [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. Click **Create Token**
3. Select **Create Custom Token**

### Configure Permissions

Add these permissions to your token:

| Permission | Access Level | Why Needed |
|------------|-------------|------------|
| **Account / Workers Scripts** | Edit | Deploy Workers |
| **Account / Workers KV Storage** | Edit | Create KV namespaces |
| **Account / Workers R2 Storage** | Edit | Create R2 buckets |
| **Account / D1** | Edit | Create D1 databases |
| **Zone / Workers Routes** | Edit | Configure custom domains (optional) |
| **Zone / DNS** | Edit | Automatic DNS records for custom domains (optional) |

### Account Resources

- Select **Include** → **All accounts** (or your specific account)

### Zone Resources (Optional - for custom domains)

- If you want to use `wodsmith.com` or similar:
  - Select **Include** → **Specific zone** → your domain

### Create and Save

1. Click **Continue to summary**
2. Click **Create Token**
3. **Copy the token immediately** - it won't be shown again!

---

## Step 3: Set Up Environment Variables

### Create `.env` file

Copy the example and fill in your values:

```bash
cp .env.example .env
```

### Required Variables for Alchemy

Open `.env` and set these:

```bash
# Cloudflare Authentication
CLOUDFLARE_API_TOKEN=your_api_token_from_step_2
CLOUDFLARE_ACCOUNT_ID=your_account_id_from_step_1

# Alchemy State Encryption
# Generate a strong password - this encrypts your infrastructure state
ALCHEMY_PASSWORD=your-secure-password-here
```

> **Security Note**: `ALCHEMY_PASSWORD` encrypts the `.alchemy/` state directory. Use a strong password and store it securely - you'll need it for every deployment.

### Verify Environment

```bash
# Check if variables are set (without revealing values)
[ -n "$CLOUDFLARE_API_TOKEN" ] && echo "✓ CLOUDFLARE_API_TOKEN is set" || echo "✗ CLOUDFLARE_API_TOKEN is NOT set"
[ -n "$CLOUDFLARE_ACCOUNT_ID" ] && echo "✓ CLOUDFLARE_ACCOUNT_ID is set" || echo "✗ CLOUDFLARE_ACCOUNT_ID is NOT set"
[ -n "$ALCHEMY_PASSWORD" ] && echo "✓ ALCHEMY_PASSWORD is set" || echo "✗ ALCHEMY_PASSWORD is NOT set"
```

---

## Step 4: First Deployment

### Deploy to Development Stage

From the `wodsmith-start` directory:

```bash
npx alchemy deploy
```

This runs `alchemy.run.ts` which:

1. Creates a D1 database (`wodsmith-db-dev`)
2. Runs all migrations from `src/db/migrations/`
3. Creates a KV namespace (`wodsmith-sessions-dev`)
4. Creates an R2 bucket (`wodsmith-uploads-dev`)
5. Builds and deploys the TanStack Start Worker
6. Outputs your `*.workers.dev` URL

### Expected Output

```
Alchemy v0.x.x
Stage: dev
Phase: up

Creating D1Database wodsmith-db-dev...
Running migrations...
  ✓ 0001_initial.sql
  ✓ 0002_sessions.sql
Creating KVNamespace wodsmith-sessions-dev...
Creating R2Bucket wodsmith-uploads-dev...
Building TanStack Start...
Deploying Worker wodsmith-start...

✓ Deployed successfully!
  URL: https://wodsmith-start-dev.your-subdomain.workers.dev
```

### View Your Deployed App

Open the URL from the output in your browser. Your app is live!

---

## Step 5: Verify Resources in Cloudflare Dashboard

After deployment, verify everything was created:

### Workers
1. Go to **Workers & Pages**
2. You should see `wodsmith-start`
3. Click it to see deployment details, logs, and metrics

### D1 Database
1. Go to **Workers & Pages** → **D1**
2. You should see `wodsmith-db-dev`
3. Click to browse tables and run queries

### KV Namespace
1. Go to **Workers & Pages** → **KV**
2. You should see `wodsmith-sessions-dev`
3. Click to browse stored keys

### R2 Bucket
1. Go to **R2**
2. You should see `wodsmith-uploads-dev`
3. Click to browse objects

---

## Understanding Stages

Alchemy uses **stages** to isolate environments:

| Stage | Command | Resources Created | Domain |
|-------|---------|-------------------|--------|
| `dev` | `npx alchemy deploy` | `*-dev` | `*.workers.dev` |
| `staging` | `STAGE=staging npx alchemy deploy` | `*-staging` | `*.workers.dev` |
| `prod` | `STAGE=prod npx alchemy deploy` | `*-prod` | `wodsmith.com` |

Each stage is completely isolated - separate databases, KV namespaces, and buckets.

---

## Troubleshooting

### Authentication Errors

**Error**: `Authentication error` or `Token invalid`

**Fix**:
1. Verify `CLOUDFLARE_API_TOKEN` is set correctly
2. Check the token hasn't expired
3. Ensure the token has all required permissions (see Step 2)
4. Try creating a new token if issues persist

```bash
# Test your token
curl -X GET "https://api.cloudflare.com/client/v4/user/tokens/verify" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN"
```

### Account ID Issues

**Error**: `Could not determine account` or `Account not found`

**Fix**:
1. Verify `CLOUDFLARE_ACCOUNT_ID` is set
2. Double-check you copied the correct Account ID (not Zone ID)
3. Ensure your API token has access to this account

### D1 Creation Fails

**Error**: `D1 is not enabled` or `D1 requires Workers Paid`

**Fix**: 
- D1 is available on the free tier, but you may need to accept the D1 terms:
  1. Go to Cloudflare Dashboard → Workers & Pages → D1
  2. Click through any welcome/terms screens
  3. Try deploying again

### Migration Errors

**Error**: `Migration failed` or SQL errors

**Fix**:
1. Check migration files in `src/db/migrations/`
2. Ensure migrations are numbered correctly (0001_, 0002_, etc.)
3. For schema issues, you may need to destroy and recreate:
   ```bash
   npx alchemy deploy --destroy
   npx alchemy deploy
   ```

### R2 Permission Denied

**Error**: `R2 access denied` or `Bucket creation failed`

**Fix**:
1. Verify your token has **Workers R2 Storage: Edit** permission
2. R2 may require accepting terms in the dashboard first:
   - Go to Cloudflare Dashboard → R2
   - Click through any welcome screens

### DNS/Domain Issues (Production)

**Error**: `DNS record creation failed` or `Domain verification failed`

**Fix**:
1. Ensure your domain is added to Cloudflare (not just registered elsewhere)
2. Your domain must be on a Cloudflare plan (free is fine)
3. API token needs **Zone: DNS: Edit** permission for the specific zone
4. Wait for DNS propagation (up to 5 minutes)

### State File Encryption

**Error**: `Failed to decrypt state` or `Invalid password`

**Fix**:
1. Ensure `ALCHEMY_PASSWORD` matches what was used for previous deployments
2. If you've lost the password:
   ```bash
   # Delete local state (will recreate resources)
   rm -rf .alchemy/
   npx alchemy deploy
   ```

### Workers.dev URL Not Working

**Symptom**: 522 error or timeout on `*.workers.dev`

**Fix**:
1. Wait 1-2 minutes for deployment to propagate
2. Check Worker logs in dashboard for errors
3. Verify the build succeeded with no errors

---

## Next Steps

### Local Development

For local development with emulated Cloudflare bindings:

```bash
pnpm dev
```

This uses `wrangler dev` under the hood with local D1, KV, and R2 emulation.

### Deploy to Production

When ready for production:

```bash
STAGE=prod npx alchemy deploy
```

This deploys to `wodsmith.com` (requires DNS zone configured).

### Destroy Resources

To tear down a stage:

```bash
# Destroy dev resources
npx alchemy deploy --destroy

# Destroy staging
STAGE=staging npx alchemy deploy --destroy
```

> **Warning**: `--destroy` is irreversible. Database data, KV entries, and R2 objects will be deleted.

---

## Quick Reference

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CLOUDFLARE_API_TOKEN` | Yes | API token with D1/KV/R2/Workers permissions |
| `CLOUDFLARE_ACCOUNT_ID` | Yes | Your Cloudflare account ID |
| `ALCHEMY_PASSWORD` | Yes | Encryption key for Alchemy state |
| `STAGE` | No | Deployment stage (default: `dev`) |

### Commands

```bash
# Deploy to dev (default)
npx alchemy deploy

# Deploy to staging
STAGE=staging npx alchemy deploy

# Deploy to production
STAGE=prod npx alchemy deploy

# Destroy resources
npx alchemy deploy --destroy

# Local development
pnpm dev
```

### Created Resources (Dev Stage)

| Resource | Name | Dashboard Location |
|----------|------|-------------------|
| Worker | `wodsmith-start` | Workers & Pages |
| D1 Database | `wodsmith-db-dev` | Workers & Pages → D1 |
| KV Namespace | `wodsmith-sessions-dev` | Workers & Pages → KV |
| R2 Bucket | `wodsmith-uploads-dev` | R2 |

---

## Getting Help

- [Alchemy Documentation](https://alchemy.run/docs)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [D1 Documentation](https://developers.cloudflare.com/d1/)
- [TanStack Start Docs](https://tanstack.com/start/latest)
