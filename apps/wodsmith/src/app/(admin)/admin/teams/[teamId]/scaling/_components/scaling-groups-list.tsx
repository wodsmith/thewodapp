"use client"

import { useState } from "react"
import { Plus, Settings, Trash2, Star, GripVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
import { useServerAction } from "zsa-react"
import {
	deleteScalingGroupAction,
	setDefaultScalingGroupAction,
} from "@/actions/scaling-actions"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ScalingGroupDialog } from "./scaling-group-dialog"

interface ScalingGroup {
	id: string
	title: string
	description: string | null
	teamId: string | null
	isDefault: number
	isSystem: number
	levels?: Array<{
		id: string
		label: string
		position: number
	}>
	_count?: {
		workouts: number
		tracks: number
	}
}

interface ScalingGroupsListProps {
	teamId: string
	teamSlug: string
	scalingGroups: ScalingGroup[]
	defaultScalingGroupId: string | null | undefined
	canCreate: boolean
	canEdit: boolean
	canDelete: boolean
	canEditTeamSettings: boolean
}

export function ScalingGroupsList({
	teamId,
	scalingGroups,
	defaultScalingGroupId,
	canCreate,
	canEdit,
	canDelete,
	canEditTeamSettings,
}: ScalingGroupsListProps) {
	const router = useRouter()
	const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null)
	const [editingGroup, setEditingGroup] = useState<ScalingGroup | null>(null)
	const [creatingGroup, setCreatingGroup] = useState(false)

	const { execute: deleteGroup, isPending: isDeleting } = useServerAction(
		deleteScalingGroupAction,
	)

	const { execute: setDefaultGroup, isPending: isSettingDefault } =
		useServerAction(setDefaultScalingGroupAction)

	const handleDelete = async () => {
		if (!deleteGroupId) return

		const [_result, error] = await deleteGroup({
			groupId: deleteGroupId,
			teamId,
		})

		if (error) {
			toast.error(error.message || "Failed to delete scaling group")
		} else {
			toast.success("Scaling group deleted successfully")
			router.refresh()
		}

		setDeleteGroupId(null)
	}

	const handleSetDefault = async (groupId: string) => {
		const [_result, error] = await setDefaultGroup({
			teamId,
			groupId,
		})

		if (error) {
			toast.error(error.message || "Failed to set default scaling group")
		} else {
			toast.success("Default scaling group updated")
			router.refresh()
		}
	}

	const groupToDelete = scalingGroups.find((g) => g.id === deleteGroupId)
	const usageCount =
		(groupToDelete?._count?.workouts || 0) +
		(groupToDelete?._count?.tracks || 0)

	return (
		<>
			<div className="space-y-4">
				{canCreate && (
					<div className="flex justify-end">
						<Button onClick={() => setCreatingGroup(true)}>
							<Plus className="h-4 w-4 mr-2" />
							Create Scaling Group
						</Button>
					</div>
				)}

				{scalingGroups.length === 0 ? (
					<Card className="border-2 border-dashed">
						<CardContent className="flex flex-col items-center justify-center py-12">
							<p className="text-muted-foreground mb-4">
								No scaling groups created yet
							</p>
							{canCreate && (
								<Button onClick={() => setCreatingGroup(true)}>
									<Plus className="h-4 w-4 mr-2" />
									Create Your First Group
								</Button>
							)}
						</CardContent>
					</Card>
				) : (
					<div className="grid gap-4">
						{scalingGroups.map((group) => {
							const isTeamDefault = defaultScalingGroupId === group.id
							const isGlobalDefault = group.isSystem === 1

							return (
								<Card
									key={group.id}
									className={`border-2 ${
										isTeamDefault
											? "border-primary shadow-[4px_4px_0px_0px] shadow-primary"
											: "border-border"
									}`}
								>
									<CardHeader>
										<div className="flex items-start justify-between">
											<div className="space-y-1">
												<div className="flex items-center gap-2">
													<CardTitle className="text-xl font-mono">
														{group.title}
													</CardTitle>
													{isTeamDefault && (
														<Badge variant="default">Team Default</Badge>
													)}
													{isGlobalDefault && (
														<Badge variant="secondary">Global Default</Badge>
													)}
												</div>
												{group.description && (
													<CardDescription>{group.description}</CardDescription>
												)}
											</div>
											<div className="flex items-center gap-2">
												{canEditTeamSettings &&
													!isGlobalDefault &&
													!isTeamDefault && (
														<Button
															size="sm"
															variant="outline"
															onClick={() => handleSetDefault(group.id)}
															disabled={isSettingDefault}
														>
															<Star className="h-4 w-4" />
														</Button>
													)}
												{canEdit && !isGlobalDefault && (
													<Button
														size="sm"
														variant="outline"
														onClick={() => setEditingGroup(group)}
													>
														<Settings className="h-4 w-4" />
													</Button>
												)}
												{canDelete && !isGlobalDefault && (
													<Button
														size="sm"
														variant="outline"
														onClick={() => setDeleteGroupId(group.id)}
													>
														<Trash2 className="h-4 w-4" />
													</Button>
												)}
											</div>
										</div>
									</CardHeader>
									<CardContent>
										<div className="space-y-3">
											<div className="text-sm text-muted-foreground">
												<span className="font-medium">Scaling Levels:</span>{" "}
												{group.levels?.length || 0} levels
											</div>
											{group.levels && group.levels.length > 0 && (
												<div className="flex flex-wrap gap-2">
													{group.levels
														.sort((a, b) => a.position - b.position)
														.map((level, index) => (
															<div
																key={level.id}
																className="flex items-center gap-1"
															>
																<GripVertical className="h-3 w-3 text-muted-foreground" />
																<Badge
																	variant={
																		index === 0 ? "default" : "secondary"
																	}
																>
																	{level.label}
																</Badge>
															</div>
														))}
												</div>
											)}
											{(group._count?.workouts || 0) > 0 ||
											(group._count?.tracks || 0) > 0 ? (
												<div className="text-sm text-muted-foreground">
													<span className="font-medium">Used in:</span>{" "}
													{group._count?.workouts || 0} workouts,{" "}
													{group._count?.tracks || 0} tracks
												</div>
											) : null}
										</div>
									</CardContent>
								</Card>
							)
						})}
					</div>
				)}
			</div>

			{/* Delete confirmation dialog */}
			<AlertDialog
				open={!!deleteGroupId}
				onOpenChange={(open: boolean) => !open && setDeleteGroupId(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Scaling Group</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to delete "{groupToDelete?.title}"?
							{usageCount > 0 && (
								<span className="block mt-2 text-yellow-600">
									Warning: This scaling group is currently used by {usageCount}{" "}
									{usageCount === 1 ? "item" : "items"}.
								</span>
							)}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
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

			{/* Create/Edit dialog */}
			{(creatingGroup || editingGroup) && (
				<ScalingGroupDialog
					teamId={teamId}
					group={editingGroup}
					open={creatingGroup || !!editingGroup}
					onClose={() => {
						setCreatingGroup(false)
						setEditingGroup(null)
					}}
					onSuccess={() => {
						setCreatingGroup(false)
						setEditingGroup(null)
						router.refresh()
					}}
				/>
			)}
		</>
	)
}
