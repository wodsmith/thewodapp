import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { YouTubeEmbed, YouTubeThumbnail, isYouTubeUrl } from "@/components/compete/youtube-embed"

// Mock isSafeUrl since it's a dependency
vi.mock("@/utils/url", () => ({
	isSafeUrl: (url: string) => {
		try {
			const parsed = new URL(url)
			return parsed.protocol === "http:" || parsed.protocol === "https:"
		} catch {
			return false
		}
	},
}))

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
	ExternalLink: ({ className }: { className?: string }) => (
		<span data-testid="external-link-icon" className={className} />
	),
	Youtube: ({ className }: { className?: string }) => (
		<span data-testid="youtube-icon" className={className} />
	),
}))

describe("isYouTubeUrl", () => {
	it("detects standard youtube.com/watch URLs", () => {
		expect(isYouTubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(true)
		expect(isYouTubeUrl("https://youtube.com/watch?v=dQw4w9WgXcQ")).toBe(true)
		expect(isYouTubeUrl("http://www.youtube.com/watch?v=abc123def45")).toBe(true)
	})

	it("detects youtu.be short URLs", () => {
		expect(isYouTubeUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(true)
		expect(isYouTubeUrl("http://youtu.be/abc123def45")).toBe(true)
	})

	it("detects youtube.com/embed URLs", () => {
		expect(isYouTubeUrl("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe(true)
	})

	it("detects youtube.com/shorts URLs", () => {
		expect(isYouTubeUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe(true)
	})

	it("handles URLs with extra query params", () => {
		expect(isYouTubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120")).toBe(true)
		expect(isYouTubeUrl("https://youtu.be/dQw4w9WgXcQ?t=120")).toBe(true)
	})

	it("returns false for non-YouTube URLs", () => {
		expect(isYouTubeUrl("https://vimeo.com/123456")).toBe(false)
		expect(isYouTubeUrl("https://example.com")).toBe(false)
		expect(isYouTubeUrl("https://streamable.com/abc")).toBe(false)
	})

	it("returns false for empty or invalid URLs", () => {
		expect(isYouTubeUrl("")).toBe(false)
		expect(isYouTubeUrl("not-a-url")).toBe(false)
	})

	it("returns false for YouTube URLs without video ID", () => {
		expect(isYouTubeUrl("https://youtube.com")).toBe(false)
		expect(isYouTubeUrl("https://youtube.com/watch")).toBe(false)
	})
})

describe("YouTubeEmbed", () => {
	it("renders iframe for valid YouTube URL", () => {
		render(<YouTubeEmbed url="https://www.youtube.com/watch?v=dQw4w9WgXcQ" />)

		const iframe = document.querySelector("iframe")
		expect(iframe).toBeTruthy()
		expect(iframe?.src).toContain("youtube.com/embed/dQw4w9WgXcQ")
		expect(iframe?.getAttribute("sandbox")).toBe("allow-scripts allow-same-origin allow-presentation")
	})

	it("renders iframe with custom title", () => {
		render(
			<YouTubeEmbed
				url="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
				title="My Workout Video"
			/>,
		)

		const iframe = document.querySelector("iframe")
		expect(iframe?.title).toBe("My Workout Video")
	})

	it("renders default title when none provided", () => {
		render(<YouTubeEmbed url="https://www.youtube.com/watch?v=dQw4w9WgXcQ" />)

		const iframe = document.querySelector("iframe")
		expect(iframe?.title).toBe("YouTube video player")
	})

	it("renders external link fallback for non-YouTube URLs", () => {
		render(<YouTubeEmbed url="https://vimeo.com/123456" />)

		const iframe = document.querySelector("iframe")
		expect(iframe).toBeNull()

		const link = screen.getByText("Open video in new tab")
		expect(link).toBeTruthy()
		expect(link.closest("a")?.href).toContain("vimeo.com/123456")
	})

	it("renders safe href=#  for unsafe URLs in fallback", () => {
		render(<YouTubeEmbed url="javascript:alert(1)" />)

		const link = screen.getByText("Open video in new tab")
		expect(link.closest("a")?.getAttribute("href")).toBe("#")
	})

	it("sets noopener noreferrer on external links", () => {
		render(<YouTubeEmbed url="https://vimeo.com/123456" />)

		const link = screen.getByText("Open video in new tab").closest("a")
		expect(link?.rel).toBe("noopener noreferrer")
		expect(link?.target).toBe("_blank")
	})
})

describe("YouTubeThumbnail", () => {
	it("renders thumbnail image for valid YouTube URL", () => {
		render(<YouTubeThumbnail url="https://www.youtube.com/watch?v=dQw4w9WgXcQ" />)

		const img = document.querySelector("img")
		expect(img).toBeTruthy()
		expect(img?.src).toContain("img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg")
	})

	it("renders placeholder for non-YouTube URL", () => {
		render(<YouTubeThumbnail url="https://vimeo.com/123" />)

		const img = document.querySelector("img")
		expect(img).toBeNull()
		expect(screen.getByTestId("youtube-icon")).toBeTruthy()
	})
})
