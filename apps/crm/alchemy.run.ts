import alchemy from "alchemy"
import {
  D1Database,
  DurableObjectNamespace,
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

const r2Bucket = await R2Bucket("crm-files", {
  adopt: true,
  dev: { remote: false },
  devDomain: stage !== "prod",
})

// `@lat`: [[architecture]]
const crmMcp = DurableObjectNamespace("crm-mcp", {
  className: "CrmMcp",
  sqlite: true,
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
    // `@lat`: [[architecture]]
    CRM_MCP: crmMcp,
    R2_BUCKET: r2Bucket,
    // biome-ignore lint/style/noNonNullAssertion: Set at deploy time
    APP_URL: process.env.APP_URL!,
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
