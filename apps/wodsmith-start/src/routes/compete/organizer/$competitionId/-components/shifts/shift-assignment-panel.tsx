"use client"

import { useServerFn } from "@tanstack/react-start"
import { Calendar, Clock, MapPin, Minus, Plus, User, Users } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover"
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet"
import {
	VOLUNTEER_ROLE_LABELS,
	type VolunteerMembershipMetadata,
} from "@/db/schemas/volunteers"
import {
	assignVolunteerToShiftFn,
	getCompetitionShiftsFn,
	unassignVolunteerFromShiftFn,
} from "@/server-fns/volunteer-shift-fns"
import {
	getCompetitionVolunteersFn,
	type TeamMembershipWithUser,
} from "@/server-fns/volunteer-fns"

// Type inferred from getCompetitionShiftsFn return type
type ShiftWithAssignments = Awaited<
	ReturnType<typeof getCompetitionShiftsFn>
>[number]
type ShiftAssignment = ShiftWithAssignments["assignments"][number]

function formatTime(date: Date): string {
	return date.toLocaleTimeString("en-US", {
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	})
}

function toDate(value: Date | string | number): Date {
	if (value instanceof Date) return new Date(value.getTime())
	return new Date(value)
}

function formatDateRange(startTime: Date, endTime: Date): string {
	const startDate = toDate(startTime)
	const endDate = toDate(endTime)
	const dateStr = startDate.toLocaleDateString("en-US", {
		weekday: "short",
		month: "short",
		day: "numeric",
	})
	return `${dateStr}, ${formatTime(startDate)} - ${formatTime(endDate)}`
}

function parseVolunteerRoleTypes(
	metadata: string | null,
): VolunteerMembershipMetadata["volunteerRoleTypes"] {
	if (!metadata) return []
	try {
		const parsed = JSON.parse(metadata) as VolunteerMembershipMetadata
		return parsed.volunteerRoleTypes ?? []
	} catch {
		return []
	}
}

function getVolunteerName(volunteer: TeamMembershipWithUser): string {
	if (!volunteer.user) return "Unknown"
	const name = [volunteer.user.firstName, volunteer.user.lastName]
		.filter(Boolean)
		.join(" ")
	return name || volunteer.user.email || "Unknown"
}

function formatShiftTimeCompact(
	startTime: Date | string,
	endTime: Date | string,
): string {
	const start = toDate(startTime)
	const end = toDate(endTime)
	const dateStr = start.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
	})
	const startStr = start
		.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
		.replace(":00", "")
		.toLowerCase()
	const endStr = end
		.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
		.replace(":00", "")
		.toLowerCase()
	return `${dateStr} ${startStr}-${endStr}`
}

/**
 * Get display name from an assignment's membership with user relation.
 * The user property comes from the Drizzle relation query.
 */
function getAssignmentVolunteerName(
	membership: ShiftAssignment["membership"],
): string {
	// The membership includes user from the Drizzle relation - access it safely
	const user = (
		membership as {
			user?: {
				firstName?: string | null
				lastName?: string | null
				email: string
			} | null
		}
	).user
	if (!user) return "Unknown"
	const name = [user.firstName, user.lastName].filter(Boolean).join(" ")
	return name || user.email
}

/**
 * Get email from an assignment's membership with user relation.
 */
function getAssignmentVolunteerEmail(
	membership: ShiftAssignment["membership"],
): string | null {
	const user = (membership as { user?: { email: string } | null }).user
	return user?.email ?? null
}

interface ShiftAssignmentPanelProps {
	shift: ShiftWithAssignments | null
	allShifts: ShiftWithAssignments[]
	competitionTeamId: string
	open: boolean
	onOpenChange: (open: boolean) => void
	onAssignmentChange: (updatedShift: ShiftWithAssignments) => void
}

/**
 * Side panel for viewing and managing volunteer assignments for a specific shift.
 * Shows shift details, currently assigned volunteers, and available volunteers to add.
 */
export function ShiftAssignmentPanel({
	shift,
	allShifts,
	competitionTeamId,
	open,
	onOpenChange,
	onAssignmentChange,
}: ShiftAssignmentPanelProps) {
	const [allVolunteers, setAllVolunteers] = useState<TeamMembershipWithUser[]>(
		[],
	)
	const [loadingVolunteers, setLoadingVolunteers] = useState(false)
	const [assigningId, setAssigningId] = useState<string | null>(null)
	const [unassigningId, setUnassigningId] = useState<string | null>(null)

	const getVolunteers = useServerFn(getCompetitionVolunteersFn)
	const assignVolunteer = useServerFn(assignVolunteerToShiftFn)
	const unassignVolunteer = useServerFn(unassignVolunteerFromShiftFn)

	// Fetch all volunteers when panel opens
	// Note: getVolunteers is excluded from deps since it's a stable hook reference
	// and including it can cause unnecessary refetches
	useEffect(() => {
		if (open && competitionTeamId) {
			setLoadingVolunteers(true)
			getVolunteers({ data: { competitionTeamId } })
				.then((volunteers) => {
					setAllVolunteers(volunteers)
				})
				.catch((error) => {
					console.error("Failed to load volunteers:", error)
					toast.error("Failed to load volunteers")
				})
				.finally(() => {
					setLoadingVolunteers(false)
				})
		}
	}, [open, competitionTeamId, getVolunteers])

	// Get assigned membership IDs for filtering
	const assignedMembershipIds = useMemo(() => {
		if (!shift) return new Set<string>()
		return new Set(shift.assignments.map((a) => a.membershipId))
	}, [shift])

	// Filter available volunteers by roleType and exclude already assigned
	const availableVolunteers = useMemo(() => {
		if (!shift) return []
		return allVolunteers.filter((volunteer) => {
			// Exclude already assigned volunteers
			if (assignedMembershipIds.has(volunteer.id)) return false
			// Filter by roleType
			const roleTypes = parseVolunteerRoleTypes(volunteer.metadata)
			return roleTypes.includes(shift.roleType)
		})
	}, [allVolunteers, shift, assignedMembershipIds])

	// Build a map of membershipId -> other shifts they're assigned to (excluding current shift)
	const volunteerOtherShifts = useMemo(() => {
		if (!shift) return new Map<string, ShiftWithAssignments[]>()
		const map = new Map<string, ShiftWithAssignments[]>()
		for (const s of allShifts) {
			if (s.id === shift.id) continue // Exclude current shift
			for (const assignment of s.assignments) {
				const existing = map.get(assignment.membershipId) ?? []
				existing.push(s)
				map.set(assignment.membershipId, existing)
			}
		}
		return map
	}, [allShifts, shift])

	// Calculate capacity info
	const assignedCount = shift?.assignments.length ?? 0
	const capacity = shift?.capacity ?? 0
	const isAtCapacity = assignedCount >= capacity

	const handleAssign = useCallback(
		async (membershipId: string) => {
			if (!shift) return

			setAssigningId(membershipId)
			try {
				await assignVolunteer({
					data: { shiftId: shift.id, membershipId },
				})

				// Find the volunteer to add to assignments
				const volunteer = allVolunteers.find((v) => v.id === membershipId)
				if (volunteer) {
					// Construct assignment with all required fields for type compatibility
					const newAssignment = {
						id: `temp-${Date.now()}`,
						shiftId: shift.id,
						membershipId,
						notes: null,
						createdAt: new Date(),
						updatedAt: new Date(),
						updateCounter: 0,
						membership: {
							id: volunteer.id,
							teamId: volunteer.teamId,
							userId: volunteer.userId,
							roleId: volunteer.roleId,
							isSystemRole: volunteer.isSystemRole,
							metadata: volunteer.metadata,
							invitedBy: volunteer.invitedBy,
							invitedAt: volunteer.invitedAt,
							joinedAt: volunteer.joinedAt,
							isActive: volunteer.isActive,
							createdAt: volunteer.createdAt,
							updatedAt: volunteer.updatedAt,
							updateCounter: volunteer.updateCounter,
							expiresAt: volunteer.expiresAt,
							// Include user for display purposes
							user: volunteer.user,
						},
					} as ShiftAssignment

					const updatedShift: ShiftWithAssignments = {
						...shift,
						assignments: [...shift.assignments, newAssignment],
					}
					onAssignmentChange(updatedShift)
				}

				toast.success("Volunteer assigned successfully")
			} catch (error) {
				toast.error(
					error instanceof Error ? error.message : "Failed to assign volunteer",
				)
			} finally {
				setAssigningId(null)
			}
		},
		[shift, assignVolunteer, allVolunteers, onAssignmentChange],
	)

	const handleUnassign = useCallback(
		async (membershipId: string) => {
			if (!shift) return

			setUnassigningId(membershipId)
			try {
				await unassignVolunteer({
					data: { shiftId: shift.id, membershipId },
				})

				const updatedShift: ShiftWithAssignments = {
					...shift,
					assignments: shift.assignments.filter(
						(a) => a.membershipId !== membershipId,
					),
				}
				onAssignmentChange(updatedShift)

				toast.success("Volunteer unassigned successfully")
			} catch (error) {
				toast.error(
					error instanceof Error
						? error.message
						: "Failed to unassign volunteer",
				)
			} finally {
				setUnassigningId(null)
			}
		},
		[shift, unassignVolunteer, onAssignmentChange],
	)

	if (!shift) return null

	const startTime = toDate(shift.startTime)
	const endTime = toDate(shift.endTime)

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="flex w-full flex-col sm:max-w-md">
				<SheetHeader className="space-y-1">
					<SheetTitle>{shift.name}</SheetTitle>
					<SheetDescription>
						Manage volunteer assignments for this shift
					</SheetDescription>
				</SheetHeader>

				{/* Scrollable content area */}
				<div className="mt-4 flex-1 overflow-y-auto">
					{/* Shift Details */}
					<div className="space-y-3 rounded-lg border bg-muted/30 p-4">
						<div className="flex items-center gap-2">
							<Badge variant="outline">
								{VOLUNTEER_ROLE_LABELS[shift.roleType] || shift.roleType}
							</Badge>
							<Badge
								variant={isAtCapacity ? "default" : "secondary"}
								className="ml-auto"
							>
								<Users className="mr-1 h-3 w-3" />
								{assignedCount}/{capacity} assigned
							</Badge>
						</div>

						<div className="flex items-center gap-2 text-sm text-muted-foreground">
							<Clock className="h-4 w-4" />
							{formatDateRange(startTime, endTime)}
						</div>

						{shift.location && (
							<div className="flex items-center gap-2 text-sm text-muted-foreground">
								<MapPin className="h-4 w-4" />
								{shift.location}
							</div>
						)}

						{shift.notes && (
							<p className="text-sm text-muted-foreground">{shift.notes}</p>
						)}
					</div>

					{/* Assigned Volunteers */}
					<div className="mt-6">
						<h3 className="mb-3 text-sm font-medium">Assigned Volunteers</h3>
						{shift.assignments.length === 0 ? (
							<p className="text-sm text-muted-foreground">
								No volunteers assigned yet
							</p>
						) : (
							<div className="space-y-2">
								{shift.assignments.map((assignment) => {
									const volunteerName = getAssignmentVolunteerName(
										assignment.membership,
									)
									const volunteerEmail = getAssignmentVolunteerEmail(
										assignment.membership,
									)

									return (
										<div
											key={assignment.id}
											className="flex items-center justify-between rounded-md border bg-card p-2"
										>
											<div className="flex items-center gap-2">
												<div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
													<User className="h-4 w-4 text-primary" />
												</div>
												<div>
													<p className="text-sm font-medium">{volunteerName}</p>
													{volunteerEmail && (
														<p className="text-xs text-muted-foreground">
															{volunteerEmail}
														</p>
													)}
												</div>
											</div>
											<Button
												variant="ghost"
												size="sm"
												onClick={() => handleUnassign(assignment.membershipId)}
												disabled={unassigningId === assignment.membershipId}
												aria-label={`Remove ${volunteerName}`}
											>
												<Minus className="h-4 w-4 text-destructive" />
											</Button>
										</div>
									)
								})}
							</div>
						)}
					</div>

					{/* Available Volunteers */}
					<div className="mt-6 flex-1">
						<h3 className="mb-3 text-sm font-medium">
							Available Volunteers ({VOLUNTEER_ROLE_LABELS[shift.roleType]})
						</h3>
						{loadingVolunteers ? (
							<p className="text-sm text-muted-foreground">
								Loading volunteers...
							</p>
						) : availableVolunteers.length === 0 ? (
							<p className="text-sm text-muted-foreground">
								No available volunteers with the{" "}
								{VOLUNTEER_ROLE_LABELS[shift.roleType]} role type
							</p>
						) : (
							<div className="space-y-2">
								{availableVolunteers.map((volunteer) => {
									const volunteerName = getVolunteerName(volunteer)
									const otherShifts =
										volunteerOtherShifts.get(volunteer.id) ?? []

									return (
										<div
											key={volunteer.id}
											className="flex items-center justify-between rounded-md border bg-card p-2"
										>
											<div className="flex items-center gap-2">
												<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
													<User className="h-4 w-4 text-muted-foreground" />
												</div>
												<div className="min-w-0">
													<p className="text-sm font-medium">{volunteerName}</p>
													{volunteer.user?.email && (
														<p className="truncate text-xs text-muted-foreground">
															{volunteer.user.email}
														</p>
													)}
													{otherShifts.length > 0 && (
														<Popover>
															<PopoverTrigger asChild>
																<button
																	type="button"
																	className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
																>
																	<Calendar className="h-3 w-3 shrink-0" />
																	<span className="underline decoration-dotted">
																		{otherShifts.length} other shift
																		{otherShifts.length !== 1 ? "s" : ""}
																	</span>
																</button>
															</PopoverTrigger>
															<PopoverContent
																className="w-64 p-2"
																align="start"
															>
																<p className="mb-2 text-xs font-medium text-muted-foreground">
																	Assigned Shifts
																</p>
																<div className="space-y-1.5">
																	{otherShifts.map((s) => (
																		<div key={s.id} className="text-sm">
																			<p className="font-medium">{s.name}</p>
																			<p className="text-xs text-muted-foreground">
																				{formatShiftTimeCompact(
																					s.startTime,
																					s.endTime,
																				)}
																			</p>
																		</div>
																	))}
																</div>
															</PopoverContent>
														</Popover>
													)}
												</div>
											</div>
											<Button
												variant="ghost"
												size="sm"
												onClick={() => handleAssign(volunteer.id)}
												disabled={isAtCapacity || assigningId === volunteer.id}
												aria-label={`Add ${volunteerName}`}
												title={
													isAtCapacity
														? "Shift is at capacity"
														: `Add ${volunteerName}`
												}
											>
												<Plus className="h-4 w-4 text-primary" />
											</Button>
										</div>
									)
								})}
							</div>
						)}
						{isAtCapacity && availableVolunteers.length > 0 && (
							<p className="mt-2 text-xs text-muted-foreground">
								Shift is at capacity. Remove a volunteer to add another.
							</p>
						)}
					</div>
				</div>
				{/* End scrollable content area */}
			</SheetContent>
		</Sheet>
	)
}
