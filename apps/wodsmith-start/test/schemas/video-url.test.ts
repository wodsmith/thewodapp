/**
 * Video URL Validation Schema Tests
 */

import { describe, expect, it } from "vitest"
import {
	parseVideoUrl,
	isSupportedVideoUrl,
	videoUrlSchema,
	optionalVideoUrlSchema,
	videoUrlStringSchema,
	optionalVideoUrlStringSchema,
	VIDEO_URL_ERRORS,
} from "@/schemas/video-url"

describe("Video URL Validation", () => {
	describe("parseVideoUrl", () => {
		describe("YouTube URLs", () => {
			it("parses standard watch URL", () => {
				const result = parseVideoUrl(
					"https://www.youtube.com/watch?v=dQw4w9WgXcQ",
				)
				expect(result).not.toBeNull()
				expect(result?.platform).toBe("youtube")
				expect(result?.videoId).toBe("dQw4w9WgXcQ")
				expect(result?.embedUrl).toBe(
					"https://www.youtube.com/embed/dQw4w9WgXcQ",
				)
			})

			it("parses watch URL with timestamp", () => {
				const result = parseVideoUrl(
					"https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=123s",
				)
				expect(result).not.toBeNull()
				expect(result?.videoId).toBe("dQw4w9WgXcQ")
			})

			it("parses short youtu.be URL", () => {
				const result = parseVideoUrl("https://youtu.be/dQw4w9WgXcQ")
				expect(result).not.toBeNull()
				expect(result?.platform).toBe("youtube")
				expect(result?.videoId).toBe("dQw4w9WgXcQ")
			})

			it("parses short URL with timestamp", () => {
				const result = parseVideoUrl("https://youtu.be/dQw4w9WgXcQ?t=123")
				expect(result).not.toBeNull()
				expect(result?.videoId).toBe("dQw4w9WgXcQ")
			})

			it("parses embed URL", () => {
				const result = parseVideoUrl(
					"https://www.youtube.com/embed/dQw4w9WgXcQ",
				)
				expect(result).not.toBeNull()
				expect(result?.platform).toBe("youtube")
				expect(result?.videoId).toBe("dQw4w9WgXcQ")
			})

			it("parses mobile URL", () => {
				const result = parseVideoUrl(
					"https://m.youtube.com/watch?v=dQw4w9WgXcQ",
				)
				expect(result).not.toBeNull()
				expect(result?.videoId).toBe("dQw4w9WgXcQ")
			})

			it("parses shorts URL", () => {
				const result = parseVideoUrl(
					"https://www.youtube.com/shorts/dQw4w9WgXcQ",
				)
				expect(result).not.toBeNull()
				expect(result?.platform).toBe("youtube")
				expect(result?.videoId).toBe("dQw4w9WgXcQ")
			})

			it("parses URL without https prefix", () => {
				const result = parseVideoUrl("youtube.com/watch?v=dQw4w9WgXcQ")
				expect(result).not.toBeNull()
				expect(result?.videoId).toBe("dQw4w9WgXcQ")
			})

			it("handles URL with extra query params", () => {
				const result = parseVideoUrl(
					"https://www.youtube.com/watch?v=dQw4w9WgXcQ&feature=share&list=PLabc",
				)
				expect(result).not.toBeNull()
				expect(result?.videoId).toBe("dQw4w9WgXcQ")
			})
		})

		describe("Vimeo URLs", () => {
			it("parses standard Vimeo URL", () => {
				const result = parseVideoUrl("https://vimeo.com/123456789")
				expect(result).not.toBeNull()
				expect(result?.platform).toBe("vimeo")
				expect(result?.videoId).toBe("123456789")
				expect(result?.embedUrl).toBe(
					"https://player.vimeo.com/video/123456789",
				)
			})

			it("parses Vimeo URL with query params", () => {
				const result = parseVideoUrl("https://vimeo.com/123456789?share=copy")
				expect(result).not.toBeNull()
				expect(result?.videoId).toBe("123456789")
			})

			it("parses player embed URL", () => {
				const result = parseVideoUrl(
					"https://player.vimeo.com/video/123456789",
				)
				expect(result).not.toBeNull()
				expect(result?.platform).toBe("vimeo")
				expect(result?.videoId).toBe("123456789")
			})

			it("parses channel video URL", () => {
				const result = parseVideoUrl(
					"https://vimeo.com/channels/staffpicks/123456789",
				)
				expect(result).not.toBeNull()
				expect(result?.videoId).toBe("123456789")
			})

			it("parses group video URL", () => {
				const result = parseVideoUrl(
					"https://vimeo.com/groups/crossfit/videos/123456789",
				)
				expect(result).not.toBeNull()
				expect(result?.videoId).toBe("123456789")
			})

			it("parses URL without www", () => {
				const result = parseVideoUrl("https://vimeo.com/123456789")
				expect(result).not.toBeNull()
				expect(result?.videoId).toBe("123456789")
			})

		it("parses unlisted URL with privacy hash", () => {
			const result = parseVideoUrl(
				"https://vimeo.com/1070507470/3ef796e429?fl=pl&fe=vl",
			)
			expect(result).not.toBeNull()
			expect(result?.platform).toBe("vimeo")
			expect(result?.videoId).toBe("1070507470")
			expect(result?.privacyHash).toBe("3ef796e429")
			expect(result?.embedUrl).toBe(
				"https://player.vimeo.com/video/1070507470?h=3ef796e429",
			)
		})

		it("parses unlisted URL without query params", () => {
			const result = parseVideoUrl("https://vimeo.com/123456789/abcdef1234")
			expect(result).not.toBeNull()
			expect(result?.videoId).toBe("123456789")
			expect(result?.privacyHash).toBe("abcdef1234")
		})

		it("parses player embed URL with hash parameter", () => {
			const result = parseVideoUrl(
				"https://player.vimeo.com/video/123456789?h=abc123def",
			)
			expect(result).not.toBeNull()
			expect(result?.videoId).toBe("123456789")
			expect(result?.privacyHash).toBe("abc123def")
		})
		})

		describe("Streamable URLs", () => {
			it("parses standard Streamable URL", () => {
				const result = parseVideoUrl("https://streamable.com/abc123")
				expect(result).not.toBeNull()
				expect(result?.platform).toBe("streamable")
				expect(result?.videoId).toBe("abc123")
				expect(result?.embedUrl).toBe("https://streamable.com/e/abc123")
			})

			it("parses Streamable URL with www", () => {
				const result = parseVideoUrl("https://www.streamable.com/xyz789")
				expect(result).not.toBeNull()
				expect(result?.platform).toBe("streamable")
				expect(result?.videoId).toBe("xyz789")
			})

			it("parses Streamable embed URL", () => {
				const result = parseVideoUrl("https://streamable.com/e/abc123")
				expect(result).not.toBeNull()
				expect(result?.platform).toBe("streamable")
				expect(result?.videoId).toBe("abc123")
			})

			it("parses Streamable URL with query params", () => {
				const result = parseVideoUrl("https://streamable.com/abc123?autoplay=1")
				expect(result).not.toBeNull()
				expect(result?.videoId).toBe("abc123")
			})

			it("parses URL without https prefix", () => {
				const result = parseVideoUrl("streamable.com/abc123")
				expect(result).not.toBeNull()
				expect(result?.videoId).toBe("abc123")
			})
		})

		describe("Invalid URLs", () => {
			it("returns null for non-video URLs", () => {
				expect(parseVideoUrl("https://google.com")).toBeNull()
				expect(parseVideoUrl("https://facebook.com/video")).toBeNull()
				expect(parseVideoUrl("https://tiktok.com/@user/video/123")).toBeNull()
			})

			it("returns null for invalid YouTube URLs", () => {
				expect(parseVideoUrl("https://youtube.com/user/channel")).toBeNull()
				expect(parseVideoUrl("https://youtube.com/playlist?list=abc")).toBeNull()
			})

			it("returns null for malformed URLs", () => {
				expect(parseVideoUrl("not a url")).toBeNull()
				expect(parseVideoUrl("")).toBeNull()
			})

			it("returns null for YouTube URL with invalid video ID", () => {
				// Video IDs must be exactly 11 characters
				expect(
					parseVideoUrl("https://youtube.com/watch?v=short"),
				).toBeNull()
				expect(
					parseVideoUrl("https://youtube.com/watch?v=toolongvideoiid123"),
				).toBeNull()
			})
		})
	})

	describe("isSupportedVideoUrl", () => {
		it("returns true for valid YouTube URLs", () => {
			expect(
				isSupportedVideoUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
			).toBe(true)
			expect(isSupportedVideoUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(true)
		})

		it("returns true for valid Vimeo URLs", () => {
			expect(isSupportedVideoUrl("https://vimeo.com/123456789")).toBe(true)
		})

		it("returns true for valid Streamable URLs", () => {
			expect(isSupportedVideoUrl("https://streamable.com/abc123")).toBe(true)
		})

		it("returns false for unsupported URLs", () => {
			expect(isSupportedVideoUrl("https://google.com")).toBe(false)
			expect(isSupportedVideoUrl("not a url")).toBe(false)
		})
	})

	describe("videoUrlSchema (Zod)", () => {
		it("validates and transforms valid YouTube URL", () => {
			const result = videoUrlSchema.safeParse(
				"https://www.youtube.com/watch?v=dQw4w9WgXcQ",
			)
			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.data.platform).toBe("youtube")
				expect(result.data.videoId).toBe("dQw4w9WgXcQ")
			}
		})

		it("validates and transforms valid Vimeo URL", () => {
			const result = videoUrlSchema.safeParse("https://vimeo.com/123456789")
			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.data.platform).toBe("vimeo")
				expect(result.data.videoId).toBe("123456789")
			}
		})

		it("rejects empty string", () => {
			const result = videoUrlSchema.safeParse("")
			expect(result.success).toBe(false)
			if (!result.success) {
				expect(result.error.issues[0].message).toBe(VIDEO_URL_ERRORS.EMPTY_URL)
			}
		})

		it("rejects invalid URL format", () => {
			const result = videoUrlSchema.safeParse("not a url")
			expect(result.success).toBe(false)
			if (!result.success) {
				expect(result.error.issues[0].message).toBe(
					VIDEO_URL_ERRORS.INVALID_URL,
				)
			}
		})

		it("rejects unsupported platform", () => {
			const result = videoUrlSchema.safeParse("https://tiktok.com/video/123")
			expect(result.success).toBe(false)
			if (!result.success) {
				expect(result.error.issues[0].message).toBe(
					VIDEO_URL_ERRORS.UNSUPPORTED_PLATFORM,
				)
			}
		})
	})

	describe("optionalVideoUrlSchema", () => {
		it("allows empty string", () => {
			const result = optionalVideoUrlSchema.safeParse("")
			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.data).toBeUndefined()
			}
		})

		it("allows null", () => {
			const result = optionalVideoUrlSchema.safeParse(null)
			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.data).toBeUndefined()
			}
		})

		it("allows undefined", () => {
			const result = optionalVideoUrlSchema.safeParse(undefined)
			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.data).toBeUndefined()
			}
		})

		it("validates and transforms valid URL", () => {
			const result = optionalVideoUrlSchema.safeParse(
				"https://youtube.com/watch?v=dQw4w9WgXcQ",
			)
			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.data?.platform).toBe("youtube")
			}
		})

		it("rejects invalid non-empty URL", () => {
			const result = optionalVideoUrlSchema.safeParse("not a url")
			expect(result.success).toBe(false)
		})
	})

	describe("videoUrlStringSchema", () => {
		it("returns original string for valid URL", () => {
			const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
			const result = videoUrlStringSchema.safeParse(url)
			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.data).toBe(url)
			}
		})

		it("rejects unsupported platform", () => {
			const result = videoUrlStringSchema.safeParse("https://tiktok.com/video")
			expect(result.success).toBe(false)
		})
	})

	describe("optionalVideoUrlStringSchema", () => {
		it("returns undefined for empty string", () => {
			const result = optionalVideoUrlStringSchema.safeParse("")
			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.data).toBeUndefined()
			}
		})

		it("returns original string for valid URL", () => {
			const url = "https://vimeo.com/123456789"
			const result = optionalVideoUrlStringSchema.safeParse(url)
			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.data).toBe(url)
			}
		})
	})

	describe("ParsedVideoUrl structure", () => {
		it("includes all expected fields for YouTube", () => {
			const result = parseVideoUrl(
				"https://www.youtube.com/watch?v=dQw4w9WgXcQ",
			)
			expect(result).toMatchObject({
				platform: "youtube",
				videoId: "dQw4w9WgXcQ",
				originalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
				embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
				thumbnailUrl: "https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
			})
		})

		it("includes all expected fields for Vimeo", () => {
			const result = parseVideoUrl("https://vimeo.com/123456789")
			expect(result).toMatchObject({
				platform: "vimeo",
				videoId: "123456789",
				originalUrl: "https://vimeo.com/123456789",
				embedUrl: "https://player.vimeo.com/video/123456789",
				thumbnailUrl: "https://vumbnail.com/123456789.jpg",
			})
		})

		it("includes all expected fields for Streamable", () => {
			const result = parseVideoUrl("https://streamable.com/abc123")
			expect(result).toMatchObject({
				platform: "streamable",
				videoId: "abc123",
				originalUrl: "https://streamable.com/abc123",
				embedUrl: "https://streamable.com/e/abc123",
				thumbnailUrl: "https://cdn-cf-east.streamable.com/image/abc123.jpg",
			})
		})
	})

	describe("Edge cases", () => {
		it("trims whitespace from URL", () => {
			const result = parseVideoUrl(
				"  https://youtube.com/watch?v=dQw4w9WgXcQ  ",
			)
			expect(result).not.toBeNull()
			expect(result?.videoId).toBe("dQw4w9WgXcQ")
		})

		it("handles http URLs (without s)", () => {
			const result = parseVideoUrl(
				"http://www.youtube.com/watch?v=dQw4w9WgXcQ",
			)
			expect(result).not.toBeNull()
			expect(result?.videoId).toBe("dQw4w9WgXcQ")
		})

		it("preserves original URL in parsed result", () => {
			const originalUrl = "https://youtu.be/dQw4w9WgXcQ?t=30"
			const result = parseVideoUrl(originalUrl)
			expect(result?.originalUrl).toBe(originalUrl)
		})
	})
})
