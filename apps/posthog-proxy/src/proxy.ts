import type { ProxyConfig } from "./config"
import { applyCors, buildCorsHeaders } from "./cors"

interface ForwardRequestOptions {
	request: Request
	config: ProxyConfig
}

interface UpstreamUrlResult {
	url: URL
	targetHost: string
}

export async function proxyRequest(
	options: ForwardRequestOptions,
): Promise<Response> {
	const { request, config } = options
	const origin = request.headers.get("origin")
	const requestedHeaders = request.headers.get("access-control-request-headers")

	if (request.method === "OPTIONS") {
		return new Response(null, {
			status: 204,
			headers: buildCorsHeaders({
				origin,
				allowedOrigins: config.allowedOrigins,
				requestHeaders: requestedHeaders,
			}),
		})
	}

	const upstream = buildUpstreamUrl({ request, config })

	const forwardedHeaders = buildForwardHeaders({
		request,
		targetHost: upstream.targetHost,
	})
	const upstreamRequest = new Request(upstream.url.toString(), {
		method: request.method,
		headers: forwardedHeaders,
		body: shouldSendBody(request.method) ? request.body : undefined,
		redirect: "manual",
	})

	const upstreamResponse = await fetch(upstreamRequest)

	return applyCors(new Response(upstreamResponse.body, upstreamResponse), {
		origin,
		allowedOrigins: config.allowedOrigins,
		requestHeaders: requestedHeaders,
	})
}

function buildUpstreamUrl(options: ForwardRequestOptions): UpstreamUrlResult {
	const { request, config } = options
	const incomingUrl = new URL(request.url)
	const pathname = normalizePath({
		pathname: incomingUrl.pathname,
		publicPathPrefix: config.publicPathPrefix,
	})

	const targetHost = pathname.startsWith("/static/")
		? config.assetsHost
		: config.targetHost

	const upstreamUrl = new URL(request.url)
	upstreamUrl.protocol = "https:"
	upstreamUrl.hostname = targetHost
	upstreamUrl.pathname = pathname

	return { url: upstreamUrl, targetHost }
}

function normalizePath(options: {
	pathname: string
	publicPathPrefix: string
}): string {
	const { pathname, publicPathPrefix } = options
	if (pathname.startsWith(publicPathPrefix)) {
		const stripped = pathname.slice(publicPathPrefix.length)
		return stripped.length > 0 ? stripped : "/"
	}
	return pathname
}

function buildForwardHeaders(options: {
	request: Request
	targetHost: string
}): Headers {
	const headers = new Headers()
	options.request.headers.forEach((value, key) => {
		if (key.toLowerCase() === "host") {
			return
		}
		headers.set(key, value)
	})
	headers.set("host", options.targetHost)
	headers.set(
		"x-forwarded-for",
		options.request.headers.get("cf-connecting-ip") ?? "",
	)
	headers.set("x-forwarded-proto", "https")
	return headers
}

function shouldSendBody(method: string): boolean {
	return method !== "GET" && method !== "HEAD"
}
