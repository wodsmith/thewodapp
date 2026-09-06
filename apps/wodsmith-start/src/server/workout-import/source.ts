import {
  IMPORT_LIMITS,
  readBoundedBody,
  WorkoutImportRuntimeError,
} from "./limits"

/** Check bytes before decoding; never accept SVG, URLs or MIME declarations alone. */
export function imageMime(
  bytes: Uint8Array,
): "image/png" | "image/jpeg" | "image/webp" {
  if (
    bytes.length >= 24 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)
  )
    return "image/png"
  if (
    bytes.length >= 4 &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255
  )
    return "image/jpeg"
  if (
    bytes.length >= 16 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  )
    return "image/webp"
  throw new WorkoutImportRuntimeError("invalid_source", 415)
}

export function sourceKey(importId: string) {
  return `sources/${importId}/image`
}

/** Decode and re-encode through Images to reject corrupt data and remove metadata. */
export async function normalizeImportImage(
  request: Request,
  images: ImagesBinding,
): Promise<Uint8Array> {
  const bytes = await readBoundedBody(request.body, IMPORT_LIMITS.sourceBytes)
  const mime = imageMime(bytes)
  if (request.headers.get("content-type")?.split(";")[0] !== mime)
    throw new WorkoutImportRuntimeError("invalid_source", 415)
  const stream = () => new Blob([new Uint8Array(bytes)]).stream()
  try {
    const info = await images.info(stream())
    if (
      !("width" in info) ||
      !info.width ||
      !info.height ||
      info.width * info.height > IMPORT_LIMITS.sourcePixels
    )
      throw new WorkoutImportRuntimeError("invalid_source", 413)
    // PNG output strips metadata and preserves screenshot text without lossy downscaling.
    const output = await images.input(stream()).output({ format: "image/png" })
    return await readBoundedBody(output.image(), IMPORT_LIMITS.sourceBytes)
  } catch (error) {
    if (error instanceof WorkoutImportRuntimeError) throw error
    throw new WorkoutImportRuntimeError("invalid_source", 422)
  }
}

export async function loadImportImage(
  bucket: R2Bucket,
  importId: string,
): Promise<string> {
  const object = await bucket.get(sourceKey(importId))
  if (!object || Number(object.customMetadata?.expiresAt ?? 0) <= Date.now())
    throw new WorkoutImportRuntimeError("source_expired", 410)
  const bytes = await readBoundedBody(object.body, IMPORT_LIMITS.sourceBytes)
  let binary = ""
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192))
  return btoa(binary)
}
