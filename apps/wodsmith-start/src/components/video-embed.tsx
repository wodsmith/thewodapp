/**
 * Video Embed Component
 *
 * Renders an embedded video player for YouTube, Vimeo, or WodProof URLs.
 * Uses the shared parseVideoUrl parser from @/schemas/video-url.
 */

import { useMemo } from "react"
import { ExternalLink, VideoOff } from "lucide-react"
import { getWodProofVideoUrl, parseVideoUrl } from "@/schemas/video-url"
import { isSafeUrl } from "@/utils/url"

interface VideoEmbedProps {
  url: string | null
  className?: string
  aspectRatio?: "16/9" | "4/3" | "1/1"
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
  if (!videoInfo) {
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
          href={isSafeUrl(url) ? url : "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          Open in new tab
        </a>
      </div>
    )
  }

  // WodProof — render native video player
  if (videoInfo.platform === "wodproof") {
    return (
      <div
        className={`relative overflow-hidden rounded-lg bg-black ${className}`}
        style={{ aspectRatio }}
      >
        <video
          src={getWodProofVideoUrl(videoInfo.videoId)}
          controls
          playsInline
          className="absolute inset-0 h-full w-full"
        />
      </div>
    )
  }

  // Platform without embed support — show external link
  if (!videoInfo.supportsEmbed) {
    return (
      <div
        className={`bg-muted flex flex-col items-center justify-center gap-3 rounded-lg p-6 ${className}`}
        style={{ aspectRatio }}
      >
        <div className="text-muted-foreground flex flex-col items-center gap-2">
          <span className="text-sm">
            This video must be viewed on the platform
          </span>
        </div>
        <a
          href={isSafeUrl(videoInfo.originalUrl) ? videoInfo.originalUrl : "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <ExternalLink className="h-4 w-4" />
          Open video
        </a>
      </div>
    )
  }

  return (
    <div
      className={`relative overflow-hidden rounded-lg ${className}`}
      style={{ aspectRatio }}
    >
      <iframe
        src={videoInfo.embedUrl}
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

  if (!videoInfo) {
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
        src={videoInfo.thumbnailUrl}
        alt="Video thumbnail"
        className={`rounded object-cover ${className}`}
      />
    )
  }

  // Vimeo / WodProof / other — platform label placeholder
  return (
    <div
      className={`bg-muted flex items-center justify-center rounded ${className}`}
    >
      <span className="text-muted-foreground text-xs capitalize">
        {videoInfo.platform === "wodproof" ? "WodProof" : videoInfo.platform}
      </span>
    </div>
  )
}
