"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import type { ScoringConfig, ScoringAlgorithm } from "@/types/scoring"
import {
	generatePointsTable,
	WINNER_TAKES_MORE_TABLE,
} from "@/lib/scoring/algorithms/custom"
import { RotateCcw } from "lucide-react"

/**
 * Editable points preview panel - click to edit values inline
 */
function EditablePointsPreview({
	algorithm,
	baseTemplate,
	basePoints,
	overrides,
	onPointEdit,
	onResetOverrides,
	disabled,
}: {
	algorithm: ScoringAlgorithm
	baseTemplate: "traditional" | "winner_takes_more"
	basePoints: number[] | null
	overrides: Record<string, number>
	onPointEdit: (position: number, value: number) => void
	onResetOverrides: () => void
	disabled?: boolean
}) {
	const [editingPosition, setEditingPosition] = useState<number | null>(null)
	const [editValue, setEditValue] = useState("")

	// P-Score is dynamic, show explanation instead
	if (!basePoints) {
		return (
			<div className="rounded-lg border bg-muted/20 p-6">
				<h3 className="font-semibold mb-4">Points Preview</h3>
				<p className="text-sm text-muted-foreground">
					P-Score points are calculated dynamically based on actual performance
					data. The median performer scores 50, with points scaling based on
					distance from median.
				</p>
			</div>
		)
	}

	const hasOverrides = Object.keys(overrides).length > 0

	const handleStartEdit = (position: number, currentValue: number) => {
		if (disabled) return
		setEditingPosition(position)
		setEditValue(String(currentValue))
	}

	const handleSaveEdit = () => {
		if (editingPosition === null) return
		const newValue = parseInt(editValue, 10)
		if (!Number.isNaN(newValue) && newValue >= 0) {
			onPointEdit(editingPosition, newValue)
		}
		setEditingPosition(null)
		setEditValue("")
	}

	const handleCancelEdit = () => {
		setEditingPosition(null)
		setEditValue("")
	}

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			handleSaveEdit()
		} else if (e.key === "Escape") {
			handleCancelEdit()
		}
	}

	// Get effective points (base with overrides applied)
	const getEffectivePoints = (position: number): number => {
		const posKey = String(position)
		if (posKey in overrides) {
			return overrides[posKey]
		}
		return basePoints[position - 1] ?? 0
	}

	const isOverridden = (position: number): boolean => {
		return String(position) in overrides
	}

	return (
		<div className="rounded-lg border bg-muted/20 p-6">
			<div className="flex items-center justify-between mb-4">
				<div>
					<h3 className="font-semibold">Points Preview</h3>
					<p className="text-xs text-muted-foreground">
						Click any value to customize
					</p>
				</div>
				{hasOverrides && (
					<Button
						variant="ghost"
						size="sm"
						onClick={onResetOverrides}
						disabled={disabled}
						className="text-xs"
					>
						<RotateCcw className="h-3 w-3 mr-1" />
						Reset
					</Button>
				)}
			</div>

			{algorithm === "custom" && hasOverrides && (
				<p className="text-xs text-amber-600 mb-3">Custom overrides applied</p>
			)}

			{/* Show 30 for winner_takes_more (full table), 20 for traditional */}
			<div className="grid grid-cols-5 gap-2">
				{Array.from(
					{ length: baseTemplate === "winner_takes_more" ? 30 : 20 },
					(_, idx) => {
						const position = idx + 1
						const effectiveValue = getEffectivePoints(position)
						const isEditing = editingPosition === position
						const hasOverride = isOverridden(position)

						if (isEditing) {
							return (
								<div
									key={position}
									className="rounded-lg border-2 border-primary bg-background h-14"
								>
									<Input
										type="number"
										value={editValue}
										onChange={(e) => setEditValue(e.target.value)}
										onKeyDown={handleKeyDown}
										onBlur={handleSaveEdit}
										className="w-full h-full text-lg text-center font-semibold border-0 focus-visible:ring-0"
										autoFocus
										min={0}
									/>
								</div>
							)
						}

						return (
							<button
								type="button"
								key={position}
								className={`
								flex flex-col items-center justify-center rounded-lg border h-14 w-full
								${hasOverride ? "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800" : "bg-background"}
								${!disabled ? "cursor-pointer hover:border-primary/50" : ""}
							`}
								onClick={() => handleStartEdit(position, effectiveValue)}
								disabled={disabled}
							>
								<span className="text-xs text-muted-foreground">
									{position}.
								</span>
								<span
									className={`text-lg font-semibold ${hasOverride ? "text-amber-700 dark:text-amber-400" : ""}`}
								>
									{effectiveValue}
								</span>
							</button>
						)
					},
				)}
			</div>
			<p className="text-xs text-muted-foreground mt-3">
				{baseTemplate === "winner_takes_more"
					? "0 points for positions beyond 30th"
					: "Points continue decreasing for all positions (minimum 0)"}
			</p>
		</div>
	)
}

/**
 * Props for the ScoringConfigForm component
 */
interface ScoringConfigFormProps {
	/** Current scoring configuration value */
	value: ScoringConfig
	/** Callback when configuration changes */
	onChange: (config: ScoringConfig) => void
	/** Optional list of events for head-to-head tiebreaker selection */
	events?: Array<{ id: string; name: string }>
	/** Whether the form is disabled */
	disabled?: boolean
}

/**
 * Determine the base template from the current algorithm
 */
function getBaseTemplateFromAlgorithm(
	algorithm: ScoringAlgorithm,
): "traditional" | "winner_takes_more" {
	switch (algorithm) {
		case "traditional":
		case "custom":
		case "p_score":
			return "traditional"
		case "winner_takes_more":
			return "winner_takes_more"
	}
}

/**
 * Form component for configuring competition scoring settings.
 * Supports traditional, P-Score, winner-takes-more, and custom scoring algorithms,
 * tiebreaker configuration, and DNF/DNS/Withdrawn handling.
 */
export function ScoringConfigForm({
	value,
	onChange,
	events,
	disabled = false,
}: ScoringConfigFormProps) {
	// Get the base algorithm (not "custom" - that's derived)
	const displayAlgorithm =
		value.algorithm === "custom"
			? (value.customTable?.baseTemplate ?? "traditional")
			: value.algorithm

	const handleAlgorithmChange = (algorithm: ScoringAlgorithm) => {
		const newConfig = { ...value, algorithm }

		// Initialize algorithm-specific config if missing
		if (algorithm === "traditional" && !newConfig.traditional) {
			newConfig.traditional = { step: 5, firstPlacePoints: 100 }
		} else if (algorithm === "p_score" && !newConfig.pScore) {
			newConfig.pScore = { allowNegatives: true, medianField: "top_half" }
		}

		// Clear custom overrides when switching algorithms
		if (algorithm !== "custom") {
			newConfig.customTable = undefined
		}

		onChange(newConfig)
	}

	const handleTraditionalStepChange = (step: number) => {
		onChange({
			...value,
			traditional: {
				...value.traditional,
				step,
				firstPlacePoints: value.traditional?.firstPlacePoints ?? 100,
			},
		})
	}

	const handlePScoreChange = (
		key: "allowNegatives" | "medianField",
		val: boolean | "top_half" | "all",
	) => {
		onChange({
			...value,
			pScore: {
				allowNegatives: value.pScore?.allowNegatives ?? true,
				medianField: value.pScore?.medianField ?? "top_half",
				[key]: val,
			},
		})
	}

	/**
	 * Handle inline point edit - auto-switches to custom algorithm
	 */
	const handlePointEdit = (position: number, newValue: number) => {
		// Get current base points to check if this is actually a change
		const basePoints = getBasePoints()
		const baseValue = basePoints?.[position - 1] ?? 0

		// If setting back to base value, remove override
		if (newValue === baseValue) {
			const newOverrides = { ...value.customTable?.overrides }
			delete newOverrides[String(position)]

			// If no more overrides, switch back to base algorithm
			if (Object.keys(newOverrides).length === 0) {
				onChange({
					...value,
					algorithm: getBaseTemplateFromAlgorithm(
						value.algorithm === "custom"
							? ((value.customTable?.baseTemplate as ScoringAlgorithm) ??
									"traditional")
							: value.algorithm,
					),
					customTable: undefined,
				})
				return
			}

			onChange({
				...value,
				customTable: {
					baseTemplate:
						value.customTable?.baseTemplate ??
						getBaseTemplateFromAlgorithm(value.algorithm),
					overrides: newOverrides,
				},
			})
			return
		}

		// Determine what base template to use
		const baseTemplate =
			value.algorithm === "custom"
				? (value.customTable?.baseTemplate ?? "traditional")
				: getBaseTemplateFromAlgorithm(value.algorithm)

		// Switch to custom and add override
		onChange({
			...value,
			algorithm: "custom",
			customTable: {
				baseTemplate,
				overrides: {
					...(value.customTable?.overrides ?? {}),
					[String(position)]: newValue,
				},
			},
		})
	}

	/**
	 * Reset all overrides and switch back to base algorithm
	 */
	const handleResetOverrides = () => {
		const baseAlgorithm =
			value.algorithm === "custom"
				? ((value.customTable?.baseTemplate as ScoringAlgorithm) ??
					"traditional")
				: value.algorithm

		onChange({
			...value,
			algorithm: baseAlgorithm,
			customTable: undefined,
		})
	}

	const handleSecondaryTiebreakerChange = (
		secondary: "none" | "head_to_head",
	) => {
		onChange({
			...value,
			tiebreaker: {
				...value.tiebreaker,
				primary: value.tiebreaker.primary,
				secondary: secondary === "none" ? undefined : secondary,
			},
		})
	}

	const handleHeadToHeadEventChange = (eventId: string) => {
		onChange({
			...value,
			tiebreaker: {
				...value.tiebreaker,
				primary: value.tiebreaker.primary,
				headToHeadEventId: eventId,
			},
		})
	}

	const handleStatusHandlingChange = (
		field: "dnf" | "dns" | "withdrawn",
		newValue: string,
	) => {
		onChange({
			...value,
			statusHandling: {
				...value.statusHandling,
				[field]: newValue,
			},
		})
	}

	/**
	 * Get base points for current algorithm (without overrides)
	 */
	const getBasePoints = (): number[] | null => {
		// For custom, use the base template
		const algo =
			value.algorithm === "custom"
				? (value.customTable?.baseTemplate ?? "traditional")
				: value.algorithm

		switch (algo) {
			case "traditional":
				return generatePointsTable("traditional", 100, {
					firstPlacePoints: value.traditional?.firstPlacePoints ?? 100,
					step: value.traditional?.step ?? 5,
				})
			case "winner_takes_more":
				return [...WINNER_TAKES_MORE_TABLE]
			case "p_score":
				return null // P-Score is dynamic
			default:
				return generatePointsTable("traditional", 100)
		}
	}

	const basePoints = getBasePoints()
	const overrides = value.customTable?.overrides ?? {}

	return (
		<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
			{/* Configuration Card - takes 2/3 on large screens */}
			<Card className="lg:col-span-2">
				<CardHeader>
					<CardTitle>Scoring Configuration</CardTitle>
				</CardHeader>
				<CardContent className="space-y-6">
					{/* Scoring Algorithm Section */}
					<div className="space-y-4">
						<div className="space-y-1">
							<Label className="text-base font-medium">Scoring Algorithm</Label>
							<p className="text-xs text-muted-foreground">
								Determines how points are awarded for each event finish
							</p>
						</div>
						<RadioGroup
							value={displayAlgorithm}
							onValueChange={(val) =>
								handleAlgorithmChange(val as ScoringAlgorithm)
							}
							disabled={disabled}
						>
							{/* Traditional Option */}
							<div className="space-y-2">
								<div className="flex items-center space-x-2">
									<RadioGroupItem value="traditional" id="algo-traditional" />
									<Label htmlFor="algo-traditional">Traditional</Label>
								</div>
								{displayAlgorithm === "traditional" && (
									<div className="ml-6 space-y-3">
										<p className="text-xs text-muted-foreground">
											Points based on finish position. 1st gets most points,
											each subsequent place gets fewer by the step amount.
										</p>
										<div className="flex items-center space-x-2">
											<Label htmlFor="step">Step:</Label>
											<Input
												id="step"
												type="number"
												className="w-20"
												value={value.traditional?.step ?? 5}
												onChange={(e) =>
													handleTraditionalStepChange(Number(e.target.value))
												}
												disabled={disabled}
												min={1}
											/>
											<span className="text-sm text-muted-foreground">
												points between places
											</span>
										</div>
									</div>
								)}
							</div>

							{/* Winner Takes More Option */}
							<div className="space-y-2">
								<div className="flex items-center space-x-2">
									<RadioGroupItem
										value="winner_takes_more"
										id="algo-winner_takes_more"
									/>
									<Label htmlFor="algo-winner_takes_more">
										Winner Takes More
									</Label>
								</div>
								{displayAlgorithm === "winner_takes_more" && (
									<p className="ml-6 text-xs text-muted-foreground">
										Top positions get disproportionately more points. Similar to
										CrossFit Games scoring where 1st place is worth
										significantly more than 2nd.
									</p>
								)}
							</div>

							{/* P-Score Option */}
							<div className="space-y-2">
								<div className="flex items-center space-x-2">
									<RadioGroupItem value="p_score" id="algo-p_score" />
									<Label htmlFor="algo-p_score">P-Score</Label>
								</div>
								{displayAlgorithm === "p_score" && (
									<div className="ml-6 space-y-3">
										<p className="text-xs text-muted-foreground">
											Points based on how far above or below the median
											performance. Rewards dominant performances more than
											narrow wins.
										</p>
										<div className="space-y-1">
											<div className="flex items-center space-x-2">
												<Checkbox
													id="allow-negatives"
													checked={value.pScore?.allowNegatives ?? true}
													onCheckedChange={(checked) =>
														handlePScoreChange(
															"allowNegatives",
															checked === true,
														)
													}
													disabled={disabled}
												/>
												<Label htmlFor="allow-negatives">
													Allow negative scores
												</Label>
											</div>
											<p className="text-xs text-muted-foreground ml-6">
												{value.pScore?.allowNegatives
													? "Athletes below median get negative points (more competitive)"
													: "Athletes below median get zero points (more forgiving)"}
											</p>
										</div>
										<div className="space-y-1">
											<div className="flex items-center space-x-2">
												<Label htmlFor="median-field">
													Median calculated from:
												</Label>
												<Select
													value={value.pScore?.medianField ?? "top_half"}
													onValueChange={(val) =>
														handlePScoreChange(
															"medianField",
															val as "top_half" | "all",
														)
													}
													disabled={disabled}
												>
													<SelectTrigger
														id="median-field"
														className="w-[180px]"
													>
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="top_half">
															Top half of field
														</SelectItem>
														<SelectItem value="all">All competitors</SelectItem>
													</SelectContent>
												</Select>
											</div>
											<p className="text-xs text-muted-foreground">
												{value.pScore?.medianField === "top_half"
													? "Median uses top 50% only - harder to get positive scores"
													: "Median uses all athletes - easier to get positive scores"}
											</p>
										</div>
										<div className="rounded bg-muted/50 p-3 text-xs text-muted-foreground">
											<p className="font-medium">How P-Score works:</p>
											<p className="mt-1">
												Points are calculated dynamically based on actual
												performances. Median performer scores 50, athletes above
												median get more points proportional to their margin,
												athletes below get fewer points (or negative if
												enabled).
											</p>
										</div>
									</div>
								)}
							</div>
						</RadioGroup>
					</div>

					{/* Tiebreaker Section */}
					<div className="space-y-4 border-t pt-4">
						<div className="space-y-1">
							<Label className="text-base font-medium">Tiebreakers</Label>
							<p className="text-xs text-muted-foreground">
								How to determine rankings when athletes have identical total
								points
							</p>
						</div>
						<div className="space-y-1">
							<div className="flex items-center space-x-2">
								<span className="text-sm">Primary:</span>
								<span className="text-sm font-medium capitalize">
									{value.tiebreaker.primary === "countback"
										? "Countback"
										: value.tiebreaker.primary}
								</span>
							</div>
							{value.tiebreaker.primary === "countback" && (
								<p className="text-xs text-muted-foreground ml-4">
									Compares number of 1st place finishes, then 2nd place
									finishes, etc. Athlete with more high finishes wins the tie.
								</p>
							)}
						</div>
						<div className="space-y-2">
							<span className="text-sm">Secondary:</span>
							<p className="text-xs text-muted-foreground">
								Used when primary tiebreaker still results in a tie
							</p>
							<RadioGroup
								value={value.tiebreaker.secondary ?? "none"}
								onValueChange={(val) =>
									handleSecondaryTiebreakerChange(
										val as "none" | "head_to_head",
									)
								}
								disabled={disabled}
								className="flex flex-row gap-4"
							>
								<div className="flex items-center space-x-2">
									<RadioGroupItem value="none" id="secondary-none" />
									<Label htmlFor="secondary-none">None</Label>
								</div>
								<div className="flex items-center space-x-2">
									<RadioGroupItem value="head_to_head" id="secondary-h2h" />
									<Label htmlFor="secondary-h2h">Head-to-head</Label>
								</div>
							</RadioGroup>
							{!value.tiebreaker.secondary && (
								<p className="text-xs text-muted-foreground">
									Athletes remain tied if countback doesn't break the tie
								</p>
							)}
							{value.tiebreaker.secondary === "head_to_head" && (
								<div className="space-y-2">
									<p className="text-xs text-muted-foreground">
										Winner determined by who beat whom on a specific event
									</p>
									{events && events.length > 0 && (
										<div className="flex items-center space-x-2">
											<Label htmlFor="h2h-event">Deciding event:</Label>
											<Select
												value={value.tiebreaker.headToHeadEventId ?? ""}
												onValueChange={handleHeadToHeadEventChange}
												disabled={disabled}
											>
												<SelectTrigger id="h2h-event" className="w-[180px]">
													<SelectValue placeholder="Select event" />
												</SelectTrigger>
												<SelectContent>
													{events.map((event) => (
														<SelectItem key={event.id} value={event.id}>
															{event.name}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
									)}
									{(!events || events.length === 0) && (
										<p className="text-xs text-amber-600">
											Add events to your competition to enable head-to-head
											selection
										</p>
									)}
								</div>
							)}
						</div>
					</div>

					{/* DNF/DNS Handling Section */}
					<div className="space-y-4 border-t pt-4">
						<Label className="text-base font-medium">
							Did Not Finish (DNF)/Did Not Start (DNS) Handling
						</Label>
						<div className="space-y-4">
							{/* DNF */}
							<div className="space-y-1">
								<div className="flex items-center space-x-2">
									<Label htmlFor="dnf-handling" className="w-12">
										DNF:
									</Label>
									<Select
										value={value.statusHandling.dnf}
										onValueChange={(val) =>
											handleStatusHandlingChange("dnf", val)
										}
										disabled={disabled}
									>
										<SelectTrigger id="dnf-handling" className="w-[180px]">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="last_place">Last place</SelectItem>
											<SelectItem value="zero">Zero points</SelectItem>
											<SelectItem value="worst_performance">
												Worst performance
											</SelectItem>
										</SelectContent>
									</Select>
								</div>
								<p className="text-xs text-muted-foreground ml-14">
									{value.statusHandling.dnf === "last_place" &&
										"Athlete receives points for last position (e.g., 20th of 20 athletes)"}
									{value.statusHandling.dnf === "zero" &&
										"Athlete receives zero points for this event"}
									{value.statusHandling.dnf === "worst_performance" &&
										"Athlete receives score worse than the slowest finisher (time+1sec, reps-1, etc.)"}
								</p>
							</div>

							{/* DNS */}
							<div className="space-y-1">
								<div className="flex items-center space-x-2">
									<Label htmlFor="dns-handling" className="w-12">
										DNS:
									</Label>
									<Select
										value={value.statusHandling.dns}
										onValueChange={(val) =>
											handleStatusHandlingChange("dns", val)
										}
										disabled={disabled}
									>
										<SelectTrigger id="dns-handling" className="w-[180px]">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="zero">Zero points</SelectItem>
											<SelectItem value="exclude">Exclude</SelectItem>
											<SelectItem value="worst_performance">
												Worst performance
											</SelectItem>
										</SelectContent>
									</Select>
								</div>
								<p className="text-xs text-muted-foreground ml-14">
									{value.statusHandling.dns === "zero" &&
										"Athlete receives zero points for this event"}
									{value.statusHandling.dns === "exclude" &&
										"Event is not counted in athlete's total score"}
									{value.statusHandling.dns === "worst_performance" &&
										"Athlete receives score worse than the slowest finisher (time+1sec, reps-1, etc.)"}
								</p>
							</div>

							{/* Withdrawn */}
							<div className="space-y-1">
								<div className="flex items-center space-x-2">
									<Label htmlFor="wd-handling" className="w-12">
										WD:
									</Label>
									<Select
										value={value.statusHandling.withdrawn}
										onValueChange={(val) =>
											handleStatusHandlingChange("withdrawn", val)
										}
										disabled={disabled}
									>
										<SelectTrigger id="wd-handling" className="w-[180px]">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="exclude">Exclude</SelectItem>
											<SelectItem value="zero">Zero points</SelectItem>
										</SelectContent>
									</Select>
								</div>
								<p className="text-xs text-muted-foreground ml-14">
									{value.statusHandling.withdrawn === "exclude" &&
										"Athlete is removed from leaderboard entirely"}
									{value.statusHandling.withdrawn === "zero" &&
										"Athlete stays on leaderboard with zero points for remaining events"}
								</p>
							</div>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Points Preview Panel - takes 1/3 on large screens */}
			<div className="lg:sticky lg:top-6 h-fit">
				<EditablePointsPreview
					algorithm={value.algorithm}
					baseTemplate={
						value.algorithm === "custom"
							? (value.customTable?.baseTemplate ?? "traditional")
							: value.algorithm === "winner_takes_more"
								? "winner_takes_more"
								: "traditional"
					}
					basePoints={basePoints}
					overrides={overrides}
					onPointEdit={handlePointEdit}
					onResetOverrides={handleResetOverrides}
					disabled={disabled}
				/>
			</div>
		</div>
	)
}
