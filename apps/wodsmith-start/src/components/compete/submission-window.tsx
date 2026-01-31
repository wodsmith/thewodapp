import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter"
import { X } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { cn } from "@/utils/cn"

interface Workout {
	id: string
	name: string
	trackWorkoutId: string
}

interface SubmissionWindowProps {
	window: {
		id?: string
		submissionOpensAt: string | null
		submissionClosesAt: string | null
	}
	workouts: Workout[]
	instanceId: symbol
	timezone: string // IANA timezone (e.g., "America/Denver")
	onUpdateWindow: (updates: {
		submissionOpensAt?: string | null
		submissionClosesAt?: string | null
	}) => void
	onRemoveWorkout: (workoutId: string) => void
	className?: string
}

export function SubmissionWindow({
	window,
	workouts,
	instanceId,
	timezone,
	onUpdateWindow,
	onRemoveWorkout,
	className,
}: SubmissionWindowProps) {
	const dropRef = useRef<HTMLDivElement>(null)
	const [isDraggedOver, setIsDraggedOver] = useState(false)
	const isDraggedOverRef = useRef(false)

	const updateIsDraggedOver = useCallback((value: boolean) => {
		isDraggedOverRef.current = value
		setIsDraggedOver(value)
	}, [])

	useEffect(() => {
		const element = dropRef.current
		if (!element) return

		return dropTargetForElements({
			element,
			canDrop: ({ source }) => {
				// Accept drops from workout items with matching instanceId
				return (
					source.data.instanceId === instanceId &&
					source.data.type === "workout-pool" &&
					typeof source.data.workoutId === "string"
				)
			},
			getData: () => ({ windowId: window.id }),
			onDragEnter: () => updateIsDraggedOver(true),
			onDragLeave: () => updateIsDraggedOver(false),
			onDrop: () => {
				updateIsDraggedOver(false)
				// Drop handling is managed by parent component
				// This component just provides visual feedback
			},
		})
	}, [window.id, instanceId, updateIsDraggedOver])

	// Convert UTC ISO string to datetime-local format in competition timezone
	const formatDatetimeLocal = (isoString: string | null): string => {
		if (!isoString) return ""
		const date = new Date(isoString)
		// Format in the competition's timezone
		const formatter = new Intl.DateTimeFormat("en-CA", {
			timeZone: timezone,
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			hour12: false,
		})
		const parts = formatter.formatToParts(date)
		const getPart = (type: string) =>
			parts.find((p) => p.type === type)?.value || ""
		return `${getPart("year")}-${getPart("month")}-${getPart("day")}T${getPart("hour")}:${getPart("minute")}`
	}

	// Convert datetime-local value (in competition timezone) to UTC ISO string
	const handleDatetimeChange = (
		field: "submissionOpensAt" | "submissionClosesAt",
		value: string,
	) => {
		if (!value) {
			onUpdateWindow({ [field]: null })
			return
		}
		// Parse the datetime-local value and convert to UTC
		// datetime-local format: YYYY-MM-DDTHH:mm
		const [datePart, timePart] = value.split("T")
		const [year, month, day] = datePart.split("-").map(Number)
		const [hour, minute] = timePart.split(":").map(Number)

		// Create a UTC timestamp treating the input components as-if they were UTC
		// This avoids browser local timezone interference
		const pseudoUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0)
		const pseudoUtcDate = new Date(pseudoUtcMs)

		// Use Intl to get the UTC offset for this timezone at this date
		const utcFormatter = new Intl.DateTimeFormat("en-US", {
			timeZone: timezone,
			timeZoneName: "shortOffset",
		})
		const tzParts = utcFormatter.formatToParts(pseudoUtcDate)
		const offsetStr =
			tzParts.find((p) => p.type === "timeZoneName")?.value || ""

		// Parse offset like "GMT-7" or "GMT+5:30"
		const offsetMatch = offsetStr.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/)
		let offsetMinutes = 0
		if (offsetMatch) {
			const sign = offsetMatch[1] === "+" ? 1 : -1
			const hours = parseInt(offsetMatch[2], 10)
			const mins = offsetMatch[3] ? parseInt(offsetMatch[3], 10) : 0
			offsetMinutes = sign * (hours * 60 + mins)
		}

		// Convert from competition timezone to UTC
		// UTC = local_time - offset (e.g., MST is UTC-7, so 02:00 MST = 09:00 UTC)
		const utcMs = pseudoUtcMs - offsetMinutes * 60 * 1000
		const utcDate = new Date(utcMs)

		onUpdateWindow({ [field]: utcDate.toISOString() })
	}

	// Get timezone abbreviation for display
	const getTimezoneAbbr = (): string => {
		const formatter = new Intl.DateTimeFormat("en-US", {
			timeZone: timezone,
			timeZoneName: "short",
		})
		const parts = formatter.formatToParts(new Date())
		return parts.find((p) => p.type === "timeZoneName")?.value || timezone
	}

	return (
		<Card
			ref={dropRef}
			className={cn(
				"transition-colors",
				isDraggedOver && "border-primary bg-primary/5 ring-2 ring-primary",
				className,
			)}
		>
			<CardHeader className="pb-2">
				<CardTitle className="text-lg">Submission Window</CardTitle>
				<p className="text-sm text-muted-foreground">
					Athletes will see these times when the competition is live
				</p>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="grid gap-4 sm:grid-cols-2">
					<div className="space-y-2">
						<label
							htmlFor={`opens-at-${window.id}`}
							className="text-sm font-medium text-muted-foreground"
						>
							Opens At ({getTimezoneAbbr()})
						</label>
						<Input
							id={`opens-at-${window.id}`}
							type="datetime-local"
							value={formatDatetimeLocal(window.submissionOpensAt)}
							onChange={(e) =>
								handleDatetimeChange("submissionOpensAt", e.target.value)
							}
						/>
					</div>
					<div className="space-y-2">
						<label
							htmlFor={`closes-at-${window.id}`}
							className="text-sm font-medium text-muted-foreground"
						>
							Closes At ({getTimezoneAbbr()})
						</label>
						<Input
							id={`closes-at-${window.id}`}
							type="datetime-local"
							value={formatDatetimeLocal(window.submissionClosesAt)}
							onChange={(e) =>
								handleDatetimeChange("submissionClosesAt", e.target.value)
							}
						/>
					</div>
				</div>

				{workouts.length > 0 ? (
					<div className="space-y-2">
						<h4 className="text-sm font-medium text-muted-foreground">
							Assigned Workouts
						</h4>
						<div className="space-y-2">
							{workouts.map((workout) => (
								<div
									key={workout.id}
									className="flex items-center justify-between rounded-md border bg-card p-3"
								>
									<span className="text-sm font-medium">{workout.name}</span>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onClick={() => onRemoveWorkout(workout.trackWorkoutId)}
										aria-label={`Remove ${workout.name}`}
									>
										<X className="h-4 w-4" />
									</Button>
								</div>
							))}
						</div>
					</div>
				) : (
					<div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
						Drag workouts here to assign them to this window
					</div>
				)}
			</CardContent>
		</Card>
	)
}
