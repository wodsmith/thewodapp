import { Skeleton } from "@/components/ui/skeleton"

export function CalendarSkeleton() {
	// Fixed pattern for events to avoid random re-renders
	const eventPattern = [
		false,
		false,
		true,
		false,
		false,
		true,
		false, // Week 1
		true,
		false,
		false,
		true,
		false,
		false,
		true, // Week 2
		false,
		true,
		false,
		false,
		true,
		false,
		false, // Week 3
		false,
		false,
		true,
		false,
		false,
		true,
		true, // Week 4
		true,
		false,
		false,
		false,
		true,
		false,
		false, // Week 5
		false,
		true,
		false,
		true,
		false,
		false,
		false, // Week 6
	]

	return (
		<div className="space-y-4">
			{/* Header toolbar skeleton - matching the brutalist styling */}
			<div className="border-4 border-border bg-background p-2 rounded-none mb-4">
				<div className="flex items-center justify-between">
					<div className="flex items-center space-x-2">
						{/* Previous, Next, Today buttons */}
						<Skeleton className="h-10 w-16 rounded-none" />
						<Skeleton className="h-10 w-16 rounded-none" />
						<Skeleton className="h-10 w-16 rounded-none" />
					</div>
					{/* Month/Year title */}
					<Skeleton className="h-8 w-48 rounded-none" />
					<div className="flex items-center space-x-2">
						{/* View buttons */}
						<Skeleton className="h-10 w-20 rounded-none" />
						<Skeleton className="h-10 w-16 rounded-none" />
						<Skeleton className="h-10 w-12 rounded-none" />
					</div>
				</div>
			</div>

			{/* Calendar grid skeleton - matching the brutalist styling */}
			<div className="border-4 border-border rounded-none">
				{/* Days of week header */}
				<div className="grid grid-cols-7 bg-muted border-b-4 border-border">
					{["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((day, i) => (
						<div
							key={day}
							className="border-r-2 border-border last:border-r-0 p-3"
						>
							<Skeleton className="h-4 w-8 mx-auto rounded-none" />
						</div>
					))}
				</div>

				{/* Calendar days grid - 6 weeks */}
				<div className="grid grid-cols-7">
					{Array.from({ length: 42 }).map((_, i) => {
						const hasEvent = eventPattern[i]
						const hasMultipleEvents = hasEvent && (i % 7 === 2 || i % 7 === 5) // Pattern for multiple events
						const isToday = i === 15 // Mock today highlighting

						return (
							<div
								// biome-ignore lint/suspicious/noArrayIndexKey: stable skeleton pattern
								key={i}
								className={`min-h-[100px] border-r-2 border-b-2 border-border last:border-r-0 p-2 space-y-2 ${
									isToday ? "bg-orange/10" : "bg-background"
								}`}
							>
								{/* Day number */}
								<Skeleton
									className={`h-5 w-6 rounded-none ${
										isToday ? "bg-orange/30" : ""
									}`}
								/>

								{/* Event skeletons - mimicking workout events */}
								{hasEvent && (
									<div className="space-y-1">
										<Skeleton className="h-6 w-full rounded-none bg-primary/30 border-2 border-foreground/20" />
										{hasMultipleEvents && (
											<Skeleton className="h-6 w-4/5 rounded-none bg-primary/30 border-2 border-foreground/20" />
										)}
									</div>
								)}
							</div>
						)
					})}
				</div>
			</div>
		</div>
	)
}
