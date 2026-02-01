"use client"

import { useRouter } from "@tanstack/react-router"
import { Calendar, Check, X } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover"
import { TableCell, TableRow } from "@/components/ui/table"
import type { User } from "@/db/schema"
import {
	VOLUNTEER_AVAILABILITY,
	VOLUNTEER_ROLE_LABELS,
	VOLUNTEER_ROLE_TYPE_VALUES,
	type VolunteerRoleType,
} from "@/db/schemas/volunteers"
import {
	addVolunteerRoleTypeFn,
	grantScoreAccessFn,
	removeVolunteerRoleTypeFn,
	revokeScoreAccessFn,
	updateVolunteerMetadataFn,
} from "@/server-fns/volunteer-fns"

interface VolunteerWithAccess {
	id: string
	userId: string
	teamId: string
	roleId: string
	isSystemRole: number
	isActive: number
	metadata: string | null
	joinedAt: Date | null
	createdAt: Date
	expiresAt: Date | null
	invitedAt: Date | null
	invitedBy: string | null
	user: User | null
	hasScoreAccess: boolean
	status?: "pending" | "approved" | "rejected"
}

interface VolunteerRowProps {
	volunteer: VolunteerWithAccess
	competitionId: string
	competitionTeamId: string
	organizingTeamId: string
	isSelected?: boolean
	onToggleSelect?: (shiftKey: boolean) => void
	assignments: {
		shifts: Array<{
			id: string
			shiftId: string
			name: string
			roleType: string
			startTime: Date
			endTime: Date
			location: string | null
			notes: string | null
		}>
		judgeHeats: Array<{
			id: string
			heatId: string
			eventName: string
			heatNumber: number
			laneNumber: number | null
			position: string | null
		}>
	}
}


function getAvailabilityLabel(availability?: string): string | null {
	switch (availability) {
		case VOLUNTEER_AVAILABILITY.MORNING:
			return "Morning"
		case VOLUNTEER_AVAILABILITY.AFTERNOON:
			return "Afternoon"
		case VOLUNTEER_AVAILABILITY.ALL_DAY:
			return "All Day"
		default:
			return null
	}
}

function parseMetadata(metadata: string | null): {
	roleTypes: VolunteerRoleType[]
	status?: "pending" | "approved" | "rejected"
	signupName?: string
	signupEmail?: string
	signupPhone?: string
	availability?: string
	// Direct invite fields
	inviteName?: string
	inviteEmail?: string
} {
	if (!metadata)
		return {
			roleTypes: [],
		}
	try {
		const parsed = JSON.parse(metadata) as {
			volunteerRoleTypes?: VolunteerRoleType[]
			status?: "pending" | "approved" | "rejected"
			signupName?: string
			signupEmail?: string
			signupPhone?: string
			availability?: string
			inviteName?: string
			inviteEmail?: string
		}
		return {
			roleTypes: parsed.volunteerRoleTypes ?? [],
			status: parsed.status,
			signupName: parsed.signupName,
			signupEmail: parsed.signupEmail,
			signupPhone: parsed.signupPhone,
			availability: parsed.availability,
			inviteName: parsed.inviteName,
			inviteEmail: parsed.inviteEmail,
		}
	} catch {
		return {
			roleTypes: [],
		}
	}
}

function getInitials(
	firstName: string | null,
	lastName: string | null,
): string {
	const first = firstName?.[0] || ""
	const last = lastName?.[0] || ""
	return (first + last).toUpperCase() || "?"
}

function formatShiftTimeCompact(startTime: Date, endTime: Date): string {
	const start = new Date(startTime)
	const end = new Date(endTime)
	const startStr = start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
	const endStr = end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
	return `${startStr} - ${endStr}`
}

export function VolunteerRow({
	volunteer,
	competitionId,
	competitionTeamId,
	organizingTeamId,
	isSelected = false,
	onToggleSelect,
	assignments,
}: VolunteerRowProps) {
	const router = useRouter()
	const metadata = parseMetadata(volunteer.metadata)
	const [scoreAccess, setScoreAccess] = useState(volunteer.hasScoreAccess)
	const [selectedRoles, setSelectedRoles] = useState<Set<VolunteerRoleType>>(
		new Set(metadata.roleTypes),
	)
	const [status, setStatus] = useState(metadata.status || "approved")
	const [isPending, setIsPending] = useState(false)

	const metadataString = volunteer.metadata
	useEffect(() => {
		const parsed = parseMetadata(metadataString)
		setSelectedRoles(new Set(parsed.roleTypes))
	}, [metadataString])

	useEffect(() => {
		setScoreAccess(volunteer.hasScoreAccess)
	}, [volunteer.hasScoreAccess])

	const handleScoreAccessToggle = async (checked: boolean) => {
		if (!volunteer.user) return

		setScoreAccess(checked)
		setIsPending(true)

		try {
			if (checked) {
				await grantScoreAccessFn({
					data: {
						volunteerId: volunteer.user.id,
						competitionTeamId,
						organizingTeamId,
						competitionId,
						grantedBy: volunteer.user.id,
					},
				})
				toast.success("Score access granted")
			} else {
				await revokeScoreAccessFn({
					data: {
						userId: volunteer.user.id,
						competitionTeamId,
						organizingTeamId,
						competitionId,
					},
				})
				toast.success("Score access revoked")
			}
		} catch (error) {
			setScoreAccess(!checked)
			toast.error(
				error instanceof Error
					? error.message
					: `Failed to ${checked ? "grant" : "revoke"} score access`,
			)
		} finally {
			setIsPending(false)
		}
	}

	const handleRoleTypeToggle = async (
		roleType: VolunteerRoleType,
		checked: boolean,
	) => {
		const newRoles = new Set(selectedRoles)
		if (checked) {
			newRoles.add(roleType)
		} else {
			newRoles.delete(roleType)
		}
		setSelectedRoles(newRoles)
		setIsPending(true)

		try {
			if (checked) {
				await addVolunteerRoleTypeFn({
					data: {
						membershipId: volunteer.id,
						organizingTeamId,
						competitionId,
						roleType,
					},
				})
				toast.success("Role type added")
			} else {
				await removeVolunteerRoleTypeFn({
					data: {
						membershipId: volunteer.id,
						organizingTeamId,
						competitionId,
						roleType,
					},
				})
				toast.success("Role type removed")
			}
			// Invalidate route to refresh judge list in JudgeSchedulingContainer
			router.invalidate()
		} catch (error) {
			// Revert on error
			if (checked) {
				newRoles.delete(roleType)
			} else {
				newRoles.add(roleType)
			}
			setSelectedRoles(newRoles)
			toast.error(
				error instanceof Error
					? error.message
					: `Failed to ${checked ? "add" : "remove"} role type`,
			)
		} finally {
			setIsPending(false)
		}
	}

	const handleApprove = async () => {
		setStatus("approved")
		setIsPending(true)

		try {
			await updateVolunteerMetadataFn({
				data: {
					membershipId: volunteer.id,
					organizingTeamId,
					competitionId,
					metadata: { status: "approved" },
				},
			})
			toast.success("Volunteer approved")
		} catch (error) {
			setStatus("pending")
			toast.error(
				error instanceof Error ? error.message : "Failed to approve volunteer",
			)
		} finally {
			setIsPending(false)
		}
	}

	const handleReject = async () => {
		setStatus("rejected")
		setIsPending(true)

		try {
			await updateVolunteerMetadataFn({
				data: {
					membershipId: volunteer.id,
					organizingTeamId,
					competitionId,
					metadata: { status: "rejected" },
				},
			})
			toast.success("Volunteer rejected")
		} catch (error) {
			setStatus("pending")
			toast.error(
				error instanceof Error ? error.message : "Failed to reject volunteer",
			)
		} finally {
			setIsPending(false)
		}
	}

	const isPendingVolunteer = status === "pending"
	// Priority: user name > signup name > invite name > invite email > "Unknown"
	const displayName = volunteer.user
		? `${volunteer.user.firstName ?? ""} ${volunteer.user.lastName ?? ""}`.trim() ||
			volunteer.user.email ||
			"Unknown"
		: metadata.signupName ||
			metadata.inviteName ||
			metadata.inviteEmail ||
			"Unknown"
	// Priority: user email > signup email > invite email > "—"
	const displayEmail = volunteer.user
		? (volunteer.user.email ?? "—")
		: metadata.signupEmail || metadata.inviteEmail || "—"
	const availabilityLabel = getAvailabilityLabel(metadata.availability)

	return (
		<TableRow className={isSelected ? "bg-muted/50" : undefined}>
			<TableCell className="w-12">
				<Checkbox
					checked={isSelected}
					onCheckedChange={() => {}}
					onClick={(e) => {
						e.stopPropagation()
						onToggleSelect?.(e.shiftKey)
					}}
					aria-label={`Select ${displayName}`}
				/>
			</TableCell>
			<TableCell>
				<div className="flex items-center gap-3">
					<Avatar className="h-8 w-8">
						<AvatarImage
							src={volunteer.user?.avatar ?? undefined}
							alt={displayName}
						/>
						<AvatarFallback className="text-xs">
							{getInitials(
								volunteer.user?.firstName ?? null,
								volunteer.user?.lastName ?? null,
							)}
						</AvatarFallback>
					</Avatar>
					<div className="flex flex-col gap-1">
						<span className="font-medium">{displayName}</span>
						<div className="flex flex-wrap gap-1">
							{isPendingVolunteer && (
								<Badge variant="outline" className="w-fit text-xs">
									Pending
								</Badge>
							)}
							{availabilityLabel && (
								<Badge variant="outline" className="w-fit text-xs">
									{availabilityLabel}
								</Badge>
							)}
						</div>
					</div>
				</div>
			</TableCell>
			<TableCell className="text-sm text-muted-foreground">
				{displayEmail}
			</TableCell>
			<TableCell>
				<div className="flex flex-wrap gap-1">
					{Array.from(selectedRoles).map((roleType) => (
						<Badge key={roleType} variant="outline">
							{VOLUNTEER_ROLE_LABELS[roleType]}
						</Badge>
					))}
					{selectedRoles.size === 0 && (
						<span className="text-sm text-muted-foreground">—</span>
					)}
				</div>
			</TableCell>
			<TableCell>
				{assignments.shifts.length === 0 && assignments.judgeHeats.length === 0 ? (
					<span className="text-sm text-muted-foreground">—</span>
				) : (
					<div className="flex flex-wrap gap-1">
						{assignments.shifts.length > 0 && (
							<Popover>
								<PopoverTrigger asChild>
									<button
										type="button"
										className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
									>
										<Calendar className="h-3 w-3 shrink-0" />
										<span className="underline decoration-dotted">
											{assignments.shifts.length} shift{assignments.shifts.length !== 1 ? 's' : ''}
										</span>
									</button>
								</PopoverTrigger>
								<PopoverContent className="w-64 p-2" align="start">
									<p className="mb-2 text-xs font-medium text-muted-foreground">Assigned Shifts</p>
									<div className="space-y-1.5">
										{assignments.shifts.map((shift) => (
											<div key={shift.id} className="text-sm">
												<p className="font-medium">{shift.name}</p>
												<p className="text-xs text-muted-foreground">
													{formatShiftTimeCompact(shift.startTime, shift.endTime)}
												</p>
											</div>
										))}
									</div>
								</PopoverContent>
							</Popover>
						)}
						{assignments.judgeHeats.length > 0 && (
							<Popover>
								<PopoverTrigger asChild>
									<button
										type="button"
										className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
									>
										<Calendar className="h-3 w-3 shrink-0" />
										<span className="underline decoration-dotted">
											{assignments.judgeHeats.length} heat{assignments.judgeHeats.length !== 1 ? 's' : ''}
										</span>
									</button>
								</PopoverTrigger>
								<PopoverContent className="w-64 p-2" align="start">
									<p className="mb-2 text-xs font-medium text-muted-foreground">Judge Assignments</p>
									<div className="space-y-1.5">
										{assignments.judgeHeats.map((heat) => (
											<div key={heat.id} className="text-sm">
												<p className="font-medium">{heat.eventName} - Heat {heat.heatNumber}</p>
												{heat.laneNumber !== null && (
													<p className="text-xs text-muted-foreground">
														Lane {heat.laneNumber}
													</p>
												)}
												{heat.position && (
													<p className="text-xs text-muted-foreground">
														{heat.position}
													</p>
												)}
											</div>
										))}
									</div>
								</PopoverContent>
							</Popover>
						)}
					</div>
				)}
			</TableCell>
			<TableCell>
				<Checkbox
					checked={scoreAccess}
					onCheckedChange={handleScoreAccessToggle}
					disabled={isPending || !volunteer.user}
				/>
			</TableCell>
			<TableCell className="text-right">
				{isPendingVolunteer ? (
					<div className="flex items-center justify-end gap-2">
						<Button
							size="sm"
							variant="outline"
							onClick={handleReject}
							disabled={isPending}
						>
							<X className="mr-1 h-4 w-4" />
							Reject
						</Button>
						<Button size="sm" onClick={handleApprove} disabled={isPending}>
							<Check className="mr-1 h-4 w-4" />
							Approve
						</Button>
					</div>
				) : (
					<DropdownMenu>
						<DropdownMenuTrigger
							className="rounded-md px-3 py-2 text-sm hover:bg-accent"
							disabled={isPending}
						>
							Edit Roles
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuLabel>Role Types</DropdownMenuLabel>
							<DropdownMenuSeparator />
							{VOLUNTEER_ROLE_TYPE_VALUES.map(
								(roleType) => (
									<DropdownMenuCheckboxItem
										key={roleType}
										checked={selectedRoles.has(roleType)}
										onCheckedChange={(checked) =>
											handleRoleTypeToggle(roleType, checked)
										}
										disabled={isPending}
									>
										{VOLUNTEER_ROLE_LABELS[roleType]}
									</DropdownMenuCheckboxItem>
								),
							)}
						</DropdownMenuContent>
					</DropdownMenu>
				)}
			</TableCell>
		</TableRow>
	)
}
