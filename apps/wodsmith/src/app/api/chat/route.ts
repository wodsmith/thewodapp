import "server-only"
import { wrapAISDK, initLogger } from "braintrust"
import * as ai from "ai"
import { openai } from "@ai-sdk/openai"
import type { NextRequest } from "next/server"
import { getSessionFromCookie } from "@/utils/auth"
import { tryCatch } from "@/lib/try-catch"

const _logger = initLogger({
	projectName: "My Project",
	apiKey: process.env.BRAINTRUST_API_KEY,
})

const { streamText } = wrapAISDK(ai)

export const maxDuration = 30

interface ChatRequestBody {
	messages: ai.UIMessage[]
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

	const result = streamText({
		model: openai("gpt-4o"),
		messages: ai.convertToModelMessages(body.messages),
	})

	return result.toUIMessageStreamResponse()
}
