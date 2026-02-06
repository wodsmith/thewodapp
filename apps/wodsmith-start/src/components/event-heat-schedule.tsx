import { useEffect, useState } from "react"
import { Clock, MapPin } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { PublicScheduleHeat } from "@/server-fns/competition-heats-fns"

function formatHeatTime(date: Date, timezone?: string | null): string {
	return new Intl.DateTimeFormat("en-US", {
		weekday: "short",
		hour: "numeric",
		minute: "2-digit",
		timeZone: timezone ?? undefined,
	}).format(new Date(date))
}

interface EventHeatScheduleProps {
	deferredHeats: Promise<{ heats: PublicScheduleHeat[] }>
	timezone: string | null
}

export function EventHeatSchedule({
	deferredHeats,
	timezone,
}: EventHeatScheduleProps) {
	const [heats, setHeats] = useState<PublicScheduleHeat[] | null>(null)

	useEffect(() => {
		let cancelled = false
		deferredHeats.then((data) => {
			if (!cancelled) {
				setHeats(data.heats)
			}
		})
		return () => {
			cancelled = true
		}
	}, [deferredHeats])

	if (!heats || heats.length === 0) {
		return null
	}

	return (
		<div className="border-t pt-4 mt-4">
			<h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
				Heat Schedule
			</h3>
			<div className="space-y-2">
				{heats.map((heat) => (
					<div
						key={heat.id}
						className="flex items-center gap-3 rounded-lg border border-black/5 bg-black/[0.02] px-3 py-2 text-sm dark:border-white/5 dark:bg-white/[0.02]"
					>
						<span className="font-medium tabular-nums shrink-0">
							Heat {heat.heatNumber}
						</span>

						{heat.scheduledTime && (
							<span className="flex items-center gap-1 text-muted-foreground">
								<Clock className="h-3.5 w-3.5" />
								{formatHeatTime(heat.scheduledTime, timezone)}
							</span>
						)}

						{heat.durationMinutes && (
							<span className="text-muted-foreground">
								{heat.durationMinutes} min
							</span>
						)}

						{heat.division && (
							<Badge variant="secondary" className="text-xs">
								{heat.division.label}
							</Badge>
						)}

						{heat.venue && (
							<span className="flex items-center gap-1 text-muted-foreground ml-auto">
								<MapPin className="h-3.5 w-3.5" />
								{heat.venue.name}
							</span>
						)}
					</div>
				))}
			</div>
		</div>
	)
}
