"use client"

import { Skeleton } from "@/components/ui/skeleton"

export function ScheduleSkeleton() {
	return (
		<div className="container mx-auto py-8 space-y-6">
			{/* Search skeleton */}
			<div className="max-w-xl mx-auto">
				<Skeleton className="h-10 w-full" />
			</div>

			{/* Day tabs skeleton */}
			<div className="flex justify-center border-b gap-2">
				<Skeleton className="h-10 w-20" />
				<Skeleton className="h-10 w-24" />
				<Skeleton className="h-10 w-24" />
			</div>

			{/* Schedule content skeleton */}
			<div className="rounded-lg border overflow-hidden">
				{/* Day header */}
				<div className="bg-muted px-4 py-2 border-b">
					<Skeleton className="h-4 w-32" />
				</div>

				{/* Workout items */}
				<div className="divide-y">
					{[1, 2, 3, 4].map((i) => (
						<div key={i} className="px-4 py-4 flex items-center gap-4">
							<Skeleton className="w-12 h-12 rounded-lg flex-shrink-0" />
							<div className="flex-1 space-y-2">
								<Skeleton className="h-5 w-48" />
								<div className="flex items-center gap-3">
									<Skeleton className="h-4 w-24" />
									<Skeleton className="h-5 w-16 rounded-full" />
								</div>
							</div>
							<Skeleton className="h-5 w-5" />
						</div>
					))}
				</div>
			</div>
		</div>
	)
}
