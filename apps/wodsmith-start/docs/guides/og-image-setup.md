# OG Image Setup Guide

Step-by-step guide for adding social media preview images to competition pages. See `docs/og-image-service.md` for architecture details.

## Phase 1: Meta Tags + Static Image

**Goal**: Get OG meta tags on `/compete/$slug` so shared links show title, description, and an image.

### 1. Create Default OG Image

Create a 1200x630 PNG with WODsmith branding. This is the fallback when a competition has no images.

- [ ] Design `og-default.png` (1200x630)
- [ ] Upload to R2 bucket or host at `https://wodsmith.com/og-default.png`

### 2. Add head() to Competition Route

Edit `src/routes/compete/$slug.tsx`:

```typescript
const FALLBACK_OG_IMAGE = 'https://wodsmith.com/og-default.png'
```

Add `appUrl` to the loader return value (call `getAppUrl()` server-side), then add `head` to the route config:

```typescript
head: ({ loaderData }) => {
  const competition = loaderData?.competition
  const appUrl = loaderData?.appUrl  // from loader, not getAppUrl() directly

  if (!competition) {
    return { meta: [{ title: 'Competition Not Found' }] }
  }

  const ogImageUrl = competition.bannerImageUrl
    || competition.profileImageUrl
    || FALLBACK_OG_IMAGE
  const pageUrl = `${appUrl}/compete/${competition.slug}`
  const description = competition.description?.slice(0, 160)
    || `Join ${competition.name} - a fitness competition on WODsmith`

  return {
    meta: [
      { title: competition.name },
      { name: 'description', content: description },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: pageUrl },
      { property: 'og:title', content: competition.name },
      { property: 'og:description', content: description },
      { property: 'og:image', content: ogImageUrl },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { property: 'og:site_name', content: 'WODsmith' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: competition.name },
      { name: 'twitter:description', content: description },
      { name: 'twitter:image', content: ogImageUrl },
    ],
  }
},
```

### 3. Test

```bash
pnpm dev
```

1. Open a competition page, view source, confirm `<meta property="og:image" ...>` is present
2. Test with [opengraph.xyz](https://www.opengraph.xyz/) (works with localhost via ngrok or after deploy)
3. Deploy, then validate with:
   - [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
   - [Twitter Card Validator](https://cards-dev.twitter.com/validator)
   - [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/)

### Phase 1 Done

Competitions now show title + description + image when shared. Phase 2 adds dynamically generated images.

---

## Phase 2: Dynamic OG Worker

**Goal**: Deploy `apps/og-worker` to generate branded PNG images per-competition at `og.wodsmith.com`.

### 1. Create the Worker Project

```bash
cd apps
mkdir -p og-worker/src/templates og-worker/public
cd og-worker
```

Create `package.json`:

```json
{
  "name": "og-worker",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "tail": "wrangler tail"
  },
  "dependencies": {
    "workers-og": "^0.0.8"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20241205.0",
    "typescript": "^5.7.2",
    "wrangler": "^3.99.0"
  }
}
```

Create `tsconfig.json`:

```json
{
  "extends": "@repo/typescript-config/base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "workers-og"
  },
  "include": ["src"]
}
```

Create `wrangler.jsonc`:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "wodsmith-og",
  "main": "src/index.ts",
  "compatibility_date": "2024-12-01",
  "compatibility_flags": ["nodejs_compat"],
  "routes": [
    {
      "pattern": "og.wodsmith.com/*",
      "zone_name": "wodsmith.com"
    }
  ],
  "vars": {
    "WODSMITH_API_URL": "https://wodsmith.com"
  }
}
```

Install dependencies:

```bash
pnpm install
```

### 2. Create Worker Source Files

Copy the source from `docs/og-image-service.md` Phase 2 section:

- `src/index.ts` - Worker entry point & router
- `src/templates/competition.tsx` - Competition OG template
- `src/templates/default.tsx` - Default fallback template

### 3. Add Internal API Secret to Main App

In `apps/wodsmith-start/src/lib/env.ts`, add:

```typescript
export const getInternalApiSecret = createServerOnlyFn((): string | undefined => {
  return extendedEnv.INTERNAL_API_SECRET
})
```

Add the secret to your environment:

```bash
# Local development (.dev.vars)
echo 'INTERNAL_API_SECRET="your-secret-here"' >> apps/wodsmith-start/.dev.vars

# Production (via Alchemy or wrangler)
# Add INTERNAL_API_SECRET to alchemy.run.ts bindings or set via wrangler secret
```

Run `pnpm cf-typegen` if TypeScript doesn't recognize the new env var.

### 4. Create Internal Data API Route

Create the directory structure and route file:

```bash
mkdir -p apps/wodsmith-start/src/routes/api/internal/og-data/competition
```

Create `apps/wodsmith-start/src/routes/api/internal/og-data/competition/$slug.ts` with the implementation from `docs/og-image-service.md` section 4.

Key points:
- Uses `createFileRoute` from `@tanstack/react-router` (NOT `createAPIFileRoute`)
- Uses `server.handlers.GET` pattern (same as cron endpoint)
- Bearer token auth via `getInternalApiSecret()`
- Filters by `status: 'published'` to prevent draft leaks

### 5. Test Locally

```bash
# Terminal 1: Main app
cd apps/wodsmith-start
pnpm dev

# Terminal 2: OG Worker
cd apps/og-worker
pnpm dev --port 8788
```

For local testing, temporarily set `WODSMITH_API_URL` to your local main app URL in `wrangler.jsonc`:

```jsonc
"vars": {
  "WODSMITH_API_URL": "http://localhost:3000"
}
```

Test image generation:

```bash
curl http://localhost:8788/competition/your-test-slug --output test.png
open test.png
```

### 6. Deploy OG Worker

```bash
cd apps/og-worker

# Deploy worker
pnpm deploy

# Set the shared secret (must match INTERNAL_API_SECRET in main app)
wrangler secret put API_SECRET
```

Verify the worker is live:

```bash
curl https://og.wodsmith.com/health
# Should return: OK

curl https://og.wodsmith.com/competition/your-slug --output test.png
open test.png
```

### 7. Update Competition Route for Dynamic Images

In `src/routes/compete/$slug.tsx`, change the OG image URL:

```diff
- const ogImageUrl = competition.bannerImageUrl
-   || competition.profileImageUrl
-   || FALLBACK_OG_IMAGE
+ const ogImageUrl = `https://og.wodsmith.com/competition/${competition.slug}`
```

Add image type meta tag:

```typescript
{ property: 'og:image:type', content: 'image/png' },
```

Deploy the main app.

### 8. Validate

1. [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) - paste a competition URL, verify image renders
2. [Twitter Card Validator](https://cards-dev.twitter.com/validator) - check card preview
3. [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/) - verify LinkedIn preview
4. [opengraph.xyz](https://www.opengraph.xyz/) - general OG tag checker

### 9. Add CI/CD (Optional)

Add a deploy job to `.github/workflows/deploy.yml`:

```yaml
deploy-og-worker:
  runs-on: ubuntu-latest
  needs: [build]
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 20
        cache: pnpm
    - run: pnpm install --frozen-lockfile
    - run: pnpm --filter og-worker deploy
      env:
        CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

---

## Troubleshooting

### Meta tags not appearing

- Confirm `head()` is defined on the route (not just the component)
- Check that `<HeadContent />` is in `__root.tsx` (it is)
- View page source (not DevTools) to see SSR'd meta tags

### OG image not loading on social platforms

- Image URL must be absolute (`https://...`)
- Image must be publicly accessible (no auth)
- Use the platform's debug/scrape tool to force refresh
- Check `wrangler tail` for errors on the OG worker

### Worker returning default image instead of competition image

1. Check `wrangler tail` for API fetch errors
2. Verify `API_SECRET` on OG worker matches `INTERNAL_API_SECRET` on main app
3. Verify competition is `status: 'published'`
4. Test internal API directly:
   ```bash
   curl -H "Authorization: Bearer YOUR_SECRET" \
     https://wodsmith.com/api/internal/og-data/competition/your-slug
   ```

### Cache not clearing

```bash
# Purge a specific OG image from Cloudflare edge cache
curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache" \
  -H "Authorization: Bearer {api_token}" \
  -H "Content-Type: application/json" \
  --data '{"files":["https://og.wodsmith.com/competition/your-slug"]}'
```

Or use Cloudflare Dashboard: Caching -> Configuration -> Purge Cache -> Custom Purge.
