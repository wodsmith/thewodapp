import "server-only"

import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { getDb } from "@/db"
import type { VolunteerMembershipMetadata } from "@/db/schemas/volunteers"
import { getCompetition } from "@/server/competitions"
import {
	getEnrichedRotationsForJudge,
	groupRotationsByEvent,
} from "@/server/judge-schedule"
import { getSessionFromCookie } from "@/utils/auth"
import { ScheduleView } from "./_components/schedule-view"

type Props = {
	params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { slug } = await params
	const competition = await getCompetition(slug)

	if (!competition) {
		return {
			title: "Competition Not Found",
		}
	}

	return {
		title: `My Schedule - ${competition.name}`,
		description: `View your judging assignments for ${competition.name}`,
	}
}

/**
 * Volunteer-facing schedule page showing their judge assignments
 * Protected route - requires session and competition team membership
 */
export default async function MySchedulePage({ params }: Props) {
	const { slug } = await params

	// Get session - redirect to login if not authenticated
	const session = await getSessionFromCookie()
	if (!session) {
		redirect(`/login?callbackUrl=/compete/${slug}/my-schedule`)
	}

	const competition = await getCompetition(slug)
	if (!competition) {
		notFound()
	}

	// Check if competition has team
	if (!competition.competitionTeamId) {
		return (
			<div className="mx-auto max-w-2xl py-8">
				<div className="bg-destructive/10 rounded-lg border border-destructive/20 p-6">
					<h1 className="text-2xl font-bold mb-2">Schedule Not Available</h1>
					<p>The schedule is not available for this competition.</p>
				</div>
			</div>
		)
	}

	const db = getDb()

	// Get user's membership in the competition team
	const membership = await db.query.teamMembershipTable.findFirst({
		where: (teamMembershipTable, { and, eq }) =>
			and(
				eq(teamMembershipTable.teamId, competition.competitionTeamId),
				eq(teamMembershipTable.userId, session.userId),
			),
	})

	if (!membership) {
		return (
			<div className="mx-auto max-w-2xl py-8">
				<div className="bg-muted rounded-lg border p-6">
					<h1 className="text-2xl font-bold mb-2">Not Registered</h1>
					<p>
						You must be registered for this competition to view your judging
						schedule.
					</p>
				</div>
			</div>
		)
	}

	// Get competition divisions for scaling level descriptions
	const divisions = await db.query.competitionDivisionsTable.findMany({
		where: (table, { eq }) => eq(table.competitionId, competition.id),
	})
	const divisionIds = divisions.map((d) => d.divisionId)

	// Get enriched rotations with all data including division descriptions
	// Note: teamId is not passed - we use each workout's own teamId for division descriptions
	const enrichedRotations = await getEnrichedRotationsForJudge(
		db,
		membership.id,
		competition.id,
		divisionIds,
	)

	// Group rotations by event for display
	const events = groupRotationsByEvent(enrichedRotations)

	// Extract and parse volunteer metadata from membership
	// metadata is stored as JSON string in the database
	let volunteerMetadata: VolunteerMembershipMetadata | null = null
	if (membership.metadata) {
		try {
			volunteerMetadata =
				typeof membership.metadata === "string"
					? JSON.parse(membership.metadata)
					: membership.metadata
		} catch {
			// Invalid JSON, ignore
			volunteerMetadata = null
		}
	}

	return (
		<div className="mx-auto max-w-4xl py-8 px-4">
			<ScheduleView
				events={events}
				competitionName={competition.name}
				volunteerMetadata={volunteerMetadata}
				membershipId={membership.id}
				competitionSlug={slug}
				competitionStartDate={competition.startDate}
				competitionEndDate={competition.endDate}
			/>
		</div>
	)
}
