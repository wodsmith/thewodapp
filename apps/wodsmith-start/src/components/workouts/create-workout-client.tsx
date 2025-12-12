"use client"

import { useState } from "react"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Textarea } from "~/components/ui/textarea"

interface CreateWorkoutClientProps {
	onSubmit?: (data: { name: string; description: string }) => void
	isLoading?: boolean
}

export function CreateWorkoutClient({
	onSubmit,
	isLoading,
}: CreateWorkoutClientProps) {
	const [name, setName] = useState("")
	const [description, setDescription] = useState("")

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault()
		onSubmit?.({ name, description })
	}

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			<div className="space-y-2">
				<Label htmlFor="name">Workout Name</Label>
				<Input
					id="name"
					value={name}
					onChange={(e) => setName(e.target.value)}
					placeholder="Enter workout name"
					required
				/>
			</div>
			<div className="space-y-2">
				<Label htmlFor="description">Description</Label>
				<Textarea
					id="description"
					value={description}
					onChange={(e) => setDescription(e.target.value)}
					placeholder="Describe the workout..."
					rows={5}
				/>
			</div>
			<Button type="submit" disabled={isLoading}>
				{isLoading ? "Creating..." : "Create Workout"}
			</Button>
		</form>
	)
}
