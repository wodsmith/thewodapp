"use client"

import { FileText, Loader2, Upload, X } from "lucide-react"
import * as React from "react"
import { useCallback, useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "./button"

type FileUploadPurpose = "judging-sheet"

interface UploadedFile {
	url: string
	key: string
	originalFilename: string
	fileSize: number
	mimeType: string
}

interface FileUploadProps {
	purpose: FileUploadPurpose
	entityId?: string
	onUpload: (file: UploadedFile) => void
	maxSizeMb?: number
	accept?: string
	className?: string
	disabled?: boolean
}

function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function FileUpload({
	purpose,
	entityId,
	onUpload,
	maxSizeMb = 20,
	accept = ".pdf,application/pdf",
	className,
	disabled,
}: FileUploadProps) {
	const [isUploading, setIsUploading] = useState(false)
	const [isDragging, setIsDragging] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const inputRef = React.useRef<HTMLInputElement>(null)

	const handleUpload = useCallback(
		async (file: File) => {
			if (disabled || isUploading) return
			setError(null)
			setIsUploading(true)

			const formData = new FormData()
			formData.append("file", file)
			formData.append("purpose", purpose)
			if (entityId) {
				formData.append("entityId", entityId)
			}

			try {
				const response = await fetch("/api/upload", {
					method: "POST",
					body: formData,
				})

				if (!response.ok) {
					const data = (await response.json()) as { error?: string }
					throw new Error(data.error || "Upload failed")
				}

				const data = (await response.json()) as UploadedFile
				onUpload(data)

				// Clear the input for the next upload
				if (inputRef.current) {
					inputRef.current.value = ""
				}
			} catch (err) {
				setError(err instanceof Error ? err.message : "Upload failed")
			} finally {
				setIsUploading(false)
			}
		},
		[purpose, entityId, onUpload, disabled, isUploading],
	)

	const handleFileSelect = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0]
			if (file) {
				handleUpload(file)
			}
		},
		[handleUpload],
	)

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault()
			setIsDragging(false)

			const file = e.dataTransfer.files[0]
			if (file?.type === "application/pdf") {
				handleUpload(file)
			} else {
				setError("Only PDF files are allowed")
			}
		},
		[handleUpload],
	)

	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault()
		setIsDragging(true)
	}, [])

	const handleDragLeave = useCallback((e: React.DragEvent) => {
		e.preventDefault()
		setIsDragging(false)
	}, [])

	return (
		<div className={cn("space-y-2", className)}>
			<section
				aria-label="File upload drop zone"
				className={cn(
					"relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors p-6",
					isDragging && "border-primary bg-primary/5",
					!isDragging && "border-muted-foreground/25 hover:border-primary/50",
					disabled && "pointer-events-none opacity-50",
				)}
				onDrop={handleDrop}
				onDragOver={handleDragOver}
				onDragLeave={handleDragLeave}
			>
				<button
					type="button"
					className="flex h-full w-full flex-col items-center justify-center gap-2"
					onClick={() => inputRef.current?.click()}
					disabled={disabled || isUploading}
				>
					{isUploading ? (
						<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
					) : (
						<>
							<div className="rounded-full bg-muted p-3">
								{isDragging ? (
									<Upload className="h-6 w-6 text-primary" />
								) : (
									<FileText className="h-6 w-6 text-muted-foreground" />
								)}
							</div>
							<div className="text-center">
								<p className="text-sm font-medium">
									{isDragging ? "Drop PDF here" : "Click or drag to upload"}
								</p>
								<p className="text-xs text-muted-foreground">
									PDF files only, max {maxSizeMb}MB
								</p>
							</div>
						</>
					)}
				</button>
			</section>

			{error && <p className="text-sm text-destructive">{error}</p>}

			<input
				ref={inputRef}
				type="file"
				accept={accept}
				className="hidden"
				onChange={handleFileSelect}
				disabled={disabled || isUploading}
			/>
		</div>
	)
}

interface FileListItemProps {
	title: string
	filename: string
	fileSize: number
	url: string
	onDelete?: () => void
	disabled?: boolean
}

export function FileListItem({
	title,
	filename,
	fileSize,
	url,
	onDelete,
	disabled,
}: FileListItemProps) {
	return (
		<div className="flex items-center justify-between gap-4 rounded-lg border p-3">
			<div className="flex items-center gap-3 min-w-0">
				<div className="rounded bg-muted p-2 shrink-0">
					<FileText className="h-5 w-5 text-muted-foreground" />
				</div>
				<div className="min-w-0">
					<p className="font-medium text-sm truncate">{title}</p>
					<p className="text-xs text-muted-foreground truncate">
						{filename} ({formatFileSize(fileSize)})
					</p>
				</div>
			</div>
			<div className="flex items-center gap-2 shrink-0">
				<Button type="button" variant="outline" size="sm" asChild>
					<a href={url} target="_blank" rel="noopener noreferrer">
						View
					</a>
				</Button>
				{onDelete && (
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="h-8 w-8 text-muted-foreground hover:text-destructive"
						onClick={onDelete}
						disabled={disabled}
					>
						<X className="h-4 w-4" />
					</Button>
				)}
			</div>
		</div>
	)
}
