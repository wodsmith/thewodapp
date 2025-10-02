import { Skeleton } from "@/components/ui/skeleton"

export default function LoadingPage() {
	return (
		<div className="container mx-auto py-8">
			<div className="mb-8">
				<Skeleton className="h-8 w-64 mb-2" />
				<Skeleton className="h-5 w-96" />
			</div>
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
				{[0, 1, 2, 3, 4, 5].map((i) => (
					<div
						key={`skeleton-${i}`}
						className="border rounded-lg p-6 space-y-4"
					>
						<Skeleton className="h-6 w-48" />
						<Skeleton className="h-4 w-32" />
						<Skeleton className="h-20 w-full" />
						<div className="flex items-center justify-between">
							<Skeleton className="h-4 w-24" />
							<Skeleton className="h-10 w-24" />
						</div>
					</div>
				))}
			</div>
		</div>
	)
}
