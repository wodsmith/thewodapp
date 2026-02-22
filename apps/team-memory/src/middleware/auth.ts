import {createMiddleware} from 'hono/factory'
import type {Env} from '../types'

/**
 * Bearer token auth middleware.
 * Validates the Authorization header against the API_TOKEN secret
 * stored in Cloudflare Workers secrets.
 */
export const requireAuth = createMiddleware<{Bindings: Env}>(
	async (c, next) => {
		const authHeader = c.req.header('Authorization')

		if (!authHeader) {
			return c.json({error: 'Missing Authorization header'}, 401)
		}

		const [scheme, token] = authHeader.split(' ')

		if (scheme !== 'Bearer' || !token) {
			return c.json({error: 'Invalid Authorization format, expected: Bearer <token>'}, 401)
		}

		if (!c.env.API_TOKEN) {
			console.error('API_TOKEN secret is not configured')
			return c.json({error: 'Server auth misconfigured'}, 500)
		}

		// Constant-time comparison to prevent timing attacks
		const expected = new TextEncoder().encode(c.env.API_TOKEN)
		const provided = new TextEncoder().encode(token)

		if (
			expected.byteLength !== provided.byteLength ||
			!crypto.subtle.timingSafeEqual(expected, provided)
		) {
			return c.json({error: 'Invalid token'}, 403)
		}

		await next()
	},
)
