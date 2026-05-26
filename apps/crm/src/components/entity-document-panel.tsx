import { useServerFn } from "@tanstack/react-start"
import { Download, Eye, FileText, Loader2, Trash2, Upload, X } from "lucide-react"
import { useCallback, useEffect, useId, useRef, useState } from "react"
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
  const titleInputId = useId()
  const fileInputId = useId()
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
    const shouldDelete = window.confirm("Remove this document from the record?")
    if (!shouldDelete) return

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
    <section
      className="overflow-hidden rounded-lg border border-border"
      data-agent-capabilities="/api/crm/agent-capabilities"
      data-agent-document-upload-api="/api/crm/documents"
      data-agent-entry-id={entryId}
    >
      <div className="border-b border-border px-4 py-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Documents
          </p>
          <h3 className="mt-1 text-sm font-semibold text-foreground text-pretty">
            Attachments for {label}
          </h3>
        </div>
      </div>

      <form
        onSubmit={handleUpload}
        className="space-y-3 border-b border-border bg-secondary/20 px-4 py-4"
        data-agent-preferred-action="uploadCrmDocument"
        data-agent-api="/api/crm/documents"
      >
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Attach a file
        </p>
        <div className="grid gap-3 md:grid-cols-[minmax(10rem,0.85fr)_minmax(12rem,1.15fr)_auto] md:items-end">
          <div className="space-y-1.5">
            <label
              htmlFor={titleInputId}
              className="text-xs font-medium text-muted-foreground"
            >
              Label
            </label>
            <input
              id={titleInputId}
              name="documentTitle"
              value={documentTitle}
              onChange={(event) => setDocumentTitle(event.target.value)}
              placeholder="Optional document label…"
              autoComplete="off"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor={fileInputId}
              className="text-xs font-medium text-muted-foreground"
            >
              File
            </label>
            <input
              id={fileInputId}
              name="documentFile"
              ref={fileInputRef}
              type="file"
              onChange={(event) =>
                setSelectedFile(event.target.files?.[0] ?? null)
              }
              autoComplete="off"
              className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm file:mr-3 file:h-8 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:text-xs file:font-medium file:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              required
            />
          </div>
          <button
            type="submit"
            disabled={uploading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Uploading…
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" aria-hidden="true" />
                Upload
              </>
            )}
          </button>
        </div>
        {error ? (
          <p className="text-sm text-destructive" aria-live="polite">
            {error}
          </p>
        ) : null}
      </form>

      <div className="divide-y divide-border">
        {isLoading ? (
          <div className="flex items-center gap-2 px-4 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading documents…
          </div>
        ) : documents.length > 0 ? (
          documents.map((document) => (
            <div
              key={document.id}
              className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
            >
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-secondary text-muted-foreground">
                  <FileText className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {document.title}
                  </p>
                  <p className="truncate text-xs text-muted-foreground" translate="no">
                    {document.filePath}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 md:justify-end">
                {isPreviewableFile(document.title, null) ||
                isPreviewableFile(document.filePath, null) ? (
                  <button
                    type="button"
                    onClick={() =>
                      void handlePreview(document.id, document.title)
                    }
                    disabled={previewingId === document.id}
                    className="inline-flex h-9 items-center justify-center gap-1 rounded-md border border-input bg-background px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
                  >
                    {previewingId === document.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    )}
                    View
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void handleDownload(document.id, document.title)}
                  className="inline-flex h-9 items-center justify-center gap-1 rounded-md border border-input bg-background px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Download
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(document.id)}
                  disabled={removingId === document.id}
                  className="inline-flex h-9 items-center justify-center gap-1 rounded-md border border-destructive/30 bg-background px-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2 disabled:opacity-50"
                >
                  {removingId === document.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  )}
                  {removingId === document.id ? "Removing…" : "Remove"}
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="px-4 py-6 text-sm text-muted-foreground">
            No documents yet. Upload a file to keep it with this record.
          </div>
        )}
      </div>
      {preview ? (
        <div className="border-t border-border">
          <div className="flex items-center justify-between gap-3 bg-secondary/20 px-4 py-3">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Preview
              </p>
              <p className="truncate text-sm font-medium text-foreground">
                {preview.title}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-input bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label="Close preview"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <pre className="max-h-96 overflow-auto border-t border-border bg-background p-4 text-xs leading-5 text-foreground">
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
