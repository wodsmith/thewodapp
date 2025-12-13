interface CorsOptions {
	origin: string | null
	allowedOrigins: string[]
	requestHeaders?: string | null
}

export function buildCorsHeaders(options: CorsOptions): Headers {
	const resolvedOrigin = resolveOrigin(options)
	const allowedHeaders =
		options.requestHeaders && options.requestHeaders.length > 0
			? options.requestHeaders
			: "Content-Type, Authorization"
	const headers = new Headers()
	headers.set("Access-Control-Allow-Origin", resolvedOrigin)
	headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	headers.set("Access-Control-Allow-Headers", allowedHeaders)
	headers.set("Access-Control-Allow-Credentials", "true")
	headers.set("Access-Control-Expose-Headers", "Content-Type")
	headers.set("Vary", "Origin")
	return headers
}

export function applyCors(response: Response, options: CorsOptions): Response {
	const corsHeaders = buildCorsHeaders(options)
	corsHeaders.forEach((value, key) => {
		response.headers.set(key, value)
	})
	return response
}

function resolveOrigin(options: CorsOptions): string {
	if (!options.origin) {
		return "*"
	}
	if (!options.allowedOrigins.length) {
		return options.origin
	}
	return options.allowedOrigins.includes(options.origin)
		? options.origin
		: "null"
}
