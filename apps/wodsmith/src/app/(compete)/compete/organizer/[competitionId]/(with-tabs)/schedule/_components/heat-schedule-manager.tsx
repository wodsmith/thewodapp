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
import { DraggableAthlete } from "./draggable-athlete"
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
	registeredAt: Date
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
	competitionStartDate: Date
	events: CompetitionWorkout[]
	venues: CompetitionVenue[]
	heats: HeatWithAssignments[]
	divisions: Division[]
	registrations: Registration[]
}

export function HeatScheduleManager({
	competitionId,
	organizingTeamId,
	competitionStartDate,
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
	const [filterDivisionId, setFilterDivisionId] = useState<string>("all")

	// Format date for datetime-local input (YYYY-MM-DDTHH:MM)
	function formatDatetimeLocal(date: Date): string {
		return date.toISOString().slice(0, 16)
	}

	function getDefaultHeatTime() {
		const date = new Date(competitionStartDate)
		date.setHours(8, 0, 0, 0)
		return formatDatetimeLocal(date)
	}

	// Calculate next heat time based on last heat at venue + transition time
	function getNextHeatTime(venueId: string | null): string {
		// Get heats at this venue (or all heats if no venue)
		const relevantHeats = venueId
			? heats.filter((h) => h.venueId === venueId && h.scheduledTime)
			: heats.filter((h) => h.scheduledTime)

		if (relevantHeats.length === 0) {
			return getDefaultHeatTime()
		}

		// Find the latest scheduled heat
		const latestHeat = relevantHeats.reduce((latest, heat) => {
			if (!heat.scheduledTime) return latest
			if (!latest?.scheduledTime) return heat
			return new Date(heat.scheduledTime) > new Date(latest.scheduledTime)
				? heat
				: latest
		}, relevantHeats[0])

		if (!latestHeat?.scheduledTime) {
			return getDefaultHeatTime()
		}

		// Get transition time from venue (default 10 min)
		const venue = venueId ? venues.find((v) => v.id === venueId) : null
		const transitionMinutes = venue?.transitionMinutes ?? 3

		// Add transition time to last heat
		const nextTime = new Date(latestHeat.scheduledTime)
		nextTime.setMinutes(nextTime.getMinutes() + transitionMinutes)

		return formatDatetimeLocal(nextTime)
	}

	const [newHeatTime, setNewHeatTime] = useState(getDefaultHeatTime)
	const [newHeatVenueId, setNewHeatVenueId] = useState<string>("")
	const [newHeatDivisionId, setNewHeatDivisionId] = useState<string>("")
	const [newHeatNotes, setNewHeatNotes] = useState("")

	// Handle venue change - auto-update suggested time
	function handleVenueChange(venueId: string) {
		setNewHeatVenueId(venueId)
		const actualVenueId = venueId === "none" ? null : venueId
		setNewHeatTime(getNextHeatTime(actualVenueId))
	}

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

	// Group unassigned by division, filtered and sorted by registeredAt DESC (newest first)
	const unassignedByDivision = useMemo(() => {
		const filtered =
			filterDivisionId === "all"
				? unassignedRegistrations
				: unassignedRegistrations.filter(
						(r) => r.division?.id === filterDivisionId,
					)

		const grouped = new Map<string, Registration[]>()
		for (const reg of filtered) {
			const divId = reg.division?.id ?? "no-division"
			const existing = grouped.get(divId) ?? []
			existing.push(reg)
			grouped.set(divId, existing)
		}

		// Sort each division by registeredAt DESC (newest first)
		for (const [divId, regs] of grouped) {
			grouped.set(
				divId,
				regs.sort(
					(a, b) =>
						new Date(b.registeredAt).getTime() -
						new Date(a.registeredAt).getTime(),
				),
			)
		}

		return grouped
	}, [unassignedRegistrations, filterDivisionId])

	async function handleCreateHeat() {
		if (!selectedEventId) return

		const venueId =
			newHeatVenueId && newHeatVenueId !== "none" ? newHeatVenueId : null
		const divisionId =
			newHeatDivisionId && newHeatDivisionId !== "none"
				? newHeatDivisionId
				: null

		const [result, error] = await createHeat.execute({
			competitionId,
			organizingTeamId,
			trackWorkoutId: selectedEventId,
			venueId,
			scheduledTime: newHeatTime ? new Date(newHeatTime) : null,
			divisionId,
			notes: newHeatNotes || null,
		})

		if (result?.data) {
			// Add the new heat with empty assignments
			const newHeat: HeatWithAssignments = {
				...result.data,
				venue: venueId ? (venues.find((v) => v.id === venueId) ?? null) : null,
				division: divisionId
					? (divisions.find((d) => d.id === divisionId) ?? null)
					: null,
				assignments: [],
			}
			const updatedHeats = [...heats, newHeat]
			setHeats(updatedHeats)
			setIsCreateOpen(false)
			// Calculate next time based on the heat we just created
			if (newHeatTime && venueId) {
				const venue = venues.find((v) => v.id === venueId)
				const transitionMinutes = venue?.transitionMinutes ?? 3
				const nextTime = new Date(newHeatTime)
				nextTime.setMinutes(nextTime.getMinutes() + transitionMinutes)
				setNewHeatTime(formatDatetimeLocal(nextTime))
			} else {
				setNewHeatTime(getDefaultHeatTime())
			}
			// Keep venue and division for consecutive heat creation
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
						Create events in the Events tab first, then come back to create the
						heat schedule.
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
							<DialogTitle>
								Create Heat for {selectedEvent?.workout.name}
							</DialogTitle>
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
								<Select
									value={newHeatVenueId}
									onValueChange={handleVenueChange}
								>
									<SelectTrigger id="heat-venue">
										<SelectValue placeholder="Select a venue" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="none">No venue</SelectItem>
										{venues.map((venue) => (
											<SelectItem key={venue.id} value={venue.id}>
												{venue.name} ({venue.laneCount} lanes)
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div>
								<Label htmlFor="heat-division">
									Division Filter (optional)
								</Label>
								<Select
									value={newHeatDivisionId}
									onValueChange={setNewHeatDivisionId}
								>
									<SelectTrigger id="heat-division">
										<SelectValue placeholder="All divisions" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="none">All divisions</SelectItem>
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
								<Button
									variant="outline"
									onClick={() => setIsCreateOpen(false)}
								>
									Cancel
								</Button>
								<Button
									onClick={handleCreateHeat}
									disabled={createHeat.isPending}
								>
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
							<div className="flex items-center justify-between">
								<CardTitle className="text-base flex items-center gap-2">
									<Users className="h-4 w-4" />
									Unassigned Athletes
								</CardTitle>
							</div>
							<Select
								value={filterDivisionId}
								onValueChange={setFilterDivisionId}
							>
								<SelectTrigger className="mt-2">
									<SelectValue placeholder="Filter by division" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Divisions</SelectItem>
									{divisions.map((div) => (
										<SelectItem key={div.id} value={div.id}>
											{div.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</CardHeader>
						<CardContent>
							{unassignedRegistrations.length === 0 ? (
								<p className="text-sm text-muted-foreground text-center py-4">
									All athletes are assigned to heats.
								</p>
							) : unassignedByDivision.size === 0 ? (
								<p className="text-sm text-muted-foreground text-center py-4">
									No athletes in this division.
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
														{regs.map((reg) => (
															<DraggableAthlete
																key={reg.id}
																registration={reg}
															/>
														))}
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
