/**
 * AI Threads API Route
 *
 * GET /api/ai/threads - List user's conversation threads
 */

import { createFileRoute } from "@tanstack/react-router"
import { getSessionFromCookie } from "@/utils/auth"
import { createMemory } from "@/ai/mastra"

export const Route = createFileRoute("/api/ai/threads/")({
	server: {
		handlers: {
			/**
			 * GET /api/ai/threads
			 * List all conversation threads for the authenticated user.
			 *
			 * Query params:
			 * - page: Page number (default: 1)
			 * - perPage: Items per page (default: 20)
			 */
			GET: async ({ request }) => {
				// Check authentication
				const session = await getSessionFromCookie()
				if (!session) {
					return new Response(JSON.stringify({ error: "Unauthorized" }), {
						status: 401,
						headers: { "Content-Type": "application/json" },
					})
				}

				try {
					const url = new URL(request.url)
					// API uses 1-indexed pages for user-friendliness, but Mastra uses 0-indexed
					const userPage = parseInt(url.searchParams.get("page") ?? "1", 10)
					const page = Math.max(0, userPage - 1) // Convert to 0-indexed
					const perPage = Math.min(
						parseInt(url.searchParams.get("perPage") ?? "20", 10),
						50,
					)

					const memory = await createMemory()

					// List threads for this user (resourceId = user.id)
					// Note: Mastra Memory API uses 0-indexed pages
					const result = await memory.listThreads({
						filter: { resourceId: session.user.id },
						page,
						perPage,
					})

					return new Response(
						JSON.stringify({
							threads: result.threads.map((thread: { id: string; title?: string | null; createdAt: unknown; updatedAt: unknown }) => ({
								id: thread.id,
								title: thread.title ?? null,
								createdAt: thread.createdAt,
								updatedAt: thread.updatedAt,
							})),
							total: result.total,
							hasMore: result.hasMore,
							page: userPage, // Return 1-indexed page for API consumers
							perPage,
						}),
						{
							headers: { "Content-Type": "application/json" },
						},
					)
				} catch (error) {
					console.error("List threads error:", error)
					return new Response(
						JSON.stringify({
							error:
								error instanceof Error
									? error.message
									: "Failed to list threads",
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
