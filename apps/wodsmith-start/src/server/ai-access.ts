/**
 * AI Access Control
 *
 * Centralized access control for AI features.
 * Checks entitlements and usage limits for AI endpoints.
 */

import { hasFeature } from "@/server/entitlements"
import { FEATURES } from "@/config/features"

export interface AiAccessResult {
	allowed: true
}

export interface AiAccessDenied {
	allowed: false
	error: string
	status: 403
}

export type AiAccessCheck = AiAccessResult | AiAccessDenied

/**
 * Check if a team has access to AI features.
 *
 * @param teamId - The team ID to check
 * @returns Access result with error details if denied
 *
 * @example
 * ```ts
 * const access = await ensureAiAccess(teamId)
 * if (!access.allowed) {
 *   return new Response(JSON.stringify({ error: access.error }), {
 *     status: access.status,
 *     headers: { "Content-Type": "application/json" },
 *   })
 * }
 * // Proceed with AI operation
 * ```
 */
export async function ensureAiAccess(teamId: string): Promise<AiAccessCheck> {
	const hasAIAccess = await hasFeature(
		teamId,
		FEATURES.AI_PROGRAMMING_ASSISTANT,
	)

	if (!hasAIAccess) {
		return {
			allowed: false,
			error: "AI assistant is not available on your current plan",
			status: 403,
		}
	}

	return { allowed: true }
}

/**
 * Create a 403 response for AI access denial.
 * Helper for consistent error responses across AI endpoints.
 */
export function createAiAccessDeniedResponse(result: AiAccessDenied): Response {
	return new Response(JSON.stringify({ error: result.error }), {
		status: result.status,
		headers: { "Content-Type": "application/json" },
	})
}
