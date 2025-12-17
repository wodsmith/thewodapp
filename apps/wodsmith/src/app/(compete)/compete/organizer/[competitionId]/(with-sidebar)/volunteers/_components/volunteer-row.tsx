"use client"

import { useServerAction } from "@repo/zsa-react"
import { Check, X } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import {
	addVolunteerRoleTypeAction,
	grantScoreAccessAction,
	removeVolunteerRoleTypeAction,
	revokeScoreAccessAction,
	updateVolunteerMetadataAction,
} from "@/actions/volunteer-actions"
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
import { TableCell, TableRow } from "@/components/ui/table"
import type { User } from "@/db/schema"

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
}

type VolunteerRoleType =
	| "judge"
	| "head_judge"
	| "scorekeeper"
	| "emcee"
	| "floor_manager"
	| "media"
	| "general"

const ROLE_TYPE_LABELS: Record<VolunteerRoleType, string> = {
	judge: "Judge",
	head_judge: "Head Judge",
	scorekeeper: "Scorekeeper",
	emcee: "Emcee",
	floor_manager: "Floor Manager",
	media: "Media",
	general: "General",
}

/**
 * Parse volunteer metadata
 */
function parseMetadata(metadata: string | null): {
	roleTypes: VolunteerRoleType[]
	status?: "pending" | "approved" | "rejected"
	signupName?: string
	signupEmail?: string
	signupPhone?: string
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
		}
		return {
			roleTypes: parsed.volunteerRoleTypes ?? [],
			status: parsed.status,
			signupName: parsed.signupName,
			signupEmail: parsed.signupEmail,
			signupPhone: parsed.signupPhone,
		}
	} catch {
		return {
			roleTypes: [],
		}
	}
}

/**
 * Get user initials for avatar
 */
function getInitials(
	firstName: string | null,
	lastName: string | null,
): string {
	const first = firstName?.[0] || ""
	const last = lastName?.[0] || ""
	return (first + last).toUpperCase() || "?"
}

/**
 * Individual volunteer row component with selection support
 */
export function VolunteerRow({
	volunteer,
	competitionId,
	competitionTeamId,
	organizingTeamId,
	isSelected = false,
	onToggleSelect,
}: VolunteerRowProps) {
	const metadata = parseMetadata(volunteer.metadata)
	const [scoreAccess, setScoreAccess] = useState(volunteer.hasScoreAccess)
	const [selectedRoles, setSelectedRoles] = useState<Set<VolunteerRoleType>>(
		new Set(metadata.roleTypes),
	)
	const [status, setStatus] = useState(metadata.status || "approved")

	// Action hooks
	const { execute: addRoleType, isPending: isAddingRole } = useServerAction(
		addVolunteerRoleTypeAction,
		{
			onSuccess: () => {
				toast.success("Role type added")
			},
			onError: (error) => {
				toast.error(error.err?.message || "Failed to add role type")
			},
		},
	)

	const { execute: removeRoleType, isPending: isRemovingRole } =
		useServerAction(removeVolunteerRoleTypeAction, {
			onSuccess: () => {
				toast.success("Role type removed")
			},
			onError: (error) => {
				toast.error(error.err?.message || "Failed to remove role type")
			},
		})

	const { execute: grantAccess, isPending: isGranting } = useServerAction(
		grantScoreAccessAction,
		{
			onSuccess: () => {
				setScoreAccess(true)
				toast.success("Score access granted")
			},
			onError: (error) => {
				setScoreAccess(false)
				toast.error(error.err?.message || "Failed to grant score access")
			},
		},
	)

	const { execute: revokeAccess, isPending: isRevoking } = useServerAction(
		revokeScoreAccessAction,
		{
			onSuccess: () => {
				setScoreAccess(false)
				toast.success("Score access revoked")
			},
			onError: (error) => {
				setScoreAccess(true)
				toast.error(error.err?.message || "Failed to revoke score access")
			},
		},
	)

	const { execute: updateMetadata, isPending: isUpdatingMetadata } =
		useServerAction(updateVolunteerMetadataAction, {
			onSuccess: () => {
				// Toast handled in the specific action handlers
			},
			onError: (error) => {
				toast.error(error.err?.message || "Failed to update volunteer")
			},
		})

	const handleScoreAccessToggle = (checked: boolean) => {
		if (!volunteer.user) return

		// Optimistic update
		setScoreAccess(checked)

		if (checked) {
			grantAccess({
				volunteerId: volunteer.user.id,
				competitionTeamId,
				organizingTeamId,
				competitionId,
				grantedBy: volunteer.user.id, // TODO: Get current user ID
			})
		} else {
			revokeAccess({
				userId: volunteer.user.id,
				competitionTeamId,
				organizingTeamId,
				competitionId,
			})
		}
	}

	const handleRoleTypeToggle = (
		roleType: VolunteerRoleType,
		checked: boolean,
	) => {
		// Optimistic update
		const newRoles = new Set(selectedRoles)
		if (checked) {
			newRoles.add(roleType)
		} else {
			newRoles.delete(roleType)
		}
		setSelectedRoles(newRoles)

		if (checked) {
			addRoleType({
				membershipId: volunteer.id,
				organizingTeamId,
				competitionId,
				roleType,
			})
		} else {
			removeRoleType({
				membershipId: volunteer.id,
				organizingTeamId,
				competitionId,
				roleType,
			})
		}
	}

	const handleApprove = () => {
		setStatus("approved")
		updateMetadata({
			membershipId: volunteer.id,
			organizingTeamId,
			competitionId,
			metadata: { status: "approved" },
		})
		toast.success("Volunteer approved")
	}

	const handleReject = () => {
		setStatus("rejected")
		updateMetadata({
			membershipId: volunteer.id,
			organizingTeamId,
			competitionId,
			metadata: { status: "rejected" },
		})
		toast.success("Volunteer rejected")
	}

	const isPending =
		isAddingRole ||
		isRemovingRole ||
		isGranting ||
		isRevoking ||
		isUpdatingMetadata

	const isPendingVolunteer = status === "pending"
	const displayName = volunteer.user
		? `${volunteer.user.firstName ?? ""} ${volunteer.user.lastName ?? ""}`
		: metadata.signupName || "Unknown"
	const displayEmail = volunteer.user
		? volunteer.user.email
		: metadata.signupEmail || "—"

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
						{isPendingVolunteer && (
							<Badge variant="outline" className="w-fit text-xs">
								Pending
							</Badge>
						)}
					</div>
				</div>
			</TableCell>
			<TableCell className="text-muted-foreground text-sm">
				{displayEmail}
			</TableCell>
			<TableCell>
				<div className="flex flex-wrap gap-1">
					{Array.from(selectedRoles).map((roleType) => (
						<Badge key={roleType} variant="outline">
							{ROLE_TYPE_LABELS[roleType]}
						</Badge>
					))}
					{selectedRoles.size === 0 && (
						<span className="text-muted-foreground text-sm">—</span>
					)}
				</div>
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
							{(Object.keys(ROLE_TYPE_LABELS) as VolunteerRoleType[]).map(
								(roleType) => (
									<DropdownMenuCheckboxItem
										key={roleType}
										checked={selectedRoles.has(roleType)}
										onCheckedChange={(checked) =>
											handleRoleTypeToggle(roleType, checked)
										}
										disabled={isPending}
									>
										{ROLE_TYPE_LABELS[roleType]}
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
