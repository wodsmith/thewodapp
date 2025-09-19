import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function Loading() {
	return (
		<div className="min-h-screen">
			<header className="border-b">
				<div className="container mx-auto px-6 py-4">
					<div className="flex items-center space-x-3">
						<Skeleton className="h-6 w-6" />
						<div>
							<Skeleton className="h-8 w-48 mb-2" />
							<Skeleton className="h-4 w-64" />
						</div>
					</div>
				</div>
			</header>

			<main className="container mx-auto px-6 py-8">
				<div className="grid lg:grid-cols-2 gap-8">
					<Card>
						<CardHeader>
							<Skeleton className="h-6 w-40 mb-1" />
							<Skeleton className="h-4 w-56" />
						</CardHeader>
						<CardContent className="space-y-4">
							<div>
								<Skeleton className="h-4 w-24 mb-2" />
								<Skeleton className="h-10 w-full" />
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<Skeleton className="h-6 w-32 mb-1" />
							<Skeleton className="h-4 w-64" />
						</CardHeader>
						<CardContent className="space-y-4">
							<Skeleton className="h-10 w-full" />
							<div className="flex flex-wrap gap-2">
								<Skeleton className="h-6 w-24" />
								<Skeleton className="h-6 w-28" />
								<Skeleton className="h-6 w-20" />
							</div>
						</CardContent>
					</Card>
				</div>

				<Card className="mt-8">
					<CardHeader>
						<div className="flex items-center space-x-2">
							<Skeleton className="h-5 w-5" />
							<Skeleton className="h-6 w-32" />
						</div>
						<Skeleton className="h-4 w-56" />
					</CardHeader>
					<CardContent className="space-y-6">
						<div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
							<div>
								<Skeleton className="h-4 w-32 mb-2" />
								<Skeleton className="h-10 w-full" />
							</div>
							<div>
								<Skeleton className="h-4 w-24 mb-2" />
								<Skeleton className="h-10 w-full" />
							</div>
							<Skeleton className="h-10 w-full" />
						</div>

						<div className="grid gap-4">
							{[1, 2].map((i) => (
								<div
									key={i}
									className="flex items-center justify-between p-4 rounded-lg border"
								>
									<div className="flex items-center space-x-4">
										<Skeleton className="h-8 w-8 rounded-lg" />
										<div>
											<Skeleton className="h-5 w-36 mb-1" />
											<Skeleton className="h-4 w-48" />
										</div>
									</div>
									<Skeleton className="h-8 w-8" />
								</div>
							))}
						</div>
					</CardContent>
				</Card>
			</main>
		</div>
	)
}
