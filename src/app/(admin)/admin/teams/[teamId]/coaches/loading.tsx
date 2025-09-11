import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function Loading() {
	return (
		<div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
			<header className="bg-white/80 backdrop-blur-md border-b border-white/20 sticky top-0 z-50">
				<div className="container mx-auto px-6 py-4">
					<div className="flex items-center space-x-3">
						<Skeleton className="h-10 w-10 rounded-xl" />
						<div>
							<Skeleton className="h-8 w-48 mb-2" />
							<Skeleton className="h-4 w-64" />
						</div>
					</div>
				</div>
			</header>

			<main className="container mx-auto px-6 py-8">
				<Card className="bg-white/60 backdrop-blur-sm border-white/20 mb-8">
					<CardHeader>
						<Skeleton className="h-6 w-32 mb-1" />
						<Skeleton className="h-4 w-48" />
					</CardHeader>
					<CardContent className="space-y-4">
						<div>
							<Skeleton className="h-4 w-32 mb-2" />
							<Skeleton className="h-10 w-full" />
						</div>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<Skeleton className="h-4 w-32 mb-2" />
								<Skeleton className="h-10 w-full" />
							</div>
							<div>
								<Skeleton className="h-4 w-32 mb-2" />
								<Skeleton className="h-10 w-full" />
							</div>
						</div>
						<div>
							<Skeleton className="h-4 w-32 mb-2" />
							<Skeleton className="h-10 w-full mb-2" />
							<div className="flex flex-wrap gap-2">
								<Skeleton className="h-6 w-20" />
								<Skeleton className="h-6 w-24" />
							</div>
						</div>
						<Skeleton className="h-10 w-full md:w-auto" />
					</CardContent>
				</Card>

				<div className="grid gap-6">
					{[1, 2].map((i) => (
						<Card
							key={i}
							className="bg-white/60 backdrop-blur-sm border-white/20"
						>
							<CardContent className="p-6">
								<div className="flex items-start justify-between">
									<div className="flex-1">
										<div className="flex items-center space-x-3 mb-4">
											<Skeleton className="h-12 w-12 rounded-full" />
											<div>
												<Skeleton className="h-7 w-40 mb-2" />
												<div className="flex items-center space-x-4">
													<Skeleton className="h-4 w-48" />
												</div>
											</div>
										</div>
										<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
											<div>
												<Skeleton className="h-4 w-24 mb-2" />
												<Skeleton className="h-4 w-32" />
											</div>
											<div>
												<Skeleton className="h-4 w-24 mb-2" />
												<Skeleton className="h-6 w-20" />
											</div>
										</div>
										<div>
											<Skeleton className="h-4 w-32 mb-2" />
											<div className="flex flex-wrap gap-2">
												<Skeleton className="h-6 w-20" />
												<Skeleton className="h-6 w-24" />
												<Skeleton className="h-6 w-16" />
											</div>
										</div>
									</div>
									<Skeleton className="h-8 w-8 ml-4" />
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			</main>
		</div>
	)
}
