"use client"

import { MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import { Link, useRouter } from "@tanstack/react-router"
import { useState } from "react"
import { toast } from "sonner"
import { useServerFnMutation } from "~/hooks/use-server-fn"
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "~/components/ui/alert-dialog"
import { Button } from "~/components/ui/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { deleteCompetitionGroupFn } from "~/server-functions/competitions"

interface OrganizerSeriesActionsProps {
	groupId: string
	organizingTeamId: string
	competitionCount: number
}

export function OrganizerSeriesActions({
	groupId,
	organizingTeamId,
	competitionCount,
}: OrganizerSeriesActionsProps) {
	const router = useRouter()
	const [showDeleteDialog, setShowDeleteDialog] = useState(false)

	const canDelete = competitionCount === 0

	const deleteGroupMutation = useServerFnMutation(deleteCompetitionGroupFn, {
		onSuccess: () => {
			toast.success("Series deleted successfully")
			router.navigate({ to: "/compete/organizer/series" })
		},
		onError: (error) => {
			const message =
				error instanceof Error ? error.message : "Failed to delete series"
			toast.error(message)
		},
	})

	const handleDelete = () => {
		deleteGroupMutation.mutate({ groupId, organizingTeamId })
	}

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="outline" size="sm">
						<MoreHorizontal className="h-4 w-4" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuItem asChild>
						<Link to={`/compete/organizer/series/$groupId/edit`} params={{ groupId }}>
							<Pencil className="h-4 w-4 mr-2" />
							Edit Series
						</Link>
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem
						onClick={() => setShowDeleteDialog(true)}
						className="text-destructive"
						disabled={!canDelete}
					>
						<Trash2 className="h-4 w-4 mr-2" />
						Delete Series
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			<AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Series?</AlertDialogTitle>
						<AlertDialogDescription>
							{canDelete
								? "This action cannot be undone. This will permanently delete the series."
								: `Cannot delete series with ${competitionCount} competition(s). Please remove or reassign competitions first.`}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={deleteGroupMutation.isPending}>
							Cancel
						</AlertDialogCancel>
						{canDelete && (
							<AlertDialogAction
								onClick={handleDelete}
								disabled={deleteGroupMutation.isPending}
								className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							>
								{deleteGroupMutation.isPending ? "Deleting..." : "Delete"}
							</AlertDialogAction>
						)}
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	)
}
