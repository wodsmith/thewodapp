import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { z } from "zod"
import type { JudgeAssignmentVersion } from "@/db/schema"
import type { LaneShiftPattern } from "@/db/schemas/volunteers"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getCompetitionByIdFn } from "@/server-fns/competition-detail-fns"
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
} from "@/server-fns/volunteer-fns"
import { getCompetitionShiftsFn } from "@/server-fns/volunteer-shift-fns"
import { InvitedVolunteersList } from "./-components/invited-volunteers-list"
import { JudgeSchedulingContainer } from "./-components/judges"
import { ShiftList } from "./-components/shifts/shift-list"
import { VolunteersList } from "./-components/volunteers-list"

/** Per-event defaults for judge rotations */
interface EventDefaults {
	defaultHeatsCount: number | null
	defaultLaneShiftPattern: LaneShiftPattern | null
	minHeatBuffer: number | null
}

const volunteersSearchSchema = z.object({
	tab: z.enum(["volunteers", "shifts"]).optional().default("volunteers"),
})

export const Route = createFileRoute(
	"/compete/organizer/$competitionId/volunteers",
)({
	validateSearch: volunteersSearchSchema,
	loader: async ({ params }) => {
		const result = await getCompetitionByIdFn({
			data: { competitionId: params.competitionId },
		})

		if (!result.competition) {
			throw new Error("Competition not found")
		}

		const competition = result.competition

		if (!competition.competitionTeamId) {
			throw new Error("Competition team not found")
		}

		const competitionTeamId = competition.competitionTeamId

		// Parallel fetch: invitations, volunteers, events, direct invites, judges, shifts
		const [invitations, volunteers, eventsResult, directInvites, judges, shifts] =
			await Promise.all([
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
			directInvites,
			pendingDirectInvites,
			judges,
			heats,
			judgeAssignments,
			rotations,
			eventDefaultsMap,
			versionHistoryMap,
			activeVersionMap,
			shifts,
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
		directInvites,
		pendingDirectInvites,
		judges,
		heats,
		judgeAssignments,
		rotations,
		eventDefaultsMap,
		versionHistoryMap,
		activeVersionMap,
		shifts,
	} = Route.useLoaderData()

	const { tab } = Route.useSearch()
	const navigate = useNavigate()

	const handleTabChange = (value: string) => {
		const tabValue = value as "volunteers" | "shifts"
		navigate({
			to: "/compete/organizer/$competitionId/volunteers",
			params: { competitionId: competition.id },
			search: tabValue === "volunteers" ? {} : { tab: tabValue },
		})
	}

	return (
		<div className="flex flex-col gap-8">
			<Tabs value={tab} onValueChange={handleTabChange}>
				<TabsList>
					<TabsTrigger value="volunteers">Volunteers</TabsTrigger>
					<TabsTrigger value="shifts">Shifts</TabsTrigger>
				</TabsList>

				<TabsContent value="volunteers" className="mt-6">
					<div className="flex flex-col gap-8">
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
								<InvitedVolunteersList invites={directInvites} />
							</section>
						)}

						{/* Volunteers Section */}
						<section>
							<div className="mb-4">
								<h2 className="text-xl font-semibold">Volunteers</h2>
								<p className="text-sm text-muted-foreground">
									{invitations.length + volunteersWithAccess.length} total (
									{invitations.length} application
									{invitations.length === 1 ? "" : "s"}, {volunteersWithAccess.length}{" "}
									approved)
								</p>
							</div>

							<VolunteersList
								competitionId={competition.id}
								competitionSlug={competition.slug}
								competitionTeamId={competitionTeamId}
								organizingTeamId={competition.organizingTeamId}
								invitations={invitations}
								volunteers={volunteersWithAccess}
							/>
						</section>

						{/* Judging Schedule Section */}
						<JudgeSchedulingContainer
							competitionId={competition.id}
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
						/>
					</div>
				</TabsContent>

				<TabsContent value="shifts" className="mt-6">
					<ShiftList
						competitionId={competition.id}
						competitionTeamId={competitionTeamId}
						shifts={shifts}
					/>
				</TabsContent>
			</Tabs>
		</div>
	)
}
