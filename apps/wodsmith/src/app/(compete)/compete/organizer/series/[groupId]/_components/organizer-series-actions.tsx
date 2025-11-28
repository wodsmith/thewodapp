"use client"

import { MoreHorizontal, Pencil, Trash2 } from "lucide-react"
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
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { deleteCompetitionGroupAction } from "@/actions/competition-actions"

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

	const { execute: deleteGroup, isPending: isDeleting } = useServerAction(
		deleteCompetitionGroupAction,
		{
			onSuccess: () => {
				toast.success("Series deleted successfully")
				router.push("/compete/organizer/series")
			},
			onError: ({ err }) => {
				toast.error(err.message || "Failed to delete series")
			},
		},
	)

	const handleDelete = () => {
		deleteGroup({ groupId, organizingTeamId })
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
						<Link href={`/compete/organizer/series/${groupId}/edit`}>
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
						<AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
						{canDelete && (
							<AlertDialogAction
								onClick={handleDelete}
								disabled={isDeleting}
								className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							>
								{isDeleting ? "Deleting..." : "Delete"}
							</AlertDialogAction>
						)}
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	)
}
