/**
 * Video Validation Server Functions
 *
 * Server-side validation for video URLs including accessibility checks.
 * These functions can verify that a video exists and is publicly accessible.
 */

import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import {
	parseVideoUrl,
	VIDEO_URL_ERRORS,
	type ParsedVideoUrl,
	type VideoPlatform,
} from "@/schemas/video-url"

// ============================================================================
// Types
// ============================================================================

export interface VideoValidationResult {
	isValid: boolean
	isAccessible: boolean | null // null if check was skipped
	platform: VideoPlatform | null
	videoId: string | null
	embedUrl: string | null
	error: string | null
}

// ============================================================================
// Input Schemas
// ============================================================================

const validateVideoUrlInputSchema = z.object({
	url: z.string().min(1, VIDEO_URL_ERRORS.EMPTY_URL),
	/** Whether to check if the video is publicly accessible (makes HTTP request) */
	checkAccessibility: z.boolean().default(false),
})

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a YouTube video is accessible by fetching oEmbed data
 * This is a lightweight check that doesn't require API keys
 */
async function checkYouTubeAccessibility(videoId: string): Promise<boolean> {
	try {
		const oEmbedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
		const response = await fetch(oEmbedUrl, {
			method: "GET",
			headers: {
				Accept: "application/json",
			},
		})

		// 200 = video exists and is public
		// 401/403 = video is private or restricted
		// 404 = video doesn't exist
		return response.ok
	} catch {
		// Network error or other issue - assume inaccessible
		return false
	}
}

/**
 * Check if a Vimeo video is accessible by fetching oEmbed data
 * This is a lightweight check that doesn't require API keys
 */
async function checkVimeoAccessibility(videoId: string): Promise<boolean> {
	try {
		const oEmbedUrl = `https://vimeo.com/api/oembed.json?url=https://vimeo.com/${videoId}`
		const response = await fetch(oEmbedUrl, {
			method: "GET",
			headers: {
				Accept: "application/json",
			},
		})

		// 200 = video exists and is public
		// 403 = video is private
		// 404 = video doesn't exist
		return response.ok
	} catch {
		// Network error or other issue - assume inaccessible
		return false
	}
}

/**
 * Check video accessibility based on platform
 */
async function checkVideoAccessibility(
	parsed: ParsedVideoUrl,
): Promise<boolean> {
	switch (parsed.platform) {
		case "youtube":
			return checkYouTubeAccessibility(parsed.videoId)
		case "vimeo":
			return checkVimeoAccessibility(parsed.videoId)
		default:
			return false
	}
}

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Validate a video URL server-side
 *
 * Performs:
 * 1. URL format validation
 * 2. Platform detection (YouTube/Vimeo)
 * 3. Video ID extraction
 * 4. Optional: Accessibility check via oEmbed API
 *
 * Usage:
 * ```typescript
 * const result = await validateVideoUrlFn({
 *   data: {
 *     url: "https://youtube.com/watch?v=dQw4w9WgXcQ",
 *     checkAccessibility: true
 *   }
 * })
 * ```
 */
export const validateVideoUrlFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => validateVideoUrlInputSchema.parse(data))
	.handler(async ({ data }): Promise<VideoValidationResult> => {
		const trimmedUrl = data.url.trim()

		// Validate URL format
		try {
			new URL(trimmedUrl)
		} catch {
			return {
				isValid: false,
				isAccessible: null,
				platform: null,
				videoId: null,
				embedUrl: null,
				error: VIDEO_URL_ERRORS.INVALID_URL,
			}
		}

		// Parse video URL to extract platform and ID
		const parsed = parseVideoUrl(trimmedUrl)
		if (!parsed) {
			return {
				isValid: false,
				isAccessible: null,
				platform: null,
				videoId: null,
				embedUrl: null,
				error: VIDEO_URL_ERRORS.UNSUPPORTED_PLATFORM,
			}
		}

		// URL is valid and from supported platform
		const result: VideoValidationResult = {
			isValid: true,
			isAccessible: null,
			platform: parsed.platform,
			videoId: parsed.videoId,
			embedUrl: parsed.embedUrl,
			error: null,
		}

		// Optionally check if video is accessible
		if (data.checkAccessibility) {
			const isAccessible = await checkVideoAccessibility(parsed)
			result.isAccessible = isAccessible

			if (!isAccessible) {
				result.error =
					"Video may be private, deleted, or restricted. Please ensure the video is publicly accessible."
			}
		}

		return result
	})

/**
 * Batch validate multiple video URLs
 *
 * Useful for validating multiple submissions at once.
 */
export const batchValidateVideoUrlsFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		z
			.object({
				urls: z.array(z.string()),
				checkAccessibility: z.boolean().default(false),
			})
			.parse(data),
	)
	.handler(
		async ({
			data,
		}): Promise<{
			results: Array<{ url: string; validation: VideoValidationResult }>
		}> => {
			const results = await Promise.all(
				data.urls.map(async (url) => {
					const validation = await validateVideoUrlFn({
						data: {
							url,
							checkAccessibility: data.checkAccessibility,
						},
					})
					return { url, validation }
				}),
			)

			return { results }
		},
	)
