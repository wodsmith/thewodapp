import "server-only"
import type { NextRequest } from "next/server"
import { getCloudflareContext } from "@opennextjs/cloudflare"
import { ChatAgent } from "@repo/anvil"
import { tryCatch } from "@/lib/try-catch"
import { getSessionFromCookie } from "@/utils/auth"
import { requireFeature, requireLimit } from "@/server/entitlements"
import { FEATURES } from "@/config/features"
import { LIMITS } from "@/config/limits"

// Export the agent class for Cloudflare Workers runtime
export { ChatAgent }

export const maxDuration = 30

/**
 * Agent Chat Route - Cloudflare Agents with Durable Objects
 *
 * This route handles WebSocket upgrade requests and routes them to the
 * ChatAgent Durable Object. Use this with `useAgent` and `useAgentChat`
 * hooks on the client.
 *
 * Requirements:
 * - Must run via `pnpm preview` or in production (requires Wrangler runtime)
 * - CHAT_AGENT Durable Object binding must be configured in wrangler.jsonc
 */

async function handleRequest(req: NextRequest) {
	// Verify user is authenticated
	const { data: session, error } = await tryCatch(getSessionFromCookie())

	if (error || !session) {
		return new Response("Unauthorized", { status: 401 })
	}

	// Get teamId from query params or headers for WebSocket requests
	const url = new URL(req.url)
	const teamId = url.searchParams.get("teamId") || req.headers.get("x-team-id")

	if (!teamId) {
		return new Response("Team ID is required", { status: 400 })
	}

	try {
		// Check if team has AI feature access
		await requireFeature(teamId, FEATURES.AI_WORKOUT_GENERATION)

		// For WebSocket connections, we check limit on first message in the agent
		// For HTTP requests, check limit here
		if (req.method === "POST") {
			await requireLimit(teamId, LIMITS.AI_MESSAGES_PER_MONTH, 1)
		}
	} catch (err) {
		if (err instanceof Error) {
			return new Response(err.message, { status: 403 })
		}
		return new Response("Access denied", { status: 403 })
	}

	// Get the Cloudflare environment to access the CHAT_AGENT binding
	const { env } = getCloudflareContext()

	if (!env?.CHAT_AGENT) {
		return new Response(
			"Agent not available. This endpoint requires Cloudflare Workers runtime (use pnpm preview).",
			{ status: 503 },
		)
	}

	// Get the durable object stub using the team ID as the agent identifier
	const id = env.CHAT_AGENT.idFromName(teamId)
	const stub = env.CHAT_AGENT.get(id)

	// Forward the request to the ChatAgent durable object
	// This handles both WebSocket upgrades and HTTP requests
	return stub.fetch(req)
}

// Handle all HTTP methods - the agent handles WebSocket upgrade, GET, POST, etc.
export async function GET(req: NextRequest) {
	return handleRequest(req)
}

export async function POST(req: NextRequest) {
	return handleRequest(req)
}
