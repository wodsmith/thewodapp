"use client"

import { useState } from "react"
import { format } from "date-fns"
import { Check, ChevronDown, ChevronRight, Clock, MapPin } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible"
import type {
	EventScoreEntryAthlete,
	HeatScoreGroup as HeatScoreGroupType,
} from "@/server/competition-scores"
import type {
	WorkoutScheme,
	TiebreakScheme,
} from "@/db/schema"
import { ScoreInputRow, type ScoreEntryData } from "./score-input-row"

interface HeatScoreGroupProps {
	heat: HeatScoreGroupType
	/** Map of registrationId -> athlete */
	athleteMap: Map<string, EventScoreEntryAthlete>
	/** Workout config for score input */
	workoutScheme: WorkoutScheme
	/** Score aggregation type */
	scoreType?: string | null
	tiebreakScheme: TiebreakScheme | null
	timeCap?: number
	roundsToScore: number
	showTiebreak: boolean
	/** Current score values by registrationId */
	scores: Record<string, ScoreEntryData>
	/** Saving state by registrationId */
	savingIds: Set<string>
	/** Saved state by registrationId */
	savedIds: Set<string>
	/** Score change handler */
	onScoreChange: (athlete: EventScoreEntryAthlete, data: ScoreEntryData) => void
	/** Tab to next athlete - called with global index */
	onTabNext: (globalIndex: number) => void
	/** Row refs for focus management */
	rowRefs: React.MutableRefObject<Map<string, HTMLDivElement>>
	/** Starting global index for this heat's athletes */
	startIndex: number
	/** Whether this group should be initially open */
	defaultOpen?: boolean
}

export function HeatScoreGroup({
	heat,
	athleteMap,
	workoutScheme,
	scoreType,
	tiebreakScheme,
	timeCap,
	roundsToScore,
	showTiebreak,
	scores,
	savingIds,
	savedIds,
	onScoreChange,
	onTabNext,
	rowRefs,
	startIndex,
	defaultOpen = true,
}: HeatScoreGroupProps) {
	const [isOpen, setIsOpen] = useState(defaultOpen)

	// Get athletes for this heat in lane order
	const heatAthletes = heat.assignments
		.sort((a, b) => a.laneNumber - b.laneNumber)
		.map((assignment) => ({
			...assignment,
			athlete: athleteMap.get(assignment.registrationId),
		}))
		.filter(
			(item): item is typeof item & { athlete: EventScoreEntryAthlete } =>
				item.athlete !== undefined,
		)

	// Calculate completion stats
	const totalAthletes = heatAthletes.length
	const scoredAthletes = heatAthletes.filter(
		(item) => savedIds.has(item.registrationId) || item.athlete.existingResult,
	).length
	const isComplete = scoredAthletes === totalAthletes && totalAthletes > 0

	// Format scheduled time
	const formattedTime = heat.scheduledTime
		? format(new Date(heat.scheduledTime), "h:mm a")
		: null

	return (
		<Collapsible open={isOpen} onOpenChange={setIsOpen}>
			{/* Heat Header */}
			<CollapsibleTrigger asChild>
				<button
					type="button"
					className={cn(
						"w-full flex items-center justify-between gap-4 px-4 py-3 text-left",
						"bg-muted/50 hover:bg-muted/70 transition-colors border-b",
						"focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset",
					)}
				>
					<div className="flex items-center gap-3">
						{isOpen ? (
							<ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
						) : (
							<ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
						)}
						<div className="flex items-center gap-2">
							<span className="font-semibold">Heat {heat.heatNumber}</span>
							{heat.division && (
								<Badge variant="outline" className="text-xs">
									{heat.division.label}
								</Badge>
							)}
						</div>
					</div>

					<div className="flex items-center gap-4 text-sm text-muted-foreground">
						{/* Venue */}
						{heat.venue && (
							<div className="flex items-center gap-1">
								<MapPin className="h-3.5 w-3.5" />
								<span>{heat.venue.name}</span>
							</div>
						)}

						{/* Time */}
						{formattedTime && (
							<div className="flex items-center gap-1">
								<Clock className="h-3.5 w-3.5" />
								<span>{formattedTime}</span>
							</div>
						)}

						{/* Completion Status */}
						{isComplete ? (
							<Badge
								variant="default"
								className="bg-green-600 hover:bg-green-600 text-white"
							>
								<Check className="h-3 w-3 mr-1" />
								Complete
							</Badge>
						) : (
							<Badge variant="secondary">
								{scoredAthletes}/{totalAthletes}
							</Badge>
						)}
					</div>
				</button>
			</CollapsibleTrigger>

			{/* Heat Athletes */}
			<CollapsibleContent>
				{heatAthletes.length === 0 ? (
					<div className="px-4 py-6 text-center text-sm text-muted-foreground">
						No athletes assigned to this heat
					</div>
				) : (
					<div>
						{heatAthletes.map((item, index) => (
							<div
								key={item.registrationId}
								ref={(el) => {
									if (el) {
										rowRefs.current.set(item.registrationId, el)
									}
								}}
							>
								<ScoreInputRow
									athlete={item.athlete}
									laneNumber={item.laneNumber}
									workoutScheme={workoutScheme}
									scoreType={scoreType as import("@/db/schema").ScoreType | undefined}
									tiebreakScheme={tiebreakScheme}
									timeCap={timeCap}
									roundsToScore={roundsToScore}
									showTiebreak={showTiebreak}
									value={scores[item.registrationId]}
									isSaving={savingIds.has(item.registrationId)}
									isSaved={savedIds.has(item.registrationId)}
									onChange={(data) => onScoreChange(item.athlete, data)}
									onTabNext={() => onTabNext(startIndex + index)}
								/>
							</div>
						))}
					</div>
				)}
			</CollapsibleContent>
		</Collapsible>
	)
}
