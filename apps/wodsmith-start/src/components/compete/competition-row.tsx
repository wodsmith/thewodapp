"use client"

import { Link } from "@tanstack/react-router"

interface CompetitionRowProps {
	competition: {
		id: string
		name: string
		date?: string
		location?: string
	}
}

export function CompetitionRow({ competition }: CompetitionRowProps) {
	return (
		<Link
			to="/compete/$competitionId"
			params={{ competitionId: competition.id }}
			className="flex items-center justify-between p-4 border rounded hover:bg-muted transition-colors"
		>
			<div>
				<div className="font-medium">{competition.name}</div>
				{(competition.date || competition.location) && (
					<div className="text-sm text-muted-foreground">
						{[competition.date, competition.location].filter(Boolean).join(" • ")}
					</div>
				)}
			</div>
			<span className="text-muted-foreground">→</span>
		</Link>
	)
}
