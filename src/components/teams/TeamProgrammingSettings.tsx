"use client"
import {
	assignTrackToTeamAction,
	setTeamTrackActivityAction,
	updateTeamDefaultTrackAction,
} from "@/app/actions/teamProgrammingActions"
import React, { type FormEvent, useState } from "react"

interface Track {
	id: string
	name: string
	isActive: boolean
}

interface Props {
	teamId: string
}

export function TeamProgrammingSettings({ teamId }: Props) {
	const [tracks, setTracks] = useState<Track[]>([])
	const [selectedTrackId, setSelectedTrackId] = useState<string>("")

	async function handleAssign(e: FormEvent) {
		e.preventDefault()
		if (!selectedTrackId) return
		await assignTrackToTeamAction(teamId, selectedTrackId, true)
		setTracks((prev) => [
			...prev,
			{ id: selectedTrackId, name: selectedTrackId, isActive: true },
		])
		setSelectedTrackId("")
	}

	async function handleSetDefault(trackId: string) {
		await updateTeamDefaultTrackAction(teamId, trackId)
		// optimistic ui: not implemented
	}

	async function toggleActivity(trackId: string, isActive: boolean) {
		await setTeamTrackActivityAction(teamId, trackId, !isActive)
		setTracks((prev) =>
			prev.map((t) => (t.id === trackId ? { ...t, isActive: !isActive } : t)),
		)
	}

	return (
		<section className="space-y-4">
			<h2 className="text-xl font-semibold">Programming Tracks</h2>

			<form onSubmit={handleAssign} className="flex space-x-2">
				<input
					value={selectedTrackId}
					onChange={(e) => setSelectedTrackId(e.target.value)}
					placeholder="Track ID"
					className="border p-1"
				/>
				<button type="submit" className="bg-black text-white px-3 py-1 rounded">
					Assign
				</button>
			</form>

			{!tracks.length ? (
				<p>No tracks assigned.</p>
			) : (
				<ul className="space-y-1">
					{tracks.map((track) => (
						<li key={track.id} className="flex items-center space-x-2">
							<span>{track.name}</span>
							<button
								type="button"
								className="text-blue-600 underline"
								onClick={() => handleSetDefault(track.id)}
							>
								Set Default
							</button>
							<button
								type="button"
								className="text-sm"
								onClick={() => toggleActivity(track.id, track.isActive)}
							>
								{track.isActive ? "Deactivate" : "Activate"}
							</button>
						</li>
					))}
				</ul>
			)}
		</section>
	)
}
