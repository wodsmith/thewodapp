import { getRouteApi } from "@tanstack/react-router"
import { FileUp, Loader2, Upload } from "lucide-react"
import {
  type DragEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  createImportRunFn,
  loadFileImportContextFn,
} from "@/server-fns/organizer-file-import-fns"
import { ImportReviewDrawer } from "./import-review-drawer"
import {
  type PageIntent,
  routeKindLabel,
  usePageIntent,
} from "./use-page-intent"

const routeApi = getRouteApi("/compete/organizer/$competitionId")

interface ActiveRun {
  importRunId: string
  intent: PageIntent
}

/**
 * Organizer file-drop shell. Wraps the competition layout's `<Outlet/>` so a
 * file dragged onto any drop-enabled organizer page (Volunteers / Judges for
 * MVP) is uploaded privately and handed to the import agent for review.
 *
 * Native HTML5 drag/drop (not pragmatic-drag-and-drop, which is for in-app
 * sortable lists). The overlay is purely visual; the wrapper catches the drop.
 */
export function ImportShell({ children }: { children: ReactNode }) {
  const { competition } = routeApi.useLoaderData()
  const intent = usePageIntent()
  const [hasAccess, setHasAccess] = useState<boolean | null>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [run, setRun] = useState<ActiveRun | null>(null)
  const dragDepth = useRef(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const dropEnabled = intent !== null

  // Check entitlement once per competition when on a drop-enabled route.
  useEffect(() => {
    if (!dropEnabled) {
      setHasAccess(null)
      return
    }
    let cancelled = false
    loadFileImportContextFn({ data: { competitionId: competition.id } })
      .then((r) => {
        if (!cancelled) setHasAccess(r.hasAccess)
      })
      .catch(() => {
        if (!cancelled) setHasAccess(false)
      })
    return () => {
      cancelled = true
    }
  }, [dropEnabled, competition.id])

  const active = dropEnabled && hasAccess === true && intent !== null

  async function handleFiles(files: FileList | null) {
    if (!active || !intent) return
    const file = files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const { importRunId } = await createImportRunFn({
        data: {
          competitionId: competition.id,
          routeKind: intent.routeKind,
          eventId: intent.eventId,
        },
      })
      const formData = new FormData()
      formData.append("file", file)
      formData.append("importRunId", importRunId)
      const res = await fetch("/api/agent-import/upload", {
        method: "POST",
        body: formData,
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? "Upload failed")
      }
      setRun({ importRunId, intent })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  function isFileDrag(e: DragEvent): boolean {
    return Array.from(e.dataTransfer.types).includes("Files")
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: passive page-level file drop zone (progressive enhancement); the keyboard-accessible path is the "Import a file" dock button
    <div
      onDragEnter={(e) => {
        if (!active || !isFileDrag(e)) return
        e.preventDefault()
        dragDepth.current += 1
        setDragging(true)
      }}
      onDragOver={(e) => {
        if (active && isFileDrag(e)) e.preventDefault()
      }}
      onDragLeave={(e) => {
        if (!active) return
        e.preventDefault()
        dragDepth.current = Math.max(0, dragDepth.current - 1)
        if (dragDepth.current === 0) setDragging(false)
      }}
      onDrop={(e) => {
        if (!active || !isFileDrag(e)) return
        e.preventDefault()
        dragDepth.current = 0
        setDragging(false)
        void handleFiles(e.dataTransfer.files)
      }}
    >
      {children}

      {active && dragging && intent && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-primary bg-card px-10 py-8 text-center shadow-lg">
            <Upload className="h-10 w-10 text-primary" />
            <p className="text-lg font-semibold">
              Drop to import to {routeKindLabel(intent.routeKind)}
            </p>
            <p className="max-w-xs text-xs text-muted-foreground">
              CSV, TSV, or text. Stored privately — the assistant drafts changes
              you review before anything is saved.
            </p>
          </div>
        </div>
      )}

      {active && (
        <div className="fixed bottom-6 right-6 z-40">
          <Button
            variant="secondary"
            className="shadow-md"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileUp className="mr-2 h-4 w-4" />
            )}
            Import a file
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.tsv,.txt,.md,text/csv,text/tab-separated-values,text/plain,text/markdown"
            className="hidden"
            onChange={(e) => void handleFiles(e.target.files)}
          />
        </div>
      )}

      {run && (
        <ImportReviewDrawer
          importRunId={run.importRunId}
          competitionId={competition.id}
          routeKind={run.intent.routeKind}
          eventId={run.intent.eventId}
          onClose={() => setRun(null)}
        />
      )}
    </div>
  )
}
