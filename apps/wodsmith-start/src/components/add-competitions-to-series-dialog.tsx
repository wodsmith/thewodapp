"use client"

import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { Calendar, Check, Loader2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
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
import { ScrollArea } from "@/components/ui/scroll-area"
import { updateCompetitionFn } from "@/server-fns/competition-fns"
import type { CompetitionWithRelations } from "@/server-fns/competition-fns"

interface AddCompetitionsToSeriesDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	groupId: string
	groupName: string
	/** All competitions for this team */
	allCompetitions: CompetitionWithRelations[]
	/** Competitions already in this series */
	currentSeriesCompetitions: CompetitionWithRelations[]
}

function formatDateFull(date: Date | string | number): string {
	const dateObj = date instanceof Date ? date : new Date(date)
	return dateObj.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	})
}

export function AddCompetitionsToSeriesDialog({
	open,
	onOpenChange,
	groupId,
	groupName,
	allCompetitions,
	currentSeriesCompetitions,
}: AddCompetitionsToSeriesDialogProps) {
	const router = useRouter()
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
	const [isSubmitting, setIsSubmitting] = useState(false)

	const updateCompetition = useServerFn(updateCompetitionFn)

	// Get competitions NOT in this series
	const currentSeriesIds = new Set(currentSeriesCompetitions.map((c) => c.id))
	const availableCompetitions = allCompetitions.filter(
		(c) => !currentSeriesIds.has(c.id),
	)

	const handleToggle = (competitionId: string) => {
		setSelectedIds((prev) => {
			const next = new Set(prev)
			if (next.has(competitionId)) {
				next.delete(competitionId)
			} else {
				next.add(competitionId)
			}
			return next
		})
	}

	const handleSelectAll = () => {
		if (selectedIds.size === availableCompetitions.length) {
			setSelectedIds(new Set())
		} else {
			setSelectedIds(new Set(availableCompetitions.map((c) => c.id)))
		}
	}

	const handleSubmit = async () => {
		if (selectedIds.size === 0) return

		setIsSubmitting(true)
		try {
			// Update each selected competition to add to this series
			const updates = Array.from(selectedIds).map((competitionId) =>
				updateCompetition({
					data: {
						competitionId,
						groupId,
					},
				}),
			)

			await Promise.all(updates)

			toast.success(
				`Added ${selectedIds.size} competition${selectedIds.size > 1 ? "s" : ""} to ${groupName}`,
			)

			await router.invalidate()
			setSelectedIds(new Set())
			onOpenChange(false)
		} catch (error) {
			console.error("Failed to add competitions to series:", error)
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to add competitions to series",
			)
		} finally {
			setIsSubmitting(false)
		}
	}

	const handleClose = () => {
		if (!isSubmitting) {
			setSelectedIds(new Set())
			onOpenChange(false)
		}
	}

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>Add Competitions to Series</DialogTitle>
					<DialogDescription>
						Select competitions to add to "{groupName}"
					</DialogDescription>
				</DialogHeader>

				{availableCompetitions.length === 0 ? (
					<div className="py-8 text-center text-muted-foreground">
						<p>All your competitions are already in this series.</p>
					</div>
				) : (
					<>
						<div className="flex items-center justify-between py-2">
							<Button
								variant="ghost"
								size="sm"
								onClick={handleSelectAll}
								className="text-xs"
							>
								{selectedIds.size === availableCompetitions.length
									? "Deselect All"
									: "Select All"}
							</Button>
							<span className="text-sm text-muted-foreground">
								{selectedIds.size} selected
							</span>
						</div>

						<ScrollArea className="max-h-[300px] pr-4">
							<div className="space-y-2">
								{availableCompetitions.map((competition) => {
									const isSelected = selectedIds.has(competition.id)
									const isInOtherSeries = competition.groupId !== null

									return (
										<button
											key={competition.id}
											type="button"
											className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors text-left w-full ${
												isSelected
													? "border-primary bg-primary/5"
													: "hover:bg-accent"
											}`}
											onClick={() => handleToggle(competition.id)}
										>
											<Checkbox
												checked={isSelected}
												onCheckedChange={() => handleToggle(competition.id)}
												className="pointer-events-none"
											/>
											<div className="flex-1 min-w-0">
												<p className="font-medium text-sm truncate">
													{competition.name}
												</p>
												<div className="flex items-center gap-2 mt-1">
													<div className="flex items-center gap-1 text-xs text-muted-foreground">
														<Calendar className="h-3 w-3" />
														<span>{formatDateFull(competition.startDate)}</span>
													</div>
													{isInOtherSeries && (
														<Badge variant="outline" className="text-xs">
															In another series
														</Badge>
													)}
												</div>
											</div>
											{isSelected && (
												<Check className="h-4 w-4 text-primary flex-shrink-0" />
											)}
										</button>
									)
								})}
							</div>
						</ScrollArea>
					</>
				)}

				<DialogFooter>
					<Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
						Cancel
					</Button>
					<Button
						onClick={handleSubmit}
						disabled={selectedIds.size === 0 || isSubmitting}
					>
						{isSubmitting ? (
							<>
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								Adding...
							</>
						) : (
							`Add ${selectedIds.size || ""} Competition${selectedIds.size !== 1 ? "s" : ""}`
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
