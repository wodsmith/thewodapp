import { BarChart3 } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export function LeaderboardContent() {
	return (
		<div className="container mx-auto px-4 py-8">
			<div className="max-w-4xl">
				<h2 className="text-2xl font-bold mb-6">Leaderboard</h2>

				<Alert variant="default" className="border-dashed">
					<BarChart3 className="h-4 w-4" />
					<AlertTitle>Leaderboard not yet available</AlertTitle>
					<AlertDescription>
						Results and rankings will appear here once the competition begins.
					</AlertDescription>
				</Alert>
			</div>
		</div>
	)
}
