# Dynamic OG Image Service for Competitions

## Overview

When competition links are shared on social media, we want rich, branded preview images that include:

1. **Competition logo** (from `profileImageUrl`)
2. **Competition title** (from `name`)
3. **WODsmith branding** (subtle logo placement)
4. Optional: Competition dates, type badge (online/in-person), organizing team

## Phased Approach

### Phase 1: Meta Tags + Static OG Image (in wodsmith-start)

Add OG meta tags to the competition route using a static default image. This gets proper social previews working immediately with zero infrastructure.

### Phase 2: Separate OG Worker (og.wodsmith.com)

Deploy a dedicated Cloudflare Worker that generates dynamic, per-competition OG images with logos, titles, and dates. Swap the static `og:image` URL for the dynamic one.

---

## Phase 1: Meta Tags in wodsmith-start

### What This Does

- Adds `head()` with OG/Twitter meta tags to `/compete/$slug`
- Uses the competition's `profileImageUrl` or `bannerImageUrl` as the OG image
- Falls back to a static WODsmith OG image if no competition image exists
- No new infrastructure, no new worker, no internal API

### Implementation

#### 1. Add head() to Competition Route

The route already has a loader returning full competition data. Add `head()`:

```typescript
// apps/wodsmith-start/src/routes/compete/$slug.tsx

import { createFileRoute } from '@tanstack/react-router'
import { getAppUrl } from '@/lib/env'

const FALLBACK_OG_IMAGE = 'https://wodsmith.com/og-default.png'

export const Route = createFileRoute('/compete/$slug')({
  head: ({ loaderData }) => {
    const competition = loaderData?.competition

    if (!competition) {
      return { meta: [{ title: 'Competition Not Found' }] }
    }

    const appUrl = getAppUrl()
    const ogImageUrl = competition.bannerImageUrl
      || competition.profileImageUrl
      || FALLBACK_OG_IMAGE
    const pageUrl = `${appUrl}/compete/${competition.slug}`
    const description = competition.description?.slice(0, 160)
      || `Join ${competition.name} - a fitness competition on WODsmith`

    return {
      meta: [
        // Basic
        { title: competition.name },
        { name: 'description', content: description },

        // Open Graph
        { property: 'og:type', content: 'website' },
        { property: 'og:url', content: pageUrl },
        { property: 'og:title', content: competition.name },
        { property: 'og:description', content: description },
        { property: 'og:image', content: ogImageUrl },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        { property: 'og:site_name', content: 'WODsmith' },

        // Twitter
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: competition.name },
        { name: 'twitter:description', content: description },
        { name: 'twitter:image', content: ogImageUrl },
      ],
    }
  },
  // ... existing loader, component, etc.
})
```

#### 2. Create a Default OG Image

Upload a static `og-default.png` (1200x630) to the public directory or R2 bucket. This is the fallback when a competition has no images.

### Phase 1 Checklist

- [ ] Create static `og-default.png` (1200x630, WODsmith branded)
- [ ] Add `head()` to `src/routes/compete/$slug.tsx`
- [ ] Test with [opengraph.xyz](https://www.opengraph.xyz/)
- [ ] Test with [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
- [ ] Test with [Twitter Card Validator](https://cards-dev.twitter.com/validator)

### Notes

- Uses `getAppUrl()` from `@/lib/env` (centralized `createServerOnlyFn` pattern)
- `head()` with `loaderData` is already used in 8+ routes (organizer settings, scoring, revenue, etc.)
- No `og:image` meta tags exist anywhere in the codebase yet - clean slate

---

## Phase 2: Separate OG Worker

### Architecture Decision: Separate Worker

Deploy the OG image service as a **separate Cloudflare Worker** for:

| Benefit | Reason |
|---------|--------|
| **Bundle isolation** | Main app stays lean (~2-3MB saved) |
| **CPU isolation** | Image generation doesn't affect app latency |
| **Independent deployment** | Update designs without redeploying main app |
| **Reusability** | Can serve OG images for workouts, teams, etc. |
| **Specialized caching** | Aggressive edge caching for images |

**Precedent**: `apps/posthog-proxy` already proves this separate-worker pattern works in the monorepo.

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     wodsmith-start                          │
│  /compete/$slug                                             │
│     └─ meta og:image="https://og.wodsmith.com/competition/X"│
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 og.wodsmith.com (separate Worker)           │
│                                                             │
│  /competition/:slug                                         │
│     └─ Fetches data from wodsmith.com/api/internal/og-data  │
│     └─ Generates PNG with workers-og                        │
│     └─ Returns with aggressive caching                      │
└─────────────────────────────────────────────────────────────┘
```

### Project Structure

```
apps/
├── wodsmith-start/              # Main app
│   └── src/routes/api/internal/og-data/
│       └── competition/$slug.ts # Internal data API
│
└── og-worker/                   # NEW: Dedicated OG image service
    ├── src/
    │   ├── index.ts             # Worker entry point & router
    │   ├── templates/
    │   │   ├── competition.tsx  # Competition OG template
    │   │   ├── workout.tsx      # Future: workout OG template
    │   │   └── default.tsx      # Fallback template
    │   └── utils/
    │       └── fonts.ts         # Font loading utilities
    ├── public/
    │   └── wodsmith-logo.png    # Embedded assets
    ├── wrangler.jsonc
    ├── package.json
    ├── tsconfig.json
    └── biome.json
```

Monorepo auto-discovers via `apps/*` glob in `pnpm-workspace.yaml`. No config changes needed.

### Implementation Details

#### 1. OG Worker Entry Point

```typescript
// apps/og-worker/src/index.ts

import { ImageResponse } from 'workers-og'
import { CompetitionTemplate } from './templates/competition'
import { DefaultTemplate } from './templates/default'

export interface Env {
  WODSMITH_API_URL: string  // https://wodsmith.com
  API_SECRET: string        // Shared secret for internal API
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    // Health check
    if (path === '/health') {
      return new Response('OK', { status: 200 })
    }

    // Route: /competition/:slug
    const competitionMatch = path.match(/^\/competition\/([^/]+)$/)
    if (competitionMatch) {
      const slug = competitionMatch[1]
      return generateCompetitionOG(slug, env)
    }

    // Future routes:
    // /workout/:id
    // /team/:slug
    // /leaderboard/:competitionSlug

    // Fallback: default WODsmith OG image
    return generateDefaultOG(env)
  },
}

async function generateCompetitionOG(slug: string, env: Env): Promise<Response> {
  try {
    // Fetch competition data from main app's internal API
    const response = await fetch(
      `${env.WODSMITH_API_URL}/api/internal/og-data/competition/${slug}`,
      {
        headers: {
          'Authorization': `Bearer ${env.API_SECRET}`,
        },
      }
    )

    if (!response.ok) {
      console.error(`Failed to fetch competition ${slug}: ${response.status}`)
      return generateDefaultOG(env)
    }

    const competition = await response.json()

    return new ImageResponse(
      CompetitionTemplate({ competition }),
      {
        width: 1200,
        height: 630,
        headers: getCacheHeaders(),
      }
    )
  } catch (error) {
    console.error('OG generation failed:', error)
    return generateDefaultOG(env)
  }
}

async function generateDefaultOG(env: Env): Promise<Response> {
  return new ImageResponse(
    DefaultTemplate(),
    {
      width: 1200,
      height: 630,
      headers: getCacheHeaders(),
    }
  )
}

function getCacheHeaders(): Record<string, string> {
  return {
    'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    'CDN-Cache-Control': 'max-age=604800', // 7 days edge cache
  }
}
```

#### 2. Competition Template

```tsx
// apps/og-worker/src/templates/competition.tsx

interface CompetitionData {
  name: string
  slug: string
  description: string | null
  profileImageUrl: string | null
  bannerImageUrl: string | null
  startDate: string
  endDate: string
  timezone: string
  competitionType: 'in-person' | 'online'
  organizingTeam: {
    name: string
    avatarUrl: string | null
  } | null
}

interface Props {
  competition: CompetitionData
}

export function CompetitionTemplate({ competition }: Props) {
  const logoUrl = competition.profileImageUrl
    || competition.organizingTeam?.avatarUrl
    || null

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%)',
        padding: '48px',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* Top section: Logo + Content */}
      <div style={{ display: 'flex', flex: 1, gap: '40px', alignItems: 'flex-start' }}>
        {/* Competition logo */}
        {logoUrl && (
          <div
            style={{
              width: '180px',
              height: '180px',
              borderRadius: '16px',
              overflow: 'hidden',
              flexShrink: 0,
              border: '2px solid rgba(255,255,255,0.1)',
            }}
          >
            <img
              src={logoUrl}
              width={180}
              height={180}
              style={{ objectFit: 'cover' }}
            />
          </div>
        )}

        {/* Text content */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          {/* Competition type badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: competition.competitionType === 'online'
                ? 'rgba(59, 130, 246, 0.2)'
                : 'rgba(34, 197, 94, 0.2)',
              border: `1px solid ${competition.competitionType === 'online' ? '#3b82f6' : '#22c55e'}`,
              color: competition.competitionType === 'online' ? '#60a5fa' : '#4ade80',
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '16px',
              fontWeight: 500,
              width: 'fit-content',
            }}
          >
            {competition.competitionType === 'online' ? '🌐 Online Competition' : '📍 In-Person Event'}
          </div>

          {/* Competition name */}
          <h1
            style={{
              color: 'white',
              fontSize: competition.name.length > 40 ? '48px' : '56px',
              fontWeight: 700,
              marginTop: '20px',
              lineHeight: 1.15,
              letterSpacing: '-0.02em',
            }}
          >
            {competition.name}
          </h1>

          {/* Dates */}
          <p
            style={{
              color: '#94a3b8',
              fontSize: '24px',
              marginTop: '16px',
              fontWeight: 400,
            }}
          >
            {formatDateRange(competition.startDate, competition.endDate, competition.timezone)}
          </p>
        </div>
      </div>

      {/* Bottom section: Branding */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '32px',
          paddingTop: '24px',
          borderTop: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        {/* WODsmith branding */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img
            src="https://wodsmith.com/wodsmith-logo-no-text.png"
            width={36}
            height={36}
            style={{ opacity: 0.8 }}
          />
          <span style={{ color: '#64748b', fontSize: '18px', fontWeight: 500 }}>
            wodsmith.com
          </span>
        </div>

        {/* Organizing team */}
        {competition.organizingTeam && (
          <span style={{ color: '#475569', fontSize: '16px' }}>
            Hosted by {competition.organizingTeam.name}
          </span>
        )}
      </div>
    </div>
  )
}

function formatDateRange(startDate: string, endDate: string, timezone: string): string {
  // Use timezone-aware formatting to match the competition's configured timezone
  const options: Intl.DateTimeFormatOptions = {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: timezone,
  }

  // Parse as date-only in the competition's timezone
  const start = new Date(startDate + 'T12:00:00')
  const end = new Date(endDate + 'T12:00:00')

  if (startDate === endDate) {
    return start.toLocaleDateString('en-US', options)
  }

  // Same month and year
  const startMonth = start.toLocaleDateString('en-US', { month: 'long', timeZone: timezone })
  const endMonth = end.toLocaleDateString('en-US', { month: 'long', timeZone: timezone })
  const startYear = start.toLocaleDateString('en-US', { year: 'numeric', timeZone: timezone })
  const endYear = end.toLocaleDateString('en-US', { year: 'numeric', timeZone: timezone })

  if (startMonth === endMonth && startYear === endYear) {
    const startDay = start.toLocaleDateString('en-US', { day: 'numeric', timeZone: timezone })
    const endDay = end.toLocaleDateString('en-US', { day: 'numeric', timeZone: timezone })
    return `${startMonth} ${startDay} - ${endDay}, ${endYear}`
  }

  if (startYear === endYear) {
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: timezone })} - ${end.toLocaleDateString('en-US', options)}`
  }

  return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}`
}
```

#### 3. Default Template

```tsx
// apps/og-worker/src/templates/default.tsx

export function DefaultTemplate() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%)',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <img
        src="https://wodsmith.com/wodsmith-logo-1000.png"
        width={200}
        height={200}
        style={{ marginBottom: '32px' }}
      />
      <h1
        style={{
          color: 'white',
          fontSize: '48px',
          fontWeight: 700,
          letterSpacing: '-0.02em',
        }}
      >
        WODsmith
      </h1>
      <p
        style={{
          color: '#64748b',
          fontSize: '24px',
          marginTop: '12px',
        }}
      >
        Competition Management Platform
      </p>
    </div>
  )
}
```

#### 4. Internal Data API (Main App)

> **Codebase pattern**: Uses `createFileRoute` from `@tanstack/react-router` with `server.handlers`, NOT `createAPIFileRoute`. Uses `createServerOnlyFn` for env access, NOT direct `env` imports.

```typescript
// apps/wodsmith-start/src/routes/api/internal/og-data/competition/$slug.ts

import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { getInternalApiSecret } from '@/lib/env'
import { db } from '@/db'
import { competitionsTable } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

export const Route = createFileRoute('/api/internal/og-data/competition/$slug')({
  server: {
    handlers: {
      GET: async ({ request, params }: { request: Request; params: { slug: string } }) => {
        // Verify internal API secret
        const secret = getInternalApiSecret()
        if (!secret) {
          return json({ error: 'Not configured' }, { status: 500 })
        }

        const authHeader = request.headers.get('Authorization')
        const providedSecret = authHeader?.replace('Bearer ', '')

        if (!providedSecret || providedSecret !== secret) {
          return json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { slug } = params

        const competition = await db.query.competitionsTable.findFirst({
          where: and(
            eq(competitionsTable.slug, slug),
            eq(competitionsTable.status, 'published'),
          ),
          with: {
            organizingTeam: {
              columns: { name: true, avatarUrl: true },
            },
          },
          columns: {
            name: true,
            slug: true,
            description: true,
            profileImageUrl: true,
            bannerImageUrl: true,
            startDate: true,
            endDate: true,
            timezone: true,
            competitionType: true,
          },
        })

        if (!competition) {
          return json({ error: 'Competition not found' }, { status: 404 })
        }

        return json(competition, {
          headers: {
            'Cache-Control': 'private, max-age=60',
          },
        })
      },
    },
  },
})
```

Add to `src/lib/env.ts`:

```typescript
export const getInternalApiSecret = createServerOnlyFn((): string | undefined => {
  return extendedEnv.INTERNAL_API_SECRET
})
```

#### 5. Update Meta Tags for Phase 2

When the OG worker is deployed, update `head()` in `/compete/$slug.tsx`:

```diff
- const ogImageUrl = competition.bannerImageUrl
-   || competition.profileImageUrl
-   || FALLBACK_OG_IMAGE
+ const ogImageUrl = `https://og.wodsmith.com/competition/${competition.slug}`
```

Also add `og:image:type`:

```typescript
{ property: 'og:image:type', content: 'image/png' },
```

### Worker Configuration

#### wrangler.jsonc

```jsonc
// apps/og-worker/wrangler.jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "wodsmith-og",
  "main": "src/index.ts",
  "compatibility_date": "2024-12-01",
  "compatibility_flags": ["nodejs_compat"],

  // Custom domain routing (same pattern as posthog-proxy)
  "routes": [
    {
      "pattern": "og.wodsmith.com/*",
      "zone_name": "wodsmith.com"
    }
  ],

  // Environment variables
  "vars": {
    "WODSMITH_API_URL": "https://wodsmith.com"
  }

  // Secrets (set via CLI):
  // wrangler secret put API_SECRET
}
```

#### package.json

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

#### tsconfig.json

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

## Caching Strategy

### Edge Caching (Cloudflare)

```typescript
headers: {
  'Content-Type': 'image/png',
  'Cache-Control': 'public, max-age=3600',      // Browser: 1 hour
  's-maxage': '86400',                           // Shared cache: 24 hours
  'CDN-Cache-Control': 'max-age=604800',        // Cloudflare edge: 7 days
}
```

### Cache Invalidation

When competition details change (name, logo, dates):

```bash
# Purge specific URL
curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache" \
  -H "Authorization: Bearer {api_token}" \
  -H "Content-Type: application/json" \
  --data '{"files":["https://og.wodsmith.com/competition/summer-throwdown"]}'
```

Or via Cloudflare Dashboard: **Caching -> Configuration -> Purge Cache -> Custom Purge**

## Security

### Internal API Authentication

```typescript
// Shared secret between workers
// Set in both via: wrangler secret put INTERNAL_API_SECRET

// OG Worker -> Main App request
headers: {
  'Authorization': `Bearer ${env.API_SECRET}`,
}

// Main App validation (using centralized env pattern)
const secret = getInternalApiSecret()
const authHeader = request.headers.get('Authorization')
const providedSecret = authHeader?.replace('Bearer ', '')

if (!providedSecret || providedSecret !== secret) {
  return json({ error: 'Unauthorized' }, { status: 401 })
}
```

### Rate Limiting

The internal API should only receive requests from the OG worker. Consider:

1. Cloudflare Access policies on the internal API path
2. IP allowlisting (if workers have static IPs)
3. Request signing with timestamps

## Design Variations

### Option A: Minimal Dark (Current)

- Dark gradient background
- Competition logo on left
- Name + dates on right
- WODsmith watermark in footer

### Option B: Banner Background

```tsx
// Use banner image as background with overlay
<div style={{
  backgroundImage: `url(${competition.bannerImageUrl})`,
  backgroundSize: 'cover',
}}>
  <div style={{
    background: 'linear-gradient(to right, rgba(0,0,0,0.9), rgba(0,0,0,0.6))',
    // ... content
  }} />
</div>
```

### Option C: Light Theme

```tsx
// Light background for competitions that prefer it
<div style={{
  background: 'linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%)',
  color: '#1e293b',
  // ...
}} />
```

## Future Expansion

### Additional OG Templates

```typescript
// Future routes in og-worker
/workout/:id          -> Workout preview (name, movements, time cap)
/team/:slug           -> Team/gym preview
/leaderboard/:slug    -> Leaderboard snapshot
/athlete/:id          -> Athlete profile card
```

### Dynamic Theming

Allow competitions to customize their OG image theme:

```typescript
// Store in competition settings JSON
{
  "ogTheme": {
    "backgroundColor": "#1a1a2e",
    "accentColor": "#3b82f6",
    "textColor": "#ffffff"
  }
}
```

## Deployment Checklists

### Phase 1 Checklist

- [ ] Create static `og-default.png` (1200x630)
- [ ] Add `head()` to `src/routes/compete/$slug.tsx`
- [ ] Test with social media debuggers

### Phase 2 Checklist

- [ ] Create `apps/og-worker` directory
- [ ] Initialize with `pnpm init`
- [ ] Install dependencies: `workers-og`, `wrangler`, `@cloudflare/workers-types`
- [ ] Create worker source files
- [ ] Configure `wrangler.jsonc`
- [ ] Set up DNS: `og.wodsmith.com` -> Worker route
- [ ] Deploy: `wrangler deploy`
- [ ] Set secret: `wrangler secret put API_SECRET`
- [ ] Add `INTERNAL_API_SECRET` to main app env + `src/lib/env.ts`
- [ ] Create internal data API route in main app
- [ ] Update competition route `head()` to use OG worker URL
- [ ] Test with [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
- [ ] Test with [Twitter Card Validator](https://cards-dev.twitter.com/validator)

## Testing

### Local Development

```bash
# Terminal 1: Main app
cd apps/wodsmith-start
pnpm dev

# Terminal 2: OG Worker (Phase 2 only)
cd apps/og-worker
pnpm dev --port 8788
```

### Manual Testing

```bash
# Test OG image generation (Phase 2)
curl http://localhost:8788/competition/test-slug --output test.png
open test.png

# Test with real data (after main app is running)
curl http://localhost:8788/competition/summer-throwdown --output summer.png
```

### Social Media Debugging

After deployment:

1. **Facebook**: https://developers.facebook.com/tools/debug/
2. **Twitter**: https://cards-dev.twitter.com/validator
3. **LinkedIn**: https://www.linkedin.com/post-inspector/
4. **General**: https://www.opengraph.xyz/

## Performance

| Metric | Expected |
|--------|----------|
| First request (cold) | 300-600ms |
| Cached request (edge) | 10-50ms |
| Image size | 50-150KB |
| Worker CPU time | 20-50ms |

## Troubleshooting

### Image not updating after changes

1. Clear Cloudflare cache for the specific URL
2. Wait for browser cache to expire (1 hour)
3. Use `?v=123` query param to bust cache during testing

### 500 errors on OG worker

1. Check worker logs: `wrangler tail`
2. Verify `API_SECRET` is set correctly in both workers
3. Check main app internal API is accessible

### Social platforms showing old image

1. Use platform's debug tool to refresh cache
2. Ensure `og:image` URL is absolute (includes https://)
3. Verify image is accessible publicly (no auth required)

## Codebase Verification Notes

The following was verified against the actual codebase:

- **Schema**: All fields exist (`name`, `slug`, `description`, `profileImageUrl`, `bannerImageUrl`, `startDate`, `endDate`, `competitionType`, `timezone`). Organizing team relation has `name` and `avatarUrl`.
- **Routes**: `head()` with `loaderData` is used in 8+ routes. `/compete/$slug.tsx` exists with full loader data but no `head()` yet.
- **API pattern**: Codebase uses `createFileRoute` + `server.handlers` (NOT `createAPIFileRoute`). Bearer token auth matches cron endpoint pattern. Env access via `createServerOnlyFn`.
- **Monorepo**: `pnpm-workspace.yaml` auto-discovers `apps/*`. `posthog-proxy` proves the separate worker pattern.
- **Deployment**: Raw Wrangler recommended (like posthog-proxy). Can add Alchemy later if multi-stage needed.
