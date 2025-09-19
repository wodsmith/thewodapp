import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function Loading() {
	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<Skeleton className="h-6 w-48 mb-1" />
				</CardHeader>
				<CardContent className="space-y-4">
					<div>
						<Skeleton className="h-4 w-16 mb-2" />
						<Skeleton className="h-10 w-full" />
					</div>
					<Skeleton className="h-10 w-32" />
				</CardContent>
			</Card>

			<div className="grid gap-6">
				{[1, 2].map((i) => (
					<Card key={i}>
						<CardHeader>
							<Skeleton className="h-6 w-40 mb-1" />
							<Skeleton className="h-4 w-24" />
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="grid gap-2">
								<div className="flex items-center justify-between p-2 border rounded">
									<div className="flex items-center space-x-2">
										<Skeleton className="h-4 w-4" />
										<Skeleton className="h-4 w-32" />
									</div>
									<Skeleton className="h-4 w-20" />
								</div>
								<div className="flex items-center justify-between p-2 border rounded">
									<div className="flex items-center space-x-2">
										<Skeleton className="h-4 w-4" />
										<Skeleton className="h-4 w-36" />
									</div>
									<Skeleton className="h-4 w-20" />
								</div>
							</div>
							<div className="flex gap-2">
								<Skeleton className="h-9 w-24" />
								<Skeleton className="h-9 w-24" />
							</div>
						</CardContent>
					</Card>
				))}
			</div>
		</div>
	)
}
