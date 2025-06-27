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
			<DialogContent className="border-4 border-red-500 shadow-[8px_8px_0px_0px] shadow-red-500 rounded-none">
				<DialogHeader>
					<DialogTitle className="font-mono text-xl tracking-tight text-red-600">
						Delete Programming Track
					</DialogTitle>
					<DialogDescription className="font-mono text-sm">
						Are you sure you want to delete "{track.name}"? This action cannot
						be undone. All workouts associated with this track will also be
						removed.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter className="mt-4 flex flex-col gap-4 sm:flex-row">
					<DialogClose ref={dialogCloseRef} asChild>
						<Button className="sm:w-auto w-full border-2 border-primary shadow-[4px_4px_0px_0px] shadow-primary hover:shadow-[2px_2px_0px_0px] transition-all font-mono bg-white text-primary hover:bg-surface rounded-none">
							Cancel
						</Button>
					</DialogClose>
					<Button
						onClick={handleDelete}
						disabled={isPending}
						className="sm:w-auto w-full border-2 border-red-500 shadow-[4px_4px_0px_0px] shadow-red-500 hover:shadow-[2px_2px_0px_0px] transition-all font-mono bg-red-500 text-white hover:bg-red-600 rounded-none"
					>
						{isPending ? "Deleting..." : "Delete Track"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
