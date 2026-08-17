import { env } from "cloudflare:workers"
import { createFileRoute } from "@tanstack/react-router"
import { getAuthorizedDownloadFile } from "@/server-fns/downloadable-product-fns"
import { getSessionFromCookie } from "@/utils/auth"

function encodeRfc5987Value(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  )
}

export const Route = createFileRoute("/api/downloads/$fileId")({
  server: {
    handlers: {
      GET: async ({ params }: { params: { fileId: string } }) => {
        const session = await getSessionFromCookie()
        if (!session) return new Response("Unauthorized", { status: 401 })

        const file = await getAuthorizedDownloadFile(
          session.userId,
          params.fileId,
        )
        if (!file) return new Response("Not found", { status: 404 })

        const object = await env.R2_DOWNLOADS_BUCKET.get(file.r2Key)
        if (!object) return new Response("Not found", { status: 404 })

        const headers = new Headers({
          "Content-Type": file.mimeType,
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeRfc5987Value(file.originalFilename)}`,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        })
        return new Response(object.body, { headers })
      },
    },
  },
})
