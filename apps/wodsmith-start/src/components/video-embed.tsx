/**
 * Video Embed Component
 *
 * Renders an embedded video player for YouTube or Vimeo URLs.
 * Extracts video IDs and renders the appropriate iframe embed.
 */

import { useMemo } from "react"
import { VideoOff } from "lucide-react"

interface VideoEmbedProps {
	url: string | null
	className?: string
	aspectRatio?: "16/9" | "4/3" | "1/1"
}

/**
 * Extract video ID and platform from a video URL
 */
function parseVideoUrl(url: string): {
	platform: "youtube" | "vimeo" | null
	videoId: string | null
} {
	// YouTube patterns
	// https://www.youtube.com/watch?v=VIDEO_ID
	// https://youtu.be/VIDEO_ID
	// https://www.youtube.com/embed/VIDEO_ID
	const youtubePatterns = [
		/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
	]

	for (const pattern of youtubePatterns) {
		const match = url.match(pattern)
		if (match) {
			return { platform: "youtube", videoId: match[1] }
		}
	}

	// Vimeo patterns
	// https://vimeo.com/VIDEO_ID
	// https://player.vimeo.com/video/VIDEO_ID
	const vimeoPatterns = [
		/(?:vimeo\.com\/|player\.vimeo\.com\/video\/)(\d+)/,
	]

	for (const pattern of vimeoPatterns) {
		const match = url.match(pattern)
		if (match) {
			return { platform: "vimeo", videoId: match[1] }
		}
	}

	return { platform: null, videoId: null }
}

/**
 * Get the embed URL for a video
 */
function getEmbedUrl(
	platform: "youtube" | "vimeo",
	videoId: string,
): string {
	switch (platform) {
		case "youtube":
			return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`
		case "vimeo":
			return `https://player.vimeo.com/video/${videoId}?byline=0&portrait=0`
		default:
			return ""
	}
}

export function VideoEmbed({
	url,
	className = "",
	aspectRatio = "16/9",
}: VideoEmbedProps) {
	const videoInfo = useMemo(() => {
		if (!url) return null
		return parseVideoUrl(url)
	}, [url])

	// No URL provided
	if (!url) {
		return (
			<div
				className={`bg-muted flex items-center justify-center rounded-lg ${className}`}
				style={{ aspectRatio }}
			>
				<div className="text-muted-foreground flex flex-col items-center gap-2">
					<VideoOff className="h-12 w-12" />
					<span>No video submitted</span>
				</div>
			</div>
		)
	}

	// Unrecognized video URL
	if (!videoInfo?.platform || !videoInfo?.videoId) {
		return (
			<div
				className={`bg-muted flex flex-col items-center justify-center gap-2 rounded-lg p-4 ${className}`}
				style={{ aspectRatio }}
			>
				<div className="text-muted-foreground flex flex-col items-center gap-2">
					<VideoOff className="h-12 w-12" />
					<span>Unsupported video URL</span>
				</div>
				<a
					href={url}
					target="_blank"
					rel="noopener noreferrer"
					className="text-primary hover:underline"
				>
					Open in new tab
				</a>
			</div>
		)
	}

	const embedUrl = getEmbedUrl(videoInfo.platform, videoInfo.videoId)

	return (
		<div
			className={`relative overflow-hidden rounded-lg ${className}`}
			style={{ aspectRatio }}
		>
			<iframe
				src={embedUrl}
				title="Submission video"
				allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
				allowFullScreen
				className="absolute inset-0 h-full w-full"
			/>
		</div>
	)
}

/**
 * Thumbnail component for video previews
 */
export function VideoThumbnail({
	url,
	className = "",
}: {
	url: string | null
	className?: string
}) {
	const videoInfo = useMemo(() => {
		if (!url) return null
		return parseVideoUrl(url)
	}, [url])

	if (!videoInfo?.platform || !videoInfo?.videoId) {
		return (
			<div
				className={`bg-muted flex items-center justify-center rounded ${className}`}
			>
				<VideoOff className="text-muted-foreground h-6 w-6" />
			</div>
		)
	}

	// YouTube thumbnail
	if (videoInfo.platform === "youtube") {
		return (
			<img
				src={`https://img.youtube.com/vi/${videoInfo.videoId}/mqdefault.jpg`}
				alt="Video thumbnail"
				className={`rounded object-cover ${className}`}
			/>
		)
	}

	// Vimeo doesn't have easy thumbnail access, show placeholder
	return (
		<div
			className={`bg-muted flex items-center justify-center rounded ${className}`}
		>
			<span className="text-muted-foreground text-xs">Vimeo</span>
		</div>
	)
}
