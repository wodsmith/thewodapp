import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { getAllMovementsAction } from "@/actions/movement-actions"
import { getAllTagsAction } from "@/actions/tag-actions"
import { getScalingGroupsAction } from "@/actions/scaling-actions"
import { getSessionFromCookie } from "@/utils/auth"
import CreateWorkoutClient from "./_components/create-workout-client"

export const metadata: Metadata = {
	title: "Create Workout",
	description: "Create a new CrossFit workout.",
	openGraph: {
		type: "website",
		title: "Create Workout",
		description: "Create a new CrossFit workout.",
		images: [
			{
				url: `/api/og?title=${encodeURIComponent("Create Workout")}`,
				width: 1200,
				height: 630,
				alt: "Create Workout",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: "Create Workout",
		description: "Create a new CrossFit workout.",
		images: [`/api/og?title=${encodeURIComponent("Create Workout")}`],
	},
}

export default async function CreateWorkoutPage() {
	const [movements, movementsError] = await getAllMovementsAction()
	const [tags, tagsError] = await getAllTagsAction()

	if (movementsError || tagsError || !movements?.success || !tags?.success) {
		return notFound()
	}

	const session = await getSessionFromCookie()

	if (!session?.user?.id) {
		console.log("[log/page] No user found")
		redirect("/sign-in")
	}

	// Get user's personal team ID
	const { getUserPersonalTeamId } = await import("@/server/user")
	const teamId = await getUserPersonalTeamId(session.user.id)

	// Get all teams where user is a member
	const { getUserTeamMemberships } = await import("@/server/teams")
	const userMemberships = await getUserTeamMemberships(session.user.id)

	// Get programming tracks owned by all user's teams where they have permission
	const { getTracksOwnedByTeam } = await import("@/server/programming-tracks")
	const { TEAM_PERMISSIONS } = await import("@/db/schemas/teams")
	const { hasTeamPermission } = await import("@/utils/team-auth")

	// For programming tracks, users can add to tracks if:
	// 1. They are owner/admin of the team that owns the track
	// 2. It's their personal team (they always have full control of their personal team)
	// 3. They have MANAGE_PROGRAMMING permission

	// Debug: Let's see all memberships first
	console.log(
		"[DEBUG] All user memberships:",
		userMemberships.map((m) => ({
			teamId: m.teamId,
			roleId: m.roleId,
			teamName: m.team?.name,
			isPersonal: m.team?.isPersonalTeam,
			isSystemRole: m.isSystemRole,
		})),
	)

	// Check programming permissions for each team
	const teamsWithProgrammingPermission = []
	for (const membership of userMemberships) {
		let hasPermission = false

		// Always include personal team
		if (membership.team?.isPersonalTeam === 1) {
			console.log(
				"[DEBUG] Found personal team:",
				membership.teamId,
				membership.team?.name,
			)
			hasPermission = true
		} else {
			// Check for programming permission
			const hasProgrammingPermission = await hasTeamPermission(
				membership.teamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)
			if (hasProgrammingPermission) {
				console.log(
					"[DEBUG] Found team with programming permission:",
					membership.teamId,
					membership.team?.name,
				)
				hasPermission = true
			}
		}

		if (hasPermission) {
			teamsWithProgrammingPermission.push(membership)
		}
	}

	console.log(
		"[DEBUG] Teams with programming permission count:",
		teamsWithProgrammingPermission.length,
	)
	console.log(
		"[DEBUG] Teams with programming permission IDs:",
		teamsWithProgrammingPermission.map((m) => m.teamId),
	)

	// Get tracks for all teams with permission
	const allTracksPromises = teamsWithProgrammingPermission.map(
		async (membership) => {
			const tracks = await getTracksOwnedByTeam(membership.teamId)
			console.log(
				`[DEBUG] Team ${membership.teamId} (${membership.team?.name}) has ${tracks.length} tracks`,
			)
			return tracks
		},
	)
	const allTracksArrays = await Promise.all(allTracksPromises)
	const ownedTracks = allTracksArrays.flat()

	console.log("[DEBUG] Total owned tracks found:", ownedTracks.length)
	console.log(
		"[DEBUG] Track details:",
		ownedTracks.map((t) => ({
			id: t.id,
			name: t.name,
			ownerTeamId: t.ownerTeamId,
		})),
	)

	// Fetch scaling groups for all teams where user has permission
	const scalingGroupsPromises = teamsWithProgrammingPermission.map(
		async (membership) => {
			const [groupsResult] = await getScalingGroupsAction({
				teamId: membership.teamId,
				includeSystem: true,
			})
			if (groupsResult?.success) {
				return groupsResult.data.map((group) => ({
					...group,
					teamName: membership.team?.name || "Unknown Team",
				}))
			}
			return []
		},
	)
	const allScalingGroupsArrays = await Promise.all(scalingGroupsPromises)
	const scalingGroups = allScalingGroupsArrays.flat()

	console.log("[DEBUG] Total scaling groups found:", scalingGroups.length)

	return (
		<CreateWorkoutClient
			movements={movements.data}
			tags={tags.data}
			teamId={teamId}
			ownedTracks={ownedTracks}
			teamsWithProgrammingPermission={teamsWithProgrammingPermission}
			scalingGroups={scalingGroups}
		/>
	)
}
