import { describe, expect, it, vi } from "vitest"
import { awaitImportResult, IMPORT_LIMITS, readBoundedBody } from "./limits"
import { imageMime, normalizeImportImage } from "./source"

const png = new Uint8Array([
  137,
  80,
  78,
  71,
  13,
  10,
  26,
  10,
  ...Array(16).fill(0),
])
describe("private source validation", () => {
  // @lat: [[workout-import-runtime#Already cancelled work]]
  it("observes provider rejection when cancellation happened before waiting", async () => {
    const controller = new AbortController()
    controller.abort("cancelled")
    await expect(
      awaitImportResult(
        Promise.reject(new Error("late provider failure")),
        controller,
      ),
    ).rejects.toThrow("cancelled")
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
  // @lat: [[workout-import-runtime#Bounded waiting]]
  it("ends local waiting when a provider never settles", async () => {
    const controller = new AbortController()
    const waiting = awaitImportResult(new Promise<never>(() => {}), controller)
    controller.abort("timeout")
    await expect(waiting).rejects.toThrow("timeout")
  })
  // @lat: [[workout-import-runtime#Source validation]]
  it("rejects spoofed bytes/MIME, decompression bombs and corrupt images before storage", async () => {
    expect(() =>
      imageMime(new TextEncoder().encode("<svg>image</svg>")),
    ).toThrow("invalid_source")
    const images = {
      info: vi
        .fn()
        .mockResolvedValue({ width: 6000, height: 6000, format: "image/png" }),
      input: vi.fn(),
    } as unknown as ImagesBinding
    const request = () =>
      new Request("https://app/source", {
        method: "PUT",
        headers: { "content-type": "image/png" },
        body: png,
      })
    await expect(normalizeImportImage(request(), images)).rejects.toThrow(
      "invalid_source",
    )
    expect(images.input).not.toHaveBeenCalled()
    vi.mocked(images.info).mockRejectedValue(new Error("decoder failed"))
    await expect(normalizeImportImage(request(), images)).rejects.toThrow(
      "invalid_source",
    )
    await expect(
      normalizeImportImage(
        new Request("https://app/source", {
          method: "PUT",
          headers: { "content-type": "image/jpeg" },
          body: png,
        }),
        images,
      ),
    ).rejects.toThrow("invalid_source")
  })

  // @lat: [[workout-import-runtime#Body bounds]]
  it("enforces actual bytes even when Content-Length is missing or false", async () => {
    const cancelled = vi.fn()
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new Uint8Array(IMPORT_LIMITS.sourceBytes + 1))
      },
      cancel: cancelled,
    })
    await expect(
      readBoundedBody(stream, IMPORT_LIMITS.sourceBytes),
    ).rejects.toThrow("invalid_source")
    expect(cancelled).toHaveBeenCalled()
  })
})
