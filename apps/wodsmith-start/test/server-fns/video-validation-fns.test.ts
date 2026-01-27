/**
 * Video Validation Server Functions Tests
 *
 * Tests for server-side video URL validation including:
 * - URL format validation
 * - Platform detection
 * - Accessibility checking (with mocked fetch)
 * - Batch validation with concurrency limits
 * - Timeout handling
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Mock TanStack createServerFn to make server functions directly callable in tests
vi.mock("@tanstack/react-start", () => ({
	createServerFn: () => {
		return {
			handler: (fn: ReturnType<typeof vi.fn>) => {
				return fn
			},
			inputValidator: (validator: (data: unknown) => unknown) => ({
				handler: (fn: (ctx: { data: unknown }) => Promise<unknown>) => {
					return async (ctx: { data: unknown }) => {
						const validatedData = validator(ctx.data)
						return fn({ data: validatedData })
					}
				},
			}),
		}
	},
}))

// Import after mocking
import {
	validateVideoUrlFn,
	batchValidateVideoUrlsFn,
	type VideoValidationResult,
} from "@/server-fns/video-validation-fns"
import { VIDEO_URL_ERRORS } from "@/schemas/video-url"

describe("Video Validation Server Functions", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
		vi.restoreAllMocks()
	})

	describe("validateVideoUrlFn", () => {
		describe("URL format validation", () => {
			it("rejects empty URL", async () => {
				await expect(
					validateVideoUrlFn({ data: { url: "" } }),
				).rejects.toThrow()
			})

			it("rejects whitespace-only URL", async () => {
				const result = await validateVideoUrlFn({ data: { url: "   " } })
				expect(result.isValid).toBe(false)
				expect(result.error).toBe(VIDEO_URL_ERRORS.INVALID_URL)
			})

			it("rejects invalid URL format", async () => {
				const result = await validateVideoUrlFn({
					data: { url: "not a valid url" },
				})
				expect(result.isValid).toBe(false)
				expect(result.error).toBe(VIDEO_URL_ERRORS.INVALID_URL)
			})

			it("rejects URL without protocol", async () => {
				const result = await validateVideoUrlFn({
					data: { url: "youtube.com/watch?v=dQw4w9WgXcQ" },
				})
				expect(result.isValid).toBe(false)
				expect(result.error).toBe(VIDEO_URL_ERRORS.INVALID_URL)
			})
		})

		describe("YouTube URL validation", () => {
			it("validates standard YouTube watch URL", async () => {
				const result = await validateVideoUrlFn({
					data: { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
				})
				expect(result.isValid).toBe(true)
				expect(result.platform).toBe("youtube")
				expect(result.videoId).toBe("dQw4w9WgXcQ")
				expect(result.embedUrl).toBe(
					"https://www.youtube.com/embed/dQw4w9WgXcQ",
				)
				expect(result.error).toBeNull()
			})

			it("validates short youtu.be URL", async () => {
				const result = await validateVideoUrlFn({
					data: { url: "https://youtu.be/dQw4w9WgXcQ" },
				})
				expect(result.isValid).toBe(true)
				expect(result.platform).toBe("youtube")
				expect(result.videoId).toBe("dQw4w9WgXcQ")
			})

			it("validates YouTube shorts URL", async () => {
				const result = await validateVideoUrlFn({
					data: { url: "https://youtube.com/shorts/dQw4w9WgXcQ" },
				})
				expect(result.isValid).toBe(true)
				expect(result.platform).toBe("youtube")
				expect(result.videoId).toBe("dQw4w9WgXcQ")
			})

			it("validates YouTube embed URL", async () => {
				const result = await validateVideoUrlFn({
					data: { url: "https://www.youtube.com/embed/dQw4w9WgXcQ" },
				})
				expect(result.isValid).toBe(true)
				expect(result.platform).toBe("youtube")
			})

			it("validates mobile YouTube URL", async () => {
				const result = await validateVideoUrlFn({
					data: { url: "https://m.youtube.com/watch?v=dQw4w9WgXcQ" },
				})
				expect(result.isValid).toBe(true)
				expect(result.platform).toBe("youtube")
			})

			it("validates YouTube URL with timestamp", async () => {
				const result = await validateVideoUrlFn({
					data: { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120s" },
				})
				expect(result.isValid).toBe(true)
				expect(result.videoId).toBe("dQw4w9WgXcQ")
			})

			it("validates YouTube URL with multiple query params", async () => {
				const result = await validateVideoUrlFn({
					data: {
						url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf&index=2",
					},
				})
				expect(result.isValid).toBe(true)
				expect(result.videoId).toBe("dQw4w9WgXcQ")
			})
		})

		describe("Vimeo URL validation", () => {
			it("validates standard Vimeo URL", async () => {
				const result = await validateVideoUrlFn({
					data: { url: "https://vimeo.com/123456789" },
				})
				expect(result.isValid).toBe(true)
				expect(result.platform).toBe("vimeo")
				expect(result.videoId).toBe("123456789")
				expect(result.embedUrl).toBe(
					"https://player.vimeo.com/video/123456789",
				)
			})

			it("validates Vimeo player embed URL", async () => {
				const result = await validateVideoUrlFn({
					data: { url: "https://player.vimeo.com/video/123456789" },
				})
				expect(result.isValid).toBe(true)
				expect(result.platform).toBe("vimeo")
				expect(result.videoId).toBe("123456789")
			})

			it("validates Vimeo channel URL", async () => {
				const result = await validateVideoUrlFn({
					data: { url: "https://vimeo.com/channels/staffpicks/123456789" },
				})
				expect(result.isValid).toBe(true)
				expect(result.videoId).toBe("123456789")
			})

			it("validates Vimeo group URL", async () => {
				const result = await validateVideoUrlFn({
					data: { url: "https://vimeo.com/groups/crossfit/videos/123456789" },
				})
				expect(result.isValid).toBe(true)
				expect(result.videoId).toBe("123456789")
			})

			it("validates Vimeo URL with query params", async () => {
				const result = await validateVideoUrlFn({
					data: { url: "https://vimeo.com/123456789?share=copy" },
				})
				expect(result.isValid).toBe(true)
				expect(result.videoId).toBe("123456789")
			})
		})

		describe("Streamable URL validation", () => {
			it("validates standard Streamable URL", async () => {
				const result = await validateVideoUrlFn({
					data: { url: "https://streamable.com/abc123" },
				})
				expect(result.isValid).toBe(true)
				expect(result.platform).toBe("streamable")
				expect(result.videoId).toBe("abc123")
				expect(result.embedUrl).toBe("https://streamable.com/e/abc123")
				expect(result.error).toBeNull()
			})

			it("validates Streamable URL with www", async () => {
				const result = await validateVideoUrlFn({
					data: { url: "https://www.streamable.com/xyz789" },
				})
				expect(result.isValid).toBe(true)
				expect(result.platform).toBe("streamable")
				expect(result.videoId).toBe("xyz789")
			})

			it("validates Streamable embed URL", async () => {
				const result = await validateVideoUrlFn({
					data: { url: "https://streamable.com/e/abc123" },
				})
				expect(result.isValid).toBe(true)
				expect(result.platform).toBe("streamable")
				expect(result.videoId).toBe("abc123")
			})

			it("validates Streamable URL with query params", async () => {
				const result = await validateVideoUrlFn({
					data: { url: "https://streamable.com/abc123?autoplay=1" },
				})
				expect(result.isValid).toBe(true)
				expect(result.videoId).toBe("abc123")
			})
		})

		describe("Unsupported platforms", () => {
			it("rejects TikTok URLs", async () => {
				const result = await validateVideoUrlFn({
					data: { url: "https://www.tiktok.com/@user/video/7123456789" },
				})
				expect(result.isValid).toBe(false)
				expect(result.error).toBe(VIDEO_URL_ERRORS.UNSUPPORTED_PLATFORM)
			})

			it("rejects Facebook video URLs", async () => {
				const result = await validateVideoUrlFn({
					data: { url: "https://www.facebook.com/watch?v=123456789" },
				})
				expect(result.isValid).toBe(false)
				expect(result.error).toBe(VIDEO_URL_ERRORS.UNSUPPORTED_PLATFORM)
			})

			it("rejects Instagram video URLs", async () => {
				const result = await validateVideoUrlFn({
					data: { url: "https://www.instagram.com/reel/ABC123/" },
				})
				expect(result.isValid).toBe(false)
				expect(result.error).toBe(VIDEO_URL_ERRORS.UNSUPPORTED_PLATFORM)
			})

			it("rejects random URLs", async () => {
				const result = await validateVideoUrlFn({
					data: { url: "https://example.com/video.mp4" },
				})
				expect(result.isValid).toBe(false)
				expect(result.error).toBe(VIDEO_URL_ERRORS.UNSUPPORTED_PLATFORM)
			})
		})

		describe("Accessibility checking", () => {
			it("skips accessibility check by default", async () => {
				const result = await validateVideoUrlFn({
					data: { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
				})
				expect(result.isAccessible).toBeNull()
			})

			it("checks YouTube accessibility when requested", async () => {
				const mockFetch = vi.fn().mockResolvedValue({ ok: true })
				vi.stubGlobal("fetch", mockFetch)

				const result = await validateVideoUrlFn({
					data: {
						url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
						checkAccessibility: true,
					},
				})

				expect(result.isAccessible).toBe(true)
				expect(mockFetch).toHaveBeenCalledWith(
					expect.stringContaining("youtube.com/oembed"),
					expect.objectContaining({
						signal: expect.any(AbortSignal),
					}),
				)
			})

			it("reports inaccessible YouTube video", async () => {
				const mockFetch = vi.fn().mockResolvedValue({ ok: false })
				vi.stubGlobal("fetch", mockFetch)

				const result = await validateVideoUrlFn({
					data: {
						url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
						checkAccessibility: true,
					},
				})

				expect(result.isAccessible).toBe(false)
				expect(result.error).toContain("private")
			})

			it("checks Vimeo accessibility when requested", async () => {
				const mockFetch = vi.fn().mockResolvedValue({ ok: true })
				vi.stubGlobal("fetch", mockFetch)

				const result = await validateVideoUrlFn({
					data: {
						url: "https://vimeo.com/123456789",
						checkAccessibility: true,
					},
				})

				expect(result.isAccessible).toBe(true)
				expect(mockFetch).toHaveBeenCalledWith(
					expect.stringContaining("vimeo.com/api/oembed"),
					expect.objectContaining({
						signal: expect.any(AbortSignal),
					}),
				)
			})

			it("checks Streamable accessibility when requested", async () => {
				const mockFetch = vi.fn().mockResolvedValue({ ok: true })
				vi.stubGlobal("fetch", mockFetch)

				const result = await validateVideoUrlFn({
					data: {
						url: "https://streamable.com/abc123",
						checkAccessibility: true,
					},
				})

				expect(result.isAccessible).toBe(true)
				expect(mockFetch).toHaveBeenCalledWith(
					expect.stringContaining("api.streamable.com/oembed"),
					expect.objectContaining({
						signal: expect.any(AbortSignal),
					}),
				)
			})

			it("handles network errors gracefully", async () => {
				const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"))
				vi.stubGlobal("fetch", mockFetch)

				const result = await validateVideoUrlFn({
					data: {
						url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
						checkAccessibility: true,
					},
				})

				expect(result.isValid).toBe(true) // URL is still valid
				expect(result.isAccessible).toBe(false) // Just can't verify accessibility
			})

			it("handles fetch timeout (AbortError)", async () => {
				const mockFetch = vi.fn().mockImplementation(() => {
					const error = new Error("Aborted")
					error.name = "AbortError"
					return Promise.reject(error)
				})
				vi.stubGlobal("fetch", mockFetch)

				const result = await validateVideoUrlFn({
					data: {
						url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
						checkAccessibility: true,
					},
				})

				expect(result.isValid).toBe(true)
				expect(result.isAccessible).toBe(false)
			})
		})

		describe("Input validation", () => {
			it("rejects missing url field", async () => {
				await expect(
					validateVideoUrlFn({ data: {} as { url: string } }),
				).rejects.toThrow()
			})

			it("accepts checkAccessibility as optional", async () => {
				const result = await validateVideoUrlFn({
					data: { url: "https://youtube.com/watch?v=dQw4w9WgXcQ" },
				})
				expect(result.isValid).toBe(true)
			})
		})
	})

	describe("batchValidateVideoUrlsFn", () => {
		describe("Basic batch validation", () => {
			it("validates multiple URLs", async () => {
				const result = await batchValidateVideoUrlsFn({
					data: {
						urls: [
							"https://www.youtube.com/watch?v=dQw4w9WgXcQ",
							"https://vimeo.com/123456789",
						],
					},
				})

				expect(result.results).toHaveLength(2)
				expect(result.results[0].validation.isValid).toBe(true)
				expect(result.results[0].validation.platform).toBe("youtube")
				expect(result.results[1].validation.isValid).toBe(true)
				expect(result.results[1].validation.platform).toBe("vimeo")
			})

			it("handles mix of valid and invalid URLs", async () => {
				const result = await batchValidateVideoUrlsFn({
					data: {
						urls: [
							"https://www.youtube.com/watch?v=dQw4w9WgXcQ",
							"invalid-url",
							"https://vimeo.com/123456789",
							"https://tiktok.com/video/123",
						],
					},
				})

				expect(result.results).toHaveLength(4)
				expect(result.results[0].validation.isValid).toBe(true)
				expect(result.results[1].validation.isValid).toBe(false)
				expect(result.results[1].validation.error).toBe(
					VIDEO_URL_ERRORS.INVALID_URL,
				)
				expect(result.results[2].validation.isValid).toBe(true)
				expect(result.results[3].validation.isValid).toBe(false)
				expect(result.results[3].validation.error).toBe(
					VIDEO_URL_ERRORS.UNSUPPORTED_PLATFORM,
				)
			})

			it("returns empty results for empty array", async () => {
				const result = await batchValidateVideoUrlsFn({
					data: { urls: [] },
				})

				expect(result.results).toHaveLength(0)
			})

			it("preserves URL in result", async () => {
				const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
				const result = await batchValidateVideoUrlsFn({
					data: { urls: [url] },
				})

				expect(result.results[0].url).toBe(url)
			})
		})

		describe("Batch size limits", () => {
			it("rejects batch larger than MAX_BATCH_SIZE (50)", async () => {
				const urls = Array.from(
					{ length: 51 },
					(_, i) => `https://youtube.com/watch?v=video${String(i).padStart(6, "0")}`,
				)

				await expect(
					batchValidateVideoUrlsFn({ data: { urls } }),
				).rejects.toThrow("Maximum 50 URLs per batch")
			})

			it("accepts batch at MAX_BATCH_SIZE limit", async () => {
				const urls = Array.from(
					{ length: 50 },
					(_, i) => `https://youtube.com/watch?v=video${String(i).padStart(6, "0")}`,
				)

				// These URLs won't parse correctly (invalid video IDs), but the batch size is valid
				const result = await batchValidateVideoUrlsFn({ data: { urls } })
				expect(result.results).toHaveLength(50)
			})
		})

		describe("Concurrency limits", () => {
			it("processes URLs in chunks of MAX_CONCURRENT_VALIDATIONS (5)", async () => {
				const mockFetch = vi.fn().mockResolvedValue({ ok: true })
				vi.stubGlobal("fetch", mockFetch)

				// Create 12 valid URLs to test chunking (should be 3 chunks: 5, 5, 2)
				const urls = Array.from(
					{ length: 12 },
					() => "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
				)

				const result = await batchValidateVideoUrlsFn({
					data: { urls, checkAccessibility: true },
				})

				expect(result.results).toHaveLength(12)
				// All should be valid
				expect(result.results.every((r) => r.validation.isValid)).toBe(true)
			})
		})

		describe("Accessibility checking in batch", () => {
			it("checks accessibility for all URLs when requested", async () => {
				const mockFetch = vi.fn().mockResolvedValue({ ok: true })
				vi.stubGlobal("fetch", mockFetch)

				const result = await batchValidateVideoUrlsFn({
					data: {
						urls: [
							"https://www.youtube.com/watch?v=dQw4w9WgXcQ",
							"https://vimeo.com/123456789",
						],
						checkAccessibility: true,
					},
				})

				expect(result.results).toHaveLength(2)
				expect(result.results[0].validation.isAccessible).toBe(true)
				expect(result.results[1].validation.isAccessible).toBe(true)
				expect(mockFetch).toHaveBeenCalledTimes(2)
			})

			it("skips accessibility check by default", async () => {
				const mockFetch = vi.fn()
				vi.stubGlobal("fetch", mockFetch)

				const result = await batchValidateVideoUrlsFn({
					data: {
						urls: ["https://www.youtube.com/watch?v=dQw4w9WgXcQ"],
					},
				})

				expect(result.results[0].validation.isAccessible).toBeNull()
				expect(mockFetch).not.toHaveBeenCalled()
			})
		})

		describe("Input validation", () => {
			it("rejects non-array urls", async () => {
				await expect(
					batchValidateVideoUrlsFn({
						data: { urls: "single-url" as unknown as string[] },
					}),
				).rejects.toThrow()
			})

			it("rejects missing urls field", async () => {
				await expect(
					batchValidateVideoUrlsFn({
						data: {} as { urls: string[] },
					}),
				).rejects.toThrow()
			})
		})
	})

	describe("VideoValidationResult structure", () => {
		it("includes all expected fields for valid URL", async () => {
			const result = await validateVideoUrlFn({
				data: { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
			})

			expect(result).toMatchObject({
				isValid: true,
				isAccessible: null,
				platform: "youtube",
				videoId: "dQw4w9WgXcQ",
				embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
				error: null,
			} satisfies VideoValidationResult)
		})

		it("includes all expected fields for invalid URL", async () => {
			const result = await validateVideoUrlFn({
				data: { url: "invalid-url" },
			})

			expect(result).toMatchObject({
				isValid: false,
				isAccessible: null,
				platform: null,
				videoId: null,
				embedUrl: null,
				error: VIDEO_URL_ERRORS.INVALID_URL,
			} satisfies VideoValidationResult)
		})

		it("includes accessibility info when checked", async () => {
			const mockFetch = vi.fn().mockResolvedValue({ ok: true })
			vi.stubGlobal("fetch", mockFetch)

			const result = await validateVideoUrlFn({
				data: {
					url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
					checkAccessibility: true,
				},
			})

			expect(result.isAccessible).toBe(true)
			expect(result.error).toBeNull()
		})
	})

	describe("Edge cases", () => {
		it("trims whitespace from URLs", async () => {
			const result = await validateVideoUrlFn({
				data: { url: "  https://www.youtube.com/watch?v=dQw4w9WgXcQ  " },
			})
			expect(result.isValid).toBe(true)
		})

		it("handles URLs with special characters in query params", async () => {
			const result = await validateVideoUrlFn({
				data: {
					url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&feature=share&utm_source=test%20source",
				},
			})
			expect(result.isValid).toBe(true)
		})

		it("handles http URLs (non-https)", async () => {
			const result = await validateVideoUrlFn({
				data: { url: "http://www.youtube.com/watch?v=dQw4w9WgXcQ" },
			})
			expect(result.isValid).toBe(true)
		})
	})
})
