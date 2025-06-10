"use client"
import AddWorkoutToTrackModal from "@/components/tracks/AddWorkoutToTrackModal"
import React from "react"

interface Props {
	trackId: string
}

export function TrackWorkoutManager({ trackId }: Props) {
	return (
		<div className="space-y-2">
			<h3 className="text-lg font-semibold">Workouts in Track</h3>
			<p>No workouts yet.</p>
			<AddWorkoutToTrackModal trackId={trackId} />
		</div>
	)
}
