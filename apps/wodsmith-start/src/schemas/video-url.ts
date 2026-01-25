/**
 * Video URL Validation Schema
 *
 * Validates video URLs for online competition submissions.
 * Supports YouTube and Vimeo URL formats with video ID extraction.
 */

import { z } from "zod"

/**
 * Supported video platforms
 */
export const VIDEO_PLATFORMS = ["youtube", "vimeo"] as const
export type VideoPlatform = (typeof VIDEO_PLATFORMS)[number]

/**
 * Result of parsing a video URL
 */
export interface ParsedVideoUrl {
	platform: VideoPlatform
	videoId: string
	originalUrl: string
	embedUrl: string
	thumbnailUrl: string
}

/**
 * YouTube URL patterns:
 * - youtube.com/watch?v=VIDEO_ID
 * - youtube.com/watch?v=VIDEO_ID&t=123s (with timestamp)
 * - youtu.be/VIDEO_ID
 * - youtu.be/VIDEO_ID?t=123 (with timestamp)
 * - youtube.com/embed/VIDEO_ID
 * - youtube.com/v/VIDEO_ID
 * - youtube.com/shorts/VIDEO_ID
 * - m.youtube.com/watch?v=VIDEO_ID (mobile)
 * - www.youtube.com/watch?v=VIDEO_ID
 */
const YOUTUBE_PATTERNS = [
	// Standard watch URL
	/^(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/watch\?(?:.*&)?v=([a-zA-Z0-9_-]{11})(?:&.*)?$/,
	// Short URL
	/^(?:https?:\/\/)?youtu\.be\/([a-zA-Z0-9_-]{11})(?:\?.*)?$/,
	// Embed URL
	/^(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})(?:\?.*)?$/,
	// Old-style /v/ URL
	/^(?:https?:\/\/)?(?:www\.)?youtube\.com\/v\/([a-zA-Z0-9_-]{11})(?:\?.*)?$/,
	// Shorts URL
	/^(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})(?:\?.*)?$/,
] as const

/**
 * Vimeo URL patterns:
 * - vimeo.com/VIDEO_ID
 * - vimeo.com/VIDEO_ID?share=copy (with params)
 * - player.vimeo.com/video/VIDEO_ID
 * - www.vimeo.com/VIDEO_ID
 * - vimeo.com/channels/CHANNEL/VIDEO_ID
 * - vimeo.com/groups/GROUP/videos/VIDEO_ID
 */
const VIMEO_PATTERNS = [
	// Standard URL
	/^(?:https?:\/\/)?(?:www\.)?vimeo\.com\/(\d+)(?:\?.*)?$/,
	// Player embed URL
	/^(?:https?:\/\/)?player\.vimeo\.com\/video\/(\d+)(?:\?.*)?$/,
	// Channel video URL
	/^(?:https?:\/\/)?(?:www\.)?vimeo\.com\/channels\/[^/]+\/(\d+)(?:\?.*)?$/,
	// Group video URL
	/^(?:https?:\/\/)?(?:www\.)?vimeo\.com\/groups\/[^/]+\/videos\/(\d+)(?:\?.*)?$/,
] as const

/**
 * Extract video ID from YouTube URL
 */
function extractYouTubeId(url: string): string | null {
	for (const pattern of YOUTUBE_PATTERNS) {
		const match = url.match(pattern)
		if (match?.[1]) {
			return match[1]
		}
	}
	return null
}

/**
 * Extract video ID from Vimeo URL
 */
function extractVimeoId(url: string): string | null {
	for (const pattern of VIMEO_PATTERNS) {
		const match = url.match(pattern)
		if (match?.[1]) {
			return match[1]
		}
	}
	return null
}

/**
 * Parse a video URL and extract platform and video ID
 * Returns null if URL is not from a supported platform
 */
export function parseVideoUrl(url: string): ParsedVideoUrl | null {
	const trimmedUrl = url.trim()

	// Try YouTube first
	const youtubeId = extractYouTubeId(trimmedUrl)
	if (youtubeId) {
		return {
			platform: "youtube",
			videoId: youtubeId,
			originalUrl: trimmedUrl,
			embedUrl: `https://www.youtube.com/embed/${youtubeId}`,
			thumbnailUrl: `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`,
		}
	}

	// Try Vimeo
	const vimeoId = extractVimeoId(trimmedUrl)
	if (vimeoId) {
		return {
			platform: "vimeo",
			videoId: vimeoId,
			originalUrl: trimmedUrl,
			embedUrl: `https://player.vimeo.com/video/${vimeoId}`,
			// Vimeo thumbnails require API access, use placeholder
			thumbnailUrl: `https://vumbnail.com/${vimeoId}.jpg`,
		}
	}

	return null
}

/**
 * Check if a URL is from a supported video platform
 */
export function isSupportedVideoUrl(url: string): boolean {
	return parseVideoUrl(url) !== null
}

/**
 * Get a human-readable list of supported platforms
 */
export function getSupportedPlatformsText(): string {
	return "YouTube or Vimeo"
}

/**
 * Error messages for video URL validation
 */
export const VIDEO_URL_ERRORS = {
	INVALID_URL: "Please enter a valid URL",
	UNSUPPORTED_PLATFORM: `Please use a video from ${getSupportedPlatformsText()}`,
	EMPTY_URL: "Video URL is required",
	EXTRACT_FAILED:
		"Could not extract video ID from URL. Please check the URL format.",
} as const

/**
 * Zod schema for validating video URLs
 *
 * Usage:
 * ```typescript
 * const result = videoUrlSchema.safeParse(url)
 * if (result.success) {
 *   console.log(result.data) // ParsedVideoUrl
 * }
 * ```
 */
export const videoUrlSchema = z
	.string()
	.min(1, VIDEO_URL_ERRORS.EMPTY_URL)
	.url(VIDEO_URL_ERRORS.INVALID_URL)
	.transform((url, ctx) => {
		const parsed = parseVideoUrl(url)
		if (!parsed) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: VIDEO_URL_ERRORS.UNSUPPORTED_PLATFORM,
			})
			return z.NEVER
		}
		return parsed
	})

/**
 * Zod schema for optional video URL
 * Returns ParsedVideoUrl if valid, undefined if empty
 */
export const optionalVideoUrlSchema = z
	.string()
	.optional()
	.nullable()
	.transform((url, ctx) => {
		// Allow empty/null values
		if (!url || url.trim() === "") {
			return undefined
		}

		// Validate URL format
		try {
			new URL(url)
		} catch {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: VIDEO_URL_ERRORS.INVALID_URL,
			})
			return z.NEVER
		}

		// Parse and validate platform
		const parsed = parseVideoUrl(url)
		if (!parsed) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: VIDEO_URL_ERRORS.UNSUPPORTED_PLATFORM,
			})
			return z.NEVER
		}

		return parsed
	})

/**
 * Simple string schema for video URL validation (returns string, not parsed object)
 * Use this when you just need to validate the URL but store the original string
 */
export const videoUrlStringSchema = z
	.string()
	.min(1, VIDEO_URL_ERRORS.EMPTY_URL)
	.url(VIDEO_URL_ERRORS.INVALID_URL)
	.refine((url) => isSupportedVideoUrl(url), {
		message: VIDEO_URL_ERRORS.UNSUPPORTED_PLATFORM,
	})

/**
 * Optional string schema for video URL validation
 * Returns the original string if valid, undefined if empty
 */
export const optionalVideoUrlStringSchema = z
	.string()
	.optional()
	.nullable()
	.transform((url, ctx) => {
		// Allow empty/null values
		if (!url || url.trim() === "") {
			return undefined
		}

		// Validate URL format
		try {
			new URL(url)
		} catch {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: VIDEO_URL_ERRORS.INVALID_URL,
			})
			return z.NEVER
		}

		// Validate it's from a supported platform
		if (!isSupportedVideoUrl(url)) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: VIDEO_URL_ERRORS.UNSUPPORTED_PLATFORM,
			})
			return z.NEVER
		}

		return url
	})

// Type exports
export type VideoUrlInput = z.input<typeof videoUrlSchema>
export type VideoUrlOutput = z.output<typeof videoUrlSchema>
export type OptionalVideoUrlOutput = z.output<typeof optionalVideoUrlSchema>
