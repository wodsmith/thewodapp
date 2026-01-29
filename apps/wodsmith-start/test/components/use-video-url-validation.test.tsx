/**
 * useVideoUrlValidation Hook Tests
 *
 * Tests for the client-side video URL validation hook.
 * Tests cover:
 * - URL validation with various formats
 * - Required vs optional field behavior
 * - State transitions and pending states
 * - Error handling
 */

import { renderHook, waitFor } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { useVideoUrlValidation } from "@/components/ui/video-url-input"
import { VIDEO_URL_ERRORS } from "@/schemas/video-url"

describe("useVideoUrlValidation", () => {
	describe("Empty URL handling", () => {
		it("returns valid state for empty URL when not required", async () => {
			const { result } = renderHook(() => useVideoUrlValidation("", false))

			await waitFor(() => {
				expect(result.current.isPending).toBe(false)
			})

			expect(result.current.isValid).toBe(true)
			expect(result.current.error).toBeNull()
			expect(result.current.parsedUrl).toBeNull()
		})

		it("returns invalid state for empty URL when required", async () => {
			const { result } = renderHook(() => useVideoUrlValidation("", true))

			await waitFor(() => {
				expect(result.current.isPending).toBe(false)
			})

			expect(result.current.isValid).toBe(false)
			expect(result.current.error).toBe(VIDEO_URL_ERRORS.EMPTY_URL)
			expect(result.current.parsedUrl).toBeNull()
		})

		it("returns valid state for whitespace-only URL when not required", async () => {
			const { result } = renderHook(() => useVideoUrlValidation("   ", false))

			await waitFor(() => {
				expect(result.current.isPending).toBe(false)
			})

			expect(result.current.isValid).toBe(true)
			expect(result.current.error).toBeNull()
		})

		it("returns invalid state for whitespace-only URL when required", async () => {
			const { result } = renderHook(() => useVideoUrlValidation("   ", true))

			await waitFor(() => {
				expect(result.current.isPending).toBe(false)
			})

			expect(result.current.isValid).toBe(false)
			expect(result.current.error).toBe(VIDEO_URL_ERRORS.EMPTY_URL)
		})
	})

	describe("Invalid URL format handling", () => {
		it("returns error for malformed URL", async () => {
			const { result } = renderHook(() =>
				useVideoUrlValidation("not a valid url"),
			)

			await waitFor(() => {
				expect(result.current.isPending).toBe(false)
			})

			expect(result.current.isValid).toBe(false)
			expect(result.current.error).toBe(VIDEO_URL_ERRORS.INVALID_URL)
			expect(result.current.parsedUrl).toBeNull()
		})

		it("returns error for URL without protocol", async () => {
			const { result } = renderHook(() =>
				useVideoUrlValidation("youtube.com/watch?v=dQw4w9WgXcQ"),
			)

			await waitFor(() => {
				expect(result.current.isPending).toBe(false)
			})

			expect(result.current.isValid).toBe(false)
			expect(result.current.error).toBe(VIDEO_URL_ERRORS.INVALID_URL)
		})
	})

	describe("YouTube URL validation", () => {
		it("validates standard YouTube watch URL", async () => {
			const { result } = renderHook(() =>
				useVideoUrlValidation("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
			)

			await waitFor(() => {
				expect(result.current.isPending).toBe(false)
			})

			expect(result.current.isValid).toBe(true)
			expect(result.current.error).toBeNull()
			expect(result.current.parsedUrl).not.toBeNull()
			expect(result.current.parsedUrl?.platform).toBe("youtube")
			expect(result.current.parsedUrl?.videoId).toBe("dQw4w9WgXcQ")
		})

		it("validates short youtu.be URL", async () => {
			const { result } = renderHook(() =>
				useVideoUrlValidation("https://youtu.be/dQw4w9WgXcQ"),
			)

			await waitFor(() => {
				expect(result.current.isPending).toBe(false)
			})

			expect(result.current.isValid).toBe(true)
			expect(result.current.parsedUrl?.platform).toBe("youtube")
			expect(result.current.parsedUrl?.videoId).toBe("dQw4w9WgXcQ")
		})

		it("validates YouTube shorts URL", async () => {
			const { result } = renderHook(() =>
				useVideoUrlValidation("https://youtube.com/shorts/dQw4w9WgXcQ"),
			)

			await waitFor(() => {
				expect(result.current.isPending).toBe(false)
			})

			expect(result.current.isValid).toBe(true)
			expect(result.current.parsedUrl?.platform).toBe("youtube")
		})

		it("validates YouTube embed URL", async () => {
			const { result } = renderHook(() =>
				useVideoUrlValidation("https://www.youtube.com/embed/dQw4w9WgXcQ"),
			)

			await waitFor(() => {
				expect(result.current.isPending).toBe(false)
			})

			expect(result.current.isValid).toBe(true)
			expect(result.current.parsedUrl?.platform).toBe("youtube")
		})

		it("validates mobile YouTube URL", async () => {
			const { result } = renderHook(() =>
				useVideoUrlValidation("https://m.youtube.com/watch?v=dQw4w9WgXcQ"),
			)

			await waitFor(() => {
				expect(result.current.isPending).toBe(false)
			})

			expect(result.current.isValid).toBe(true)
			expect(result.current.parsedUrl?.videoId).toBe("dQw4w9WgXcQ")
		})

		it("validates YouTube URL with timestamp", async () => {
			const { result } = renderHook(() =>
				useVideoUrlValidation(
					"https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120s",
				),
			)

			await waitFor(() => {
				expect(result.current.isPending).toBe(false)
			})

			expect(result.current.isValid).toBe(true)
			expect(result.current.parsedUrl?.videoId).toBe("dQw4w9WgXcQ")
		})
	})

	describe("Vimeo URL validation", () => {
		it("validates standard Vimeo URL", async () => {
			const { result } = renderHook(() =>
				useVideoUrlValidation("https://vimeo.com/123456789"),
			)

			await waitFor(() => {
				expect(result.current.isPending).toBe(false)
			})

			expect(result.current.isValid).toBe(true)
			expect(result.current.error).toBeNull()
			expect(result.current.parsedUrl).not.toBeNull()
			expect(result.current.parsedUrl?.platform).toBe("vimeo")
			expect(result.current.parsedUrl?.videoId).toBe("123456789")
		})

		it("validates Vimeo player embed URL", async () => {
			const { result } = renderHook(() =>
				useVideoUrlValidation("https://player.vimeo.com/video/123456789"),
			)

			await waitFor(() => {
				expect(result.current.isPending).toBe(false)
			})

			expect(result.current.isValid).toBe(true)
			expect(result.current.parsedUrl?.platform).toBe("vimeo")
		})

		it("validates Vimeo channel URL", async () => {
			const { result } = renderHook(() =>
				useVideoUrlValidation(
					"https://vimeo.com/channels/staffpicks/123456789",
				),
			)

			await waitFor(() => {
				expect(result.current.isPending).toBe(false)
			})

			expect(result.current.isValid).toBe(true)
			expect(result.current.parsedUrl?.videoId).toBe("123456789")
		})

		it("validates Vimeo URL with query params", async () => {
			const { result } = renderHook(() =>
				useVideoUrlValidation("https://vimeo.com/123456789?share=copy"),
			)

			await waitFor(() => {
				expect(result.current.isPending).toBe(false)
			})

			expect(result.current.isValid).toBe(true)
			expect(result.current.parsedUrl?.videoId).toBe("123456789")
		})
	})

	describe("Streamable URL validation", () => {
		it("validates standard Streamable URL", async () => {
			const { result } = renderHook(() =>
				useVideoUrlValidation("https://streamable.com/abc123"),
			)

			await waitFor(() => {
				expect(result.current.isPending).toBe(false)
			})

			expect(result.current.isValid).toBe(true)
			expect(result.current.error).toBeNull()
			expect(result.current.parsedUrl).not.toBeNull()
			expect(result.current.parsedUrl?.platform).toBe("streamable")
			expect(result.current.parsedUrl?.videoId).toBe("abc123")
		})

		it("validates Streamable URL with www", async () => {
			const { result } = renderHook(() =>
				useVideoUrlValidation("https://www.streamable.com/xyz789"),
			)

			await waitFor(() => {
				expect(result.current.isPending).toBe(false)
			})

			expect(result.current.isValid).toBe(true)
			expect(result.current.parsedUrl?.platform).toBe("streamable")
			expect(result.current.parsedUrl?.videoId).toBe("xyz789")
		})

		it("validates Streamable embed URL", async () => {
			const { result } = renderHook(() =>
				useVideoUrlValidation("https://streamable.com/e/abc123"),
			)

			await waitFor(() => {
				expect(result.current.isPending).toBe(false)
			})

			expect(result.current.isValid).toBe(true)
			expect(result.current.parsedUrl?.platform).toBe("streamable")
		})

		it("validates Streamable URL with query params", async () => {
			const { result } = renderHook(() =>
				useVideoUrlValidation("https://streamable.com/abc123?autoplay=1"),
			)

			await waitFor(() => {
				expect(result.current.isPending).toBe(false)
			})

			expect(result.current.isValid).toBe(true)
			expect(result.current.parsedUrl?.videoId).toBe("abc123")
		})
	})

	describe("Unsupported platforms", () => {
		it("returns error for TikTok URLs", async () => {
			const { result } = renderHook(() =>
				useVideoUrlValidation("https://www.tiktok.com/@user/video/7123456789"),
			)

			await waitFor(() => {
				expect(result.current.isPending).toBe(false)
			})

			expect(result.current.isValid).toBe(false)
			expect(result.current.error).toBe(VIDEO_URL_ERRORS.UNSUPPORTED_PLATFORM)
		})

		it("returns error for Facebook video URLs", async () => {
			const { result } = renderHook(() =>
				useVideoUrlValidation("https://www.facebook.com/watch?v=123456789"),
			)

			await waitFor(() => {
				expect(result.current.isPending).toBe(false)
			})

			expect(result.current.isValid).toBe(false)
			expect(result.current.error).toBe(VIDEO_URL_ERRORS.UNSUPPORTED_PLATFORM)
		})

		it("returns error for Instagram reel URLs", async () => {
			const { result } = renderHook(() =>
				useVideoUrlValidation("https://www.instagram.com/reel/ABC123/"),
			)

			await waitFor(() => {
				expect(result.current.isPending).toBe(false)
			})

			expect(result.current.isValid).toBe(false)
			expect(result.current.error).toBe(VIDEO_URL_ERRORS.UNSUPPORTED_PLATFORM)
		})

		it("returns error for random website URLs", async () => {
			const { result } = renderHook(() =>
				useVideoUrlValidation("https://example.com/video.mp4"),
			)

			await waitFor(() => {
				expect(result.current.isPending).toBe(false)
			})

			expect(result.current.isValid).toBe(false)
			expect(result.current.error).toBe(VIDEO_URL_ERRORS.UNSUPPORTED_PLATFORM)
		})
	})

	describe("URL changes", () => {
		it("updates state when URL changes", async () => {
			const { result, rerender } = renderHook(
				({ url }) => useVideoUrlValidation(url),
				{ initialProps: { url: "" } },
			)

			// Initial state for empty URL
			await waitFor(() => {
				expect(result.current.isPending).toBe(false)
			})
			expect(result.current.isValid).toBe(true)

			// Change to valid URL
			rerender({ url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" })

			await waitFor(() => {
				expect(result.current.isPending).toBe(false)
				expect(result.current.isValid).toBe(true)
			})
			expect(result.current.parsedUrl?.videoId).toBe("dQw4w9WgXcQ")

			// Change to invalid URL
			rerender({ url: "invalid-url" })

			await waitFor(() => {
				expect(result.current.isPending).toBe(false)
				expect(result.current.isValid).toBe(false)
			})
			expect(result.current.error).toBe(VIDEO_URL_ERRORS.INVALID_URL)
		})

		it("updates state when required changes", async () => {
			const { result, rerender } = renderHook(
				({ url, required }) => useVideoUrlValidation(url, required),
				{ initialProps: { url: "", required: false } },
			)

			await waitFor(() => {
				expect(result.current.isPending).toBe(false)
			})
			expect(result.current.isValid).toBe(true)

			// Change required to true
			rerender({ url: "", required: true })

			await waitFor(() => {
				expect(result.current.isPending).toBe(false)
				expect(result.current.isValid).toBe(false)
			})
			expect(result.current.error).toBe(VIDEO_URL_ERRORS.EMPTY_URL)
		})
	})

	describe("Parsed URL structure", () => {
		it("includes all expected fields for YouTube", async () => {
			const { result } = renderHook(() =>
				useVideoUrlValidation("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
			)

			await waitFor(() => {
				expect(result.current.isPending).toBe(false)
			})

			expect(result.current.parsedUrl).toMatchObject({
				platform: "youtube",
				videoId: "dQw4w9WgXcQ",
				originalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
				embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
				thumbnailUrl:
					"https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
			})
		})

		it("includes all expected fields for Vimeo", async () => {
			const { result } = renderHook(() =>
				useVideoUrlValidation("https://vimeo.com/123456789"),
			)

			await waitFor(() => {
				expect(result.current.isPending).toBe(false)
			})

			expect(result.current.parsedUrl).toMatchObject({
				platform: "vimeo",
				videoId: "123456789",
				originalUrl: "https://vimeo.com/123456789",
				embedUrl: "https://player.vimeo.com/video/123456789",
				thumbnailUrl: "https://vumbnail.com/123456789.jpg",
			})
		})

		it("includes all expected fields for Streamable", async () => {
			const { result } = renderHook(() =>
				useVideoUrlValidation("https://streamable.com/abc123"),
			)

			await waitFor(() => {
				expect(result.current.isPending).toBe(false)
			})

			expect(result.current.parsedUrl).toMatchObject({
				platform: "streamable",
				videoId: "abc123",
				originalUrl: "https://streamable.com/abc123",
				embedUrl: "https://streamable.com/e/abc123",
				thumbnailUrl: "https://cdn-cf-east.streamable.com/image/abc123.jpg",
			})
		})
	})

	describe("State structure", () => {
		it("returns correct state structure shape", async () => {
			const { result } = renderHook(() =>
				useVideoUrlValidation("https://youtube.com/watch?v=dQw4w9WgXcQ"),
			)

			await waitFor(() => {
				expect(result.current.isPending).toBe(false)
			})

			// Verify the state shape
			expect(result.current).toHaveProperty("isValid")
			expect(result.current).toHaveProperty("isPending")
			expect(result.current).toHaveProperty("error")
			expect(result.current).toHaveProperty("parsedUrl")
		})
	})

	describe("Edge cases", () => {
		it("trims whitespace from URL", async () => {
			const { result } = renderHook(() =>
				useVideoUrlValidation(
					"  https://www.youtube.com/watch?v=dQw4w9WgXcQ  ",
				),
			)

			await waitFor(() => {
				expect(result.current.isPending).toBe(false)
			})

			expect(result.current.isValid).toBe(true)
			expect(result.current.parsedUrl?.videoId).toBe("dQw4w9WgXcQ")
		})

		it("handles http URLs (non-https)", async () => {
			const { result } = renderHook(() =>
				useVideoUrlValidation("http://www.youtube.com/watch?v=dQw4w9WgXcQ"),
			)

			await waitFor(() => {
				expect(result.current.isPending).toBe(false)
			})

			expect(result.current.isValid).toBe(true)
		})

		it("handles URLs with special characters in query params", async () => {
			const { result } = renderHook(() =>
				useVideoUrlValidation(
					"https://www.youtube.com/watch?v=dQw4w9WgXcQ&feature=share&utm_source=test%20source",
				),
			)

			await waitFor(() => {
				expect(result.current.isPending).toBe(false)
			})

			expect(result.current.isValid).toBe(true)
		})
	})

	describe("Default required parameter", () => {
		it("defaults required to false", async () => {
			const { result } = renderHook(() => useVideoUrlValidation(""))

			await waitFor(() => {
				expect(result.current.isPending).toBe(false)
			})

			// Should be valid because required defaults to false
			expect(result.current.isValid).toBe(true)
			expect(result.current.error).toBeNull()
		})
	})
})
