import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { getSessionFromCookie } from '~/utils/auth.server'

export const Route = createFileRoute('/api/get-session')({
	server: {
		handlers: {
			GET: async () => {
				const headers = new Headers()
				headers.set(
					'Cache-Control',
					'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
				)
				headers.set('Pragma', 'no-cache')
				headers.set('Expires', '0')

				try {
					const session = await getSessionFromCookie()

					return json(
						{
							session,
							// Note: this endpoint used to return feature flags/config.
							// If/when you reintroduce flags, keep this field stable for clients.
							config: null,
						},
						{
							headers: Object.fromEntries(headers.entries()),
						},
					)
				} catch (error) {
					console.error('GET /api/get-session failed:', error)
					return json(
						{
							session: null,
							config: null,
						},
						{
							headers: Object.fromEntries(headers.entries()),
						},
					)
				}
			},
		},
	},
})
