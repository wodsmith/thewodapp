"use client"
import { addWorkoutToTrackAction } from "@/app/actions/trackActions"
import React, { useState, type ChangeEvent, type FormEvent } from "react"

interface Props {
	trackId: string
}

function AddWorkoutToTrackModal({ trackId }: Props) {
	const [open, setOpen] = useState(false)
	const [state, setState] = useState({
		workoutId: "",
		dayNumber: "",
		weekNumber: "",
		notes: "",
	})

	function handleChange(
		e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
	) {
		const { name, value } = e.target
		setState((prev) => ({ ...prev, [name]: value }))
	}

	async function handleSubmit(e: FormEvent) {
		e.preventDefault()
		if (process.env.NODE_ENV === "development") {
			console.log("[AddWorkoutToTrackModal] Adding workout to track:", {
				trackId,
				...state,
			})
		}
		try {
			const formData = new FormData()
			formData.append("trackId", trackId)
			for (const [k, v] of Object.entries(state)) {
				formData.append(k, v)
			}
			await addWorkoutToTrackAction(formData)
			setOpen(false)
		} catch (error) {
			console.error("[AddWorkoutToTrackModal] Error adding workout:", error)
		}
	}

	if (!open) {
		return (
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="bg-black text-white px-3 py-1 rounded"
			>
				Add Workout
			</button>
		)
	}

	return (
		<form onSubmit={handleSubmit} className="space-y-2 border p-4">
			<input
				name="workoutId"
				placeholder="Workout ID"
				value={state.workoutId}
				onChange={handleChange}
				className="w-full border p-2"
			/>
			<input
				name="dayNumber"
				placeholder="Day Number"
				value={state.dayNumber}
				onChange={handleChange}
				className="w-full border p-2"
			/>
			<input
				name="weekNumber"
				placeholder="Week Number"
				value={state.weekNumber}
				onChange={handleChange}
				className="w-full border p-2"
			/>
			<textarea
				name="notes"
				placeholder="Notes"
				value={state.notes}
				onChange={handleChange}
				className="w-full border p-2"
			/>
			<div className="flex space-x-2">
				<button type="submit" className="bg-black text-white px-3 py-1 rounded">
					Save
				</button>
				<button
					type="button"
					onClick={() => setOpen(false)}
					className="px-3 py-1"
				>
					Cancel
				</button>
			</div>
		</form>
	)
}

export default AddWorkoutToTrackModal
