"use client"

import { useServerAction } from "@repo/zsa-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { createCompleteGymSetupWithCoaches } from "@/actions/complete-gym-setup-actions"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface CreateTemplateFormProps {
	teamId: string
}

export function CreateTemplateForm({ teamId }: CreateTemplateFormProps) {
	const [name, setName] = useState("")
	const router = useRouter()

	const { execute, isPending, error } = useServerAction(
		createCompleteGymSetupWithCoaches,
		{
			onSuccess: () => {
				console.log(
					"INFO: [CreateTemplateForm] Complete gym setup created successfully",
				)
				setName("")
				router.refresh()
			},
			onError: (error) => {
				console.error(
					"ERROR: [CreateTemplateForm] Failed to create complete gym setup:",
					error,
				)
			},
		},
	)

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		if (name.trim()) {
			await execute({
				teamId,
				templateName: name.trim(),
				className: "CrossFit",
				classDescription: "CrossFit classes for all fitness levels",
				locationName: "Main Gym",
				duration: 60,
				requiredCoaches: 1,
				cronExpressions: [
					// Monday through Friday at 6am
					"0 6 * * 1",
					"0 6 * * 2",
					"0 6 * * 3",
					"0 6 * * 4",
					"0 6 * * 5",
					// Monday through Friday at 7am
					"0 7 * * 1",
					"0 7 * * 2",
					"0 7 * * 3",
					"0 7 * * 4",
					"0 7 * * 5",
					// Monday through Friday at 8am
					"0 8 * * 1",
					"0 8 * * 2",
					"0 8 * * 3",
					"0 8 * * 4",
					"0 8 * * 5",
					// Monday through Friday at 11am
					"0 11 * * 1",
					"0 11 * * 2",
					"0 11 * * 3",
					"0 11 * * 4",
					"0 11 * * 5",
					// Monday through Friday at 12pm
					"0 12 * * 1",
					"0 12 * * 2",
					"0 12 * * 3",
					"0 12 * * 4",
					"0 12 * * 5",
					// Monday through Friday at 4pm
					"0 16 * * 1",
					"0 16 * * 2",
					"0 16 * * 3",
					"0 16 * * 4",
					"0 16 * * 5",
					// Monday through Friday at 5pm
					"0 17 * * 1",
					"0 17 * * 2",
					"0 17 * * 3",
					"0 17 * * 4",
					"0 17 * * 5",
					// Monday through Friday at 6pm
					"0 18 * * 1",
					"0 18 * * 2",
					"0 18 * * 3",
					"0 18 * * 4",
					"0 18 * * 5",
					// Saturday at 9am and 10am
					"0 9 * * 6",
					"0 10 * * 6",
					// Sunday at 12pm
					"0 12 * * 0",
				],
			})
		}
	}

	return (
		<Card className="w-full max-w-md mx-auto">
			<CardHeader>
				<CardTitle>Create Schedule Template</CardTitle>
				<CardDescription>
					Create your first schedule template to get started with automated
					scheduling.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="template-name">Template Name</Label>
						<Input
							id="template-name"
							type="text"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="e.g., Weekly Schedule"
							required
						/>
					</div>

					{error && (
						<p className="text-sm text-destructive">
							{error.message || "Failed to create template"}
						</p>
					)}

					<Button
						type="submit"
						disabled={isPending || !name.trim()}
						className="w-full"
					>
						{isPending ? "Creating..." : "Create Template"}
					</Button>
				</form>
			</CardContent>
		</Card>
	)
}
