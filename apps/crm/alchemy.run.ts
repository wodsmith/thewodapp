import alchemy from "alchemy"
import {
  D1Database,
  Hyperdrive,
  R2Bucket,
  TanStackStart,
} from "alchemy/cloudflare"
import { CloudflareStateStore } from "alchemy/state"

const stage = process.env.STAGE ?? "dev"

const app = await alchemy("crm", {
  stage,
  phase: process.argv.includes("--destroy") ? "destroy" : "up",
  stateStore: process.env.CI
    ? (scope) => new CloudflareStateStore(scope)
    : undefined,
})

const db = await D1Database("db", {
  migrationsDir: "./src/db/migrations",
  adopt: true,
})

const databaseUrlString = process.env.DATABASE_URL
if (!databaseUrlString) {
  throw new Error("DATABASE_URL not configured")
}

const databaseUrl = new URL(databaseUrlString)

const hyperdrive = await Hyperdrive(`crm-hyperdrive-${stage}`, {
  origin: {
    host: databaseUrl.hostname,
    database: databaseUrl.pathname.slice(1),
    user: decodeURIComponent(databaseUrl.username),
    password: decodeURIComponent(databaseUrl.password),
    port: 3306,
    scheme: "mysql",
  },
  caching: {
    disabled: true,
  },
  adopt: true,
  dev: {
    origin: databaseUrlString,
  },
})

const r2Bucket = await R2Bucket("crm-files", {
  adopt: true,
  dev: { remote: true },
  devDomain: stage !== "prod",
})

function getDomains(currentStage: string): string[] | undefined {
  if (currentStage === "prod") {
    return ["crm.wodsmith.com"]
  }
  return undefined
}

const website = await TanStackStart("app", {
  bindings: {
    DB: db,
    R2_BUCKET: r2Bucket,
    HYPERDRIVE: hyperdrive,
    // biome-ignore lint/style/noNonNullAssertion: Set at deploy time
    APP_URL: process.env.APP_URL!,
    DATABASE_URL: alchemy.secret(databaseUrlString),
    NODE_ENV: stage === "prod" ? "production" : "development",
    // biome-ignore lint/style/noNonNullAssertion: Required
    CRM_AUTH_PASSWORD: alchemy.secret(process.env.CRM_AUTH_PASSWORD!),
    // biome-ignore lint/style/noNonNullAssertion: Required for session signing
    CRM_SESSION_SECRET: alchemy.secret(process.env.CRM_SESSION_SECRET!),
  },
  domains: getDomains(stage),
  adopt: true,
})

export type Env = typeof website.Env
export default website

await app.finalize()
