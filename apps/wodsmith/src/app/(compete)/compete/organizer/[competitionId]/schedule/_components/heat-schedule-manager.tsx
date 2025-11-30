"use client"

import { useState } from "react"
import { useServerAction } from "@repo/zsa-react"
import {
	Calendar,
	ChevronDown,
	ChevronRight,
	Clock,
	Loader2,
	Users,
	Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
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
import { Checkbox } from "@/components/ui/checkbox"
import type {
	CompetitionFloor,
	CompetitionRegistration,
} from "@/db/schema"
import type { CompetitionWorkout } from "@/server/competition-workouts"
import type { HeatWithDetails } from "@/server/competition-schedule"
import {
	autoGenerateHeatsAction,
	deleteHeatsForWorkoutAction,
} from "@/actions/competition-schedule-actions"
import { HeatCard } from "./heat-card"

interface HeatScheduleManagerProps {
	competitionId: string
	floors: CompetitionFloor[]
	events: CompetitionWorkout[]
	divisions: { id: string; label: string }[]
	heats: HeatWithDetails[]
	registrations: CompetitionRegistration[]
	competitionStartDate: Date
}

export function HeatScheduleManager({
	competitionId,
	floors,
	events,
	divisions: _divisions,
	heats,
	registrations,
	competitionStartDate,
}: HeatScheduleManagerProps) {
	const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set())
	const [generateDialogOpen, setGenerateDialogOpen] = useState(false)
	const [selectedEventId, setSelectedEventId] = useState<string | null>(null)

	// Generation form state
	const [selectedFloorId, setSelectedFloorId] = useState<string>(
		floors[0]?.id ?? "",
	)
	const [startDate, setStartDate] = useState(
		competitionStartDate.toISOString().split("T")[0],
	)
	const [startTime, setStartTime] = useState("08:00")
	const [heatDuration, setHeatDuration] = useState(15)
	const [transitionTime, setTransitionTime] = useState(5)
	const [keepDivisionsPure, setKeepDivisionsPure] = useState(true)

	const generateHeats = useServerAction(autoGenerateHeatsAction)
	const deleteHeats = useServerAction(deleteHeatsForWorkoutAction)

	const toggleEventExpanded = (eventId: string) => {
		const newExpanded = new Set(expandedEvents)
		if (newExpanded.has(eventId)) {
			newExpanded.delete(eventId)
		} else {
			newExpanded.add(eventId)
		}
		setExpandedEvents(newExpanded)
	}

	const openGenerateDialog = (eventId: string) => {
		setSelectedEventId(eventId)
		setGenerateDialogOpen(true)
	}

	const handleGenerateHeats = async () => {
		if (!selectedEventId || !selectedFloorId) return

		const startDateTime = new Date(`${startDate}T${startTime}:00`)

		await generateHeats.execute({
			competitionId,
			trackWorkoutId: selectedEventId,
			floorId: selectedFloorId,
			startTime: startDateTime,
			heatDurationMinutes: heatDuration,
			transitionMinutes: transitionTime,
			keepDivisionsPure,
		})

		setGenerateDialogOpen(false)
		// Expand the event to show the new heats
		setExpandedEvents((prev) => new Set([...prev, selectedEventId]))
	}

	const handleClearHeats = async (trackWorkoutId: string) => {
		if (
			!confirm(
				"Are you sure you want to delete all heats for this event? This cannot be undone.",
			)
		) {
			return
		}

		await deleteHeats.execute({
			competitionId,
			trackWorkoutId,
		})
	}

	// Group heats by event
	const heatsByEvent = new Map<string, HeatWithDetails[]>()
	for (const heat of heats) {
		const existing = heatsByEvent.get(heat.trackWorkoutId) ?? []
		existing.push(heat)
		heatsByEvent.set(heat.trackWorkoutId, existing)
	}

	// Count registrations by division
	const registrationsByDivision = new Map<string, number>()
	for (const reg of registrations) {
		if (reg.divisionId) {
			const count = registrationsByDivision.get(reg.divisionId) ?? 0
			registrationsByDivision.set(reg.divisionId, count + 1)
		}
	}

	if (events.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Heat Schedule</CardTitle>
					<CardDescription>
						Create heat schedules for each event
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="text-center py-8 text-muted-foreground">
						<p>No events configured yet.</p>
						<p className="text-sm mt-1">
							Add events first, then come back to create heat schedules.
						</p>
					</div>
				</CardContent>
			</Card>
		)
	}

	if (floors.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Heat Schedule</CardTitle>
					<CardDescription>
						Create heat schedules for each event
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="text-center py-8 text-muted-foreground">
						<p>No floors configured yet.</p>
						<p className="text-sm mt-1">
							Add at least one floor above to start creating heat schedules.
						</p>
					</div>
				</CardContent>
			</Card>
		)
	}

	const selectedEvent = events.find((e) => e.id === selectedEventId)

	return (
		<>
			<Card>
				<CardHeader>
					<CardTitle>Heat Schedule</CardTitle>
					<CardDescription>
						Create heat schedules for each event. Total registrations:{" "}
						{registrations.length}
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{events.map((event) => {
						const eventHeats = heatsByEvent.get(event.id) ?? []
						const isExpanded = expandedEvents.has(event.id)
						const totalAssigned = eventHeats.reduce(
							(sum, h) => sum + h.assignments.length,
							0,
						)

						return (
							<Collapsible
								key={event.id}
								open={isExpanded}
								onOpenChange={() => toggleEventExpanded(event.id)}
							>
								<div className="border rounded-lg">
									<CollapsibleTrigger asChild>
										<div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50">
											<div className="flex items-center gap-3">
												{isExpanded ? (
													<ChevronDown className="h-4 w-4" />
												) : (
													<ChevronRight className="h-4 w-4" />
												)}
												<div>
													<div className="font-medium">
														Event {event.trackOrder}: {event.workout.name}
													</div>
													<div className="text-sm text-muted-foreground">
														{eventHeats.length} heats · {totalAssigned}/
														{registrations.length} assigned
													</div>
												</div>
											</div>
											<div className="flex items-center gap-2">
												{eventHeats.length > 0 && (
													<Button
														variant="ghost"
														size="sm"
														onClick={(e) => {
															e.stopPropagation()
															handleClearHeats(event.id)
														}}
														disabled={deleteHeats.isPending}
													>
														Clear
													</Button>
												)}
												<Button
													size="sm"
													onClick={(e) => {
														e.stopPropagation()
														openGenerateDialog(event.id)
													}}
												>
													<Zap className="h-4 w-4 mr-2" />
													{eventHeats.length > 0
														? "Regenerate"
														: "Generate Heats"}
												</Button>
											</div>
										</div>
									</CollapsibleTrigger>
									<CollapsibleContent>
										<div className="border-t p-4">
											{eventHeats.length === 0 ? (
												<div className="text-center py-4 text-muted-foreground">
													No heats generated yet
												</div>
											) : (
												<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
													{eventHeats.map((heat) => (
														<HeatCard
															key={heat.id}
															heat={heat}
															competitionId={competitionId}
														/>
													))}
												</div>
											)}
										</div>
									</CollapsibleContent>
								</div>
							</Collapsible>
						)
					})}
				</CardContent>
			</Card>

			{/* Generate Heats Dialog */}
			<Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
				<DialogContent className="sm:max-w-[500px]">
					<DialogHeader>
						<DialogTitle>Generate Heats</DialogTitle>
						<DialogDescription>
							{selectedEvent && (
								<>
									Automatically create heats for Event {selectedEvent.trackOrder}:{" "}
									{selectedEvent.workout.name}
								</>
							)}
						</DialogDescription>
					</DialogHeader>
					<div className="grid gap-4 py-4">
						<div className="grid gap-2">
							<Label>Floor</Label>
							<Select
								value={selectedFloorId}
								onValueChange={setSelectedFloorId}
							>
								<SelectTrigger>
									<SelectValue placeholder="Select floor" />
								</SelectTrigger>
								<SelectContent>
									{floors.map((floor) => (
										<SelectItem key={floor.id} value={floor.id}>
											{floor.name} (capacity: {floor.capacity})
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="startDate">
									<Calendar className="h-4 w-4 inline mr-2" />
									Date
								</Label>
								<Input
									id="startDate"
									type="date"
									value={startDate}
									onChange={(e) => setStartDate(e.target.value)}
								/>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="startTime">
									<Clock className="h-4 w-4 inline mr-2" />
									First Heat
								</Label>
								<Input
									id="startTime"
									type="time"
									value={startTime}
									onChange={(e) => setStartTime(e.target.value)}
								/>
							</div>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="heatDuration">Heat Duration (min)</Label>
								<Input
									id="heatDuration"
									type="number"
									min={1}
									max={120}
									value={heatDuration}
									onChange={(e) => setHeatDuration(Number(e.target.value))}
								/>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="transitionTime">Transition (min)</Label>
								<Input
									id="transitionTime"
									type="number"
									min={0}
									max={60}
									value={transitionTime}
									onChange={(e) => setTransitionTime(Number(e.target.value))}
								/>
							</div>
						</div>

						<div className="flex items-center gap-3">
							<Checkbox
								id="keepDivisionsPure"
								checked={keepDivisionsPure}
								onCheckedChange={(checked) => setKeepDivisionsPure(checked === true)}
							/>
							<div className="space-y-0.5">
								<Label htmlFor="keepDivisionsPure">Keep Divisions Together</Label>
								<div className="text-sm text-muted-foreground">
									Athletes in the same division compete in the same heats
								</div>
							</div>
						</div>

						{/* Preview */}
						<div className="bg-muted/50 rounded-lg p-4">
							<div className="text-sm font-medium mb-2">Preview</div>
							<div className="text-sm text-muted-foreground space-y-1">
								<div className="flex items-center gap-2">
									<Users className="h-4 w-4" />
									{registrations.length} athletes to schedule
								</div>
								<div className="flex items-center gap-2">
									<Clock className="h-4 w-4" />
									~{Math.ceil(
										registrations.length /
											(floors.find((f) => f.id === selectedFloorId)?.capacity ??
												10),
									)}{" "}
									heats needed
								</div>
								<div className="flex items-center gap-2">
									<Calendar className="h-4 w-4" />
									{heatDuration + transitionTime} min between heat starts
								</div>
							</div>
						</div>
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setGenerateDialogOpen(false)}
						>
							Cancel
						</Button>
						<Button
							onClick={handleGenerateHeats}
							disabled={!selectedFloorId || generateHeats.isPending}
						>
							{generateHeats.isPending && (
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
							)}
							Generate Heats
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	)
}
