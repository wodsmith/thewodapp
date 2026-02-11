import type { PublicScheduleEvent } from "@/server-fns/competition-heats-fns"

export interface WorkoutScheduleInfo {
	startTime: string
	endTime: string | null
	heatCount: number
	venueName: string | null
	divisions: string[]
}

function formatScheduleTime(
	date: Date | string | number,
	timezone: string,
): string {
	const d = date instanceof Date ? date : new Date(date)
	return d.toLocaleTimeString("en-US", {
		timeZone: timezone,
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	})
}

type HeatType = PublicScheduleEvent["heats"][number]

export function buildScheduleMap(
	events: PublicScheduleEvent[],
	timezone: string,
): Map<string, WorkoutScheduleInfo> {
	const map = new Map<string, WorkoutScheduleInfo>()

	for (const event of events) {
		const scheduledHeats = event.heats.filter(
			(h): h is HeatType & { scheduledTime: Date } => h.scheduledTime != null,
		)
		if (scheduledHeats.length === 0) continue

		const sortedHeats = [...scheduledHeats].sort((a, b) => {
			return (
				new Date(a.scheduledTime).getTime() -
				new Date(b.scheduledTime).getTime()
			)
		})

		const firstHeat = sortedHeats[0]
		const lastHeat = sortedHeats[sortedHeats.length - 1]

		const startTime = formatScheduleTime(firstHeat.scheduledTime, timezone)

		let endTime: string | null = null
		if (lastHeat.scheduledTime && lastHeat.durationMinutes) {
			const endDate = new Date(
				new Date(lastHeat.scheduledTime).getTime() +
					lastHeat.durationMinutes * 60 * 1000,
			)
			endTime = formatScheduleTime(endDate, timezone)
		}

		const venues = [
			...new Set(
				scheduledHeats
					.map((h) => h.venue?.name)
					.filter((n): n is string => !!n),
			),
		]

		const divisions = [
			...new Map(
				scheduledHeats
					.filter(
						(h): h is typeof h & { division: NonNullable<typeof h.division> } =>
							h.division != null,
					)
					.map((h) => [h.division.id, h.division.label]),
			).values(),
		]

		map.set(event.trackWorkoutId, {
			startTime,
			endTime,
			heatCount: scheduledHeats.length,
			venueName: venues.length > 0 ? venues.join(", ") : null,
			divisions,
		})
	}

	return map
}
