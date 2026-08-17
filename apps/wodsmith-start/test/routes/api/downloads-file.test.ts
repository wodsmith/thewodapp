import { beforeEach, describe, expect, it, vi } from "vitest"

const mockGetSessionFromCookie = vi.hoisted(() => vi.fn())
const mockGetAuthorizedDownloadFile = vi.hoisted(() => vi.fn())
const mockR2Get = vi.hoisted(() => vi.fn())

vi.mock("@/utils/auth", () => ({
  getSessionFromCookie: () => mockGetSessionFromCookie(),
}))

vi.mock("@/server-fns/downloadable-product-fns", () => ({
  getAuthorizedDownloadFile: (...args: unknown[]) =>
    mockGetAuthorizedDownloadFile(...args),
}))

vi.mock("cloudflare:workers", () => ({
  env: {
    R2_DOWNLOADS_BUCKET: {
      get: (...args: unknown[]) => mockR2Get(...args),
    },
  },
}))

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: unknown) => config,
}))

import { Route } from "@/routes/api/downloads/$fileId"

const routeConfig = Route as unknown as {
  server: {
    handlers: {
      GET: (args: { params: { fileId: string } }) => Promise<Response>
    }
  }
}

describe("download file API", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // @lat: [[commerce#Downloadable Competition Products#Private file delivery]]
  it("requires authentication before looking up a file", async () => {
    mockGetSessionFromCookie.mockResolvedValue(null)

    const response = await routeConfig.server.handlers.GET({
      params: { fileId: "file-1" },
    })

    expect(response.status).toBe(401)
    expect(mockGetAuthorizedDownloadFile).not.toHaveBeenCalled()
  })

  it("does not reveal whether an unauthorized file exists", async () => {
    mockGetSessionFromCookie.mockResolvedValue({ userId: "user-1" })
    mockGetAuthorizedDownloadFile.mockResolvedValue(null)

    const response = await routeConfig.server.handlers.GET({
      params: { fileId: "file-1" },
    })

    expect(response.status).toBe(404)
    expect(mockR2Get).not.toHaveBeenCalled()
  })

  it("streams an authorized PDF with private download headers", async () => {
    mockGetSessionFromCookie.mockResolvedValue({ userId: "user-1" })
    mockGetAuthorizedDownloadFile.mockResolvedValue({
      r2Key: "private/file.pdf",
      originalFilename: "Benchmark's (Final)!.pdf",
      mimeType: "application/pdf",
    })
    mockR2Get.mockResolvedValue({ body: "pdf body" })

    const response = await routeConfig.server.handlers.GET({
      params: { fileId: "file-1" },
    })

    expect(response.status).toBe(200)
    expect(response.headers.get("Cache-Control")).toBe("private, no-store")
    expect(response.headers.get("Content-Disposition")).toContain(
      "Benchmark%27s%20%28Final%29%21.pdf",
    )
    expect(await response.text()).toBe("pdf body")
  })
})
