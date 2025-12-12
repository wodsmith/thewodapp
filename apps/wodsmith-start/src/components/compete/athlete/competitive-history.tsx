"use client"

interface CompetitiveHistoryProps {
	history?: Array<{
		id: string
		competitionName: string
		date: string
		placement: number
	}>
}

export function CompetitiveHistory({ history = [] }: CompetitiveHistoryProps) {
	if (history.length === 0) {
		return (
			<div className="p-4 text-center text-muted-foreground">
				No competition history yet
			</div>
		)
	}

	return (
		<div className="p-4 space-y-2">
			<h3 className="font-semibold">Competition History</h3>
			<div className="space-y-2">
				{history.map((entry) => (
					<div
						key={entry.id}
						className="flex justify-between items-center p-3 border rounded"
					>
						<div>
							<div className="font-medium">{entry.competitionName}</div>
							<div className="text-sm text-muted-foreground">{entry.date}</div>
						</div>
						<div className="text-lg font-bold">#{entry.placement}</div>
					</div>
				))}
			</div>
		</div>
	)
}
