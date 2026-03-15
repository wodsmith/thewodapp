import type { CloudflareOptions } from "@sentry/cloudflare"
import { getAppUrl, getNodeEnv, getSentryDsn } from "@/lib/env"

/**
 * Derive environment name from APP_URL for Sentry.
 */
function getSentryEnvironment(): string {
  const appUrl = getAppUrl()
  if (appUrl.includes("demo.wodsmith.com")) return "demo"
  if (appUrl.includes("wodsmith.com")) return "production"
  return "development"
}

/**
 * Centralized Sentry config factory for the server.
 * Used by both `withSentry` (server.ts) and `instrumentWorkflowWithSentry` (workflow).
 */
export function getSentryOptions(_envObj: Env): CloudflareOptions {
  const dsn = getSentryDsn()
  const nodeEnv = getNodeEnv()
  return {
    dsn: dsn || undefined,
    tracesSampleRate: nodeEnv === "production" ? 0.1 : 1.0,
    environment: getSentryEnvironment(),
    sendDefaultPii: false,
  }
}
