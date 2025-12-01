"use client"

import { useState, useMemo } from "react"
import { Plus, Clock, MapPin, Users, Loader2, Calculator, Info } from "lucide-react"
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
	bulkCreateHeatsAction,
} from "@/actions/competition-heat-actions"
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip"
import { DraggableAthlete } from "./draggable-athlete"
import { EventOverview } from "./event-overview"
import { HeatCard } from "./heat-card"
import { WorkoutPreview } from "./workout-preview"

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
	const [selectedVenueId, setSelectedVenueId] = useState<string>(
		venues[0]?.id ?? "",
	)
	const [isCreateOpen, setIsCreateOpen] = useState(false)
	const [filterDivisionId, setFilterDivisionId] = useState<string>("all")
	// Workout cap in minutes - user can adjust per event
	const [workoutCapMinutes, setWorkoutCapMinutes] = useState(8)
	const [selectedAthleteIds, setSelectedAthleteIds] = useState<Set<string>>(
		new Set(),
	)
	const [lastSelectedId, setLastSelectedId] = useState<string | null>(null)

	// Selection handlers
	function toggleAthleteSelection(id: string, shiftKey: boolean) {
		if (shiftKey && lastSelectedId && lastSelectedId !== id) {
			// Range selection
			const lastIndex = flatUnassignedIds.indexOf(lastSelectedId)
			const currentIndex = flatUnassignedIds.indexOf(id)

			if (lastIndex !== -1 && currentIndex !== -1) {
				const start = Math.min(lastIndex, currentIndex)
				const end = Math.max(lastIndex, currentIndex)
				const rangeIds = flatUnassignedIds.slice(start, end + 1)

				setSelectedAthleteIds((prev) => {
					const next = new Set(prev)
					for (const rangeId of rangeIds) {
						next.add(rangeId)
					}
					return next
				})
				setLastSelectedId(id)
				return
			}
		}

		// Normal toggle
		setSelectedAthleteIds((prev) => {
			const next = new Set(prev)
			if (next.has(id)) {
				next.delete(id)
			} else {
				next.add(id)
			}
			return next
		})
		setLastSelectedId(id)
	}

	function clearSelection() {
		setSelectedAthleteIds(new Set())
		setLastSelectedId(null)
	}

	// Format date for datetime-local input (YYYY-MM-DDTHH:MM) in local timezone
	function formatDatetimeLocal(date: Date): string {
		const year = date.getFullYear()
		const month = String(date.getMonth() + 1).padStart(2, "0")
		const day = String(date.getDate()).padStart(2, "0")
		const hours = String(date.getHours()).padStart(2, "0")
		const minutes = String(date.getMinutes()).padStart(2, "0")
		return `${year}-${month}-${day}T${hours}:${minutes}`
	}

	function getDefaultHeatTime() {
		const date = new Date(competitionStartDate)
		date.setHours(9, 0, 0, 0)
		return formatDatetimeLocal(date)
	}

	// Calculate next heat time based on last heat + workout cap + transition time
	function getNextHeatTime(venueId: string | null): string {
		// Get heats for this event at this venue
		const relevantHeats = heats.filter(
			(h) =>
				h.trackWorkoutId === selectedEventId &&
				h.scheduledTime &&
				(venueId ? h.venueId === venueId : true),
		)

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

		// Get transition time from venue (default 3 min)
		const venue = venueId ? venues.find((v) => v.id === venueId) : null
		const transitionMinutes = venue?.transitionMinutes ?? 3

		// Add workout cap + transition time to last heat
		const nextTime = new Date(latestHeat.scheduledTime)
		nextTime.setMinutes(
			nextTime.getMinutes() + workoutCapMinutes + transitionMinutes,
		)

		return formatDatetimeLocal(nextTime)
	}

	const [newHeatTime, setNewHeatTime] = useState(getDefaultHeatTime)
	const [newHeatVenueId, setNewHeatVenueId] = useState<string>("")
	const [newHeatDivisionId, setNewHeatDivisionId] = useState<string>("")
	const [newHeatNotes, setNewHeatNotes] = useState("")
	// Heat duration = workout cap + venue transition time
	const [newHeatDuration, setNewHeatDuration] = useState(workoutCapMinutes + 3)
	// Bulk create dialog state
	const [isBulkCreateOpen, setIsBulkCreateOpen] = useState(false)
	const [bulkHeatTimes, setBulkHeatTimes] = useState<string[]>([])

	// Calculate duration based on cap + venue transition
	function getHeatDuration(venueId: string | null): number {
		const venue = venueId ? venues.find((v) => v.id === venueId) : null
		const transitionMinutes = venue?.transitionMinutes ?? 3
		return workoutCapMinutes + transitionMinutes
	}

	// Handle venue change - auto-update suggested time and duration
	function handleVenueChange(venueId: string) {
		setNewHeatVenueId(venueId)
		const actualVenueId = venueId === "none" ? null : venueId
		setNewHeatTime(getNextHeatTime(actualVenueId))
		setNewHeatDuration(getHeatDuration(actualVenueId))
	}

	const createHeat = useServerAction(createHeatAction)
	const deleteHeat = useServerAction(deleteHeatAction)
	const getUnassigned = useServerAction(getUnassignedRegistrationsAction)
	const bulkCreateHeats = useServerAction(bulkCreateHeatsAction)

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

	// Flat list of unassigned registration IDs for range selection
	const flatUnassignedIds = useMemo(() => {
		const ids: string[] = []
		for (const [, regs] of unassignedByDivision) {
			for (const reg of regs) {
				ids.push(reg.id)
			}
		}
		return ids
	}, [unassignedByDivision])

	// Get selected venue
	const selectedVenue = venues.find((v) => v.id === selectedVenueId)

	// Calculate required heats based on competitors and lanes
	const heatCalculation = useMemo(() => {
		const laneCount = selectedVenue?.laneCount ?? 10
		const venueName = selectedVenue?.name ?? "No venue selected"

		const totalAthletes = registrations.length
		const unassignedCount = unassignedRegistrations.length
		const currentHeats = eventHeats.length

		// Calculate minimum heats needed for all athletes
		const minHeatsNeeded = Math.ceil(totalAthletes / laneCount)
		const remainingHeats = Math.max(0, minHeatsNeeded - currentHeats)

		// Calculate heats needed just for unassigned athletes
		const heatsForUnassigned = Math.ceil(unassignedCount / laneCount)

		return {
			totalAthletes,
			unassignedCount,
			laneCount,
			venueName,
			minHeatsNeeded,
			currentHeats,
			remainingHeats,
			heatsForUnassigned,
		}
	}, [registrations.length, unassignedRegistrations.length, eventHeats.length, selectedVenue])

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
			durationMinutes: newHeatDuration,
			divisionId,
			notes: newHeatNotes || null,
		})

		if (result?.data) {
			// Add the new heat with empty assignments
			const newHeat: HeatWithAssignments = {
				...result.data,
				durationMinutes: newHeatDuration,
				venue: venueId ? (venues.find((v) => v.id === venueId) ?? null) : null,
				division: divisionId
					? (divisions.find((d) => d.id === divisionId) ?? null)
					: null,
				assignments: [],
			}
			const updatedHeats = [...heats, newHeat]
			setHeats(updatedHeats)
			setIsCreateOpen(false)
			// Calculate next time: current heat + duration
			if (newHeatTime) {
				const nextTime = new Date(newHeatTime)
				nextTime.setMinutes(nextTime.getMinutes() + newHeatDuration)
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

	function handleMoveAssignment(
		assignmentId: string,
		sourceHeatId: string,
		targetHeatId: string,
		targetLane: number,
		assignment: HeatWithAssignments["assignments"][0],
	) {
		// Update state for both source and target heats
		setHeats(
			heats.map((h) => {
				if (h.id === sourceHeatId) {
					// Remove from source heat
					return {
						...h,
						assignments: h.assignments.filter((a) => a.id !== assignmentId),
					}
				}
				if (h.id === targetHeatId) {
					// Add to target heat with new lane
					return {
						...h,
						assignments: [
							...h.assignments,
							{ ...assignment, laneNumber: targetLane },
						],
					}
				}
				return h
			}),
		)
	}

	// Open bulk create dialog and initialize times
	function openBulkCreateDialog() {
		if (!selectedEventId || heatCalculation.remainingHeats <= 0) return

		const venueId = selectedVenueId || null
		const transitionMinutes = selectedVenue?.transitionMinutes ?? 3
		const duration = workoutCapMinutes + transitionMinutes

		// Generate times for each heat
		const times: string[] = []
		let currentTime = new Date(getNextHeatTime(venueId))

		for (let i = 0; i < heatCalculation.remainingHeats; i++) {
			times.push(formatDatetimeLocal(currentTime))
			currentTime = new Date(currentTime)
			currentTime.setMinutes(currentTime.getMinutes() + duration)
		}

		setBulkHeatTimes(times)
		setIsBulkCreateOpen(true)
	}

	// Update a heat time and cascade to subsequent heats
	function updateBulkHeatTime(index: number, newTime: string) {
		const transitionMinutes = selectedVenue?.transitionMinutes ?? 3
		const duration = workoutCapMinutes + transitionMinutes

		setBulkHeatTimes((prev) => {
			const updated = [...prev]
			updated[index] = newTime

			// Cascade time changes to all subsequent heats
			let currentTime = new Date(newTime)
			for (let i = index + 1; i < updated.length; i++) {
				currentTime = new Date(currentTime)
				currentTime.setMinutes(currentTime.getMinutes() + duration)
				updated[i] = formatDatetimeLocal(currentTime)
			}

			return updated
		})
	}

	async function handleBulkCreateHeats() {
		if (!selectedEventId || bulkHeatTimes.length === 0) return

		const venueId = selectedVenueId || null
		const transitionMinutes = selectedVenue?.transitionMinutes ?? 3
		const duration = workoutCapMinutes + transitionMinutes

		// Get the starting heat number
		const startNumber = eventHeats.length > 0
			? Math.max(...eventHeats.map((h) => h.heatNumber)) + 1
			: 1

		// Create heats one by one with their specific times
		const createdHeats: HeatWithAssignments[] = []

		for (let i = 0; i < bulkHeatTimes.length; i++) {
			const [result] = await createHeat.execute({
				competitionId,
				organizingTeamId,
				trackWorkoutId: selectedEventId,
				heatNumber: startNumber + i,
				venueId,
				scheduledTime: new Date(bulkHeatTimes[i]!),
				durationMinutes: duration,
			})

			if (result?.data) {
				createdHeats.push({
					...result.data,
					durationMinutes: duration,
					venue: selectedVenue ?? null,
					division: null,
					assignments: [],
				})
			}
		}

		if (createdHeats.length > 0) {
			setHeats([...heats, ...createdHeats])
		}

		setIsBulkCreateOpen(false)
		setBulkHeatTimes([])
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
			{/* Event Overview */}
			<EventOverview events={events} heats={heats} />

			{/* Event & Venue Selector */}
			<div className="flex flex-wrap items-center gap-4">
				<div className="flex items-center gap-2">
					<Label htmlFor="event-select" className="whitespace-nowrap">
						Event:
					</Label>
					<Select value={selectedEventId} onValueChange={setSelectedEventId}>
						<SelectTrigger id="event-select" className="w-[250px]">
							<SelectValue placeholder="Select an event" />
						</SelectTrigger>
						<SelectContent>
							{events.map((event) => (
								<SelectItem key={event.id} value={event.id}>
									{event.trackOrder}. {event.workout.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				{venues.length > 0 && (
					<div className="flex items-center gap-2">
						<Label htmlFor="venue-select" className="whitespace-nowrap">
							Venue:
						</Label>
						<Select value={selectedVenueId} onValueChange={setSelectedVenueId}>
							<SelectTrigger id="venue-select" className="w-[180px]">
								<SelectValue placeholder="Select venue" />
							</SelectTrigger>
							<SelectContent>
								{venues.map((venue) => (
									<SelectItem key={venue.id} value={venue.id}>
										{venue.name} ({venue.laneCount} lanes)
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				)}

				<div className="flex items-center gap-2">
					<Label htmlFor="workout-cap" className="whitespace-nowrap text-sm">
						Cap:
					</Label>
					<Input
						id="workout-cap"
						type="number"
						min={1}
						max={60}
						value={workoutCapMinutes}
						onChange={(e) => setWorkoutCapMinutes(Number(e.target.value))}
						className="w-16"
					/>
					<span className="text-sm text-muted-foreground">min</span>
				</div>

				<Dialog
				open={isCreateOpen}
				onOpenChange={(open) => {
					if (open) {
						// Initialize with selected venue and calculate next time
						const venueId = selectedVenueId || null
						setNewHeatVenueId(selectedVenueId)
						setNewHeatTime(getNextHeatTime(venueId))
						setNewHeatDuration(getHeatDuration(venueId))
					}
					setIsCreateOpen(open)
				}}
			>
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
								<Label htmlFor="heat-duration">
									Duration (min){" "}
									<span className="text-muted-foreground font-normal">
										cap + transition
									</span>
								</Label>
								<Input
									id="heat-duration"
									type="number"
									min={1}
									max={180}
									value={newHeatDuration}
									onChange={(e) => setNewHeatDuration(Number(e.target.value))}
								/>
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

				{/* Heat Calculation & Bulk Add */}
				{heatCalculation.remainingHeats > 0 && selectedVenue && (
					<TooltipProvider>
						<div className="flex items-center gap-2">
							<Tooltip>
								<TooltipTrigger asChild>
									<button
										type="button"
										className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
									>
										<Calculator className="h-4 w-4" />
										<span>
											{heatCalculation.totalAthletes} athletes ÷{" "}
											{heatCalculation.laneCount} lanes ={" "}
											{heatCalculation.minHeatsNeeded} heats
										</span>
									</button>
								</TooltipTrigger>
								<TooltipContent side="bottom" className="max-w-xs">
									<p className="font-medium mb-1">Heat Calculation</p>
									<ul className="text-xs space-y-1">
										<li>Total athletes: {heatCalculation.totalAthletes}</li>
										<li>
											Venue: {heatCalculation.venueName} ({heatCalculation.laneCount}{" "}
											lanes)
										</li>
										<li>Min heats needed: {heatCalculation.minHeatsNeeded}</li>
										<li>Current heats: {heatCalculation.currentHeats}</li>
									</ul>
									<p className="text-xs mt-2 text-muted-foreground">
										Note: You may need more heats to keep divisions together
									</p>
								</TooltipContent>
							</Tooltip>
							<Button
								size="sm"
								variant="secondary"
								onClick={openBulkCreateDialog}
								disabled={bulkCreateHeats.isPending}
							>
								{bulkCreateHeats.isPending ? (
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								) : (
									<Plus className="h-4 w-4 mr-2" />
								)}
								Add {heatCalculation.remainingHeats} Remaining Heat
								{heatCalculation.remainingHeats !== 1 ? "s" : ""}
							</Button>
						</div>
					</TooltipProvider>
				)}
			</div>

			{/* Bulk Create Heats Dialog */}
			<Dialog open={isBulkCreateOpen} onOpenChange={setIsBulkCreateOpen}>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle>
							Add {bulkHeatTimes.length} Heat{bulkHeatTimes.length !== 1 ? "s" : ""}
						</DialogTitle>
					</DialogHeader>
					<div className="space-y-4">
						<div className="text-sm text-muted-foreground">
							Venue: {selectedVenue?.name} ({selectedVenue?.laneCount} lanes)
						</div>
						<div className="max-h-[300px] overflow-y-auto space-y-3">
							{bulkHeatTimes.map((time, index) => (
								<div key={index} className="flex items-center gap-3">
									<span className="text-sm font-medium w-16">
										Heat {eventHeats.length + index + 1}
									</span>
									<Input
										type="datetime-local"
										value={time}
										onChange={(e) => updateBulkHeatTime(index, e.target.value)}
										className="flex-1"
									/>
								</div>
							))}
						</div>
						<div className="flex justify-end gap-2">
							<Button
								variant="outline"
								onClick={() => setIsBulkCreateOpen(false)}
							>
								Cancel
							</Button>
							<Button
								onClick={handleBulkCreateHeats}
								disabled={createHeat.isPending}
							>
								{createHeat.isPending && (
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								)}
								Create {bulkHeatTimes.length} Heat
								{bulkHeatTimes.length !== 1 ? "s" : ""}
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>

			{/* Workout Preview */}
			{selectedEvent && <WorkoutPreview event={selectedEvent} />}

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
								onMoveAssignment={handleMoveAssignment}
								selectedAthleteIds={selectedAthleteIds}
								onClearSelection={clearSelection}
							/>
						))
					)}
				</div>

				{/* Unassigned Athletes Panel */}
				<div className="sticky top-4 self-start">
					<Card className="max-h-[calc(100vh-6rem)] overflow-hidden flex flex-col">
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
						<CardContent className="overflow-y-auto flex-1">
							{selectedAthleteIds.size > 0 && (
								<div className="flex items-center justify-between mb-3 pb-2 border-b">
									<span className="text-sm font-medium text-primary">
										{selectedAthleteIds.size} selected
									</span>
									<Button
										variant="ghost"
										size="sm"
										onClick={clearSelection}
										className="h-6 text-xs"
									>
										Clear
									</Button>
								</div>
							)}
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
																isSelected={selectedAthleteIds.has(reg.id)}
																onToggleSelect={toggleAthleteSelection}
																selectedCount={selectedAthleteIds.size}
																selectedIds={selectedAthleteIds}
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
