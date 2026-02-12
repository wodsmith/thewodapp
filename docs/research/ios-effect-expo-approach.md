# iOS Game Day App: Effect TS API + React Native / Expo

> Research document exploring how to build a typed API layer with Effect TS on Cloudflare Workers and a React Native / Expo iOS app that consumes it.

## Executive Summary

This approach has two parts:

1. **Effect TS API Layer** — A standalone, typed HTTP API on Cloudflare Workers that extracts your existing server function business logic into a structured API using Effect's `HttpApi` system. Provides typed errors, automatic OpenAPI generation, and dependency injection.

2. **React Native / Expo App** — A native iOS app built with Expo that consumes the API. Shares TypeScript types, Zod/Effect schemas, and business logic via the monorepo. Uses `expo-sqlite` with Drizzle for offline-first game day data.

**Key advantage:** True native iOS experience with Home Screen widgets, Live Activities, native navigation, and deep offline support. The Effect API layer provides a well-structured, independently testable backend that both the web app and mobile app can consume.

**Key cost:** You're building and maintaining two separate UI layers (web + native) and a new API layer. This is the high-investment, high-ceiling approach.

---

## Part 1: Effect TS API Layer

### Why Effect TS

Effect is a TypeScript library for building robust, composable systems. For an API layer, the relevant capabilities are:

- **Typed errors** — Every endpoint declares what errors it can return. Consumers know exactly what to handle.
- **Dependency injection** — Services (database, auth, push notifications) are declared as requirements and provided at the composition root. Makes testing trivial.
- **HttpApi** — Declarative API definition that derives server implementation, typed client, and OpenAPI docs from a single definition.
- **Schema** — Bidirectional validation (encode + decode) that replaces Zod for API boundaries while being more powerful.

### Current State: Effect on Cloudflare Workers

**Effect version:** 3.19.x (stable, actively maintained)

**Important caveat:** There is **no official `@effect/platform-cloudflare` adapter**. The official adapters are for Node.js, Bun, and Browser. However, Effect provides `HttpApiBuilder.toWebHandler()` which converts an Effect HttpApi into a standard `(Request) => Promise<Response>` handler — directly compatible with Cloudflare Workers' `fetch` handler.

**Known issue ([#4636](https://github.com/Effect-TS/effect/issues/4636)):** Cloudflare Workers pass environment bindings (D1, KV, R2) as JavaScript objects via the `env` parameter, not as string environment variables. Effect's `ConfigProvider` only supports string-based config. Workaround: create a custom Layer from the `env` parameter (detailed below).

**D1 + Drizzle gap:** `@effect/sql-drizzle` currently only supports PostgreSQL. For D1/SQLite, you wrap Drizzle calls in `Effect.tryPromise` at the service boundary. This is pragmatic and works well — your existing Drizzle queries stay unchanged.

### Architecture

```
apps/
  wodsmith-start/                    # Existing web app (unchanged)
  wodsmith-api/                      # NEW: Effect TS API on Workers
    src/
      api/                           # HttpApi definitions
        competition-api.ts           # Competition endpoints
        leaderboard-api.ts           # Leaderboard endpoints
        schedule-api.ts              # Schedule endpoints
        auth-api.ts                  # Auth endpoints
        index.ts                     # API composition root
      services/                      # Effect services (business logic)
        CompetitionService.ts
        LeaderboardService.ts
        ScheduleService.ts
        AuthService.ts
        PushNotificationService.ts
      layers/                        # Effect layers (dependency wiring)
        DatabaseLayer.ts             # Drizzle + D1 provider
        AuthLayer.ts                 # KV session provider
        CloudflareLayer.ts           # env bindings provider
      errors/                        # Typed error definitions
        index.ts
      worker.ts                      # Cloudflare Workers entry point
    wrangler.jsonc
    alchemy.run.ts
  wodsmith-mobile/                   # NEW: Expo app
packages/
  api-contract/                      # NEW: Shared API types & schemas
    src/
      schemas/                       # Effect Schema definitions (shared)
      errors/                        # Error types (shared)
      client.ts                      # Generated typed client
  shared/                            # NEW: Shared business logic
    src/
      scoring/                       # Leaderboard calculation logic
      scheduling/                    # Heat scheduling logic
```

### Effect HttpApi: Defining the Game Day API

#### API Contract (shared package)

```typescript
// packages/api-contract/src/schemas/competition.ts
import { Schema } from "effect"

export const CompetitionId = Schema.String.pipe(Schema.brand("CompetitionId"))
export type CompetitionId = typeof CompetitionId.Type

export const Competition = Schema.Struct({
  id: CompetitionId,
  name: Schema.String,
  slug: Schema.String,
  startDate: Schema.String,
  endDate: Schema.String,
  status: Schema.Literal("draft", "published"),
  competitionType: Schema.Literal("in-person", "online"),
  timezone: Schema.String,
  profileImageUrl: Schema.NullOr(Schema.String),
  bannerImageUrl: Schema.NullOr(Schema.String),
})

export const HeatAssignment = Schema.Struct({
  heatId: Schema.String,
  heatNumber: Schema.Number,
  scheduledTime: Schema.String,
  durationMinutes: Schema.Number,
  laneNumber: Schema.Number,
  venue: Schema.Struct({
    id: Schema.String,
    name: Schema.String,
  }),
  division: Schema.Struct({
    id: Schema.String,
    label: Schema.String,
  }),
  registration: Schema.Struct({
    id: Schema.String,
    teamName: Schema.NullOr(Schema.String),
    athleteName: Schema.String,
  }),
})

export const LeaderboardEntry = Schema.Struct({
  registrationId: Schema.String,
  firstName: Schema.String,
  lastName: Schema.String,
  teamName: Schema.NullOr(Schema.String),
  division: Schema.Struct({
    id: Schema.String,
    label: Schema.String,
  }),
  overallPlace: Schema.Number,
  overallPoints: Schema.Number,
  eventResults: Schema.Array(Schema.Struct({
    trackWorkoutId: Schema.String,
    eventName: Schema.String,
    place: Schema.Number,
    points: Schema.Number,
    score: Schema.String,
  })),
})
```

#### Error Definitions (shared package)

```typescript
// packages/api-contract/src/errors/index.ts
import { Schema } from "effect"

export class CompetitionNotFound extends Schema.TaggedError<CompetitionNotFound>()(
  "CompetitionNotFound",
  { slug: Schema.String },
) {}

export class Unauthorized extends Schema.TaggedError<Unauthorized>()(
  "Unauthorized",
  { message: Schema.String },
) {}

export class Forbidden extends Schema.TaggedError<Forbidden>()(
  "Forbidden",
  { message: Schema.String },
) {}

export class InvalidInput extends Schema.TaggedError<InvalidInput>()(
  "InvalidInput",
  { field: Schema.String, message: Schema.String },
) {}
```

#### API Definition

```typescript
// apps/wodsmith-api/src/api/competition-api.ts
import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "@effect/platform"
import { Schema } from "effect"
import {
  Competition, CompetitionId, HeatAssignment, LeaderboardEntry,
} from "@repo/api-contract/schemas/competition"
import {
  CompetitionNotFound, Unauthorized,
} from "@repo/api-contract/errors"

const slugParam = HttpApiSchema.param("slug", Schema.String)
const competitionIdParam = HttpApiSchema.param("competitionId", Schema.String)
const divisionIdQuery = Schema.optional(Schema.String)

// Schedule endpoints
export const ScheduleGroup = HttpApiGroup.make("schedule")
  .add(
    HttpApiEndpoint.get("getSchedule")`/competitions/${slugParam}/schedule`
      .addSuccess(Schema.Array(HeatAssignment))
      .addError(CompetitionNotFound, { status: 404 })
  )
  .add(
    HttpApiEndpoint.get("getMyHeats")`/competitions/${slugParam}/my-heats`
      .addSuccess(Schema.Array(HeatAssignment))
      .addError(CompetitionNotFound, { status: 404 })
      .addError(Unauthorized, { status: 401 })
  )

// Leaderboard endpoints
export const LeaderboardGroup = HttpApiGroup.make("leaderboard")
  .add(
    HttpApiEndpoint.get("getLeaderboard")`/competitions/${slugParam}/leaderboard`
      .addSuccess(Schema.Array(LeaderboardEntry))
      .addError(CompetitionNotFound, { status: 404 })
      .setUrlParams(Schema.Struct({
        slug: Schema.String,
      }))
  )
  .add(
    HttpApiEndpoint.get("getEventLeaderboard")`/competitions/${slugParam}/leaderboard/${HttpApiSchema.param("eventId", Schema.String)}`
      .addSuccess(Schema.Array(LeaderboardEntry))
      .addError(CompetitionNotFound, { status: 404 })
  )

// Competition endpoints
export const CompetitionGroup = HttpApiGroup.make("competitions")
  .add(
    HttpApiEndpoint.get("getCompetition")`/competitions/${slugParam}`
      .addSuccess(Competition)
      .addError(CompetitionNotFound, { status: 404 })
  )
  .add(
    HttpApiEndpoint.get("listCompetitions", "/competitions")
      .addSuccess(Schema.Array(Competition))
  )

// Push notification endpoints
export const PushGroup = HttpApiGroup.make("push")
  .add(
    HttpApiEndpoint.post("registerDevice", "/push/register")
      .setPayload(Schema.Struct({
        token: Schema.String,
        platform: Schema.Literal("ios", "android"),
        competitionId: Schema.String,
      }))
      .addError(Unauthorized, { status: 401 })
  )

// Compose the full API
export const GameDayApi = HttpApi.make("gameday")
  .add(CompetitionGroup)
  .add(ScheduleGroup)
  .add(LeaderboardGroup)
  .add(PushGroup)
  .addError(Unauthorized, { status: 401 })
```

### Effect Services: Wrapping Existing Business Logic

The key insight is that your existing business logic in `src/server/` can be wrapped in Effect services with minimal changes.

```typescript
// apps/wodsmith-api/src/services/CompetitionService.ts
import { Context, Effect, Layer } from "effect"
import { eq, and } from "drizzle-orm"
import { competitionsTable } from "@/db/schema"
import { CompetitionNotFound } from "@repo/api-contract/errors"
import type { DrizzleD1Database } from "drizzle-orm/d1"

// Service interface
export class CompetitionService extends Context.Tag("CompetitionService")<
  CompetitionService,
  {
    getBySlug: (slug: string) => Effect.Effect<Competition, CompetitionNotFound>
    listPublic: () => Effect.Effect<Competition[]>
  }
>() {}

// Service implementation using your existing Drizzle queries
export const CompetitionServiceLive = Layer.effect(
  CompetitionService,
  Effect.gen(function* () {
    const { db } = yield* DatabaseService

    return {
      getBySlug: (slug: string) =>
        Effect.tryPromise({
          try: () =>
            db.query.competitionsTable.findFirst({
              where: and(
                eq(competitionsTable.slug, slug),
                eq(competitionsTable.status, "published"),
              ),
            }),
          catch: (e) => new DatabaseError({ cause: e }),
        }).pipe(
          Effect.flatMap((comp) =>
            comp
              ? Effect.succeed(comp)
              : Effect.fail(new CompetitionNotFound({ slug }))
          ),
        ),

      listPublic: () =>
        Effect.tryPromise({
          try: () =>
            db
              .select()
              .from(competitionsTable)
              .where(
                and(
                  eq(competitionsTable.visibility, "public"),
                  eq(competitionsTable.status, "published"),
                ),
              )
              .orderBy(competitionsTable.startDate),
          catch: (e) => new DatabaseError({ cause: e }),
        }),
    }
  }),
)
```

### Cloudflare Workers Integration

```typescript
// apps/wodsmith-api/src/layers/CloudflareLayer.ts
import { Context, Layer } from "effect"
import { drizzle } from "drizzle-orm/d1"
import * as schema from "@/db/schema"

// Tag for Cloudflare env bindings
export class CloudflareEnv extends Context.Tag("CloudflareEnv")<
  CloudflareEnv,
  {
    DB: D1Database
    KV_SESSION: KVNamespace
    R2_BUCKET: R2Bucket
    APNS_KEY: string
  }
>() {}

// Tag for database
export class DatabaseService extends Context.Tag("DatabaseService")<
  DatabaseService,
  { db: DrizzleD1Database<typeof schema> }
>() {}

// Build database layer from Cloudflare env
export const DatabaseServiceLive = Layer.effect(
  DatabaseService,
  Effect.gen(function* () {
    const env = yield* CloudflareEnv
    return { db: drizzle(env.DB, { schema }) }
  }),
)
```

```typescript
// apps/wodsmith-api/src/worker.ts
import { HttpApiBuilder, HttpServer } from "@effect/platform"
import { Layer } from "effect"
import { GameDayApi } from "./api/competition-api"
import { CloudflareEnv, DatabaseServiceLive } from "./layers/CloudflareLayer"
import { CompetitionServiceLive } from "./services/CompetitionService"
// ... other service imports

// Compose all handler implementations
const CompetitionGroupLive = HttpApiBuilder.group(
  GameDayApi,
  "competitions",
  (handlers) =>
    handlers
      .handle("getCompetition", ({ path: { slug } }) =>
        Effect.gen(function* () {
          const service = yield* CompetitionService
          return yield* service.getBySlug(slug)
        }),
      )
      .handle("listCompetitions", () =>
        Effect.gen(function* () {
          const service = yield* CompetitionService
          return yield* service.listPublic()
        }),
      ),
)

// Full API layer
const ApiLive = HttpApiBuilder.api(GameDayApi).pipe(
  Layer.provide(CompetitionGroupLive),
  Layer.provide(ScheduleGroupLive),
  Layer.provide(LeaderboardGroupLive),
  Layer.provide(PushGroupLive),
  Layer.provide(CompetitionServiceLive),
  Layer.provide(LeaderboardServiceLive),
  Layer.provide(DatabaseServiceLive),
)

// Cloudflare Workers entry point
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Provide Cloudflare bindings as a Layer
    const EnvLayer = Layer.succeed(CloudflareEnv, {
      DB: env.DB,
      KV_SESSION: env.KV_SESSION,
      R2_BUCKET: env.R2_BUCKET,
      APNS_KEY: env.APNS_KEY,
    })

    const FullLayer = Layer.mergeAll(
      ApiLive,
      EnvLayer,
      HttpServer.layerContext,
    )

    const { handler } = HttpApiBuilder.toWebHandler(FullLayer)
    return handler(request)
  },
}
```

### OpenAPI Generation

Effect HttpApi generates OpenAPI automatically:

```typescript
// Add to your API composition
import { HttpApiSwagger } from "@effect/platform"

const FullLayer = Layer.mergeAll(
  ApiLive,
  HttpApiSwagger.layer(),  // Serves OpenAPI at /docs
  EnvLayer,
  HttpServer.layerContext,
)
```

This gives you:
- Interactive Swagger docs at `/docs`
- OpenAPI 3.x spec at `/docs/openapi.json`
- Can generate clients for any language from the spec

### Auth Strategy for the API

Your existing auth uses cookie-based KV sessions. For a mobile API, you have two options:

#### Option A: Bearer Token (Recommended for Mobile)

Issue a JWT or opaque token on login, pass via `Authorization: Bearer <token>` header.

```typescript
// Auth middleware for the API
import { HttpApiSecurity, HttpApiMiddleware } from "@effect/platform"

const BearerSecurity = HttpApiSecurity.bearer()

class AuthMiddleware extends HttpApiMiddleware.Tag<AuthMiddleware>()(
  "AuthMiddleware",
  {
    failure: Unauthorized,
    security: { bearer: BearerSecurity },
  }
) {}

// Implementation: validate the token against KV
const AuthMiddlewareLive = Layer.effect(
  AuthMiddleware,
  Effect.gen(function* () {
    const { KV_SESSION } = yield* CloudflareEnv

    return (token: string) =>
      Effect.tryPromise({
        try: () => KV_SESSION.get(`session:${hashToken(token)}`, "json"),
        catch: () => new Unauthorized({ message: "Invalid token" }),
      }).pipe(
        Effect.flatMap((session) =>
          session
            ? Effect.succeed(session as KVSession)
            : Effect.fail(new Unauthorized({ message: "Session expired" }))
        ),
      )
  }),
)
```

#### Option B: Reuse Cookie Auth

If the mobile app authenticates through a WebView login flow (OAuth, passkey), cookies can be forwarded. This is simpler but less standard for mobile APIs.

**Recommendation:** Use bearer tokens for the mobile API. Issue tokens via a `/auth/login` endpoint that accepts email/password or OAuth tokens, creates a KV session, and returns the session token. This keeps the same KV session infrastructure but with a mobile-friendly transport.

### Deployment

The Effect API deploys as a separate Cloudflare Worker, sharing the same D1 database and KV namespace:

```typescript
// apps/wodsmith-api/alchemy.run.ts
import { D1Database, Worker, KVNamespace } from "alchemy/cloudflare"

// Reference existing D1 and KV (shared with wodsmith-start)
const db = await D1Database("wodsmith-db")
const kv = await KVNamespace("wodsmith-sessions")

const api = await Worker("wodsmith-api", {
  name: "wodsmith-api",
  entrypoint: "./src/worker.ts",
  bindings: {
    DB: db,
    KV_SESSION: kv,
  },
  url: true,  // Gets a .workers.dev URL
  // Or use a custom domain: routes: [{ pattern: "api.wodsmith.com/*" }]
})
```

**URL structure:** `https://api.wodsmith.com/competitions/{slug}/schedule`

### Testing

Effect's dependency injection makes the API highly testable:

```typescript
// test/competition-api.test.ts
import { Effect, Layer } from "effect"
import { HttpApiClient } from "@effect/platform"

// Mock the database layer
const MockDatabaseLayer = Layer.succeed(DatabaseService, {
  db: createMockDb({
    competitions: [testCompetition],
    heats: [testHeat1, testHeat2],
  }),
})

// Test the full API handler with mocked dependencies
it("returns competition by slug", async () => {
  const result = await Effect.runPromise(
    Effect.gen(function* () {
      const client = yield* HttpApiClient.make(GameDayApi)
      return yield* client.competitions.getCompetition({ path: { slug: "test-comp" } })
    }).pipe(
      Effect.provide(TestApiLayer),
      Effect.provide(MockDatabaseLayer),
    ),
  )

  expect(result.name).toBe("Test Competition")
})
```

---

## Part 2: React Native / Expo App

### Why Expo

- **Current state:** SDK 54 stable (React Native 0.81, React 19.1). SDK 55 beta adds Home Screen widgets and Live Activities.
- **Build infrastructure:** EAS Build handles iOS signing in the cloud. No Mac needed for CI.
- **Monorepo support:** First-class pnpm workspace support since SDK 52.
- **OTA updates:** EAS Update pushes JS changes without App Store review.
- **Drizzle synergy:** `expo-sqlite` supports Drizzle ORM — share schema types with D1.

### Monorepo Integration

```
apps/
  wodsmith-start/              # Existing web app
  wodsmith-api/                # Effect TS API (from Part 1)
  wodsmith-mobile/             # NEW: Expo app
    app/                       # Expo Router file-based routes
      (tabs)/                  # Tab navigator
        schedule.tsx           # Heat schedule
        leaderboard.tsx        # Leaderboard
        my-heats.tsx           # Personal schedule
        profile.tsx            # Athlete profile
      competition/
        [slug].tsx             # Competition detail
      auth/
        login.tsx              # Login screen
    components/                # Native UI components
    hooks/                     # React hooks
    services/                  # API client, offline sync
    stores/                    # Zustand stores (patterns from web app)
    app.json                   # Expo config
    eas.json                   # EAS Build config
packages/
  api-contract/                # Shared API types & schemas
  shared/                      # Shared business logic
```

### Consuming the Effect API

You have three options for how the Expo app consumes the Effect API:

#### Option A: Effect HttpApiClient (Full Type Safety, Heavier)

```typescript
// packages/api-contract/src/client.ts
import { HttpApiClient, FetchHttpClient } from "@effect/platform"
import { Effect, Layer } from "effect"
import { GameDayApi } from "./api"

const ApiClient = HttpApiClient.make(GameDayApi, {
  baseUrl: "https://api.wodsmith.com",
})

// Usage in React Native
export const getSchedule = (slug: string) =>
  Effect.gen(function* () {
    const client = yield* ApiClient
    return yield* client.schedule.getSchedule({ path: { slug } })
  }).pipe(
    Effect.provide(FetchHttpClient.layer),
    Effect.runPromise,  // Convert to Promise for React consumption
  )
```

**Pros:** Full type inference from API definition, typed errors.
**Cons:** Adds the Effect runtime (~15KB+ compressed) to the mobile bundle. Every API call is wrapped in Effect.

#### Option B: OpenAPI Generated Client (Recommended)

Generate a plain TypeScript/fetch client from the OpenAPI spec. The mobile app stays Effect-free.

```bash
# Generate client from OpenAPI spec
npx openapi-typescript-codegen \
  --input https://api.wodsmith.com/docs/openapi.json \
  --output packages/api-contract/src/generated \
  --client fetch
```

```typescript
// packages/api-contract/src/generated/services/ScheduleService.ts
// Auto-generated — plain TypeScript, no Effect dependency
export class ScheduleService {
  public static getSchedule(slug: string): Promise<HeatAssignment[]> {
    return request(OpenAPI, {
      method: 'GET',
      url: '/competitions/{slug}/schedule',
      path: { slug },
    })
  }
}
```

**Pros:** Zero Effect dependency in mobile app. Plain fetch calls. Lightweight.
**Cons:** Type safety is one step removed (generated, not inferred). Need to regenerate on API changes.

#### Option C: Shared Types + Manual Fetch (Simplest)

Share TypeScript types from the api-contract package and write manual fetch calls:

```typescript
// apps/wodsmith-mobile/services/api.ts
import type { Competition, HeatAssignment, LeaderboardEntry } from "@repo/api-contract"

const API_BASE = "https://api.wodsmith.com"

export const api = {
  getCompetition: (slug: string): Promise<Competition> =>
    fetch(`${API_BASE}/competitions/${slug}`).then(r => r.json()),

  getSchedule: (slug: string): Promise<HeatAssignment[]> =>
    fetch(`${API_BASE}/competitions/${slug}/schedule`).then(r => r.json()),

  getLeaderboard: (slug: string, divisionId?: string): Promise<LeaderboardEntry[]> =>
    fetch(`${API_BASE}/competitions/${slug}/leaderboard${divisionId ? `?divisionId=${divisionId}` : ''}`).then(r => r.json()),

  getMyHeats: (slug: string, token: string): Promise<HeatAssignment[]> =>
    fetch(`${API_BASE}/competitions/${slug}/my-heats`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json()),
}
```

**Pros:** Zero dependencies. Trivial to understand and maintain.
**Cons:** Manual type alignment. No automatic error typing.

**Recommendation:** Option B (OpenAPI generated client) gives the best balance. You get type safety derived from your Effect API definition without coupling the mobile app to the Effect runtime.

### Offline-First with expo-sqlite + Drizzle

This is where the Expo approach has a unique advantage. Since your backend uses D1 (SQLite) with Drizzle, and `expo-sqlite` supports Drizzle, you can share schema patterns:

```typescript
// apps/wodsmith-mobile/db/schema.ts
// Subset of your backend schema, adapted for local caching
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"

export const cachedHeats = sqliteTable("cached_heats", {
  id: text("id").primaryKey(),
  competitionId: text("competition_id").notNull(),
  heatNumber: integer("heat_number").notNull(),
  scheduledTime: text("scheduled_time").notNull(),
  durationMinutes: integer("duration_minutes"),
  venueName: text("venue_name"),
  divisionLabel: text("division_label"),
  laneNumber: integer("lane_number"),
  athleteName: text("athlete_name"),
  teamName: text("team_name"),
  cachedAt: integer("cached_at").notNull(),
})

export const cachedLeaderboard = sqliteTable("cached_leaderboard", {
  id: text("id").primaryKey(),
  competitionId: text("competition_id").notNull(),
  divisionId: text("division_id"),
  data: text("data").notNull(), // JSON blob of leaderboard entries
  cachedAt: integer("cached_at").notNull(),
})

export const favorites = sqliteTable("favorites", {
  id: text("id").primaryKey(),
  competitionId: text("competition_id").notNull(),
  registrationId: text("registration_id").notNull(),
  athleteName: text("athlete_name").notNull(),
  divisionLabel: text("division_label"),
})
```

```typescript
// apps/wodsmith-mobile/db/index.ts
import { drizzle } from "drizzle-orm/expo-sqlite"
import { openDatabaseSync } from "expo-sqlite"
import * as schema from "./schema"

const expo = openDatabaseSync("gameday.db")
export const localDb = drizzle(expo, { schema })
```

#### Sync Strategy

```typescript
// apps/wodsmith-mobile/services/sync.ts
import { localDb, cachedHeats, cachedLeaderboard } from "@/db"
import { api } from "./api"

export async function syncCompetitionData(slug: string) {
  const now = Date.now()

  // Fetch and cache schedule
  const heats = await api.getSchedule(slug)
  await localDb.delete(cachedHeats).where(eq(cachedHeats.competitionId, slug))
  for (const heat of heats) {
    await localDb.insert(cachedHeats).values({
      id: heat.heatId,
      competitionId: slug,
      heatNumber: heat.heatNumber,
      scheduledTime: heat.scheduledTime,
      durationMinutes: heat.durationMinutes,
      venueName: heat.venue.name,
      divisionLabel: heat.division.label,
      laneNumber: heat.laneNumber,
      athleteName: heat.registration.athleteName,
      teamName: heat.registration.teamName,
      cachedAt: now,
    })
  }

  // Fetch and cache leaderboard
  const leaderboard = await api.getLeaderboard(slug)
  await localDb.insert(cachedLeaderboard).values({
    id: `${slug}-overall`,
    competitionId: slug,
    data: JSON.stringify(leaderboard),
    cachedAt: now,
  }).onConflictDoUpdate({
    target: cachedLeaderboard.id,
    set: { data: JSON.stringify(leaderboard), cachedAt: now },
  })
}

// Use with network-first, cache-fallback pattern
export async function getScheduleWithFallback(slug: string) {
  try {
    const heats = await api.getSchedule(slug)
    // Update cache in background
    syncCompetitionData(slug).catch(console.error)
    return heats
  } catch {
    // Offline — read from local SQLite
    return localDb.select().from(cachedHeats)
      .where(eq(cachedHeats.competitionId, slug))
      .orderBy(cachedHeats.scheduledTime)
  }
}
```

### Native UI Components

React Native uses its own component primitives. Your Shadcn/Tailwind components don't transfer, but the patterns do. Using NativeWind (Tailwind for React Native) keeps the style system familiar:

```typescript
// apps/wodsmith-mobile/components/HeatCard.tsx
import { View, Text, Pressable } from "react-native"
import { styled } from "nativewind"

interface HeatCardProps {
  heatNumber: number
  scheduledTime: string
  venue: string
  division: string
  laneNumber: number
  isNext: boolean
}

export function HeatCard({ heatNumber, scheduledTime, venue, division, laneNumber, isNext }: HeatCardProps) {
  return (
    <View className={`rounded-xl p-4 mb-3 ${isNext ? 'bg-blue-50 border-2 border-blue-500' : 'bg-white border border-gray-200'}`}>
      <View className="flex-row justify-between items-center mb-2">
        <Text className="text-lg font-bold">Heat {heatNumber}</Text>
        <Text className="text-sm text-gray-500">{scheduledTime}</Text>
      </View>
      <View className="flex-row gap-2">
        <View className="bg-gray-100 rounded px-2 py-1">
          <Text className="text-xs text-gray-600">{venue}</Text>
        </View>
        <View className="bg-gray-100 rounded px-2 py-1">
          <Text className="text-xs text-gray-600">{division}</Text>
        </View>
        <View className="bg-blue-100 rounded px-2 py-1">
          <Text className="text-xs text-blue-700">Lane {laneNumber}</Text>
        </View>
      </View>
      {isNext && (
        <View className="mt-2 bg-blue-500 rounded-lg p-2">
          <Text className="text-white text-center font-semibold">Up Next</Text>
        </View>
      )}
    </View>
  )
}
```

### Home Screen Widget (SDK 55)

This is a game-day killer feature unavailable to Capacitor or PWA:

```typescript
// apps/wodsmith-mobile/widgets/next-heat.tsx
import { Widget, Text, WidgetLayout } from "expo-widgets"

export default function NextHeatWidget() {
  // Data from shared app group / UserDefaults
  return (
    <WidgetLayout>
      <Text style={{ fontSize: 12, color: "#666" }}>Next Heat</Text>
      <Text style={{ fontSize: 24, fontWeight: "bold" }}>Heat 3</Text>
      <Text style={{ fontSize: 14 }}>10:45 AM • Lane 4</Text>
      <Text style={{ fontSize: 12, color: "#666" }}>Main Floor • RX Division</Text>
    </WidgetLayout>
  )
}
```

A competitor glances at their phone and sees their next heat without opening the app. This is the kind of native integration that creates a premium experience.

### Push Notifications

```typescript
// apps/wodsmith-mobile/services/push.ts
import * as Notifications from "expo-notifications"
import * as Device from "expo-device"
import { api } from "./api"

export async function registerForPushNotifications(competitionId: string, token: string) {
  if (!Device.isDevice) return

  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== "granted") return

  const pushToken = await Notifications.getExpoPushTokenAsync({
    projectId: Constants.expoConfig?.extra?.eas?.projectId,
  })

  // Register with your API
  await api.registerDevice({
    token: pushToken.data,
    platform: "ios",
    competitionId,
  }, token)
}

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})
```

### Navigation with Expo Router

```
apps/wodsmith-mobile/app/
├── _layout.tsx                    # Root layout (auth provider, splash)
├── (auth)/                        # Auth group
│   ├── login.tsx
│   └── register.tsx
├── (tabs)/                        # Main tab navigator
│   ├── _layout.tsx                # Tab bar config
│   ├── competitions.tsx           # Browse competitions
│   ├── my-heats.tsx               # Personal schedule (authenticated)
│   ├── leaderboard.tsx            # Live leaderboard
│   └── profile.tsx                # Athlete profile
├── competition/
│   ├── [slug]/
│   │   ├── index.tsx              # Competition overview
│   │   ├── schedule.tsx           # Full schedule
│   │   ├── leaderboard.tsx        # Competition leaderboard
│   │   ├── workouts.tsx           # Event details
│   │   └── favorites.tsx          # Spectator favorites
```

---

## Development Plan

### Phase 1: API Foundation (2-3 weeks)

1. **Set up `apps/wodsmith-api/`** — Cloudflare Worker with Effect TS
2. **Set up `packages/api-contract/`** — Shared schemas and error types
3. **Implement core read endpoints:**
   - `GET /competitions` — List public competitions
   - `GET /competitions/:slug` — Competition detail
   - `GET /competitions/:slug/schedule` — Heat schedule
   - `GET /competitions/:slug/leaderboard` — Leaderboard
4. **Deploy to Workers** via Alchemy (shares D1/KV with wodsmith-start)
5. **Generate OpenAPI spec** and verify with Swagger UI
6. **Write integration tests** using Effect's testable architecture

### Phase 2: Auth & Protected Endpoints (1-2 weeks)

1. **Implement bearer token auth** — Login endpoint, KV session validation
2. **Add protected endpoints:**
   - `GET /competitions/:slug/my-heats` — Competitor's personal schedule
   - `POST /push/register` — Device token registration
3. **Add auth middleware** to the API with typed errors
4. **Generate typed client** from OpenAPI spec

### Phase 3: Expo App Foundation (2-3 weeks)

1. **Set up `apps/wodsmith-mobile/`** — Expo project with Expo Router
2. **Configure monorepo** — pnpm workspace, Metro bundler config
3. **Build core screens:**
   - Competition browser
   - Competition detail with schedule and leaderboard tabs
   - Login / auth flow
4. **Integrate API client** — Connect to Effect API with proper error handling
5. **Set up local SQLite** with Drizzle for offline caching
6. **Deploy to TestFlight** via EAS Build

### Phase 4: Game Day Features (2-3 weeks)

1. **My Heats screen** — Personal schedule with countdown timers
2. **Spectator favorites** — Browse and favorite athletes, generate personal schedule
3. **Offline sync** — Cache schedule and leaderboard in local SQLite
4. **Push notifications** — Heat reminders, leaderboard updates
5. **Pull-to-refresh** — Network-first with cache fallback pattern

### Phase 5: Premium Native Features (2-3 weeks)

1. **Home Screen widget** — "Next Heat" widget showing upcoming heat info
2. **Live Activities** (if SDK 55 stable) — Real-time heat countdown on lock screen
3. **Haptic feedback** — Confirmation on actions, countdown milestones
4. **App badge** — Number of upcoming heats
5. **Deep linking** — Open specific competition/heat from push notification

### Phase 6: Polish & Launch (1-2 weeks)

1. **App Store screenshots and metadata**
2. **Performance optimization** — Lazy loading, image optimization
3. **Error tracking** — Sentry or Expo's built-in crash reporting
4. **Analytics** — PostHog for mobile (you already use PostHog on web)
5. **Submit to App Store**

---

## Cost Analysis

| Item | Cost | Frequency |
|---|---|---|
| Apple Developer Account | $99 | Annual |
| Expo / EAS (free tier) | Free | — |
| EAS Build (Production) | $99/mo | Monthly (includes 1000 builds/mo) |
| EAS Update | Free (included with Build) | — |
| Separate Workers deployment | Free (within Workers free tier) | — |
| Custom domain for API | ~$10 | Annual |

**Minimum viable cost:** $99/year (Apple Developer Account) + manual Xcode builds.
**Production cost:** ~$1,300/year (Apple + EAS Build production plan).

---

## Effect TS Learning Curve: Honest Assessment

Effect is powerful but has a steep learning curve:

| Concept | Difficulty | Relevance to This Project |
|---|---|---|
| `Effect<A, E, R>` type | Medium | Core — every function returns this |
| `Layer` composition | High | Core — dependency injection for all services |
| `Schema` (replacing Zod) | Medium | Used for all API contracts |
| `pipe` / `gen` syntax | Medium | Used everywhere |
| `Context.Tag` services | Medium | Used for all service definitions |
| `HttpApi` / `HttpApiGroup` | Medium | API definition layer |
| Fiber / concurrency | High | Not needed initially |

**Time to productivity:** 2-4 weeks for a developer experienced with TypeScript but new to Effect. The functional programming patterns (pipe, gen, flatMap) are the biggest adjustment.

**Recommendation:** If the team hasn't used Effect before, consider starting the API with a simpler framework (Hono with `@hono/zod-openapi`) and migrating to Effect later if the error handling and DI benefits prove necessary. Hono is first-class on Cloudflare Workers, uses Zod (which you already know), generates OpenAPI, and has near-zero learning curve. The Expo app architecture remains the same regardless of the API framework.

---

## Alternative API Framework: Hono (For Comparison)

If Effect's learning curve is a concern, Hono achieves the same goals with less friction:

```typescript
// Equivalent endpoint in Hono + @hono/zod-openapi
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi"

const app = new OpenAPIHono<{ Bindings: Env }>()

const getScheduleRoute = createRoute({
  method: "get",
  path: "/competitions/{slug}/schedule",
  request: {
    params: z.object({ slug: z.string() }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: HeatAssignmentArraySchema } },
      description: "Heat schedule",
    },
    404: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Competition not found",
    },
  },
})

app.openapi(getScheduleRoute, async (c) => {
  const { slug } = c.req.valid("param")
  const db = drizzle(c.env.DB, { schema })
  // ... your existing Drizzle query
  return c.json(heats, 200)
})

// OpenAPI spec auto-generated
app.doc("/docs/openapi.json", { openapi: "3.1.0", info: { title: "Game Day API", version: "1.0" } })

export default app
```

**Hono advantages for this project:**
- First-class Cloudflare Workers support (it was built for Workers)
- Native `c.env.DB` access — no workarounds needed
- Uses Zod (you already know it)
- OpenAPI generation via `@hono/zod-openapi`
- ~14KB bundle size
- Near-zero learning curve for your team
- Massive community (27K+ GitHub stars)

**Effect advantages over Hono:**
- Typed error channel (`Effect<A, E, R>`) — every function declares its errors
- Dependency injection via `Layer` — testability is unmatched
- `HttpApiClient` — derived typed client from API definition (if you accept the Effect runtime dependency)
- Composable middleware with typed dependencies
- Better patterns for complex business logic (retries, timeouts, resource management)

**Bottom line:** Effect is the better architecture for a team that wants to go deep on typed functional programming. Hono is the better choice for shipping quickly with a team that already knows Zod/TypeScript and wants minimal friction on Cloudflare Workers.

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Effect HttpApi is still experimental | Medium | High | Pin versions. Monitor breaking changes. Consider Hono as fallback. |
| Cloudflare bindings workaround breaks | Low | High | Track [#4636](https://github.com/Effect-TS/effect/issues/4636). Custom Layer approach is stable. |
| Team struggles with Effect learning curve | Medium | High | Budget 2-4 weeks ramp-up. Consider Hono if timeline is tight. |
| Expo monorepo Metro config issues | Medium | Medium | Test early. SDK 54 improved pnpm support significantly. |
| Two UI layers become maintenance burden | Medium | High | Keep mobile app focused (game day only). Don't replicate full web app. |
| API + mobile app doubles the attack surface | Medium | Medium | Rate limiting on API. Bearer token auth. Input validation via Effect Schema. |
| D1 parameter limit (100) affects API queries | Low | Medium | `autochunk` utility already exists. Port to API layer. |

---

## Decision Matrix: When This Approach Makes Sense

**Choose Effect + Expo if:**
- Game day becomes a strategic differentiator for WODsmith
- You want Home Screen widgets, Live Activities, or deep native integrations
- You're willing to invest in a premium mobile experience
- The team is interested in learning Effect TS (or already knows it)
- You want an independently deployable, well-tested API layer
- You plan to build non-TypeScript clients in the future (OpenAPI enables this)

**Choose Capacitor instead if:**
- You want to ship quickly with minimal new code
- The game day features are a "nice to have," not a core product
- You want to validate the concept before investing in native development
- The team is small and can't afford two UI layers
- WebView performance is acceptable for your use case (it likely is for schedule/leaderboard views)

**Hybrid path:** Start with Capacitor to validate the product. Build the Effect/Hono API layer separately (it benefits the web app too by providing a clean public API). Graduate to Expo when you need native features that Capacitor can't provide, consuming the same API.
