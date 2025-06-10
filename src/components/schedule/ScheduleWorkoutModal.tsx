"use client"
import { scheduleWorkoutAction } from "@/app/actions/schedulingActions"
import React, { useState, type ChangeEvent, type FormEvent } from "react"

interface Props {
	teamId: string
}

export default function ScheduleWorkoutModal({ teamId }: Props) {
	const [open, setOpen] = useState(false)
	const [state, setState] = useState({
		trackWorkoutId: "",
		scheduledDate: "",
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
			console.log("[ScheduleWorkoutModal] Scheduling workout", {
				teamId,
				...state,
			})
		}
		const formData = new FormData()
		formData.append("teamId", teamId)
		for (const [k, v] of Object.entries(state)) {
			formData.append(k, v)
		}
		await scheduleWorkoutAction(formData)
		setOpen(false)
	}

	if (!open) {
		return (
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="bg-black text-white px-3 py-1 rounded"
			>
				Schedule Workout
			</button>
		)
	}

	return (
		<form onSubmit={handleSubmit} className="space-y-2 border p-4">
			<input
				name="trackWorkoutId"
				placeholder="Track Workout ID"
				value={state.trackWorkoutId}
				onChange={handleChange}
				className="border p-1 w-full"
			/>
			<input
				name="scheduledDate"
				type="date"
				value={state.scheduledDate}
				onChange={handleChange}
				className="border p-1 w-full"
			/>
			<textarea
				name="notes"
				placeholder="Notes"
				value={state.notes}
				onChange={handleChange}
				className="border p-1 w-full"
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
