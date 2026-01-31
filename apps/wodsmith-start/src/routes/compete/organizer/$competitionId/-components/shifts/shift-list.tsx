"use client"

import { useServerFn } from "@tanstack/react-start"
import { CalendarDays, Clock, Edit2, MapPin, Plus, Trash2, Users } from "lucide-react"
import { useCallback, useMemo, useState } from "react"
import { toast } from "sonner"
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table"
import type { VolunteerRoleType, VolunteerShift } from "@/db/schemas/volunteers"
import { deleteShiftFn, getCompetitionShiftsFn } from "@/server-fns/volunteer-shift-fns"
import { ShiftAssignmentPanel } from "./shift-assignment-panel"
import { ShiftFormDialog } from "./shift-form-dialog"

// Type inferred from getCompetitionShiftsFn return type
type ShiftWithAssignments = Awaited<ReturnType<typeof getCompetitionShiftsFn>>[number]

// Role type display labels
const ROLE_TYPE_LABELS: Record<VolunteerRoleType, string> = {
	judge: "Judge",
	head_judge: "Head Judge",
	scorekeeper: "Scorekeeper",
	emcee: "Emcee",
	floor_manager: "Floor Manager",
	media: "Media",
	general: "General",
	equipment: "Equipment",
	medical: "Medical",
	check_in: "Check-In",
	staff: "Staff",
	athlete_control: "Athlete Control",
	equipment_team: "Equipment Team",
}

// Get badge variant based on capacity fill
function getCapacityBadgeVariant(
	assigned: number,
	capacity: number,
): "default" | "secondary" | "destructive" | "outline" {
	if (assigned >= capacity) return "default" // Full
	if (assigned > 0) return "secondary" // Partially filled
	return "outline" // Empty
}

interface DayGroup {
	dateKey: string
	label: string
	shifts: ShiftWithAssignments[]
}

function formatTime(date: Date): string {
	return date.toLocaleTimeString("en-US", {
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	})
}

function formatDayLabel(date: Date): string {
	return date.toLocaleDateString("en-US", {
		weekday: "long",
		month: "short",
		day: "numeric",
	})
}

function getDateKey(date: Date): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function toDate(value: Date | string | number): Date {
	if (value instanceof Date) return new Date(value.getTime())
	return new Date(value)
}

interface ShiftListProps {
	competitionId: string
	competitionTeamId: string
	shifts: ShiftWithAssignments[]
}

/**
 * Admin component to display all shifts for a competition with add/edit/delete actions.
 * Shifts are grouped by date and show name, role type, time, location, and assignment counts.
 */
export function ShiftList({
	competitionId,
	competitionTeamId,
	shifts: initialShifts,
}: ShiftListProps) {
	const [shifts, setShifts] = useState(initialShifts)
	const [deletingShiftId, setDeletingShiftId] = useState<string | null>(null)
	const [isDeleting, setIsDeleting] = useState(false)
	const [formDialogOpen, setFormDialogOpen] = useState(false)
	const [editingShift, setEditingShift] = useState<VolunteerShift | undefined>(undefined)
	const [assignmentPanelOpen, setAssignmentPanelOpen] = useState(false)
	const [selectedShift, setSelectedShift] = useState<ShiftWithAssignments | null>(null)

	const deleteShift = useServerFn(deleteShiftFn)

	const handleOpenCreateDialog = useCallback(() => {
		setEditingShift(undefined)
		setFormDialogOpen(true)
	}, [])

	const handleOpenEditDialog = useCallback((shift: VolunteerShift) => {
		setEditingShift(shift)
		setFormDialogOpen(true)
	}, [])

	const handleOpenAssignmentPanel = useCallback((shift: ShiftWithAssignments) => {
		setSelectedShift(shift)
		setAssignmentPanelOpen(true)
	}, [])

	const handleAssignmentChange = useCallback((updatedShift: ShiftWithAssignments) => {
		setShifts((prev) =>
			prev.map((s) => (s.id === updatedShift.id ? updatedShift : s)),
		)
		setSelectedShift(updatedShift)
	}, [])

	// Group shifts by date
	const dayGroups = useMemo<DayGroup[]>(() => {
		const groups = new Map<string, DayGroup>()

		// Sort shifts by start time first
		const sortedShifts = [...shifts].sort((a, b) => {
			const aTime = toDate(a.startTime).getTime()
			const bTime = toDate(b.startTime).getTime()
			return aTime - bTime
		})

		for (const shift of sortedShifts) {
			const startDate = toDate(shift.startTime)
			const dateKey = getDateKey(startDate)
			const label = formatDayLabel(startDate)

			const existing = groups.get(dateKey)
			if (existing) {
				existing.shifts.push(shift)
			} else {
				groups.set(dateKey, { dateKey, label, shifts: [shift] })
			}
		}

		// Sort groups by date
		return Array.from(groups.values()).sort((a, b) => a.dateKey.localeCompare(b.dateKey))
	}, [shifts])

	const handleDelete = async () => {
		if (!deletingShiftId) return

		setIsDeleting(true)
		try {
			await deleteShift({
				data: { shiftId: deletingShiftId },
			})
			toast.success("Shift deleted successfully")
			setShifts((prev) => prev.filter((s) => s.id !== deletingShiftId))
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to delete shift")
		} finally {
			setIsDeleting(false)
			setDeletingShiftId(null)
		}
	}

	const shiftToDelete = deletingShiftId
		? shifts.find((s) => s.id === deletingShiftId)
		: null

	// Empty state
	if (shifts.length === 0) {
		return (
			<>
				<Card>
					<CardContent className="flex flex-col items-center justify-center py-12 text-center">
						<CalendarDays className="mb-4 h-12 w-12 text-muted-foreground" />
						<h3 className="mb-2 text-lg font-semibold">No shifts created</h3>
						<p className="mb-4 text-sm text-muted-foreground">
							Create volunteer shifts to schedule non-judge roles like check-in, medical staff, and more.
						</p>
						<Button onClick={handleOpenCreateDialog}>
							<Plus className="mr-2 h-4 w-4" />
							Add Shift
						</Button>
					</CardContent>
				</Card>

				<ShiftFormDialog
					competitionId={competitionId}
					open={formDialogOpen}
					onOpenChange={setFormDialogOpen}
					shift={editingShift}
				/>
			</>
		)
	}

	return (
		<div className="space-y-6">
			{/* Header with Add button */}
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-2xl font-bold tracking-tight">Volunteer Shifts</h2>
					<p className="text-muted-foreground">
						Manage time-based volunteer shifts for non-judge roles
					</p>
				</div>
				<Button onClick={handleOpenCreateDialog}>
					<Plus className="mr-2 h-4 w-4" />
					Add Shift
				</Button>
			</div>

			{/* Shifts grouped by date */}
			{dayGroups.map((group) => (
				<Card key={group.dateKey}>
					<CardHeader className="pb-3">
						<CardTitle className="flex items-center gap-2 text-lg">
							<CalendarDays className="h-5 w-5 text-muted-foreground" />
							{group.label}
						</CardTitle>
						<CardDescription>
							{group.shifts.length} shift{group.shifts.length !== 1 ? "s" : ""}
						</CardDescription>
					</CardHeader>
					<CardContent className="p-0">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Shift Name</TableHead>
									<TableHead>Role</TableHead>
									<TableHead>Time</TableHead>
									<TableHead>Location</TableHead>
									<TableHead>Assigned</TableHead>
									<TableHead className="text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{group.shifts.map((shift) => {
									const startTime = toDate(shift.startTime)
									const endTime = toDate(shift.endTime)
									const assignedCount = shift.assignments.length
									const capacityVariant = getCapacityBadgeVariant(
										assignedCount,
										shift.capacity,
									)

									return (
										<TableRow
											key={shift.id}
											className="cursor-pointer hover:bg-muted/50"
											onClick={() => handleOpenAssignmentPanel(shift)}
										>
											<TableCell className="font-medium">
												{shift.name}
											</TableCell>
											<TableCell>
												<Badge variant="outline">
													{ROLE_TYPE_LABELS[shift.roleType] || shift.roleType}
												</Badge>
											</TableCell>
											<TableCell>
												<div className="flex items-center gap-1 text-sm">
													<Clock className="h-3.5 w-3.5 text-muted-foreground" />
													{formatTime(startTime)} - {formatTime(endTime)}
												</div>
											</TableCell>
											<TableCell>
												{shift.location ? (
													<div className="flex items-center gap-1 text-sm">
														<MapPin className="h-3.5 w-3.5 text-muted-foreground" />
														{shift.location}
													</div>
												) : (
													<span className="text-sm text-muted-foreground">-</span>
												)}
											</TableCell>
											<TableCell>
												<Badge variant={capacityVariant}>
													<Users className="mr-1 h-3 w-3" />
													{assignedCount} / {shift.capacity}
												</Badge>
											</TableCell>
											<TableCell className="text-right">
												<div className="flex items-center justify-end gap-1">
													<Button
														variant="ghost"
														size="sm"
														onClick={(e) => {
															e.stopPropagation()
															handleOpenEditDialog(shift)
														}}
														aria-label={`Edit ${shift.name}`}
													>
														<Edit2 className="h-4 w-4" />
													</Button>
													<Button
														variant="ghost"
														size="sm"
														onClick={(e) => {
															e.stopPropagation()
															setDeletingShiftId(shift.id)
														}}
														aria-label={`Delete ${shift.name}`}
													>
														<Trash2 className="h-4 w-4 text-destructive" />
													</Button>
												</div>
											</TableCell>
										</TableRow>
									)
								})}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			))}

			{/* Delete Confirmation Dialog */}
			<AlertDialog
				open={!!deletingShiftId}
				onOpenChange={(open) => !open && setDeletingShiftId(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Shift</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to delete "{shiftToDelete?.name}"?
							{shiftToDelete && shiftToDelete.assignments.length > 0 && (
								<>
									{" "}This shift has {shiftToDelete.assignments.length} volunteer
									{shiftToDelete.assignments.length !== 1 ? "s" : ""} assigned.
									They will be unassigned from this shift.
								</>
							)}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleDelete}
							disabled={isDeleting}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							{isDeleting ? "Deleting..." : "Delete"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* Create/Edit Shift Dialog */}
			<ShiftFormDialog
				competitionId={competitionId}
				open={formDialogOpen}
				onOpenChange={setFormDialogOpen}
				shift={editingShift}
			/>

			{/* Assignment Panel */}
			<ShiftAssignmentPanel
				shift={selectedShift}
				competitionTeamId={competitionTeamId}
				open={assignmentPanelOpen}
				onOpenChange={setAssignmentPanelOpen}
				onAssignmentChange={handleAssignmentChange}
			/>
		</div>
	)
}
