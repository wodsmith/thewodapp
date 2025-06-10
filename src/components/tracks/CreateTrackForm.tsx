"use client"
import { createTrackAction } from "@/app/actions/trackActions"
import React from "react"
import { type ChangeEvent, type FormEvent, useState } from "react"

interface FormState {
	name: string
	description: string
	type: string
	ownerTeam: string
	isPublic: boolean
}

function CreateTrackForm() {
	const [state, setState] = useState<FormState>({
		name: "",
		description: "",
		type: "",
		ownerTeam: "",
		isPublic: false,
	})

	function handleChange(
		e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
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
			<input
				name="type"
				placeholder="Type"
				value={state.type}
				onChange={handleChange}
				className="w-full border p-2"
			/>
			<input
				name="ownerTeam"
				placeholder="Owner Team"
				value={state.ownerTeam}
				onChange={handleChange}
				className="w-full border p-2"
			/>
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
