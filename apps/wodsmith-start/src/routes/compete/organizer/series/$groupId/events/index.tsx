import { createFileRoute, useRouter } from "@tanstack/react-router"
import { CheckSquare, RefreshCw, Square } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { SeriesEventMapper } from "@/components/series-event-mapper"
import { EventTemplateCreator } from "@/components/series/event-template-creator"
import { SeriesEventSyncDialog } from "@/components/series/series-event-sync-dialog"
import { SeriesTemplateEventEditor } from "@/components/series/series-template-event-editor"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
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
	const [selectedTemplateEventIds, setSelectedTemplateEventIds] = useState<
		Set<string>
	>(() => new Set(loaderData.events.map((event) => event.id)))
	const [competitionMappings, setCompetitionMappings] = useState(
		loaderData.competitionMappings,
	)

	useEffect(() => {
		setSelectedTemplateEventIds((previous) => {
			const availableIds = new Set(events.map((event) => event.id))
			const next = new Set(
				[...previous].filter((eventId) => availableIds.has(eventId)),
			)

			if (next.size === 0 && events.length > 0) {
				return availableIds
			}

			return next
		})
	}, [events])

	const selectedTemplateEventList = useMemo(
		() => events.filter((event) => selectedTemplateEventIds.has(event.id)),
		[events, selectedTemplateEventIds],
	)

	const selectedTemplateEventIdList = useMemo(
		() => selectedTemplateEventList.map((event) => event.id),
		[selectedTemplateEventList],
	)

	const toggleTemplateEvent = (eventId: string) => {
		setSelectedTemplateEventIds((previous) => {
			const next = new Set(previous)
			if (next.has(eventId)) {
				next.delete(eventId)
			} else {
				next.add(eventId)
			}
			return next
		})
	}

	const selectAllTemplateEvents = () => {
		setSelectedTemplateEventIds(new Set(events.map((event) => event.id)))
	}

	const clearSelectedTemplateEvents = () => {
		setSelectedTemplateEventIds(new Set())
	}

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
			{events.length > 0 && (
				<Card>
					<CardHeader className="gap-3">
						<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
							<div>
								<CardTitle>Sync Workouts</CardTitle>
								<CardDescription>
									Select template workouts, then choose competitions to receive
									them.
								</CardDescription>
							</div>
							<div className="flex flex-wrap items-center gap-2">
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={selectAllTemplateEvents}
								>
									<CheckSquare className="h-4 w-4 mr-2" />
									All
								</Button>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={clearSelectedTemplateEvents}
								>
									<Square className="h-4 w-4 mr-2" />
									Clear
								</Button>
								<Button
									type="button"
									onClick={() => setIsSyncDialogOpen(true)}
									disabled={selectedTemplateEventIds.size === 0}
								>
									<RefreshCw className="h-4 w-4 mr-2" />
									Sync to Competitions
								</Button>
							</div>
						</div>
					</CardHeader>
					<CardContent>
						<div className="flex flex-wrap gap-2">
							{events.map((event) => (
								// biome-ignore lint/a11y/noLabelWithoutControl: Radix Checkbox renders internal input
								<label
									key={event.id}
									className="flex min-h-10 cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/50"
								>
									<Checkbox
										checked={selectedTemplateEventIds.has(event.id)}
										onCheckedChange={() => toggleTemplateEvent(event.id)}
									/>
									<span className="font-medium">{event.name}</span>
									{event.parentEventId ? (
										<Badge variant="outline">Sub-event</Badge>
									) : null}
								</label>
							))}
						</div>
						<p className="mt-3 text-sm text-muted-foreground">
							{selectedTemplateEventIds.size} of {events.length} selected
						</p>
					</CardContent>
				</Card>
			)}

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

			<SeriesEventSyncDialog
				groupId={groupId}
				open={isSyncDialogOpen}
				onOpenChange={setIsSyncDialogOpen}
				onSynced={refreshData}
				selectedTemplateEventIds={selectedTemplateEventIdList}
				selectedTemplateEvents={selectedTemplateEventList.map((event) => ({
					id: event.id,
					name: event.name,
				}))}
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
