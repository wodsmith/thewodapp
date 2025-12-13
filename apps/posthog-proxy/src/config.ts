export interface Env {
	POSTHOG_HOST?: string
	POSTHOG_ASSETS_HOST?: string
	PUBLIC_PATH_PREFIX?: string
	ALLOWED_ORIGINS?: string
}

export interface ProxyConfig {
	targetHost: string
	assetsHost: string
	publicPathPrefix: string
	allowedOrigins: string[]
}

const DEFAULT_TARGET_HOST = "us.i.posthog.com"
const DEFAULT_ASSETS_HOST = "us-assets.i.posthog.com"
const DEFAULT_PREFIX = "/ingest"

export function loadConfig(env: Env): ProxyConfig {
	const allowedOrigins = parseAllowedOrigins(env.ALLOWED_ORIGINS)
	return {
		targetHost: env.POSTHOG_HOST ?? DEFAULT_TARGET_HOST,
		assetsHost: env.POSTHOG_ASSETS_HOST ?? DEFAULT_ASSETS_HOST,
		publicPathPrefix: env.PUBLIC_PATH_PREFIX ?? DEFAULT_PREFIX,
		allowedOrigins,
	}
}

function parseAllowedOrigins(origins: string | undefined): string[] {
	if (!origins) {
		return []
	}
	return origins
		.split(",")
		.map((origin) => origin.trim())
		.filter(Boolean)
}
