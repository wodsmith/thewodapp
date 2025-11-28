import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function SeriesDetailLoading() {
	return (
		<div className="container mx-auto px-4 py-8">
			<div className="flex flex-col gap-6">
				{/* Breadcrumb skeleton */}
				<div>
					<Skeleton className="h-5 w-32 mb-4" />
					<div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
						<div>
							<Skeleton className="h-9 w-64 mb-2" />
							<Skeleton className="h-5 w-96" />
						</div>
						<div className="flex gap-2">
							<Skeleton className="h-10 w-40" />
							<Skeleton className="h-10 w-10" />
						</div>
					</div>
				</div>

				{/* Section header skeleton */}
				<div className="flex items-center justify-between">
					<Skeleton className="h-7 w-48" />
				</div>

				{/* Grid skeleton */}
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{Array.from({ length: 3 }).map((_, i) => (
						<Card key={i}>
							<CardHeader>
								<Skeleton className="h-6 w-3/4 mb-2" />
								<Skeleton className="h-4 w-1/2" />
							</CardHeader>
							<CardContent>
								<Skeleton className="h-4 w-full" />
							</CardContent>
						</Card>
					))}
				</div>
			</div>
		</div>
	)
}
