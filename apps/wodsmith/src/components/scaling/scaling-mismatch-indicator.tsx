"use client"

import { AlertCircle } from "lucide-react"
import type { ReactElement } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip"
import type { ProgrammingTrack, ScalingGroup, Workout } from "@/db/schema"

interface ScalingMismatchIndicatorProps {
	workout: Pick<Workout, "id" | "name" | "scalingGroupId">
	track?: Pick<ProgrammingTrack, "id" | "name" | "scalingGroupId">
	workoutScalingGroup?: Pick<ScalingGroup, "id" | "title">
	trackScalingGroup?: Pick<ScalingGroup, "id" | "title">
	onAlignScaling?: () => void | Promise<void>
	canEdit?: boolean
	variant?: "badge" | "inline"
	className?: string
}

export function ScalingMismatchIndicator({
	workout,
	track,
	workoutScalingGroup,
	trackScalingGroup,
	onAlignScaling,
	canEdit = false,
	variant = "badge",
	className = "",
}: ScalingMismatchIndicatorProps): ReactElement | null {
	// Check if there's a mismatch
	const hasMismatch =
		track &&
		workout.scalingGroupId !== track.scalingGroupId &&
		track.scalingGroupId !== null

	if (!hasMismatch) {
		return null
	}

	const indicator = (
		<Badge
			variant="outline"
			className={`border-amber-500 text-amber-700 dark:text-amber-400 ${className}`}
		>
			<AlertCircle className="h-3 w-3 mr-1" />
			Different Scaling
		</Badge>
	)

	if (variant === "inline") {
		return (
			<div className="flex items-center gap-2">
				{indicator}
				{canEdit && onAlignScaling && (
					<Button
						size="sm"
						variant="outline"
						onClick={onAlignScaling}
						className="h-6 text-xs"
					>
						Align with Track
					</Button>
				)}
			</div>
		)
	}

	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>{indicator}</TooltipTrigger>
				<TooltipContent className="max-w-xs">
					<div className="space-y-3">
						<p className="font-semibold text-sm">Scaling Mismatch</p>
						<p className="text-xs">
							This workout uses different scaling than the track default.
						</p>
						<div className="space-y-1 text-xs">
							<div className="flex gap-2">
								<span className="text-muted-foreground">Workout:</span>
								<span className="font-medium">
									{workoutScalingGroup?.title || "Default"}
								</span>
							</div>
							<div className="flex gap-2">
								<span className="text-muted-foreground">Track:</span>
								<span className="font-medium">
									{trackScalingGroup?.title || "Default"}
								</span>
							</div>
						</div>
						{canEdit && onAlignScaling && (
							<Button
								size="sm"
								variant="default"
								onClick={onAlignScaling}
								className="w-full"
							>
								Align with Track
							</Button>
						)}
					</div>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	)
}
