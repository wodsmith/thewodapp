"use client"

import { Eye, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { useServerAction } from "@repo/zsa-react"
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
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { CompetitionGroup } from "@/db/schema"
import { deleteCompetitionGroupAction } from "@/actions/competition-actions"

interface CompetitionGroupsListProps {
	groups: Array<CompetitionGroup & { competitionCount: number }>
	teamId: string
}

export function CompetitionGroupsList({
	groups,
	teamId,
}: CompetitionGroupsListProps) {
	const router = useRouter()
	const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null)

	const { execute: deleteGroup, isPending: isDeleting } = useServerAction(
		deleteCompetitionGroupAction,
		{
			onSuccess: () => {
				toast.success("Series deleted successfully")
				setDeleteGroupId(null)
				router.refresh()
			},
			onError: ({ err }) => {
				toast.error(err.message || "Failed to delete series")
			},
		},
	)

	const handleDelete = (groupId: string) => {
		deleteGroup({ groupId, organizingTeamId: teamId })
	}

	if (groups.length === 0) {
		return (
			<Card>
				<CardContent className="pt-6">
					<div className="text-center py-12">
						<p className="text-muted-foreground mb-4">
							No competition series found.
						</p>
						<p className="text-sm text-muted-foreground">
							Create a series to organize multiple competitions together.
						</p>
					</div>
				</CardContent>
			</Card>
		)
	}

	return (
		<>
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				{groups.map((group) => (
					<Card key={group.id} className="hover:bg-accent/50 transition-colors">
						<Link href={`/admin/teams/competitions/series/${group.id}`}>
							<CardHeader>
								<div className="flex items-start justify-between">
									<div className="flex-1 min-w-0">
										<CardTitle className="truncate">{group.name}</CardTitle>
										<CardDescription className="mt-1">
											{group.competitionCount}{" "}
											{group.competitionCount === 1
												? "competition"
												: "competitions"}
										</CardDescription>
									</div>
									<DropdownMenu>
										<DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
											<Button variant="ghost" size="sm">
												<MoreHorizontal className="h-4 w-4" />
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="end">
											<DropdownMenuItem asChild>
												<Link
													href={`/admin/teams/competitions/series/${group.id}`}
												>
													<Eye className="h-4 w-4 mr-2" />
													View
												</Link>
											</DropdownMenuItem>
											<DropdownMenuItem asChild>
												<Link
													href={`/admin/teams/competitions/series/${group.id}/edit`}
												>
													<Pencil className="h-4 w-4 mr-2" />
													Edit
												</Link>
											</DropdownMenuItem>
											<DropdownMenuItem
												onClick={() => setDeleteGroupId(group.id)}
												className="text-destructive"
											>
												<Trash2 className="h-4 w-4 mr-2" />
												Delete
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								</div>
							</CardHeader>
							{group.description && (
								<CardContent>
									<p className="text-sm text-muted-foreground line-clamp-2">
										{group.description}
									</p>
								</CardContent>
							)}
						</Link>
					</Card>
				))}
			</div>

			<AlertDialog
				open={deleteGroupId !== null}
				onOpenChange={(open) => !open && setDeleteGroupId(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Competition Series?</AlertDialogTitle>
						<AlertDialogDescription>
							This action cannot be undone. This will permanently delete the
							competition series.
							{deleteGroupId &&
								(groups.find((g) => g.id === deleteGroupId)
									?.competitionCount ?? 0) > 0 && (
									<span className="block mt-2 text-destructive font-medium">
										This series contains competitions. Please remove or
										reassign them first.
									</span>
								)}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => deleteGroupId && handleDelete(deleteGroupId)}
							disabled={isDeleting}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							{isDeleting ? "Deleting..." : "Delete"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	)
}
