"use client"

import { useState } from "react"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
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
import type { Workout, ProgrammingTrack } from "@/db/schema"

interface AlignScalingDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	workout: Pick<Workout, "id" | "name">
	track: Pick<ProgrammingTrack, "id" | "name">
	onConfirm: () => void | Promise<void>
	isLoading?: boolean
}

export function AlignScalingDialog({
	open,
	onOpenChange,
	workout,
	track,
	onConfirm,
	isLoading = false,
}: AlignScalingDialogProps) {
	const [isProcessing, setIsProcessing] = useState(false)

	const handleConfirm = async () => {
		setIsProcessing(true)
		try {
			await onConfirm()
			onOpenChange(false)
		} finally {
			setIsProcessing(false)
		}
	}

	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent className="max-w-md">
				<AlertDialogHeader>
					<AlertDialogTitle className="flex items-center gap-2">
						<AlertTriangle className="h-5 w-5 text-amber-500" />
						Align Workout Scaling with Track
					</AlertDialogTitle>
					<AlertDialogDescription className="space-y-4">
						<p>
							This will create a copy of the workout{" "}
							<span className="font-semibold">"{workout.name}"</span> with the
							scaling levels from the track{" "}
							<span className="font-semibold">"{track.name}"</span>.
						</p>
						<div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md p-3">
							<p className="text-sm text-amber-700 dark:text-amber-400">
								<strong>Note:</strong> The original workout will remain
								unchanged. A new version will be created specifically for this
								track with the aligned scaling levels.
							</p>
						</div>
						<p className="text-sm text-muted-foreground">
							This action ensures that athletes can log results using the
							track's custom scaling levels instead of the original workout's
							scaling.
						</p>
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={isProcessing || isLoading}>
						Cancel
					</AlertDialogCancel>
					<AlertDialogAction
						onClick={handleConfirm}
						disabled={isProcessing || isLoading}
						className="bg-primary hover:bg-primary/90 text-black"
					>
						{isProcessing || isLoading ? "Aligning..." : "Align Scaling"}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	)
}
