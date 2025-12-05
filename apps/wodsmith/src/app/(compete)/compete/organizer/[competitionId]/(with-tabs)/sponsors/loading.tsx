import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function SponsorsLoading() {
	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<Skeleton className="h-8 w-32" />
					<Skeleton className="mt-2 h-4 w-64" />
				</div>
				<div className="flex gap-2">
					<Skeleton className="h-10 w-28" />
					<Skeleton className="h-10 w-32" />
				</div>
			</div>

			{/* Stats */}
			<div className="grid gap-4 md:grid-cols-3">
				{[1, 2, 3].map((i) => (
					<Card key={i}>
						<CardHeader className="pb-2">
							<Skeleton className="h-4 w-24" />
						</CardHeader>
						<CardContent>
							<Skeleton className="h-8 w-12" />
						</CardContent>
					</Card>
				))}
			</div>

			{/* Sponsor Groups */}
			<div className="space-y-4">
				{[1, 2].map((i) => (
					<Card key={i}>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<div>
								<Skeleton className="h-6 w-32" />
								<Skeleton className="mt-1 h-4 w-20" />
							</div>
							<div className="flex gap-2">
								<Skeleton className="h-9 w-28" />
								<Skeleton className="h-9 w-9" />
							</div>
						</CardHeader>
						<CardContent>
							<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
								{[1, 2, 3].map((j) => (
									<div
										key={j}
										className="flex flex-col items-center rounded-lg border p-4"
									>
										<Skeleton className="h-20 w-40" />
										<Skeleton className="mt-2 h-4 w-24" />
									</div>
								))}
							</div>
						</CardContent>
					</Card>
				))}
			</div>
		</div>
	)
}
