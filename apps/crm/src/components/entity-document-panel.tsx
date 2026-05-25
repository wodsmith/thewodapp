import { useServerFn } from "@tanstack/react-start"
import { Download, Eye, Loader2, Trash2, Upload, X } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import {
  deleteDocumentForEntryFn,
  getDocumentDownloadUrlForEntryFn,
  listDocumentsForEntryFn,
  uploadDocumentForEntryFn,
} from "@/server-fns/crm"

type CrmDocument = {
  id: string
  title: string
  filePath: string
  createdAt: string | null
  updatedAt: string | null
}

type DocumentPreview = {
  documentId: string
  title: string
  content: string
}

const PREVIEWABLE_EXTENSIONS = new Set(["csv", "json", "md", "markdown", "txt", "text"])
const PREVIEWABLE_CONTENT_TYPES = [
  "text/",
  "application/csv",
  "application/json",
  "application/markdown",
  "application/x-markdown",
]

export function EntityDocumentPanel({
  entryId,
  label,
}: {
  entryId: string
  label: string
}) {
  const [documents, setDocuments] = useState<CrmDocument[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [documentTitle, setDocumentTitle] = useState("")
  const [uploading, setUploading] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [preview, setPreview] = useState<DocumentPreview | null>(null)
  const [previewingId, setPreviewingId] = useState<string | null>(null)
  const [error, setError] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const listFn = useServerFn(listDocumentsForEntryFn)
  const uploadFn = useServerFn(uploadDocumentForEntryFn)
  const deleteFn = useServerFn(deleteDocumentForEntryFn)
  const downloadFn = useServerFn(getDocumentDownloadUrlForEntryFn)

  const loadDocuments = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await listFn({ data: { entryId } })
      setDocuments(
        result.map((document) => ({
          ...document,
          title: document.title ?? "Untitled",
        })),
      )
    } finally {
      setIsLoading(false)
    }
  }, [entryId, listFn])

  useEffect(() => {
    void loadDocuments()
  }, [loadDocuments])

  const readFileAsBase64 = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    let binary = ""
    for (let index = 0; index < bytes.length; index += 1) {
      binary += String.fromCharCode(bytes[index])
    }
    return btoa(binary)
  }

  const handleUpload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedFile) {
      setError("Select a file first")
      return
    }

    setError("")
    setUploading(true)

    try {
      const fileBase64 = await readFileAsBase64(selectedFile)
      await uploadFn({
        data: {
          entryId,
          fileName: selectedFile.name,
          fileBase64,
          fileSize: selectedFile.size,
          contentType: selectedFile.type || "application/octet-stream",
          title: documentTitle.trim() || undefined,
        },
      })
      setSelectedFile(null)
      setDocumentTitle("")
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
      await loadDocuments()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (documentId: string) => {
    setRemovingId(documentId)
    try {
      await deleteFn({ data: { documentId, entryId } })
      setDocuments((current) => current.filter((doc) => doc.id !== documentId))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed")
    } finally {
      setRemovingId(null)
    }
  }

  const handleDownload = async (documentId: string, fileName: string) => {
    const result = await downloadFn({ data: { documentId } })
    const binaryString = atob(result.base64)
    const bytes = new Uint8Array(binaryString.length)
    for (let index = 0; index < binaryString.length; index += 1) {
      bytes[index] = binaryString.charCodeAt(index)
    }
    const blob = new Blob([bytes], { type: result.contentType })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = fileName
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const handlePreview = async (documentId: string, fileName: string) => {
    setError("")
    setPreviewingId(documentId)
    try {
      const result = await downloadFn({ data: { documentId } })
      if (!isPreviewableFile(fileName, result.contentType)) {
        setError("This file type cannot be previewed.")
        return
      }

      const binaryString = atob(result.base64)
      const bytes = new Uint8Array(binaryString.length)
      for (let index = 0; index < binaryString.length; index += 1) {
        bytes[index] = binaryString.charCodeAt(index)
      }

      setPreview({
        documentId,
        title: fileName,
        content: new TextDecoder().decode(bytes),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed")
    } finally {
      setPreviewingId(null)
    }
  }

  return (
    <section className="rounded-lg border border-border">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">Documents for {label}</h3>
        <span className="text-xs text-muted-foreground">R2-backed</span>
      </div>

      <form
        onSubmit={handleUpload}
        className="space-y-3 border-b border-border px-4 py-3"
      >
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Attach a file
        </p>
        <div className="flex flex-col gap-2 md:flex-row md:items-end">
          <label className="space-y-1 text-sm font-medium md:w-1/3">
            <span className="sr-only">Title</span>
            <input
              value={documentTitle}
              onChange={(event) => setDocumentTitle(event.target.value)}
              placeholder="Optional document label"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="space-y-1 text-sm font-medium md:flex-1">
            <span className="sr-only">File</span>
            <input
              ref={fileInputRef}
              type="file"
              onChange={(event) =>
                setSelectedFile(event.target.files?.[0] ?? null)
              }
              className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm outline-none"
              required
            />
          </label>
          <button
            type="submit"
            disabled={uploading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Upload
              </>
            )}
          </button>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </form>

      <div className="divide-y divide-border">
        {isLoading ? (
          <div className="flex items-center gap-2 px-4 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading documents...
          </div>
        ) : documents.length > 0 ? (
          documents.map((document) => (
            <div
              key={document.id}
              className="grid gap-2 px-4 py-3 md:grid-cols-[1fr_auto_auto_auto] md:items-center"
            >
              <div>
                <p className="text-sm font-medium">{document.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {document.filePath}
                </p>
              </div>
              {isPreviewableFile(document.title, null) ||
              isPreviewableFile(document.filePath, null) ? (
                <button
                  type="button"
                  onClick={() =>
                    void handlePreview(document.id, document.title)
                  }
                  disabled={previewingId === document.id}
                  className="inline-flex h-9 items-center justify-center gap-1 rounded-md border border-input px-3 text-sm text-muted-foreground hover:bg-accent disabled:opacity-50"
                >
                  {previewingId === document.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                  View
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void handleDownload(document.id, document.title)}
                className="inline-flex h-9 items-center justify-center gap-1 rounded-md border border-input px-3 text-sm text-muted-foreground hover:bg-accent"
              >
                <Download className="h-4 w-4" />
                Download
              </button>
              <button
                type="button"
                onClick={() => void handleDelete(document.id)}
                disabled={removingId === document.id}
                className="inline-flex h-9 items-center justify-center gap-1 rounded-md border border-destructive/30 text-destructive hover:bg-destructive/10"
              >
                {removingId === document.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                {removingId === document.id ? "Removing..." : "Remove"}
              </button>
            </div>
          ))
        ) : (
          <p className="px-4 py-4 text-sm text-muted-foreground">
            No documents yet.
          </p>
        )}
      </div>
      {preview ? (
        <div className="border-t border-border">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <p className="truncate text-sm font-medium">{preview.title}</p>
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-input text-muted-foreground hover:bg-accent"
              aria-label="Close preview"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <pre className="max-h-96 overflow-auto border-t border-border bg-secondary/40 p-4 text-xs leading-5 text-foreground">
            {preview.content}
          </pre>
        </div>
      ) : null}
    </section>
  )
}

function isPreviewableFile(fileName: string, contentType: string | null) {
  const extension = fileName.split(".").pop()?.toLowerCase()
  if (extension && PREVIEWABLE_EXTENSIONS.has(extension)) return true
  if (!contentType) return false
  return PREVIEWABLE_CONTENT_TYPES.some((type) =>
    contentType.toLowerCase().startsWith(type),
  )
}
