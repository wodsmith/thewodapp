"use client"

import { AlertCircle, ExternalLink, Youtube } from "lucide-react"
import { useMemo } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { cn } from "@/lib/utils"

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
	const videoId = useMemo(() => extractYouTubeVideoId(url), [url])

	if (!videoId) {
		// Not a YouTube URL - show a link instead
		return (
			<div
				className={cn(
					"relative aspect-video w-full overflow-hidden rounded-lg bg-muted",
					className,
				)}
			>
				<div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center">
					<Alert variant="default" className="max-w-sm">
						<AlertCircle className="h-4 w-4" />
						<AlertDescription className="text-left">
							<p className="font-medium mb-2">Video preview unavailable</p>
							<p className="text-xs text-muted-foreground mb-3">
								Only YouTube videos can be previewed inline
							</p>
							<a
								href={url}
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center gap-2 text-primary hover:underline text-sm"
							>
								<ExternalLink className="h-4 w-4" />
								Open video in new tab
							</a>
						</AlertDescription>
					</Alert>
				</div>
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
				className="absolute inset-0 h-full w-full"
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
	const videoId = useMemo(() => extractYouTubeVideoId(url), [url])

	if (!videoId) {
		return (
			<div
				className={cn(
					"relative aspect-video w-full overflow-hidden rounded-lg bg-muted flex items-center justify-center",
					className,
				)}
			>
				<Youtube className="h-8 w-8 text-muted-foreground" />
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
				src={`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`}
				alt="Video thumbnail"
				className="absolute inset-0 h-full w-full object-cover"
				onError={(e) => {
					// Fallback to medium quality if maxres doesn't exist
					;(e.target as HTMLImageElement).src =
						`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
				}}
			/>
			<div className="absolute inset-0 flex items-center justify-center">
				<div className="rounded-full bg-red-600 p-3 shadow-lg">
					<Youtube className="h-6 w-6 text-white" />
				</div>
			</div>
		</div>
	)
}
