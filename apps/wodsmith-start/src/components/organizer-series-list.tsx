"use client"

import { Link, useRouter } from "@tanstack/react-router"
import { Pencil, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import type { CompetitionGroup } from "@/db/schemas/competitions"
import { deleteCompetitionGroupFn } from "@/server-fns/competition-fns"

interface OrganizerSeriesListProps {
	groups: Array<CompetitionGroup & { competitionCount: number }>
	teamId: string
}

export function OrganizerSeriesList({
	groups,
	teamId: _teamId,
}: OrganizerSeriesListProps) {
	const router = useRouter()
	const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null)
	const [isDeleting, setIsDeleting] = useState(false)

	const handleDelete = async (groupId: string) => {
		setIsDeleting(true)
		try {
			await deleteCompetitionGroupFn({ data: { groupId } })
			toast.success("Series deleted successfully")
			setDeleteGroupId(null)
			// Invalidate router cache to refresh the list
			await router.invalidate()
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to delete series"
			toast.error(message)
		} finally {
			setIsDeleting(false)
		}
	}

	if (groups.length === 0) {
		return null // Empty state is handled in the route component
	}

	return (
		<>
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				{groups.map((group) => (
					<Card key={group.id} className="hover:bg-accent/50 transition-colors">
						<CardHeader>
							<div className="flex items-start justify-between">
								<div className="flex-1 min-w-0">
									<Link
										to="/compete/organizer/series/$groupId"
										params={{ groupId: group.id }}
									>
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
								<div className="flex gap-1">
									<Link
										to="/compete/organizer/series/$groupId"
										params={{ groupId: group.id }}
									>
										<Button variant="ghost" size="sm" title="View Details">
											<Pencil className="h-4 w-4" />
										</Button>
									</Link>
									<Button
										variant="ghost"
										size="sm"
										onClick={() => setDeleteGroupId(group.id)}
										disabled={group.competitionCount > 0}
										className="text-destructive hover:text-destructive disabled:opacity-50"
										title={
											group.competitionCount > 0
												? "Cannot delete series with competitions"
												: "Delete"
										}
									>
										<Trash2 className="h-4 w-4" />
									</Button>
								</div>
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

			{/* Simple delete confirmation modal */}
			{deleteGroupId && (
				<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
					<div className="bg-card p-6 rounded-lg max-w-md border">
						<h2 className="text-lg font-semibold mb-2">Delete Series?</h2>
						<p className="text-sm text-muted-foreground mb-4">
							This action cannot be undone. Series with competitions cannot be
							deleted.
						</p>
						<div className="flex justify-end gap-2">
							<Button
								variant="outline"
								onClick={() => setDeleteGroupId(null)}
								disabled={isDeleting}
							>
								Cancel
							</Button>
							<Button
								variant="destructive"
								onClick={() => deleteGroupId && handleDelete(deleteGroupId)}
								disabled={isDeleting}
							>
								{isDeleting ? "Deleting..." : "Delete"}
							</Button>
						</div>
					</div>
				</div>
			)}
		</>
	)
}
