import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { getWorkoutByIdAction } from "@/actions/workout-actions"
import { getSessionFromCookie } from "@/utils/auth"
import ScheduleWorkoutClient from "./_components/schedule-workout-client"

export const metadata: Metadata = {
	title: "Schedule Workout",
	description: "Schedule a workout for a specific date",
	openGraph: {
		type: "website",
		title: "Schedule Workout",
		description: "Schedule a workout for a specific date",
		images: [
			{
				url: `/api/og?title=${encodeURIComponent("Schedule Workout")}`,
				width: 1200,
				height: 630,
				alt: "Schedule Workout",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: "Schedule Workout",
		description: "Schedule a workout for a specific date",
		images: [`/api/og?title=${encodeURIComponent("Schedule Workout")}`],
	},
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

	type TeamMembershipWithTeam = typeof userMemberships[number]
	const teamsWithProgrammingPermission: TeamMembershipWithTeam[] = []
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
