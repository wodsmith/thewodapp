"use client"

import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import type { CreateMovementActionInput } from "@/actions/movement-actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { MOVEMENT_TYPE_VALUES } from "@/db/schema"
import type { Movement } from "@/types"

interface Props {
	createMovementAction: (data: CreateMovementActionInput) => Promise<void>
}

export default function CreateMovementForm({ createMovementAction }: Props) {
	const [name, setName] = useState("")
	const [type, setType] = useState<Movement["type"]>()
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const router = useRouter()

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault()
		setIsSubmitting(true)
		setError(null)

		if (!name || !type) {
			setError("Name and type are required.")
			setIsSubmitting(false)
			return
		}

		try {
			await createMovementAction({ name, type })
			// Assuming the server action handles potential errors and revalidates/redirects
			// For now, we redirect on the client side after successful submission
			router.push("/movements") // Redirect to the movements list page
		} catch (err) {
			console.error("Failed to create movement:", err)
			setError(
				err instanceof Error ? err.message : "An unknown error occurred.",
			)
		} finally {
			setIsSubmitting(false)
		}
	}

	return (
		<div>
			<div className="mb-6 flex items-center justify-between">
				<div className="flex items-center gap-2">
					<Button asChild variant="outline" size="icon">
						<Link href="/movements">
							<ArrowLeft className="h-5 w-5" />
						</Link>
					</Button>
					<h1>CREATE MOVEMENT</h1>
				</div>
			</div>

			<form
				className="mx-auto max-w-md border-2 border-black p-6 dark:border-white"
				onSubmit={handleSubmit}
			>
				<div className="space-y-6">
					<div>
						<Label htmlFor="movementName">Movement Name</Label>
						<Input
							id="movementName"
							type="text"
							placeholder="e.g., Back Squat, Thruster, Burpee"
							value={name}
							onChange={(e) => setName(e.target.value)}
							required
						/>
					</div>

					<div>
						<Label htmlFor="movementType">Movement Type</Label>
						<Select
							value={type}
							onValueChange={(value) => setType(value as Movement["type"])}
						>
							<SelectTrigger id="movementType">
								<SelectValue placeholder="Select a type" />
							</SelectTrigger>
							<SelectContent>
								{MOVEMENT_TYPE_VALUES.map((movementType) => (
									<SelectItem key={movementType} value={movementType}>
										{movementType}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{error && <p className="text-red-500">{error}</p>}

					<Button type="submit" disabled={isSubmitting} className="w-full">
						{isSubmitting ? "Creating..." : "Create Movement"}
					</Button>
				</div>
			</form>
		</div>
	)
}
