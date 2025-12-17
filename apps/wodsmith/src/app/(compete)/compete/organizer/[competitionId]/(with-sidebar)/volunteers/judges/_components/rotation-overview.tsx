"use client"

import { AlertCircle, CheckCircle2, XCircle } from "lucide-react"
import { useMemo } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import type { CompetitionJudgeRotation } from "@/db/schema"
import type { CoverageStats } from "@/lib/judge-rotation-utils"

interface RotationOverviewProps {
	rotations: CompetitionJudgeRotation[]
	coverage: CoverageStats
	eventName: string
}

/**
 * Shows event coverage summary with metrics, gaps, and overlaps.
 * Displays actual coverage percentage and identifies issues.
 */
export function RotationOverview({
	rotations,
	coverage,
	eventName,
}: RotationOverviewProps) {
	const hasGaps = coverage.gaps.length > 0
	const hasOverlaps = coverage.overlaps.length > 0
	const isPerfect = !hasGaps && !hasOverlaps && coverage.coveragePercent === 100

	// Group gaps by heat
	const gapsByHeat = useMemo(() => {
		const grouped = new Map<number, number[]>()
		for (const gap of coverage.gaps) {
			const lanes = grouped.get(gap.heatNumber) || []
			lanes.push(gap.laneNumber)
			grouped.set(gap.heatNumber, lanes)
		}
		return grouped
	}, [coverage.gaps])

	// Group overlaps by heat
	const overlapsByHeat = useMemo(() => {
		const grouped = new Map<number, number[]>()
		for (const overlap of coverage.overlaps) {
			const lanes = grouped.get(overlap.heatNumber) || []
			lanes.push(overlap.laneNumber)
			grouped.set(overlap.heatNumber, lanes)
		}
		return grouped
	}, [coverage.overlaps])

	return (
		<div className="space-y-4">
			{/* Coverage Metric */}
			<div className="flex items-center gap-4">
				<div className="flex items-center gap-2">
					{isPerfect ? (
						<CheckCircle2 className="h-5 w-5 text-green-600" />
					) : hasGaps || hasOverlaps ? (
						<AlertCircle className="h-5 w-5 text-orange-600" />
					) : (
						<CheckCircle2 className="h-5 w-5 text-blue-600" />
					)}
					<div>
						<p className="text-sm font-medium">
							{eventName} Coverage:{" "}
							<span
								className={`text-lg tabular-nums ${
									isPerfect
										? "text-green-600"
										: hasGaps
											? "text-orange-600"
											: "text-blue-600"
								}`}
							>
								{coverage.coveragePercent}%
							</span>
						</p>
						<p className="text-xs text-muted-foreground tabular-nums">
							{coverage.coveredSlots}/{coverage.totalSlots} slots covered
						</p>
					</div>
				</div>
				<div className="flex-1" />
				<Badge variant="secondary" className="tabular-nums">
					{rotations.length} rotation{rotations.length !== 1 ? "s" : ""}
				</Badge>
			</div>

			{/* Gaps Alert */}
			{hasGaps && (
				<Alert variant="destructive">
					<XCircle className="h-4 w-4" />
					<AlertTitle>Missing Coverage ({coverage.gaps.length} slots)</AlertTitle>
					<AlertDescription>
						<div className="mt-2 space-y-1 text-sm">
							{Array.from(gapsByHeat.entries())
								.sort(([a], [b]) => a - b)
								.map(([heat, lanes]) => (
									<div key={heat}>
										<span className="font-medium">Heat {heat}:</span> Lanes{" "}
										{lanes.sort((a, b) => a - b).join(", ")}
									</div>
								))}
						</div>
					</AlertDescription>
				</Alert>
			)}

			{/* Overlaps Alert */}
			{hasOverlaps && (
				<Alert>
					<AlertCircle className="h-4 w-4" />
					<AlertTitle>
						Overlapping Assignments ({coverage.overlaps.length} slots)
					</AlertTitle>
					<AlertDescription>
						<div className="mt-2 space-y-1 text-sm">
							{Array.from(overlapsByHeat.entries())
								.sort(([a], [b]) => a - b)
								.map(([heat, lanes]) => (
									<div key={heat}>
										<span className="font-medium">Heat {heat}:</span> Lanes{" "}
										{lanes.sort((a, b) => a - b).join(", ")} (multiple judges)
									</div>
								))}
						</div>
					</AlertDescription>
				</Alert>
			)}

			{/* Perfect Coverage */}
			{isPerfect && (
				<Alert className="border-green-600/50 bg-green-50 dark:bg-green-950/20">
					<CheckCircle2 className="h-4 w-4 text-green-600" />
					<AlertTitle className="text-green-600">Perfect Coverage</AlertTitle>
					<AlertDescription className="text-green-600/90">
						All {coverage.totalSlots} slots have exactly one judge assigned. No
						gaps or conflicts.
					</AlertDescription>
				</Alert>
			)}
		</div>
	)
}
