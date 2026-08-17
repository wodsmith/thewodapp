import { beforeEach, describe, expect, it, vi } from "vitest"

const mockPublicR2Put = vi.hoisted(() => vi.fn())
const mockPrivateR2Put = vi.hoisted(() => vi.fn())
const mockPrivateR2Delete = vi.hoisted(() => vi.fn())
const mockGetSessionFromCookie = vi.hoisted(() => vi.fn())
const mockCheckUploadAuthorization = vi.hoisted(() => vi.fn())

vi.mock("cloudflare:workers", () => ({
  env: {
    R2_BUCKET: {
      put: (...args: unknown[]) => mockPublicR2Put(...args),
    },
    R2_DOWNLOADS_BUCKET: {
      put: (...args: unknown[]) => mockPrivateR2Put(...args),
      delete: (...args: unknown[]) => mockPrivateR2Delete(...args),
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

import { DOCS_VIDEO_MAX_SIZE_MB } from "@/lib/upload-limits"
import { Route } from "@/routes/api/upload"

const routeConfig = Route as unknown as {
  server: {
    handlers: {
      POST: (args: { request: Request }) => Promise<Response>
      DELETE: (args: { request: Request }) => Promise<Response>
    }
  }
}

function buildUploadRequest(
  file: File,
  purpose: string,
  entityId: string | null = null,
) {
  return {
    formData: vi.fn(async () => ({
      get: (name: string) => {
        if (name === "file") return file
        if (name === "purpose") return purpose
        if (name === "entityId") return entityId
        return null
      },
    })),
  } as unknown as Request
}

async function callUpload(
  file: File,
  purpose: string,
  entityId: string | null = null,
) {
  return routeConfig.server.handlers.POST({
    request: buildUploadRequest(file, purpose, entityId),
  })
}

function createFileLike({
  name,
  size,
  type,
}: {
  name: string
  size: number
  type: string
}) {
  return {
    name,
    size,
    type,
    arrayBuffer: vi.fn(),
    stream: vi.fn(),
  } as unknown as File
}

describe("upload API route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSessionFromCookie.mockResolvedValue({
      user: { id: "user-admin", role: "admin" },
    })
    mockCheckUploadAuthorization.mockResolvedValue({ authorized: true })
    mockPublicR2Put.mockResolvedValue(undefined)
    mockPrivateR2Put.mockResolvedValue(undefined)
    mockPrivateR2Delete.mockResolvedValue(undefined)
  })

  it("streams docs-video uploads to R2 without a second arrayBuffer copy", async () => {
    // @lat: [[route-docs#Video storage#Streams docs-video without second buffer]]
    const file = createFileLike({
      name: "training.mp4",
      size: 1024,
      type: "video/mp4",
    })
    const uploadStream = { stream: true }
    const arrayBufferSpy = vi
      .mocked(file.arrayBuffer)
      .mockRejectedValue(new Error("docs-video should not buffer"))
    const streamSpy = vi
      .mocked(file.stream)
      .mockReturnValue(uploadStream as never)

    const response = await callUpload(file, "docs-video")

    expect(response.status).toBe(200)
    expect(arrayBufferSpy).not.toHaveBeenCalled()
    expect(streamSpy).toHaveBeenCalledTimes(1)
    expect(mockPublicR2Put).toHaveBeenCalledTimes(1)
    expect(mockPublicR2Put.mock.calls[0][0]).toMatch(
      /^docs\/videos\/user-admin\/\d+\.mp4$/,
    )
    expect(mockPublicR2Put.mock.calls[0][1]).toBe(uploadStream)
  })

  it("keeps non-video upload purposes on the existing buffered R2 path", async () => {
    // @lat: [[route-docs#Video storage#Preserves non-video buffered uploads]]
    const file = createFileLike({
      name: "profile.png",
      size: 1024,
      type: "image/png",
    })
    const expectedBody = new ArrayBuffer(5)
    const arrayBufferSpy = vi
      .mocked(file.arrayBuffer)
      .mockResolvedValue(expectedBody)
    const streamSpy = vi.mocked(file.stream)

    const response = await callUpload(file, "competition-profile")

    expect(response.status).toBe(200)
    expect(arrayBufferSpy).toHaveBeenCalledTimes(1)
    expect(streamSpy).not.toHaveBeenCalled()
    expect(mockPublicR2Put).toHaveBeenCalledTimes(1)
    expect(mockPublicR2Put.mock.calls[0][1]).toBe(expectedBody)
  })

  // @lat: [[commerce#Downloadable Competition Products#Private file delivery]]
  it("uses unguessable object keys for purchase-gated PDFs", async () => {
    const file = createFileLike({
      name: "standards.pdf",
      size: 1024,
      type: "application/pdf",
    })
    vi.mocked(file.arrayBuffer).mockResolvedValue(new ArrayBuffer(5))

    const response = await callUpload(
      file,
      "competition-download",
      "competition-1",
    )
    const data = (await response.json()) as { key: string; url?: string }

    expect(response.status).toBe(200)
    expect(mockPrivateR2Put.mock.calls[0][0]).toMatch(
      /^competitions\/product-downloads\/competition-1\/[0-9a-f-]{36}\.pdf$/,
    )
    expect(mockPublicR2Put).not.toHaveBeenCalled()
    expect(data.url).toBeUndefined()
  })

  it("requires a competition ID for gated download uploads", async () => {
    const file = createFileLike({
      name: "standards.pdf",
      size: 1024,
      type: "application/pdf",
    })

    const response = await callUpload(file, "competition-download")
    const data = (await response.json()) as { error: string }

    expect(response.status).toBe(400)
    expect(data.error).toBe(
      "Competition ID is required for product downloads",
    )
    expect(mockCheckUploadAuthorization).not.toHaveBeenCalled()
    expect(mockPrivateR2Put).not.toHaveBeenCalled()
  })

  it("deletes an unsaved competition download after ownership validation", async () => {
    const key =
      "competitions/product-downloads/competition-1/00000000-0000-4000-8000-000000000000.pdf"
    const response = await routeConfig.server.handlers.DELETE({
      request: new Request("https://wodsmith.test/api/upload", {
        method: "DELETE",
        body: JSON.stringify({
          purpose: "competition-download",
          entityId: "competition-1",
          key,
        }),
      }),
    })

    expect(response.status).toBe(200)
    expect(mockCheckUploadAuthorization).toHaveBeenCalledWith(
      "competition-download",
      "competition-1",
      "user-admin",
    )
    expect(mockPrivateR2Delete).toHaveBeenCalledWith(key)
  })

  it("rejects docs-video uploads above the demo-safe cap before R2 writes", async () => {
    // @lat: [[route-docs#Video storage#Rejects docs-video above demo-safe cap]]
    const file = createFileLike({
      name: "oversized.mp4",
      size: (DOCS_VIDEO_MAX_SIZE_MB + 1) * 1024 * 1024,
      type: "video/mp4",
    })

    const response = await callUpload(file, "docs-video")
    const data = (await response.json()) as { error: string }

    expect(response.status).toBe(400)
    expect(data.error).toBe(
      `File too large. Maximum size is ${DOCS_VIDEO_MAX_SIZE_MB}MB`,
    )
    expect(mockPublicR2Put).not.toHaveBeenCalled()
    expect(mockPrivateR2Put).not.toHaveBeenCalled()
  })
})
