"use client"

import { Pencil, Trash2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { useServerAction } from "@repo/zsa-react"
import { deleteCompetitionAction } from "@/actions/competition-actions"
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

interface CompetitionActionsProps {
	competitionId: string
	teamId: string
}

export function CompetitionActions({
	competitionId,
	teamId,
}: CompetitionActionsProps) {
	const router = useRouter()
	const [showDeleteDialog, setShowDeleteDialog] = useState(false)

	const { execute: deleteCompetition, isPending: isDeleting } = useServerAction(
		deleteCompetitionAction,
		{
			onSuccess: () => {
				toast.success("Competition deleted successfully")
				router.push(`/admin/teams/${teamId}/competitions`)
				router.refresh()
			},
			onError: ({ err }) => {
				toast.error(err.message || "Failed to delete competition")
			},
		},
	)

	const handleDelete = () => {
		deleteCompetition({ competitionId, organizingTeamId: teamId })
	}

	return (
		<>
			<div className="flex gap-2">
				<Link href={`/admin/teams/${teamId}/competitions/${competitionId}/edit`}>
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
						<AlertDialogTitle>Delete Competition?</AlertDialogTitle>
						<AlertDialogDescription>
							This action cannot be undone. This will permanently delete the
							competition and all associated data.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
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
		</>
	)
}
