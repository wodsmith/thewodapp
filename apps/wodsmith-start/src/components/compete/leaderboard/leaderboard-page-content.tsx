"use client"

interface LeaderboardEntry {
	rank: number
	athleteId: string
	athleteName: string
	score: string
}

interface LeaderboardPageContentProps {
	entries?: LeaderboardEntry[]
	isLoading?: boolean
}

export function LeaderboardPageContent({
	entries = [],
	isLoading,
}: LeaderboardPageContentProps) {
	if (isLoading) {
		return (
			<div className="p-4 text-center text-muted-foreground">
				Loading leaderboard...
			</div>
		)
	}

	if (entries.length === 0) {
		return (
			<div className="p-4 text-center text-muted-foreground">
				No leaderboard entries yet
			</div>
		)
	}

	return (
		<div className="space-y-2">
			{entries.map((entry) => (
				<div
					key={entry.athleteId}
					className="flex items-center justify-between p-3 border rounded"
				>
					<div className="flex items-center gap-3">
						<span className="font-bold text-lg w-8">#{entry.rank}</span>
						<span>{entry.athleteName}</span>
					</div>
					<span className="font-mono">{entry.score}</span>
				</div>
			))}
		</div>
	)
}
