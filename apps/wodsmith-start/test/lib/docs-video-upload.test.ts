import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  shouldUseDocsVideoMultipartUpload,
  uploadDocsVideoFile,
} from "@/lib/docs-video-upload"
import { DOCS_VIDEO_MAX_SIZE_MB } from "@/lib/upload-limits"

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function createFileLike(size: number) {
  return {
    name: "training.mp4",
    size,
    type: "video/mp4",
    slice: vi.fn(() => new Blob(["chunk"], { type: "video/mp4" })),
  } as unknown as File
}

describe("docs video upload client", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("keeps docs videos up to the fallback cap on the compatibility upload route", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ url: "https://uploads/video.mp4" }))
    const file = createFileLike(DOCS_VIDEO_MAX_SIZE_MB * 1024 * 1024)

    const result = await uploadDocsVideoFile(file)

    expect(result.url).toBe("https://uploads/video.mp4")
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe("/api/upload")
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "POST" })
    expect(fetchMock.mock.calls[0][1]?.body).toBeInstanceOf(FormData)
  })

  it("uses multipart route calls for docs videos above the fallback cap", async () => {
    const file = createFileLike(DOCS_VIDEO_MAX_SIZE_MB * 1024 * 1024 + 1)
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({
          uploadId: "upload-123",
          uploadToken: "signed-token",
          key: "docs/videos/user/video.mp4",
          chunkSize: 64 * 1024 * 1024,
          maxSizeBytes: 100 * 1024 * 1024,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ partNumber: 1, etag: "etag-1", size: file.size }),
      )
      .mockResolvedValueOnce(jsonResponse({ url: "https://uploads/video.mp4" }))

    const result = await uploadDocsVideoFile(file)

    expect(result.url).toBe("https://uploads/video.mp4")
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[0][0]).toBe("/api/upload/docs-video")
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "POST" })
    expect(fetchMock.mock.calls[1][0]).toBe(
      "/api/upload/docs-video?partNumber=1",
    )
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      method: "PUT",
      headers: { "X-Docs-Video-Upload-Token": "signed-token" },
    })
    expect(fetchMock.mock.calls[1][1]?.body).toBeInstanceOf(Blob)
    expect(fetchMock.mock.calls[2][0]).toBe("/api/upload/docs-video")
    expect(fetchMock.mock.calls[2][1]).toMatchObject({ method: "PATCH" })
    expect(JSON.parse(String(fetchMock.mock.calls[2][1]?.body))).toEqual({
      uploadToken: "signed-token",
      parts: [{ partNumber: 1, etag: "etag-1", size: file.size }],
    })
  })

  it("aborts the multipart upload when a part fails", async () => {
    const file = createFileLike(DOCS_VIDEO_MAX_SIZE_MB * 1024 * 1024 + 1)
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({
          uploadId: "upload-123",
          uploadToken: "signed-token",
          key: "docs/videos/user/video.mp4",
          chunkSize: 64 * 1024 * 1024,
          maxSizeBytes: 100 * 1024 * 1024,
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ error: "part failed" }, 500))
      .mockResolvedValueOnce(jsonResponse({ ok: true }))

    await expect(uploadDocsVideoFile(file)).rejects.toThrow("part failed")

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[2][0]).toBe("/api/upload/docs-video")
    expect(fetchMock.mock.calls[2][1]).toMatchObject({
      method: "DELETE",
      headers: { "X-Docs-Video-Upload-Token": "signed-token" },
    })
  })

  it("selects multipart only above the fallback cap", () => {
    expect(
      shouldUseDocsVideoMultipartUpload({
        size: DOCS_VIDEO_MAX_SIZE_MB * 1024 * 1024,
      } as File),
    ).toBe(false)
    expect(
      shouldUseDocsVideoMultipartUpload({
        size: DOCS_VIDEO_MAX_SIZE_MB * 1024 * 1024 + 1,
      } as File),
    ).toBe(true)
  })
})
