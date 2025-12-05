"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
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
import type { SponsorGroup } from "@/db/schema"

interface SponsorGroupFormDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	group?: SponsorGroup
	onSubmit: (name: string) => void | Promise<void>
	isPending?: boolean
}

export function SponsorGroupFormDialog({
	open,
	onOpenChange,
	group,
	onSubmit,
	isPending,
}: SponsorGroupFormDialogProps) {
	const [name, setName] = useState(group?.name ?? "")
	const isEditing = !!group

	// Reset form when dialog opens/closes or group changes
	useEffect(() => {
		if (open) {
			setName(group?.name ?? "")
		}
	}, [open, group])

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!name.trim()) return
		await onSubmit(name.trim())
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<form onSubmit={handleSubmit}>
					<DialogHeader>
						<DialogTitle>
							{isEditing ? "Edit Sponsor Group" : "Create Sponsor Group"}
						</DialogTitle>
						<DialogDescription>
							{isEditing
								? "Update the sponsor group name."
								: "Create a new sponsor group like 'Gold Sponsors', 'Title Sponsor', etc."}
						</DialogDescription>
					</DialogHeader>

					<div className="grid gap-4 py-4">
						<div className="grid gap-2">
							<Label htmlFor="name">Group Name</Label>
							<Input
								id="name"
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder="e.g., Gold Sponsors"
								autoFocus
							/>
						</div>
					</div>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={!name.trim() || isPending}>
							{isPending
								? isEditing
									? "Saving..."
									: "Creating..."
								: isEditing
									? "Save"
									: "Create Group"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}
