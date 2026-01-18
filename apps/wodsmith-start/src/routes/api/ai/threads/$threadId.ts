/**
 * AI Thread Detail API Route
 *
 * GET /api/ai/threads/:threadId - Get thread with messages
 * DELETE /api/ai/threads/:threadId - Delete a thread
 */

import { createFileRoute } from "@tanstack/react-router"
import { getSessionFromCookie } from "@/utils/auth"
import { createMemory } from "@/ai/mastra"

/**
 * Extract text content from a Mastra message content field.
 * Content can be a string or an object with { format, parts }.
 */
function extractTextContent(content: unknown): string {
	if (typeof content === "string") {
		return content
	}

	if (content && typeof content === "object" && "parts" in content) {
		const parts = (content as { parts: Array<{ type: string; text?: string }> })
			.parts
		return parts
			.filter((p) => p.type === "text" && p.text)
			.map((p) => p.text)
			.join("")
	}

	return ""
}

export const Route = createFileRoute("/api/ai/threads/$threadId")({
	server: {
		handlers: {
			/**
			 * GET /api/ai/threads/:threadId
			 * Get a thread with its messages.
			 *
			 * Query params:
			 * - page: Page number (default: 1)
			 * - perPage: Items per page (default: 50)
			 */
			GET: async ({ request, params }) => {
				const session = await getSessionFromCookie()
				if (!session) {
					return new Response(JSON.stringify({ error: "Unauthorized" }), {
						status: 401,
						headers: { "Content-Type": "application/json" },
					})
				}

				try {
					const { threadId } = params
					const url = new URL(request.url)
					const page = parseInt(url.searchParams.get("page") ?? "1", 10)
					const perPage = Math.min(
						parseInt(url.searchParams.get("perPage") ?? "50", 10),
						100,
					)

					const memory = createMemory()

					// Get thread to verify ownership
					const thread = await memory.getThreadById({ threadId })
					if (!thread) {
						return new Response(JSON.stringify({ error: "Thread not found" }), {
							status: 404,
							headers: { "Content-Type": "application/json" },
						})
					}

					// Verify thread belongs to this user
					if (thread.resourceId !== session.user.id) {
						return new Response(JSON.stringify({ error: "Thread not found" }), {
							status: 404,
							headers: { "Content-Type": "application/json" },
						})
					}

					// Recall messages from thread
					const result = await memory.recall({
						threadId,
						resourceId: session.user.id,
					})

					// Apply pagination manually since recall may not support it directly
					const allMessages = result.messages ?? []
					const startIdx = (page - 1) * perPage
					const paginatedMessages = allMessages.slice(
						startIdx,
						startIdx + perPage,
					)
					const hasMore = startIdx + perPage < allMessages.length

					return new Response(
						JSON.stringify({
							thread: {
								id: thread.id,
								title: thread.title ?? null,
								createdAt: thread.createdAt,
								updatedAt: thread.updatedAt,
							},
							messages: paginatedMessages.map((msg) => ({
								id: msg.id,
								role: msg.role,
								content: extractTextContent(msg.content),
								createdAt: msg.createdAt,
							})),
							hasMore,
							page,
							perPage,
						}),
						{
							headers: { "Content-Type": "application/json" },
						},
					)
				} catch (error) {
					console.error("Get thread error:", error)
					return new Response(
						JSON.stringify({
							error:
								error instanceof Error ? error.message : "Failed to get thread",
						}),
						{
							status: 500,
							headers: { "Content-Type": "application/json" },
						},
					)
				}
			},

			/**
			 * DELETE /api/ai/threads/:threadId
			 * Delete a thread and all its messages.
			 */
			DELETE: async ({ params }) => {
				const session = await getSessionFromCookie()
				if (!session) {
					return new Response(JSON.stringify({ error: "Unauthorized" }), {
						status: 401,
						headers: { "Content-Type": "application/json" },
					})
				}

				try {
					const { threadId } = params
					const memory = createMemory()

					// Get thread to verify ownership
					const thread = await memory.getThreadById({ threadId })
					if (!thread) {
						return new Response(JSON.stringify({ error: "Thread not found" }), {
							status: 404,
							headers: { "Content-Type": "application/json" },
						})
					}

					// Verify thread belongs to this user
					if (thread.resourceId !== session.user.id) {
						return new Response(JSON.stringify({ error: "Thread not found" }), {
							status: 404,
							headers: { "Content-Type": "application/json" },
						})
					}

					// Delete the thread
					await memory.deleteThread(threadId)

					return new Response(JSON.stringify({ success: true }), {
						headers: { "Content-Type": "application/json" },
					})
				} catch (error) {
					console.error("Delete thread error:", error)
					return new Response(
						JSON.stringify({
							error:
								error instanceof Error
									? error.message
									: "Failed to delete thread",
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
