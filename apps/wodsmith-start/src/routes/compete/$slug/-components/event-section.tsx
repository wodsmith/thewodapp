"use client"

import {
	ChevronDown,
	Clock,
	FileText,
	ListOrdered,
	Target,
	Trophy,
	Users,
} from "lucide-react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import type {
	EventWithRotations,
	WorkoutDetails,
} from "@/server-fns/volunteer-schedule-fns"
import { cn } from "@/utils/cn"
import { RotationCard } from "./rotation-card"

interface EventSectionProps {
	event: EventWithRotations
}

/**
 * Displays a single event with its workout details and all judge rotations.
 * Division selection is synchronized between the event overview and rotation cards.
 */
export function EventSection({ event }: EventSectionProps) {
	const { eventName, eventNotes, workout, divisionDescriptions, rotations } =
		event

	// Check if any rotation is upcoming
	const hasUpcoming = rotations.some((r) => r.isUpcoming)

	// Get all unique divisions from heat assignments (what the judge will actually see)
	const assignedDivisions = getAssignedDivisions(rotations)

	// Filter division descriptions to only those that have content
	const divisionsWithDescriptions = divisionDescriptions.filter(
		(d) => d.description && d.description.trim() !== "",
	)

	// Create a map for quick lookup
	const divisionDescriptionMap = new Map(
		divisionsWithDescriptions.map((d) => [d.divisionId, d]),
	)

	// Selected division state
	const [selectedDivisionId, setSelectedDivisionId] = useState<string | null>(
		assignedDivisions[0]?.divisionId || null,
	)

	// Workout details section state - opens when division is clicked
	const [isWorkoutOpen, setIsWorkoutOpen] = useState(false)

	// Handle division selection from rotation card or dropdown
	const handleDivisionSelect = (divisionId: string) => {
		setSelectedDivisionId(divisionId)
		setIsWorkoutOpen(true) // Auto-open workout details when division is selected
	}

	// Get the selected division's description
	const selectedDivision = selectedDivisionId
		? divisionDescriptionMap.get(selectedDivisionId)
		: null

	return (
		<section className="space-y-4">
			{/* Event Header */}
			<Card className={cn(hasUpcoming && "border-primary/50")}>
				<CardHeader>
					<div className="flex items-start justify-between gap-3">
						<div className="flex-1">
							<div className="flex items-center gap-2 mb-1">
								<CardTitle className="text-xl">{eventName}</CardTitle>
								{hasUpcoming && (
									<Badge variant="default" className="text-xs">
										Upcoming
									</Badge>
								)}
							</div>
							<CardDescription className="flex flex-wrap items-center gap-3">
								<ScoringBadges workout={workout} />
							</CardDescription>
						</div>
					</div>
				</CardHeader>
				<CardContent className="space-y-4">
					{/* Division Selector - shows divisions from heat assignments */}
					{assignedDivisions.length > 0 && (
						<div className="flex items-center gap-3">
							<div className="flex items-center gap-1.5 text-sm text-muted-foreground">
								<Users className="h-4 w-4" />
								<span>Division:</span>
							</div>
							<Select
								value={selectedDivisionId || undefined}
								onValueChange={handleDivisionSelect}
							>
								<SelectTrigger className="w-[200px]">
									<SelectValue placeholder="Select division" />
								</SelectTrigger>
								<SelectContent>
									{assignedDivisions.map((div) => (
										<SelectItem key={div.divisionId} value={div.divisionId}>
											{div.divisionName}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					)}

					{/* Workout Description - Collapsible */}
					{workout.description && (
						<Collapsible open={isWorkoutOpen} onOpenChange={setIsWorkoutOpen}>
							<div className="border rounded-lg bg-muted/30">
								<CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-muted/50 transition-colors">
									<h4 className="text-sm font-semibold flex items-center gap-1.5">
										<FileText className="h-4 w-4" />
										Workout Details
										{selectedDivision && (
											<Badge variant="secondary" className="ml-2 text-xs">
												{selectedDivision.divisionLabel}
											</Badge>
										)}
									</h4>
									<ChevronDown
										className={cn(
											"h-4 w-4 text-muted-foreground transition-transform",
											isWorkoutOpen && "rotate-180",
										)}
									/>
								</CollapsibleTrigger>
								<CollapsibleContent>
									<div className="px-4 pb-4">
										{/* Selected division standards */}
										{selectedDivision?.description ? (
											<p className="text-sm whitespace-pre-wrap font-mono">
												{selectedDivision.description}
											</p>
										) : (
											<p className="text-sm text-muted-foreground italic">
												No specific standards defined for this division.
											</p>
										)}
									</div>
								</CollapsibleContent>
							</div>
						</Collapsible>
					)}

					{/* Event Notes */}
					{eventNotes && (
						<div className="border rounded-lg p-4 bg-amber-50/50 dark:bg-amber-950/20">
							<h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
								<Clock className="h-4 w-4" />
								Event Notes
							</h4>
							<p className="text-sm whitespace-pre-wrap">{eventNotes}</p>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Rotation Cards */}
			<div className="ml-4 border-l-2 border-muted pl-4 space-y-3">
				<h4 className="text-sm font-semibold text-muted-foreground">
					Your Assignments ({rotations.length})
				</h4>
				{rotations.map((rotation) => (
					<RotationCard
						key={rotation.rotation.id}
						rotation={rotation}
						onDivisionClick={handleDivisionSelect}
						selectedDivisionId={selectedDivisionId}
					/>
				))}
			</div>
		</section>
	)
}

/**
 * Get unique divisions from all heat assignments across rotations,
 * sorted by the order the judge encounters them (lowest heat number first)
 */
function getAssignedDivisions(
	rotations: EventWithRotations["rotations"],
): Array<{ divisionId: string; divisionName: string }> {
	// Track division -> first heat number encountered
	const divisionFirstHeat = new Map<
		string,
		{ name: string; heatNumber: number }
	>()

	for (const rotation of rotations) {
		for (const heat of rotation.heats) {
			if (
				heat.divisionId &&
				heat.divisionName &&
				heat.divisionName !== "null"
			) {
				const existing = divisionFirstHeat.get(heat.divisionId)
				if (!existing || heat.heatNumber < existing.heatNumber) {
					divisionFirstHeat.set(heat.divisionId, {
						name: heat.divisionName,
						heatNumber: heat.heatNumber,
					})
				}
			}
		}
	}

	// Sort by heat number (order judge encounters them)
	return Array.from(divisionFirstHeat.entries())
		.sort((a, b) => a[1].heatNumber - b[1].heatNumber)
		.map(([divisionId, { name }]) => ({ divisionId, divisionName: name }))
}

/**
 * Display scoring metadata badges for the workout
 */
function ScoringBadges({ workout }: { workout: WorkoutDetails }) {
	const badges: React.ReactNode[] = []

	// Time cap
	if (workout.timeCap) {
		const minutes = Math.floor(workout.timeCap / 60)
		const seconds = workout.timeCap % 60
		const timeCapStr =
			seconds > 0
				? `${minutes}:${seconds.toString().padStart(2, "0")}`
				: `${minutes} min`
		
		badges.push(
			<Badge
				key="timecap"
				variant="outline"
				className={cn(
					"px-3 py-1 text-sm flex gap-2 items-center font-normal",
					["time", "time-with-cap"].includes(workout.scheme) && "border-red-200 bg-red-50 text-red-700 dark:bg-red-950/30 dark:border-red-800 dark:text-red-400"
				)}
			>
				<Clock className="h-4 w-4" />
				{timeCapStr} Cap
			</Badge>,
		)
	}

	// Scheme badge
	const schemeLabel = formatScheme(workout.scheme)
	if (schemeLabel) {
		badges.push(
			<Badge
				key="scheme"
				variant="outline"
				className="px-3 py-1 text-sm flex gap-2 items-center font-normal"
			>
				<Target className="h-4 w-4" />
				{schemeLabel}
			</Badge>,
		)
	}

	// Score type (if not obvious from scheme)
	if (
		workout.scoreType &&
		!["time", "time-with-cap"].includes(workout.scheme)
	) {
		badges.push(
			<Badge
				key="scoretype"
				variant="outline"
				className="px-3 py-1 text-sm flex gap-2 items-center font-normal"
			>
				<Trophy className="h-4 w-4" />
				{formatScoreType(workout.scoreType)}
			</Badge>,
		)
	}

	// Rounds to score
	if (workout.roundsToScore && workout.roundsToScore > 1) {
		badges.push(
			<Badge
				key="rounds"
				variant="outline"
				className="px-3 py-1 text-sm flex gap-2 items-center font-normal"
			>
				<ListOrdered className="h-4 w-4" />
				{workout.roundsToScore} Rounds
			</Badge>,
		)
	}

	// Tiebreak
	if (workout.tiebreakScheme) {
		badges.push(
			<Badge
				key="tiebreak"
				variant="outline"
				className="px-3 py-1 text-sm flex gap-2 items-center font-normal"
			>
				<Target className="h-4 w-4" />
				Tiebreak: {workout.tiebreakScheme}
			</Badge>,
		)
	}

	return <>{badges}</>
}

/**
 * Format workout scheme for display
 */
function formatScheme(scheme: string): string {
	const schemeMap: Record<string, string> = {
		time: "For Time",
		"time-with-cap": "For Time (Capped)",
		"pass-fail": "Pass/Fail",
		"rounds-reps": "Rounds + Reps",
		reps: "Total Reps",
		emom: "EMOM",
		load: "Max Load",
		calories: "Calories",
		meters: "Meters",
		feet: "Feet",
		points: "Points",
	}
	return schemeMap[scheme] || scheme
}

/**
 * Format score type for display
 */
function formatScoreType(scoreType: string): string {
	const typeMap: Record<string, string> = {
		min: "Lowest Wins",
		max: "Highest Wins",
		sum: "Sum Total",
		average: "Average",
		first: "First Score",
		last: "Last Score",
	}
	return typeMap[scoreType] || scoreType
}
