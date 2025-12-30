"use client"

import { useServerAction } from "@repo/zsa-react"
import { FolderOpen, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { deleteCompetitionGroupAction } from "@/actions/competition-actions"
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
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { CompetitionGroup } from "@/db/schema"

interface OrganizerSeriesListProps {
	groups: Array<CompetitionGroup & { competitionCount: number }>
	teamId: string
}

export function OrganizerSeriesList({
	groups,
	teamId,
}: OrganizerSeriesListProps) {
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
						<FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
						<h3 className="text-lg font-medium mb-2">No series yet</h3>
						<p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
							Create a series to organize related competitions together, like
							annual events or recurring challenges.
						</p>
						<Link href="/compete/organizer/series/new">
							<Button>
								<Plus className="h-4 w-4 mr-2" />
								Create Series
							</Button>
						</Link>
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
						<CardHeader>
							<div className="flex items-start justify-between">
								<div className="flex-1 min-w-0">
									<Link href={`/compete/organizer/series/${group.id}`}>
										<CardTitle className="truncate hover:underline">
											{group.name}
										</CardTitle>
									</Link>
									<CardDescription className="mt-1">
										<Badge variant="secondary">
											{group.competitionCount} competition
											{group.competitionCount !== 1 ? "s" : ""}
										</Badge>
									</CardDescription>
								</div>
								<DropdownMenu>
									<DropdownMenuTrigger
										asChild
										onClick={(e) => e.preventDefault()}
									>
										<Button variant="ghost" size="sm">
											<MoreHorizontal className="h-4 w-4" />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end">
										<DropdownMenuItem asChild>
											<Link href={`/compete/organizer/series/${group.id}`}>
												<Pencil className="h-4 w-4 mr-2" />
												View Details
											</Link>
										</DropdownMenuItem>
										<DropdownMenuItem asChild>
											<Link href={`/compete/organizer/series/${group.id}/edit`}>
												<Pencil className="h-4 w-4 mr-2" />
												Edit
											</Link>
										</DropdownMenuItem>
										<DropdownMenuSeparator />
										<DropdownMenuItem
											onClick={() => setDeleteGroupId(group.id)}
											className="text-destructive"
											disabled={group.competitionCount > 0}
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
					</Card>
				))}
			</div>

			<AlertDialog
				open={deleteGroupId !== null}
				onOpenChange={(open) => !open && setDeleteGroupId(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Series?</AlertDialogTitle>
						<AlertDialogDescription>
							This action cannot be undone. Series with competitions cannot be
							deleted.
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
