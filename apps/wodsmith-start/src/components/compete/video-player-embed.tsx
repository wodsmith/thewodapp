"use client"

/**
 * Unified Video Player Embed
 *
 * Platform-aware video player supporting YouTube and Vimeo with interactive
 * playback controls (seek, getCurrentTime).
 */

import { ExternalLink } from "lucide-react"
import { useEffect, useId, useRef } from "react"
import { cn } from "@/lib/utils"
import { parseVideoUrl, type VideoPlatform } from "@/schemas/video-url"
import { isSafeUrl } from "@/utils/url"

// ── Common player interface ──────────────────────────────────────────

export interface VideoPlayerRef {
  pauseVideo: () => void
  playVideo: () => void
  getCurrentTime: () => number
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void
  platform: VideoPlatform
}

interface VideoPlayerEmbedProps {
  url: string
  className?: string
  title?: string
  onPlayerReady?: (player: VideoPlayerRef) => void
}

// YouTube IFrame API types are declared in youtube-embed.tsx

let ytApiLoaded = false
let ytApiScriptInjected = false

function loadYouTubeApi(): Promise<void> {
  if (ytApiLoaded && window.YT?.Player) {
    return Promise.resolve()
  }
  return new Promise<void>((resolve) => {
    if (window.YT?.Player) {
      ytApiLoaded = true
      resolve()
      return
    }
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      ytApiLoaded = true
      prev?.()
      resolve()
    }
    if (!ytApiScriptInjected) {
      ytApiScriptInjected = true
      const script = document.createElement("script")
      script.src = "https://www.youtube.com/iframe_api"
      document.head.appendChild(script)
    }
  })
}

// ── YouTube Player ───────────────────────────────────────────────────

function YouTubePlayer({
  videoId,
  className,
  onPlayerReady,
}: {
  videoId: string
  className?: string
  onPlayerReady?: (player: VideoPlayerRef) => void
}) {
  const reactId = useId()
  const elementId = `yt-player-${reactId.replace(/:/g, "-")}`
  const playerRef = useRef<YT.Player | null>(null)
  const onReadyRef = useRef(onPlayerReady)
  onReadyRef.current = onPlayerReady

  useEffect(() => {
    let destroyed = false

    loadYouTubeApi().then(() => {
      if (destroyed) return
      playerRef.current = new YT.Player(elementId, {
        videoId,
        playerVars: { rel: 0, modestbranding: 1, enablejsapi: 1 },
        events: {
          onReady: (event) => {
            if (destroyed) return
            const p = event.target
            const ref: VideoPlayerRef = {
              platform: "youtube",
              pauseVideo: () => p.pauseVideo(),
              playVideo: () => p.playVideo(),
              getCurrentTime: () => p.getCurrentTime(),
              seekTo: (seconds, allowSeekAhead) =>
                p.seekTo(seconds, allowSeekAhead),
            }
            onReadyRef.current?.(ref)
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

  return (
    <div
      className={cn(
        "relative aspect-video w-full overflow-hidden rounded-lg bg-black",
        className,
      )}
    >
      <div id={elementId} className="absolute inset-0 h-full w-full" />
    </div>
  )
}

// ── Vimeo Player ─────────────────────────────────────────────────────

function VimeoPlayer({
  videoId,
  privacyHash,
  className,
  onPlayerReady,
}: {
  videoId: string
  privacyHash?: string
  className?: string
  onPlayerReady?: (player: VideoPlayerRef) => void
}) {
  const reactId = useId()
  const containerId = `vimeo-player-${reactId.replace(/:/g, "-")}`
  const playerRef = useRef<InstanceType<
    typeof import("@vimeo/player").default
  > | null>(null)
  const onReadyRef = useRef(onPlayerReady)
  onReadyRef.current = onPlayerReady

  useEffect(() => {
    let destroyed = false

    import("@vimeo/player").then(({ default: VimeoPlayerClass }) => {
      if (destroyed) return

      const container = document.getElementById(containerId)
      if (!container) return

      const options: Record<string, unknown> = {
        id: Number(videoId),
        responsive: true,
      }
      if (privacyHash) {
        options.h = privacyHash
      }

      const player = new VimeoPlayerClass(container, options)
      playerRef.current = player

      player.ready().then(() => {
        if (destroyed) return

        // Cache for synchronous getCurrentTime calls
        let cachedTime = 0
        player.on("timeupdate", (data: { seconds: number }) => {
          cachedTime = data.seconds
        })

        const ref: VideoPlayerRef = {
          platform: "vimeo",
          pauseVideo: () => {
            player.pause()
          },
          playVideo: () => {
            player.play()
          },
          getCurrentTime: () => cachedTime,
          seekTo: (seconds) => {
            player.setCurrentTime(seconds)
          },
        }
        onReadyRef.current?.(ref)
      })
    })

    return () => {
      destroyed = true
      playerRef.current?.destroy()
      playerRef.current = null
    }
  }, [videoId, privacyHash, containerId])

  return (
    <div
      className={cn(
        "relative aspect-video w-full overflow-hidden rounded-lg bg-black",
        className,
      )}
    >
      <div id={containerId} className="absolute inset-0 h-full w-full" />
    </div>
  )
}

// ── Unified component ────────────────────────────────────────────────

export function VideoPlayerEmbed({
  url,
  className,
  onPlayerReady,
}: VideoPlayerEmbedProps) {
  const parsed = parseVideoUrl(url)

  if (!parsed) {
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

  switch (parsed.platform) {
    case "youtube":
      return (
        <YouTubePlayer
          videoId={parsed.videoId}
          className={className}
          onPlayerReady={onPlayerReady}
        />
      )
    case "vimeo":
      return (
        <VimeoPlayer
          videoId={parsed.videoId}
          privacyHash={parsed.privacyHash}
          className={className}
          onPlayerReady={onPlayerReady}
        />
      )
  }
}

/**
 * Check if a video URL supports interactive playback (seek, getCurrentTime)
 */
export function supportsInteractivePlayer(url: string): boolean {
  const parsed = parseVideoUrl(url)
  return parsed?.platform === "youtube" || parsed?.platform === "vimeo"
}

/**
 * Get platform display name for a video URL
 */
export function getVideoPlatformName(url: string): string | null {
  const parsed = parseVideoUrl(url)
  if (!parsed) return null
  switch (parsed.platform) {
    case "youtube":
      return "YouTube"
    case "vimeo":
      return "Vimeo"
  }
}
