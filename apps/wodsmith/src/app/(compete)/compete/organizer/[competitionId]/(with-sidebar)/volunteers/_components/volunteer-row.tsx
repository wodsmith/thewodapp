"use client"

import { useServerAction } from "@repo/zsa-react"
import { useState } from "react"
import { toast } from "sonner"

import {
	addVolunteerRoleTypeAction,
	grantScoreAccessAction,
	removeVolunteerRoleTypeAction,
	revokeScoreAccessAction,
} from "@/actions/volunteer-actions"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
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
	metadata: string | null
	user: User | null
	hasScoreAccess: boolean
}

interface VolunteerRowProps {
	volunteer: VolunteerWithAccess
	competitionId: string
	competitionTeamId: string
	organizingTeamId: string
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
 * Parse volunteer role types from metadata
 */
function parseRoleTypes(metadata: string | null): VolunteerRoleType[] {
	if (!metadata) return []
	try {
		const parsed = JSON.parse(metadata) as {
			volunteerRoleTypes?: VolunteerRoleType[]
		}
		return parsed.volunteerRoleTypes ?? []
	} catch {
		return []
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
 * Individual volunteer row component
 */
export function VolunteerRow({
	volunteer,
	competitionId,
	competitionTeamId,
	organizingTeamId,
}: VolunteerRowProps) {
	const roleTypes = parseRoleTypes(volunteer.metadata)
	const [scoreAccess, setScoreAccess] = useState(volunteer.hasScoreAccess)
	const [selectedRoles, setSelectedRoles] = useState<Set<VolunteerRoleType>>(
		new Set(roleTypes),
	)

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

	const isPending = isAddingRole || isRemovingRole || isGranting || isRevoking

	return (
		<TableRow>
			<TableCell>
				<div className="flex items-center gap-3">
					<Avatar className="h-8 w-8">
						<AvatarImage
							src={volunteer.user?.avatar ?? undefined}
							alt={`${volunteer.user?.firstName ?? ""} ${volunteer.user?.lastName ?? ""}`}
						/>
						<AvatarFallback className="text-xs">
							{getInitials(
								volunteer.user?.firstName ?? null,
								volunteer.user?.lastName ?? null,
							)}
						</AvatarFallback>
					</Avatar>
					<span className="font-medium">
						{volunteer.user?.firstName ?? ""} {volunteer.user?.lastName ?? ""}
					</span>
				</div>
			</TableCell>
			<TableCell className="text-muted-foreground text-sm">
				{volunteer.user?.email}
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
			</TableCell>
		</TableRow>
	)
}
