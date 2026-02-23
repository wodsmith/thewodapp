import { useEffect } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { z } from "zod"
import type { JudgeAssignmentVersion } from "@/db/schema"
import type { LaneShiftPattern } from "@/db/schemas/volunteers"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getHeatsForCompetitionFn } from "@/server-fns/competition-heats-fns"
import { getCompetitionWorkoutsFn } from "@/server-fns/competition-workouts-fns"
import {
	getActiveVersionFn,
	getVersionHistoryFn,
} from "@/server-fns/judge-assignment-fns"
import {
	getJudgeHeatAssignmentsFn,
	getJudgeVolunteersFn,
	getRotationsForEventFn,
} from "@/server-fns/judge-scheduling-fns"
import {
	canInputScoresFn,
	getCompetitionVolunteersFn,
	getDirectVolunteerInvitesFn,
	getPendingVolunteerInvitationsFn,
	getVolunteerAssignmentsFn,
} from "@/server-fns/volunteer-fns"
import { getCompetitionShiftsFn } from "@/server-fns/volunteer-shift-fns"
import { InvitedVolunteersList } from "./-components/invited-volunteers-list"
import { JudgeSchedulingContainer } from "./-components/judges"
import { ShiftList } from "./-components/shifts/shift-list"
import { VolunteersList } from "./-components/volunteers-list"

// Search params schema for tab navigation and event selection
const searchParamsSchema = z.object({
	tab: z.enum(["roster", "shifts", "schedule"]).optional().default("roster"),
	event: z.string().optional(),
})

/** Per-event defaults for judge rotations */
interface EventDefaults {
	defaultHeatsCount: number | null
	defaultLaneShiftPattern: LaneShiftPattern | null
	minHeatBuffer: number | null
}

export const Route = createFileRoute(
	"/compete/organizer/$competitionId/volunteers",
)({
	staleTime: 10_000,
	validateSearch: searchParamsSchema,
	loader: async ({ parentMatchPromise }) => {
		const parentMatch = await parentMatchPromise
		const { competition } = parentMatch.loaderData!

		if (!competition.competitionTeamId) {
			throw new Error("Competition team not found")
		}

		const competitionTeamId = competition.competitionTeamId

		// Parallel fetch: invitations, volunteers, events, direct invites, judges, shifts, assignments
		const [
			invitations,
			volunteers,
			eventsResult,
			directInvites,
			judges,
			shifts,
			volunteerAssignments,
		] = await Promise.all([
			getPendingVolunteerInvitationsFn({
				data: { competitionTeamId },
			}),
			getCompetitionVolunteersFn({
				data: { competitionTeamId },
			}),
			getCompetitionWorkoutsFn({
				data: {
					competitionId: competition.id,
					teamId: competition.organizingTeamId,
				},
			}),
			getDirectVolunteerInvitesFn({
				data: { competitionTeamId },
			}),
			getJudgeVolunteersFn({
				data: { competitionTeamId },
			}),
			getCompetitionShiftsFn({
				data: { competitionId: competition.id },
			}),
			getVolunteerAssignmentsFn({
				data: { competitionId: competition.id },
			}),
		])

		const events = eventsResult.workouts

		// For each volunteer, check if they have score access
		const volunteersWithAccess = await Promise.all(
			volunteers.map(async (volunteer) => {
				const hasScoreAccess = volunteer.user
					? await canInputScoresFn({
							data: {
								userId: volunteer.user.id,
								competitionTeamId,
							},
						})
					: false

				return {
					...volunteer,
					hasScoreAccess,
				}
			}),
		)

		// Get heats for all events
		const heatsResult = await getHeatsForCompetitionFn({
			data: {
				competitionId: competition.id,
				teamId: competition.organizingTeamId,
			},
		})
		const heats = heatsResult.heats

		// Get judge assignments, rotations, and version data for all events
		const [
			allAssignments,
			allRotationResults,
			allVersionHistory,
			allActiveVersions,
		] = await Promise.all([
			Promise.all(
				events.map((event) =>
					getJudgeHeatAssignmentsFn({ data: { trackWorkoutId: event.id } }),
				),
			),
			Promise.all(
				events.map((event) =>
					getRotationsForEventFn({ data: { trackWorkoutId: event.id } }),
				),
			),
			Promise.all(
				events.map((event) =>
					getVersionHistoryFn({ data: { trackWorkoutId: event.id } }),
				),
			),
			Promise.all(
				events.map((event) =>
					getActiveVersionFn({ data: { trackWorkoutId: event.id } }),
				),
			),
		])

		const judgeAssignments = allAssignments.flat()
		// Extract rotations from the new { rotations, eventDefaults } return type
		const rotations = allRotationResults.flatMap((result) => result.rotations)
		// Build event defaults map for each event (cast to EventDefaults for type safety)
		const eventDefaultsMap = new Map<string, EventDefaults>()
		for (const [index, event] of events.entries()) {
			const result = allRotationResults[index]
			eventDefaultsMap.set(event.id, {
				defaultHeatsCount: result?.eventDefaults?.defaultHeatsCount ?? null,
				defaultLaneShiftPattern:
					(result?.eventDefaults
						?.defaultLaneShiftPattern as LaneShiftPattern) ?? null,
				minHeatBuffer: result?.eventDefaults?.minHeatBuffer ?? null,
			})
		}
		// Build version history map for each event
		const versionHistoryMap = new Map<string, JudgeAssignmentVersion[]>()
		for (const [index, event] of events.entries()) {
			versionHistoryMap.set(event.id, allVersionHistory[index] ?? [])
		}
		// Build active version map for each event
		const activeVersionMap = new Map<string, JudgeAssignmentVersion | null>()
		for (const [index, event] of events.entries()) {
			activeVersionMap.set(event.id, allActiveVersions[index] ?? null)
		}

		// Filter pending direct invites for conditional rendering
		const pendingDirectInvites = directInvites.filter(
			(i) => i.status === "pending",
		)

		return {
			competition,
			competitionTeamId,
			invitations,
			volunteersWithAccess,
			events,
			pendingDirectInvites,
			judges,
			heats,
			judgeAssignments,
			rotations,
			eventDefaultsMap,
			versionHistoryMap,
			activeVersionMap,
			shifts,
			volunteerAssignments,
		}
	},
	component: VolunteersPage,
})

function VolunteersPage() {
	const {
		competition,
		competitionTeamId,
		invitations,
		volunteersWithAccess,
		events,
		pendingDirectInvites,
		judges,
		heats,
		judgeAssignments,
		rotations,
		eventDefaultsMap,
		versionHistoryMap,
		activeVersionMap,
		shifts,
		volunteerAssignments,
	} = Route.useLoaderData()

	const { tab, event: eventFromUrl } = Route.useSearch()
	const navigate = useNavigate()

	const handleTabChange = (value: string) => {
		navigate({
			to: ".",
			search: (prev) => ({
				...prev,
				tab: value as "roster" | "shifts" | "schedule",
			}),
			replace: true,
		})
	}

	const handleEventChange = (eventId: string) => {
		navigate({
			to: ".",
			search: (prev) => ({ ...prev, event: eventId }),
			replace: true,
		})
	}

	// Determine selected event - from URL or first event
	// Validate eventFromUrl exists in events before using it
	const selectedEventId =
		eventFromUrl && events.some((event) => event.id === eventFromUrl)
			? eventFromUrl
			: events[0]?.id || ""

	// Check if schedule tab should be available (in-person competitions only)
	const isInPerson = competition.competitionType === "in-person"

	// Derive effective tab - fall back to roster if schedule isn't allowed
	const effectiveTab = !isInPerson && tab === "schedule" ? "roster" : tab

	// Sync URL/state when competition type changes and schedule tab is no longer valid
	useEffect(() => {
		if (!isInPerson && tab === "schedule") {
			navigate({
				to: ".",
				search: { tab: "roster" },
				replace: true,
			})
		}
	}, [isInPerson, tab, navigate])

	return (
		<Tabs
			value={effectiveTab}
			onValueChange={handleTabChange}
			className="w-full"
		>
			<TabsList className="mb-6">
				<TabsTrigger value="roster">Roster</TabsTrigger>
				<TabsTrigger value="shifts">Shifts</TabsTrigger>
				{isInPerson && (
					<TabsTrigger value="schedule">Judge Schedule</TabsTrigger>
				)}
			</TabsList>

			{/* Roster Tab - Volunteer Management */}
			<TabsContent value="roster" className="flex flex-col gap-8">
				{/* Invited Volunteers Section - Only show if there are pending direct invites */}
				{pendingDirectInvites.length > 0 && (
					<section>
						<div className="mb-4">
							<h2 className="text-xl font-semibold">Invited Volunteers</h2>
							<p className="text-sm text-muted-foreground">
								{pendingDirectInvites.length} pending{" "}
								{pendingDirectInvites.length === 1 ? "invite" : "invites"}
							</p>
						</div>
						<InvitedVolunteersList invites={pendingDirectInvites} />
					</section>
				)}

				{/* Volunteers Section */}
				<section>
					<div className="mb-4">
						<h2 className="text-xl font-semibold">Volunteers</h2>
						<p className="text-sm text-muted-foreground">
							{invitations.length + volunteersWithAccess.length} total (
							{invitations.length} application
							{invitations.length === 1 ? "" : "s"},{" "}
							{volunteersWithAccess.length} approved)
						</p>
					</div>

					<VolunteersList
						competitionId={competition.id}
						competitionSlug={competition.slug}
						competitionTeamId={competitionTeamId}
						organizingTeamId={competition.organizingTeamId}
						invitations={invitations}
						volunteers={volunteersWithAccess}
						volunteerAssignments={volunteerAssignments}
					/>
				</section>
			</TabsContent>

			{/* Shifts Tab */}
			<TabsContent value="shifts" className="mt-6">
				<ShiftList
					competitionId={competition.id}
					competitionTeamId={competitionTeamId}
					shifts={shifts}
				/>
			</TabsContent>

			{/* Schedule Tab - Judge Scheduling & Rotations (in-person only) */}
			{isInPerson && (
				<TabsContent value="schedule">
					<JudgeSchedulingContainer
						competitionId={competition.id}
						competitionSlug={competition.slug}
						organizingTeamId={competition.organizingTeamId}
						competitionType={competition.competitionType}
						events={events}
						heats={heats}
						judges={judges}
						judgeAssignments={judgeAssignments}
						rotations={rotations}
						eventDefaultsMap={eventDefaultsMap}
						versionHistoryMap={versionHistoryMap}
						activeVersionMap={activeVersionMap}
						competitionDefaultHeats={competition.defaultHeatsPerRotation ?? 4}
						competitionDefaultPattern={
							(competition.defaultLaneShiftPattern as "stay" | "shift_right") ??
							"shift_right"
						}
						selectedEventId={selectedEventId}
						onEventChange={handleEventChange}
					/>
				</TabsContent>
			)}
		</Tabs>
	)
}
