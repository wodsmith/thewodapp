"use client"

import { useState } from "react"
import type { SerializedEditorState } from "lexical"
import { useServerAction } from "@repo/zsa-react"
import { toast } from "sonner"
import { createWaiverAction, updateWaiverAction } from "@/actions/waivers"
import { WaiversEditor } from "@/components/compete/waivers-editor"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Waiver } from "@/db/schemas/waivers"

interface WaiverFormDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	competitionId: string
	teamId: string
	waiver?: Waiver
	onSuccess: (waiver: Waiver) => void
}

export function WaiverFormDialog({
	open,
	onOpenChange,
	competitionId,
	teamId,
	waiver,
	onSuccess,
}: WaiverFormDialogProps) {
	const [title, setTitle] = useState(waiver?.title ?? "")
	const [content, setContent] = useState<SerializedEditorState | undefined>(
		waiver?.content ? JSON.parse(waiver.content) : undefined,
	)
	const [required, setRequired] = useState(waiver?.required ?? true)

	const { execute: executeCreate, isPending: isCreating } =
		useServerAction(createWaiverAction)
	const { execute: executeUpdate, isPending: isUpdating } =
		useServerAction(updateWaiverAction)

	const isEditing = !!waiver
	const isPending = isCreating || isUpdating

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()

		if (!title.trim()) {
			toast.error("Title is required")
			return
		}

		if (!content) {
			toast.error("Content is required")
			return
		}

		const contentString = JSON.stringify(content)

		if (isEditing) {
			const [data, error] = await executeUpdate({
				waiverId: waiver.id,
				competitionId,
				teamId,
				title,
				content: contentString,
				required,
			})

			if (error) {
				toast.error("Failed to update waiver")
			} else if (data?.data) {
				toast.success("Waiver updated")
				onSuccess(data.data)
			}
		} else {
			const [data, error] = await executeCreate({
				competitionId,
				teamId,
				title,
				content: contentString,
				required,
			})

			if (error) {
				toast.error("Failed to create waiver")
			} else if (data?.data) {
				toast.success("Waiver created")
				onSuccess(data.data)
			}
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-3xl">
				<DialogHeader>
					<DialogTitle>{isEditing ? "Edit Waiver" : "Add Waiver"}</DialogTitle>
					<DialogDescription>
						{isEditing
							? "Update waiver details and content"
							: "Create a new waiver for athletes to sign"}
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="title">Title</Label>
						<Input
							id="title"
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							placeholder="e.g., Liability Waiver"
							disabled={isPending}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="content">Content</Label>
						<WaiversEditor
							value={content}
							onChange={setContent}
							placeholder="Enter waiver terms and conditions..."
						/>
					</div>

					<div className="flex items-center space-x-2">
						<Checkbox
							id="required"
							checked={required}
							onCheckedChange={(checked) => setRequired(checked === true)}
							disabled={isPending}
						/>
						<Label
							htmlFor="required"
							className="cursor-pointer text-sm font-normal"
						>
							Required (athletes must sign to register)
						</Label>
					</div>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
							disabled={isPending}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={isPending}>
							{isPending
								? "Saving..."
								: isEditing
									? "Save Changes"
									: "Create Waiver"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}
