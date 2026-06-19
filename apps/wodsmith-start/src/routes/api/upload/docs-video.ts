import { env } from "cloudflare:workers"
import { createFileRoute } from "@tanstack/react-router"
import { json } from "@tanstack/react-start"
import {
  addRequestContextAttribute,
  logError,
  logInfo,
  logWarning,
  updateRequestContext,
} from "@/lib/logging"
import {
  DOCS_VIDEO_ALLOWED_TYPE_LABEL,
  DOCS_VIDEO_ALLOWED_TYPES,
  DOCS_VIDEO_MULTIPART_CHUNK_SIZE_BYTES,
  DOCS_VIDEO_MULTIPART_MAX_SIZE_MB,
  DOCS_VIDEO_PATH_PREFIX,
} from "@/lib/upload-limits"
import { checkUploadAuthorization } from "@/server/upload-authorization"
import { getSessionFromCookie } from "@/utils/auth"

const DOCS_VIDEO_UPLOAD_TOKEN_TTL_MS = 60 * 60 * 1000
const UPLOAD_TOKEN_HEADER = "X-Docs-Video-Upload-Token"

interface DocsVideoUploadedPart extends R2UploadedPart {
  size: number
}

interface DocsVideoUploadTokenPayload {
  uploadId: string
  key: string
  userId: string
  originalFilename: string
  fileSize: number
  contentType: string
  createdAt: number
  expiresAt: number
}

interface InitiateBody {
  fileName?: string
  fileSize?: number
  contentType?: string
}

interface ValidInitiateBody {
  fileName: string
  fileSize: number
  contentType: string
}

interface CompleteBody {
  uploadToken?: string
  parts?: DocsVideoUploadedPart[]
}

type UploadSession = NonNullable<
  Awaited<ReturnType<typeof getSessionFromCookie>>
>

type AuthenticatedUpload =
  | { ok: true; session: UploadSession }
  | { ok: false; response: Response }

async function readJsonBody<T>(request: Request): Promise<T | null> {
  return (await request.json().catch(() => null)) as T | null
}

async function requireDocsVideoUploadAuth(): Promise<AuthenticatedUpload> {
  const session = await getSessionFromCookie()
  if (!session) {
    logWarning({ message: "[DocsVideoUpload] Unauthorized upload attempt" })
    return {
      ok: false,
      response: json({ error: "Unauthorized" }, { status: 401 }),
    }
  }

  updateRequestContext({ userId: session.user.id })
  addRequestContextAttribute("uploadPurpose", "docs-video")

  const authCheck = await checkUploadAuthorization(
    "docs-video",
    null,
    session.user.id,
  )
  if (!authCheck.authorized) {
    logWarning({
      message: "[DocsVideoUpload] Authorization denied",
      attributes: { reason: authCheck.error },
    })
    return {
      ok: false,
      response: json(
        { error: authCheck.error || "Forbidden" },
        { status: 403 },
      ),
    }
  }

  return { ok: true, session }
}

function validateInitiateBody(body: InitiateBody | null) {
  if (!body?.fileName || !body.fileSize || !body.contentType) {
    return "fileName, fileSize, and contentType are required"
  }

  if (!Number.isFinite(body.fileSize) || body.fileSize <= 0) {
    return "Invalid file size"
  }

  const maxSizeBytes = DOCS_VIDEO_MULTIPART_MAX_SIZE_MB * 1024 * 1024
  if (body.fileSize > maxSizeBytes) {
    return `File too large. Maximum size is ${DOCS_VIDEO_MULTIPART_MAX_SIZE_MB}MB`
  }

  if (!DOCS_VIDEO_ALLOWED_TYPES.some((type) => type === body.contentType)) {
    return `Invalid file type. Allowed: ${DOCS_VIDEO_ALLOWED_TYPE_LABEL}`
  }

  return null
}

function parseValidInitiateBody(body: InitiateBody | null) {
  const error = validateInitiateBody(body)
  if (error || !body?.fileName || !body.fileSize || !body.contentType) {
    return { ok: false as const, error: error || "Invalid request" }
  }

  return {
    ok: true as const,
    body: {
      fileName: body.fileName,
      fileSize: body.fileSize,
      contentType: body.contentType,
    } satisfies ValidInitiateBody,
  }
}

function getExtension(fileName: string, contentType: string) {
  const fileExtension = fileName.split(".").pop()?.toLowerCase()
  if (fileExtension && ["mp4", "webm", "mov", "qt"].includes(fileExtension)) {
    return fileExtension === "qt" ? "mov" : fileExtension
  }

  if (contentType === "video/webm") return "webm"
  if (contentType === "video/quicktime") return "mov"
  return "mp4"
}

function buildPublicUrl(key: string) {
  return env.R2_PUBLIC_URL ? `${env.R2_PUBLIC_URL}/${key}` : key
}

function base64UrlEncodeBytes(bytes: Uint8Array) {
  let binary = ""
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "")
}

function base64UrlDecodeBytes(value: string) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/")
  const paddingLength = (4 - (base64.length % 4)) % 4
  const binary = atob(base64 + "=".repeat(paddingLength))
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

function encodePayload(payload: DocsVideoUploadTokenPayload) {
  return base64UrlEncodeBytes(new TextEncoder().encode(JSON.stringify(payload)))
}

function decodePayload(value: string) {
  return JSON.parse(
    new TextDecoder().decode(base64UrlDecodeBytes(value)),
  ) as DocsVideoUploadTokenPayload
}

async function getUploadTokenSigningKey(session: UploadSession) {
  return await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(
      `docs-video-upload:${session.id}:${session.user.id}`,
    ),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  )
}

async function signUploadPayload(
  payload: DocsVideoUploadTokenPayload,
  session: UploadSession,
) {
  const encodedPayload = encodePayload(payload)
  const signature = await crypto.subtle.sign(
    "HMAC",
    await getUploadTokenSigningKey(session),
    new TextEncoder().encode(encodedPayload),
  )

  return `${encodedPayload}.${base64UrlEncodeBytes(new Uint8Array(signature))}`
}

async function verifyUploadToken(
  uploadToken: string | null | undefined,
  session: UploadSession,
) {
  if (!uploadToken) return null

  try {
    const tokenParts = uploadToken.split(".")
    if (tokenParts.length !== 2) return null

    const [encodedPayload, encodedSignature] = tokenParts
    if (!encodedPayload || !encodedSignature) return null

    const isValid = await crypto.subtle.verify(
      "HMAC",
      await getUploadTokenSigningKey(session),
      base64UrlDecodeBytes(encodedSignature),
      new TextEncoder().encode(encodedPayload),
    )
    if (!isValid) return null

    const payload = decodePayload(encodedPayload)
    if (payload.userId !== session.user.id || payload.expiresAt < Date.now()) {
      return null
    }

    return payload
  } catch {
    return null
  }
}

function getExpectedPartCount(fileSize: number) {
  return Math.ceil(fileSize / DOCS_VIDEO_MULTIPART_CHUNK_SIZE_BYTES)
}

function getExpectedPartSize(fileSize: number, partNumber: number) {
  const expectedPartCount = getExpectedPartCount(fileSize)
  if (partNumber < 1 || partNumber > expectedPartCount) return null
  if (partNumber < expectedPartCount) {
    return DOCS_VIDEO_MULTIPART_CHUNK_SIZE_BYTES
  }

  const finalPartSize = fileSize % DOCS_VIDEO_MULTIPART_CHUNK_SIZE_BYTES
  return finalPartSize === 0
    ? DOCS_VIDEO_MULTIPART_CHUNK_SIZE_BYTES
    : finalPartSize
}

function toR2UploadedParts(parts: DocsVideoUploadedPart[]): R2UploadedPart[] {
  return parts.map(({ partNumber, etag }) => ({ partNumber, etag }))
}

function validateUploadedParts(
  parts: DocsVideoUploadedPart[] | undefined,
  payload: DocsVideoUploadTokenPayload,
) {
  if (!Array.isArray(parts) || parts.length === 0) {
    return { ok: false as const, error: "No uploaded parts to complete" }
  }

  const expectedPartCount = getExpectedPartCount(payload.fileSize)
  if (parts.length !== expectedPartCount) {
    return {
      ok: false as const,
      error: "Uploaded parts do not match declared file size",
    }
  }

  const sortedParts = [...parts].sort((a, b) => a.partNumber - b.partNumber)
  let uploadedByteCount = 0
  for (let index = 0; index < expectedPartCount; index += 1) {
    const expectedPartNumber = index + 1
    const part = sortedParts[index]
    const expectedPartSize = getExpectedPartSize(
      payload.fileSize,
      expectedPartNumber,
    )
    if (
      !part ||
      part.partNumber !== expectedPartNumber ||
      typeof part.etag !== "string" ||
      part.etag.length === 0 ||
      !Number.isFinite(part.size) ||
      part.size !== expectedPartSize
    ) {
      return {
        ok: false as const,
        error: "Uploaded parts do not match declared file size",
      }
    }
    uploadedByteCount += part.size
  }

  if (uploadedByteCount !== payload.fileSize) {
    return {
      ok: false as const,
      error: "Uploaded parts do not match declared file size",
    }
  }

  return { ok: true as const, parts: sortedParts }
}

export const Route = createFileRoute("/api/upload/docs-video")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireDocsVideoUploadAuth()
        if (!auth.ok) return auth.response

        const parsedBody = parseValidInitiateBody(
          await readJsonBody<InitiateBody>(request),
        )
        if (!parsedBody.ok) {
          return json({ error: parsedBody.error }, { status: 400 })
        }
        const { body } = parsedBody

        const extension = getExtension(body.fileName, body.contentType)
        const key = `${DOCS_VIDEO_PATH_PREFIX}/${auth.session.user.id}/${Date.now()}-${crypto.randomUUID()}.${extension}`

        try {
          const multipartUpload = await env.R2_BUCKET.createMultipartUpload(
            key,
            {
              httpMetadata: {
                contentType: body.contentType,
              },
              customMetadata: {
                uploadedBy: auth.session.user.id,
                purpose: "docs-video",
                originalFilename: body.fileName,
              },
            },
          )

          const now = Date.now()
          const uploadToken = await signUploadPayload(
            {
              uploadId: multipartUpload.uploadId,
              key,
              userId: auth.session.user.id,
              originalFilename: body.fileName,
              fileSize: body.fileSize,
              contentType: body.contentType,
              createdAt: now,
              expiresAt: now + DOCS_VIDEO_UPLOAD_TOKEN_TTL_MS,
            },
            auth.session,
          )

          logInfo({
            message: "[DocsVideoUpload] Multipart upload initiated",
            attributes: {
              key,
              fileSize: body.fileSize,
              mimeType: body.contentType,
            },
          })

          return json({
            uploadId: multipartUpload.uploadId,
            uploadToken,
            key,
            chunkSize: DOCS_VIDEO_MULTIPART_CHUNK_SIZE_BYTES,
            maxSizeBytes: DOCS_VIDEO_MULTIPART_MAX_SIZE_MB * 1024 * 1024,
          })
        } catch (err) {
          logError({
            message: "[DocsVideoUpload] Failed to initiate multipart upload",
            error: err,
            attributes: { fileName: body.fileName },
          })
          return json({ error: "Upload failed" }, { status: 500 })
        }
      },
      PUT: async ({ request }) => {
        const auth = await requireDocsVideoUploadAuth()
        if (!auth.ok) return auth.response

        const partNumber = Number(
          new URL(request.url).searchParams.get("partNumber"),
        )
        if (!Number.isInteger(partNumber) || partNumber < 1) {
          return json({ error: "partNumber is required" }, { status: 400 })
        }

        if (!request.body) {
          return json({ error: "No upload body provided" }, { status: 400 })
        }

        const uploadPayload = await verifyUploadToken(
          request.headers.get(UPLOAD_TOKEN_HEADER),
          auth.session,
        )
        if (!uploadPayload) {
          return json({ error: "Invalid upload token" }, { status: 400 })
        }

        const expectedPartSize = getExpectedPartSize(
          uploadPayload.fileSize,
          partNumber,
        )
        if (!expectedPartSize) {
          return json({ error: "Invalid part number" }, { status: 400 })
        }

        const contentLength = Number(request.headers.get("Content-Length"))
        if (!Number.isFinite(contentLength) || contentLength <= 0) {
          return json(
            { error: "Upload part size is required" },
            { status: 400 },
          )
        }

        if (contentLength !== expectedPartSize) {
          return json(
            { error: "Upload part size does not match expected size" },
            { status: 400 },
          )
        }

        try {
          const multipartUpload = env.R2_BUCKET.resumeMultipartUpload(
            uploadPayload.key,
            uploadPayload.uploadId,
          )
          const uploadedPart = await multipartUpload.uploadPart(
            partNumber,
            request.body,
          )

          return json({ ...uploadedPart, size: contentLength })
        } catch (err) {
          logError({
            message: "[DocsVideoUpload] Multipart part upload failed",
            error: err,
            attributes: { uploadId: uploadPayload.uploadId, partNumber },
          })
          return json({ error: "Upload failed" }, { status: 500 })
        }
      },
      PATCH: async ({ request }) => {
        const auth = await requireDocsVideoUploadAuth()
        if (!auth.ok) return auth.response

        const body = await readJsonBody<CompleteBody>(request)
        const uploadPayload = await verifyUploadToken(
          body?.uploadToken,
          auth.session,
        )
        if (!uploadPayload) {
          return json({ error: "Invalid upload token" }, { status: 400 })
        }

        const uploadedParts = validateUploadedParts(body?.parts, uploadPayload)
        if (!uploadedParts.ok) {
          return json({ error: uploadedParts.error }, { status: 400 })
        }

        try {
          const multipartUpload = env.R2_BUCKET.resumeMultipartUpload(
            uploadPayload.key,
            uploadPayload.uploadId,
          )
          await multipartUpload.complete(toR2UploadedParts(uploadedParts.parts))

          addRequestContextAttribute("uploadKey", uploadPayload.key)
          logInfo({
            message: "[DocsVideoUpload] Multipart upload completed",
            attributes: {
              key: uploadPayload.key,
              fileSize: uploadPayload.fileSize,
            },
          })

          return json({
            url: buildPublicUrl(uploadPayload.key),
            key: uploadPayload.key,
            originalFilename: uploadPayload.originalFilename,
            fileSize: uploadPayload.fileSize,
            mimeType: uploadPayload.contentType,
          })
        } catch (err) {
          logError({
            message: "[DocsVideoUpload] Multipart completion failed",
            error: err,
            attributes: { uploadId: uploadPayload.uploadId },
          })
          return json({ error: "Upload failed" }, { status: 500 })
        }
      },
      DELETE: async ({ request }) => {
        const auth = await requireDocsVideoUploadAuth()
        if (!auth.ok) return auth.response

        const uploadPayload = await verifyUploadToken(
          request.headers.get(UPLOAD_TOKEN_HEADER),
          auth.session,
        )
        if (!uploadPayload) {
          return json({ ok: true })
        }

        try {
          const multipartUpload = env.R2_BUCKET.resumeMultipartUpload(
            uploadPayload.key,
            uploadPayload.uploadId,
          )
          await multipartUpload.abort()
        } catch (err) {
          logWarning({
            message: "[DocsVideoUpload] Multipart abort failed",
            attributes: {
              uploadId: uploadPayload.uploadId,
              error: String(err),
            },
          })
        }

        return json({ ok: true })
      },
    },
  },
})
