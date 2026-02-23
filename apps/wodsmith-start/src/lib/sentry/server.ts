import type { CloudflareOptions } from "@sentry/cloudflare"

/**
 * Type-safe access to env vars that may or may not exist in the typed Env interface.
 */
function getEnvVar(envObj: Env, key: string): string | undefined {
	return (envObj as unknown as Record<string, string | undefined>)[key]
}

/**
 * Derive environment name from APP_URL for Sentry.
 */
function getSentryEnvironment(envObj: Env): string {
	const appUrl = getEnvVar(envObj, "APP_URL")
	if (appUrl?.includes("demo.wodsmith.com")) return "demo"
	if (appUrl?.includes("wodsmith.com")) return "production"
	return "development"
}

/**
 * Centralized Sentry config factory for the server.
 * Used by both `withSentry` (server.ts) and `instrumentWorkflowWithSentry` (workflow).
 */
export function getSentryOptions(envObj: Env): CloudflareOptions {
	const dsn = getEnvVar(envObj, "SENTRY_DSN")
	const nodeEnv = getEnvVar(envObj, "NODE_ENV")
	return {
		dsn: dsn || undefined,
		tracesSampleRate: nodeEnv === "production" ? 0.1 : 1.0,
		environment: getSentryEnvironment(envObj),
		sendDefaultPii: false,
	}
}
