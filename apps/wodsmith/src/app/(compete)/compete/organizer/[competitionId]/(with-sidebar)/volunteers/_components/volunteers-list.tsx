"use client"

import { useServerAction } from "@repo/zsa-react"
import { Check, Copy, UserPlus, X } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { bulkAssignVolunteerRoleAction } from "@/actions/volunteer-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import {
	Table,
	TableBody,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { TeamInvitation, User } from "@/db/schema"
import { VOLUNTEER_AVAILABILITY } from "@/db/schemas/volunteers"

import { InviteVolunteerDialog } from "./invite-volunteer-dialog"
import { VolunteerRow } from "./volunteer-row"

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

interface VolunteersListProps {
	competitionId: string
	competitionSlug: string
	competitionTeamId: string
	organizingTeamId: string
	invitations: TeamInvitation[]
	volunteers: VolunteerWithAccess[]
}

/**
 * Client component for displaying and managing competition volunteers
 * Supports multi-select with shift-click for bulk role assignment
 */
export function VolunteersList({
	competitionId,
	competitionSlug,
	competitionTeamId,
	organizingTeamId,
	invitations,
	volunteers,
}: VolunteersListProps) {
	const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
	const [filter, setFilter] = useState<"all" | "pending" | "approved">("all")
	const [availabilityFilter, setAvailabilityFilter] = useState<string | null>(
		null,
	)
	const [copied, setCopied] = useState(false)

	// Selection state
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
	const [lastSelectedId, setLastSelectedId] = useState<string | null>(null)

	// Bulk action
	const { execute: bulkAssignRole, isPending: isBulkAssigning } =
		useServerAction(bulkAssignVolunteerRoleAction, {
			onSuccess: ({ data }) => {
				if (data.failed > 0) {
					toast.warning(
						`Assigned role to ${data.succeeded} volunteers, ${data.failed} failed`,
					)
				} else {
					toast.success(`Assigned role to ${data.succeeded} volunteers`)
				}
				setSelectedIds(new Set())
			},
			onError: (error) => {
				toast.error(error.err?.message || "Failed to assign roles")
			},
		})

	const signupUrl =
		typeof window !== "undefined"
			? `${window.location.origin}/compete/${competitionSlug}/volunteer`
			: `/compete/${competitionSlug}/volunteer`

	const copySignupLink = async () => {
		try {
			await navigator.clipboard.writeText(signupUrl)
			setCopied(true)
			toast.success("Signup link copied to clipboard")
			setTimeout(() => setCopied(false), 2000)
		} catch {
			toast.error("Failed to copy link")
		}
	}

	// Parse status from metadata
	const getInvitationStatus = (
		invitation: TeamInvitation,
	): "pending" | "approved" | "rejected" => {
		if (!invitation.metadata) return "pending"
		try {
			const parsed = JSON.parse(invitation.metadata) as {
				status?: "pending" | "approved" | "rejected"
			}
			return parsed.status || "pending"
		} catch {
			return "pending"
		}
	}

	// Parse availability from metadata
	const getAvailability = (metadata: string | null): string | null => {
		if (!metadata) return null
		try {
			const parsed = JSON.parse(metadata) as { availability?: string }
			return parsed.availability || null
		} catch {
			return null
		}
	}

	// Convert invitations to a compatible format for display
	// Invitations show as pending items with signup info
	type VolunteerItem =
		| { type: "invitation"; data: TeamInvitation }
		| { type: "membership"; data: VolunteerWithAccess }

	const invitationItems: VolunteerItem[] = invitations.map((inv) => ({
		type: "invitation" as const,
		data: inv,
	}))

	const membershipItems: VolunteerItem[] = volunteers.map((vol) => ({
		type: "membership" as const,
		data: vol,
	}))

	// Combine all items
	const allItems = [...invitationItems, ...membershipItems]

	// Separate by status
	const pendingItems: VolunteerItem[] = invitationItems.filter((item) => {
		if (item.type === "invitation") {
			return getInvitationStatus(item.data) === "pending"
		}
		return false
	})
	const approvedItems: VolunteerItem[] = membershipItems // All memberships are approved

	// Filter items based on selected filter
	let filteredItems: VolunteerItem[] =
		filter === "all"
			? allItems
			: filter === "pending"
				? pendingItems
				: approvedItems

	// Apply availability filter
	if (availabilityFilter) {
		filteredItems = filteredItems.filter((item) => {
			const metadata = item.data.metadata
			const availability = getAvailability(metadata)
			return availability === availabilityFilter
		})
	}

	// Get flat list of IDs for range selection
	const filteredIds = filteredItems.map((item) => item.data.id)

	/**
	 * Toggle selection with shift-click range support
	 */
	function toggleSelection(id: string, shiftKey: boolean) {
		if (shiftKey && lastSelectedId && lastSelectedId !== id) {
			// Range selection
			const lastIndex = filteredIds.indexOf(lastSelectedId)
			const currentIndex = filteredIds.indexOf(id)

			if (lastIndex !== -1 && currentIndex !== -1) {
				const start = Math.min(lastIndex, currentIndex)
				const end = Math.max(lastIndex, currentIndex)
				const rangeIds = filteredIds.slice(start, end + 1)

				setSelectedIds((prev) => {
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
		setSelectedIds((prev) => {
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

	/**
	 * Toggle all visible volunteers
	 */
	function toggleAll(checked: boolean) {
		if (checked) {
			setSelectedIds(new Set(filteredIds))
		} else {
			setSelectedIds(new Set())
		}
	}

	/**
	 * Clear selection
	 */
	function clearSelection() {
		setSelectedIds(new Set())
		setLastSelectedId(null)
	}

	/**
	 * Handle bulk role assignment
	 */
	function handleBulkAssignRole(roleType: VolunteerRoleType) {
		if (selectedIds.size === 0) return

		bulkAssignRole({
			membershipIds: Array.from(selectedIds),
			organizingTeamId,
			competitionId,
			roleType,
		})
	}

	// Check if all filtered volunteers are selected
	const allSelected =
		filteredIds.length > 0 && filteredIds.every((id) => selectedIds.has(id))
	const someSelected = selectedIds.size > 0

	if (invitations.length === 0 && volunteers.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>No Volunteers</CardTitle>
					<CardDescription>
						No volunteers have been added to this competition yet.
					</CardDescription>
				</CardHeader>
				<CardContent className="flex gap-2">
					<Button onClick={() => setInviteDialogOpen(true)}>
						<UserPlus className="mr-2 h-4 w-4" />
						Invite Volunteer
					</Button>
					<Button variant="outline" onClick={copySignupLink}>
						{copied ? (
							<Check className="mr-2 h-4 w-4" />
						) : (
							<Copy className="mr-2 h-4 w-4" />
						)}
						Copy Signup Link
					</Button>
					<InviteVolunteerDialog
						competitionId={competitionId}
						competitionTeamId={competitionTeamId}
						organizingTeamId={organizingTeamId}
						open={inviteDialogOpen}
						onOpenChange={setInviteDialogOpen}
					/>
				</CardContent>
			</Card>
		)
	}

	return (
		<div className="flex flex-col gap-4">
			{/* Bulk Action Toolbar - only shows when items selected */}
			{someSelected && (
				<div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-2">
					<span className="text-sm font-medium">
						{selectedIds.size} selected
					</span>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button size="sm" disabled={isBulkAssigning}>
								{isBulkAssigning ? "Assigning..." : "Assign Role"}
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start">
							{(Object.keys(ROLE_TYPE_LABELS) as VolunteerRoleType[]).map(
								(roleType) => (
									<DropdownMenuItem
										key={roleType}
										onClick={() => handleBulkAssignRole(roleType)}
									>
										{ROLE_TYPE_LABELS[roleType]}
									</DropdownMenuItem>
								),
							)}
						</DropdownMenuContent>
					</DropdownMenu>
					<Button size="sm" variant="ghost" onClick={clearSelection}>
						<X className="mr-1 h-4 w-4" />
						Clear
					</Button>
				</div>
			)}

			{/* Actions */}
			<div className="flex items-center justify-end gap-2">
				<Select
					value={availabilityFilter ?? "all"}
					onValueChange={(value) =>
						setAvailabilityFilter(value === "all" ? null : value)
					}
				>
					<SelectTrigger className="w-[140px]">
						<SelectValue placeholder="Availability" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Times</SelectItem>
						<SelectItem value={VOLUNTEER_AVAILABILITY.MORNING}>
							Morning
						</SelectItem>
						<SelectItem value={VOLUNTEER_AVAILABILITY.AFTERNOON}>
							Afternoon
						</SelectItem>
						<SelectItem value={VOLUNTEER_AVAILABILITY.ALL_DAY}>
							All Day
						</SelectItem>
					</SelectContent>
				</Select>
				<Button variant="outline" onClick={copySignupLink}>
					{copied ? (
						<Check className="mr-2 h-4 w-4" />
					) : (
						<Copy className="mr-2 h-4 w-4" />
					)}
					Copy Signup Link
				</Button>
				<Button onClick={() => setInviteDialogOpen(true)}>
					<UserPlus className="mr-2 h-4 w-4" />
					Invite Volunteer
				</Button>
				<InviteVolunteerDialog
					competitionId={competitionId}
					competitionTeamId={competitionTeamId}
					organizingTeamId={organizingTeamId}
					open={inviteDialogOpen}
					onOpenChange={setInviteDialogOpen}
				/>
			</div>

			{/* Volunteers Table with Tabs */}
			<Tabs
				defaultValue="all"
				onValueChange={(v) => {
					setFilter(v as typeof filter)
					// Clear selection when changing tabs
					clearSelection()
				}}
			>
				<TabsList>
					<TabsTrigger value="all">
						All
						<Badge variant="secondary" className="ml-2">
							{allItems.length}
						</Badge>
					</TabsTrigger>
					<TabsTrigger value="pending">
						Pending
						{pendingItems.length > 0 && (
							<Badge variant="secondary" className="ml-2">
								{pendingItems.length}
							</Badge>
						)}
					</TabsTrigger>
					<TabsTrigger value="approved">
						Approved
						<Badge variant="secondary" className="ml-2">
							{approvedItems.length}
						</Badge>
					</TabsTrigger>
				</TabsList>

				<TabsContent value={filter} className="mt-4">
					<Card>
						<CardContent className="p-0">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead className="w-12">
											<Checkbox
												checked={allSelected}
												onCheckedChange={toggleAll}
												aria-label="Select all"
											/>
										</TableHead>
										<TableHead>Name</TableHead>
										<TableHead>Email</TableHead>
										<TableHead>Role Types</TableHead>
										<TableHead>Score Access</TableHead>
										<TableHead className="text-right">Actions</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{filteredItems.map((item) => {
										if (item.type === "invitation") {
											// Render invitation as a pending volunteer
											const invitation = item.data
											// Parse metadata for signup info
											let metadata: {
												signupName?: string
												signupEmail?: string
												credentials?: string
												status?: "pending" | "approved" | "rejected"
											} = {}
											try {
												metadata = invitation.metadata
													? JSON.parse(invitation.metadata)
													: {}
											} catch {
												// ignore
											}

											// Convert invitation to VolunteerWithAccess format for VolunteerRow
											const volunteerItem: VolunteerWithAccess = {
												id: invitation.id,
												userId: "", // No user yet
												teamId: invitation.teamId,
												roleId: invitation.roleId,
												isSystemRole: invitation.isSystemRole,
												isActive: 0, // Pending
												metadata: invitation.metadata,
												joinedAt: null,
												createdAt: invitation.createdAt,
												expiresAt: invitation.expiresAt,
												invitedAt: null,
												invitedBy: invitation.invitedBy,
												user: null,
												hasScoreAccess: false,
												status: metadata.status || "pending",
											}

											return (
												<VolunteerRow
													key={invitation.id}
													volunteer={volunteerItem}
													competitionId={competitionId}
													competitionTeamId={competitionTeamId}
													organizingTeamId={organizingTeamId}
													isSelected={selectedIds.has(invitation.id)}
													onToggleSelect={(shiftKey) =>
														toggleSelection(invitation.id, shiftKey)
													}
												/>
											)
										}

										// Render membership
										const volunteer = item.data
										return (
											<VolunteerRow
												key={volunteer.id}
												volunteer={volunteer}
												competitionId={competitionId}
												competitionTeamId={competitionTeamId}
												organizingTeamId={organizingTeamId}
												isSelected={selectedIds.has(volunteer.id)}
												onToggleSelect={(shiftKey) =>
													toggleSelection(volunteer.id, shiftKey)
												}
											/>
										)
									})}
								</TableBody>
							</Table>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	)
}
