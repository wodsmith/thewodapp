"use client"

interface AthleteStatsProps {
	stats?: {
		competitions?: number
		wins?: number
		podiums?: number
	}
}

export function AthleteStats({ stats }: AthleteStatsProps) {
	return (
		<div className="grid grid-cols-3 gap-4 p-4">
			<div className="text-center">
				<div className="text-2xl font-bold">{stats?.competitions ?? 0}</div>
				<div className="text-sm text-muted-foreground">Competitions</div>
			</div>
			<div className="text-center">
				<div className="text-2xl font-bold">{stats?.wins ?? 0}</div>
				<div className="text-sm text-muted-foreground">Wins</div>
			</div>
			<div className="text-center">
				<div className="text-2xl font-bold">{stats?.podiums ?? 0}</div>
				<div className="text-sm text-muted-foreground">Podiums</div>
			</div>
		</div>
	)
}
