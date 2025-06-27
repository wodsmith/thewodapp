"use client"

import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import type { CreateMovementActionInput } from "@/actions/movement-actions"
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
					<Link href="/movements" className="btn-outline p-2">
						<ArrowLeft className="h-5 w-5" />
					</Link>
					<h1>CREATE MOVEMENT</h1>
				</div>
			</div>

			<form
				className="mx-auto max-w-md border-2 border-black p-6"
				onSubmit={handleSubmit}
			>
				<div className="space-y-6">
					<div>
						<label
							htmlFor="movementName"
							className="mb-2 block font-bold uppercase"
						>
							Movement Name
						</label>
						<input
							id="movementName"
							type="text"
							className="input"
							placeholder="e.g., Back Squat, Thruster, Burpee"
							value={name}
							onChange={(e) => setName(e.target.value)}
							required
						/>
					</div>

					<div>
						<label
							htmlFor="movementType"
							className="mb-2 block font-bold uppercase"
						>
							Movement Type
						</label>
						<select
							id="movementType"
							className="select"
							value={type}
							onChange={(e) => setType(e.target.value as Movement["type"])}
							required
						>
							<option value="">Select a type</option>
							{MOVEMENT_TYPE_VALUES.map((movementType) => (
								<option key={movementType} value={movementType}>
									{movementType}
								</option>
							))}
						</select>
					</div>

					{error && <p className="text-red-500">{error}</p>}

					<button type="submit" className="btn w-full" disabled={isSubmitting}>
						{isSubmitting ? "Creating..." : "Create Movement"}
					</button>
				</div>
			</form>
		</div>
	)
}
