/**
 * AI Chat API Route for TanStack Start
 *
 * POST /api/ai/chat
 * Streams AI agent responses using Mastra and AI SDK.
 *
 * Request body: { messages: Message[], threadId?: string }
 * Response: Server-Sent Events stream (UIMessageChunk format)
 * Response headers: X-Thread-Id (the thread ID used for this conversation)
 */

import { createFileRoute } from "@tanstack/react-router"
import { createUIMessageStreamResponse, createUIMessageStream } from "ai"
import { toAISdkStream } from "@mastra/ai-sdk"
import { getSessionFromCookie } from "@/utils/auth"
import { getActiveTeamId } from "@/utils/team-auth"
import { competitionRouter } from "@/ai/agents"
import { createRequestContext } from "@/ai/mastra"

/**
 * Filter out reasoning parts from messages to prevent GPT-5 reasoning errors.
 * When GPT-5 returns reasoning tokens, they get stored in messages, but sending
 * them back causes "Item of type 'reasoning' was provided without its required
 * following item" errors.
 *
 * @see https://github.com/mastra-ai/mastra/issues/10981
 */
function filterReasoningFromMessages(messages: unknown[]): unknown[] {
	return messages.map((msg) => {
		if (typeof msg === "object" && msg !== null && "parts" in msg) {
			const typedMsg = msg as { parts?: unknown[] }
			if (Array.isArray(typedMsg.parts)) {
				return {
					...msg,
					parts: typedMsg.parts.filter((part) => {
						if (typeof part === "object" && part !== null && "type" in part) {
							return (part as { type: string }).type !== "reasoning"
						}
						return true
					}),
				}
			}
		}
		return msg
	})
}

/**
 * Generate a new thread ID for conversations.
 */
function generateThreadId(): string {
	return `thread_${crypto.randomUUID()}`
}

export const Route = createFileRoute("/api/ai/chat")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				// Check authentication
				const session = await getSessionFromCookie()
				if (!session) {
					return new Response(JSON.stringify({ error: "Unauthorized" }), {
						status: 401,
						headers: { "Content-Type": "application/json" },
					})
				}

				// Get active team ID
				const activeTeamId = await getActiveTeamId()
				if (!activeTeamId) {
					return new Response(JSON.stringify({ error: "No team selected" }), {
						status: 400,
						headers: { "Content-Type": "application/json" },
					})
				}

				// Find the team in session to get permissions
				const activeTeam = session.teams?.find((t) => t.id === activeTeamId)
				if (!activeTeam) {
					return new Response(
						JSON.stringify({ error: "Team not found in session" }),
						{
							status: 400,
							headers: { "Content-Type": "application/json" },
						},
					)
				}

				try {
					// Parse request body
					const body = await request.json()
					const { messages, threadId: requestThreadId } = body as {
						messages?: unknown
						threadId?: string
					}

					if (!messages || !Array.isArray(messages)) {
						return new Response(
							JSON.stringify({ error: "Invalid messages format" }),
							{
								status: 400,
								headers: { "Content-Type": "application/json" },
							},
						)
					}

					// Filter out reasoning parts from messages to prevent GPT-5 errors
					const filteredMessages = filterReasoningFromMessages(messages)

					// Use provided threadId or generate a new one
					const threadId = requestThreadId || generateThreadId()

					// Create request context for multi-tenant operations
					const requestContext = createRequestContext({
						user: session.user,
						currentTeam: {
							id: activeTeam.id,
							permissions: activeTeam.permissions,
						},
					})

					// Stream agent response with memory threading
					// Cast is safe since we only filter parts, not change message structure
					const agentStream = await competitionRouter.stream(
						filteredMessages as Parameters<typeof competitionRouter.stream>[0],
						{
							requestContext,
							// Allow multiple tool calls for complex operations like creating competitions
							// Default is 1, which is too limiting for multi-step workflows
							maxSteps: 20,
							// Memory configuration for conversation threading
							memory: {
								thread: threadId,
								resource: session.user.id,
							},
							// GPT-5 reasoning model fix: disable server-side storage to prevent
							// orphaned item_reference errors on follow-up requests.
							// See: https://github.com/mastra-ai/mastra/issues/10981
							providerOptions: {
								openai: {
									store: false,
									include: ["reasoning.encrypted_content"],
								},
							},
						},
					)

					// Create UI message stream for AI SDK useChat
					const uiMessageStream = createUIMessageStream({
						execute: async ({ writer }) => {
							// Convert Mastra stream to AI SDK v5 format
							const sdkStream = toAISdkStream(agentStream, { from: "agent" })
							const reader = sdkStream.getReader()
							try {
								while (true) {
									const { done, value } = await reader.read()
									if (done) break
									if (value) writer.write(value)
								}
							} finally {
								reader.releaseLock()
							}
						},
					})

					// Return as UIMessageStreamResponse for useChat compatibility
					// Include threadId in headers so client can track it
					return createUIMessageStreamResponse({
						stream: uiMessageStream,
						headers: {
							"X-Thread-Id": threadId,
						},
					})
				} catch (error) {
					console.error("AI Chat error:", error)
					return new Response(
						JSON.stringify({
							error: error instanceof Error ? error.message : "Internal error",
						}),
						{
							status: 500,
							headers: { "Content-Type": "application/json" },
						},
					)
				}
			},
		},
	},
})
