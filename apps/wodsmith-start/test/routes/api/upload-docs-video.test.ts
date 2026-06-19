import { beforeEach, describe, expect, it, vi } from "vitest"

const mockKvGet = vi.hoisted(() => vi.fn())
const mockKvPut = vi.hoisted(() => vi.fn())
const mockKvDelete = vi.hoisted(() => vi.fn())
const mockCreateMultipartUpload = vi.hoisted(() => vi.fn())
const mockResumeMultipartUpload = vi.hoisted(() => vi.fn())
const mockUploadPart = vi.hoisted(() => vi.fn())
const mockComplete = vi.hoisted(() => vi.fn())
const mockAbort = vi.hoisted(() => vi.fn())
const mockGetSessionFromCookie = vi.hoisted(() => vi.fn())
const mockCheckUploadAuthorization = vi.hoisted(() => vi.fn())

vi.mock("cloudflare:workers", () => ({
  env: {
    KV_SESSION: {
      get: (...args: unknown[]) => mockKvGet(...args),
      put: (...args: unknown[]) => mockKvPut(...args),
      delete: (...args: unknown[]) => mockKvDelete(...args),
    },
    R2_BUCKET: {
      createMultipartUpload: (...args: unknown[]) =>
        mockCreateMultipartUpload(...args),
      resumeMultipartUpload: (...args: unknown[]) =>
        mockResumeMultipartUpload(...args),
    },
    R2_PUBLIC_URL: "https://uploads.wodsmith.test",
  },
}))

vi.mock("@/utils/auth", () => ({
  getSessionFromCookie: (...args: unknown[]) =>
    mockGetSessionFromCookie(...args),
}))

vi.mock("@/server/upload-authorization", () => ({
  checkUploadAuthorization: (...args: unknown[]) =>
    mockCheckUploadAuthorization(...args),
}))

vi.mock("@/lib/logging", () => ({
  addRequestContextAttribute: vi.fn(),
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarning: vi.fn(),
  updateRequestContext: vi.fn(),
}))

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: unknown) => config,
}))

vi.mock("@tanstack/react-start", () => ({
  json: (data: unknown, init?: { status?: number }) =>
    new Response(JSON.stringify(data), {
      status: init?.status ?? 200,
      headers: { "Content-Type": "application/json" },
    }),
}))

import {
  DOCS_VIDEO_ALLOWED_TYPE_LABEL,
  DOCS_VIDEO_MULTIPART_CHUNK_SIZE_BYTES,
  DOCS_VIDEO_MULTIPART_MAX_SIZE_MB,
} from "@/lib/upload-limits"
import { Route } from "@/routes/api/upload/docs-video"

const routeConfig = Route as unknown as {
  server: {
    handlers: {
      POST: (args: { request: Request }) => Promise<Response>
      PUT: (args: { request: Request }) => Promise<Response>
      PATCH: (args: { request: Request }) => Promise<Response>
      DELETE: (args: { request: Request }) => Promise<Response>
    }
  }
}

interface InitiateResponse {
  uploadId: string
  uploadToken: string
  key: string
  chunkSize: number
}

function jsonRequest(method: string, body: unknown) {
  return new Request("https://wodsmith.test/api/upload/docs-video", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

async function initiateUpload({
  fileName = "training.mp4",
  fileSize = 64 * 1024 * 1024,
  contentType = "video/mp4",
}: {
  fileName?: string
  fileSize?: number
  contentType?: string
} = {}) {
  const response = await routeConfig.server.handlers.POST({
    request: jsonRequest("POST", { fileName, fileSize, contentType }),
  })

  return {
    response,
    data: (await response.json()) as InitiateResponse & { error?: string },
  }
}

function partRequest(uploadToken: string, partNumber: number, size: number) {
  return new Request(
    `https://wodsmith.test/api/upload/docs-video?partNumber=${partNumber}`,
    {
      method: "PUT",
      body: new Blob(["chunk"], { type: "video/mp4" }),
      headers: {
        "Content-Length": String(size),
        "X-Docs-Video-Upload-Token": uploadToken,
      },
    },
  )
}

describe("docs video multipart upload route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSessionFromCookie.mockResolvedValue({
      id: "session-123",
      userId: "user-admin",
      user: { id: "user-admin", role: "admin" },
    })
    mockCheckUploadAuthorization.mockResolvedValue({ authorized: true })
    mockCreateMultipartUpload.mockResolvedValue({
      key: "docs/videos/user-admin/video.mp4",
      uploadId: "upload-123",
    })
    mockResumeMultipartUpload.mockReturnValue({
      uploadPart: mockUploadPart,
      complete: mockComplete,
      abort: mockAbort,
    })
    mockUploadPart.mockResolvedValue({ partNumber: 1, etag: "etag-1" })
    mockComplete.mockResolvedValue({ key: "docs/videos/user-admin/video.mp4" })
    mockAbort.mockResolvedValue(undefined)
  })

  it("initiates an authenticated multipart docs-video upload without reading formData", async () => {
    // @lat: [[route-docs#Video storage#Initiates large multipart docs-video uploads]]
    const request = jsonRequest("POST", {
      fileName: "training.mp4",
      fileSize: 64 * 1024 * 1024,
      contentType: "video/mp4",
    }) as Request & { formData: ReturnType<typeof vi.fn> }
    request.formData = vi.fn()

    const response = await routeConfig.server.handlers.POST({ request })
    const data = (await response.json()) as InitiateResponse

    expect(response.status).toBe(200)
    expect(request.formData).not.toHaveBeenCalled()
    expect(mockCreateMultipartUpload).toHaveBeenCalledTimes(1)
    expect(mockCreateMultipartUpload.mock.calls[0][0]).toMatch(
      /^docs\/videos\/user-admin\/\d+-[a-f0-9-]+\.mp4$/,
    )
    expect(mockCreateMultipartUpload.mock.calls[0][1]).toMatchObject({
      httpMetadata: { contentType: "video/mp4" },
      customMetadata: {
        uploadedBy: "user-admin",
        purpose: "docs-video",
        originalFilename: "training.mp4",
      },
    })
    expect(mockKvPut).not.toHaveBeenCalled()
    expect(data.uploadId).toBe("upload-123")
    expect(data.uploadToken).toEqual(expect.any(String))
    expect(data.key).toMatch(/^docs\/videos\/user-admin\//)
    expect(data.chunkSize).toBe(DOCS_VIDEO_MULTIPART_CHUNK_SIZE_BYTES)
  })

  it("streams raw PUT request bodies into R2 multipart parts", async () => {
    // @lat: [[route-docs#Video storage#Streams raw multipart parts to R2]]
    const { data: initiateData } = await initiateUpload({ fileSize: 5 })
    const request = partRequest(initiateData.uploadToken, 1, 5)
    const expectedBody = request.body

    const response = await routeConfig.server.handlers.PUT({ request })
    const data = (await response.json()) as {
      partNumber: number
      etag: string
      size: number
    }

    expect(response.status).toBe(200)
    expect(mockResumeMultipartUpload).toHaveBeenCalledWith(
      initiateData.key,
      "upload-123",
    )
    expect(mockUploadPart).toHaveBeenCalledWith(1, expectedBody)
    expect(data).toEqual({ partNumber: 1, etag: "etag-1", size: 5 })
    expect(mockKvGet).not.toHaveBeenCalled()
    expect(mockKvPut).not.toHaveBeenCalled()
  })

  it("rejects part uploads whose size does not match the initiated chunk plan", async () => {
    const { data: initiateData } = await initiateUpload({ fileSize: 5 })

    const response = await routeConfig.server.handlers.PUT({
      request: partRequest(initiateData.uploadToken, 1, 8),
    })
    const data = (await response.json()) as { error: string }

    expect(response.status).toBe(400)
    expect(data.error).toBe("Upload part size does not match expected size")
    expect(mockUploadPart).not.toHaveBeenCalled()
  })

  it("rejects oversized docs-video initiation before creating R2 uploads", async () => {
    const { response, data } = await initiateUpload({
      fileName: "huge.mp4",
      fileSize: (DOCS_VIDEO_MULTIPART_MAX_SIZE_MB + 1) * 1024 * 1024,
      contentType: "video/mp4",
    })

    expect(response.status).toBe(400)
    expect(data.error).toBe(
      `File too large. Maximum size is ${DOCS_VIDEO_MULTIPART_MAX_SIZE_MB}MB`,
    )
    expect(mockCreateMultipartUpload).not.toHaveBeenCalled()
  })

  it("rejects invalid video types before creating R2 uploads", async () => {
    const { response, data } = await initiateUpload({
      fileName: "training.avi",
      contentType: "video/x-msvideo",
    })

    expect(response.status).toBe(400)
    expect(data.error).toBe(
      `Invalid file type. Allowed: ${DOCS_VIDEO_ALLOWED_TYPE_LABEL}`,
    )
    expect(mockCreateMultipartUpload).not.toHaveBeenCalled()
  })

  it("completes uploaded parts and returns the public video URL", async () => {
    // @lat: [[route-docs#Video storage#Completes multipart docs-video uploads]]
    const fileSize = DOCS_VIDEO_MULTIPART_CHUNK_SIZE_BYTES + 5
    const { data: initiateData } = await initiateUpload({ fileSize })

    const response = await routeConfig.server.handlers.PATCH({
      request: jsonRequest("PATCH", {
        uploadToken: initiateData.uploadToken,
        parts: [
          { partNumber: 2, etag: "etag-2", size: 5 },
          {
            partNumber: 1,
            etag: "etag-1",
            size: DOCS_VIDEO_MULTIPART_CHUNK_SIZE_BYTES,
          },
        ],
      }),
    })
    const data = (await response.json()) as { url: string; key: string }

    expect(response.status).toBe(200)
    expect(mockComplete).toHaveBeenCalledWith([
      { partNumber: 1, etag: "etag-1" },
      { partNumber: 2, etag: "etag-2" },
    ])
    expect(mockKvDelete).not.toHaveBeenCalled()
    expect(data).toMatchObject({
      url: `https://uploads.wodsmith.test/${initiateData.key}`,
      key: initiateData.key,
    })
  })

  it("rejects incomplete multipart uploads before completing R2", async () => {
    // @lat: [[route-docs#Video storage#Rejects incomplete multipart docs-video uploads]]
    const fileSize = DOCS_VIDEO_MULTIPART_CHUNK_SIZE_BYTES * 2
    const { data: initiateData } = await initiateUpload({ fileSize })

    const response = await routeConfig.server.handlers.PATCH({
      request: jsonRequest("PATCH", {
        uploadToken: initiateData.uploadToken,
        parts: [
          {
            partNumber: 1,
            etag: "etag-1",
            size: DOCS_VIDEO_MULTIPART_CHUNK_SIZE_BYTES,
          },
          {
            partNumber: 3,
            etag: "etag-3",
            size: DOCS_VIDEO_MULTIPART_CHUNK_SIZE_BYTES,
          },
        ],
      }),
    })
    const data = (await response.json()) as { error: string }

    expect(response.status).toBe(400)
    expect(data.error).toBe("Uploaded parts do not match declared file size")
    expect(mockComplete).not.toHaveBeenCalled()
    expect(mockKvDelete).not.toHaveBeenCalled()
  })

  it("aborts multipart uploads without reading mutable KV metadata", async () => {
    // @lat: [[route-docs#Video storage#Aborts multipart docs-video uploads]]
    const { data: initiateData } = await initiateUpload()

    const response = await routeConfig.server.handlers.DELETE({
      request: new Request("https://wodsmith.test/api/upload/docs-video", {
        method: "DELETE",
        headers: { "X-Docs-Video-Upload-Token": initiateData.uploadToken },
      }),
    })
    const data = (await response.json()) as { ok: boolean }

    expect(response.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(mockAbort).toHaveBeenCalledTimes(1)
    expect(mockKvGet).not.toHaveBeenCalled()
    expect(mockKvDelete).not.toHaveBeenCalled()
  })

  it("requires docs-video upload authorization for every multipart request", async () => {
    mockCheckUploadAuthorization.mockResolvedValue({
      authorized: false,
      error: "Not authorized to upload documentation videos",
    })

    const response = await routeConfig.server.handlers.POST({
      request: jsonRequest("POST", {
        fileName: "training.mp4",
        fileSize: 64 * 1024 * 1024,
        contentType: "video/mp4",
      }),
    })

    expect(response.status).toBe(403)
    expect(mockCreateMultipartUpload).not.toHaveBeenCalled()
  })
})
