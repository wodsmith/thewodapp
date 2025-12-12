"use client"

import { useState } from "react"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"

interface SettingsFormProps {
	initialValues?: {
		name?: string
		email?: string
	}
	onSubmit?: (values: { name: string; email: string }) => void
	isLoading?: boolean
}

export function SettingsForm({
	initialValues,
	onSubmit,
	isLoading,
}: SettingsFormProps) {
	const [name, setName] = useState(initialValues?.name || "")
	const [email, setEmail] = useState(initialValues?.email || "")

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault()
		onSubmit?.({ name, email })
	}

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			<div className="space-y-2">
				<Label htmlFor="name">Name</Label>
				<Input
					id="name"
					value={name}
					onChange={(e) => setName(e.target.value)}
					placeholder="Your name"
				/>
			</div>
			<div className="space-y-2">
				<Label htmlFor="email">Email</Label>
				<Input
					id="email"
					type="email"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					placeholder="your@email.com"
				/>
			</div>
			<Button type="submit" disabled={isLoading}>
				{isLoading ? "Saving..." : "Save Changes"}
			</Button>
		</form>
	)
}
