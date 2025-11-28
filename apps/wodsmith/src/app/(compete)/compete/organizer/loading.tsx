import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function OrganizerLoading() {
	return (
		<div className="container mx-auto px-4 py-8">
			<div className="flex flex-col gap-6">
				{/* Header skeleton */}
				<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
					<div>
						<Skeleton className="h-9 w-48 mb-2" />
						<Skeleton className="h-5 w-64" />
					</div>
					<div className="flex gap-2">
						<Skeleton className="h-10 w-32" />
						<Skeleton className="h-10 w-40" />
					</div>
				</div>

				{/* Grid skeleton */}
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{Array.from({ length: 6 }).map((_, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: static skeleton content
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
