import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { getWorkoutByIdAction } from "@/actions/workout-actions"
import { getSessionFromCookie } from "@/utils/auth"
import AddToTrackClient from "./_components/add-to-track-client"

export const metadata: Metadata = {
	title: "Add to Track",
	description: "Add workout to a programming track",
	openGraph: {
		type: "website",
		title: "Add to Track",
		description: "Add workout to a programming track",
		images: [
			{
				url: `/api/og?title=${encodeURIComponent("Add to Track")}`,
				width: 1200,
				height: 630,
				alt: "Add to Track",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: "Add to Track",
		description: "Add workout to a programming track",
		images: [`/api/og?title=${encodeURIComponent("Add to Track")}`],
	},
}

export default async function AddToTrackPage({
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

	// Get programming tracks owned by all user's teams where they have permission
	const { getTracksOwnedByTeam } = await import("@/server/programming-tracks")
	const { SYSTEM_ROLES_ENUM } = await import("@/db/schemas/teams")

	// For programming tracks, users can add to tracks if:
	// 1. They are owner/admin of the team that owns the track
	// 2. It's their personal team (they always have full control of their personal team)
	const teamsWithPermission = userMemberships.filter((membership) => {
		// Always include personal team
		if (membership.team?.isPersonalTeam === 1) {
			return true
		}
		// Include teams where user is owner or admin
		return (
			membership.roleId === SYSTEM_ROLES_ENUM.OWNER ||
			membership.roleId === SYSTEM_ROLES_ENUM.ADMIN
		)
	})

	// Get tracks for all teams with permission
	const allTracksPromises = teamsWithPermission.map((membership) =>
		getTracksOwnedByTeam(membership.teamId),
	)
	const allTracksArrays = await Promise.all(allTracksPromises)
	const ownedTracks = allTracksArrays.flat()

	return (
		<AddToTrackClient
			workout={workoutResult.data}
			workoutId={id}
			teamId={teamId}
			ownedTracks={ownedTracks}
		/>
	)
}
