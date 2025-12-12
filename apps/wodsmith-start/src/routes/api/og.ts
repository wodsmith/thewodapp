import { createFileRoute } from '@tanstack/react-router'
import { SITE_NAME, SITE_URL } from '~/constants'

export const Route = createFileRoute('/api/og')({
	server: {
		handlers: {
			GET: async ({ request }) => {
				try {
					const { searchParams } = new URL(request.url)

					// ?title=<title>&description=<description>
					const hasTitle = searchParams.has('title')
					const title = hasTitle
						? searchParams.get('title')?.slice(0, 100)
						: 'Track your workouts and progress'

					const hasDescription = searchParams.has('description')
					const rawDescription = hasDescription
						? searchParams.get('description')
						: null

					// Truncate description intelligently to fit nicely on the card
					// Aim for ~200 characters max to ensure it fits well
					let description = rawDescription
					if (
						description &&
						description.length > 200
					) {
						// Try to cut at a natural break point (period, newline, or space)
						const naturalBreaks = [
							description.lastIndexOf('.', 200),
							description.lastIndexOf('\n', 200),
							description.lastIndexOf(' ', 200),
						]
						const breakPoint = Math.max(...naturalBreaks)
						if (breakPoint > 100) {
							// Only use natural break if it's not too early
							description = `${description.slice(0, breakPoint + 1).trim()}...`
						} else {
							// Otherwise just hard cut at 200 chars
							description = `${description.slice(0, 200).trim()}...`
						}
					}

					// Using @vercel/og or similar OG image generation
					// For TanStack Start, we'll return a simple HTML response with og meta tags
					// or use a service like Vercel OG / Satori
					const ogHtml = `
<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width" />
	<title>${title}</title>
	<style>
		body {
			margin: 0;
			padding: 80px;
			width: 1200px;
			height: 630px;
			background: linear-gradient(to top, #000000 0%, #0a0a0a 50%, #000000 100%);
			font-family: system-ui, -apple-system, sans-serif;
			display: flex;
			flex-direction: column;
			justify-content: space-between;
		}
		.content {
			display: flex;
			flex-direction: ${description ? 'row' : 'column'};
			justify-content: ${description ? 'space-between' : 'center'};
			align-items: flex-start;
			flex: 1;
		}
		.title {
			font-size: ${description ? '56px' : '72px'};
			font-weight: bold;
			color: white;
			line-height: 1.2;
			letter-spacing: -0.02em;
			max-width: ${description ? '380px' : '1000px'};
		}
		.description {
			font-size: 24px;
			color: #e5e5e5;
			line-height: 1.6;
			font-weight: normal;
			background: linear-gradient(to top, #000000 0%, #1a1a1a 100%);
			border-radius: 16px;
			border: 2px solid #2a2a2a;
			max-width: 550px;
			padding: 40px;
			box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
		}
		.branding {
			display: flex;
			align-items: center;
			gap: 16px;
			margin-top: 40px;
		}
		.logo {
			width: 60px;
			height: 60px;
			border-radius: 8px;
		}
		.site-name {
			font-size: 40px;
			font-weight: bold;
			color: white;
			letter-spacing: -0.01em;
		}
		.accent {
			position: absolute;
			bottom: 0;
			left: 0;
			right: 0;
			height: 8px;
			background: linear-gradient(90deg, #ff7033 0%, #ff9066 100%);
		}
	</style>
</head>
<body>
	<div class="content">
		<div class="title">${title}</div>
		${description ? `<div class="description">${description}</div>` : ''}
	</div>
	<div class="branding">
		<img alt="${SITE_NAME}" class="logo" src="${SITE_URL}/wodsmith-logo-no-text.png" />
		<div class="site-name">${SITE_NAME}</div>
	</div>
	<div class="accent"></div>
</body>
</html>
					`

					return new Response(ogHtml, {
						headers: {
							'Content-Type': 'text/html; charset=utf-8',
						},
					})
				} catch (e: unknown) {
					const message =
						typeof e === 'object' &&
						e !== null &&
						'message' in e
							? (e as { message: string }).message
							: 'Unknown error'
					const errorPayload =
						typeof e === 'object' && e !== null
							? JSON.stringify(e)
							: String(e)
					const { logError } = await import(
						'~/lib/logging/posthog-otel-logger'
					)
					logError({
						message: '[api/og] Failed to generate image',
						error: e,
						attributes: { message, errorPayload },
					})
					return new Response('Failed to generate the image', {
						status: 500,
					})
				}
			},
		},
	},
})
