import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { getSessionFromCookie } from '~/utils/auth'
import { getConfig } from '~/flags'
import { tryCatch } from '~/lib/try-catch'

export const Route = createFileRoute('/api/get-session')({
	server: {
		handlers: {
			GET: async () => {
				const { data: session, error } = await tryCatch(getSessionFromCookie())
				const config = await getConfig()

				const headers = new Headers()
				headers.set(
					'Cache-Control',
					'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
				)
				headers.set('Pragma', 'no-cache')
				headers.set('Expires', '0')

				if (error) {
					return json(
						{
							session: null,
							config,
						},
						{
							headers: Object.fromEntries(headers.entries()),
						},
					)
				}

				return json(
					{
						session,
						config,
					},
					{
						headers: Object.fromEntries(headers.entries()),
					},
				)
			},
		},
	},
})
