"use client"

import { ExternalLink, Youtube } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { isSafeUrl } from "@/utils/url"

interface YouTubeEmbedProps {
	url: string
	className?: string
	title?: string
}

/**
 * Extracts YouTube video ID from various YouTube URL formats
 * Supports: youtube.com/watch?v=, youtu.be/, youtube.com/embed/, youtube.com/shorts/
 */
function extractYouTubeVideoId(url: string): string | null {
	if (!url) return null

	try {
		const urlObj = new URL(url)
		const hostname = urlObj.hostname.toLowerCase()

		// Standard youtube.com URLs
		if (hostname.includes("youtube.com")) {
			// /watch?v= format
			const videoId = urlObj.searchParams.get("v")
			if (videoId) return videoId

			// /embed/ format
			const embedMatch = urlObj.pathname.match(/\/embed\/([^/?]+)/)
			if (embedMatch) return embedMatch[1]

			// /shorts/ format
			const shortsMatch = urlObj.pathname.match(/\/shorts\/([^/?]+)/)
			if (shortsMatch) return shortsMatch[1]
		}

		// Short youtu.be URLs
		if (hostname.includes("youtu.be")) {
			const id = urlObj.pathname.slice(1).split(/[?&]/)[0]
			if (id) return id
		}
	} catch {
		// Invalid URL, try regex fallback
		const regexPatterns = [
			/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
		]

		for (const pattern of regexPatterns) {
			const match = url.match(pattern)
			if (match) return match[1]
		}
	}

	return null
}

/**
 * Checks if a URL is a valid YouTube URL
 */
export function isYouTubeUrl(url: string): boolean {
	return extractYouTubeVideoId(url) !== null
}

export function YouTubeEmbed({ url, className, title }: YouTubeEmbedProps) {
	const videoId = extractYouTubeVideoId(url)

	if (!videoId) {
		return (
			<div
				className={cn(
					"relative aspect-video w-full overflow-hidden rounded-lg bg-muted flex items-center justify-center p-4",
					className,
				)}
			>
				<a
					href={isSafeUrl(url) ? url : "#"}
					target="_blank"
					rel="noopener noreferrer"
					className="inline-flex items-center gap-2 text-primary hover:underline text-sm"
				>
					<ExternalLink className="h-4 w-4" />
					Open video in new tab
				</a>
			</div>
		)
	}

	return (
		<div
			className={cn(
				"relative aspect-video w-full overflow-hidden rounded-lg bg-black",
				className,
			)}
		>
			<iframe
				src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`}
				title={title || "YouTube video player"}
				allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
				allowFullScreen
				sandbox="allow-scripts allow-same-origin allow-presentation"
				className="absolute inset-0 h-full w-full"
				loading="lazy"
			/>
		</div>
	)
}

export function YouTubeThumbnail({
	url,
	className,
}: {
	url: string
	className?: string
}) {
	const videoId = extractYouTubeVideoId(url)
	const [imgSrc, setImgSrc] = useState(
		videoId
			? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
			: "",
	)

	if (!videoId) {
		return (
			<div
				className={cn(
					"relative aspect-video w-full overflow-hidden rounded-lg bg-muted flex items-center justify-center",
					className,
				)}
			>
				<Youtube aria-hidden="true" className="h-8 w-8 text-muted-foreground" />
			</div>
		)
	}

	return (
		<div
			className={cn(
				"relative aspect-video w-full overflow-hidden rounded-lg",
				className,
			)}
		>
			<img
				src={imgSrc}
				alt="Video thumbnail"
				className="absolute inset-0 h-full w-full object-cover"
				loading="lazy"
				onError={() => {
					setImgSrc(
						`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
					)
				}}
			/>
			<div className="absolute inset-0 flex items-center justify-center">
				<div className="rounded-full bg-red-600 p-3 shadow-lg">
					<Youtube aria-hidden="true" className="h-6 w-6 text-white" />
				</div>
			</div>
		</div>
	)
}
