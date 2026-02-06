import { useEffect, useState } from "react"
import type { PublicScheduleEvent } from "@/server-fns/competition-heats-fns"
import {
	buildScheduleMap,
	type WorkoutScheduleInfo,
} from "@/utils/schedule-map"

export function useDeferredSchedule(
	deferredSchedule: Promise<{ events: PublicScheduleEvent[] }>,
	timezone: string,
): Map<string, WorkoutScheduleInfo> | null {
	const [scheduleMap, setScheduleMap] = useState<Map<
		string,
		WorkoutScheduleInfo
	> | null>(null)

	useEffect(() => {
		let cancelled = false
		deferredSchedule.then((data) => {
			if (!cancelled && data.events.length > 0) {
				setScheduleMap(buildScheduleMap(data.events, timezone))
			}
		})
		return () => {
			cancelled = true
		}
	}, [deferredSchedule, timezone])

	return scheduleMap
}
