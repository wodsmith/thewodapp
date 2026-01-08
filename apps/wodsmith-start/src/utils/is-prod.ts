/**
 * Check if running in production environment.
 * This is a server-only module - uses cloudflare:workers env.
 *
 * @returns True if NODE_ENV is "production", false otherwise
 */
import { env } from "cloudflare:workers"

// NODE_ENV may not be in the typed Env interface
const isProd =
	(env as unknown as Record<string, string | undefined>).NODE_ENV ===
	"production"

export default isProd
