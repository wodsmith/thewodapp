import type { Env } from "./config"
import { loadConfig } from "./config"
import { proxyRequest } from "./proxy"

export default {
	async fetch(
		request: Request,
		env: Env,
		_ctx: ExecutionContext,
	): Promise<Response> {
		const config = loadConfig(env)
		const startedAt = Date.now()

		const response = await proxyRequest({ request, config })

		console.log("INFO: [posthog-proxy] forwarded request", {
			path: new URL(request.url).pathname,
			status: response.status,
			durationMs: Date.now() - startedAt,
		})

		return response
	},
}
