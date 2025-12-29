"use client"

import { useRouter } from "@tanstack/react-router"
import { Plus } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Sponsor, SponsorGroup } from "@/db/schemas/sponsors"
import {
	createSponsorFn,
	createSponsorGroupFn,
	deleteSponsorFn,
	deleteSponsorGroupFn,
	reorderSponsorGroupsFn,
	reorderSponsorsFn,
	updateSponsorFn,
	updateSponsorGroupFn,
} from "@/server-fns/sponsor-fns"
import { SponsorFormDialog } from "./sponsor-form-dialog"
import { SponsorGroupCard } from "./sponsor-group-card"
import { SponsorGroupFormDialog } from "./sponsor-group-form-dialog"
import { UngroupedSponsors } from "./ungrouped-sponsors"

interface SponsorGroupWithSponsors extends SponsorGroup {
	sponsors: Sponsor[]
}

interface SponsorManagerProps {
	competitionId: string
	organizingTeamId: string
	groups: SponsorGroupWithSponsors[]
	ungroupedSponsors: Sponsor[]
}

export function SponsorManager({
	competitionId,
	organizingTeamId: _organizingTeamId,
	groups: initialGroups,
	ungroupedSponsors: initialUngrouped,
}: SponsorManagerProps) {
	const router = useRouter()
	const [groups, setGroups] = useState(initialGroups)
	const [ungroupedSponsors, setUngroupedSponsors] = useState(initialUngrouped)

	// Instance IDs for drag-and-drop scoping
	const [groupInstanceId] = useState(() => Symbol("sponsor-groups"))
	const [sponsorInstanceId] = useState(() => Symbol("sponsors"))

	// Dialog states
	const [showAddGroupDialog, setShowAddGroupDialog] = useState(false)
	const [showAddSponsorDialog, setShowAddSponsorDialog] = useState(false)
	const [editingGroup, setEditingGroup] = useState<SponsorGroup | null>(null)
	const [editingSponsor, setEditingSponsor] = useState<Sponsor | null>(null)
	const [addToGroupId, setAddToGroupId] = useState<string | null>(null)

	// Loading states
	const [isCreatingGroup, setIsCreatingGroup] = useState(false)
	const [isCreatingSponsor, setIsCreatingSponsor] = useState(false)

	// Sync props to state when server data changes
	useEffect(() => {
		setGroups(initialGroups)
		setUngroupedSponsors(initialUngrouped)
	}, [initialGroups, initialUngrouped])

	// Group handlers
	const handleCreateGroup = async (name: string) => {
		setIsCreatingGroup(true)
		try {
			await createSponsorGroupFn({
				data: {
					competitionId,
					name,
				},
			})

			await router.invalidate()
			toast.success("Sponsor group created")
			setShowAddGroupDialog(false)
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Failed to create sponsor group"
			toast.error(message)
		} finally {
			setIsCreatingGroup(false)
		}
	}

	const handleUpdateGroup = async (groupId: string, name: string) => {
		try {
			const result = await updateSponsorGroupFn({
				data: {
					groupId,
					competitionId,
					name,
				},
			})

			if (!result.group) {
				toast.error("Failed to update sponsor group")
				return
			}

			setGroups((prev) =>
				prev.map((g) => (g.id === groupId ? { ...g, name } : g)),
			)
			toast.success("Sponsor group updated")
			setEditingGroup(null)
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Failed to update sponsor group"
			toast.error(message)
		}
	}

	const handleDeleteGroup = async (groupId: string) => {
		const group = groups.find((g) => g.id === groupId)
		if (!group) return

		// Move sponsors to ungrouped before deleting
		const sponsorsToMove = group.sponsors

		try {
			const result = await deleteSponsorGroupFn({
				data: {
					groupId,
					competitionId,
				},
			})

			if (!result.success) {
				toast.error(result.error || "Failed to delete sponsor group")
				return
			}

			setGroups((prev) => prev.filter((g) => g.id !== groupId))
			setUngroupedSponsors((prev) => [
				...prev,
				...sponsorsToMove.map((s) => ({ ...s, groupId: null })),
			])
			toast.success("Sponsor group deleted")
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Failed to delete sponsor group"
			toast.error(message)
		}
	}

	// Sponsor handlers
	const handleCreateSponsor = async (data: {
		name: string
		logoUrl?: string
		website?: string
		groupId?: string | null
	}) => {
		setIsCreatingSponsor(true)
		try {
			await createSponsorFn({
				data: {
					competitionId,
					groupId: data.groupId ?? undefined,
					name: data.name,
					logoUrl: data.logoUrl,
					website: data.website,
				},
			})

			await router.invalidate()
			toast.success("Sponsor created")
			setShowAddSponsorDialog(false)
			setAddToGroupId(null)
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to create sponsor"
			toast.error(message)
		} finally {
			setIsCreatingSponsor(false)
		}
	}

	const handleUpdateSponsor = async (
		sponsorId: string,
		data: {
			name?: string
			logoUrl?: string | null
			website?: string | null
			groupId?: string | null
		},
	) => {
		try {
			const result = await updateSponsorFn({
				data: {
					sponsorId,
					...data,
				},
			})

			if (!result.sponsor) {
				toast.error("Failed to update sponsor")
				return
			}

			// Update local state
			const updateInList = (sponsor: Sponsor) =>
				sponsor.id === sponsorId
					? {
							...sponsor,
							name: data.name ?? sponsor.name,
							logoUrl:
								data.logoUrl === undefined ? sponsor.logoUrl : data.logoUrl,
							website:
								data.website === undefined ? sponsor.website : data.website,
							groupId:
								data.groupId === undefined ? sponsor.groupId : data.groupId,
						}
					: sponsor

			setGroups((prev) =>
				prev.map((g) => ({
					...g,
					sponsors: g.sponsors.map(updateInList),
				})),
			)
			setUngroupedSponsors((prev) => prev.map(updateInList))

			toast.success("Sponsor updated")
			setEditingSponsor(null)
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to update sponsor"
			toast.error(message)
		}
	}

	const handleDeleteSponsor = async (sponsorId: string) => {
		try {
			const result = await deleteSponsorFn({
				data: {
					sponsorId,
				},
			})

			if (!result.success) {
				toast.error(result.error || "Failed to delete sponsor")
				return
			}

			setGroups((prev) =>
				prev.map((g) => ({
					...g,
					sponsors: g.sponsors.filter((s) => s.id !== sponsorId),
				})),
			)
			setUngroupedSponsors((prev) => prev.filter((s) => s.id !== sponsorId))
			toast.success("Sponsor deleted")
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to delete sponsor"
			toast.error(message)
		}
	}

	// Group reorder handler
	const handleReorderGroups = async (
		sourceIndex: number,
		targetIndex: number,
	) => {
		// Capture previous state before optimistic update
		const previousGroups = [...groups]

		// Optimistic update
		const newGroups = [...groups]
		const [movedGroup] = newGroups.splice(sourceIndex, 1)
		if (movedGroup) {
			newGroups.splice(targetIndex, 0, movedGroup)
			setGroups(newGroups)

			// Build ordered IDs for server
			const orderedIds = newGroups.map((g) => g.id)

			try {
				await reorderSponsorGroupsFn({
					data: {
						competitionId,
						groupIds: orderedIds,
					},
				})
			} catch (error) {
				// Revert on error
				setGroups(previousGroups)
				const message =
					error instanceof Error ? error.message : "Failed to reorder groups"
				toast.error(message)
			}
		}
	}

	// Sponsor reorder handler (within a group)
	const handleReorderSponsors = async (
		groupId: string,
		sourceIndex: number,
		targetIndex: number,
	) => {
		// Find the group
		const groupIndex = groups.findIndex((g) => g.id === groupId)
		if (groupIndex === -1) return

		const group = groups[groupIndex]
		if (!group) return

		// Optimistic update
		const newSponsors = [...group.sponsors]
		const [movedSponsor] = newSponsors.splice(sourceIndex, 1)
		if (movedSponsor) {
			newSponsors.splice(targetIndex, 0, movedSponsor)

			const newGroups = [...groups]
			const updatedGroup = newGroups[groupIndex]
			if (updatedGroup) {
				updatedGroup.sponsors = newSponsors
				setGroups(newGroups)
			}

			// Build sponsorOrders array for server
			const sponsorOrders = newSponsors.map((s, index) => ({
				sponsorId: s.id,
				groupId: s.groupId,
				displayOrder: index,
			}))

			try {
				await reorderSponsorsFn({
					data: {
						competitionId,
						sponsorOrders,
					},
				})
			} catch (error) {
				// Revert on error
				setGroups(groups)
				const message =
					error instanceof Error ? error.message : "Failed to reorder sponsors"
				toast.error(message)
			}
		}
	}

	const totalSponsors =
		groups.reduce((acc, g) => acc + g.sponsors.length, 0) +
		ungroupedSponsors.length

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-2xl font-bold tracking-tight">Sponsors</h2>
					<p className="text-muted-foreground">
						Manage competition sponsors and sponsor groups
					</p>
				</div>
				<div className="flex gap-2">
					<Button variant="outline" onClick={() => setShowAddGroupDialog(true)}>
						<Plus className="mr-2 h-4 w-4" />
						Add Group
					</Button>
					<Button onClick={() => setShowAddSponsorDialog(true)}>
						<Plus className="mr-2 h-4 w-4" />
						Add Sponsor
					</Button>
				</div>
			</div>

			{/* Stats */}
			<div className="grid gap-4 md:grid-cols-3">
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium">
							Total Sponsors
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{totalSponsors}</div>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium">
							Sponsor Groups
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{groups.length}</div>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium">Ungrouped</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{ungroupedSponsors.length}</div>
					</CardContent>
				</Card>
			</div>

			{/* Sponsor Groups */}
			{groups.length === 0 && ungroupedSponsors.length === 0 ? (
				<Card>
					<CardContent className="flex flex-col items-center justify-center py-12">
						<p className="text-muted-foreground mb-4">No sponsors yet</p>
						<p className="text-muted-foreground text-sm mb-6">
							Add sponsors to showcase your competition partners. Create groups
							like &quot;Gold&quot;, &quot;Silver&quot;, &quot;Bronze&quot; to
							organize them.
						</p>
						<div className="flex gap-2">
							<Button
								variant="outline"
								onClick={() => setShowAddGroupDialog(true)}
							>
								<Plus className="mr-2 h-4 w-4" />
								Create Group
							</Button>
							<Button onClick={() => setShowAddSponsorDialog(true)}>
								<Plus className="mr-2 h-4 w-4" />
								Add Sponsor
							</Button>
						</div>
					</CardContent>
				</Card>
			) : (
				<div className="space-y-4">
					{/* Grouped sponsors */}
					{groups.map((group, index) => (
						<SponsorGroupCard
							key={group.id}
							group={group}
							sponsors={group.sponsors}
							index={index}
							instanceId={groupInstanceId}
							sponsorInstanceId={sponsorInstanceId}
							onEditGroup={() => setEditingGroup(group)}
							onDeleteGroup={() => handleDeleteGroup(group.id)}
							onAddSponsor={() => {
								setAddToGroupId(group.id)
								setShowAddSponsorDialog(true)
							}}
							onEditSponsor={setEditingSponsor}
							onDeleteSponsor={handleDeleteSponsor}
							onDropGroup={handleReorderGroups}
							onDropSponsor={handleReorderSponsors}
						/>
					))}

					{/* Ungrouped sponsors */}
					{ungroupedSponsors.length > 0 && (
						<UngroupedSponsors
							sponsors={ungroupedSponsors}
							onEditSponsor={setEditingSponsor}
							onDeleteSponsor={handleDeleteSponsor}
						/>
					)}
				</div>
			)}

			{/* Dialogs */}
			<SponsorGroupFormDialog
				open={showAddGroupDialog}
				onOpenChange={setShowAddGroupDialog}
				onSubmit={handleCreateGroup}
				isPending={isCreatingGroup}
			/>

			<SponsorGroupFormDialog
				open={!!editingGroup}
				onOpenChange={(open) => !open && setEditingGroup(null)}
				group={editingGroup ?? undefined}
				onSubmit={(name) => {
					if (editingGroup) {
						return handleUpdateGroup(editingGroup.id, name)
					}
				}}
			/>

			<SponsorFormDialog
				open={showAddSponsorDialog}
				onOpenChange={(open) => {
					setShowAddSponsorDialog(open)
					if (!open) setAddToGroupId(null)
				}}
				groups={groups}
				defaultGroupId={addToGroupId}
				competitionId={competitionId}
				onSubmit={handleCreateSponsor}
				isPending={isCreatingSponsor}
			/>

			<SponsorFormDialog
				open={!!editingSponsor}
				onOpenChange={(open) => !open && setEditingSponsor(null)}
				sponsor={editingSponsor ?? undefined}
				groups={groups}
				competitionId={competitionId}
				onSubmit={(data) => {
					if (editingSponsor) {
						return handleUpdateSponsor(editingSponsor.id, data)
					}
				}}
			/>
		</div>
	)
}
