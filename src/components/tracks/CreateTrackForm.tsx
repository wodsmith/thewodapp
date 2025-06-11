"use client"
import { createTrackAction } from "@/app/actions/trackActions"
import { PROGRAMMING_TRACK_TYPE } from "@/db/schema"
import React from "react"
import { type ChangeEvent, type FormEvent, useState } from "react"

interface FormState {
	name: string
	description: string
	type: string
	ownerTeam: string
	isPublic: boolean
}

interface TeamOption {
	id: string
	name: string
}

interface Props {
	teams: TeamOption[]
}

function CreateTrackForm({ teams }: Props) {
	const [state, setState] = useState<FormState>({
		name: "",
		description: "",
		type: "",
		ownerTeam: teams[0]?.id ?? "",
		isPublic: false,
	})

	function handleChange(
		e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
	) {
		const { name, value, type, checked } = e.target as HTMLInputElement
		setState((prev) => ({
			...prev,
			[name]: type === "checkbox" ? checked : value,
		}))
	}

	async function handleSubmit(e: FormEvent) {
		e.preventDefault()

		try {
			const formData = new FormData()
			for (const [k, v] of Object.entries(state)) {
				formData.append(k, String(v))
			}
			await createTrackAction(formData)
		} catch (error) {
			console.error("[CreateTrackForm] Error creating track:", error)
		}
	}

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			<input
				name="name"
				placeholder="Name"
				value={state.name}
				onChange={handleChange}
				className="w-full border p-2"
			/>
			<textarea
				name="description"
				placeholder="Description"
				value={state.description}
				onChange={handleChange}
				className="w-full border p-2"
			/>
			<select
				name="type"
				value={state.type}
				onChange={handleChange}
				className="w-full border p-2 bg-white dark:bg-gray-800"
			>
				<option value="">Select Track Type</option>
				{Object.values(PROGRAMMING_TRACK_TYPE).map((trackType) => (
					<option key={trackType} value={trackType}>
						{trackType
							.replace(/_/g, " ")
							.replace(/\b\w/g, (c) => c.toUpperCase())}
					</option>
				))}
			</select>
			<select
				name="ownerTeam"
				value={state.ownerTeam}
				onChange={handleChange}
				className="w-full border p-2 bg-white dark:bg-gray-800"
			>
				<option value="">Select Team</option>
				{teams.map((team) => (
					<option key={team.id} value={team.id}>
						{team.name}
					</option>
				))}
			</select>
			<label className="flex items-center space-x-2">
				<input
					type="checkbox"
					name="isPublic"
					checked={state.isPublic}
					onChange={handleChange}
				/>
				<span>Public?</span>
			</label>
			<button type="submit" className="bg-black text-white px-4 py-2 rounded">
				Create Track
			</button>
		</form>
	)
}

export default CreateTrackForm
