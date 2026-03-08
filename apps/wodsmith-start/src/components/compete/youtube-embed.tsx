"use client"

import { ExternalLink, Youtube } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { isSafeUrl } from "@/utils/url"

declare global {
	interface Window {
		YT: typeof YT
		onYouTubeIframeAPIReady: (() => void) | undefined
	}
	namespace YT {
		class Player {
			constructor(elementId: string, config: PlayerConfig)
			pauseVideo(): void
			playVideo(): void
			getCurrentTime(): number
			seekTo(seconds: number, allowSeekAhead?: boolean): void
			destroy(): void
		}
		interface PlayerConfig {
			videoId: string
			playerVars?: Record<string, number | string>
			events?: {
				onReady?: (event: { target: Player }) => void
			}
		}
	}
}

export interface YouTubePlayerRef {
	pauseVideo: () => void
	playVideo: () => void
	getCurrentTime: () => number
	seekTo: (seconds: number, allowSeekAhead?: boolean) => void
}

interface YouTubePlayerEmbedProps {
	url: string
	className?: string
	title?: string
	onPlayerReady?: (player: YouTubePlayerRef) => void
}

let iframeApiLoaded = false
let iframeApiScriptInjected = false

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
		videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : "",
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
					setImgSrc(`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`)
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

function loadIframeApi(): Promise<void> {
	if (iframeApiLoaded && window.YT?.Player) {
		return Promise.resolve()
	}

	return new Promise<void>((resolve) => {
		if (window.YT?.Player) {
			iframeApiLoaded = true
			resolve()
			return
		}

		const prev = window.onYouTubeIframeAPIReady
		window.onYouTubeIframeAPIReady = () => {
			iframeApiLoaded = true
			prev?.()
			resolve()
		}

		if (!iframeApiScriptInjected) {
			iframeApiScriptInjected = true
			const script = document.createElement("script")
			script.src = "https://www.youtube.com/iframe_api"
			document.head.appendChild(script)
		}
	})
}

export function YouTubePlayerEmbed({
	url,
	className,
	title,
	onPlayerReady,
}: YouTubePlayerEmbedProps) {
	const videoId = extractYouTubeVideoId(url)
	const reactId = useId()
	const elementId = `yt-player-${reactId.replace(/:/g, "-")}`
	const playerRef = useRef<YT.Player | null>(null)
	const onPlayerReadyRef = useRef(onPlayerReady)
	onPlayerReadyRef.current = onPlayerReady

	useEffect(() => {
		if (!videoId) return

		let destroyed = false

		loadIframeApi().then(() => {
			if (destroyed) return

			playerRef.current = new YT.Player(elementId, {
				videoId,
				playerVars: { rel: 0, modestbranding: 1, enablejsapi: 1 },
				events: {
					onReady: (event) => {
						if (destroyed) return
						const p = event.target
						const ref: YouTubePlayerRef = {
							pauseVideo: () => p.pauseVideo(),
							playVideo: () => p.playVideo(),
							getCurrentTime: () => p.getCurrentTime(),
							seekTo: (seconds, allowSeekAhead) =>
								p.seekTo(seconds, allowSeekAhead),
						}
						onPlayerReadyRef.current?.(ref)
					},
				},
			})
		})

		return () => {
			destroyed = true
			playerRef.current?.destroy()
			playerRef.current = null
		}
	}, [videoId, elementId])

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
		<section
			className={cn(
				"relative aspect-video w-full overflow-hidden rounded-lg bg-black",
				className,
			)}
			aria-label={title || "YouTube video player"}
		>
			<div id={elementId} className="absolute inset-0 h-full w-full" />
		</section>
	)
}
