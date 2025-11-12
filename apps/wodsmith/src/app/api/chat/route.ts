import "server-only"
import { openai } from "@ai-sdk/openai"
import * as ai from "ai"
import { initLogger, wrapAISDK } from "braintrust"
import type { NextRequest } from "next/server"
import { tryCatch } from "@/lib/try-catch"
import { getSessionFromCookie } from "@/utils/auth"
import { requireFeature, requireLimit } from "@/server/entitlements"
import { FEATURES } from "@/config/features"
import { LIMITS } from "@/config/limits"

const _logger = initLogger({
	projectName: "My Project",
	apiKey: process.env.BRAINTRUST_API_KEY,
})

const { streamText } = wrapAISDK(ai)

export const maxDuration = 30

interface ChatRequestBody {
	messages: ai.UIMessage[]
	teamId: string
}

export async function POST(req: NextRequest) {
	// Verify user is authenticated
	const { data: session, error } = await tryCatch(getSessionFromCookie())

	if (error || !session) {
		return new Response("Unauthorized", { status: 401 })
	}

	const body = (await req.json()) as ChatRequestBody

	if (!body.messages || !Array.isArray(body.messages)) {
		return new Response("Invalid request body", { status: 400 })
	}

	if (!body.teamId) {
		return new Response("Team ID is required", { status: 400 })
	}

	try {
		// Check if team has AI feature access
		await requireFeature(body.teamId, FEATURES.AI_WORKOUT_GENERATION)

		// Check and increment AI message usage
		// This checks if team has messages remaining and increments by 1
		await requireLimit(body.teamId, LIMITS.AI_MESSAGES_PER_MONTH, 1)
	} catch (error) {
		// ZSAError thrown by requireFeature/requireLimit
		if (error instanceof Error) {
			return new Response(error.message, { status: 403 })
		}
		return new Response("Access denied", { status: 403 })
	}

	const result = streamText({
		model: openai("gpt-4o"),
		messages: ai.convertToModelMessages(body.messages),
	})

	return result.toUIMessageStreamResponse()
}
