"use client"

import { useEffect } from "react"
import { useServerAction } from "zsa-react"
import { getAdminStatsAction } from "@/actions/admin-actions"

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
			<div className="border-2 border-primary bg-card p-6 shadow-[4px_4px_0px_0px] shadow-primary">
				<h3 className="text-sm font-mono font-medium text-muted-foreground mb-2">
					Total Users
				</h3>
				<p className="text-3xl font-mono font-bold">
					{isPending ? "..." : totalUsers.toLocaleString()}
				</p>
			</div>

			<div className="border-2 border-primary bg-card p-6 shadow-[4px_4px_0px_0px] shadow-primary">
				<h3 className="text-sm font-mono font-medium text-muted-foreground mb-2">
					Active Teams
				</h3>
				<p className="text-3xl font-mono font-bold">
					{isPending ? "..." : activeTeams.toLocaleString()}
				</p>
			</div>

			<div className="border-2 border-primary bg-card p-6 shadow-[4px_4px_0px_0px] shadow-primary">
				<h3 className="text-sm font-mono font-medium text-muted-foreground mb-2">
					Total Workouts
				</h3>
				<p className="text-3xl font-mono font-bold">
					{isPending ? "..." : totalWorkouts.toLocaleString()}
				</p>
			</div>
		</div>
	)
}
