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
import {
	initializeCompetitionDivisionsFn,
	parseCompetitionSettings,
	promoteCompetitionDivisionsToSeriesFn,
} from "@/server-fns/competition-divisions-fns"
import type { CompetitionWithRelations } from "@/server-fns/competition-fns"
import { updateCompetitionFn } from "@/server-fns/competition-fns"

interface AddCompetitionsToSeriesDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	groupId: string
	groupName: string
	teamId: string
	/** Series scaling group ID (null if no divisions configured) */
	seriesScalingGroupId: string | null
	/** All competitions for this team */
	allCompetitions: CompetitionWithRelations[]
	/** Competitions already in this series */
	currentSeriesCompetitions: CompetitionWithRelations[]
}

type DialogStep = "selecting" | "post_add"

interface PostAddAction {
	type: "promote" | "clone_to_comp"
	competitionId: string
	competitionName: string
}

function formatDateFull(date: Date | string | number): string {
	const dateObj = date instanceof Date ? date : new Date(date)
	return dateObj.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	})
}

function competitionHasDivisions(
	competition: CompetitionWithRelations,
): boolean {
	const settings = parseCompetitionSettings(competition.settings)
	return !!settings?.divisions?.scalingGroupId
}

export function AddCompetitionsToSeriesDialog({
	open,
	onOpenChange,
	groupId,
	groupName,
	teamId,
	seriesScalingGroupId,
	allCompetitions,
	currentSeriesCompetitions,
}: AddCompetitionsToSeriesDialogProps) {
	const router = useRouter()
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [step, setStep] = useState<DialogStep>("selecting")
	const [postAddActions, setPostAddActions] = useState<PostAddAction[]>([])
	const [isProcessingAction, setIsProcessingAction] = useState(false)

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

			const results = await Promise.allSettled(updates)
			const successCount = results.filter(
				(r) => r.status === "fulfilled",
			).length
			const failureCount = results.length - successCount

			if (successCount > 0) {
				toast.success(
					`Added ${successCount} competition${successCount > 1 ? "s" : ""} to ${groupName}`,
				)
			}

			if (failureCount > 0) {
				toast.error(
					`${failureCount} competition${failureCount !== 1 ? "s" : ""} failed to add`,
				)
			}

			// Determine post-add actions based on division scenarios
			const addedCompetitions = allCompetitions.filter((c) =>
				selectedIds.has(c.id),
			)
			const actions: PostAddAction[] = []

			if (!seriesScalingGroupId) {
				// Scenario A: Series has NO divisions
				// Find first added competition that HAS divisions → offer to promote
				const compWithDivisions = addedCompetitions.find(
					competitionHasDivisions,
				)
				if (compWithDivisions) {
					actions.push({
						type: "promote",
						competitionId: compWithDivisions.id,
						competitionName: compWithDivisions.name,
					})
				}
			} else {
				// Series HAS divisions
				for (const comp of addedCompetitions) {
					if (!competitionHasDivisions(comp)) {
						// Scenario C: Competition has no divisions → auto-clone
						actions.push({
							type: "clone_to_comp",
							competitionId: comp.id,
							competitionName: comp.name,
						})
					}
					// Scenario B: Competition already has divisions → keep existing
					// (no automatic action needed, they keep their own)
				}
			}

			if (actions.length > 0) {
				setPostAddActions(actions)
				setStep("post_add")
			} else {
				await router.invalidate()
				setSelectedIds(new Set())
				onOpenChange(false)
			}
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

	const handlePromote = async (competitionId: string) => {
		setIsProcessingAction(true)
		try {
			await promoteCompetitionDivisionsToSeriesFn({
				data: {
					groupId,
					teamId,
					competitionId,
				},
			})
			toast.success("Competition divisions promoted to series template")
			await router.invalidate()
			resetAndClose()
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to promote divisions",
			)
		} finally {
			setIsProcessingAction(false)
		}
	}

	const handleAutoCloneAll = async () => {
		if (!seriesScalingGroupId) return

		setIsProcessingAction(true)
		const cloneActions = postAddActions.filter(
			(a) => a.type === "clone_to_comp",
		)

		try {
			const cloneResults = await Promise.allSettled(
				cloneActions.map((action) =>
					initializeCompetitionDivisionsFn({
						data: {
							teamId,
							competitionId: action.competitionId,
							templateGroupId: seriesScalingGroupId,
						},
					}),
				),
			)

			const successCount = cloneResults.filter(
				(r) => r.status === "fulfilled",
			).length

			if (successCount > 0) {
				toast.success(
					`Initialized divisions for ${successCount} competition${successCount > 1 ? "s" : ""}`,
				)
			}

			await router.invalidate()
			resetAndClose()
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to clone divisions",
			)
		} finally {
			setIsProcessingAction(false)
		}
	}

	const handleSkipPostAdd = async () => {
		await router.invalidate()
		resetAndClose()
	}

	const resetAndClose = () => {
		setSelectedIds(new Set())
		setStep("selecting")
		setPostAddActions([])
		onOpenChange(false)
	}

	const handleClose = () => {
		if (!isSubmitting && !isProcessingAction) {
			resetAndClose()
		}
	}

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent className="max-w-lg">
				{step === "selecting" && (
					<>
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
																<span>
																	{formatDateFull(competition.startDate)}
																</span>
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
							<Button
								variant="outline"
								onClick={handleClose}
								disabled={isSubmitting}
							>
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
					</>
				)}

				{step === "post_add" && (
					<>
						{/* Scenario A: Promote competition divisions to series */}
						{postAddActions.some((a) => a.type === "promote") && (
							<>
								<DialogHeader>
									<DialogTitle>Set Up Series Divisions</DialogTitle>
									<DialogDescription>
										This series doesn't have divisions yet.
									</DialogDescription>
								</DialogHeader>
								{postAddActions
									.filter((a) => a.type === "promote")
									.map((action) => (
										<div key={action.competitionId} className="space-y-3 py-2">
											<p className="text-sm">
												Use <strong>{action.competitionName}</strong>'s
												divisions as the series template? Future competitions
												will inherit these divisions.
											</p>
											<div className="flex gap-2">
												<Button
													onClick={() => handlePromote(action.competitionId)}
													disabled={isProcessingAction}
												>
													{isProcessingAction ? (
														<>
															<Loader2 className="h-4 w-4 mr-2 animate-spin" />
															Promoting...
														</>
													) : (
														"Use as Series Template"
													)}
												</Button>
												<Button
													variant="outline"
													onClick={handleSkipPostAdd}
													disabled={isProcessingAction}
												>
													Skip
												</Button>
											</div>
										</div>
									))}
							</>
						)}

						{/* Scenario C: Clone series divisions to competitions */}
						{postAddActions.some((a) => a.type === "clone_to_comp") &&
							!postAddActions.some((a) => a.type === "promote") && (
								<>
									<DialogHeader>
										<DialogTitle>Initialize Divisions</DialogTitle>
										<DialogDescription>
											{postAddActions.filter((a) => a.type === "clone_to_comp")
												.length === 1
												? "This competition doesn't have divisions yet."
												: `${postAddActions.filter((a) => a.type === "clone_to_comp").length} competitions don't have divisions yet.`}
										</DialogDescription>
									</DialogHeader>
									<div className="space-y-3 py-2">
										<p className="text-sm">
											Copy the series division template to{" "}
											{postAddActions.filter((a) => a.type === "clone_to_comp")
												.length === 1
												? postAddActions.find((a) => a.type === "clone_to_comp")
														?.competitionName
												: "these competitions"}
											?
										</p>
										<ul className="text-sm text-muted-foreground space-y-1">
											{postAddActions
												.filter((a) => a.type === "clone_to_comp")
												.map((action) => (
													<li key={action.competitionId}>
														{action.competitionName}
													</li>
												))}
										</ul>
										<div className="flex gap-2">
											<Button
												onClick={handleAutoCloneAll}
												disabled={isProcessingAction}
											>
												{isProcessingAction ? (
													<>
														<Loader2 className="h-4 w-4 mr-2 animate-spin" />
														Initializing...
													</>
												) : (
													"Initialize from Series Template"
												)}
											</Button>
											<Button
												variant="outline"
												onClick={handleSkipPostAdd}
												disabled={isProcessingAction}
											>
												Skip
											</Button>
										</div>
									</div>
								</>
							)}
					</>
				)}
			</DialogContent>
		</Dialog>
	)
}
