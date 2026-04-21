/**
 * WeTime Video Resolver
 *
 * WeTime share URLs (`wetime.io/preview/ID`) don't expose a direct media URL
 * via the share token — the ID maps to a CloudFront-hosted MP4 only after the
 * preview page is rendered. This server function fetches the preview HTML and
 * extracts the `<source src="...mp4">` so we can play it in a native <video>
 * element instead of iframing the full WeTime chrome.
 */

import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { getSessionFromCookie } from "@/utils/auth"

const WETIME_PREVIEW_TIMEOUT_MS = 5000

const inputSchema = z.object({
  videoId: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z0-9_-]+$/, "Invalid WeTime video id"),
})

export const resolveWeTimeVideoUrlFn = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<{ videoUrl: string }> => {
    const session = await getSessionFromCookie()
    if (!session?.userId) {
      throw new Error("Not authenticated")
    }

    const previewUrl = `https://wetime.io/preview/${data.videoId}`
    const controller = new AbortController()
    const timeoutId = setTimeout(
      () => controller.abort(),
      WETIME_PREVIEW_TIMEOUT_MS,
    )

    try {
      const res = await fetch(previewUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; WodsmithBot/1.0; +https://wodsmith.com)",
        },
        signal: controller.signal,
      })
      if (!res.ok) {
        throw new Error(`WeTime preview fetch failed: ${res.status}`)
      }

      const html = await res.text()
      // Match any <source> whose src ends with .mp4 (optionally followed by
      // query params). Attributes on <source> may appear in any order, so scan
      // each <source ...> tag for a matching src.
      let mp4Url: string | null = null
      const sourceTagRegex = /<source\b[^>]*>/gi
      for (const tag of html.match(sourceTagRegex) ?? []) {
        const srcMatch = tag.match(/\bsrc\s*=\s*"([^"]+\.mp4[^"]*)"/i)
        if (srcMatch?.[1]) {
          mp4Url = srcMatch[1]
          break
        }
      }
      if (!mp4Url) {
        throw new Error("Could not locate video source in WeTime preview")
      }

      return { videoUrl: mp4Url }
    } finally {
      clearTimeout(timeoutId)
    }
  })
