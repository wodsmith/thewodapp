"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import { ImageUpload } from "@/components/ui/image-upload"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import type { Sponsor, SponsorGroup } from "@/db/schemas/sponsors"

interface SponsorFormDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	sponsor?: Sponsor
	groups: SponsorGroup[]
	defaultGroupId?: string | null
	competitionId: string
	onSubmit: (data: {
		name: string
		logoUrl?: string
		website?: string
		groupId?: string | null
	}) => void | Promise<void>
	isPending?: boolean
}

export function SponsorFormDialog({
	open,
	onOpenChange,
	sponsor,
	groups,
	defaultGroupId,
	competitionId,
	onSubmit,
	isPending,
}: SponsorFormDialogProps) {
	const [name, setName] = useState(sponsor?.name ?? "")
	const [logoUrl, setLogoUrl] = useState(sponsor?.logoUrl ?? "")
	const [website, setWebsite] = useState(sponsor?.website ?? "")
	const [groupId, setGroupId] = useState<string | null>(
		sponsor?.groupId ?? defaultGroupId ?? null,
	)
	const [isSubmitting, setIsSubmitting] = useState(false)
	const submittingRef = useRef(false)

	const isEditing = !!sponsor

	// Reset form when dialog opens/closes or sponsor changes
	useEffect(() => {
		if (open) {
			setName(sponsor?.name ?? "")
			setLogoUrl(sponsor?.logoUrl ?? "")
			setWebsite(sponsor?.website ?? "")
			setGroupId(sponsor?.groupId ?? defaultGroupId ?? null)
			setIsSubmitting(false)
			submittingRef.current = false
		}
	}, [open, sponsor, defaultGroupId])

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!name.trim()) return

		// Prevent double submission using both state and ref
		if (submittingRef.current || isSubmitting || isPending) return
		submittingRef.current = true
		setIsSubmitting(true)

		try {
			await onSubmit({
				name: name.trim(),
				logoUrl: logoUrl || undefined,
				website: website || undefined,
				groupId,
			})
		} finally {
			submittingRef.current = false
			setIsSubmitting(false)
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-lg">
				<form onSubmit={handleSubmit}>
					<DialogHeader>
						<DialogTitle>
							{isEditing ? "Edit Sponsor" : "Add Sponsor"}
						</DialogTitle>
						<DialogDescription>
							{isEditing
								? "Update sponsor information."
								: "Add a new sponsor to the competition."}
						</DialogDescription>
					</DialogHeader>

					<div className="grid gap-4 py-4">
						{/* Name */}
						<div className="grid gap-2">
							<Label htmlFor="sponsor-name">Sponsor Name *</Label>
							<Input
								id="sponsor-name"
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder="e.g., Nike"
								autoFocus
							/>
						</div>

						{/* Logo */}
						<div className="grid gap-2">
							<Label>Logo</Label>
							<ImageUpload
								value={logoUrl || undefined}
								onChange={(url) => setLogoUrl(url ?? "")}
								purpose="competition-sponsor-logo"
								entityId={competitionId}
								aspectRatio="16/9"
							/>
						</div>

						{/* Website */}
						<div className="grid gap-2">
							<Label htmlFor="website">Website URL</Label>
							<Input
								id="website"
								type="url"
								value={website}
								onChange={(e) => setWebsite(e.target.value)}
								placeholder="https://example.com"
							/>
						</div>

						{/* Group */}
						<div className="grid gap-2">
							<Label htmlFor="group">Sponsor Group</Label>
							<Select
								value={groupId ?? "ungrouped"}
								onValueChange={(v) => setGroupId(v === "ungrouped" ? null : v)}
							>
								<SelectTrigger>
									<SelectValue placeholder="Select a group (optional)" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="ungrouped">No Group</SelectItem>
									{groups.map((g) => (
										<SelectItem key={g.id} value={g.id}>
											{g.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
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
						<Button
							type="submit"
							disabled={!name.trim() || isPending || isSubmitting}
						>
							{isPending || isSubmitting
								? isEditing
									? "Saving..."
									: "Adding..."
								: isEditing
									? "Save"
									: "Add Sponsor"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}
