# Dynamic OG Image Service for Competitions

## Overview

When competition links are shared on social media, we want rich, branded preview images that include:

1. **Competition logo** (from `profileImageUrl`)
2. **Competition title** (from `name`)
3. **WODsmith branding** (subtle logo placement)
4. Optional: Competition dates, type badge (online/in-person), organizing team

## Architecture Decision: Separate Worker

We're deploying the OG image service as a **separate Cloudflare Worker** for:

| Benefit | Reason |
|---------|--------|
| **Bundle isolation** | Main app stays lean (~2-3MB saved) |
| **CPU isolation** | Image generation doesn't affect app latency |
| **Independent deployment** | Update designs without redeploying main app |
| **Reusability** | Can serve OG images for workouts, teams, etc. |
| **Specialized caching** | Aggressive edge caching for images |

## System Architecture

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

## Project Structure

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
    └── tsconfig.json
```

## Implementation Details

### 1. OG Worker Entry Point

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

### 2. Competition Template

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
            {formatDateRange(competition.startDate, competition.endDate)}
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

function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')

  const options: Intl.DateTimeFormatOptions = {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }

  if (startDate === endDate) {
    return start.toLocaleDateString('en-US', options)
  }

  // Same month and year
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${start.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - ${end.getDate()}, ${end.getFullYear()}`
  }

  // Same year
  if (start.getFullYear() === end.getFullYear()) {
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', options)}`
  }

  // Different years
  return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}`
}
```

### 3. Default Template

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

### 4. Internal Data API (Main App)

```typescript
// apps/wodsmith-start/src/routes/api/internal/og-data/competition/$slug.ts

import { createAPIFileRoute } from '@tanstack/react-start/api'
import { json } from '@tanstack/react-start'
import { env } from 'cloudflare:workers'
import { db } from '@/db'
import { competitionsTable } from '@/db/schema'
import { eq } from 'drizzle-orm'

export const APIRoute = createAPIFileRoute('/api/internal/og-data/competition/$slug')({
  GET: async ({ request, params }) => {
    // Verify internal API secret
    const authHeader = request.headers.get('Authorization')
    const expectedAuth = `Bearer ${env.INTERNAL_API_SECRET}`

    if (!env.INTERNAL_API_SECRET || authHeader !== expectedAuth) {
      return json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { slug } = params

    const competition = await db.query.competitionsTable.findFirst({
      where: eq(competitionsTable.slug, slug),
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
        competitionType: true,
      },
    })

    if (!competition) {
      return json({ error: 'Competition not found' }, { status: 404 })
    }

    // Only return published competitions (or draft for preview)
    return json(competition, {
      headers: {
        'Cache-Control': 'private, max-age=60', // Short cache for internal API
      },
    })
  },
})
```

### 5. Meta Tags in Competition Routes

```typescript
// apps/wodsmith-start/src/routes/compete/$slug.tsx

import { createFileRoute } from '@tanstack/react-router'

// OG service URL - configure via env in production
const OG_SERVICE_URL = 'https://og.wodsmith.com'
const APP_URL = 'https://wodsmith.com'

export const Route = createFileRoute('/compete/$slug')({
  head: ({ loaderData }) => {
    const competition = loaderData?.competition

    if (!competition) {
      return { meta: [{ title: 'Competition Not Found' }] }
    }

    const ogImageUrl = `${OG_SERVICE_URL}/competition/${competition.slug}`
    const pageUrl = `${APP_URL}/compete/${competition.slug}`
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
        { property: 'og:image:type', content: 'image/png' },
        { property: 'og:site_name', content: 'WODsmith' },

        // Twitter
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: competition.name },
        { name: 'twitter:description', content: description },
        { name: 'twitter:image', content: ogImageUrl },
      ],
    }
  },
  // ... loader, component, etc.
})
```

## Worker Configuration

### wrangler.jsonc

```jsonc
// apps/og-worker/wrangler.jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "wodsmith-og",
  "main": "src/index.ts",
  "compatibility_date": "2024-12-01",
  "compatibility_flags": ["nodejs_compat"],

  // Custom domain routing
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

### package.json

```json
{
  "name": "og-worker",
  "version": "1.0.0",
  "private": true,
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

Or via Cloudflare Dashboard: **Caching → Configuration → Purge Cache → Custom Purge**

## Security

### Internal API Authentication

```typescript
// Shared secret between workers
// Set in both via: wrangler secret put INTERNAL_API_SECRET

// OG Worker → Main App request
headers: {
  'Authorization': `Bearer ${env.API_SECRET}`,
}

// Main App validation
const authHeader = request.headers.get('Authorization')
if (authHeader !== `Bearer ${env.INTERNAL_API_SECRET}`) {
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
/workout/:id          → Workout preview (name, movements, time cap)
/team/:slug           → Team/gym preview
/leaderboard/:slug    → Leaderboard snapshot
/athlete/:id          → Athlete profile card
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

## Deployment Checklist

- [ ] Create `apps/og-worker` directory
- [ ] Initialize with `pnpm init`
- [ ] Install dependencies: `workers-og`, `wrangler`, `@cloudflare/workers-types`
- [ ] Create worker source files
- [ ] Configure `wrangler.jsonc`
- [ ] Set up DNS: `og.wodsmith.com` → Worker route
- [ ] Deploy: `wrangler deploy`
- [ ] Set secret: `wrangler secret put API_SECRET`
- [ ] Add `INTERNAL_API_SECRET` to main app
- [ ] Create internal data API route in main app
- [ ] Update competition route `head()` with OG meta tags
- [ ] Test with [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
- [ ] Test with [Twitter Card Validator](https://cards-dev.twitter.com/validator)

## Testing

### Local Development

```bash
# Terminal 1: Main app
cd apps/wodsmith-start
pnpm dev

# Terminal 2: OG Worker
cd apps/og-worker
pnpm dev --port 8788
```

### Manual Testing

```bash
# Test OG image generation
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
