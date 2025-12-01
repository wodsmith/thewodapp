"use client"

import { useState, useMemo } from "react"
import { Plus, Clock, MapPin, Users, Loader2 } from "lucide-react"
import { useServerAction } from "@repo/zsa-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import type { CompetitionVenue } from "@/db/schema"
import type { CompetitionWorkout } from "@/server/competition-workouts"
import type { HeatWithAssignments } from "@/server/competition-heats"
import {
	createHeatAction,
	deleteHeatAction,
	getUnassignedRegistrationsAction,
} from "@/actions/competition-heat-actions"
import { HeatCard } from "./heat-card"

interface Division {
	id: string
	label: string
	position: number
	registrationCount: number
	description: string | null
	feeCents: number | null
}

interface Registration {
	id: string
	teamName: string | null
	user: {
		id: string
		firstName: string | null
		lastName: string | null
	}
	division: {
		id: string
		label: string
	} | null
}

interface HeatScheduleManagerProps {
	competitionId: string
	organizingTeamId: string
	events: CompetitionWorkout[]
	venues: CompetitionVenue[]
	heats: HeatWithAssignments[]
	divisions: Division[]
	registrations: Registration[]
}

export function HeatScheduleManager({
	competitionId,
	organizingTeamId,
	events,
	venues,
	heats: initialHeats,
	divisions,
	registrations,
}: HeatScheduleManagerProps) {
	const [heats, setHeats] = useState(initialHeats)
	const [selectedEventId, setSelectedEventId] = useState<string>(
		events[0]?.id ?? "",
	)
	const [isCreateOpen, setIsCreateOpen] = useState(false)
	const [newHeatTime, setNewHeatTime] = useState("")
	const [newHeatVenueId, setNewHeatVenueId] = useState<string>("")
	const [newHeatDivisionId, setNewHeatDivisionId] = useState<string>("")
	const [newHeatNotes, setNewHeatNotes] = useState("")

	const createHeat = useServerAction(createHeatAction)
	const deleteHeat = useServerAction(deleteHeatAction)
	const getUnassigned = useServerAction(getUnassignedRegistrationsAction)

	// Get the selected event
	const selectedEvent = events.find((e) => e.id === selectedEventId)

	// Filter heats for the selected event
	const eventHeats = useMemo(
		() => heats.filter((h) => h.trackWorkoutId === selectedEventId),
		[heats, selectedEventId],
	)

	// Get assigned registration IDs for this event
	const assignedRegistrationIds = useMemo(() => {
		const ids = new Set<string>()
		for (const heat of eventHeats) {
			for (const assignment of heat.assignments) {
				ids.add(assignment.registration.id)
			}
		}
		return ids
	}, [eventHeats])

	// Unassigned registrations for this event
	const unassignedRegistrations = useMemo(
		() => registrations.filter((r) => !assignedRegistrationIds.has(r.id)),
		[registrations, assignedRegistrationIds],
	)

	// Group unassigned by division
	const unassignedByDivision = useMemo(() => {
		const grouped = new Map<string, Registration[]>()
		for (const reg of unassignedRegistrations) {
			const divId = reg.division?.id ?? "no-division"
			const existing = grouped.get(divId) ?? []
			existing.push(reg)
			grouped.set(divId, existing)
		}
		return grouped
	}, [unassignedRegistrations])

	async function handleCreateHeat() {
		if (!selectedEventId) return

		const [result, error] = await createHeat.execute({
			competitionId,
			organizingTeamId,
			trackWorkoutId: selectedEventId,
			venueId: newHeatVenueId || null,
			scheduledTime: newHeatTime ? new Date(newHeatTime) : null,
			divisionId: newHeatDivisionId || null,
			notes: newHeatNotes || null,
		})

		if (result?.data) {
			// Add the new heat with empty assignments
			const newHeat: HeatWithAssignments = {
				...result.data,
				venue: venues.find((v) => v.id === newHeatVenueId) ?? null,
				division: divisions.find((d) => d.id === newHeatDivisionId) ?? null,
				assignments: [],
			}
			setHeats([...heats, newHeat])
			setIsCreateOpen(false)
			setNewHeatTime("")
			setNewHeatVenueId("")
			setNewHeatDivisionId("")
			setNewHeatNotes("")
		}
	}

	async function handleDeleteHeat(heatId: string) {
		if (!confirm("Delete this heat? All assignments will be removed.")) return

		const [, error] = await deleteHeat.execute({
			id: heatId,
			organizingTeamId,
		})

		if (!error) {
			setHeats(heats.filter((h) => h.id !== heatId))
		}
	}

	function handleAssignmentChange(
		heatId: string,
		updatedAssignments: HeatWithAssignments["assignments"],
	) {
		setHeats(
			heats.map((h) =>
				h.id === heatId ? { ...h, assignments: updatedAssignments } : h,
			),
		)
	}

	if (events.length === 0) {
		return (
			<Card className="border-dashed">
				<CardContent className="py-8 text-center text-muted-foreground">
					<p className="mb-4">No events created yet.</p>
					<p className="text-sm">
						Create events in the Events tab first, then come back to create the heat schedule.
					</p>
				</CardContent>
			</Card>
		)
	}

	return (
		<div className="space-y-6">
			{/* Event Selector */}
			<div className="flex items-center gap-4">
				<Label htmlFor="event-select" className="whitespace-nowrap">
					Select Event:
				</Label>
				<Select value={selectedEventId} onValueChange={setSelectedEventId}>
					<SelectTrigger id="event-select" className="w-[300px]">
						<SelectValue placeholder="Select an event" />
					</SelectTrigger>
					<SelectContent>
						{events.map((event) => (
							<SelectItem key={event.id} value={event.id}>
								Event {event.trackOrder}: {event.workout.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				<Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
					<DialogTrigger asChild>
						<Button size="sm">
							<Plus className="h-4 w-4 mr-2" />
							Add Heat
						</Button>
					</DialogTrigger>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Create Heat for {selectedEvent?.workout.name}</DialogTitle>
						</DialogHeader>
						<div className="space-y-4">
							<div>
								<Label htmlFor="heat-time">Scheduled Time (optional)</Label>
								<Input
									id="heat-time"
									type="datetime-local"
									value={newHeatTime}
									onChange={(e) => setNewHeatTime(e.target.value)}
								/>
							</div>
							<div>
								<Label htmlFor="heat-venue">Venue (optional)</Label>
								<Select value={newHeatVenueId} onValueChange={setNewHeatVenueId}>
									<SelectTrigger id="heat-venue">
										<SelectValue placeholder="Select a venue" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="">No venue</SelectItem>
										{venues.map((venue) => (
											<SelectItem key={venue.id} value={venue.id}>
												{venue.name} ({venue.laneCount} lanes)
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div>
								<Label htmlFor="heat-division">Division Filter (optional)</Label>
								<Select value={newHeatDivisionId} onValueChange={setNewHeatDivisionId}>
									<SelectTrigger id="heat-division">
										<SelectValue placeholder="All divisions" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="">All divisions</SelectItem>
										{divisions.map((div) => (
											<SelectItem key={div.id} value={div.id}>
												{div.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div>
								<Label htmlFor="heat-notes">Notes (optional)</Label>
								<Input
									id="heat-notes"
									value={newHeatNotes}
									onChange={(e) => setNewHeatNotes(e.target.value)}
									placeholder="e.g., Finals heat"
								/>
							</div>
							<div className="flex justify-end gap-2">
								<Button variant="outline" onClick={() => setIsCreateOpen(false)}>
									Cancel
								</Button>
								<Button onClick={handleCreateHeat} disabled={createHeat.isPending}>
									{createHeat.isPending && (
										<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									)}
									Create Heat
								</Button>
							</div>
						</div>
					</DialogContent>
				</Dialog>
			</div>

			{/* Stats */}
			<div className="flex gap-4 text-sm text-muted-foreground">
				<span>{eventHeats.length} heats</span>
				<span>•</span>
				<span>{assignedRegistrationIds.size} assigned</span>
				<span>•</span>
				<span>{unassignedRegistrations.length} unassigned</span>
			</div>

			{/* Heat Grid + Unassigned Panel */}
			<div className="grid gap-6 lg:grid-cols-3">
				{/* Heats Column */}
				<div className="lg:col-span-2 space-y-4">
					{eventHeats.length === 0 ? (
						<Card className="border-dashed">
							<CardContent className="py-8 text-center text-muted-foreground">
								<p>No heats for this event yet.</p>
								<p className="text-sm mt-2">Click "Add Heat" to create one.</p>
							</CardContent>
						</Card>
					) : (
						eventHeats.map((heat) => (
							<HeatCard
								key={heat.id}
								heat={heat}
								organizingTeamId={organizingTeamId}
								unassignedRegistrations={unassignedRegistrations}
								maxLanes={heat.venue?.laneCount ?? 10}
								onDelete={() => handleDeleteHeat(heat.id)}
								onAssignmentChange={(assignments) =>
									handleAssignmentChange(heat.id, assignments)
								}
							/>
						))
					)}
				</div>

				{/* Unassigned Athletes Panel */}
				<div>
					<Card>
						<CardHeader className="pb-3">
							<CardTitle className="text-base flex items-center gap-2">
								<Users className="h-4 w-4" />
								Unassigned Athletes
							</CardTitle>
						</CardHeader>
						<CardContent>
							{unassignedRegistrations.length === 0 ? (
								<p className="text-sm text-muted-foreground text-center py-4">
									All athletes are assigned to heats.
								</p>
							) : (
								<div className="space-y-4">
									{Array.from(unassignedByDivision.entries()).map(
										([divId, regs]) => {
											const divisionLabel =
												divisions.find((d) => d.id === divId)?.label ??
												"No Division"

											return (
												<div key={divId}>
													<h4 className="text-sm font-medium mb-2">
														{divisionLabel} ({regs.length})
													</h4>
													<div className="space-y-1">
														{regs.slice(0, 10).map((reg) => (
															<div
																key={reg.id}
																className="text-sm px-2 py-1 bg-muted rounded"
															>
																{reg.teamName ??
																	(`${reg.user.firstName ?? ""} ${reg.user.lastName ?? ""}`.trim() ||
																	"Unknown")}
															</div>
														))}
														{regs.length > 10 && (
															<p className="text-xs text-muted-foreground">
																+{regs.length - 10} more
															</p>
														)}
													</div>
												</div>
											)
										},
									)}
								</div>
							)}
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	)
}
