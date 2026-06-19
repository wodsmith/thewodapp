import { beforeEach, describe, expect, it, vi } from "vitest"

const mockR2Put = vi.hoisted(() => vi.fn())
const mockGetSessionFromCookie = vi.hoisted(() => vi.fn())
const mockCheckUploadAuthorization = vi.hoisted(() => vi.fn())

vi.mock("cloudflare:workers", () => ({
  env: {
    R2_BUCKET: {
      put: (...args: unknown[]) => mockR2Put(...args),
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
    }
  }
}

function buildUploadRequest(file: File, purpose: string) {
  return {
    formData: vi.fn(async () => ({
      get: (name: string) => {
        if (name === "file") return file
        if (name === "purpose") return purpose
        if (name === "entityId") return null
        return null
      },
    })),
  } as unknown as Request
}

async function callUpload(file: File, purpose: string) {
  return routeConfig.server.handlers.POST({
    request: buildUploadRequest(file, purpose),
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
    mockR2Put.mockResolvedValue(undefined)
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
    expect(mockR2Put).toHaveBeenCalledTimes(1)
    expect(mockR2Put.mock.calls[0][0]).toMatch(
      /^docs\/videos\/user-admin\/\d+\.mp4$/,
    )
    expect(mockR2Put.mock.calls[0][1]).toBe(uploadStream)
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
    expect(mockR2Put).toHaveBeenCalledTimes(1)
    expect(mockR2Put.mock.calls[0][1]).toBe(expectedBody)
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
    expect(mockR2Put).not.toHaveBeenCalled()
  })
})
