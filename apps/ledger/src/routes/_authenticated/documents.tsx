import { createFileRoute } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { useState } from "react"
import { DocumentTable } from "@/components/document-table"
import { UploadDialog } from "@/components/upload-dialog"
import { logoutFn } from "@/server-fns/auth"
import {
	deleteDocumentFn,
	getDocumentDownloadUrlFn,
	listDocumentsFn,
} from "@/server-fns/documents"
import type { Document } from "@/db/schema"
import { LogOut, Plus } from "lucide-react"

export const Route = createFileRoute("/_authenticated/documents")({
	loader: async () => {
		const documents = await listDocumentsFn()
		return { documents }
	},
	component: DocumentsPage,
})

function DocumentsPage() {
	const { documents: initialDocuments } = Route.useLoaderData()
	const [documents, setDocuments] = useState<Document[]>(initialDocuments)
	const [uploadOpen, setUploadOpen] = useState(false)
	const [deleting, setDeleting] = useState<string | null>(null)
	const deleteFn = useServerFn(deleteDocumentFn)
	const downloadFn = useServerFn(getDocumentDownloadUrlFn)
	const logout = useServerFn(logoutFn)

	const handleUploadComplete = async () => {
		const updated = await listDocumentsFn()
		setDocuments(updated)
		setUploadOpen(false)
	}

	const handleDelete = async (id: string) => {
		if (!confirm("Are you sure you want to delete this document?")) return
		setDeleting(id)
		try {
			await deleteFn({ data: { id } })
			setDocuments((prev) => prev.filter((d) => d.id !== id))
		} finally {
			setDeleting(null)
		}
	}

	const handleDownload = async (id: string) => {
		const result = await downloadFn({ data: { id } })
		// Decode base64 and trigger browser download
		const binaryString = atob(result.base64)
		const bytes = new Uint8Array(binaryString.length)
		for (let i = 0; i < binaryString.length; i++) {
			bytes[i] = binaryString.charCodeAt(i)
		}
		const blob = new Blob([bytes], { type: result.contentType })
		const url = URL.createObjectURL(blob)
		const a = document.createElement("a")
		a.href = url
		a.download = result.fileName
		a.click()
		URL.revokeObjectURL(url)
	}

	const handleLogout = async () => {
		await logout()
		window.location.href = "/"
	}

	return (
		<div className="min-h-screen bg-background">
			<header className="border-b">
				<div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
					<div className="flex items-center gap-2">
						<img
							src="/wodsmith-logo-no-text.png"
							alt="WODsmith"
							width={28}
							height={28}
						/>
						<h1 className="text-lg font-semibold">WODsmith Ledger</h1>
					</div>
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={() => setUploadOpen(true)}
							className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
						>
							<Plus className="h-4 w-4" />
							Upload
						</button>
						<button
							type="button"
							onClick={handleLogout}
							className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium hover:bg-accent"
						>
							<LogOut className="h-4 w-4" />
						</button>
					</div>
				</div>
			</header>

			<main className="mx-auto max-w-7xl p-4">
				<DocumentTable
					documents={documents}
					onDelete={handleDelete}
					onDownload={handleDownload}
					deletingId={deleting}
				/>
			</main>

			<UploadDialog
				open={uploadOpen}
				onOpenChange={setUploadOpen}
				onUploadComplete={handleUploadComplete}
			/>
		</div>
	)
}
