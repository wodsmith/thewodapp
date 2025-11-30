"use client"

import { useServerAction } from "@repo/zsa-react"
import { Check, Clock, MapPin, Users, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip"
import type { HeatWithDetails } from "@/server/competition-schedule"
import {
	checkInAthleteAction,
	undoCheckInAction,
} from "@/actions/competition-schedule-actions"

interface HeatCardProps {
	heat: HeatWithDetails
	competitionId: string
}

export function HeatCard({ heat, competitionId }: HeatCardProps) {
	const checkIn = useServerAction(checkInAthleteAction)
	const undoCheckIn = useServerAction(undoCheckInAction)

	const formatTime = (date: Date) => {
		return new Date(date).toLocaleTimeString(undefined, {
			hour: "numeric",
			minute: "2-digit",
		})
	}

	const handleCheckIn = async (assignmentId: string) => {
		await checkIn.execute({
			competitionId,
			assignmentId,
		})
	}

	const handleUndoCheckIn = async (assignmentId: string) => {
		await undoCheckIn.execute({
			competitionId,
			assignmentId,
		})
	}

	const checkedInCount = heat.assignments.filter((a) => a.checkInAt).length

	return (
		<Card>
			<CardHeader className="pb-2">
				<div className="flex items-center justify-between">
					<CardTitle className="text-lg">Heat {heat.heatNumber}</CardTitle>
					{heat.targetDivision && (
						<Badge variant="secondary">{heat.targetDivision.label}</Badge>
					)}
				</div>
				<CardDescription className="flex items-center gap-4">
					<span className="flex items-center gap-1">
						<Clock className="h-3 w-3" />
						{formatTime(heat.startTime)}
					</span>
					<span className="flex items-center gap-1">
						<MapPin className="h-3 w-3" />
						{heat.floor.name}
					</span>
					<span className="flex items-center gap-1">
						<Users className="h-3 w-3" />
						{heat.assignments.length}
					</span>
				</CardDescription>
			</CardHeader>
			<CardContent>
				{heat.assignments.length === 0 ? (
					<div className="text-sm text-muted-foreground text-center py-2">
						No athletes assigned
					</div>
				) : (
					<div className="space-y-2">
						<div className="text-xs text-muted-foreground">
							Check-in: {checkedInCount}/{heat.assignments.length}
						</div>
						<div className="space-y-1">
							{heat.assignments.map((assignment) => {
								const athleteName =
									assignment.registration.teamName ??
									[
										assignment.registration.user.firstName,
										assignment.registration.user.lastName,
									]
										.filter(Boolean)
										.join(" ") ??
									"Unknown"

								return (
									<div
										key={assignment.id}
										className="flex items-center justify-between text-sm py-1 px-2 rounded hover:bg-muted/50"
									>
										<div className="flex items-center gap-2">
											{assignment.laneNumber && (
												<span className="text-xs text-muted-foreground w-6">
													L{assignment.laneNumber}
												</span>
											)}
											<span>{athleteName}</span>
											{assignment.registration.division && (
												<Badge variant="outline" className="text-xs">
													{assignment.registration.division.label}
												</Badge>
											)}
										</div>
										<TooltipProvider>
											<Tooltip>
												<TooltipTrigger asChild>
													{assignment.checkInAt ? (
														<Button
															variant="ghost"
															size="icon"
															className="h-6 w-6"
															onClick={() => handleUndoCheckIn(assignment.id)}
															disabled={undoCheckIn.isPending}
														>
															<Check className="h-4 w-4 text-green-600" />
														</Button>
													) : (
														<Button
															variant="ghost"
															size="icon"
															className="h-6 w-6"
															onClick={() => handleCheckIn(assignment.id)}
															disabled={checkIn.isPending}
														>
															<X className="h-4 w-4 text-muted-foreground" />
														</Button>
													)}
												</TooltipTrigger>
												<TooltipContent>
													{assignment.checkInAt
														? "Click to undo check-in"
														: "Click to check in"}
												</TooltipContent>
											</Tooltip>
										</TooltipProvider>
									</div>
								)
							})}
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	)
}
