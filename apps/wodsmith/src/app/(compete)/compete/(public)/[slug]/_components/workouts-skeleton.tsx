"use client"

import { Skeleton } from "@/components/ui/skeleton"

export function WorkoutsSkeleton() {
	return (
		<div className="container mx-auto px-4 py-8">
			<div className="max-w-4xl">
				<div className="flex items-center gap-2 mb-6">
					<Skeleton className="h-8 w-32" />
					<Skeleton className="h-6 w-20" />
				</div>

				<div className="space-y-4">
					{[1, 2, 3].map((i) => (
						<div key={i} className="rounded-lg border p-6 space-y-4">
							<div className="flex items-center gap-3">
								<Skeleton className="w-10 h-10 rounded-lg" />
								<div className="space-y-2">
									<Skeleton className="h-6 w-48" />
									<Skeleton className="h-4 w-24" />
								</div>
							</div>
							<Skeleton className="h-20 w-full" />
							<div className="flex gap-2">
								<Skeleton className="h-6 w-16 rounded-full" />
								<Skeleton className="h-6 w-20 rounded-full" />
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	)
}
