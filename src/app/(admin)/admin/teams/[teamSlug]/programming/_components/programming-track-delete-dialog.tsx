"use client"

import { Button } from "@/components/ui/button"
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog"
import type { ProgrammingTrack } from "@/db/schema"
import { useRef } from "react"
import { toast } from "sonner"
import { useServerAction } from "zsa-react"
import { deleteProgrammingTrackAction } from "../../_actions/programming-track-actions"

interface ProgrammingTrackDeleteDialogProps {
	track: ProgrammingTrack
	teamId: string
	trigger: React.ReactNode
	onDeletedAction?: () => void
	open?: boolean
	onOpenChange?: (open: boolean) => void
}

export function ProgrammingTrackDeleteDialog({
	track,
	teamId,
	trigger,
	onDeletedAction,
	open,
	onOpenChange,
}: ProgrammingTrackDeleteDialogProps) {
	const dialogCloseRef = useRef<HTMLButtonElement>(null)

	const { execute: deleteTrack, isPending } = useServerAction(
		deleteProgrammingTrackAction,
		{
			onError: (error) => {
				toast.error(error.err?.message || "Failed to delete programming track")
			},
			onSuccess: () => {
				toast.success("Programming track deleted successfully")
				onDeletedAction?.()
				dialogCloseRef.current?.click()
			},
		},
	)

	const handleDelete = () => {
		deleteTrack({
			teamId,
			trackId: track.id,
		})
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogTrigger asChild>{trigger}</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Delete Programming Track</DialogTitle>
					<DialogDescription>
						Are you sure you want to delete "{track.name}"? This action cannot
						be undone. All workouts associated with this track will also be
						removed.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter className="mt-4 flex flex-col gap-4 sm:flex-row">
					<DialogClose ref={dialogCloseRef} asChild>
						<Button variant="outline" className="sm:w-auto w-full">
							Cancel
						</Button>
					</DialogClose>
					<Button
						variant="destructive"
						onClick={handleDelete}
						disabled={isPending}
						className="sm:w-auto w-full"
					>
						{isPending ? "Deleting..." : "Delete Track"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
