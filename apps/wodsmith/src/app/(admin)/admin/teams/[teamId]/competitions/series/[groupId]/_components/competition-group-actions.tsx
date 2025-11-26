"use client"

import { Pencil, Trash2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { useServerAction } from "@repo/zsa-react"
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
import { Button } from "@/components/ui/button"

interface CompetitionGroupActionsProps {
	groupId: string
	teamId: string
	hasCompetitions: boolean
}

export function CompetitionGroupActions({
	groupId,
	teamId,
	hasCompetitions,
}: CompetitionGroupActionsProps) {
	const router = useRouter()
	const [showDeleteDialog, setShowDeleteDialog] = useState(false)

	const { execute: deleteGroup, isPending: isDeleting } = useServerAction(
		deleteCompetitionGroupAction,
		{
			onSuccess: () => {
				toast.success("Series deleted successfully")
				router.push("/admin/teams/competitions/series")
				router.refresh()
			},
			onError: ({ err }) => {
				toast.error(err.message || "Failed to delete series")
			},
		},
	)

	const handleDelete = () => {
		deleteGroup({ groupId, organizingTeamId: teamId })
	}

	return (
		<>
			<div className="flex gap-2">
				<Link href={`/admin/teams/competitions/series/${groupId}/edit`}>
					<Button variant="outline" size="sm">
						<Pencil className="h-4 w-4 mr-2" />
						Edit
					</Button>
				</Link>
				<Button
					variant="outline"
					size="sm"
					onClick={() => setShowDeleteDialog(true)}
					className="text-destructive hover:text-destructive"
				>
					<Trash2 className="h-4 w-4 mr-2" />
					Delete
				</Button>
			</div>

			<AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Competition Series?</AlertDialogTitle>
						<AlertDialogDescription>
							This action cannot be undone. This will permanently delete the
							competition series.
							{hasCompetitions && (
								<span className="block mt-2 text-destructive font-medium">
									This series contains competitions. Please remove or reassign
									them first.
								</span>
							)}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleDelete}
							disabled={isDeleting || hasCompetitions}
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
