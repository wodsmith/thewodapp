import { routeAgentRequest } from "agents"
import { AIChatAgent } from "agents/ai-chat-agent"
import { openai } from "@ai-sdk/openai"
import {
	convertToModelMessages,
	createUIMessageStream,
	createUIMessageStreamResponse,
	streamText,
	type StreamTextOnFinishCallback,
	type ToolSet,
} from "ai"

/**
 * ChatAgent - Cloudflare Durable Object for AI chat
 *
 * This agent handles real-time AI chat interactions with:
 * - Persistent chat state across requests
 * - WebSocket support for real-time streaming
 * - Tool calling capabilities
 */
export class ChatAgent extends AIChatAgent<Env> {
	/**
	 * Handles incoming chat messages and returns a streaming response
	 */
	async onChatMessage(
		onFinish: StreamTextOnFinishCallback<ToolSet>,
		_options?: { abortSignal?: AbortSignal },
	) {
		const stream = createUIMessageStream({
			execute: async ({ writer }) => {
				const result = streamText({
					// biome-ignore lint/suspicious/noExplicitAny: AI SDK type mismatch between v1 and v2
					model: openai("gpt-4o") as any,
					messages: convertToModelMessages(this.messages),
					onFinish,
				})

				writer.merge(result.toUIMessageStream())
			},
		})

		return createUIMessageStreamResponse({ stream })
	}
}

/**
 * Worker entry point - routes requests to the ChatAgent Durable Object
 */
export default {
	async fetch(request: Request, env: Env, _ctx: ExecutionContext) {
		const url = new URL(request.url)

		// Health check endpoint
		if (url.pathname === "/health") {
			return Response.json({
				status: "ok",
				hasOpenAIKey: !!env.OPENAI_API_KEY,
			})
		}

		// Warn if OPENAI_API_KEY is not set
		if (!env.OPENAI_API_KEY) {
			console.error(
				"OPENAI_API_KEY is not set. Set it in .dev.vars for local dev, or use 'wrangler secret put OPENAI_API_KEY' for production.",
			)
		}

		// Route the request to the ChatAgent Durable Object
		const response = await routeAgentRequest(request, env)

		if (response) {
			return response
		}

		return new Response("Not found", { status: 404 })
	},
} satisfies ExportedHandler<Env>
