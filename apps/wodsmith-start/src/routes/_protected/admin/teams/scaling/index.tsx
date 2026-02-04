/**
 * Admin Teams Scaling Groups Page
 * Port of apps/wodsmith/src/app/(admin)/admin/teams/scaling/page.tsx
 */

import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import { GripVertical, Plus, Settings, Star, Trash2 } from "lucide-react"
import { useState } from "react"
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
	getScalingGroupsFn,
	deleteScalingGroupFn,
	setDefaultScalingGroupFn,
	type ScalingGroupWithLevels,
} from "@/server-fns/scaling-fns"
import { ScalingGroupDialog } from "@/components/scaling-group-dialog"

export const Route = createFileRoute("/_protected/admin/teams/scaling/")({
	component: AdminScalingPage,
	loader: async ({ context }) => {
		const session = context.session
		const teamId = session?.teams?.[0]?.id

		if (!teamId) {
			return {
				scalingGroups: [] as ScalingGroupWithLevels[],
				teamId: null,
				teamName: null,
				defaultScalingGroupId: null,
			}
		}

		// Fetch scaling groups for the team
		const { scalingGroups } = await getScalingGroupsFn({
			data: { teamId, includeSystem: true },
		})

		const team = session?.teams?.find((t) => t.id === teamId)

		// Find default scaling group (isDefault === true and belongs to this team)
		const defaultGroup = scalingGroups.find(
			(g) => g.isDefault && g.teamId === teamId,
		)

		return {
			scalingGroups,
			teamId,
			teamName: team?.name ?? "Team",
			defaultScalingGroupId: defaultGroup?.id ?? null,
		}
	},
})

function AdminScalingPage() {
	const { scalingGroups, teamId, teamName, defaultScalingGroupId } =
		Route.useLoaderData()
	const router = useRouter()

	const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null)
	const [editingGroup, setEditingGroup] =
		useState<ScalingGroupWithLevels | null>(null)
	const [creatingGroup, setCreatingGroup] = useState(false)
	const [isDeleting, setIsDeleting] = useState(false)
	const [isSettingDefault, setIsSettingDefault] = useState(false)

	const handleDelete = async () => {
		if (!deleteGroupId || !teamId) return

		setIsDeleting(true)
		try {
			await deleteScalingGroupFn({
				data: { groupId: deleteGroupId, teamId },
			})
			toast.success("Scaling group deleted successfully")
			router.invalidate()
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to delete scaling group",
			)
		} finally {
			setIsDeleting(false)
			setDeleteGroupId(null)
		}
	}

	const handleSetDefault = async (groupId: string) => {
		if (!teamId) return

		setIsSettingDefault(true)
		try {
			await setDefaultScalingGroupFn({
				data: { teamId, groupId },
			})
			toast.success("Default scaling group updated")
			router.invalidate()
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to set default scaling group",
			)
		} finally {
			setIsSettingDefault(false)
		}
	}

	const handleSuccess = () => {
		setCreatingGroup(false)
		setEditingGroup(null)
		router.invalidate()
	}

	if (!teamId) {
		return (
			<div className="container mx-auto px-4 py-8">
				<div className="text-center py-12">
					<p className="text-muted-foreground text-lg">
						No team found. Please join or create a team.
					</p>
				</div>
			</div>
		)
	}

	const groupToDelete = scalingGroups.find((g) => g.id === deleteGroupId)

	return (
		<>
			{/* Breadcrumb */}
			<div className="px-4 sm:px-5 py-4 border-b">
				<nav className="flex items-center gap-2 text-sm font-mono">
					<Link
						to="/admin"
						className="text-muted-foreground hover:text-foreground"
					>
						Admin
					</Link>
					<span className="text-muted-foreground">/</span>
					<Link
						to="/admin/teams"
						className="text-muted-foreground hover:text-foreground"
					>
						{teamName}
					</Link>
					<span className="text-muted-foreground">/</span>
					<span className="text-foreground">Scaling</span>
				</nav>
			</div>

			<div className="container mx-auto px-5 pb-12">
				<div className="mb-8 mt-6">
					<h1 className="text-4xl font-bold mt-4">Scaling Groups</h1>
					<p className="text-muted-foreground mt-2">
						Manage custom scaling levels for your workouts. Create groups with
						different difficulty levels that can be applied to workouts and
						programming tracks. e.g. "Compete", "Rx", "Scaled"
					</p>
				</div>

				<div className="space-y-4">
					<div className="flex justify-end">
						<Button onClick={() => setCreatingGroup(true)}>
							<Plus className="h-4 w-4 mr-2" />
							Create Scaling Group
						</Button>
					</div>

					{scalingGroups.length === 0 ? (
						<Card className="border-2 border-dashed">
							<CardContent className="flex flex-col items-center justify-center py-12">
								<p className="text-muted-foreground mb-4">
									No scaling groups created yet
								</p>
								<Button onClick={() => setCreatingGroup(true)}>
									<Plus className="h-4 w-4 mr-2" />
									Create Your First Group
								</Button>
							</CardContent>
						</Card>
					) : (
						<div className="grid gap-4">
							{scalingGroups.map((group) => {
								const isTeamDefault = defaultScalingGroupId === group.id
								const isGlobalDefault = group.isSystem

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
														<CardDescription>
															{group.description}
														</CardDescription>
													)}
												</div>
												<div className="flex items-center gap-2">
													{!isGlobalDefault && !isTeamDefault && (
														<Button
															size="sm"
															variant="outline"
															onClick={() => handleSetDefault(group.id)}
															disabled={isSettingDefault}
														>
															<Star className="h-4 w-4" />
														</Button>
													)}
													{!isGlobalDefault && (
														<Button
															size="sm"
															variant="outline"
															onClick={() => setEditingGroup(group)}
														>
															<Settings className="h-4 w-4" />
														</Button>
													)}
													{!isGlobalDefault && (
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
						onSuccess={handleSuccess}
					/>
				)}
			</div>
		</>
	)
}
