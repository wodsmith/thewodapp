import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { getWorkoutByIdAction } from "@/actions/workout-actions"
import { getSessionFromCookie } from "@/utils/auth"
import ScheduleWorkoutClient from "./_components/schedule-workout-client"

export const metadata: Metadata = {
	title: "WODsmith | Schedule Workout",
	description: "Schedule a workout for a specific date",
}

export default async function ScheduleWorkoutPage({
	params,
}: {
	params: Promise<{ id: string }>
}) {
	const { id } = await params
	const session = await getSessionFromCookie()

	if (!session?.userId) {
		redirect("/sign-in")
	}

	const [workoutResult, workoutError] = await getWorkoutByIdAction({ id })

	if (workoutError || !workoutResult?.success || !workoutResult.data) {
		return notFound()
	}

	// Get user's personal team ID
	const { getUserPersonalTeamId } = await import("@/server/user")
	const teamId = await getUserPersonalTeamId(session.userId)

	// Get all teams where user is a member
	const { getUserTeamMemberships } = await import("@/server/teams")
	const userMemberships = await getUserTeamMemberships(session.userId)

	// Get teams with programming permissions
	const { TEAM_PERMISSIONS } = await import("@/db/schemas/teams")
	const { hasTeamPermission } = await import("@/utils/team-auth")

	const teamsWithProgrammingPermission = []
	for (const membership of userMemberships) {
		let hasPermission = false

		// Always include personal team
		if (membership.team?.isPersonalTeam === 1) {
			hasPermission = true
		} else {
			// Check for programming permission
			const hasProgrammingPermission = await hasTeamPermission(
				membership.teamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)
			if (hasProgrammingPermission) {
				hasPermission = true
			}
		}

		if (hasPermission) {
			teamsWithProgrammingPermission.push(membership)
		}
	}

	return (
		<ScheduleWorkoutClient
			workout={workoutResult.data}
			workoutId={id}
			teamId={teamId}
			teamsWithProgrammingPermission={teamsWithProgrammingPermission}
		/>
	)
}
