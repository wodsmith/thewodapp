"use client"

import {
	draggable,
	dropTargetForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter"
import { pointerOutsideOfPreview } from "@atlaskit/pragmatic-drag-and-drop/element/pointer-outside-of-preview"
import { setCustomNativeDragPreview } from "@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview"
import { useServerAction } from "@repo/zsa-react"
import {
	ChevronDown,
	ChevronRight,
	Clock,
	Edit2,
	GripVertical,
	Loader2,
	MapPin,
	Plus,
	Trash2,
	X,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import {
	assignJudgeToHeatAction,
	bulkAssignJudgesToHeatAction,
	moveJudgeAssignmentAction,
	removeJudgeFromHeatAction,
} from "@/actions/judge-scheduling-actions"
import { Badge } from "@/components/ui/badge"
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
import type { HeatWithAssignments } from "@/server/competition-heats"
import type {
	JudgeHeatAssignment,
	JudgeVolunteerInfo,
} from "@/server/judge-scheduling"
import { CredentialBadge } from "./credential-badge"

interface DroppableLaneProps {
	laneNum: number
	onDropUnassigned: (membershipIds: string[], laneNumber: number) => void
	onDropAssigned: (
		assignmentId: string,
		sourceHeatId: string,
		laneNumber: number,
		assignment: JudgeHeatAssignment,
	) => void
	selectedJudgeIds?: Set<string>
	onTapAssign?: (laneNumber: number) => void
}

function DroppableLane({
	laneNum,
	onDropUnassigned,
	onDropAssigned,
	selectedJudgeIds,
	onTapAssign,
}: DroppableLaneProps) {
	const ref = useRef<HTMLDivElement>(null)
	const [isDraggedOver, setIsDraggedOver] = useState(false)
	const hasSelection = selectedJudgeIds && selectedJudgeIds.size > 0

	function handleClick() {
		if (hasSelection && onTapAssign) {
			onTapAssign(laneNum)
		}
	}

	useEffect(() => {
		const element = ref.current
		if (!element) return

		return dropTargetForElements({
			element,
			canDrop: ({ source }) =>
				source.data.type === "judge" || source.data.type === "assigned",
			onDragEnter: () => setIsDraggedOver(true),
			onDragLeave: () => setIsDraggedOver(false),
			onDrop: ({ source }) => {
				setIsDraggedOver(false)

				if (source.data.type === "assigned") {
					// Moving an already assigned judge
					const assignmentId = source.data.assignmentId as string
					const sourceHeatId = source.data.heatId as string
					const assignment = source.data.assignment as JudgeHeatAssignment
					if (assignmentId && sourceHeatId && assignment) {
						onDropAssigned(assignmentId, sourceHeatId, laneNum, assignment)
					}
				} else {
					// Dropping unassigned judge(s)
					const membershipIds = source.data.membershipIds as
						| string[]
						| undefined
					if (membershipIds && Array.isArray(membershipIds)) {
						onDropUnassigned(membershipIds, laneNum)
					}
				}
			},
		})
	}, [laneNum, onDropUnassigned, onDropAssigned])

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if ((e.key === "Enter" || e.key === " ") && hasSelection) {
			e.preventDefault()
			handleClick()
		}
	}

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: drop target with conditional click handler
		<div
			ref={ref}
			role={hasSelection ? "button" : undefined}
			tabIndex={hasSelection ? 0 : undefined}
			onClick={handleClick}
			onKeyDown={hasSelection ? handleKeyDown : undefined}
			className={`flex items-center gap-3 py-1 border-b border-border/50 last:border-0 transition-colors ${
				isDraggedOver ? "bg-primary/10 border-primary rounded" : ""
			} ${hasSelection ? "cursor-pointer hover:bg-primary/5" : ""}`}
		>
			{/* Spacer to align with grip handle in assigned rows - hidden on mobile */}
			<div className="hidden md:block h-3 w-3" />
			<span className="w-6 text-sm text-muted-foreground tabular-nums">
				L{laneNum}
			</span>
			<span
				className={`flex-1 text-sm ${
					isDraggedOver
						? "text-primary font-medium"
						: hasSelection
							? "text-primary/70"
							: "text-muted-foreground"
				}`}
			>
				{isDraggedOver ? "Drop here" : hasSelection ? "Tap to assign" : "Empty"}
			</span>
		</div>
	)
}

interface DraggableAssignedJudgeProps {
	assignment: JudgeHeatAssignment
	heatId: string
	laneNum: number
	onRemove: () => void
	isRemoving: boolean
}

function DraggableAssignedJudge({
	assignment,
	heatId,
	laneNum,
	onRemove,
	isRemoving,
}: DraggableAssignedJudgeProps) {
	const ref = useRef<HTMLDivElement>(null)
	const [isDragging, setIsDragging] = useState(false)

	const displayName =
		`${assignment.volunteer.firstName ?? ""} ${assignment.volunteer.lastName ?? ""}`.trim() ||
		"Unknown"

	useEffect(() => {
		const element = ref.current
		if (!element) return

		return draggable({
			element,
			getInitialData: () => ({
				type: "assigned",
				assignmentId: assignment.id,
				heatId,
				membershipId: assignment.membershipId,
				displayName,
				laneNumber: laneNum,
				// Include full assignment for cross-heat moves
				assignment: {
					id: assignment.id,
					heatId: assignment.heatId,
					membershipId: assignment.membershipId,
					laneNumber: laneNum,
					position: assignment.position,
					instructions: assignment.instructions,
					volunteer: assignment.volunteer,
					createdAt: assignment.createdAt,
					updatedAt: assignment.updatedAt,
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
	}, [assignment.id, heatId, assignment, displayName, laneNum])

	return (
		<div
			ref={ref}
			className={`flex items-center gap-3 py-1 border-b border-border/50 last:border-0 ${
				isDragging ? "opacity-50" : ""
			}`}
		>
			<GripVertical className="hidden md:block h-3 w-3 text-muted-foreground cursor-grab active:cursor-grabbing" />
			<span className="w-6 text-sm text-muted-foreground tabular-nums">
				L{laneNum}
			</span>
			<span className="flex-1 text-sm">{displayName}</span>
			<CredentialBadge
				credentials={assignment.volunteer.credentials}
				className="text-xs"
			/>
			{assignment.isManualOverride && (
				<Edit2
					className="h-3 w-3 text-orange-500"
					aria-label="Manually modified"
				/>
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

interface JudgeHeatCardProps {
	heat: HeatWithAssignments
	competitionId: string
	organizingTeamId: string
	unassignedVolunteers: JudgeVolunteerInfo[]
	judgeAssignments: JudgeHeatAssignment[]
	maxLanes: number
	onDelete: () => void
	onAssignmentChange: (assignments: JudgeHeatAssignment[]) => void
	onMoveAssignment?: (
		assignmentId: string,
		sourceHeatId: string,
		targetHeatId: string,
		targetLane: number,
		assignment: JudgeHeatAssignment,
	) => void
	selectedJudgeIds?: Set<string>
	onClearSelection?: () => void
}

/**
 * Heat card adapted for judge scheduling.
 * Replaces athlete display with judge + credential badge.
 * Supports cross-heat drag-drop for judges.
 */
export function JudgeHeatCard({
	heat,
	competitionId,
	organizingTeamId,
	unassignedVolunteers,
	judgeAssignments,
	maxLanes,
	onDelete,
	onAssignmentChange,
	onMoveAssignment,
	selectedJudgeIds,
	onClearSelection,
}: JudgeHeatCardProps) {
	const [isAssignOpen, setIsAssignOpen] = useState(false)
	const [selectedMembershipId, setSelectedMembershipId] = useState<string>("")
	const [selectedLane, setSelectedLane] = useState<number>(1)

	const assignJudge = useServerAction(assignJudgeToHeatAction)
	const removeJudge = useServerAction(removeJudgeFromHeatAction)
	const moveJudge = useServerAction(moveJudgeAssignmentAction)
	const bulkAssign = useServerAction(bulkAssignJudgesToHeatAction)

	// Get this heat's judge assignments
	const heatAssignments = judgeAssignments.filter((ja) => ja.heatId === heat.id)

	// Get occupied lanes
	const occupiedLanes = new Set(heatAssignments.map((a) => a.laneNumber))

	// Get available lanes
	const availableLanes = Array.from(
		{ length: maxLanes },
		(_, i) => i + 1,
	).filter((lane) => !occupiedLanes.has(lane))

	const isFull = heatAssignments.length >= maxLanes
	const [isExpanded, setIsExpanded] = useState(!isFull)

	// Format time
	function formatTime(date: Date | null): string {
		if (!date) return "No time set"
		return new Date(date).toLocaleString(undefined, {
			dateStyle: "short",
			timeStyle: "short",
		})
	}

	async function handleAssign() {
		if (!selectedMembershipId || !selectedLane) return

		const [result, _error] = await assignJudge.execute({
			heatId: heat.id,
			competitionId,
			organizingTeamId,
			membershipId: selectedMembershipId,
			laneNumber: selectedLane,
		})

		if (result?.data) {
			// Find the volunteer data
			const volunteer = unassignedVolunteers.find(
				(v) => v.membershipId === selectedMembershipId,
			)
			if (volunteer) {
				const newAssignment: JudgeHeatAssignment = {
					...result.data,
					volunteer,
				}
				onAssignmentChange([...heatAssignments, newAssignment])
			}
			setIsAssignOpen(false)
			setSelectedMembershipId("")
			// Auto-select next available lane
			const nextLane =
				availableLanes.find((l) => l > selectedLane) ?? availableLanes[0]
			setSelectedLane(nextLane ?? 1)
		}
	}

	async function handleRemove(assignmentId: string) {
		const [, error] = await removeJudge.execute({
			assignmentId,
			competitionId,
			organizingTeamId,
		})

		if (!error) {
			onAssignmentChange(heatAssignments.filter((a) => a.id !== assignmentId))
		}
	}

	async function handleDropAssign(membershipIds: string[], startLane: number) {
		// Filter to only IDs that exist in unassigned and limit to available lanes
		const validIds = membershipIds.filter((id) =>
			unassignedVolunteers.some((v) => v.membershipId === id),
		)

		if (validIds.length === 0) return

		// Get available lanes starting from startLane
		const lanesToUse = availableLanes
			.filter((l) => l >= startLane)
			.concat(availableLanes.filter((l) => l < startLane))
			.slice(0, validIds.length)

		if (lanesToUse.length === 0) return

		// Build assignments - zip IDs with lanes
		const assignments: { membershipId: string; laneNumber: number }[] = []
		for (let i = 0; i < Math.min(validIds.length, lanesToUse.length); i++) {
			const membershipId = validIds[i]
			const lane = lanesToUse[i]
			if (membershipId && lane !== undefined) {
				assignments.push({ membershipId, laneNumber: lane })
			}
		}

		if (assignments.length === 0) return

		if (assignments.length === 1) {
			// Single assignment - use existing action
			const assignment = assignments[0]
			if (!assignment) return
			const [result] = await assignJudge.execute({
				heatId: heat.id,
				competitionId,
				organizingTeamId,
				membershipId: assignment.membershipId,
				laneNumber: assignment.laneNumber,
			})

			if (result?.data) {
				const volunteer = unassignedVolunteers.find(
					(v) => v.membershipId === assignment.membershipId,
				)
				if (volunteer) {
					const newAssignment: JudgeHeatAssignment = {
						...result.data,
						volunteer,
					}
					onAssignmentChange([...heatAssignments, newAssignment])
				}
			}
		} else {
			// Bulk assignment
			const [result] = await bulkAssign.execute({
				heatId: heat.id,
				competitionId,
				organizingTeamId,
				assignments,
			})

			if (result?.data) {
				// Build new assignments from result
				const newAssignments = result.data
					.map((assignment) => {
						const volunteer = unassignedVolunteers.find(
							(v) => v.membershipId === assignment.membershipId,
						)
						if (!volunteer) return null
						return {
							...assignment,
							volunteer,
						}
					})
					.filter(Boolean) as JudgeHeatAssignment[]

				onAssignmentChange([...heatAssignments, ...newAssignments])
			}
		}

		// Clear selection after successful drop
		onClearSelection?.()
	}

	async function handleDropAssigned(
		assignmentId: string,
		sourceHeatId: string,
		targetLane: number,
		assignment: JudgeHeatAssignment,
	) {
		// If lane is occupied in this heat by someone else, don't allow
		const existingInLane = heatAssignments.find(
			(a) => a.laneNumber === targetLane && a.id !== assignmentId,
		)
		if (existingInLane) {
			return
		}

		// If moving within same heat, just update lane
		if (sourceHeatId === heat.id) {
			const [, error] = await moveJudge.execute({
				assignmentId,
				competitionId,
				organizingTeamId,
				targetHeatId: heat.id,
				targetLaneNumber: targetLane,
			})

			if (!error) {
				// Update local state
				onAssignmentChange(
					heatAssignments.map((a) =>
						a.id === assignmentId ? { ...a, laneNumber: targetLane } : a,
					),
				)
			}
		} else {
			// Cross-heat move
			const [, error] = await moveJudge.execute({
				assignmentId,
				competitionId,
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

	// Group assignments by credential for collapsed view
	const assignmentsByCredential = heatAssignments.reduce(
		(acc, assignment) => {
			const credLabel = assignment.volunteer.credentials ?? "No Credential"
			acc[credLabel] = (acc[credLabel] ?? 0) + 1
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
						<CardTitle className="text-base">
							Heat <span className="tabular-nums">{heat.heatNumber}</span>
						</CardTitle>
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
						<Badge
							variant={isFull ? "default" : "outline"}
							className="text-xs tabular-nums"
						>
							{heatAssignments.length}/{maxLanes}
						</Badge>
						<div className="flex-1" />
						{Object.entries(assignmentsByCredential).map(
							([credLabel, count]) => (
								<Badge key={credLabel} variant="secondary" className="text-xs">
									{credLabel}: {count}
								</Badge>
							),
						)}
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
						<CardTitle className="text-base">
							Heat <span className="tabular-nums">{heat.heatNumber}</span>
						</CardTitle>
						<Badge
							variant={isFull ? "default" : "outline"}
							className="text-xs tabular-nums"
						>
							{heatAssignments.length}/{maxLanes}
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
						const assignment = heatAssignments.find(
							(a) => a.laneNumber === laneNum,
						)

						if (!assignment) {
							return (
								<DroppableLane
									key={laneNum}
									laneNum={laneNum}
									onDropUnassigned={handleDropAssign}
									onDropAssigned={handleDropAssigned}
									selectedJudgeIds={selectedJudgeIds}
									onTapAssign={(lane) => {
										if (selectedJudgeIds && selectedJudgeIds.size > 0) {
											handleDropAssign(Array.from(selectedJudgeIds), lane)
										}
									}}
								/>
							)
						}

						return (
							<DraggableAssignedJudge
								key={laneNum}
								assignment={assignment}
								heatId={heat.id}
								laneNum={laneNum}
								onRemove={() => handleRemove(assignment.id)}
								isRemoving={removeJudge.isPending}
							/>
						)
					})}
				</div>

				{/* Add Judge Button */}
				{availableLanes.length > 0 && unassignedVolunteers.length > 0 && (
					<Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
						<DialogTrigger asChild>
							<Button variant="outline" size="sm" className="w-full mt-4">
								<Plus className="h-4 w-4 mr-2" />
								Assign Judge
							</Button>
						</DialogTrigger>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>
									Assign Judge to Heat {heat.heatNumber}
								</DialogTitle>
							</DialogHeader>
							<div className="space-y-4">
								<div>
									{/* biome-ignore lint/a11y/noLabelWithoutControl: Select component handles its own labeling */}
									<label className="text-sm font-medium">Judge</label>
									<Select
										value={selectedMembershipId}
										onValueChange={setSelectedMembershipId}
									>
										<SelectTrigger>
											<SelectValue placeholder="Select a judge" />
										</SelectTrigger>
										<SelectContent>
											{unassignedVolunteers.map((volunteer) => (
												<SelectItem
													key={volunteer.membershipId}
													value={volunteer.membershipId}
												>
													{`${volunteer.firstName ?? ""} ${volunteer.lastName ?? ""}`.trim() ||
														"Unknown"}{" "}
													{volunteer.credentials &&
														`(${volunteer.credentials})`}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div>
									{/* biome-ignore lint/a11y/noLabelWithoutControl: Select component handles its own labeling */}
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
											!selectedMembershipId ||
											!selectedLane ||
											assignJudge.isPending
										}
									>
										{assignJudge.isPending && (
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
