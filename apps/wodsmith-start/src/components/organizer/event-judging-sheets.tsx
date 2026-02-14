"use client"

import { useServerFn } from "@tanstack/react-start"
import { Check, Pencil, X } from "lucide-react"
import { useCallback, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { FileListItem, FileUpload } from "@/components/ui/file-upload"
import { Input } from "@/components/ui/input"
import {
	createJudgingSheetFn,
	deleteJudgingSheetFn,
	updateJudgingSheetFn,
} from "@/server-fns/judging-sheet-fns"

interface JudgingSheet {
	id: string
	title: string
	url: string
	originalFilename: string
	fileSize: number
	mimeType: string
	sortOrder: number
	createdAt: Date
}

interface EventJudgingSheetsProps {
	competitionId: string
	trackWorkoutId: string
	sheets: JudgingSheet[]
	onSheetsChange: (sheets: JudgingSheet[]) => void
}

export function EventJudgingSheets({
	competitionId,
	trackWorkoutId,
	sheets,
	onSheetsChange,
}: EventJudgingSheetsProps) {
	const [isUploading, setIsUploading] = useState(false)
	const [newSheetTitle, setNewSheetTitle] = useState("")
	const [pendingUpload, setPendingUpload] = useState<{
		url: string
		r2Key: string
		originalFilename: string
		fileSize: number
		mimeType: string
	} | null>(null)
	const [editingId, setEditingId] = useState<string | null>(null)
	const [editTitle, setEditTitle] = useState("")

	const createSheet = useServerFn(createJudgingSheetFn)
	const updateSheet = useServerFn(updateJudgingSheetFn)
	const deleteSheet = useServerFn(deleteJudgingSheetFn)

	const handleFileUpload = useCallback(
		(file: {
			url: string
			key: string
			originalFilename: string
			fileSize: number
			mimeType: string
		}) => {
			// Store the uploaded file info and let user provide a title
			setPendingUpload({
				url: file.url,
				r2Key: file.key,
				originalFilename: file.originalFilename,
				fileSize: file.fileSize,
				mimeType: file.mimeType,
			})
			// Default title to filename without extension
			const defaultTitle = file.originalFilename.replace(/\.[^/.]+$/, "")
			setNewSheetTitle(defaultTitle)
		},
		[],
	)

	const handleCreateSheet = useCallback(async () => {
		if (!pendingUpload || !newSheetTitle.trim()) {
			toast.error("Please provide a title for the judging sheet")
			return
		}

		setIsUploading(true)
		try {
			const result = await createSheet({
				data: {
					competitionId,
					trackWorkoutId,
					title: newSheetTitle.trim(),
					url: pendingUpload.url,
					r2Key: pendingUpload.r2Key,
					originalFilename: pendingUpload.originalFilename,
					fileSize: pendingUpload.fileSize,
					mimeType: pendingUpload.mimeType,
				},
			})

			onSheetsChange([...sheets, result.sheet as JudgingSheet])
			setPendingUpload(null)
			setNewSheetTitle("")
			toast.success("Judging sheet uploaded")
		} catch (error) {
			console.error("Failed to create judging sheet:", error)
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to upload judging sheet",
			)
		} finally {
			setIsUploading(false)
		}
	}, [
		competitionId,
		trackWorkoutId,
		pendingUpload,
		newSheetTitle,
		createSheet,
		sheets,
		onSheetsChange,
	])

	const handleCancelUpload = useCallback(() => {
		setPendingUpload(null)
		setNewSheetTitle("")
	}, [])

	const handleStartEdit = useCallback((sheet: JudgingSheet) => {
		setEditingId(sheet.id)
		setEditTitle(sheet.title)
	}, [])

	const handleCancelEdit = useCallback(() => {
		setEditingId(null)
		setEditTitle("")
	}, [])

	const handleSaveEdit = useCallback(
		async (sheetId: string) => {
			if (!editTitle.trim()) {
				toast.error("Title cannot be empty")
				return
			}

			try {
				const result = await updateSheet({
					data: {
						judgingSheetId: sheetId,
						title: editTitle.trim(),
					},
				})

				onSheetsChange(
					sheets.map((s) =>
						s.id === sheetId
							? { ...s, title: result.sheet?.title ?? s.title }
							: s,
					),
				)
				setEditingId(null)
				setEditTitle("")
				toast.success("Judging sheet updated")
			} catch (error) {
				console.error("Failed to update judging sheet:", error)
				toast.error(
					error instanceof Error
						? error.message
						: "Failed to update judging sheet",
				)
			}
		},
		[editTitle, updateSheet, sheets, onSheetsChange],
	)

	const handleDelete = useCallback(
		async (sheetId: string) => {
			try {
				await deleteSheet({
					data: {
						judgingSheetId: sheetId,
					},
				})

				onSheetsChange(sheets.filter((s) => s.id !== sheetId))
				toast.success("Judging sheet deleted")
			} catch (error) {
				console.error("Failed to delete judging sheet:", error)
				toast.error(
					error instanceof Error
						? error.message
						: "Failed to delete judging sheet",
				)
			}
		},
		[deleteSheet, sheets, onSheetsChange],
	)

	return (
		<Card>
			<CardHeader>
				<CardTitle>Judging Sheets</CardTitle>
				<CardDescription>
					Upload PDF judging sheets for athletes to download
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				{/* Existing sheets */}
				{sheets.length > 0 && (
					<div className="space-y-2">
						{sheets.map((sheet) => (
							<div key={sheet.id}>
								{editingId === sheet.id ? (
									<div className="flex items-center gap-2 rounded-lg border p-3">
										<Input
											value={editTitle}
											onChange={(e) => setEditTitle(e.target.value)}
											className="flex-1"
											autoFocus
										/>
										<Button
											type="button"
											variant="ghost"
											size="icon"
											onClick={() => handleSaveEdit(sheet.id)}
										>
											<Check className="h-4 w-4" />
										</Button>
										<Button
											type="button"
											variant="ghost"
											size="icon"
											onClick={handleCancelEdit}
										>
											<X className="h-4 w-4" />
										</Button>
									</div>
								) : (
									<div className="flex items-center gap-2">
										<div className="flex-1">
											<FileListItem
												title={sheet.title}
												filename={sheet.originalFilename}
												fileSize={sheet.fileSize}
												url={sheet.url}
												onDelete={() => handleDelete(sheet.id)}
											/>
										</div>
										<Button
											type="button"
											variant="ghost"
											size="icon"
											className="shrink-0"
											onClick={() => handleStartEdit(sheet)}
										>
											<Pencil className="h-4 w-4" />
										</Button>
									</div>
								)}
							</div>
						))}
					</div>
				)}

				{/* Pending upload - title input */}
				{pendingUpload && (
					<div className="space-y-3 rounded-lg border border-primary/50 bg-primary/5 p-4">
						<p className="text-sm font-medium">
							File uploaded: {pendingUpload.originalFilename}
						</p>
						<div className="space-y-2">
							<label htmlFor="sheet-title" className="text-sm font-medium">
								Display Title
							</label>
							<Input
								id="sheet-title"
								value={newSheetTitle}
								onChange={(e) => setNewSheetTitle(e.target.value)}
								placeholder="Enter a title for this judging sheet"
								autoFocus
							/>
						</div>
						<div className="flex items-center gap-2">
							<Button
								type="button"
								onClick={handleCreateSheet}
								disabled={isUploading || !newSheetTitle.trim()}
							>
								{isUploading ? "Saving..." : "Save Judging Sheet"}
							</Button>
							<Button
								type="button"
								variant="outline"
								onClick={handleCancelUpload}
								disabled={isUploading}
							>
								Cancel
							</Button>
						</div>
					</div>
				)}

				{/* Upload area - only show when not in pending state */}
				{!pendingUpload && (
					<FileUpload
						purpose="judging-sheet"
						entityId={competitionId}
						onUpload={handleFileUpload}
						maxSizeMb={20}
					/>
				)}

				{sheets.length === 0 && !pendingUpload && (
					<p className="text-sm text-muted-foreground text-center py-2">
						No judging sheets uploaded yet
					</p>
				)}
			</CardContent>
		</Card>
	)
}
