"use client"

import { useState } from "react"
import { Send } from "lucide-react"
import { useServerAction } from "@repo/zsa-react"
import { useSessionStore } from "@/state/session"
import { publishRotationsAction } from "@/actions/judge-assignment-actions"
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import type { CoverageStats } from "@/lib/judge-rotation-utils"

interface PublishRotationsButtonProps {
	teamId: string
	trackWorkoutId: string
	rotationsCount: number
	coverage: CoverageStats
	hasActiveVersion: boolean
	nextVersionNumber: number
	onPublishSuccess?: () => void
	disabled?: boolean
}

/**
 * Button with confirmation dialog for publishing judge rotations.
 * Shows coverage summary and allows optional version notes.
 */
export function PublishRotationsButton({
	teamId,
	trackWorkoutId,
	rotationsCount,
	coverage,
	hasActiveVersion,
	nextVersionNumber,
	onPublishSuccess,
	disabled = false,
}: PublishRotationsButtonProps) {
	const [notes, setNotes] = useState("")
	const [open, setOpen] = useState(false)
	const { toast } = useToast()
	const session = useSessionStore((state) => state.session)

	const { execute: publishRotations, isPending } = useServerAction(
		publishRotationsAction,
	)

	const handlePublish = async () => {
		if (!session?.userId) {
			toast({
				title: "Authentication required",
				description: "You must be logged in to publish rotations",
				variant: "destructive",
			})
			return
		}

		const [data, err] = await publishRotations({
			teamId,
			trackWorkoutId,
			publishedBy: session.userId,
			notes: notes.trim() || undefined,
		})

		if (err) {
			toast({
				title: "Failed to publish rotations",
				description: err.message,
				variant: "destructive",
			})
			return
		}

		if (data?.data) {
			toast({
				title: "Rotations published",
				description: `Version ${data.data.version} created successfully`,
			})
			setOpen(false)
			setNotes("")
			onPublishSuccess?.()
		}
	}

	const isPerfect =
		coverage.coveragePercent === 100 && coverage.gaps.length === 0
	const hasGaps = coverage.gaps.length > 0

	return (
		<AlertDialog open={open} onOpenChange={setOpen}>
			<AlertDialogTrigger asChild>
				<Button disabled={disabled || rotationsCount === 0}>
					<Send className="h-4 w-4 mr-2" />
					Publish Rotations
				</Button>
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>
						{hasActiveVersion ? "Publish New Version" : "Publish Rotations"}
					</AlertDialogTitle>
					<AlertDialogDescription>
						{hasActiveVersion
							? `This will create version ${nextVersionNumber} of the judge assignments.`
							: "This will create the first version of judge assignments for this event."}
					</AlertDialogDescription>
				</AlertDialogHeader>

				<div className="space-y-4">
					{/* Coverage Summary */}
					<div className="rounded-lg border p-4 space-y-2">
						<h4 className="font-medium text-sm">Coverage Summary</h4>
						<div className="grid grid-cols-2 gap-2 text-sm">
							<div>
								<span className="text-muted-foreground">Rotations:</span>
								<span className="ml-2 font-medium tabular-nums">
									{rotationsCount}
								</span>
							</div>
							<div>
								<span className="text-muted-foreground">Coverage:</span>
								<span
									className={`ml-2 font-medium tabular-nums ${
										isPerfect
											? "text-green-600"
											: hasGaps
												? "text-orange-600"
												: "text-blue-600"
									}`}
								>
									{coverage.coveragePercent}%
								</span>
							</div>
							<div>
								<span className="text-muted-foreground">Slots covered:</span>
								<span className="ml-2 font-medium tabular-nums">
									{coverage.coveredSlots}/{coverage.totalSlots}
								</span>
							</div>
							{hasGaps && (
								<div>
									<span className="text-muted-foreground">Gaps:</span>
									<span className="ml-2 font-medium text-orange-600 tabular-nums">
										{coverage.gaps.length}
									</span>
								</div>
							)}
							{coverage.overlaps.length > 0 && (
								<div>
									<span className="text-muted-foreground">Overlaps:</span>
									<span className="ml-2 font-medium text-orange-600 tabular-nums">
										{coverage.overlaps.length}
									</span>
								</div>
							)}
						</div>
						{hasGaps && (
							<p className="text-xs text-orange-600 mt-2">
								⚠️ Warning: Not all slots have judge coverage
							</p>
						)}
					</div>

					{/* Optional Notes */}
					<div className="space-y-2">
						<Label htmlFor="notes">Version Notes (Optional)</Label>
						<Textarea
							id="notes"
							placeholder="e.g., Updated rotation for final heat changes..."
							value={notes}
							onChange={(e) => setNotes(e.target.value)}
							rows={3}
						/>
					</div>
				</div>

				<AlertDialogFooter>
					<AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
					<AlertDialogAction onClick={handlePublish} disabled={isPending}>
						{isPending ? "Publishing..." : "Publish"}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	)
}
