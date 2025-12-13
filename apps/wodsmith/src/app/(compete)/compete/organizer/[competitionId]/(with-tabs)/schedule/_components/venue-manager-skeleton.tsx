import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"

export function VenueManagerSkeleton() {
	return (
		<div className="space-y-4">
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{Array.from({ length: 3 }).map((_, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: stable skeleton pattern
					<Card key={i}>
						<CardContent className="py-4">
							<div className="flex items-center justify-between">
								<div className="space-y-2">
									<Skeleton className="h-5 w-24" />
									<Skeleton className="h-4 w-32" />
								</div>
								<div className="flex gap-2">
									<Skeleton className="h-8 w-8" />
									<Skeleton className="h-8 w-8" />
								</div>
							</div>
						</CardContent>
					</Card>
				))}
			</div>
			<Skeleton className="h-9 w-28" />
		</div>
	)
}
