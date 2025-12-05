"use client"

import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { useServerAction } from "@repo/zsa-react"
import {
	createSponsorAction,
	createSponsorGroupAction,
	deleteSponsorAction,
	deleteSponsorGroupAction,
	reorderSponsorGroupsAction,
	reorderSponsorsAction,
	updateSponsorAction,
	updateSponsorGroupAction,
} from "@/actions/sponsors.actions"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import type { Sponsor, SponsorGroup } from "@/db/schema"
import { SponsorGroupCard } from "./sponsor-group-card"
import { SponsorFormDialog } from "./sponsor-form-dialog"
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
	organizingTeamId,
	groups: initialGroups,
	ungroupedSponsors: initialUngrouped,
}: SponsorManagerProps) {
	const router = useRouter()
	const [groups, setGroups] = useState(initialGroups)
	const [ungroupedSponsors, setUngroupedSponsors] = useState(initialUngrouped)

	// Dialog states
	const [showAddGroupDialog, setShowAddGroupDialog] = useState(false)
	const [showAddSponsorDialog, setShowAddSponsorDialog] = useState(false)
	const [editingGroup, setEditingGroup] = useState<SponsorGroup | null>(null)
	const [editingSponsor, setEditingSponsor] = useState<Sponsor | null>(null)
	const [addToGroupId, setAddToGroupId] = useState<string | null>(null)

	// Sync props to state when server data changes
	useEffect(() => {
		setGroups(initialGroups)
		setUngroupedSponsors(initialUngrouped)
	}, [initialGroups, initialUngrouped])

	// Server actions
	const { execute: createGroup, isPending: isCreatingGroup } = useServerAction(
		createSponsorGroupAction,
	)
	const { execute: updateGroup } = useServerAction(updateSponsorGroupAction)
	const { execute: deleteGroup } = useServerAction(deleteSponsorGroupAction)
	const { execute: reorderGroups } = useServerAction(reorderSponsorGroupsAction)

	const { execute: createSponsor, isPending: isCreatingSponsor } =
		useServerAction(createSponsorAction)
	const { execute: updateSponsor } = useServerAction(updateSponsorAction)
	const { execute: deleteSponsor } = useServerAction(deleteSponsorAction)
	const { execute: reorderSponsors } = useServerAction(reorderSponsorsAction)

	// Group handlers
	const handleCreateGroup = async (name: string) => {
		const [, error] = await createGroup({
			competitionId,
			name,
		})

		if (error) {
			toast.error(error.message || "Failed to create sponsor group")
			return
		}

		// Server action calls revalidatePath which updates the data via useEffect
		toast.success("Sponsor group created")
		setShowAddGroupDialog(false)
	}

	const handleUpdateGroup = async (groupId: string, name: string) => {
		const [, error] = await updateGroup({
			groupId,
			competitionId,
			name,
		})

		if (error) {
			toast.error(error.message || "Failed to update sponsor group")
			return
		}

		setGroups((prev) =>
			prev.map((g) => (g.id === groupId ? { ...g, name } : g)),
		)
		toast.success("Sponsor group updated")
		setEditingGroup(null)
	}

	const handleDeleteGroup = async (groupId: string) => {
		const group = groups.find((g) => g.id === groupId)
		if (!group) return

		// Move sponsors to ungrouped before deleting
		const sponsorsToMove = group.sponsors

		const [, error] = await deleteGroup({
			groupId,
			competitionId,
		})

		if (error) {
			toast.error(error.message || "Failed to delete sponsor group")
			return
		}

		setGroups((prev) => prev.filter((g) => g.id !== groupId))
		setUngroupedSponsors((prev) => [
			...prev,
			...sponsorsToMove.map((s) => ({ ...s, groupId: null })),
		])
		toast.success("Sponsor group deleted")
	}

	// Sponsor handlers
	const handleCreateSponsor = async (data: {
		name: string
		logoUrl?: string
		website?: string
		groupId?: string | null
	}) => {
		const [, error] = await createSponsor({
			competitionId,
			groupId: data.groupId ?? undefined,
			name: data.name,
			logoUrl: data.logoUrl,
			website: data.website,
		})

		if (error) {
			toast.error(error.message || "Failed to create sponsor")
			return
		}

		// Server action calls revalidatePath which updates the data via useEffect
		toast.success("Sponsor created")
		setShowAddSponsorDialog(false)
		setAddToGroupId(null)
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
		const [, error] = await updateSponsor({
			sponsorId,
			...data,
		})

		if (error) {
			toast.error(error.message || "Failed to update sponsor")
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
	}

	const handleDeleteSponsor = async (sponsorId: string) => {
		const [, error] = await deleteSponsor({
			sponsorId,
		})

		if (error) {
			toast.error(error.message || "Failed to delete sponsor")
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
							like "Gold", "Silver", "Bronze" to organize them.
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
					{groups.map((group) => (
						<SponsorGroupCard
							key={group.id}
							group={group}
							sponsors={group.sponsors}
							onEditGroup={() => setEditingGroup(group)}
							onDeleteGroup={() => handleDeleteGroup(group.id)}
							onAddSponsor={() => {
								setAddToGroupId(group.id)
								setShowAddSponsorDialog(true)
							}}
							onEditSponsor={setEditingSponsor}
							onDeleteSponsor={handleDeleteSponsor}
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
