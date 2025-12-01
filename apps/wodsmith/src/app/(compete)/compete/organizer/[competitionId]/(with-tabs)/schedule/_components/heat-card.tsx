"use client"

import { useState, useEffect, useRef } from "react"
import {
	ChevronDown,
	ChevronRight,
	Clock,
	MapPin,
	Plus,
	Trash2,
	X,
	Loader2,
} from "lucide-react"
import { useServerAction } from "@repo/zsa-react"
import {
	draggable,
	dropTargetForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter"
import { pointerOutsideOfPreview } from "@atlaskit/pragmatic-drag-and-drop/element/pointer-outside-of-preview"
import { setCustomNativeDragPreview } from "@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview"
import { GripVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import type { HeatWithAssignments } from "@/server/competition-heats"
import {
	assignToHeatAction,
	removeFromHeatAction,
	bulkAssignToHeatAction,
	moveAssignmentAction,
} from "@/actions/competition-heat-actions"

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

interface DropData {
	type: "unassigned" | "assigned"
	registrationIds?: string[]
	assignmentId?: string
	sourceHeatId?: string
}

interface DroppableLaneProps {
	laneNum: number
	heatId: string
	organizingTeamId: string
	onDropUnassigned: (registrationIds: string[], laneNumber: number) => void
	onDropAssigned: (
		assignmentId: string,
		sourceHeatId: string,
		laneNumber: number,
		assignment: HeatWithAssignments["assignments"][0],
	) => void
}

function DroppableLane({
	laneNum,
	heatId,
	organizingTeamId,
	onDropUnassigned,
	onDropAssigned,
}: DroppableLaneProps) {
	const ref = useRef<HTMLDivElement>(null)
	const [isDraggedOver, setIsDraggedOver] = useState(false)

	useEffect(() => {
		const element = ref.current
		if (!element) return

		return dropTargetForElements({
			element,
			canDrop: ({ source }) =>
				source.data.type === "athlete" || source.data.type === "assigned",
			onDragEnter: () => setIsDraggedOver(true),
			onDragLeave: () => setIsDraggedOver(false),
			onDrop: ({ source }) => {
				setIsDraggedOver(false)

				if (source.data.type === "assigned") {
					// Moving an already assigned athlete
					const assignmentId = source.data.assignmentId as string
					const sourceHeatId = source.data.heatId as string
					const assignment = source.data
						.assignment as HeatWithAssignments["assignments"][0]
					if (assignmentId && sourceHeatId && assignment) {
						onDropAssigned(assignmentId, sourceHeatId, laneNum, assignment)
					}
				} else {
					// Dropping unassigned athlete(s)
					const registrationIds = source.data.registrationIds as
						| string[]
						| undefined
					if (registrationIds && Array.isArray(registrationIds)) {
						onDropUnassigned(registrationIds, laneNum)
					}
				}
			},
		})
	}, [laneNum, heatId, organizingTeamId, onDropUnassigned, onDropAssigned])

	return (
		<div
			ref={ref}
			className={`flex items-center gap-3 py-1 border-b border-border/50 last:border-0 transition-colors ${
				isDraggedOver ? "bg-primary/10 border-primary rounded" : ""
			}`}
		>
			{/* Spacer to align with grip handle in assigned rows */}
			<div className="h-3 w-3" />
			<span className="w-6 text-sm text-muted-foreground font-mono">
				L{laneNum}
			</span>
			<span
				className={`flex-1 text-sm ${
					isDraggedOver ? "text-primary font-medium" : "text-muted-foreground"
				}`}
			>
				{isDraggedOver ? "Drop here" : "Empty"}
			</span>
		</div>
	)
}

interface DraggableAssignedAthleteProps {
	assignment: HeatWithAssignments["assignments"][0]
	heatId: string
	laneNum: number
	onRemove: () => void
	isRemoving: boolean
}

function DraggableAssignedAthlete({
	assignment,
	heatId,
	laneNum,
	onRemove,
	isRemoving,
}: DraggableAssignedAthleteProps) {
	const ref = useRef<HTMLDivElement>(null)
	const [isDragging, setIsDragging] = useState(false)

	const displayName =
		assignment.registration.teamName ??
		(`${assignment.registration.user.firstName ?? ""} ${assignment.registration.user.lastName ?? ""}`.trim() ||
			"Unknown")

	useEffect(() => {
		const element = ref.current
		if (!element) return

		return draggable({
			element,
			getInitialData: () => ({
				type: "assigned",
				assignmentId: assignment.id,
				heatId,
				registrationId: assignment.registration.id,
				displayName,
				laneNumber: laneNum,
				// Include full assignment for cross-heat moves
				assignment: {
					id: assignment.id,
					laneNumber: laneNum,
					registration: assignment.registration,
				},
			}),
			onDragStart: () => setIsDragging(true),
			onDrop: () => setIsDragging(false),
			onGenerateDragPreview({ nativeSetDragImage }) {
				setCustomNativeDragPreview({
					nativeSetDragImage,
					getOffset: pointerOutsideOfPreview({ x: "16px", y: "8px" }),
					render({ container }) {
						const preview = document.createElement("div")
						preview.style.cssText = `
							background: hsl(var(--background));
							border: 2px solid hsl(var(--primary));
							border-radius: 6px;
							padding: 8px 12px;
							font-size: 14px;
							color: hsl(var(--foreground));
							box-shadow: 0 4px 12px rgba(0,0,0,0.25);
						`
						preview.textContent = displayName
						container.appendChild(preview)
					},
				})
			},
		})
	}, [assignment.id, heatId, assignment.registration.id, displayName, laneNum])

	return (
		<div
			ref={ref}
			className={`flex items-center gap-3 py-1 border-b border-border/50 last:border-0 ${
				isDragging ? "opacity-50" : ""
			}`}
		>
			<GripVertical className="h-3 w-3 text-muted-foreground cursor-grab active:cursor-grabbing" />
			<span className="w-6 text-sm text-muted-foreground font-mono">
				L{laneNum}
			</span>
			<span className="flex-1 text-sm">{displayName}</span>
			{assignment.registration.division && (
				<Badge variant="outline" className="text-xs">
					{assignment.registration.division.label}
				</Badge>
			)}
			<Button
				variant="ghost"
				size="icon"
				className="h-6 w-6"
				onClick={onRemove}
				disabled={isRemoving}
			>
				<X className="h-3 w-3" />
			</Button>
		</div>
	)
}

interface HeatCardProps {
	heat: HeatWithAssignments
	organizingTeamId: string
	unassignedRegistrations: Registration[]
	maxLanes: number
	onDelete: () => void
	onAssignmentChange: (assignments: HeatWithAssignments["assignments"]) => void
	onMoveAssignment?: (
		assignmentId: string,
		sourceHeatId: string,
		targetHeatId: string,
		targetLane: number,
		assignment: HeatWithAssignments["assignments"][0],
	) => void
	onClearSelection?: () => void
}

export function HeatCard({
	heat,
	organizingTeamId,
	unassignedRegistrations,
	maxLanes,
	onDelete,
	onAssignmentChange,
	onMoveAssignment,
	onClearSelection,
}: HeatCardProps) {
	const [isAssignOpen, setIsAssignOpen] = useState(false)
	const [selectedRegistrationId, setSelectedRegistrationId] =
		useState<string>("")
	const [selectedLane, setSelectedLane] = useState<number>(1)

	const assignToHeat = useServerAction(assignToHeatAction)
	const removeFromHeat = useServerAction(removeFromHeatAction)
	const moveAssignment = useServerAction(moveAssignmentAction)
	const bulkAssign = useServerAction(bulkAssignToHeatAction)

	// Get occupied lanes
	const occupiedLanes = new Set(heat.assignments.map((a) => a.laneNumber))

	// Get available lanes
	const availableLanes = Array.from(
		{ length: maxLanes },
		(_, i) => i + 1,
	).filter((lane) => !occupiedLanes.has(lane))

	const isFull = heat.assignments.length >= maxLanes
	const [isExpanded, setIsExpanded] = useState(!isFull)

	// Format time
	function formatTime(date: Date | null): string {
		if (!date) return "No time set"
		return new Date(date).toLocaleString(undefined, {
			dateStyle: "short",
			timeStyle: "short",
		})
	}

	// Get athlete display name
	function getAthleteName(
		reg: HeatWithAssignments["assignments"][0]["registration"],
	): string {
		if (reg.teamName) return reg.teamName
		const name = `${reg.user.firstName ?? ""} ${reg.user.lastName ?? ""}`.trim()
		return name || "Unknown"
	}

	async function handleAssign() {
		if (!selectedRegistrationId || !selectedLane) return

		const [result, error] = await assignToHeat.execute({
			heatId: heat.id,
			organizingTeamId,
			registrationId: selectedRegistrationId,
			laneNumber: selectedLane,
		})

		if (result?.data) {
			// Find the registration data
			const reg = unassignedRegistrations.find(
				(r) => r.id === selectedRegistrationId,
			)
			if (reg) {
				const newAssignment = {
					id: result.data.id,
					laneNumber: selectedLane,
					registration: {
						id: reg.id,
						teamName: reg.teamName,
						user: reg.user,
						division: reg.division,
						affiliate: null,
					},
				}
				onAssignmentChange([...heat.assignments, newAssignment])
			}
			setIsAssignOpen(false)
			setSelectedRegistrationId("")
			// Auto-select next available lane
			const nextLane =
				availableLanes.find((l) => l > selectedLane) ?? availableLanes[0]
			setSelectedLane(nextLane ?? 1)
		}
	}

	async function handleRemove(assignmentId: string) {
		const [, error] = await removeFromHeat.execute({
			assignmentId,
			organizingTeamId,
		})

		if (!error) {
			onAssignmentChange(heat.assignments.filter((a) => a.id !== assignmentId))
		}
	}

	async function handleDropAssign(
		registrationIds: string[],
		startLane: number,
	) {
		// Filter to only IDs that exist in unassigned and limit to available lanes
		const validIds = registrationIds.filter((id) =>
			unassignedRegistrations.some((r) => r.id === id),
		)

		if (validIds.length === 0) return

		// Get available lanes starting from startLane
		const lanesToUse = availableLanes
			.filter((l) => l >= startLane)
			.concat(availableLanes.filter((l) => l < startLane))
			.slice(0, validIds.length)

		if (lanesToUse.length === 0) return

		// Build assignments - zip IDs with lanes
		const assignments: { registrationId: string; laneNumber: number }[] = []
		for (let i = 0; i < Math.min(validIds.length, lanesToUse.length); i++) {
			const regId = validIds[i]
			const lane = lanesToUse[i]
			if (regId && lane !== undefined) {
				assignments.push({ registrationId: regId, laneNumber: lane })
			}
		}

		if (assignments.length === 0) return

		if (assignments.length === 1) {
			// Single assignment - use existing action
			const assignment = assignments[0]!
			const [result] = await assignToHeat.execute({
				heatId: heat.id,
				organizingTeamId,
				registrationId: assignment.registrationId,
				laneNumber: assignment.laneNumber,
			})

			if (result?.data) {
				const reg = unassignedRegistrations.find(
					(r) => r.id === assignment.registrationId,
				)
				if (reg) {
					const newAssignment = {
						id: result.data.id,
						laneNumber: assignment.laneNumber,
						registration: {
							id: reg.id,
							teamName: reg.teamName,
							user: reg.user,
							division: reg.division,
							affiliate: null,
						},
					}
					onAssignmentChange([...heat.assignments, newAssignment])
				}
			}
		} else {
			// Bulk assignment
			const [result] = await bulkAssign.execute({
				heatId: heat.id,
				organizingTeamId,
				assignments,
			})

			if (result?.data) {
				// Build new assignments from result
				const newAssignments = result.data
					.map((assignment) => {
						const reg = unassignedRegistrations.find(
							(r) => r.id === assignment.registrationId,
						)
						if (!reg) return null
						return {
							id: assignment.id,
							laneNumber: assignment.laneNumber,
							registration: {
								id: reg.id,
								teamName: reg.teamName,
								user: reg.user,
								division: reg.division,
								affiliate: null,
							},
						}
					})
					.filter(Boolean) as HeatWithAssignments["assignments"]

				onAssignmentChange([...heat.assignments, ...newAssignments])
			}
		}

		// Clear selection after successful drop
		onClearSelection?.()
	}

	async function handleDropAssigned(
		assignmentId: string,
		sourceHeatId: string,
		targetLane: number,
		assignment: HeatWithAssignments["assignments"][0],
	) {
		// If lane is occupied in this heat by someone else, don't allow
		const existingInLane = heat.assignments.find(
			(a) => a.laneNumber === targetLane && a.id !== assignmentId,
		)
		if (existingInLane) {
			return
		}

		// If moving within same heat, just update lane
		if (sourceHeatId === heat.id) {
			const [, error] = await moveAssignment.execute({
				assignmentId,
				organizingTeamId,
				targetHeatId: heat.id,
				targetLaneNumber: targetLane,
			})

			if (!error) {
				// Update local state
				onAssignmentChange(
					heat.assignments.map((a) =>
						a.id === assignmentId ? { ...a, laneNumber: targetLane } : a,
					),
				)
			}
		} else {
			// Cross-heat move
			const [, error] = await moveAssignment.execute({
				assignmentId,
				organizingTeamId,
				targetHeatId: heat.id,
				targetLaneNumber: targetLane,
			})

			if (!error && onMoveAssignment) {
				// Let parent handle state updates for both heats
				onMoveAssignment(
					assignmentId,
					sourceHeatId,
					heat.id,
					targetLane,
					assignment,
				)
			}
		}
	}

	// Group assignments by division for collapsed view
	const assignmentsByDivision = heat.assignments.reduce(
		(acc, assignment) => {
			const divLabel = assignment.registration.division?.label ?? "No Division"
			acc[divLabel] = (acc[divLabel] ?? 0) + 1
			return acc
		},
		{} as Record<string, number>,
	)

	// Collapsed view for full heats
	if (!isExpanded) {
		return (
			<Card
				className="cursor-pointer hover:bg-muted/50 transition-colors"
				onClick={() => setIsExpanded(true)}
			>
				<CardHeader className="py-3">
					<div className="flex items-center gap-3">
						<ChevronRight className="h-4 w-4 text-muted-foreground" />
						<CardTitle className="text-base">Heat {heat.heatNumber}</CardTitle>
						<div className="flex items-center gap-2 text-sm text-muted-foreground">
							{heat.scheduledTime && (
								<span className="flex items-center gap-1">
									<Clock className="h-3 w-3" />
									{formatTime(heat.scheduledTime)}
								</span>
							)}
							{heat.venue && (
								<span className="flex items-center gap-1">
									<MapPin className="h-3 w-3" />
									{heat.venue.name}
								</span>
							)}
						</div>
						<Badge variant={isFull ? "default" : "outline"} className="text-xs">
							{heat.assignments.length}/{maxLanes}
						</Badge>
						<div className="flex-1" />
						{Object.entries(assignmentsByDivision).map(([divLabel, count]) => (
							<Badge key={divLabel} variant="secondary" className="text-xs">
								{divLabel}: {count}
							</Badge>
						))}
					</div>
				</CardHeader>
			</Card>
		)
	}

	return (
		<Card>
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<Button
							variant="ghost"
							size="icon"
							className="h-6 w-6"
							onClick={() => setIsExpanded(false)}
						>
							<ChevronDown className="h-4 w-4" />
						</Button>
						<CardTitle className="text-base">Heat {heat.heatNumber}</CardTitle>
						<Badge variant={isFull ? "default" : "outline"} className="text-xs">
							{heat.assignments.length}/{maxLanes}
						</Badge>
					</div>
					<div className="flex items-center gap-2">
						{heat.division && (
							<Badge variant="secondary">{heat.division.label}</Badge>
						)}
						<Button variant="ghost" size="icon" onClick={onDelete}>
							<Trash2 className="h-4 w-4" />
						</Button>
					</div>
				</div>
				<div className="flex items-center gap-4 text-sm text-muted-foreground">
					{heat.scheduledTime && (
						<span className="flex items-center gap-1">
							<Clock className="h-3 w-3" />
							{formatTime(heat.scheduledTime)}
						</span>
					)}
					{heat.venue && (
						<span className="flex items-center gap-1">
							<MapPin className="h-3 w-3" />
							{heat.venue.name}
						</span>
					)}
				</div>
			</CardHeader>
			<CardContent>
				{/* Lane Assignments */}
				<div className="space-y-2">
					{Array.from({ length: maxLanes }, (_, i) => i + 1).map((laneNum) => {
						const assignment = heat.assignments.find(
							(a) => a.laneNumber === laneNum,
						)

						if (!assignment) {
							return (
								<DroppableLane
									key={laneNum}
									laneNum={laneNum}
									heatId={heat.id}
									organizingTeamId={organizingTeamId}
									onDropUnassigned={handleDropAssign}
									onDropAssigned={handleDropAssigned}
								/>
							)
						}

						return (
							<DraggableAssignedAthlete
								key={laneNum}
								assignment={assignment}
								heatId={heat.id}
								laneNum={laneNum}
								onRemove={() => handleRemove(assignment.id)}
								isRemoving={removeFromHeat.isPending}
							/>
						)
					})}
				</div>

				{/* Add Athlete Button */}
				{availableLanes.length > 0 && unassignedRegistrations.length > 0 && (
					<Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
						<DialogTrigger asChild>
							<Button variant="outline" size="sm" className="w-full mt-4">
								<Plus className="h-4 w-4 mr-2" />
								Assign Athlete
							</Button>
						</DialogTrigger>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>
									Assign Athlete to Heat {heat.heatNumber}
								</DialogTitle>
							</DialogHeader>
							<div className="space-y-4">
								<div>
									<label className="text-sm font-medium">Athlete</label>
									<Select
										value={selectedRegistrationId}
										onValueChange={setSelectedRegistrationId}
									>
										<SelectTrigger>
											<SelectValue placeholder="Select an athlete" />
										</SelectTrigger>
										<SelectContent>
											{unassignedRegistrations.map((reg) => (
												<SelectItem key={reg.id} value={reg.id}>
													{reg.teamName ??
														(`${reg.user.firstName ?? ""} ${reg.user.lastName ?? ""}`.trim() ||
															"Unknown")}{" "}
													{reg.division && `(${reg.division.label})`}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div>
									<label className="text-sm font-medium">Lane</label>
									<Select
										value={String(selectedLane)}
										onValueChange={(v) => setSelectedLane(Number(v))}
									>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{availableLanes.map((lane) => (
												<SelectItem key={lane} value={String(lane)}>
													Lane {lane}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div className="flex justify-end gap-2">
									<Button
										variant="outline"
										onClick={() => setIsAssignOpen(false)}
									>
										Cancel
									</Button>
									<Button
										onClick={handleAssign}
										disabled={
											!selectedRegistrationId ||
											!selectedLane ||
											assignToHeat.isPending
										}
									>
										{assignToHeat.isPending && (
											<Loader2 className="h-4 w-4 mr-2 animate-spin" />
										)}
										Assign
									</Button>
								</div>
							</div>
						</DialogContent>
					</Dialog>
				)}

			</CardContent>
		</Card>
	)
}
