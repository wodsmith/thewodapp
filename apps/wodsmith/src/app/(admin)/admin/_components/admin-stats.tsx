"use client"

import { useServerAction } from "@repo/zsa-react"
import { useEffect } from "react"
import { getAdminStatsAction } from "@/actions/admin-actions"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function AdminStats() {
	const { execute, data, isPending } = useServerAction(getAdminStatsAction)

	useEffect(() => {
		execute()
	}, [execute])

	const totalUsers = data?.data?.totalUsers || 0
	const activeTeams = data?.data?.activeTeams || 0
	const totalWorkouts = data?.data?.totalWorkouts || 0

	return (
		<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
			<Card>
				<CardHeader className="pb-2">
					<CardTitle className="text-sm font-medium text-muted-foreground">
						Total Users
					</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-3xl font-bold">
						{isPending ? "..." : totalUsers.toLocaleString()}
					</p>
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="pb-2">
					<CardTitle className="text-sm font-medium text-muted-foreground">
						Active Teams
					</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-3xl font-bold">
						{isPending ? "..." : activeTeams.toLocaleString()}
					</p>
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="pb-2">
					<CardTitle className="text-sm font-medium text-muted-foreground">
						Total Workouts
					</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-3xl font-bold">
						{isPending ? "..." : totalWorkouts.toLocaleString()}
					</p>
				</CardContent>
			</Card>
		</div>
	)
}
