export const DOCS_VIDEO_MAX_SIZE_MB = 32
export const DOCS_VIDEO_MULTIPART_MAX_SIZE_MB = 100
export const DOCS_VIDEO_MULTIPART_CHUNK_SIZE_BYTES = 8 * 1024 * 1024
export const DOCS_VIDEO_ALLOWED_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
] as const
export const DOCS_VIDEO_ALLOWED_TYPE_LABEL = "MP4, WebM, MOV"
export const DOCS_VIDEO_PATH_PREFIX = "docs/videos"
