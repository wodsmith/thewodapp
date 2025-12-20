"use client"

import { useServerAction } from "@repo/zsa-react"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { addWorkoutToTrackAction } from "@/actions/workout-actions"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import type { ProgrammingTrack } from "@/db/schema"

interface AddToTrackClientProps {
	workout: {
		id: string
		name: string
		description: string
	}
	workoutId: string
	teamId: string
	ownedTracks: ProgrammingTrack[]
}

export default function AddToTrackClient({
	workout,
	workoutId,
	teamId: _teamId,
	ownedTracks,
}: AddToTrackClientProps) {
	const [selectedTrackId, setSelectedTrackId] = useState<string>("")
	const router = useRouter()

	const { execute: addToTrack, isPending } = useServerAction(
		addWorkoutToTrackAction,
		{
			onError: (error) => {
				console.error("Failed to add workout to track:", error)
				toast.error(
					error.err?.message || "An error occurred adding workout to track",
				)
			},
			onSuccess: () => {
				toast.success("Workout added to track successfully")
				router.push(`/workouts/${workoutId}`)
			},
		},
	)

	const handleAddToTrack = async () => {
		if (!selectedTrackId) {
			toast.error("Please select a track")
			return
		}

		await addToTrack({
			trackId: selectedTrackId,
			workoutId,
		})
	}

	return (
		<div>
			<div className="mb-6 flex items-center justify-between">
				<div className="flex items-center gap-2">
					<Button asChild variant="outline" size="icon">
						<Link href={`/workouts/${workoutId}`}>
							<ArrowLeft className="h-5 w-5" />
						</Link>
					</Button>
					<h1>ADD TO PROGRAMMING TRACK</h1>
				</div>
			</div>

			<div className="border-2 border-black p-6">
				<div className="mb-6">
					<h2 className="mb-2 font-bold text-lg">{workout.name}</h2>
					<p className="text-muted-foreground">{workout.description}</p>
				</div>

				<div className="space-y-6">
					<div>
						<Label className="font-bold uppercase">
							Select Programming Track
						</Label>
						<Select onValueChange={setSelectedTrackId} value={selectedTrackId}>
							<SelectTrigger>
								<SelectValue placeholder="Select a track you own" />
							</SelectTrigger>
							<SelectContent>
								{ownedTracks.length === 0 ? (
									<SelectItem value="no-tracks" disabled>
										No programming tracks available
									</SelectItem>
								) : (
									ownedTracks.map((track) => (
										<SelectItem key={track.id} value={track.id}>
											{track.name}
										</SelectItem>
									))
								)}
							</SelectContent>
						</Select>
					</div>

					<div className="flex justify-end gap-4">
						<Button asChild variant="outline">
							<Link href={`/workouts/${workoutId}`}>Cancel</Link>
						</Button>
						<Button onClick={handleAddToTrack} disabled={isPending}>
							{isPending ? "Adding..." : "Add to Track"}
						</Button>
					</div>
				</div>
			</div>
		</div>
	)
}
