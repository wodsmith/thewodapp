import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function CompetitionDetailLoading() {
	return (
		<div className="container mx-auto px-4 py-8">
			<div className="flex flex-col gap-6">
				{/* Breadcrumb skeleton */}
				<div>
					<Skeleton className="h-5 w-32 mb-4" />
					<Skeleton className="h-4 w-64 mb-2" />
					<Skeleton className="h-9 w-72" />
				</div>

				{/* Tabs skeleton */}
				<div className="border-b">
					<div className="flex gap-4">
						<Skeleton className="h-10 w-24" />
						<Skeleton className="h-10 w-24" />
						<Skeleton className="h-10 w-24" />
					</div>
				</div>

				{/* Cards skeleton */}
				<Card>
					<CardHeader>
						<Skeleton className="h-6 w-48 mb-2" />
						<Skeleton className="h-4 w-64" />
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="grid gap-4 md:grid-cols-2">
							<div>
								<Skeleton className="h-4 w-32 mb-2" />
								<Skeleton className="h-4 w-48" />
							</div>
							<div>
								<Skeleton className="h-4 w-32 mb-2" />
								<Skeleton className="h-4 w-48" />
							</div>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<Skeleton className="h-6 w-32 mb-2" />
						<Skeleton className="h-4 w-48" />
					</CardHeader>
					<CardContent>
						<Skeleton className="h-20 w-full" />
					</CardContent>
				</Card>
			</div>
		</div>
	)
}
