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
    const res = await fetch(previewUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; WodsmithBot/1.0; +https://wodsmith.com)",
      },
    })
    if (!res.ok) {
      throw new Error(`WeTime preview fetch failed: ${res.status}`)
    }

    const html = await res.text()
    const match = html.match(/<source\s+src="([^"]+\.mp4[^"]*)"/i)
    if (!match?.[1]) {
      throw new Error("Could not locate video source in WeTime preview")
    }

    return { videoUrl: match[1] }
  })
