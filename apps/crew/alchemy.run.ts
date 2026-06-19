import alchemy from "alchemy"
import {
  Hyperdrive,
  KVNamespace,
  R2Bucket,
  TanStackStart,
} from "alchemy/cloudflare"
import { CloudflareStateStore } from "alchemy/state"

const stage = process.env.STAGE ?? "dev"

const app = await alchemy("wodsmith-crew", {
  stage,
  phase: process.argv.includes("--destroy") ? "destroy" : "up",
  stateStore: process.env.CI
    ? (scope) => new CloudflareStateStore(scope)
    : undefined,
})

function getDomains(currentStage: string): string[] | undefined {
  if (currentStage === "prod") {
    return ["crew.wodsmith.com"]
  }
  if (currentStage === "demo") {
    return ["crew-demo.wodsmith.com"]
  }
  return undefined
}

function createHyperdriveOrigin(databaseUrl: string) {
  const url = new URL(databaseUrl)

  return {
    host: url.hostname,
    database: url.pathname.slice(1),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    port: url.port ? Number(url.port) : 3306,
    scheme: "mysql" as const,
  }
}

// biome-ignore lint/style/noNonNullAssertion: Deploy workflow provides a stage-specific PlanetScale URL.
const databaseUrl = process.env.DATABASE_URL!

const hyperdrive = await Hyperdrive(`crew-hyperdrive-${stage}`, {
  origin: createHyperdriveOrigin(databaseUrl),
  caching: {
    disabled: true,
  },
  adopt: true,
  dev: {
    origin: databaseUrl,
  },
})

const kvSession = await KVNamespace("crew-sessions", {
  adopt: true,
})

const r2Bucket = await R2Bucket("wodsmith-crew-uploads", {
  adopt: true,
  dev: { remote: true },
  devDomain: stage !== "prod",
})

const website = await TanStackStart("crew-app", {
  bindings: {
    KV_SESSION: kvSession,
    R2_BUCKET: r2Bucket,
    HYPERDRIVE: hyperdrive,
    // biome-ignore lint/style/noNonNullAssertion: Set by deploy workflow.
    APP_URL: process.env.APP_URL!,
    SITE_URL: process.env.APP_URL ?? "https://crew.wodsmith.com",
    NODE_ENV:
      stage === "prod" || stage === "demo" ? "production" : "development",
    R2_PUBLIC_URL: r2Bucket.domains?.[0]
      ? `https://${r2Bucket.domains[0]}`
      : r2Bucket.devDomain
        ? `https://${r2Bucket.devDomain}`
        : "",
    DATABASE_URL: alchemy.secret(databaseUrl),
    EMAIL_FROM: "team@mail.wodsmith.com",
    EMAIL_FROM_NAME: "WODsmith Crew",
    EMAIL_REPLY_TO: "support@mail.wodsmith.com",
    ...(process.env.POSTHOG_KEY && {
      POSTHOG_KEY: process.env.POSTHOG_KEY,
    }),
    ...(process.env.SENTRY_DSN && {
      SENTRY_DSN: process.env.SENTRY_DSN,
    }),
    ...(process.env.TURNSTILE_SITE_KEY && {
      TURNSTILE_SITE_KEY: process.env.TURNSTILE_SITE_KEY,
    }),
    ...(process.env.TURNSTILE_SECRET_KEY && {
      TURNSTILE_SECRET_KEY: alchemy.secret(process.env.TURNSTILE_SECRET_KEY),
    }),
    ...(process.env.RESEND_API_KEY && {
      RESEND_API_KEY: alchemy.secret(process.env.RESEND_API_KEY),
    }),
  },
  domains: getDomains(stage),
  adopt: true,
})

export type Env = typeof website.Env
export default website

await app.finalize()
