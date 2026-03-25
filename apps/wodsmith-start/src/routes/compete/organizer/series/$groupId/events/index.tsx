import { createFileRoute, useRouter } from "@tanstack/react-router"
import { RefreshCw } from "lucide-react"
import { useState } from "react"
import { SeriesEventMapper } from "@/components/series-event-mapper"
import { EventTemplateCreator } from "@/components/series/event-template-creator"
import { SeriesEventSyncDialog } from "@/components/series/series-event-sync-dialog"
import { SeriesTemplateEventEditor } from "@/components/series/series-template-event-editor"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { getCompetitionGroupByIdFn } from "@/server-fns/competition-fns"
import { getBatchWorkoutDivisionDescriptionsFn } from "@/server-fns/competition-workouts-fns"
import { getAllMovementsFn } from "@/server-fns/movement-fns"
import { getSeriesTemplateDivisionsFn } from "@/server-fns/series-division-mapping-fns"
import {
	getSeriesCompetitionsForTemplateFn,
	getSeriesEventMappingsFn,
	getSeriesTemplateEventsFn,
} from "@/server-fns/series-event-template-fns"

export const Route = createFileRoute(
	"/compete/organizer/series/$groupId/events/",
)({
	component: SeriesEventsPage,
	loader: async ({ params }) => {
		const [
			templateResult,
			competitionsResult,
			movementsResult,
			groupResult,
			divisionsResult,
			mappingsResult,
		] = await Promise.all([
			getSeriesTemplateEventsFn({
				data: { groupId: params.groupId },
			}),
			getSeriesCompetitionsForTemplateFn({
				data: { groupId: params.groupId },
			}),
			getAllMovementsFn(),
			getCompetitionGroupByIdFn({
				data: { groupId: params.groupId },
			}),
			getSeriesTemplateDivisionsFn({
				data: { groupId: params.groupId },
			}).catch((error: unknown) => {
				// Only swallow "not found" errors — rethrow auth/server failures
				if (
					error instanceof Error &&
					(error.message.includes("not found") ||
						error.message.includes("No scaling group"))
				) {
					return {
						scalingGroupId: null,
						divisions: [] as Array<{ id: string; label: string; teamSize: number }>,
					}
				}
				throw error
			}),
			getSeriesEventMappingsFn({
				data: { groupId: params.groupId },
			}),
		])

		// Load division descriptions for each template event's workout
		let divisionDescriptionsByWorkout: Record<
			string,
			Array<{
				divisionId: string
				divisionLabel: string
				description: string | null
				position: number
			}>
		> = {}

		if (
			templateResult.events.length > 0 &&
			divisionsResult.divisions.length > 0
		) {
			const divisionIds = divisionsResult.divisions.map((d) => d.id)
			const workoutIds = templateResult.events.map((e) => e.workoutId)
			const batchResult = await getBatchWorkoutDivisionDescriptionsFn({
				data: { workoutIds, divisionIds },
			})
			divisionDescriptionsByWorkout = batchResult.descriptionsByWorkout
		}

		return {
			...templateResult,
			competitions: competitionsResult.competitions,
			movements: movementsResult.movements,
			organizingTeamId: groupResult.group?.organizingTeamId ?? "",
			divisions: divisionsResult.divisions.map((d, i) => ({
				...d,
				position: i,
			})),
			divisionDescriptionsByWorkout,
			competitionMappings: mappingsResult.competitionMappings,
		}
	},
})

function SeriesEventsPage() {
	const { groupId } = Route.useParams()
	const loaderData = Route.useLoaderData()
	const router = useRouter()

	const [templateTrack, setTemplateTrack] = useState(loaderData.templateTrack)
	const [events, setEvents] = useState(loaderData.events)
	const [isSyncDialogOpen, setIsSyncDialogOpen] = useState(false)
	const [competitionMappings, setCompetitionMappings] = useState(
		loaderData.competitionMappings,
	)

	const refreshData = async () => {
		await router.invalidate()
		const [refreshed, mappingsRefreshed] = await Promise.all([
			getSeriesTemplateEventsFn({
				data: { groupId },
			}),
			getSeriesEventMappingsFn({
				data: { groupId },
			}),
		])
		setTemplateTrack(refreshed.templateTrack)
		setEvents(refreshed.events)
		setCompetitionMappings(mappingsRefreshed.competitionMappings)
	}

	if (!templateTrack) {
		return (
			<div className="flex flex-col gap-6">
				<EventTemplateCreator
					groupId={groupId}
					competitions={loaderData.competitions}
					onTemplateCreated={refreshData}
				/>
			</div>
		)
	}

	return (
		<div className="flex flex-col gap-6">
			<SeriesTemplateEventEditor
				groupId={groupId}
				trackId={templateTrack.id}
				events={events}
				movements={loaderData.movements}
				divisions={loaderData.divisions}
				divisionDescriptionsByWorkout={
					loaderData.divisionDescriptionsByWorkout
				}
				organizingTeamId={loaderData.organizingTeamId}
				onEventsChanged={refreshData}
			/>

			{/* Sync to Competitions */}
			{events.length > 0 && (
				<div className="flex items-center gap-2">
					<Button onClick={() => setIsSyncDialogOpen(true)}>
						<RefreshCw className="h-4 w-4 mr-2" />
						Sync to Competitions
					</Button>
				</div>
			)}

			<SeriesEventSyncDialog
				groupId={groupId}
				open={isSyncDialogOpen}
				onOpenChange={setIsSyncDialogOpen}
				onSynced={refreshData}
			/>

			{/* Event Matching */}
			{events.length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle>Match Competition Events</CardTitle>
						<CardDescription>
							Choose which event in each competition corresponds to each
							series template event. Unmatched events won't count toward the
							leaderboard.
						</CardDescription>
					</CardHeader>
					<CardContent>
						{competitionMappings.length === 0 ? (
							<Alert variant="default" className="border-dashed">
								<AlertTitle>No competitions in series</AlertTitle>
								<AlertDescription>
									Add competitions to this series first, then match their
									events.
								</AlertDescription>
							</Alert>
						) : (
							<SeriesEventMapper
								groupId={groupId}
								template={{
									events: events.map((e) => ({
										id: e.id,
										name: e.name,
										order: e.order,
										scoreType: e.scoreType,
									})),
								}}
								initialMappings={competitionMappings}
								onSaved={refreshData}
							/>
						)}
					</CardContent>
				</Card>
			)}
		</div>
	)
}
