import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function HeatScheduleSkeleton() {
	return (
		<div className="space-y-6">
			{/* Event Overview skeleton */}
			<Card>
				<CardHeader className="pb-3">
					<Skeleton className="h-5 w-32" />
				</CardHeader>
				<CardContent>
					<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
						{Array.from({ length: 4 }).map((_, i) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: stable skeleton pattern
							<div key={i} className="flex items-center gap-3">
								<Skeleton className="h-8 w-8 rounded-full" />
								<div className="space-y-1.5">
									<Skeleton className="h-4 w-28" />
									<Skeleton className="h-3 w-16" />
								</div>
							</div>
						))}
					</div>
				</CardContent>
			</Card>

			{/* Controls skeleton */}
			<div className="flex flex-wrap items-center gap-4">
				<div className="flex items-center gap-2">
					<Skeleton className="h-4 w-12" />
					<Skeleton className="h-10 w-[250px]" />
				</div>
				<div className="flex items-center gap-2">
					<Skeleton className="h-4 w-12" />
					<Skeleton className="h-10 w-[180px]" />
				</div>
				<Skeleton className="h-9 w-24" />
			</div>

			{/* Stats skeleton */}
			<div className="flex gap-4">
				<Skeleton className="h-4 w-16" />
				<Skeleton className="h-4 w-20" />
				<Skeleton className="h-4 w-24" />
			</div>

			{/* Heat Grid + Unassigned Panel skeleton */}
			<div className="grid gap-6 lg:grid-cols-3">
				{/* Heats Column */}
				<div className="lg:col-span-2 space-y-4">
					{Array.from({ length: 3 }).map((_, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: stable skeleton pattern
						<Card key={i}>
							<CardHeader className="pb-3">
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2">
										<Skeleton className="h-5 w-20" />
										<Skeleton className="h-5 w-12" />
									</div>
									<Skeleton className="h-8 w-8" />
								</div>
								<div className="flex items-center gap-4">
									<Skeleton className="h-4 w-32" />
									<Skeleton className="h-4 w-24" />
								</div>
							</CardHeader>
							<CardContent>
								<div className="space-y-2">
									{Array.from({ length: 4 }).map((_, j) => (
										// biome-ignore lint/suspicious/noArrayIndexKey: stable skeleton pattern
										<div key={j} className="flex items-center gap-3 py-1">
											<Skeleton className="h-4 w-6" />
											<Skeleton className="h-4 flex-1" />
											<Skeleton className="h-5 w-16" />
										</div>
									))}
								</div>
							</CardContent>
						</Card>
					))}
				</div>

				{/* Unassigned Athletes Panel skeleton */}
				<div>
					<Card>
						<CardHeader className="pb-3">
							<div className="flex items-center justify-between">
								<Skeleton className="h-5 w-36" />
							</div>
							<Skeleton className="h-10 w-full mt-2" />
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								{Array.from({ length: 2 }).map((_, i) => (
									// biome-ignore lint/suspicious/noArrayIndexKey: stable skeleton pattern
									<div key={i}>
										<Skeleton className="h-4 w-24 mb-2" />
										<div className="space-y-1">
											{Array.from({ length: 4 }).map((_, j) => (
												// biome-ignore lint/suspicious/noArrayIndexKey: stable skeleton pattern
												<Skeleton key={j} className="h-8 w-full" />
											))}
										</div>
									</div>
								))}
							</div>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	)
}
