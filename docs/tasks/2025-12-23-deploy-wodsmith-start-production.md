# Deploy wodsmith-start to Production (start.wodsmith.com)

**Date:** 2025-12-23  
**Status:** Planning  
**Target:** Deploy TanStack Start app to production subdomain  
**Estimated Time:** 15-20 minutes

## Overview

Deploy the new TanStack Start application (`apps/wodsmith-start`) to production at `start.wodsmith.com`, sharing the same Cloudflare resources (D1 database, KV namespace, R2 buckets) as the existing Next.js app (`apps/wodsmith`).

This is an alpha replacement strategy - both apps will run in parallel during testing, with `wodsmith-start` eventually replacing `wodsmith`.

## Pre-Flight Verification

### Confirmed ✅

- [x] Database schemas are identical between both apps
- [x] All 65 migration files match perfectly
- [x] Wrangler config already points to production resources:
  - D1 Database: `wodsmith-db` (ID: `931185e9-99e5-48f0-bf70-d03ca5936f2d`)
  - KV Namespace: `e7a18a19d2cb4afbaf02be597cbecb35`
  - R2 Bucket: `wodsmith-uploads`
- [x] No database migrations needed (production DB is already up to date)

## Required Secrets

Copy these secrets from `wodsmith` to `wodsmith-start`:

| Secret                  | Required            | Used In                         |
| ----------------------- | ------------------- | ------------------------------- |
| `TURNSTILE_SECRET_KEY`  | Yes                 | `src/utils/validate-captcha.ts` |
| `RESEND_API_KEY`        | If email enabled    | Email functionality             |
| `STRIPE_SECRET_KEY`     | If payments enabled | Payment processing              |
| `STRIPE_WEBHOOK_SECRET` | If payments enabled | Stripe webhooks                 |
| `GOOGLE_CLIENT_ID`      | If SSO enabled      | Google SSO                      |
| `GOOGLE_CLIENT_SECRET`  | If SSO enabled      | Google SSO                      |

---

## Step-by-Step Deployment

### Step 1: Update wrangler.jsonc Configuration

Edit `apps/wodsmith-start/wrangler.jsonc`:

**Changes needed:**

1. Update `NEXT_PUBLIC_APP_URL` to `https://start.wodsmith.com`
2. Add `SITE_URL` environment variable for `src/constants.ts`
3. Add `routes` section for custom domain

**Updated vars section:**

```jsonc
"vars": {
  "EMAIL_FROM": "team@mail.wodsmith.com",
  "EMAIL_FROM_NAME": "WODsmith",
  "EMAIL_REPLY_TO": "support@mail.wodsmith.com",
  "NEXT_PUBLIC_APP_URL": "https://start.wodsmith.com",
  "SITE_URL": "https://start.wodsmith.com",
  "R2_PUBLIC_URL": "https://pub-14c651314867492fa9637e830cc729a3.r2.dev"
}
```

**Add routes section (after r2_buckets, before closing brace):**

```jsonc
"routes": [
  {
    "pattern": "start.wodsmith.com",
    "custom_domain": true
  }
]
```

### Step 2: Regenerate TypeScript Types

```bash
cd apps/wodsmith-start
pnpm cf-typegen
```

This updates `worker-configuration.d.ts` with the new environment variables.

### Step 3: Copy Secrets

**List existing secrets:**

```bash
wrangler secret list --name wodsmith
```

**Copy each secret to the new worker:**

```bash
# Required
wrangler secret put TURNSTILE_SECRET_KEY --name wodsmith-start

# Optional (if features are enabled)
wrangler secret put RESEND_API_KEY --name wodsmith-start
wrangler secret put STRIPE_SECRET_KEY --name wodsmith-start
wrangler secret put STRIPE_WEBHOOK_SECRET --name wodsmith-start
wrangler secret put GOOGLE_CLIENT_ID --name wodsmith-start
wrangler secret put GOOGLE_CLIENT_SECRET --name wodsmith-start
```

### Step 4: Build and Test Locally

```bash
cd apps/wodsmith-start
pnpm build
```

**Verify:**

- Build completes without errors
- No TypeScript errors
- Bundle size is reasonable

### Step 5: Deploy to Cloudflare

```bash
cd apps/wodsmith-start
pnpm run deploy
```

### Step 6: Configure DNS in Cloudflare Dashboard

1. Go to **Cloudflare Dashboard** → `wodsmith.com` → **DNS**
2. Add CNAME record:
   - **Type:** CNAME
   - **Name:** `start`
   - **Target:** `wodsmith-start.workers.dev`
   - **Proxy status:** Proxied (orange cloud)
   - **TTL:** Auto
3. Wait for DNS propagation (< 5 minutes)

### Step 7: Verify Deployment

**Check worker status:**

```bash
wrangler deployments list --name wodsmith-start
```

**Test the deployed app:**

1. Visit `https://start.wodsmith.com`
2. Test authentication (sign in/sign up)
3. Verify database connectivity
4. Test key features

**Monitor logs:**

```bash
wrangler tail --name wodsmith-start
```

---

## Post-Deployment Checklist

- [ ] `https://start.wodsmith.com` loads successfully
- [ ] Authentication works (sign in, sign up)
- [ ] Database queries work (workouts, teams, users load)
- [ ] File uploads work (R2 bucket connectivity)
- [ ] Session management works (KV namespace)
- [ ] Email sending works (if configured)
- [ ] Stripe integration works (if configured)
- [ ] No errors in worker logs

---

## Session Sharing Behavior

Since both apps share the same KV namespace:

- Users logged into `wodsmith.com` will automatically be logged into `start.wodsmith.com`
- Sessions are shared across both apps
- No need to log in twice

This is intentional for the alpha testing scenario.

---

## Shared Resources Summary

Both apps share:

| Resource     | Binding (wodsmith-start) | Binding (wodsmith)  | ID/Name                            |
| ------------ | ------------------------ | ------------------- | ---------------------------------- |
| D1 Database  | `DB`                     | `NEXT_TAG_CACHE_D1` | `wodsmith-db`                      |
| KV Namespace | `KV_SESSION`             | `NEXT_INC_CACHE_KV` | `e7a18a19d2cb4afbaf02be597cbecb35` |
| R2 Bucket    | `R2_BUCKET`              | `R2_BUCKET`         | `wodsmith-uploads`                 |

---

## Rollback Plan

If something goes wrong:

1. The old `wodsmith` app at `wodsmith.com` continues running unaffected
2. Remove the DNS CNAME record for `start.wodsmith.com`
3. Delete the worker if needed: `wrangler delete --name wodsmith-start`

---

## Notes

- **Worker Name:** `wodsmith-start` in Cloudflare, serves `start.wodsmith.com`
- **No Database Migrations:** Production DB already has all migrations
- **Alpha Stage:** No real users, safe to share all resources
- **Replacement Strategy:** Eventually `wodsmith-start` will replace `wodsmith` on the main domain
