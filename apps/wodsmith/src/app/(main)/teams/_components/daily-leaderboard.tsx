"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table"
import type { LeaderboardEntry } from "@/server/leaderboard"

interface DailyLeaderboardProps {
	entries: LeaderboardEntry[]
}

export function DailyLeaderboard({ entries }: DailyLeaderboardProps) {
	if (entries.length === 0) {
		return (
			<div className="text-center py-8 text-muted-foreground">
				No results yet for today's workout.
			</div>
		)
	}

	return (
		<div className="rounded-md border">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead className="w-12">Rank</TableHead>
						<TableHead>Athlete</TableHead>
						<TableHead>Scaling</TableHead>
						<TableHead>Score</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{entries.map((entry, index) => {
						const initials = entry.userName
							.split(" ")
							.map((n) => n[0])
							.join("")
							.toUpperCase()

						return (
							<TableRow key={entry.userId}>
								<TableCell className="font-semibold">{index + 1}</TableCell>
								<TableCell>
									<div className="flex items-center gap-3">
										<Avatar className="h-8 w-8">
											<AvatarImage src={entry.userAvatar || undefined} />
											<AvatarFallback>{initials}</AvatarFallback>
										</Avatar>
										<span className="font-medium">{entry.userName}</span>
									</div>
								</TableCell>
								<TableCell>
									{entry.scalingLevelLabel ? (
										<Badge variant={entry.asRx ? "default" : "secondary"}>
											{entry.scalingLevelLabel}
											{!entry.asRx && " (Scaled)"}
										</Badge>
									) : (
										<span className="text-muted-foreground">-</span>
									)}
								</TableCell>
								<TableCell className="font-mono">
									{entry.formattedScore}
								</TableCell>
							</TableRow>
						)
					})}
				</TableBody>
			</Table>
		</div>
	)
}
