import type React from "react"
import { useRef, useState } from "react"
import { toast } from "sonner"
import { createImportRunFn } from "@/server-fns/organizer-file-import-fns"
import { ImportReviewDrawer } from "./import-review-drawer"
import { type PageIntent, usePageIntent } from "./use-page-intent"

interface ImportShellProps {
	competition: { id: string; name: string; organizingTeamId: string }
	children: React.ReactNode
}

const ACCEPT = ".csv,.tsv,.txt,.md,.xlsx,.xls"

/**
 * Mounts once in the organizer layout and wraps the page. Detects a dragged
 * file (or a click-to-pick from the dock), creates an import run, uploads the
 * file privately, and opens the review drawer connected to the agent. The drop
 * affordance only appears on routes the import agent can fulfill (see
 * usePageIntent).
 */
export function ImportShell({ competition, children }: ImportShellProps) {
	const intent = usePageIntent()
	const [dragging, setDragging] = useState(false)
	const [uploading, setUploading] = useState(false)
	const [run, setRun] = useState<{ importRunId: string } | null>(null)
	const dragDepth = useRef(0)
	const fileInputRef = useRef<HTMLInputElement>(null)

	const dropEnabled = intent !== null

	function isFileDrag(e: React.DragEvent): boolean {
		return Array.from(e.dataTransfer?.types ?? []).includes("Files")
	}

	function handleDragEnter(e: React.DragEvent) {
		if (!dropEnabled || !isFileDrag(e)) return
		dragDepth.current += 1
		setDragging(true)
	}

	function handleDragLeave() {
		if (!dropEnabled) return
		dragDepth.current -= 1
		if (dragDepth.current <= 0) {
			dragDepth.current = 0
			setDragging(false)
		}
	}

	function handleDragOver(e: React.DragEvent) {
		if (!dropEnabled || !isFileDrag(e)) return
		e.preventDefault()
	}

	async function handleDrop(e: React.DragEvent) {
		if (!dropEnabled) return
		e.preventDefault()
		dragDepth.current = 0
		setDragging(false)
		const file = e.dataTransfer?.files?.[0]
		if (file) await processFile(file, intent)
	}

	async function processFile(file: File, pageIntent: PageIntent | null) {
		if (!pageIntent) return
		setUploading(true)
		try {
			const { importRunId } = await createImportRunFn({
				data: {
					competitionId: competition.id,
					routeKind: pageIntent.routeKind,
					eventId: pageIntent.eventId,
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
				const body = (await res.json().catch(() => ({}))) as { error?: string }
				throw new Error(body.error ?? "Upload failed")
			}
			setRun({ importRunId })
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Couldn't start the import",
			)
		} finally {
			setUploading(false)
		}
	}

	return (
		<div
			onDragEnter={handleDragEnter}
			onDragOver={handleDragOver}
			onDragLeave={handleDragLeave}
			onDrop={handleDrop}
		>
			{children}

			{dragging && intent && (
				<div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
					<div className="rounded-lg border-2 border-dashed border-primary px-8 py-6 text-center">
						<p className="text-lg font-semibold">
							Drop to import to {intent.label}
						</p>
						<p className="mt-1 text-sm text-muted-foreground">
							CSV, TSV, XLSX, or text · PII stays private
						</p>
					</div>
				</div>
			)}

			{intent && (
				<>
					<input
						ref={fileInputRef}
						type="file"
						accept={ACCEPT}
						className="hidden"
						onChange={(e) => {
							const file = e.target.files?.[0]
							e.target.value = ""
							if (file) void processFile(file, intent)
						}}
					/>
					<button
						type="button"
						disabled={uploading}
						onClick={() => fileInputRef.current?.click()}
						className="fixed bottom-6 right-6 z-40 rounded-full border bg-background px-4 py-2 text-sm font-medium shadow-lg transition-colors hover:bg-accent disabled:opacity-60"
					>
						{uploading
							? "Uploading…"
							: `Import ${intent.label.toLowerCase()} from a file`}
					</button>
				</>
			)}

			{run && intent && (
				<ImportReviewDrawer
					importRunId={run.importRunId}
					competition={competition}
					intent={intent}
					onClose={() => setRun(null)}
				/>
			)}
		</div>
	)
}
