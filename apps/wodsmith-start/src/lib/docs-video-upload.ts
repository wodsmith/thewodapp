import {
  DOCS_VIDEO_MAX_SIZE_MB,
  DOCS_VIDEO_MULTIPART_CHUNK_SIZE_BYTES,
} from "@/lib/upload-limits"

export interface DocsVideoUploadResult {
  url: string
  key?: string
}

export interface DocsVideoMultipartInitiateResponse {
  uploadId: string
  uploadToken: string
  key: string
  chunkSize: number
  maxSizeBytes: number
}

export interface DocsVideoMultipartPartResponse {
  partNumber: number
  etag: string
  size: number
}

interface ApiErrorBody {
  error?: string
}

const SMALL_DOCS_VIDEO_MAX_BYTES = DOCS_VIDEO_MAX_SIZE_MB * 1024 * 1024

export function shouldUseDocsVideoMultipartUpload(file: Pick<File, "size">) {
  return file.size > SMALL_DOCS_VIDEO_MAX_BYTES
}

async function readJsonResponse<T>(response: Response): Promise<T | null> {
  return (await response.json().catch(() => null)) as T | null
}

function getApiError(data: ApiErrorBody | null, fallback: string) {
  return data?.error || fallback
}

async function uploadSmallDocsVideo(
  file: File,
): Promise<DocsVideoUploadResult> {
  const formData = new FormData()
  formData.append("file", file)
  formData.append("purpose", "docs-video")

  const response = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  })
  const data = await readJsonResponse<DocsVideoUploadResult & ApiErrorBody>(
    response,
  )

  if (!response.ok || !data?.url) {
    throw new Error(getApiError(data, "Upload failed"))
  }

  return data
}

async function abortMultipartUpload(uploadToken: string) {
  await fetch("/api/upload/docs-video", {
    method: "DELETE",
    headers: { "X-Docs-Video-Upload-Token": uploadToken },
  }).catch(() => undefined)
}

export async function uploadMultipartDocsVideo(
  file: File,
): Promise<DocsVideoUploadResult> {
  const initiateResponse = await fetch("/api/upload/docs-video", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      fileSize: file.size,
      contentType: file.type,
    }),
  })
  const initiateData = await readJsonResponse<
    DocsVideoMultipartInitiateResponse & ApiErrorBody
  >(initiateResponse)

  if (!initiateResponse.ok || !initiateData?.uploadToken) {
    throw new Error(getApiError(initiateData, "Upload failed"))
  }

  const uploadToken = initiateData.uploadToken
  const chunkSize =
    initiateData.chunkSize > 0
      ? initiateData.chunkSize
      : DOCS_VIDEO_MULTIPART_CHUNK_SIZE_BYTES
  const uploadedParts: DocsVideoMultipartPartResponse[] = []

  try {
    for (
      let start = 0, partNumber = 1;
      start < file.size;
      start += chunkSize, partNumber += 1
    ) {
      const chunk = file.slice(start, Math.min(start + chunkSize, file.size))
      const partResponse = await fetch(
        `/api/upload/docs-video?partNumber=${partNumber}`,
        {
          method: "PUT",
          headers: { "X-Docs-Video-Upload-Token": uploadToken },
          body: chunk,
        },
      )
      const partData = await readJsonResponse<
        DocsVideoMultipartPartResponse & ApiErrorBody
      >(partResponse)

      if (
        !partResponse.ok ||
        !partData?.etag ||
        !Number.isFinite(partData.size)
      ) {
        throw new Error(getApiError(partData, "Upload failed"))
      }
      uploadedParts.push(partData)
    }

    const completeResponse = await fetch("/api/upload/docs-video", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uploadToken, parts: uploadedParts }),
    })
    const completeData = await readJsonResponse<
      DocsVideoUploadResult & ApiErrorBody
    >(completeResponse)

    if (!completeResponse.ok || !completeData?.url) {
      throw new Error(getApiError(completeData, "Upload failed"))
    }

    return completeData
  } catch (error) {
    await abortMultipartUpload(uploadToken)
    throw error
  }
}

export async function uploadDocsVideoFile(
  file: File,
): Promise<DocsVideoUploadResult> {
  if (shouldUseDocsVideoMultipartUpload(file)) {
    return uploadMultipartDocsVideo(file)
  }

  return uploadSmallDocsVideo(file)
}
